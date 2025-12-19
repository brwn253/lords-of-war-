// ===== LORDS OF WAR - MULTIPLAYER SERVER =====
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// ===== CONFIGURATION =====
const PORT = process.env.PORT || 3000;
const GAME_CONSTANTS = {
  STARTING_HEALTH: 30,
  MAX_BOARD_SIZE: 10,
  MAX_ESSENCE: 10,
  DISCONNECT_TIMEOUT: 60000 // 60 seconds
};

// ===== STATE MANAGEMENT =====
const waitingPlayers = [];
const activeGames = new Map(); // roomId -> GameRoom
const playerSockets = new Map(); // socketId -> { playerId, roomId, role }

// ===== SERVE STATIC FILES =====
// Serve the game client files from parent directory
app.use(express.static(path.join(__dirname, '..')));

// ===== SOCKET.IO EVENT HANDLERS =====
io.on('connection', (socket) => {
  console.log(`[CONNECTION] Player connected: ${socket.id}`);

  // ===== JOIN QUEUE =====
  socket.on('joinQueue', (playerData) => {
    console.log(`[QUEUE] ${playerData.name} joined queue`);
    console.log(`[QUEUE] Hero data:`, playerData.hero ? `${playerData.hero.name} (${playerData.hero.id})` : 'NONE');

    // Add to waiting players
    const queueEntry = {
      socketId: socket.id,
      playerId: playerData.playerId || uuidv4(),
      name: playerData.name || 'Player',
      unitType: playerData.unitType || 'ranged',
      hero: playerData.hero,
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
  socket.on('selectHero', ({ heroId, hero }) => {
    const playerInfo = playerSockets.get(socket.id);
    if (!playerInfo) return;

    const room = activeGames.get(playerInfo.roomId);
    if (!room) return;

    console.log(`[HERO] ${playerInfo.role} selected hero: ${heroId}`);

    // Store hero for this player
    room.players[playerInfo.role].hero = hero;

    // Check if both players have selected heroes
    if (room.players.player1.hero && room.players.player2.hero) {
      console.log(`[GAME] Both players ready, initializing game`);
      initializeMultiplayerGame(room);
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

    console.log(`[ACTION] ${playerInfo.role} used equipment`);

    const playerState = room.gameState[playerInfo.role];

    // Validate: has weapon equipped
    if (!playerState.equipmentSlots || !playerState.equipmentSlots.weapon) {
      socket.emit('error', { message: 'No weapon equipped' });
      return;
    }

    // For now, similar to attack
    const enemy = room.gameState[playerInfo.role === 'player1' ? 'player2' : 'player1'];

    if (playerState.currentEssence < 1) {
      socket.emit('error', { message: 'Insufficient essence' });
      return;
    }

    playerState.currentEssence -= 1;
    playerState.equipmentUsed = true;

    broadcastGameState(room);
  });

  // ===== DISCONNECT =====
  socket.on('disconnect', () => {
    const playerInfo = playerSockets.get(socket.id);
    console.log(`[DISCONNECT] Player disconnected: ${socket.id}`);

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
    players: {
      player1: { 
        socketId: player1Data.socketId, 
        playerId: player1Data.playerId, 
        name: player1Data.name,
        hero: player1Data.hero || null // Store hero from queue
      },
      player2: { 
        socketId: player2Data.socketId, 
        playerId: player2Data.playerId, 
        name: player2Data.name,
        hero: player2Data.hero || null // Store hero from queue
      }
    },
    gameState: createInitialGameState(player1Data, player2Data),
    status: 'active',
    disconnectTimeout: null
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
    player1: {
      hero: player1Data.hero,
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
  if (player.deck && player.deck.length > 0) {
    const drawnCard = player.deck.pop();
    // Mark card as just drawn for animation (client-side will handle this)
    drawnCard.justDrawn = true;
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
  } else {
    console.log(`[TURN] ${role} tried to draw but deck is empty (deck length: ${player.deck?.length || 0})`);
  }
}

function executePlayCard(room, role, card, target) {
  const player = room.gameState[role];

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
    // Apply ability effects (simplified)
    if (card.damage && target) {
      const enemy = room.gameState[role === 'player1' ? 'player2' : 'player1'];
      const targetUnit = enemy.board.find(c => c.instanceId === target.instanceId);
      if (targetUnit) {
        targetUnit.health -= card.damage;
        if (targetUnit.health <= 0) {
          const index = enemy.board.findIndex(c => c.instanceId === target.instanceId);
          if (index >= 0) enemy.board.splice(index, 1);
        }
      }
    }
  } else if (card.type === 'forge' || card.type === 'equipment') {
    // Equip to hero
    if (card.equipSlot) {
      player.equipmentSlots[card.equipSlot] = card;
    }
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
  
  damage = damage + weaponBonus + typeAdvantage + infantryBonus + cavalryBonus;
  damage = Math.max(1, damage); // Ensure minimum damage of 1
  
  // Log attacker properties for debugging
  console.log(`[ATTACK] ${role} ${attacker.name} attacks ${targetType} ${target.name || 'hero'}`);
  console.log(`[ATTACK] Attacker stats: power=${attacker.power}, health=${attacker.health}, unitType=${attacker.unitType}, ranged=${attacker.ranged}`);
  console.log(`[ATTACK] Bonuses: weapon=${weaponBonus}, typeAdv=${typeAdvantage}, infantry=${infantryBonus}, cavalry=${cavalryBonus}`);
  console.log(`[ATTACK] Total damage: ${damage}`);

  if (targetType === 'hero') {
    // Attack hero - update enemy state directly
    const oldHealth = enemy.health;
    enemy.health -= damage;
    if (enemy.health < 0) enemy.health = 0;
    console.log(`[ATTACK] Hero health: ${oldHealth} -> ${enemy.health} (damage: ${damage})`);
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
        { id: 'quickShot', name: 'Quick Shot', type: 'ability', cost: 1, text: 'Deal 1 damage to any target.', damage: 1 },
        { id: 'quickShot', name: 'Quick Shot', type: 'ability', cost: 1, text: 'Deal 1 damage to any target.', damage: 1 },
        { id: 'aimedShot', name: 'Aimed Shot', type: 'ability', cost: 2, text: 'Deal 2 damage to any target.', damage: 2 },
        { id: 'aimedShot', name: 'Aimed Shot', type: 'ability', cost: 2, text: 'Deal 2 damage to any target.', damage: 2 },
        { id: 'masterShot', name: 'Master Shot', type: 'ability', cost: 3, text: 'Deal 3 damage to any target.', damage: 3 },
        { id: 'rangersMark', name: "Ranger's Mark", type: 'ability', cost: 2, text: 'Target unit takes +1 damage from all sources this turn.' },
        { id: 'bowEnchantment', name: 'Bow Enchantment', type: 'ability', cost: 2, text: 'Give a unit +2/+1 this turn.' },
        { id: 'quiverRefill', name: 'Quiver Refill', type: 'ability', cost: 1, text: 'Draw a card.' },
        { id: 'quiverRefill', name: 'Quiver Refill', type: 'ability', cost: 1, text: 'Draw a card.' }
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
        { id: 'quickStrike', name: 'Quick Strike', type: 'ability', cost: 1, text: 'Deal 1 damage to any target.', damage: 1 },
        { id: 'quickStrike', name: 'Quick Strike', type: 'ability', cost: 1, text: 'Deal 1 damage to any target.', damage: 1 },
        { id: 'focusStrike', name: 'Focus Strike', type: 'ability', cost: 2, text: 'Deal 2 damage to any target.', damage: 2 },
        { id: 'focusStrike', name: 'Focus Strike', type: 'ability', cost: 2, text: 'Deal 2 damage to any target.', damage: 2 },
        { id: 'swordEnchantment', name: 'Sword Enchantment', type: 'ability', cost: 2, text: 'Give a unit +2/+1 this turn.' },
        { id: 'shieldWall', name: 'Shield Wall', type: 'ability', cost: 2, text: 'Give a unit +0/+2 this turn.' },
        { id: 'supplyLine', name: 'Supply Line', type: 'ability', cost: 1, text: 'Draw a card.' },
        { id: 'supplyLine', name: 'Supply Line', type: 'ability', cost: 1, text: 'Draw a card.' }
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
        { id: 'quickCharge', name: 'Quick Charge', type: 'ability', cost: 1, text: 'Deal 1 damage to any target.', damage: 1 },
        { id: 'quickCharge', name: 'Quick Charge', type: 'ability', cost: 1, text: 'Deal 1 damage to any target.', damage: 1 },
        { id: 'focusCharge', name: 'Focus Charge', type: 'ability', cost: 2, text: 'Deal 2 damage to any target.', damage: 2 },
        { id: 'focusCharge', name: 'Focus Charge', type: 'ability', cost: 2, text: 'Deal 2 damage to any target.', damage: 2 },
        { id: 'axeEnchantment', name: 'Axe Enchantment', type: 'ability', cost: 2, text: 'Give a unit +2/+1 this turn.' },
        { id: 'cavalryFormation', name: 'Cavalry Formation', type: 'ability', cost: 2, text: 'Give a unit +0/+2 this turn.' },
        { id: 'courierNetwork', name: 'Courier Network', type: 'ability', cost: 1, text: 'Draw a card.' },
        { id: 'courierNetwork', name: 'Courier Network', type: 'ability', cost: 1, text: 'Draw a card.' }
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
  room.gameState.player1.deck = createMultiplayerDeck(room.players.player1.hero.unitType);
  
  // Give Infantry hero a starting sword for balance (matching single-player)
  if (room.players.player1.hero.unitType === 'infantry') {
    room.gameState.player1.equipmentSlots.weapon = {
      id: 'sword',
      name: 'Sword',
      type: 'equipment',
      unitType: 'infantry',
      cost: 2,
      text: 'Attach to hero. Hero can deal melee damage to any enemy character once per turn.',
      equipType: 'infantry',
      equipSlot: 'weapon',
      attackPower: 2
    };
  }

  room.gameState.player2.hero = room.players.player2.hero;
  room.gameState.player2.health = room.players.player2.hero.health || GAME_CONSTANTS.STARTING_HEALTH;
  room.gameState.player2.maxHealth = room.gameState.player2.health;
  room.gameState.player2.deck = createMultiplayerDeck(room.players.player2.hero.unitType);
  
  // Give Infantry hero a starting sword for balance (matching single-player)
  if (room.players.player2.hero.unitType === 'infantry') {
    room.gameState.player2.equipmentSlots.weapon = {
      id: 'sword',
      name: 'Sword',
      type: 'equipment',
      unitType: 'infantry',
      cost: 2,
      text: 'Attach to hero. Hero can deal melee damage to any enemy character once per turn.',
      equipType: 'infantry',
      equipSlot: 'weapon',
      attackPower: 2
    };
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

function endGame(room) {
  room.status = 'finished';

  const player1Health = room.gameState.player1.health;
  const player2Health = room.gameState.player2.health;

  const result1 = player1Health > 0 ? 'win' : (player2Health > 0 ? 'loss' : 'draw');
  const result2 = player2Health > 0 ? 'win' : (player1Health > 0 ? 'loss' : 'draw');

  io.to(room.players.player1.socketId).emit('gameEnd', {
    result: result1,
    reason: 'Game Over',
    finalState: room.gameState
  });

  io.to(room.players.player2.socketId).emit('gameEnd', {
    result: result2,
    reason: 'Game Over',
    finalState: room.gameState
  });

  setTimeout(() => {
    activeGames.delete(room.roomId);
  }, 5000);
}

// ===== START SERVER =====
server.listen(PORT, () => {
  console.log(`🎮 Lords of War Multiplayer Server running on http://localhost:${PORT}`);
  console.log(`📡 Socket.io listening on port ${PORT}`);
});
