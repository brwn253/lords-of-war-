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
    const hasCard = playerState.hand.some(c =>
      c.id === card.id && (c.tier || 1) === (card.tier || 1)
    );

    if (!hasCard) {
      socket.emit('error', { message: 'Card not in hand' });
      return;
    }

    // Validate: sufficient essence
    if (playerState.currentEssence < card.cost) {
      socket.emit('error', { message: 'Insufficient essence' });
      return;
    }

    // Validate: board space for units (if not merging)
    if ((card.type === 'unit' || card.type === 'construct') && !card.type.includes('equipment')) {
      const willMerge = playerState.board.some(c =>
        c.id === card.id && (c.tier || 1) === (card.tier || 1)
      );

      if (!willMerge && playerState.board.length >= GAME_CONSTANTS.MAX_BOARD_SIZE) {
        socket.emit('error', { message: 'Board is full' });
        return;
      }
    }

    // Execute action on server state
    executePlayCard(room, playerInfo.role, card, target);

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
    const playerInfo = playerSockets.get(socket.id);
    if (!playerInfo) return;

    const room = activeGames.get(playerInfo.roomId);
    if (!room) return;

    console.log(`[ACTION] ${playerInfo.role} ended turn`);

    // Validate: is it this player's turn?
    if (room.gameState.currentPlayer !== playerInfo.role) {
      socket.emit('error', { message: 'Not your turn' });
      return;
    }

    // Switch turn
    const nextRole = playerInfo.role === 'player1' ? 'player2' : 'player1';
    room.gameState.currentPlayer = nextRole;
    room.gameState.turnNumber++;

    // Execute turn start for next player
    executeTurnStart(room, nextRole);

    // Check for game end
    if (room.gameState.player1.health <= 0 || room.gameState.player2.health <= 0) {
      endGame(room);
    } else {
      broadcastGameState(room);
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
      socket.emit('error', { message: 'Unit not found' });
      return;
    }

    // Validate: can attack?
    if (!attacker.canAttack) {
      socket.emit('error', { message: 'Unit cannot attack' });
      return;
    }

    // Find target
    let target;
    if (targetType === 'unit') {
      target = enemyState.board.find(c => c.instanceId === targetId);
    } else if (targetType === 'hero') {
      target = enemyState.hero;
    }

    if (!target) {
      socket.emit('error', { message: 'Target not found' });
      return;
    }

    // Execute attack
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
      player1: { socketId: player1Data.socketId, playerId: player1Data.playerId, name: player1Data.name },
      player2: { socketId: player2Data.socketId, playerId: player2Data.playerId, name: player2Data.name }
    },
    gameState: createInitialGameState(player1Data, player2Data),
    status: 'active',
    disconnectTimeout: null
  };

  activeGames.set(roomId, room);

  // Associate sockets with room
  playerSockets.set(player1Data.socketId, { playerId: player1Data.playerId, roomId, role: 'player1' });
  playerSockets.set(player2Data.socketId, { playerId: player2Data.playerId, roomId, role: 'player2' });

  // Notify players
  io.to(player1Data.socketId).emit('gameFound');
  io.to(player2Data.socketId).emit('gameFound');

  // Start game
  setTimeout(() => {
    io.to(player1Data.socketId).emit('gameStart', {
      roomId,
      yourRole: 'player1',
      gameState: room.gameState
    });
    io.to(player2Data.socketId).emit('gameStart', {
      roomId,
      yourRole: 'player2',
      gameState: room.gameState
    });
  }, 500);
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

  // Refresh all units
  player.board.forEach(unit => {
    unit.canAttack = true;
    unit.exhausted = false;
  });

  // Reset temp buffs
  room.tempPowerBuff = 0;
}

