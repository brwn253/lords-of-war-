// ===== LORDS OF WAR - MULTIPLAYER SERVER =====
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const cors = require('cors');
const { db, initializeDatabase } = require('./database');
const authRoutes = require('./auth-routes');
const profileRoutes = require('./profile-routes');
const deckRoutes = require('./deck-routes');
const friendsRoutes = require('./friends-routes');
const messagesRoutes = require('./messages-routes');
const allianceRoutes = require('./alliance-routes');
const chatRoutes = require('./chat-routes');
const auctionRoutes = require('./auction-routes');
const shopRoutes = require('./shop-routes');
const collectionRoutes = require('./collection-routes');
const leaderboardsRoutes = require('./leaderboards-routes');
const adventureRoutes = require('./adventure-routes');
const { track1v1Win, getCurrentSeasonId } = require('./leaderboard-tracking');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// ===== CONFIGURATION =====
const PORT = process.env.PORT || 8080;
const GAME_CONSTANTS = {
  STARTING_HEALTH: 30,
  MAX_BOARD_SIZE: 10,
  MAX_ESSENCE: 10,
  DISCONNECT_TIMEOUT: 60000, // 60 seconds
  TURN_TIMEOUT: 120000 // 120 seconds (2 minutes)
};

// ===== STATE MANAGEMENT =====
const waitingPlayers = [];
const activeGames = new Map(); // roomId -> GameRoom
const playerSockets = new Map(); // socketId -> { playerId, roomId, role }
const userSockets = new Map(); // userId -> Set of socketIds (users can have multiple sessions)
const pendingChallenges = new Map(); // challengeId -> { challengerUserId, challengerSocketId, recipientUserId, createdAt }

// ===== SERVE STATIC FILES =====
// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize database
initializeDatabase();

// Auth routes
app.use('/api/auth', authRoutes);

// Profile routes
app.use('/api/profile', profileRoutes);

// Deck routes
app.use('/api/deck', deckRoutes);

// Friends routes
app.use('/api/friends', friendsRoutes);

// Messages routes
app.use('/api/messages', messagesRoutes);

// Alliance routes
app.use('/api/alliance', allianceRoutes);

// Chat routes
app.use('/api/chat', chatRoutes);

// Auction House routes
app.use('/api/auction', auctionRoutes);

// Shop routes
app.use('/api/shop', shopRoutes);

// Collection routes
app.use('/api/collection', collectionRoutes);

// Leaderboards routes
app.use('/api/leaderboards', leaderboardsRoutes);

// Adventure routes
app.use('/api/adventure', adventureRoutes);

// Default route - serve auth page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'auth.html'));
});

// Serve the game client files from parent directory
app.use(express.static(path.join(__dirname, '..')));