function executePlayCard(room, role, card, target) {
  const player = room.gameState[role];

  // Deduct essence
  player.currentEssence -= card.cost;

  // Remove from hand
  const handIndex = player.hand.findIndex(c =>
    c.id === card.id && (c.tier || 1) === (card.tier || 1)
  );
  if (handIndex >= 0) {
    player.hand.splice(handIndex, 1);
  }

  // Handle card type
  if (card.type === 'unit' || card.type === 'construct') {
    // Add to board
    const newUnit = {
      ...card,
      instanceId: uuidv4(),
      canAttack: false, // Units can't attack on the turn they're played
      exhausted: false,
      health: card.durability || 1,
      maxHealth: card.durability || 1
    };

    // Check for merge
    const existing = player.board.find(c => c.id === card.id && (c.tier || 1) === (card.tier || 1));
    if (existing) {
      // Merge units
      existing.power = (existing.power || 0) + (card.power || 0);
      existing.durability = (existing.durability || 1) + (card.durability || 1);
      existing.health = existing.durability;
      existing.maxHealth = existing.durability;
      existing.tier = (existing.tier || 1) + 1;
    } else {
      player.board.push(newUnit);
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

function executeAttack(room, role, attacker, target, targetType) {
  const enemy = room.gameState[role === 'player1' ? 'player2' : 'player1'];

  // Calculate damage
  let damage = attacker.power || 0;

  if (targetType === 'hero') {
    // Attack hero
    target.health -= damage;
  } else {
    // Attack unit
    target.health -= damage;

    // Handle hitback (simplified)
    if (target.power && !attacker.ranged) {
      attacker.health -= target.power;
    }

    // Remove dead units
    if (target.health <= 0) {
      const index = enemy.board.findIndex(u => u.instanceId === target.instanceId);
      if (index >= 0) enemy.board.splice(index, 1);
    }

    if (attacker.health <= 0) {
      const index = room.gameState[role].board.findIndex(u => u.instanceId === attacker.instanceId);
      if (index >= 0) room.gameState[role].board.splice(index, 1);
    }
  }

  // Mark attacker as exhausted
  attacker.canAttack = false;
  attacker.exhausted = true;
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

    // Simplified deck creation for multiplayer
    // In a real game, this would use CARD_DATABASE from client
    if (unitType === 'ranged') {
      // Add some ranged units
      for (let i = 0; i < 12; i++) {
        deck.push({
          id: 'archer',
          name: 'Archer',
          type: 'unit',
          cost: 2,
          power: 2,
          durability: 1,
          unitType: 'ranged'
        });
      }
    } else if (unitType === 'infantry') {
      for (let i = 0; i < 12; i++) {
        deck.push({
          id: 'footman',
          name: 'Footman',
          type: 'unit',
          cost: 2,
          power: 2,
          durability: 2,
          unitType: 'infantry'
        });
      }
    } else if (unitType === 'cavalry') {
      for (let i = 0; i < 12; i++) {
        deck.push({
          id: 'horseman',
          name: 'Horseman',
          type: 'unit',
          cost: 3,
          power: 3,
          durability: 1,
          unitType: 'cavalry'
        });
      }
    }

    // Shuffle deck
    return shuffleDeck(deck);
  };

  // Initialize game state with heroes and decks
  room.gameState.player1.hero = room.players.player1.hero;
  room.gameState.player1.health = room.players.player1.hero.health || GAME_CONSTANTS.STARTING_HEALTH;
  room.gameState.player1.maxHealth = room.gameState.player1.health;
  room.gameState.player1.deck = createMultiplayerDeck(room.players.player1.hero.unitType);

  room.gameState.player2.hero = room.players.player2.hero;
  room.gameState.player2.health = room.players.player2.hero.health || GAME_CONSTANTS.STARTING_HEALTH;
  room.gameState.player2.maxHealth = room.gameState.player2.health;
  room.gameState.player2.deck = createMultiplayerDeck(room.players.player2.hero.unitType);

  // Draw initial hands (3 cards)
  for (let i = 0; i < 3; i++) {
    if (room.gameState.player1.deck.length > 0) {
      room.gameState.player1.hand.push(room.gameState.player1.deck.pop());
    }
    if (room.gameState.player2.deck.length > 0) {
      room.gameState.player2.hand.push(room.gameState.player2.deck.pop());
    }
  }

  // Set first player
  room.gameState.currentPlayer = 'player1';
  room.gameState.turnNumber = 1;
  room.status = 'active';

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
  io.to(room.roomId).emit('stateUpdate', room.gameState);
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