// ===== SOCKET.IO EVENT HANDLERS =====
io.on('connection', (socket) => {
  console.log(`[CONNECTION] ========== NEW CONNECTION ==========`);
  console.log(`[CONNECTION] Player connected: ${socket.id}`);
  console.log(`[CONNECTION] Total connected sockets: ${io.sockets.sockets.size}`);
  
  // Track user login (when userId is provided)
  socket.on('userLogin', ({ userId }) => {
    if (userId) {
      if (!userSockets.has(userId)) {
        userSockets.set(userId, new Set());
      }
      userSockets.get(userId).add(socket.id);
      socket.userId = userId;
      
      // Notify friends of online status
      notifyFriendsStatusChange(userId, 'online');
      console.log(`[STATUS] User ${userId} logged in, socket ${socket.id}`);
    }
  });
  
  // Test event to verify connection
  socket.on('test', () => {
    console.log(`[TEST] Received test event from ${socket.id}`);
  });

  // ===== CHALLENGE TO DUEL =====
  socket.on('challengeFriend', ({ friendUserId }) => {
    if (!socket.userId) {
      socket.emit('error', { message: 'You must be logged in to challenge friends' });
      return;
    }

    const challengerUserId = socket.userId;
    
    // Check if friend has blocked challenger
    const { db } = require('./database');
    db.get(
      'SELECT id FROM blocked_users WHERE user_id = ? AND blocked_user_id = ?',
      [friendUserId, challengerUserId],
      (err, blocked) => {
        if (err) {
          console.error('Error checking blocked users:', err);
          socket.emit('error', { message: 'Database error occurred' });
          return;
        }

        if (blocked) {
          socket.emit('error', { message: 'You cannot challenge this user' });
          return;
        }

        const challengeId = uuidv4();

        // Store challenge
        pendingChallenges.set(challengeId, {
          challengerUserId,
          challengerSocketId: socket.id,
          recipientUserId: friendUserId,
          createdAt: Date.now()
        });

        // Notify friend if online
        const friendSockets = userSockets.get(friendUserId);
        if (friendSockets && friendSockets.size > 0) {
          friendSockets.forEach(friendSocketId => {
            io.to(friendSocketId).emit('friendChallenge', {
              challengeId,
              challengerUserId,
              challengerUsername: socket.username || 'Friend'
            });
          });
        }

        socket.emit('challengeSent', { challengeId, friendUserId });
        console.log(`[CHALLENGE] User ${challengerUserId} challenged friend ${friendUserId}`);
      }
    );
  });

  // ===== ACCEPT CHALLENGE =====
  socket.on('acceptChallenge', ({ challengeId }) => {
    if (!socket.userId) {
      socket.emit('error', { message: 'You must be logged in to accept challenges' });
      return;
    }

    const challenge = pendingChallenges.get(challengeId);
    if (!challenge) {
      socket.emit('error', { message: 'Challenge not found or expired' });
      return;
    }

    if (challenge.recipientUserId !== socket.userId) {
      socket.emit('error', { message: 'This challenge is not for you' });
      return;
    }

    // Notify challenger
    const challengerSocket = io.sockets.sockets.get(challenge.challengerSocketId);
    if (challengerSocket && challengerSocket.connected) {
      challengerSocket.emit('challengeAccepted', {
        challengeId,
        recipientUserId: socket.userId,
        recipientSocketId: socket.id
      });
    }

    // Remove challenge
    pendingChallenges.delete(challengeId);
    console.log(`[CHALLENGE] User ${socket.userId} accepted challenge from ${challenge.challengerUserId}`);
  });

  // ===== REJECT CHALLENGE =====
  socket.on('rejectChallenge', ({ challengeId }) => {
    const challenge = pendingChallenges.get(challengeId);
    if (challenge) {
      // Notify challenger
      const challengerSocket = io.sockets.sockets.get(challenge.challengerSocketId);
      if (challengerSocket && challengerSocket.connected) {
        challengerSocket.emit('challengeRejected', { challengeId });
      }
      pendingChallenges.delete(challengeId);
    }
  });

  // ===== JOIN QUEUE =====
  socket.on('joinQueue', (playerData) => {
    console.log(`[QUEUE] ${playerData.name} joined queue`);
    console.log(`[QUEUE] Hero data:`, playerData.hero ? `${playerData.hero.name} (${playerData.hero.id})` : 'NONE');

    // Add to waiting players
    const queueEntry = {
      socketId: socket.id,
      playerId: playerData.playerId || uuidv4(),
      name: playerData.name || 'Player',
      username: playerData.username || playerData.name || 'Player', // Add username
      flag: playerData.flag || '⚔️', // Add flag
      unitType: playerData.unitType || 'ranged',
      hero: playerData.hero,
      userId: playerData.userId || null, // Store user ID for match history
      selectedDeckId: playerData.selectedDeckId || null, // Store deck ID if provided
      joinedAt: Date.now()
    };

    waitingPlayers.push(queueEntry);
    console.log(`[QUEUE] Total players in queue: ${waitingPlayers.length}`);

    // Check if we can make a match
    if (waitingPlayers.length >= 2) {
      createGame();
    }
  });

  // ===== LEAVE QUEUE =====
  socket.on('leaveQueue', () => {
    const index = waitingPlayers.findIndex(p => p.socketId === socket.id);
    if (index >= 0) {
      console.log(`[QUEUE] ${waitingPlayers[index].name} left queue`);
      waitingPlayers.splice(index, 1);
    }
  });

  // ===== PLAY CARD =====
  socket.on('playCard', ({ card, target }) => {
    const playerInfo = playerSockets.get(socket.id);
    if (!playerInfo) return;

    const room = activeGames.get(playerInfo.roomId);
    if (!room) return;

    console.log(`[ACTION] ${playerInfo.role} played ${card.name}`);

    // Validate: is it this player's turn?
    if (room.gameState.currentPlayer !== playerInfo.role) {
      socket.emit('error', { message: 'Not your turn' });
      return;
    }

    // Reset turn timeout on any action
    resetTurnTimeout(room, playerInfo.role);

    // Validate: player has this card in hand
    const playerState = room.gameState[playerInfo.role];
    // Find the actual card from hand to ensure we have all properties (keywords, etc.)
    const handCard = playerState.hand.find(c =>
      c.id === card.id && (c.tier || 1) === (card.tier || 1)
    );

    if (!handCard) {
      socket.emit('error', { message: 'Card not in hand' });
      return;
    }

    // Use the card from hand (which has all properties) instead of the client-sent card
    const cardToPlay = { ...handCard };

    // Validate: sufficient essence
    if (playerState.currentEssence < cardToPlay.cost) {
      socket.emit('error', { message: 'Insufficient essence' });
      return;
    }

    // Validate: board space for units (if not merging)
    if ((cardToPlay.type === 'unit' || cardToPlay.type === 'construct') && !cardToPlay.type.includes('equipment')) {
      const willMerge = playerState.board.some(c =>
        c.id === cardToPlay.id && (c.tier || 1) === (cardToPlay.tier || 1)
      );

      if (!willMerge && playerState.board.length >= GAME_CONSTANTS.MAX_BOARD_SIZE) {
        socket.emit('error', { message: 'Board is full' });
        return;
      }
    }

    // Execute action on server state - use the card from hand
    executePlayCard(room, playerInfo.role, cardToPlay, target);
    
    // Log card play with username
    const playerUsername = room.players[playerInfo.role]?.username || playerInfo.role;
    room.gameState.gameLog = room.gameState.gameLog || [];
    room.gameState.gameLog.push({
      turn: room.gameState.turnNumber,
      message: `${playerUsername} played ${cardToPlay.name}`,
      type: 'cardPlay'
    });

    // Log board state before broadcasting (especially for charge units)
    // playerState already declared on line 89, just reassign if needed
    // playerState = room.gameState[playerInfo.role]; // No need to reassign
    playerState.board.forEach(unit => {
      if (unit.keywords && unit.keywords.includes('charge')) {
        console.log(`[PLAYCARD] Before broadcast - Charge unit ${unit.name}: canAttack=${unit.canAttack}, exhausted=${unit.exhausted}`);
      }
    });

    // Broadcast updated state to both players
    broadcastGameState(room);
  });

  // ===== SELECT HERO (Multiplayer) =====
  socket.on('selectHero', ({ heroId, hero, deckPresetId, deckCardList }) => {
    const playerInfo = playerSockets.get(socket.id);
    if (!playerInfo) return;

    const room = activeGames.get(playerInfo.roomId);
    if (!room) return;

    console.log(`[HERO] ${playerInfo.role} selected hero: ${heroId}`, deckPresetId ? `with deck preset ${deckPresetId}` : 'with default deck');

    // Store hero for this player
    room.players[playerInfo.role].hero = hero;
    
    // Store deck preset ID for match history
    if (deckPresetId && deckPresetId !== 'default') {
      room.players[playerInfo.role].selectedDeckId = deckPresetId;
    } else {
      room.players[playerInfo.role].selectedDeckId = null;
    }
    
    // Store deck preset info if provided
    if (deckCardList && Array.isArray(deckCardList)) {
      room.players[playerInfo.role].customDeck = deckCardList;
      console.log(`[HERO] ${playerInfo.role} using custom deck with ${deckCardList.length} cards`);
    } else {
      room.players[playerInfo.role].customDeck = null;
    }

    // Check if both players have selected heroes
    if (room.players.player1.hero && room.players.player2.hero) {
      console.log(`[GAME] Both players ready, initializing game`);
      initializeMultiplayerGame(room);
    }
  });

  // ===== PLAYER READY =====
  socket.on('playerReady', () => {
    console.log(`[READY] ========== playerReady EVENT RECEIVED ==========`);
    console.log(`[READY] Socket ID: ${socket.id}`);
    console.log(`[READY] All playerSockets:`, Array.from(playerSockets.entries()).map(([id, info]) => ({ socketId: id, role: info.role, roomId: info.roomId })));
    
    const playerInfo = playerSockets.get(socket.id);
    if (!playerInfo) {
      console.log(`[READY] ERROR: playerInfo not found for socket ${socket.id}`);
      console.log(`[READY] Available socket IDs:`, Array.from(playerSockets.keys()));
      return;
    }

    const room = activeGames.get(playerInfo.roomId);
    if (!room) {
      console.log(`[READY] ERROR: room ${playerInfo.roomId} not found`);
      console.log(`[READY] Available rooms:`, Array.from(activeGames.keys()));
      return;
    }

    console.log(`[READY] ${playerInfo.role} clicked "Ready to Battle"`);

    // Initialize ready property if it doesn't exist (for rooms created before this change)
    if (room.players[playerInfo.role].ready === undefined) {
      room.players[playerInfo.role].ready = false;
    }

    // Mark player as ready
    room.players[playerInfo.role].ready = true;
    console.log(`[READY] ${playerInfo.role} marked as ready. Player1 ready: ${room.players.player1.ready}, Player2 ready: ${room.players.player2.ready}`);

    // Initialize other player's ready if needed
    const otherRole = playerInfo.role === 'player1' ? 'player2' : 'player1';
    if (room.players[otherRole].ready === undefined) {
      room.players[otherRole].ready = false;
    }

    // Check if both players are ready
    const bothReady = room.players.player1.ready && room.players.player2.ready;
    console.log(`[READY] Both ready check: ${bothReady}`);

    if (bothReady) {
      console.log(`[READY] Both players ready! Starting game for room ${room.roomId}`);
      
      // Send "bothPlayersReady" event to both players simultaneously
      // Use io.to() to ensure it reaches the room, and also direct emit as fallback
      const player1Socket = io.sockets.sockets.get(room.players.player1.socketId);
      const player2Socket = io.sockets.sockets.get(room.players.player2.socketId);
      
      console.log(`[READY] Player1 socket found:`, !!player1Socket);
      console.log(`[READY] Player2 socket found:`, !!player2Socket);
      
      // Emit to room (broadcast)
      io.to(room.roomId).emit('bothPlayersReady', {
        roomId: room.roomId
      });
      
      // Also emit directly to each socket as fallback
      if (player1Socket) {
        player1Socket.emit('bothPlayersReady', { roomId: room.roomId });
        console.log(`[READY] Sent bothPlayersReady directly to player1`);
      }
      if (player2Socket) {
        player2Socket.emit('bothPlayersReady', { roomId: room.roomId });
        console.log(`[READY] Sent bothPlayersReady directly to player2`);
      }
      
      console.log(`[READY] Sent bothPlayersReady to both players`);
    } else {
      // Notify the player that we're waiting for the other player
      console.log(`[READY] Sending waitingForOpponent to ${playerInfo.role}`);
      socket.emit('waitingForOpponent');
    }
  });

  // ===== END TURN =====
  socket.on('endTurn', () => {
    console.log(`\n[ACTION] ========== END TURN EVENT RECEIVED ==========`);
    console.log(`[ACTION] endTurn event received from socket ${socket.id}`);
    console.log(`[ACTION] Socket connected: ${socket.connected}`);
    console.log(`[ACTION] Timestamp: ${new Date().toISOString()}`);
    console.log(`[ACTION] All playerSockets entries:`, Array.from(playerSockets.entries()).map(([id, info]) => ({ socketId: id, role: info.role, roomId: info.roomId })));
    
    const playerInfo = playerSockets.get(socket.id);
    if (!playerInfo) {
      console.log(`[ACTION] ✗ endTurn received but playerInfo not found for socket ${socket.id}`);
      console.log(`[ACTION] Available playerSockets keys:`, Array.from(playerSockets.keys()));
      console.log(`[ACTION] Checking if socket ID matches any entry...`);
      // Try to find by checking all rooms
      for (const [roomId, room] of activeGames.entries()) {
        if (room.players.player1.socketId === socket.id) {
          console.log(`[ACTION] Found socket in room ${roomId} as player1`);
        }
        if (room.players.player2.socketId === socket.id) {
          console.log(`[ACTION] Found socket in room ${roomId} as player2`);
        }
      }
      socket.emit('error', { message: 'Player info not found' });
      return;
    }

    console.log(`[ACTION] ✓ Found playerInfo: role=${playerInfo.role}, roomId=${playerInfo.roomId}`);

    const room = activeGames.get(playerInfo.roomId);
    if (!room) {
      console.log(`[ACTION] ✗ endTurn received but room ${playerInfo.roomId} not found`);
      console.log(`[ACTION] Available rooms:`, Array.from(activeGames.keys()));
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    console.log(`[ACTION] ${playerInfo.role} attempting to end turn`);
    console.log(`[ACTION] Server currentPlayer: ${room.gameState.currentPlayer}, Player role: ${playerInfo.role}`);

    // Validate: is it this player's turn?
    if (room.gameState.currentPlayer !== playerInfo.role) {
      console.log(`[ACTION] ✗ Rejected: Not ${playerInfo.role}'s turn (currentPlayer is ${room.gameState.currentPlayer})`);
      socket.emit('error', { message: 'Not your turn' });
      return;
    }

    console.log(`[ACTION] ✓ Turn validated, switching from ${playerInfo.role}`);

    // Switch turn
    const nextRole = playerInfo.role === 'player1' ? 'player2' : 'player1';
    room.gameState.currentPlayer = nextRole;
    room.gameState.turnNumber++;
    
    // Log turn end with username
    const currentPlayerUsername = room.players[playerInfo.role]?.username || playerInfo.role;
    if (!room.gameState.gameLog) room.gameState.gameLog = [];
    room.gameState.gameLog.push({
      turn: room.gameState.turnNumber - 1, // Log for the turn that just ended
      message: `${currentPlayerUsername} ended their turn`,
      type: 'turnEnd'
    });

    console.log(`[ACTION] Turn switched to ${nextRole}, turn number: ${room.gameState.turnNumber}`);

    // Execute turn start for next player
    executeTurnStart(room, nextRole);

    // Check for game end
    if (room.gameState.player1.health <= 0 || room.gameState.player2.health <= 0) {
      endGame(room);
    } else {
      console.log(`[ACTION] Broadcasting game state after turn end`);
      console.log(`[ACTION] New currentPlayer: ${room.gameState.currentPlayer}`);
      console.log(`[ACTION] Turn number: ${room.gameState.turnNumber}`);
      broadcastGameState(room);
      console.log(`[ACTION] ========== END TURN PROCESSING COMPLETE ==========\n`);
    }
  });

  // ===== ATTACK =====
  socket.on('attack', ({ attackerId, targetId, targetType }) => {
    const playerInfo = playerSockets.get(socket.id);
    if (!playerInfo) return;

    const room = activeGames.get(playerInfo.roomId);
    if (!room) return;

    console.log(`[ACTION] ${playerInfo.role} attacked`);

    // Validate: is it this player's turn?
    if (room.gameState.currentPlayer !== playerInfo.role) {
      socket.emit('error', { message: 'Not your turn' });
      return;
    }

    // Reset turn timeout on any action
    resetTurnTimeout(room, playerInfo.role);

    const playerState = room.gameState[playerInfo.role];
    const enemyRole = playerInfo.role === 'player1' ? 'player2' : 'player1';
    const enemyState = room.gameState[enemyRole];

    // Find attacker
    const attacker = playerState.board.find(c => c.instanceId === attackerId);
    if (!attacker) {
      console.log(`[ACTION] Attacker ${attackerId} not found on player board`);
      console.log(`[ACTION] Player board units:`, playerState.board.map(u => ({ id: u.instanceId, name: u.name })));
      socket.emit('error', { message: 'Unit not found' });
      return;
    }

    console.log(`[ACTION] Attacker found: ${attacker.name} (power: ${attacker.power}, health: ${attacker.health}, canAttack: ${attacker.canAttack})`);

    // Validate: can attack?
    if (!attacker.canAttack) {
      console.log(`[ACTION] Attacker ${attacker.name} cannot attack (canAttack: ${attacker.canAttack})`);
      socket.emit('error', { message: 'Unit cannot attack' });
      return;
    }

    // Find target
    let target;
    if (targetType === 'unit') {
      target = enemyState.board.find(c => c.instanceId === targetId);
      if (!target) {
        console.log(`[ACTION] Target unit ${targetId} not found on enemy board`);
        console.log(`[ACTION] Enemy board units:`, enemyState.board.map(u => ({ id: u.instanceId, name: u.name, health: u.health })));
        socket.emit('error', { message: 'Target not found' });
        return;
      }
      console.log(`[ACTION] Target unit found: ${target.name} (power: ${target.power}, health: ${target.health}, durability: ${target.durability})`);
    } else if (targetType === 'hero') {
      // Hero is stored in enemyState - create target object for attack function
      // Accept 'hero' as targetId or any string that indicates hero target
      if (targetId === 'hero' || targetId === 'enemyHero' || targetId === null || targetId === undefined) {
        target = {
          name: enemyState.hero?.name || 'Enemy Hero',
          health: enemyState.health,
          maxHealth: enemyState.maxHealth,
          hero: enemyState.hero
        };
        console.log(`[ACTION] Hero target found: ${target.name}, health: ${target.health}`);
      } else {
        console.log(`[ACTION] Invalid hero targetId: ${targetId}`);
        socket.emit('error', { message: 'Target not found' });
        return;
      }
    }

    if (!target) {
      console.log(`[ACTION] Target not found - targetType: ${targetType}, targetId: ${targetId}`);
      socket.emit('error', { message: 'Target not found' });
      return;
    }

    // Execute attack
    console.log(`[ACTION] Executing attack: ${attacker.name} -> ${target.name}`);
    executeAttack(room, playerInfo.role, attacker, target, targetType);

    // Check for game end
    if (enemyState.health <= 0) {
      endGame(room);
    } else {
      broadcastGameState(room);
    }
  });

  // ===== USE HERO POWER =====
  socket.on('useHeroPower', ({ target }) => {
    const playerInfo = playerSockets.get(socket.id);
    if (!playerInfo) return;

    const room = activeGames.get(playerInfo.roomId);
    if (!room) return;

    console.log(`[ACTION] ${playerInfo.role} used hero power`);

    const playerState = room.gameState[playerInfo.role];

    // Validate: not already used this turn
    if (playerState.heroPowerUsed) {
      socket.emit('error', { message: 'Hero power already used this turn' });
      return;
    }

    // Validate: sufficient essence (most hero powers cost 2)
    const cost = playerState.hero?.heroPowerCost || 2;
    if (playerState.currentEssence < cost) {
      socket.emit('error', { message: 'Insufficient essence' });
      return;
    }

    // Check if this is a "Draw 1 card" ability and if deck is empty
    const isDrawAbility = playerState.hero?.commandText && playerState.hero.commandText.includes('Draw 1 card');
    if (isDrawAbility && (!playerState.deck || playerState.deck.length === 0)) {
      socket.emit('error', { message: 'No cards left in deck' });
      return;
    }

    // Execute hero power (for now, just draw a card)
    playerState.currentEssence -= cost;
    playerState.heroPowerUsed = true;

    // Draw card if deck has cards
    if (playerState.deck.length > 0) {
      const card = playerState.deck.pop();
      playerState.hand.push(card);
    }

    broadcastGameState(room);
  });

  // ===== USE EQUIPMENT =====
  socket.on('useEquipment', ({ targetId, targetType }) => {
    const playerInfo = playerSockets.get(socket.id);
    if (!playerInfo) return;

    const room = activeGames.get(playerInfo.roomId);
    if (!room) return;

    console.log(`[ACTION] ${playerInfo.role} used equipment, targetId: ${targetId}, targetType: ${targetType}`);

    const playerState = room.gameState[playerInfo.role];

    // Validate: has weapon equipped
    if (!playerState.equipmentSlots || !playerState.equipmentSlots.weapon) {
      socket.emit('error', { message: 'No weapon equipped' });
      return;
    }

    // Validate: equipment not already used
    if (playerState.equipmentUsed) {
      socket.emit('error', { message: 'Equipment already used this turn' });
      return;
    }

    const enemy = room.gameState[playerInfo.role === 'player1' ? 'player2' : 'player1'];
    const weapon = playerState.equipmentSlots.weapon;
    
    // Calculate damage (equipment attacks don't cost essence)
    let damage = weapon.attackPower || weapon.equipPower || 2;
    
    console.log(`[EQUIPMENT] ${playerInfo.role} weapon stats:`, {
      name: weapon.name,
      id: weapon.id,
      attackPower: weapon.attackPower,
      equipPower: weapon.equipPower,
      calculatedDamage: damage
    });
    
    // Find target and apply damage
    if (targetType === 'hero' || targetId === 'hero') {
      // Attack enemy hero
      enemy.health -= damage;
      console.log(`[EQUIPMENT] ${playerInfo.role} attacked enemy hero for ${damage} damage. Enemy health: ${enemy.health}`);
      
      // Log to game log
      const playerUsername = room.players[playerInfo.role]?.username || playerInfo.role;
      if (!room.gameState.gameLog) room.gameState.gameLog = [];
      room.gameState.gameLog.push({
        turn: room.gameState.turnNumber,
        message: `${playerUsername}'s hero attacked enemy hero for ${damage} damage`,
        type: 'attack'
      });
    } else {
      // Attack enemy unit
      const targetUnit = enemy.board.find(c => c.instanceId === targetId || c.id === targetId);
      if (targetUnit) {
        targetUnit.health -= damage;
        targetUnit.durability = targetUnit.health; // Keep in sync
        
        console.log(`[EQUIPMENT] ${playerInfo.role} attacked ${targetUnit.name} for ${damage} damage. Unit health: ${targetUnit.health}`);
        
        // Remove if dead
        if (targetUnit.health <= 0) {
          const index = enemy.board.findIndex(c => c.instanceId === targetUnit.instanceId);
          if (index >= 0) {
            enemy.board.splice(index, 1);
            console.log(`[EQUIPMENT] ${targetUnit.name} was destroyed`);
          }
        }
        
        // Log to game log
        const playerUsername = room.players[playerInfo.role]?.username || playerInfo.role;
        if (!room.gameState.gameLog) room.gameState.gameLog = [];
        room.gameState.gameLog.push({
          turn: room.gameState.turnNumber,
          message: `${playerUsername}'s hero attacked ${targetUnit.name} for ${damage} damage`,
          type: 'attack'
        });
      } else {
        socket.emit('error', { message: 'Target not found' });
        return;
      }
    }

    // Mark equipment as used (no essence cost for equipment attacks)
    playerState.equipmentUsed = true;

    // Check for game end
    if (room.gameState.player1.health <= 0 || room.gameState.player2.health <= 0) {
      endGame(room);
    } else {
      broadcastGameState(room);
    }
  });

  // ===== CONCEDE =====
  socket.on('concede', () => {
    const playerInfo = playerSockets.get(socket.id);
    if (!playerInfo) {
      console.log(`[CONCEDE] Socket ${socket.id} not in active game`);
      return;
    }

    const room = activeGames.get(playerInfo.roomId);
    if (!room || room.status !== 'active') {
      console.log(`[CONCEDE] Room ${playerInfo.roomId} not found or not active`);
      return;
    }

    console.log(`[CONCEDE] ${playerInfo.role} conceded the game`);

    // Set the conceding player's health to 0
    room.gameState[playerInfo.role].health = 0;

    // End game with concede reason
    endGame(room, 'concede', playerInfo.role);
  });

  // ===== DISCONNECT =====
  // ===== CHAT SYSTEM =====
  socket.on('globalChatMessage', async ({ message }) => {
    if (!socket.userId) {
      socket.emit('error', { message: 'You must be logged in to chat' });
      return;
    }

    if (!message || message.trim().length === 0 || message.length > 500) {
      socket.emit('error', { message: 'Invalid message' });
      return;
    }

    try {
      // Get username
      db.get('SELECT username FROM users WHERE id = ?', [socket.userId], (err, user) => {
        if (err || !user) {
          socket.emit('error', { message: 'Database error' });
          return;
        }

        // Insert message
        db.run(`
          INSERT INTO global_chat (user_id, username, message)
          VALUES (?, ?, ?)
        `, [socket.userId, user.username, message.trim()], function(err) {
          if (err) {
            console.error('Error sending global chat:', err);
            socket.emit('error', { message: 'Failed to send message' });
            return;
          }

          // Broadcast to all connected clients
          io.emit('globalChatMessage', {
            id: this.lastID,
            userId: socket.userId,
            username: user.username,
            message: message.trim(),
            timestamp: new Date().toISOString()
          });
        });
      });
    } catch (error) {
      console.error('Global chat error:', error);
      socket.emit('error', { message: 'Internal server error' });
    }
  });

  socket.on('allianceChatMessage', async ({ message }) => {
    if (!socket.userId) {
      socket.emit('error', { message: 'You must be logged in to chat' });
      return;
    }

    if (!message || message.trim().length === 0 || message.length > 500) {
      socket.emit('error', { message: 'Invalid message' });
      return;
    }

    try {
      // Get user's alliance
      db.get(`
        SELECT alliance_id
        FROM alliance_members
        WHERE user_id = ?
      `, [socket.userId], (err, member) => {
        if (err || !member) {
          socket.emit('error', { message: 'You are not in an alliance' });
          return;
        }

        // Get username
        db.get('SELECT username FROM users WHERE id = ?', [socket.userId], (err, user) => {
          if (err || !user) {
            socket.emit('error', { message: 'Database error' });
            return;
          }

          // Insert message
          db.run(`
            INSERT INTO alliance_chat (user_id, alliance_id, username, message)
            VALUES (?, ?, ?, ?)
          `, [socket.userId, member.alliance_id, user.username, message.trim()], function(err) {
            if (err) {
              console.error('Error sending alliance chat:', err);
              socket.emit('error', { message: 'Failed to send message' });
              return;
            }

            // Broadcast to all alliance members
            db.all(`
              SELECT user_id FROM alliance_members WHERE alliance_id = ?
            `, [member.alliance_id], (err, members) => {
              if (!err && members) {
                members.forEach(m => {
                  const memberSockets = userSockets.get(m.user_id);
                  if (memberSockets) {
                    memberSockets.forEach(sockId => {
                      io.to(sockId).emit('allianceChatMessage', {
                        id: this.lastID,
                        userId: socket.userId,
                        username: user.username,
                        message: message.trim(),
                        timestamp: new Date().toISOString()
                      });
                    });
                  }
                });
              }
            });
          });
        });
      });
    } catch (error) {
      console.error('Alliance chat error:', error);
      socket.emit('error', { message: 'Internal server error' });
    }
  });

  socket.on('disconnect', () => {
    const playerInfo = playerSockets.get(socket.id);
    console.log(`[DISCONNECT] Player disconnected: ${socket.id}`);

    // Handle user logout
    if (socket.userId) {
      const userSocketSet = userSockets.get(socket.userId);
      if (userSocketSet) {
        userSocketSet.delete(socket.id);
        if (userSocketSet.size === 0) {
          userSockets.delete(socket.userId);
          // Notify friends of offline status
          notifyFriendsStatusChange(socket.userId, 'offline');
          console.log(`[STATUS] User ${socket.userId} went offline`);
        }
      }
    }

    if (playerInfo) {
      const room = activeGames.get(playerInfo.roomId);
      if (room && room.status === 'active') {
        handlePlayerDisconnect(room, playerInfo.role);
      }
    }

    // Remove from queue
    const queueIndex = waitingPlayers.findIndex(p => p.socketId === socket.id);
    if (queueIndex >= 0) {
      waitingPlayers.splice(queueIndex, 1);
    }

    playerSockets.delete(socket.id);
  });
});

// Helper function to notify friends of status change
function notifyFriendsStatusChange(userId, status) {
  const { db } = require('./database');
  
  // Get user's friends
  db.all(
    'SELECT friend_id FROM friends WHERE user_id = ?',
    [userId],
    (err, friends) => {
      if (err) {
        console.error('Error fetching friends for status update:', err);
        return;
      }

      friends.forEach(friend => {
        const friendSockets = userSockets.get(friend.friend_id);
        if (friendSockets && friendSockets.size > 0) {
          friendSockets.forEach(friendSocketId => {
            io.to(friendSocketId).emit('friendStatusChange', {
              userId,
              status
            });
          });
        }
      });
    }
  );
}

// ===== GAME FUNCTIONS =====

function createGame() {
  if (waitingPlayers.length < 2) return;

  const player1Data = waitingPlayers.shift();
  const player2Data = waitingPlayers.shift();
  const roomId = uuidv4();

  console.log(`[MATCH] Matched ${player1Data.name} vs ${player2Data.name}`);

  // Create GameRoom
  const room = {
    roomId,
    gameStartTime: Date.now(), // Track when game starts for duration calculation
    players: {
      player1: { 
        socketId: player1Data.socketId, 
        playerId: player1Data.playerId, 
        name: player1Data.name,
        username: player1Data.username || player1Data.name, // Store username
        flag: player1Data.flag || '⚔️', // Store flag
        hero: player1Data.hero || null, // Store hero from queue
        userId: player1Data.userId || null, // Store user ID for match history
        selectedDeckId: player1Data.selectedDeckId || null, // Store deck ID for stats
        ready: false // Track if player clicked "Ready to Battle"
      },
      player2: { 
        socketId: player2Data.socketId, 
        playerId: player2Data.playerId, 
        name: player2Data.name,
        username: player2Data.username || player2Data.name, // Store username
        flag: player2Data.flag || '⚔️', // Store flag
        hero: player2Data.hero || null, // Store hero from queue
        userId: player2Data.userId || null, // Store user ID for match history
        selectedDeckId: player2Data.selectedDeckId || null, // Store deck ID for stats
        ready: false // Track if player clicked "Ready to Battle"
      }
    },
    gameState: createInitialGameState(player1Data, player2Data),
    status: 'active',
    disconnectTimeout: null,
    turnTimeout: null, // Timeout for current turn (120 seconds)
    lastMoveTime: Date.now() // Track last move time for timeout detection
  };

  activeGames.set(roomId, room);

  // Associate sockets with room
  playerSockets.set(player1Data.socketId, { playerId: player1Data.playerId, roomId, role: 'player1' });
  playerSockets.set(player2Data.socketId, { playerId: player2Data.playerId, roomId, role: 'player2' });

  // Join sockets to the room for broadcasting
  // Access sockets through the connected sockets map
  const connectedSockets = io.sockets.sockets;
  const player1Socket = connectedSockets.get(player1Data.socketId);
  const player2Socket = connectedSockets.get(player2Data.socketId);
  
  if (player1Socket) {
    player1Socket.join(roomId);
    console.log(`[MATCH] Player1 socket ${player1Data.socketId} joined room ${roomId}`);
  } else {
    console.error(`[MATCH] Player1 socket ${player1Data.socketId} not found in connected sockets!`);
  }
  
  if (player2Socket) {
    player2Socket.join(roomId);
    console.log(`[MATCH] Player2 socket ${player2Data.socketId} joined room ${roomId}`);
  } else {
    console.error(`[MATCH] Player2 socket ${player2Data.socketId} not found in connected sockets!`);
  }

  // Check if both players already have heroes selected
  console.log(`[MATCH] Player1 hero:`, room.players.player1.hero ? room.players.player1.hero.name : 'NONE');
  console.log(`[MATCH] Player2 hero:`, room.players.player2.hero ? room.players.player2.hero.name : 'NONE');
  
  if (room.players.player1.hero && room.players.player2.hero) {
    console.log(`[MATCH] Both players have heroes selected, initializing game immediately`);
    initializeMultiplayerGame(room);
  } else {
    // Notify players that game is found - wait for hero selection
    console.log(`[MATCH] One or both players missing heroes, notifying to select heroes`);
    console.log(`[MATCH] Player1 has hero:`, !!room.players.player1.hero);
    console.log(`[MATCH] Player2 has hero:`, !!room.players.player2.hero);
    io.to(player1Data.socketId).emit('gameFound');
    io.to(player2Data.socketId).emit('gameFound');
    // Game initialization will happen after both players select heroes (in selectHero handler)
  }
}

function createInitialGameState(player1Data, player2Data) {
  return {
    currentPlayer: 'player1',
    turnNumber: 1,
    gameLog: [], // Initialize game log array
    player1: {
      hero: player1Data.hero,
      username: player1Data.username || player1Data.name, // Include username in game state
      flag: player1Data.flag || '⚔️', // Include flag in game state
      health: GAME_CONSTANTS.STARTING_HEALTH,
      maxHealth: GAME_CONSTANTS.STARTING_HEALTH,
      maxEssence: 0,
      currentEssence: 0,
      heroPowerUsed: false,
      deck: [], // Will be filled by client
      hand: [], // Will be filled by client
      board: [],
      equipmentSlots: {
        weapon: null, head: null, chest: null, legs: null,
        shield: null, boots: null, gloves: null, neck: null, back: null
      },
      equipmentUsed: false,
      constructsPlayed: 0
    },
    player2: {
      hero: player2Data.hero,
      username: player2Data.username || player2Data.name, // Include username in game state
      flag: player2Data.flag || '⚔️', // Include flag in game state
      health: GAME_CONSTANTS.STARTING_HEALTH,
      maxHealth: GAME_CONSTANTS.STARTING_HEALTH,
      maxEssence: 0,
      currentEssence: 0,
      heroPowerUsed: false,
      deck: [],
      hand: [],
      board: [],
      equipmentSlots: {
        weapon: null, head: null, chest: null, legs: null,
        shield: null, boots: null, gloves: null, neck: null, back: null
      },
      equipmentUsed: false,
      constructsPlayed: 0
    }
  };
}

function executeTurnStart(room, role) {
  const player = room.gameState[role];

  // Clear any existing turn timeout
  if (room.turnTimeout) {
    clearTimeout(room.turnTimeout);
    room.turnTimeout = null;
  }

  // Set turn timeout (120 seconds)
  room.turnTimeout = setTimeout(() => {
    if (room.status === 'active' && room.gameState.currentPlayer === role) {
      console.log(`[TIMEOUT] ${role} timed out after 120 seconds of inactivity`);
      // Set timed out player's health to 0
      room.gameState[role].health = 0;
      endGame(room, 'timeout');
    }
  }, GAME_CONSTANTS.TURN_TIMEOUT);

  // Update last move time
  room.lastMoveTime = Date.now();

  // Increment max essence
  if (player.maxEssence < GAME_CONSTANTS.MAX_ESSENCE) {
    player.maxEssence++;
  }

  player.currentEssence = player.maxEssence;
  player.heroPowerUsed = false;
  player.equipmentUsed = false;

  // Refresh all units at the start of turn
  // Charge only matters when unit is FIRST played - after that, all units refresh normally
  player.board.forEach(unit => {
    // Ensure ranged property is set correctly for hitback logic
    if (unit.unitType === 'ranged') {
      unit.ranged = true;
    }
    // Refresh all units (charge only affects initial play, not turn refresh)
    unit.canAttack = true;
    unit.exhausted = false;
  });

  // Reset temp buffs
  room.tempPowerBuff = 0;

  // Draw a card at the start of turn
  // Ensure deck exists and is an array
  if (!player.deck) {
    console.error(`[TURN] ERROR: ${role} deck is undefined or null!`);
    player.deck = [];
  }
  
  if (!Array.isArray(player.deck)) {
    console.error(`[TURN] ERROR: ${role} deck is not an array! Type: ${typeof player.deck}, Value:`, player.deck);
    player.deck = [];
  }
  
  if (player.deck.length > 0) {
    const drawnCard = player.deck.pop();
    if (!drawnCard) {
      console.error(`[TURN] ERROR: ${role} popped undefined card from deck! Deck length: ${player.deck.length}`);
    } else {
      // Mark card as just drawn for animation (client-side will handle this)
      drawnCard.justDrawn = true;
      
      // Ensure hand exists and is an array
      if (!player.hand) {
        console.error(`[TURN] ERROR: ${role} hand is undefined or null!`);
        player.hand = [];
      }
      if (!Array.isArray(player.hand)) {
        console.error(`[TURN] ERROR: ${role} hand is not an array!`);
        player.hand = [];
      }
      
      player.hand.push(drawnCard);
      console.log(`[TURN] ${role} drew a card: ${drawnCard.name || drawnCard.id} (id: ${drawnCard.id})`);
      console.log(`[TURN] ${role} now has ${player.hand.length} cards in hand`);
      console.log(`[TURN] ${role} deck remaining: ${player.deck.length} cards`);
      
      // Log what cards are in hand
      const handCardIds = player.hand.map(c => c.id);
      const handCounts = {};
      handCardIds.forEach(id => {
        handCounts[id] = (handCounts[id] || 0) + 1;
      });
      console.log(`[TURN] ${role} hand contents:`, handCounts);
    }
  } else {
    console.log(`[TURN] WARNING: ${role} tried to draw but deck is empty (deck length: ${player.deck?.length || 0})`);
    console.log(`[TURN] ${role} deck state:`, {
      exists: !!player.deck,
      isArray: Array.isArray(player.deck),
      length: player.deck?.length || 0,
      type: typeof player.deck
    });
    console.log(`[TURN] ${role} hand size: ${player.hand?.length || 0}`);
    console.log(`[TURN] ${role} turn number: ${room.gameState.turnNumber}`);
    
    // Log to game log that deck is empty
    if (!room.gameState.gameLog) room.gameState.gameLog = [];
    const playerUsername = room.players[role]?.username || role;
    room.gameState.gameLog.push({
      turn: room.gameState.turnNumber,
      message: `${playerUsername}'s deck is empty - no card drawn`,
      type: 'system'
    });
  }
}

function executePlayCard(room, role, card, target) {
  const player = room.gameState[role];

  console.log(`[PLAYCARD] ${role} executing playCard - card:`, JSON.stringify({ id: card.id, name: card.name, type: card.type, cost: card.cost }));

  // Deduct essence
  player.currentEssence -= card.cost;

  // Remove from hand
  const handIndex = player.hand.findIndex(c =>
    c.id === card.id && (c.tier || 1) === (c.tier || 1)
  );
  if (handIndex >= 0) {
    player.hand.splice(handIndex, 1);
  }

  // Handle card type
  if (card.type === 'unit' || card.type === 'construct') {
    // Check if unit has charge keyword (allows attacking on turn played)
    // Ensure keywords is always an array
    let keywords = card.keywords;
    if (!Array.isArray(keywords)) {
      keywords = [];
      if (card.keywords && typeof card.keywords === 'string') {
        keywords = [card.keywords];
      }
    }

    // Also check known charge card IDs as fallback
    const chargeCardIds = ['horseman', 'camelRider', 'mountedKnight', 'messenger', 'bannerman'];
    const hasCharge = (keywords.length > 0 && keywords.includes('charge')) ||
                      chargeCardIds.includes(card.id);
    
    console.log(`[PLAYCARD] ${role} playing ${card.name}, keywords:`, keywords, `card.id:`, card.id, `hasCharge:`, hasCharge);
    
    // Add to board - match single-player structure exactly
    // IMPORTANT: Don't spread card.canAttack or card.exhausted - we set these explicitly
    const newUnit = {
      ...card,
      instanceId: uuidv4(),
      keywords: keywords, // Ensure keywords are preserved
      canAttack: hasCharge, // Units with charge can attack immediately - OVERRIDE any card property
      exhausted: !hasCharge, // Units without charge are exhausted - OVERRIDE any card property
      durability: card.durability || 1, // Use durability like single-player
      health: card.durability || 1, // Also set health for compatibility
      maxHealth: card.durability || 1,
      unitType: card.unitType || 'ranged', // Ensure unitType is always set
      ranged: card.unitType === 'ranged', // Set ranged property for hitback logic
      // Preserve draw effects
      scoutEffect: card.scoutEffect,
      commandEffect: card.commandEffect,
      dispatchEffect: card.dispatchEffect
    };
    
    // CRITICAL FIX: Ensure charge units can attack (override any spread properties)
    if (hasCharge) {
      newUnit.canAttack = true;
      newUnit.exhausted = false;
      console.log(`[PLAYCARD] Force-setting charge unit ${newUnit.name} to canAttack=true, exhausted=false`);
    }
    
    // Swift Rider passive: Units with cost <= 3 can attack immediately
    if (player.hero && player.hero.id === 'swiftRider' && card.cost <= 3) {
      newUnit.canAttack = true;
      newUnit.exhausted = false;
      console.log(`[PLAYCARD] Swift Rider passive: ${newUnit.name} can attack immediately`);
    }
    
    // Mountain King passive: Protection on 5+ durability
    if (player.hero && player.hero.id === 'mountainKing' && newUnit.durability >= 5) {
      if (!Array.isArray(newUnit.keywords)) newUnit.keywords = [];
      if (!newUnit.keywords.includes('protection')) {
        newUnit.keywords.push('protection');
        console.log(`[PLAYCARD] Mountain King passive: Added protection to ${newUnit.name}`);
      }
    }
    
    // Apply type advantage bonus when unit is played (ranged vs infantry)
    if (newUnit.unitType === 'ranged') {
      const enemy = room.gameState[role === 'player1' ? 'player2' : 'player1'];
      const hasEnemyInfantry = enemy.board.some(c => c.unitType === 'infantry');
      if (hasEnemyInfantry) {
        newUnit.power += 1;
        console.log(`[PLAYCARD] ${newUnit.name} gained +1 attack against infantry units`);
      }
    }
    
    // Apply hero passive bonuses when unit is played
    // Robin Hood: Your ranged units deal +1 damage
    if (player.hero && player.hero.id === 'robinHood' && newUnit.unitType === 'ranged') {
      newUnit.power += 1;
      console.log(`[PLAYCARD] Robin Hood passive: ${newUnit.name} gained +1 attack`);
    }
    // Leonidas: Your infantry units deal +1 damage
    else if (player.hero && player.hero.id === 'leonidas' && newUnit.unitType === 'infantry') {
      newUnit.power += 1;
      console.log(`[PLAYCARD] Leonidas passive: ${newUnit.name} gained +1 attack`);
    }
    // Genghis Khan: Your cavalry units deal +1 damage
    else if (player.hero && player.hero.id === 'genghisKhan' && newUnit.unitType === 'cavalry') {
      newUnit.power += 1;
      console.log(`[PLAYCARD] Genghis Khan passive: ${newUnit.name} gained +1 attack`);
    }
    
    // CRITICAL: Double-check charge units have canAttack: true
    // This is a safety check in case something overwrote it
    if (hasCharge && !newUnit.canAttack) {
      console.log(`[PLAYCARD] WARNING: Charge unit ${newUnit.name} had canAttack=false, fixing to true`);
      newUnit.canAttack = true;
      newUnit.exhausted = false;
    }
    
    console.log(`[PLAYCARD] Created unit:`, {
      name: newUnit.name,
      canAttack: newUnit.canAttack,
      exhausted: newUnit.exhausted,
      keywords: newUnit.keywords,
      power: newUnit.power,
      hasCharge: hasCharge,
      cardId: card.id
    });

    // Check for merge
    const existing = player.board.find(c => c.id === card.id && (c.tier || 1) === (card.tier || 1));
    if (existing) {
      // Merge units - preserve unitType and ranged properties
      const oldTier = existing.tier || 1;
      existing.power = (existing.power || 0) + (card.power || 0);
      existing.durability = (existing.durability || 1) + (card.durability || 1);
      existing.health = existing.durability; // Keep health in sync with durability
      existing.maxHealth = existing.durability;
      existing.tier = oldTier + 1;
      // Update name to show tier - extract base name first (remove any existing tier suffix)
      const baseName = existing.name.replace(/ T\d+$/, '') || card.name.replace(/ T\d+$/, '') || card.name;
      existing.name = `${baseName} T${existing.tier}`;
      // Ensure unitType and ranged are preserved
      if (card.unitType) existing.unitType = card.unitType;
      existing.ranged = (card.unitType === 'ranged') || (existing.unitType === 'ranged');
      // Preserve keywords
      if (card.keywords) existing.keywords = card.keywords;
    } else {
      player.board.push(newUnit);
      
      // Trigger Formation keyword - other units with formation get +1 power
      player.board.forEach(c => {
        if (c.keywords && c.keywords.includes('formation') && c.instanceId !== newUnit.instanceId) {
          c.power += 1;
          console.log(`[PLAYCARD] ${c.name} gained +1/+0 from Formation`);
        }
      });
    }
    
    // Trigger card draw effects (scout, command, dispatch)
    // Check both the card being played and the newUnit (in case card doesn't have the property)
    const hasDrawEffect = (card.scoutEffect || card.commandEffect || card.dispatchEffect) ||
                          (newUnit && (newUnit.scoutEffect || newUnit.commandEffect || newUnit.dispatchEffect));
    if (hasDrawEffect) {
      if (player.deck && player.deck.length > 0) {
        const drawnCard = player.deck.pop();
        drawnCard.justDrawn = true;
        player.hand.push(drawnCard);
        console.log(`[PLAYCARD] ${role} played ${card.name} with draw effect, drew: ${drawnCard.name || drawnCard.id}`);
      } else {
        console.log(`[PLAYCARD] ${role} played ${card.name} with draw effect but deck is empty`);
      }
    }
  } else if (card.type === 'ability' || card.type === 'technique') {
    // Handle draw card abilities (quiverRefill, supplyLine, courierNetwork)
    // These draw 3 cards
    console.log(`[PLAYCARD] ${role} playing ability/technique card: id="${card.id}", name="${card.name}", type="${card.type}"`);
    console.log(`[PLAYCARD] ${role} Checking for draw-3-card abilities... card.id matches:`, {
      quiverRefill: card.id === 'quiverRefill',
      supplyLine: card.id === 'supplyLine',
      courierNetwork: card.id === 'courierNetwork',
      actualId: card.id
    });
    
    if (card.id === 'quiverRefill' || card.id === 'supplyLine' || card.id === 'courierNetwork') {
      console.log(`[PLAYCARD] ${role} ✓✓✓ DETECTED draw-3-card ability: ${card.name} (id: ${card.id})`);
      console.log(`[PLAYCARD] ${role} Deck size before draw: ${player.deck ? player.deck.length : 'undefined'}`);
      
      // Draw 3 cards
      const handSizeBefore = player.hand.length;
      const cardsDrawn = [];
      for (let i = 0; i < 3; i++) {
        if (player.deck && player.deck.length > 0) {
          const drawnCard = player.deck.pop();
          if (!drawnCard) {
            console.error(`[PLAYCARD] ${role} ERROR: deck.pop() returned undefined! Deck length: ${player.deck.length}`);
            break;
          }
          drawnCard.justDrawn = true; // Mark all drawn cards for animation
          player.hand.push(drawnCard);
          cardsDrawn.push(drawnCard);
          console.log(`[PLAYCARD] ${role} ✓ Drew card ${i + 1}/3: ${drawnCard.name || drawnCard.id}, Hand size: ${player.hand.length}`);
        } else {
          console.log(`[PLAYCARD] ${role} ✗ Deck empty after drawing ${i}/3 cards`);
          break;
        }
      }
      
      const handSizeAfter = player.hand.length;
      console.log(`[PLAYCARD] ${role} Total cards drawn: ${cardsDrawn.length}, Hand size: ${handSizeBefore} -> ${handSizeAfter}`);
      console.log(`[PLAYCARD] ${role} Hand contents after draw:`, player.hand.map(c => c.name || c.id).join(', '));
      console.log(`[PLAYCARD] ${role} Cards with justDrawn flag:`, player.hand.filter(c => c.justDrawn).map(c => c.name || c.id).join(', '));
      
      // Verify cards are actually in the hand
      if (handSizeAfter !== handSizeBefore + cardsDrawn.length) {
        console.error(`[PLAYCARD] ${role} ERROR: Hand size mismatch! Expected ${handSizeBefore + cardsDrawn.length}, got ${handSizeAfter}`);
      }
      
      // Log to game log
      if (cardsDrawn.length > 0) {
        const playerUsername = room.players[role]?.username || role;
        if (!room.gameState.gameLog) room.gameState.gameLog = [];
        room.gameState.gameLog.push({
          turn: room.gameState.turnNumber,
          message: `${playerUsername} played ${card.name} and drew ${cardsDrawn.length} card${cardsDrawn.length > 1 ? 's' : ''}`,
          type: 'cardPlay'
        });
      }
      
      // IMPORTANT: Don't return early - let the function complete so broadcastGameState is called
      // The return was preventing the function from completing, but broadcastGameState is called
      // after executePlayCard returns, so this should be fine. But let's verify the hand is in the state.
      console.log(`[PLAYCARD] ${role} Hand in gameState after draw:`, room.gameState[role].hand.length, 'cards');
      console.log(`[PLAYCARD] ${role} Returning early after drawing cards (hand will be broadcast)`);
      return;
    } else {
      console.log(`[PLAYCARD] ${role} Not a draw-3-card ability, continuing to damage logic...`);
    }
    // Apply ability effects (damage, etc.)
    // Calculate damage from card.id if card.damage is not set (for cards sent from client)
    let damageAmount = card.damage;
    console.log(`[PLAYCARD] ${role} Ability card damage check: card.damage=${card.damage}, card.id="${card.id}", card.name="${card.name}"`);
    if (!damageAmount && card.id) {
      // Calculate damage based on card.id (matching client-side logic)
      if (card.id.includes('quick')) {
        damageAmount = 1;
        console.log(`[PLAYCARD] ${role} Calculated damage from card.id.includes('quick'): ${damageAmount}`);
      } else if (card.id.includes('master')) {
        damageAmount = 4;
        console.log(`[PLAYCARD] ${role} Calculated damage from card.id.includes('master'): ${damageAmount}`);
      } else if (card.id.includes('focus') || card.id.includes('aimed')) {
        damageAmount = 3;
        console.log(`[PLAYCARD] ${role} Calculated damage from card.id.includes('focus'/'aimed'): ${damageAmount}`);
      }
    }
    console.log(`[PLAYCARD] ${role} Final damageAmount: ${damageAmount}, target:`, target);
    
    // Handle random target abilities (Quick Shot, Quick Strike, Quick Charge)
    // These don't require a target - pick a random target automatically
    if (damageAmount && damageAmount > 0 && !target && (card.id === 'quickShot' || card.id === 'quickStrike' || card.id === 'quickCharge')) {
      const enemy = room.gameState[role === 'player1' ? 'player2' : 'player1'];
      
      // Pick random target: enemy board first, then hero if board is empty
      if (enemy.board && enemy.board.length > 0) {
        const randomIndex = Math.floor(Math.random() * enemy.board.length);
        target = enemy.board[randomIndex];
        console.log(`[PLAYCARD] ${role} ${card.name} randomly targeting unit: ${target.name}`);
      } else {
        // No units on board - target hero
        target = { type: 'hero', id: 'enemyHero', name: 'Enemy Hero' };
        console.log(`[PLAYCARD] ${role} ${card.name} randomly targeting hero (no units on board)`);
      }
    }
    
    console.log(`[PLAYCARD] ${role} Damage check: damageAmount=${damageAmount}, target exists=${!!target}, condition met=${!!(damageAmount && damageAmount > 0 && target)}`);
    if (damageAmount && damageAmount > 0 && target) {
      const enemy = room.gameState[role === 'player1' ? 'player2' : 'player1'];
      
      // Check if target is hero or unit
      const isHeroTarget = target.type === 'hero' || target.id === 'enemyHero' || target.id === 'hero' || 
                          target.name === 'Enemy' || target.name === 'Enemy Hero' || 
                          (!target.instanceId && !target.unitType);
      
      console.log(`[PLAYCARD] ${role} ability ${card.name} (damage: ${damageAmount}) targeting:`, JSON.stringify(target), `isHeroTarget:`, isHeroTarget);
      
      if (isHeroTarget) {
        // Deal damage to hero
        const oldHealth = enemy.health;
        enemy.health -= damageAmount;
        if (enemy.health < 0) enemy.health = 0;
        console.log(`[PLAYCARD] ${role} dealt ${damageAmount} damage to enemy hero (health: ${oldHealth} -> ${enemy.health})`);
        
        // Log to game log
        const playerUsername = room.players[role]?.username || role;
        if (!room.gameState.gameLog) room.gameState.gameLog = [];
        room.gameState.gameLog.push({
          turn: room.gameState.turnNumber,
          message: `${playerUsername}'s ${card.name} dealt ${damageAmount} damage to ${enemy.hero?.name || 'Enemy Hero'}`,
          type: 'ability'
        });
        
        // Check for game end after ability damage
        if (room.gameState.player1.health <= 0 || room.gameState.player2.health <= 0) {
          endGame(room);
          return;
        }
      } else {
        // Deal damage to unit
        const targetUnit = enemy.board.find(c => c.instanceId === target.instanceId);
        if (targetUnit) {
          // Use durability for consistency
          if (targetUnit.durability === undefined || targetUnit.durability === null) {
            targetUnit.durability = targetUnit.health || targetUnit.maxHealth || 1;
          }
          const oldDurability = targetUnit.durability;
          targetUnit.durability -= damageAmount;
          targetUnit.health = targetUnit.durability; // Keep in sync
          
          if (targetUnit.durability <= 0) {
            const index = enemy.board.findIndex(c => c.instanceId === target.instanceId);
            if (index >= 0) enemy.board.splice(index, 1);
            console.log(`[PLAYCARD] ${role} destroyed ${targetUnit.name} with ${card.name} (durability: ${oldDurability} -> 0)`);
            
            // Log to game log
            const playerUsername = room.players[role]?.username || role;
            if (!room.gameState.gameLog) room.gameState.gameLog = [];
            room.gameState.gameLog.push({
              turn: room.gameState.turnNumber,
              message: `${playerUsername}'s ${card.name} destroyed ${targetUnit.name}`,
              type: 'ability'
            });
          } else {
            console.log(`[PLAYCARD] ${role} dealt ${damageAmount} damage to ${targetUnit.name} (durability: ${oldDurability} -> ${targetUnit.durability})`);
            
            // Log to game log
            const playerUsername = room.players[role]?.username || role;
            if (!room.gameState.gameLog) room.gameState.gameLog = [];
            room.gameState.gameLog.push({
              turn: room.gameState.turnNumber,
              message: `${playerUsername}'s ${card.name} dealt ${damageAmount} damage to ${targetUnit.name}`,
              type: 'ability'
            });
          }
        } else {
          console.log(`[PLAYCARD] ${role} ability ${card.name} target unit not found:`, target);
        }
      }
    }
    // Handle masterShot - draw a card after dealing damage (if damage was dealt above)
    // Note: masterShot deals damage AND draws a card, so this runs after damage is applied
    if (card.id === 'masterShot' && player.deck && player.deck.length > 0) {
      const drawnCard = player.deck.pop();
      drawnCard.justDrawn = true;
      player.hand.push(drawnCard);
      console.log(`[PLAYCARD] ${role} played Master Shot, drew: ${drawnCard.name || drawnCard.id}`);
      
      // Log to game log
      const playerUsername = room.players[role]?.username || role;
      if (!room.gameState.gameLog) room.gameState.gameLog = [];
      room.gameState.gameLog.push({
        turn: room.gameState.turnNumber,
        message: `${playerUsername}'s Master Shot drew a card`,
        type: 'cardPlay'
      });
    }
    // Handle buff abilities (Wall, Mark, Formation)
    else if ((card.id && card.id.includes('Wall')) || (card.id && card.id.includes('Mark')) || (card.id && card.id.includes('Formation'))) {
      if (target && target.instanceId) {
        // Find the target unit on the board
        const targetUnit = player.board.find(c => c.instanceId === target.instanceId);
        if (targetUnit) {
          if (card.id.includes('Mark') || card.id.includes('Formation')) {
            // +2/+2 buff
            targetUnit.power = (targetUnit.power || 0) + 2;
            targetUnit.durability = (targetUnit.durability || 1) + 2;
            targetUnit.health = targetUnit.durability; // Keep health in sync
            targetUnit.maxHealth = targetUnit.durability;
            console.log(`[PLAYCARD] ${role} played ${card.name}, ${targetUnit.name} gained +2/+2`);
            
            // Log to game log
            const playerUsername = room.players[role]?.username || role;
            if (!room.gameState.gameLog) room.gameState.gameLog = [];
            room.gameState.gameLog.push({
              turn: room.gameState.turnNumber,
              message: `${playerUsername}'s ${card.name} gave ${targetUnit.name} +2/+2`,
              type: 'ability'
            });
          } else if (card.id.includes('Wall')) {
            // +0/+2 buff
            targetUnit.durability = (targetUnit.durability || 1) + 2;
            targetUnit.health = targetUnit.durability; // Keep health in sync
            targetUnit.maxHealth = targetUnit.durability;
            console.log(`[PLAYCARD] ${role} played ${card.name}, ${targetUnit.name} gained +0/+2`);
            
            // Log to game log
            const playerUsername = room.players[role]?.username || role;
            if (!room.gameState.gameLog) room.gameState.gameLog = [];
            room.gameState.gameLog.push({
              turn: room.gameState.turnNumber,
              message: `${playerUsername}'s ${card.name} gave ${targetUnit.name} +0/+2`,
              type: 'ability'
            });
          }
        } else {
          console.log(`[PLAYCARD] ${role} played ${card.name} but target unit not found`);
        }
      } else {
        console.log(`[PLAYCARD] ${role} played ${card.name} but no valid target provided`);
      }
    }
    // Handle weapon enchantments (bowEnchantment, swordEnchantment, axeEnchantment)
    else if (card.id === 'bowEnchantment' || card.id === 'swordEnchantment' || card.id === 'axeEnchantment') {
      // Determine which weapon type to enchant
      let weaponType = null;
      if (card.id === 'bowEnchantment') weaponType = 'bow';
      else if (card.id === 'swordEnchantment') weaponType = 'sword';
      else if (card.id === 'axeEnchantment') weaponType = 'axe';
      
      if (weaponType) {
        // Initialize weapon tracking
        if (!player.weaponCount) player.weaponCount = 0;
        if (!player.weaponEnchantments) player.weaponEnchantments = 0;
        
        // Increment enchantment count
        player.weaponEnchantments++;
        
        // Enchant equipped weapon
        if (player.equipmentSlots && player.equipmentSlots.weapon && 
            (player.equipmentSlots.weapon.id === weaponType || player.equipmentSlots.weapon.name.toLowerCase().includes(weaponType))) {
          const weapon = player.equipmentSlots.weapon;
          // Calculate: weaponCount + enchantments
          weapon.attackPower = player.weaponCount + player.weaponEnchantments;
          weapon.equipPower = weapon.attackPower; // Keep in sync
          console.log(`[ENCHANTMENT] ${role} enchanted equipped ${weapon.name}, new attack: ${weapon.attackPower}`);
        }
        
        // Enchant weapons in hand
        player.hand.forEach(c => {
          if (c.type === 'equipment' && c.equipSlot === 'weapon' && 
              (c.id === weaponType || c.name.toLowerCase().includes(weaponType))) {
            c.attackPower = (c.attackPower || c.equipPower || 2) + 1;
            c.equipPower = c.attackPower; // Keep in sync
            console.log(`[ENCHANTMENT] ${role} enchanted ${c.name} in hand, new attack: ${c.attackPower}`);
          }
        });
        
        // Enchant weapons in deck
        player.deck.forEach(c => {
          if (c.type === 'equipment' && c.equipSlot === 'weapon' && 
              (c.id === weaponType || c.name.toLowerCase().includes(weaponType))) {
            c.attackPower = (c.attackPower || c.equipPower || 2) + 1;
            c.equipPower = c.attackPower; // Keep in sync
            console.log(`[ENCHANTMENT] ${role} enchanted ${c.name} in deck, new attack: ${c.attackPower}`);
          }
        });
        
        // Log to game log
        const playerUsername = room.players[role]?.username || role;
        if (!room.gameState.gameLog) room.gameState.gameLog = [];
        room.gameState.gameLog.push({
          turn: room.gameState.turnNumber,
          message: `${playerUsername} played ${card.name}! All ${weaponType}s gained +1 attack permanently.`,
          type: 'cardPlay'
        });
      }
    }
  } else if (card.type === 'forge' || card.type === 'equipment') {
    // Equip to hero
    if (card.equipSlot) {
      // If weapon already exists, increment weapon count
      if (card.equipSlot === 'weapon' && player.equipmentSlots.weapon) {
        // Initialize weapon tracking
        if (!player.weaponCount) player.weaponCount = 0;
        if (!player.weaponEnchantments) player.weaponEnchantments = 0;
        
        // Increment weapon count
        player.weaponCount++;
        const existingWeapon = player.equipmentSlots.weapon;
        // Calculate: weaponCount + enchantments
        const newAttackPower = player.weaponCount + player.weaponEnchantments;
        existingWeapon.attackPower = newAttackPower;
        existingWeapon.equipPower = newAttackPower; // Also update equipPower for compatibility
        console.log(`[PLAYCARD] ${role} enhanced ${existingWeapon.name} with ${card.name}! Attack increased to ${newAttackPower}`);
        
        // Log to game log
        const playerUsername = room.players[role]?.username || role;
        if (!room.gameState.gameLog) room.gameState.gameLog = [];
        room.gameState.gameLog.push({
          turn: room.gameState.turnNumber,
          message: `${playerUsername} enhanced ${existingWeapon.name} with ${card.name}! Attack: ${newAttackPower}`,
          type: 'cardPlay'
        });
      } else if (card.equipSlot === 'weapon') {
        // First weapon: +1 attack
        if (!player.weaponCount) player.weaponCount = 0;
        if (!player.weaponEnchantments) player.weaponEnchantments = 0;
        player.weaponCount = 1;
        card.attackPower = 1;
        card.equipPower = 1;
      } else {
        // No existing weapon or non-weapon equipment - just equip normally
        // Check if replacing armor (need to recalculate health)
        const wasArmor = player.equipmentSlots[card.equipSlot] && player.equipmentSlots[card.equipSlot].armorValue;
        const isArmor = card.armorValue && card.armorValue > 0;
        
        player.equipmentSlots[card.equipSlot] = card;
        console.log(`[PLAYCARD] ${role} equipped ${card.name} to ${card.equipSlot} slot`);
        
        // If armor is equipped or replaced, update hero health
        if (isArmor || wasArmor) {
          updateHeroHealthFromArmor(room, role);
        }
      }
    }
  }
}

function updateHeroHealthFromArmor(room, role) {
  const player = room.gameState[role];
  
  // Calculate total armor bonus from all equipped armor
  let armorBonus = 0;
  if (player.equipmentSlots) {
    Object.values(player.equipmentSlots).forEach(equip => {
      if (equip && equip.armorValue) {
        armorBonus += equip.armorValue;
        console.log(`[ARMOR] Found armor piece: ${equip.name}, armorValue: ${equip.armorValue}`);
      }
    });
  }
  
  console.log(`[ARMOR] ${role} total armor bonus: ${armorBonus}`);
  
  // Base health is hero's starting health (from hero data or GAME_CONSTANTS)
  const baseHealth = player.hero?.health || GAME_CONSTANTS.STARTING_HEALTH || 30;
  const newMaxHealth = baseHealth + armorBonus;
  
  // Get old max health (before this update)
  const oldMaxHealth = player.maxHealth || baseHealth;
  const healthIncrease = newMaxHealth - oldMaxHealth;
  
  console.log(`[ARMOR] ${role} base health: ${baseHealth}, old max: ${oldMaxHealth}, new max: ${newMaxHealth}, increase: ${healthIncrease}`);
  
  if (newMaxHealth !== oldMaxHealth) {
    const oldHealth = player.health;
    player.maxHealth = newMaxHealth;
    
    // If max health decreased, cap current health at new max (don't go below 0)
    if (newMaxHealth < oldMaxHealth) {
      const healthDecrease = oldMaxHealth - newMaxHealth;
      player.health = Math.max(0, Math.min(player.health, newMaxHealth));
      console.log(`[ARMOR] ${role} lost ${healthDecrease} max health from armor removal. Health capped at ${player.health}`);
    } else {
      // Max health increased - add the difference to current health
      const healthIncrease = newMaxHealth - oldMaxHealth;
      player.health += healthIncrease;
      // Ensure health doesn't exceed max health
      if (player.health > player.maxHealth) {
        player.health = player.maxHealth;
      }
      console.log(`[ARMOR] ${role} gained ${healthIncrease} health from armor!`);
    }
    
    console.log(`[ARMOR] ${role} health updated: ${oldHealth} -> ${player.health} (max: ${player.maxHealth})`);
    
    // Log to game log
    const playerUsername = room.players[role]?.username || role;
    if (!room.gameState.gameLog) room.gameState.gameLog = [];
    if (healthIncrease > 0) {
      room.gameState.gameLog.push({
        turn: room.gameState.turnNumber,
        message: `${playerUsername} gained ${healthIncrease} health from armor! (Max HP: ${newMaxHealth})`,
        type: 'equipment'
      });
    } else if (healthIncrease < 0) {
      room.gameState.gameLog.push({
        turn: room.gameState.turnNumber,
        message: `${playerUsername} lost ${Math.abs(healthIncrease)} health from armor change.`,
        type: 'equipment'
      });
    }
  } else {
    console.log(`[ARMOR] ${role} no health change (armor bonus: ${armorBonus}, max health already: ${player.maxHealth})`);
  }
}

function getTypeAdvantage(attacker, defender) {
  if (!attacker.unitType || !defender.unitType) return 0;
  
  const counters = {
    'infantry': 'cavalry',
    'ranged': 'infantry',
    'cavalry': 'ranged'
  };
  
  // Ranged advantage is applied at play time, so don't apply it again during combat
  if (attacker.unitType === 'ranged' && defender.unitType === 'infantry') {
    return 0; // Already applied at play time
  }
  
  // Attacker has advantage
  if (counters[attacker.unitType] === defender.unitType) {
    return 2; // +2 damage bonus
  }
  
  // Defender has advantage (attacker is countered)
  if (counters[defender.unitType] === attacker.unitType) {
    return -2; // -2 damage penalty
  }
  
  return 0; // No advantage
}

function executeAttack(room, role, attacker, target, targetType) {
  const enemy = room.gameState[role === 'player1' ? 'player2' : 'player1'];
  const player = room.gameState[role];
  
  // Log attack with username
  const playerUsername = room.players[role]?.username || role;
  const targetName = targetType === 'hero' ? (enemy.hero?.name || 'Hero') : (target.name || 'Unit');
  if (!room.gameState.gameLog) room.gameState.gameLog = [];
  room.gameState.gameLog.push({
    turn: room.gameState.turnNumber,
    message: `${playerUsername}'s ${attacker.name} attacks ${targetName}`,
    type: 'attack'
  });

  // Calculate damage with bonuses
  let damage = attacker.power || 0;
  
  // Weapon bonus
  const weapon = player.equipmentSlots && player.equipmentSlots.weapon;
  const weaponBonus = weapon ? (weapon.equipPower || weapon.attackPower || 0) : 0;
  
  // Type advantage bonus (only for unit vs unit)
  let typeAdvantage = 0;
  if (targetType === 'unit' && attacker.unitType && target.unitType) {
    typeAdvantage = getTypeAdvantage(attacker, target);
  }
  
  // Base bonuses: Infantry +1, Cavalry +1
  const infantryBonus = attacker.unitType === 'infantry' ? 1 : 0;
  const cavalryBonus = attacker.unitType === 'cavalry' ? 1 : 0;
  
  // Hero passive bonus - only for specific heroes with damage passives
  let heroPassiveBonus = 0;
  if (player.hero) {
    // Robin Hood: Your ranged units deal +1 damage
    if (player.hero.id === 'robinHood' && attacker.unitType === 'ranged') {
      heroPassiveBonus = 1;
    }
    // Leonidas: Your infantry units deal +1 damage
    else if (player.hero.id === 'leonidas' && attacker.unitType === 'infantry') {
      heroPassiveBonus = 1;
    }
    // Genghis Khan: Your cavalry units deal +1 damage
    else if (player.hero.id === 'genghisKhan' && attacker.unitType === 'cavalry') {
      heroPassiveBonus = 1;
    }
  }
  
  damage = damage + weaponBonus + typeAdvantage + infantryBonus + cavalryBonus + heroPassiveBonus;
  damage = Math.max(1, damage); // Ensure minimum damage of 1
  
  // Log attacker properties for debugging
  console.log(`[ATTACK] ${role} ${attacker.name} attacks ${targetType} ${target.name || 'hero'}`);
  console.log(`[ATTACK] Attacker stats: power=${attacker.power}, health=${attacker.health}, unitType=${attacker.unitType}, ranged=${attacker.ranged}`);
  console.log(`[ATTACK] Bonuses: weapon=${weaponBonus}, typeAdv=${typeAdvantage}, infantry=${infantryBonus}, cavalry=${cavalryBonus}, heroPassive=${heroPassiveBonus}`);
  console.log(`[ATTACK] Total damage: ${damage}`);

  if (targetType === 'hero') {
    // Attack hero - update enemy state directly
    const oldHealth = enemy.health;
    enemy.health -= damage;
    if (enemy.health < 0) enemy.health = 0;
    console.log(`[ATTACK] Hero health: ${oldHealth} -> ${enemy.health} (damage: ${damage})`);
    
    // Check for game end after hero attack
    if (room.gameState.player1.health <= 0 || room.gameState.player2.health <= 0) {
      endGame(room);
      return;
    }
  } else {
    // Attack unit - use durability for consistency with single-player
    // Ensure durability/health is initialized BEFORE dealing damage
    // Check for null/undefined/0 values
    if (target.durability === undefined || target.durability === null) {
      // Try to get from health, maxHealth, or card durability property
      target.durability = target.health || target.maxHealth || target.durability || 1;
      if (target.durability === undefined || target.durability === null) {
        target.durability = 1; // Fallback to 1
      }
    }
    if (target.health === undefined || target.health === null) {
      target.health = target.durability || target.maxHealth || 1;
    }
    
    // Ensure attacker durability/health is initialized
    if (attacker.durability === undefined || attacker.durability === null) {
      attacker.durability = attacker.health || attacker.maxHealth || 1;
    }
    if (attacker.health === undefined || attacker.health === null) {
      attacker.health = attacker.durability || attacker.maxHealth || 1;
    }
    
    const oldDurability = target.durability;
    const oldHealth = target.health;
    
    console.log(`[ATTACK] BEFORE damage - Target ${target.name}: durability=${target.durability}, health=${target.health}, maxHealth=${target.maxHealth}`);
    
    // Check for Protection/Ward keyword - blocks first attack
    if (target.keywords && (target.keywords.includes('ward') || target.keywords.includes('protection'))) {
      target.keywords = target.keywords.filter(k => k !== 'ward' && k !== 'protection');
      console.log(`[ATTACK] ${target.name}'s Protection blocked the attack`);
      // Mark attacker as exhausted even though attack was blocked
      attacker.canAttack = false;
      attacker.exhausted = true;
      return; // Attack blocked, no damage dealt
    }
    
    // Deal damage to target (use durability like single-player)
    // Ensure we have valid numbers
    const currentDurability = Number(target.durability) || 0;
    const damageToDeal = Math.max(0, Number(damage) || 0); // Ensure non-negative
    
    // Apply damage
    const newDurability = Math.max(0, currentDurability - damageToDeal);
    target.durability = newDurability;
    target.health = newDurability; // Keep health in sync
    
    // Verify the change persisted by checking the board array directly
    const targetInBoard = enemy.board.find(u => u.instanceId === target.instanceId);
    if (targetInBoard) {
      targetInBoard.durability = newDurability;
      targetInBoard.health = newDurability;
      console.log(`[ATTACK] Verified target in board array updated: durability=${targetInBoard.durability}`);
    } else {
      console.error(`[ATTACK] ERROR: Target ${target.name} not found in board array after attack!`);
    }
    
    console.log(`[ATTACK] AFTER damage - Target ${target.name}: durability ${oldDurability} -> ${target.durability} (damage dealt: ${damageToDeal})`);
    console.log(`[ATTACK] Target stats: power=${target.power}, durability=${target.durability}, health=${target.health}, unitType=${target.unitType}`);

    // Handle hitback - match single-player logic exactly:
    // - Ranged attacker vs Melee defender: NO hitback (ranged evades)
    // - Melee attacker vs Ranged defender: YES hitback (ranged always hits back)
    // - Melee vs Melee: YES hitback (both hit back)
    // - Ranged vs Ranged: YES hitback (ranged defender hits back)
    const attackerIsRanged = (attacker.unitType === 'ranged') || (attacker.ranged === true);
    const defenderIsRanged = (target.unitType === 'ranged') || (target.ranged === true);
    const defenderPower = target.power || 0;
    
    console.log(`[ATTACK] Attacker: ${attacker.name} (unitType: ${attacker.unitType}, ranged: ${attacker.ranged}, isRanged: ${attackerIsRanged})`);
    console.log(`[ATTACK] Defender: ${target.name} (unitType: ${target.unitType}, ranged: ${target.ranged}, isRanged: ${defenderIsRanged}, power: ${defenderPower})`);
    
    let hitbackDamage = 0;
    if (attackerIsRanged && !defenderIsRanged) {
      // Ranged attacker vs Melee defender: NO hitback (ranged evades)
      console.log(`[ATTACK] No hitback - ranged attacker evades melee hitback`);
    } else if (defenderPower > 0) {
      // All other cases: defender hits back
      // This includes: Melee attacker vs Ranged defender, Melee vs Melee, Ranged vs Ranged
      hitbackDamage = defenderPower;
      const attackerOldDurability = attacker.durability;
      attacker.durability -= hitbackDamage;
      attacker.health = attacker.durability; // Keep health in sync
      console.log(`[ATTACK] Hitback: ${attacker.name} takes ${hitbackDamage} damage from ${target.name} (${attackerOldDurability} -> ${attacker.durability})`);
    } else {
      console.log(`[ATTACK] No hitback - defender has no power (power: ${defenderPower})`);
    }

    // Remove dead units (check durability like single-player)
    if (target.durability <= 0) {
      const index = enemy.board.findIndex(u => u.instanceId === target.instanceId);
      if (index >= 0) {
        enemy.board.splice(index, 1);
        console.log(`[ATTACK] Unit ${target.name} destroyed`);
      }
    }

    if (attacker.durability <= 0) {
      const index = player.board.findIndex(u => u.instanceId === attacker.instanceId);
      if (index >= 0) {
        player.board.splice(index, 1);
        console.log(`[ATTACK] Attacker ${attacker.name} destroyed`);
      }
    }
  }

  // Mark attacker as exhausted
  attacker.canAttack = false;
  attacker.exhausted = true;
  console.log(`[ATTACK] Attack complete, ${attacker.name} exhausted`);
}

function handlePlayerDisconnect(room, role) {
  console.log(`[DISCONNECT] ${role} disconnected from game`);

  // Notify opponent
  const opponentRole = role === 'player1' ? 'player2' : 'player1';
  const opponentSocket = room.players[opponentRole].socketId;

  io.to(opponentSocket).emit('opponentDisconnected');

  // Set timeout for reconnection
  room.disconnectTimeout = setTimeout(() => {
    console.log(`[DISCONNECT] ${role} did not reconnect, ending game`);

    // Opponent wins
    io.to(opponentSocket).emit('gameEnd', {
      result: 'win',
      reason: 'Opponent disconnected'
    });

    room.status = 'finished';
    activeGames.delete(room.roomId);
  }, GAME_CONSTANTS.DISCONNECT_TIMEOUT);
}

function initializeMultiplayerGame(room) {
  // Set game start time for duration tracking
  if (!room.gameStartTime) {
    room.gameStartTime = Date.now();
  }
  // Create decks and hands for both players based on their heroes
  const createMultiplayerDeck = (unitType) => {
    const deck = [];

    // Create diverse decks matching client-side logic
    if (unitType === 'ranged') {
      // Ranged units: archer x3, crossbow x2, skirmisher x2, scout x2
      const cardList = [
        { id: 'archer', name: 'Archer', cost: 2, power: 2, durability: 2, text: 'Basic ranged unit. No hitback.' },
        { id: 'archer', name: 'Archer', cost: 2, power: 2, durability: 2, text: 'Basic ranged unit. No hitback.' },
        { id: 'archer', name: 'Archer', cost: 2, power: 2, durability: 2, text: 'Basic ranged unit. No hitback.' },
        { id: 'crossbow', name: 'Crossbowman', cost: 3, power: 3, durability: 3, text: 'Powerful ranged unit. No hitback.' },
        { id: 'crossbow', name: 'Crossbowman', cost: 3, power: 3, durability: 3, text: 'Powerful ranged unit. No hitback.' },
        { id: 'skirmisher', name: 'Skirmisher', cost: 1, power: 1, durability: 2, text: 'Fast ranged unit. No hitback.' },
        { id: 'skirmisher', name: 'Skirmisher', cost: 1, power: 1, durability: 2, text: 'Fast ranged unit. No hitback.' },
        { id: 'scout', name: 'Scout', cost: 3, power: 2, durability: 4, text: 'Scout: When this unit is played, draw a card. No hitback.', keywords: ['scout'], scoutEffect: true },
        { id: 'scout', name: 'Scout', cost: 3, power: 2, durability: 4, text: 'Scout: When this unit is played, draw a card. No hitback.', keywords: ['scout'], scoutEffect: true }
      ];
      
      cardList.forEach(card => {
        deck.push({
          id: card.id,
          name: card.name,
          type: 'unit',
          cost: card.cost,
          power: card.power,
          durability: card.durability,
          unitType: 'ranged',
          text: card.text,
          keywords: card.keywords,
          scoutEffect: card.scoutEffect
        });
      });
    } else if (unitType === 'infantry') {
      // Infantry units: footman x3, swordsman x3, knight x1, sergeant x2
      const cardList = [
        { id: 'footman', name: 'Footman', cost: 2, power: 2, durability: 3, text: 'Basic infantry unit. High durability.' },
        { id: 'footman', name: 'Footman', cost: 2, power: 2, durability: 3, text: 'Basic infantry unit. High durability.' },
        { id: 'footman', name: 'Footman', cost: 2, power: 2, durability: 3, text: 'Basic infantry unit. High durability.' },
        { id: 'swordsman', name: 'Swordsman', cost: 3, power: 3, durability: 4, text: 'Trained infantry unit. High durability.' },
        { id: 'swordsman', name: 'Swordsman', cost: 3, power: 3, durability: 4, text: 'Trained infantry unit. High durability.' },
        { id: 'swordsman', name: 'Swordsman', cost: 3, power: 3, durability: 4, text: 'Trained infantry unit. High durability.' },
        { id: 'knight', name: 'Knight', cost: 4, power: 4, durability: 6, text: 'Elite infantry unit. Very high durability.' },
        { id: 'sergeant', name: 'Sergeant', cost: 3, power: 2, durability: 5, text: 'Command: When this unit is played, draw a card. High durability.', keywords: ['command'], commandEffect: true },
        { id: 'sergeant', name: 'Sergeant', cost: 3, power: 2, durability: 5, text: 'Command: When this unit is played, draw a card. High durability.', keywords: ['command'], commandEffect: true }
      ];
      
      cardList.forEach(card => {
        deck.push({
          id: card.id,
          name: card.name,
          type: 'unit',
          cost: card.cost,
          power: card.power,
          durability: card.durability,
          unitType: 'infantry',
          text: card.text,
          keywords: card.keywords,
          commandEffect: card.commandEffect
        });
      });
    } else if (unitType === 'cavalry') {
      // Cavalry units: horseman x3, camelRider x2, mountedKnight x1, messenger x2
      const cardList = [
        { id: 'horseman', name: 'Horseman', cost: 2, power: 2, durability: 2, text: 'Charge. Basic cavalry unit.', keywords: ['charge'] },
        { id: 'horseman', name: 'Horseman', cost: 2, power: 2, durability: 2, text: 'Charge. Basic cavalry unit.', keywords: ['charge'] },
        { id: 'horseman', name: 'Horseman', cost: 2, power: 2, durability: 2, text: 'Charge. Basic cavalry unit.', keywords: ['charge'] },
        { id: 'camelRider', name: 'Camel Rider', cost: 3, power: 3, durability: 3, text: 'Charge. Desert cavalry unit.', keywords: ['charge'] },
        { id: 'camelRider', name: 'Camel Rider', cost: 3, power: 3, durability: 3, text: 'Charge. Desert cavalry unit.', keywords: ['charge'] },
        { id: 'mountedKnight', name: 'Mounted Knight', cost: 4, power: 4, durability: 4, text: 'Charge. Elite cavalry unit.', keywords: ['charge'] },
        { id: 'messenger', name: 'Messenger', cost: 3, power: 2, durability: 3, text: 'Charge. Dispatch: When this unit is played, draw a card.', keywords: ['charge', 'dispatch'], dispatchEffect: true },
        { id: 'messenger', name: 'Messenger', cost: 3, power: 2, durability: 3, text: 'Charge. Dispatch: When this unit is played, draw a card.', keywords: ['charge', 'dispatch'], dispatchEffect: true }
      ];
      
      cardList.forEach(card => {
        deck.push({
          id: card.id,
          name: card.name,
          type: 'unit',
          cost: card.cost,
          power: card.power,
          durability: card.durability,
          unitType: 'cavalry',
          text: card.text,
          keywords: card.keywords,
          dispatchEffect: card.dispatchEffect
        });
      });
    }

    // Add abilities based on hero type (matching client-side logic)
    if (unitType === 'ranged') {
      deck.push(
        { id: 'quickShot', name: 'Quick Shot', type: 'ability', cost: 1, text: 'Deal 1 damage to a random enemy character.', damage: 1 },
        { id: 'quickShot', name: 'Quick Shot', type: 'ability', cost: 1, text: 'Deal 1 damage to a random enemy character.', damage: 1 },
        { id: 'aimedShot', name: 'Aimed Shot', type: 'ability', cost: 3, text: 'Deal 3 ranged damage to target enemy character.', damage: 3, needsTarget: true },
        { id: 'aimedShot', name: 'Aimed Shot', type: 'ability', cost: 3, text: 'Deal 3 ranged damage to target enemy character.', damage: 3, needsTarget: true },
        { id: 'masterShot', name: 'Master Shot', type: 'ability', cost: 4, text: 'Deal 4 ranged damage to any target. Draw a card.', damage: 4, needsTarget: true, targetType: 'any' },
        { id: 'rangersMark', name: "Ranger's Mark", type: 'ability', cost: 2, text: 'Give target ranged bannerman +2/+2.', needsTarget: true, targetType: 'ranged' },
        { id: 'bowEnchantment', name: 'Bow Enchantment', type: 'ability', cost: 4, text: 'Give all bows in your deck, hand, and equipped +1 Damage permanently.' },
        { id: 'quiverRefill', name: 'Quiver Refill', type: 'ability', cost: 3, text: 'Draw 3 cards.' },
        { id: 'quiverRefill', name: 'Quiver Refill', type: 'ability', cost: 3, text: 'Draw 3 cards.' }
      );
      // Add equipment
      deck.push(
        { id: 'bow', name: 'Bow', type: 'equipment', cost: 2, text: 'Attach to hero. Hero can deal ranged damage to any enemy character once per turn.', equipSlot: 'weapon', attackPower: 2 },
        { id: 'bow', name: 'Bow', type: 'equipment', cost: 2, text: 'Attach to hero. Hero can deal ranged damage to any enemy character once per turn.', equipSlot: 'weapon', attackPower: 2 },
        { id: 'clothCoif', name: 'Cloth Coif', type: 'equipment', cost: 1, text: 'Head armor. +1 durability to hero.', equipSlot: 'head', armorValue: 1 },
        { id: 'paddedClothArmor', name: 'Padded Cloth Armor', type: 'equipment', cost: 1, text: 'Chest armor. +1 durability to hero.', equipSlot: 'chest', armorValue: 1 },
        { id: 'paddedClothChaps', name: 'Padded Cloth Chaps', type: 'equipment', cost: 1, text: 'Leg armor. +1 durability to hero.', equipSlot: 'legs', armorValue: 1 }
      );
    } else if (unitType === 'infantry') {
      deck.push(
        { id: 'quickStrike', name: 'Quick Strike', type: 'ability', cost: 1, text: 'Deal 1 infantry damage to a target enemy character.', damage: 1, needsTarget: true },
        { id: 'quickStrike', name: 'Quick Strike', type: 'ability', cost: 1, text: 'Deal 1 infantry damage to a target enemy character.', damage: 1, needsTarget: true },
        { id: 'focusStrike', name: 'Focus Strike', type: 'ability', cost: 3, text: 'Deal 3 infantry damage to a target enemy character.', damage: 3, needsTarget: true },
        { id: 'focusStrike', name: 'Focus Strike', type: 'ability', cost: 3, text: 'Deal 3 infantry damage to a target enemy character.', damage: 3, needsTarget: true },
        { id: 'swordEnchantment', name: 'Sword Enchantment', type: 'ability', cost: 4, text: 'Give all swords equipped AND in your hand +1 attack permanently.' },
        { id: 'shieldWall', name: 'Shield Wall', type: 'ability', cost: 2, text: 'Give target infantry unit +0/+2.', needsTarget: true, targetType: 'infantry' },
        { id: 'supplyLine', name: 'Supply Line', type: 'ability', cost: 3, text: 'Draw 3 cards.' },
        { id: 'supplyLine', name: 'Supply Line', type: 'ability', cost: 3, text: 'Draw 3 cards.' }
      );
      // Add equipment
      deck.push(
        { id: 'sword', name: 'Sword', type: 'equipment', cost: 2, text: 'Attach to hero. Hero can deal melee damage to any enemy character once per turn.', equipSlot: 'weapon', attackPower: 2 },
        { id: 'sword', name: 'Sword', type: 'equipment', cost: 2, text: 'Attach to hero. Hero can deal melee damage to any enemy character once per turn.', equipSlot: 'weapon', attackPower: 2 },
        { id: 'plateHelmet', name: 'Plate Helmet', type: 'equipment', cost: 1, text: 'Head armor. +1 durability to hero.', equipSlot: 'head', armorValue: 1 },
        { id: 'plateBody', name: 'Plate Body', type: 'equipment', cost: 1, text: 'Chest armor. +1 durability to hero.', equipSlot: 'chest', armorValue: 1 },
        { id: 'plateLegs', name: 'Plate Legs', type: 'equipment', cost: 1, text: 'Leg armor. +1 durability to hero.', equipSlot: 'legs', armorValue: 1 },
        { id: 'kiteShield', name: 'Kite Shield', type: 'equipment', cost: 1, text: 'Shield. +1 durability to hero.', equipSlot: 'shield', armorValue: 1 }
      );
    } else if (unitType === 'cavalry') {
      deck.push(
        { id: 'quickCharge', name: 'Quick Charge', type: 'ability', cost: 1, text: 'Deal 1 cavalry damage to a target enemy character.', damage: 1, needsTarget: true },
        { id: 'quickCharge', name: 'Quick Charge', type: 'ability', cost: 1, text: 'Deal 1 cavalry damage to a target enemy character.', damage: 1, needsTarget: true },
        { id: 'focusCharge', name: 'Focus Charge', type: 'ability', cost: 3, text: 'Deal 3 cavalry damage to a target enemy character.', damage: 3, needsTarget: true },
        { id: 'focusCharge', name: 'Focus Charge', type: 'ability', cost: 3, text: 'Deal 3 cavalry damage to a target enemy character.', damage: 3, needsTarget: true },
        { id: 'axeEnchantment', name: 'Axe Enchantment', type: 'ability', cost: 4, text: 'Give all axes equipped AND in your hand +1 attack permanently.' },
        { id: 'cavalryFormation', name: 'Cavalry Formation', type: 'ability', cost: 2, text: 'Give a unit +0/+2 this turn.', needsTarget: true },
        { id: 'courierNetwork', name: 'Courier Network', type: 'ability', cost: 3, text: 'Draw 3 cards.' },
        { id: 'courierNetwork', name: 'Courier Network', type: 'ability', cost: 3, text: 'Draw 3 cards.' }
      );
      // Add equipment
      deck.push(
        { id: 'axe', name: 'Axe', type: 'equipment', cost: 2, text: 'Attach to hero. Hero can deal melee damage to any enemy character once per turn.', equipSlot: 'weapon', attackPower: 2 },
        { id: 'axe', name: 'Axe', type: 'equipment', cost: 2, text: 'Attach to hero. Hero can deal melee damage to any enemy character once per turn.', equipSlot: 'weapon', attackPower: 2 },
        { id: 'leatherCap', name: 'Leather Cap', type: 'equipment', cost: 1, text: 'Head armor. +1 durability to hero.', equipSlot: 'head', armorValue: 1 },
        { id: 'leatherArmor', name: 'Leather Armor', type: 'equipment', cost: 1, text: 'Chest armor. +1 durability to hero.', equipSlot: 'chest', armorValue: 1 },
        { id: 'leatherLeggings', name: 'Leather Leggings', type: 'equipment', cost: 1, text: 'Leg armor. +1 durability to hero.', equipSlot: 'legs', armorValue: 1 },
        { id: 'leatherShield', name: 'Leather Shield', type: 'equipment', cost: 1, text: 'Shield. +1 durability to hero.', equipSlot: 'shield', armorValue: 1 }
      );
    }

    // Log deck contents for debugging
    const cardCounts = {};
    const cardTypes = {};
    deck.forEach(card => {
      cardCounts[card.id] = (cardCounts[card.id] || 0) + 1;
      cardTypes[card.type] = (cardTypes[card.type] || 0) + 1;
    });
    console.log(`[DECK] Created ${unitType} deck with ${deck.length} cards:`, cardCounts);
    console.log(`[DECK] Card types breakdown:`, cardTypes);

    // Shuffle deck
    return shuffleDeck(deck);
  };

  // Initialize game state with heroes and decks
  room.gameState.player1.hero = room.players.player1.hero;
  room.gameState.player1.health = room.players.player1.hero.health || GAME_CONSTANTS.STARTING_HEALTH;
  room.gameState.player1.maxHealth = room.gameState.player1.health;
  // Use custom deck if provided, otherwise create default deck
  if (room.players.player1.customDeck && room.players.player1.customDeck.length > 0) {
    console.log(`[DECK] Player1 using custom deck with ${room.players.player1.customDeck.length} cards`);
    room.gameState.player1.deck = shuffleDeck([...room.players.player1.customDeck]);
  } else {
    room.gameState.player1.deck = createMultiplayerDeck(room.players.player1.hero.unitType);
  }
  
  // Give Infantry hero a starting sword for balance (+1 attack)
  if (room.players.player1.hero.unitType === 'infantry') {
    room.gameState.player1.equipmentSlots.weapon = {
      id: 'sword',
      name: 'Sword',
      type: 'equipment',
      unitType: 'infantry',
      cost: 2,
      text: 'Attach to hero. First weapon gives +1 attack. Each additional weapon or enchantment adds +1 attack. Hero can deal melee damage to any enemy character once per turn.',
      equipType: 'infantry',
      equipSlot: 'weapon',
      attackPower: 1
    };
    room.gameState.player1.weaponCount = 1;
    room.gameState.player1.weaponEnchantments = 0;
  } else {
    room.gameState.player1.weaponCount = 0;
    room.gameState.player1.weaponEnchantments = 0;
  }

  room.gameState.player2.hero = room.players.player2.hero;
  room.gameState.player2.health = room.players.player2.hero.health || GAME_CONSTANTS.STARTING_HEALTH;
  room.gameState.player2.maxHealth = room.gameState.player2.health;
  // Use custom deck if provided, otherwise create default deck
  if (room.players.player2.customDeck && room.players.player2.customDeck.length > 0) {
    console.log(`[DECK] Player2 using custom deck with ${room.players.player2.customDeck.length} cards`);
    room.gameState.player2.deck = shuffleDeck([...room.players.player2.customDeck]);
  } else {
    room.gameState.player2.deck = createMultiplayerDeck(room.players.player2.hero.unitType);
  }
  
  // Give Infantry hero a starting sword for balance (+1 attack)
  if (room.players.player2.hero.unitType === 'infantry') {
    room.gameState.player2.equipmentSlots.weapon = {
      id: 'sword',
      name: 'Sword',
      type: 'equipment',
      unitType: 'infantry',
      cost: 2,
      text: 'Attach to hero. First weapon gives +1 attack. Each additional weapon or enchantment adds +1 attack. Hero can deal melee damage to any enemy character once per turn.',
      equipType: 'infantry',
      equipSlot: 'weapon',
      attackPower: 1
    };
    room.gameState.player2.weaponCount = 1;
    room.gameState.player2.weaponEnchantments = 0;
  } else {
    room.gameState.player2.weaponCount = 0;
    room.gameState.player2.weaponEnchantments = 0;
  }

  // Draw initial hands (3 cards)
  console.log(`[GAME] Drawing initial hands...`);
  console.log(`[GAME] Player1 deck size before draw: ${room.gameState.player1.deck.length}`);
  console.log(`[GAME] Player2 deck size before draw: ${room.gameState.player2.deck.length}`);
  
  for (let i = 0; i < 3; i++) {
    if (room.gameState.player1.deck.length > 0) {
      const card = room.gameState.player1.deck.pop();
      room.gameState.player1.hand.push(card);
      console.log(`[GAME] Player1 drew initial card ${i+1}: ${card.name} (id: ${card.id})`);
    }
    if (room.gameState.player2.deck.length > 0) {
      const card = room.gameState.player2.deck.pop();
      room.gameState.player2.hand.push(card);
      console.log(`[GAME] Player2 drew initial card ${i+1}: ${card.name} (id: ${card.id})`);
    }
  }
  
  console.log(`[GAME] Player1 initial hand:`, room.gameState.player1.hand.map(c => c.name));
  console.log(`[GAME] Player2 initial hand:`, room.gameState.player2.hand.map(c => c.name));
  console.log(`[GAME] Player1 deck size after draw: ${room.gameState.player1.deck.length}`);
  console.log(`[GAME] Player2 deck size after draw: ${room.gameState.player2.deck.length}`);

  // Randomize first player (coin flip)
  const firstPlayer = Math.random() < 0.5 ? 'player1' : 'player2';
  room.gameState.currentPlayer = firstPlayer;
  room.gameState.turnNumber = 1;
  room.status = 'active';

  console.log(`[GAME] First player: ${firstPlayer}`);

  // Execute turn start for the first player
  executeTurnStart(room, firstPlayer);

  console.log(`[GAME] Game initialized for room ${room.roomId}`);

  // Send gameStart to both players
  io.to(room.players.player1.socketId).emit('gameStart', {
    roomId: room.roomId,
    yourRole: 'player1',
    gameState: room.gameState
  });

  io.to(room.players.player2.socketId).emit('gameStart', {
    roomId: room.roomId,
    yourRole: 'player2',
    gameState: room.gameState
  });
}

function shuffleDeck(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function broadcastGameState(room) {
  console.log(`\n[BROADCAST] ========== BROADCASTING STATE UPDATE ==========`);
  console.log(`[BROADCAST] Broadcasting state update to room ${room.roomId}, currentPlayer: ${room.gameState.currentPlayer}`);
  console.log(`[BROADCAST] Player1 hand size: ${room.gameState.player1.hand.length}, Player2 hand size: ${room.gameState.player2.hand.length}`);
  console.log(`[BROADCAST] Player1 socket: ${room.players.player1.socketId}, Player2 socket: ${room.players.player2.socketId}`);
  
  // Get all connected socket IDs for debugging
  const allSocketIds = Array.from(io.sockets.sockets.keys());
  console.log(`[BROADCAST] Total connected sockets: ${allSocketIds.length}`);
  console.log(`[BROADCAST] Looking for socket1: ${room.players.player1.socketId}, found: ${allSocketIds.includes(room.players.player1.socketId)}`);
  console.log(`[BROADCAST] Looking for socket2: ${room.players.player2.socketId}, found: ${allSocketIds.includes(room.players.player2.socketId)}`);
  
  // Send to room (requires sockets to be joined)
  io.to(room.roomId).emit('stateUpdate', room.gameState);
  console.log(`[BROADCAST] Sent stateUpdate to room ${room.roomId} via io.to()`);
  
  // Also send directly to both sockets as fallback (this always works)
  const socket1 = io.sockets.sockets.get(room.players.player1.socketId);
  const socket2 = io.sockets.sockets.get(room.players.player2.socketId);
  
  if (socket1) {
    socket1.emit('stateUpdate', room.gameState);
    console.log(`[BROADCAST] ✓ Sent stateUpdate directly to player1 socket ${room.players.player1.socketId}`);
    console.log(`[BROADCAST] Socket1 connected: ${socket1.connected}, Socket1 ID: ${socket1.id}`);
  } else {
    console.error(`[BROADCAST] ✗ Player1 socket ${room.players.player1.socketId} not found in connected sockets!`);
    console.error(`[BROADCAST] Available sockets:`, allSocketIds.slice(0, 10));
  }
  
  if (socket2) {
    socket2.emit('stateUpdate', room.gameState);
    console.log(`[BROADCAST] ✓ Sent stateUpdate directly to player2 socket ${room.players.player2.socketId}`);
    console.log(`[BROADCAST] Socket2 connected: ${socket2.connected}, Socket2 ID: ${socket2.id}`);
  } else {
    console.error(`[BROADCAST] ✗ Player2 socket ${room.players.player2.socketId} not found in connected sockets!`);
    console.error(`[BROADCAST] Available sockets:`, allSocketIds.slice(0, 10));
  }
  console.log(`[BROADCAST] ========== BROADCAST COMPLETE ==========\n`);
}

function endGame(room, reason = 'health', concedingRole = null) {
  room.status = 'finished';

  // Clear any turn timeout
  if (room.turnTimeout) {
    clearTimeout(room.turnTimeout);
    room.turnTimeout = null;
  }

  const player1Health = room.gameState.player1.health;
  const player2Health = room.gameState.player2.health;

  // Determine results based on reason
  let result1, result2;
  
  if (reason === 'concede') {
    // Conceding player loses, opponent wins
    if (concedingRole === 'player1') {
      result1 = 'loss';
      result2 = 'win';
    } else {
      result1 = 'win';
      result2 = 'loss';
    }
  } else if (reason === 'timeout') {
    // Timed out player loses, opponent wins
    const timedOutRole = room.gameState.currentPlayer;
    if (timedOutRole === 'player1') {
      result1 = 'loss';
      result2 = 'win';
    } else {
      result1 = 'win';
      result2 = 'loss';
    }
  } else {
    // Health-based win/loss (default)
    result1 = player1Health > 0 ? 'win' : (player2Health > 0 ? 'loss' : 'draw');
    result2 = player2Health > 0 ? 'win' : (player1Health > 0 ? 'loss' : 'draw');
  }

  // Calculate game duration (in seconds)
  const gameStartTime = room.gameStartTime || Date.now();
  const duration = Math.floor((Date.now() - gameStartTime) / 1000);

  // Get player user IDs if available
  const player1UserId = room.players.player1.userId;
  const player2UserId = room.players.player2.userId;

  // Get deck IDs if available
  const player1DeckId = room.players.player1.selectedDeckId;
  const player2DeckId = room.players.player2.selectedDeckId;

  // Save match history for both players
  const { db } = require('./database');
  
  if (player1UserId) {
    const opponentName = room.players.player2.username || room.players.player2.name || 'Opponent';
    db.run(
      'INSERT INTO match_history (user_id, opponent_name, result, duration, deck_used_id, game_mode) VALUES (?, ?, ?, ?, ?, ?)',
      [player1UserId, opponentName, result1, duration, player1DeckId || null, 'multiplayer'],
      (err) => {
        if (err) {
          console.error('Error saving match history for player1:', err);
        } else {
          console.log(`[MATCH HISTORY] Saved match for player1: ${result1} vs ${opponentName}`);
          
          // Update deck stats if deck was used
          if (player1DeckId) {
            if (result1 === 'win') {
              db.run('UPDATE deck_presets SET wins = wins + 1, last_used = CURRENT_TIMESTAMP WHERE id = ?', [player1DeckId]);
            } else if (result1 === 'loss') {
              db.run('UPDATE deck_presets SET losses = losses + 1, last_used = CURRENT_TIMESTAMP WHERE id = ?', [player1DeckId]);
            }
          }
          
          // Calculate and award XP
          const xpGained = calculateXP(result1, duration, 'multiplayer');
          awardXP(player1UserId, xpGained, db);
          
          // Update player stats
          if (result1 === 'win') {
            db.run('UPDATE player_stats SET total_wins = total_wins + 1 WHERE user_id = ?', [player1UserId]);
            
            // Track 1v1 leaderboard win
            getCurrentSeasonId((err, seasonId) => {
              if (!err && seasonId) {
                track1v1Win(player1UserId, seasonId);
              }
            });
          } else if (result1 === 'loss') {
            db.run('UPDATE player_stats SET total_losses = total_losses + 1 WHERE user_id = ?', [player1UserId]);
          }
          
          // Update preferred unit type
          const unitType = room.gameState.player1.hero?.unitType;
          if (unitType) {
            db.run('UPDATE player_stats SET preferred_unit_type = ? WHERE user_id = ?', [unitType, player1UserId]);
          }
        }
      }
    );
  }

  if (player2UserId) {
    const opponentName = room.players.player1.username || room.players.player1.name || 'Opponent';
    db.run(
      'INSERT INTO match_history (user_id, opponent_name, result, duration, deck_used_id, game_mode) VALUES (?, ?, ?, ?, ?, ?)',
      [player2UserId, opponentName, result2, duration, player2DeckId || null, 'multiplayer'],
      (err) => {
        if (err) {
          console.error('Error saving match history for player2:', err);
        } else {
          console.log(`[MATCH HISTORY] Saved match for player2: ${result2} vs ${opponentName}`);
          
          // Update deck stats if deck was used
          if (player2DeckId) {
            if (result2 === 'win') {
              db.run('UPDATE deck_presets SET wins = wins + 1, last_used = CURRENT_TIMESTAMP WHERE id = ?', [player2DeckId]);
            } else if (result2 === 'loss') {
              db.run('UPDATE deck_presets SET losses = losses + 1, last_used = CURRENT_TIMESTAMP WHERE id = ?', [player2DeckId]);
            }
          }
          
          // Update player stats
          if (result2 === 'win') {
            db.run('UPDATE player_stats SET total_wins = total_wins + 1 WHERE user_id = ?', [player2UserId]);
            
            // Track 1v1 leaderboard win
            getCurrentSeasonId((err, seasonId) => {
              if (!err && seasonId) {
                track1v1Win(player2UserId, seasonId);
              }
            });
          } else if (result2 === 'loss') {
            db.run('UPDATE player_stats SET total_losses = total_losses + 1 WHERE user_id = ?', [player2UserId]);
          }
          
          // Update preferred unit type
          const unitType = room.gameState.player2.hero?.unitType;
          if (unitType) {
            db.run('UPDATE player_stats SET preferred_unit_type = ? WHERE user_id = ?', [unitType, player2UserId]);
          }
        }
      }
    );
  }

  const reasonMessage = reason === 'concede' ? 'Opponent Conceded' : 
                       reason === 'timeout' ? 'Opponent Timed Out' : 
                       'Game Over';

  io.to(room.players.player1.socketId).emit('gameEnd', {
    result: result1,
    reason: reasonMessage,
    finalState: room.gameState
  });

  io.to(room.players.player2.socketId).emit('gameEnd', {
    result: result2,
    reason: reasonMessage,
    finalState: room.gameState
  });

  setTimeout(() => {
    activeGames.delete(room.roomId);
  }, 5000);
}

// ===== XP & LEVELING SYSTEM =====
function calculateXP(result, duration, gameMode) {
  // No XP if game duration was less than 60 seconds
  if (duration < 60) {
    return 0;
  }
  
  let baseXP = 0;
  
  // Base XP by result and game mode
  if (result === 'win') {
    baseXP = gameMode === 'multiplayer' ? 50 : 20; // +50 MP win, +20 SP win
  } else if (result === 'loss') {
    baseXP = gameMode === 'multiplayer' ? 25 : 10; // +25 MP loss, +10 SP loss
  } else if (result === 'draw') {
    baseXP = gameMode === 'multiplayer' ? 35 : 15; // Draw XP (if draws are possible)
  }
  
  return baseXP;
}

function awardXP(userId, xpGained, db) {
  // Get current stats
  db.get('SELECT xp, level, xp_to_next_level FROM player_stats WHERE user_id = ?', [userId], (err, stats) => {
    if (err) {
      console.error('Error fetching stats for XP:', err);
      return;
    }
    
    if (!stats) {
      // Initialize stats if they don't exist
      db.run('INSERT INTO player_stats (user_id, xp, level, xp_to_next_level) VALUES (?, ?, 1, 100)', [userId, xpGained]);
      return;
    }
    
    let currentXP = stats.xp || 0;
    let currentLevel = stats.level || 1;
    let xpToNextLevel = stats.xp_to_next_level || 100;
    
    // Add XP
    currentXP += xpGained;
    
    // Check for level up
    while (currentXP >= xpToNextLevel) {
      currentXP -= xpToNextLevel;
      currentLevel++;
      
      // Calculate XP needed for next level (exponential growth)
      // Level 1-10: 100 XP per level
      // Level 11-20: 150 XP per level
      // Level 21+: 200 XP per level
      if (currentLevel <= 10) {
        xpToNextLevel = 100;
      } else if (currentLevel <= 20) {
        xpToNextLevel = 150;
      } else {
        xpToNextLevel = 200;
      }
      
      console.log(`[XP] User ${userId} leveled up to level ${currentLevel}!`);
      
      // Create level-up notification
      createNotification(userId, 'level_up', `Level Up!`, `Congratulations! You've reached level ${currentLevel}!`, db);
      
      // Check for level-based achievements
      checkLevelAchievements(userId, currentLevel, db);
    }
    
    // Update stats
    db.run(
      'UPDATE player_stats SET xp = ?, level = ?, xp_to_next_level = ? WHERE user_id = ?',
      [currentXP, currentLevel, xpToNextLevel, userId],
      (err) => {
        if (err) {
          console.error('Error updating XP:', err);
        } else {
          console.log(`[XP] User ${userId} gained ${xpGained} XP (Total: ${currentXP}/${xpToNextLevel}, Level: ${currentLevel})`);
        }
      }
    );
  });
}

function checkLevelAchievements(userId, level, db) {
  const levelMilestones = [5, 10, 15, 20, 25, 30, 40, 50];
  
  if (levelMilestones.includes(level)) {
    const achievementId = `level_${level}`;
    
    // Check if already unlocked
    db.get('SELECT id FROM achievements WHERE user_id = ? AND achievement_id = ?', [userId, achievementId], (err, existing) => {
      if (err) {
        console.error('Error checking achievement:', err);
        return;
      }
      
      if (!existing) {
        // Unlock achievement
        db.run('INSERT INTO achievements (user_id, achievement_id) VALUES (?, ?)', [userId, achievementId], (err) => {
          if (err) {
            console.error('Error unlocking achievement:', err);
          } else {
            console.log(`[ACHIEVEMENT] User ${userId} unlocked: ${achievementId}`);
            
            // Create achievement notification
            createNotification(userId, 'achievement', 'Achievement Unlocked!', `You've unlocked the Level ${level} achievement!`, db);
          }
        });
      }
    });
  }
}

function createNotification(userId, type, title, message, db) {
  db.run(
    'INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)',
    [userId, type, title, message],
    (err) => {
      if (err) {
        console.error('Error creating notification:', err);
      } else {
        console.log(`[NOTIFICATION] Created ${type} notification for user ${userId}`);
      }
    }
  );
}

// Export XP functions for use in profile-routes
module.exports.calculateXP = calculateXP;
module.exports.awardXP = awardXP;

// Export userSockets for use in friends-routes
module.exports.userSockets = userSockets;

// ===== START SERVER =====
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🎮 Lords of War Multiplayer Server running on http://0.0.0.0:${PORT}`);
  console.log(`📡 Socket.io listening on port ${PORT}`);
  console.log(`📡 Accessible from external IP on port ${PORT}`);
});
