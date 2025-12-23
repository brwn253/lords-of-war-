// ===== LORDS OF WAR - GAME ENGINE =====
// This engine uses CARD_DATABASE and LORDS from lords-of-war.js

// Create HEROES alias for compatibility (engine code uses HEROES internally)
let HEROES = typeof LORDS !== 'undefined' ? LORDS : {};
// HISTORIC_LEADERS is defined as const in lords-of-war.js, we'll reference it from window
// Don't declare it here to avoid redeclaration error

// Game constants
const GAME_CONSTANTS = {
    MAX_BOARD_SIZE: 10,
    MAX_ESSENCE: 10,
    STARTING_HEALTH: 30,
    STARTING_HAND_SIZE: 3,
    TYPE_ADVANTAGE_BONUS: 2
};

// Hand scrolling state
let handScrollOffset = 0;
const CARDS_VISIBLE = 5;

// ===== MULTIPLAYER MODE =====
let gameMode = 'singleplayer'; // 'singleplayer' or 'multiplayer'
let networkManager = null;

function setGameMode(mode) {
  gameMode = mode;
  console.log('Game mode set to:', mode);
}

function initMultiplayer(serverUrl = null) {
  // If no serverUrl provided, auto-detect based on current location
  if (!serverUrl) {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    const port = 8080;
    serverUrl = `${protocol}//${hostname}:${port}`;
  }
  if (window.networkManager) {
    networkManager = window.networkManager;
  } else {
    networkManager = new NetworkManager();
    window.networkManager = networkManager;
  }

  networkManager.connect(serverUrl);

  // Register event handlers - always register to ensure they're there
  // Note: NetworkManager's custom EventEmitter allows multiple handlers, but we'll remove old ones first
  console.log('[Game] Registering/updating multiplayer event handlers');
  
  // Remove old handlers if they exist (to prevent duplicates)
  networkManager.off('gameStart');
  networkManager.off('bothPlayersReady');
  networkManager.off('waitingForOpponent');
  
  networkManager.on('gameStart', (data) => {
    console.log('[Game] Game started, initializing with state:', data.gameState);
    initializeMultiplayerGame(data);
  });

  networkManager.on('bothPlayersReady', (data) => {
    console.log('[Game] ✓✓✓ BOTH PLAYERS READY EVENT RECEIVED ✓✓✓');
    console.log('[Game] Both players ready! Starting game board');
    console.log('[Game] bothPlayersReady data:', data);
    console.log('[Game] Calling showGameBoard()...');
    showGameBoard();
    console.log('[Game] showGameBoard() called');
  });

  networkManager.on('waitingForOpponent', () => {
    console.log('[Game] Waiting for opponent to click "Ready to Battle"');
    const rollStartBtn = document.getElementById('rollStartBtn');
    if (rollStartBtn) {
      rollStartBtn.textContent = 'WAITING FOR OPPONENT...';
      rollStartBtn.disabled = true;
      rollStartBtn.style.opacity = '0.6';
      rollStartBtn.style.cursor = 'not-allowed';
    }
  });

  // Register other handlers only if not already registered
  if (!networkManager._handlersRegistered) {
    networkManager.on('stateUpdate', (gameState) => {
      console.log('[Game] Received state update from server');
      console.log('[Game] State update currentPlayer:', gameState.currentPlayer);
      console.log('[Game] Our role:', networkManager?.playerRole);
      console.log('[Game] Current game.currentPlayer before update:', game.currentPlayer);
      applyServerState(gameState);
      console.log('[Game] Current game.currentPlayer after update:', game.currentPlayer);
      // Update UI after applying server state
      updateUI();
    });

    networkManager.on('gameEnd', (result) => {
      console.log('Game ended:', result);
      handleGameEnd(result);
    });

    networkManager.on('opponentDisconnected', () => {
      log('Opponent disconnected - waiting to reconnect...', 'warning');
    });

    networkManager.on('error', (error) => {
      console.error('Network error:', error);
      log('Network error: ' + error.message, 'error');
    });
    
    networkManager._handlersRegistered = true;
  }
}

function initializeMultiplayerGame(data) {
  console.log('[Game] Initializing multiplayer game with data:', data);
  
  gameMode = 'multiplayer';
  setGameMode('multiplayer');
  
  // Record game start time to prevent immediate endTurn calls
  gameStartTime = Date.now();

  // Store game info
  game.roomId = data.roomId;
  game.playerRole = data.yourRole;
  
  // Ensure playerAlias is set for multiplayer (use pendingPlayerName if available)
  if (!window.playerAlias && window.pendingPlayerName) {
    window.playerAlias = window.pendingPlayerName;
  }
  // If still not set, try to get it from the input field
  if (!window.playerAlias) {
    const playerNameInput = document.getElementById('playerNameInput');
    if (playerNameInput && playerNameInput.value) {
      window.playerAlias = playerNameInput.value.trim() || 'Player';
    } else {
      // Check if user is logged in
      const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
      if (isLoggedIn) {
        try {
          const userData = JSON.parse(sessionStorage.getItem('userData'));
          if (userData && userData.username) {
            window.playerAlias = userData.username;
          } else {
            window.playerAlias = 'Player';
          }
        } catch (e) {
          window.playerAlias = 'Player';
        }
      } else {
        window.playerAlias = 'Player';
      }
    }
  }
  
  // Update network manager role
  if (networkManager) {
    networkManager.playerRole = data.yourRole;
    networkManager.roomId = data.roomId;
    networkManager.isMultiplayer = true;
  }

  // Apply the server state (which has heroes, decks, hands)
  if (!data.gameState) {
    console.error('[Game] No gameState in data!', data);
    return;
  }
  
  applyServerState(data.gameState);

  // Show roll modal
  showRollModal(data.gameState.currentPlayer);
}

function showRollModal(firstPlayerRole) {
  console.log('[Roll] Showing roll modal, firstPlayerRole:', firstPlayerRole, 'ourRole:', networkManager?.playerRole);
  
  // Hide all modals (including hero selection and lobby)
  const modals = document.querySelectorAll('.modal');
  modals.forEach(m => m.style.display = 'none');
  
  // Explicitly hide hero selection and lobby modals
  const heroModal = document.getElementById('multiplayerHeroModal');
  const lobbyModal = document.getElementById('lobbyModal');
  if (heroModal) heroModal.style.display = 'none';
  if (lobbyModal) lobbyModal.style.display = 'none';

  // Reset roll modal elements
  const rollDisplay = document.getElementById('rollDisplay');
  const rollResult = document.getElementById('rollResult');
  const rollStartBtn = document.getElementById('rollStartBtn');
  
  if (rollDisplay) rollDisplay.textContent = '🎲';
  if (rollResult) rollResult.textContent = '';
  if (rollStartBtn) rollStartBtn.style.display = 'none';

  // Show roll modal
  const rollModal = document.getElementById('rollModal');
  const overlay = document.getElementById('modalOverlay');
  if (rollModal) rollModal.style.display = 'flex';
  if (overlay) overlay.style.display = 'block';

  // Animate the dice roll
  let rollCount = 0;
  const rollInterval = setInterval(() => {
    rollCount++;
    const roll = Math.floor(Math.random() * 6) + 1;
    if (rollDisplay) {
      rollDisplay.textContent = ['⚫', '🔴', '🟡', '🟢', '🔵', '🟣'][roll - 1];
    }

    if (rollCount > 15) {
      clearInterval(rollInterval);

      // Show result
      const isPlayerFirst = firstPlayerRole === networkManager?.playerRole;
      const resultText = isPlayerFirst
        ? '🎯 YOU GO FIRST!'
        : '⏳ OPPONENT GOES FIRST';
      const resultColor = isPlayerFirst ? '#2ecc71' : '#ff6b6b';

      if (rollResult) {
        rollResult.textContent = resultText;
        rollResult.style.color = resultColor;
      }
      if (rollStartBtn) {
        rollStartBtn.style.display = 'inline-block';
      }
      console.log('[Roll] Roll complete, isPlayerFirst:', isPlayerFirst);
    }
  }, 100);
}

function startGameAfterRoll() {
  console.log('[Game] Starting game after roll, currentPlayer:', game.currentPlayer);
  
  // In multiplayer, send ready signal to server instead of immediately showing board
  if (gameMode === 'multiplayer' && networkManager) {
    console.log('[Game] Sending playerReady to server');
    console.log('[Game] NetworkManager socket:', networkManager.socket);
    console.log('[Game] Socket connected:', networkManager.socket?.connected);
    
    if (networkManager.socket && networkManager.socket.connected) {
      console.log('[Game] Emitting playerReady to server...');
      console.log('[Game] Socket ID:', networkManager.socket.id);
      console.log('[Game] Room ID:', networkManager.roomId);
      console.log('[Game] Player role:', networkManager.playerRole);
      
      // First send a test event to verify connection
      networkManager.socket.emit('test');
      console.log('[Game] Test event sent');
      
      // Then send playerReady
      networkManager.socket.emit('playerReady');
      console.log('[Game] ✓ playerReady event emitted to server');
      
      // Also try with a callback to see if server responds
      networkManager.socket.emit('playerReady', (response) => {
        console.log('[Game] Server response to playerReady:', response);
      });
    } else {
      console.error('[Game] ERROR: Socket not connected, cannot send playerReady');
      console.error('[Game] Socket exists:', !!networkManager.socket);
      console.error('[Game] Socket connected:', networkManager.socket?.connected);
      // Fallback: show board anyway if socket isn't working
      showGameBoard();
    }
    // Don't show board yet - wait for bothPlayersReady event
    return;
  }
  
  // Single-player or after both players ready - show board
  showGameBoard();
}

function showGameBoard() {
  console.log('[Game] ========== SHOWING GAME BOARD ==========');

  // Hide modals
  const rollModal = document.getElementById('rollModal');
  const heroModal = document.getElementById('multiplayerHeroModal');
  const overlay = document.getElementById('modalOverlay');
  if (rollModal) {
    rollModal.style.display = 'none';
    console.log('[Game] Roll modal hidden');
  }
  if (heroModal) {
    heroModal.style.display = 'none';
    console.log('[Game] Hero modal hidden');
  }
  if (overlay) {
    overlay.style.display = 'none';
    console.log('[Game] Overlay hidden');
  }

  // Show all game UI elements
  const gameBoard = document.querySelector('.game-board');
  const bottomBar = document.querySelector('.bottom-bar');
  const gameLog = document.getElementById('gameLog');
  const endTurnBtn = document.getElementById('endTurnBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const handCardPreview = document.getElementById('handCardPreview');

  if (gameBoard) {
    gameBoard.style.display = 'grid';
    console.log('[Game] Game board shown');
  }
  if (bottomBar) {
    bottomBar.style.display = 'flex';
    console.log('[Game] Bottom bar shown');
    // Ensure hand container is visible
    const handContainer = document.querySelector('.hand-container');
    const playerHand = document.getElementById('playerHand');
    if (handContainer) {
      handContainer.style.display = 'flex';
      console.log('[Game] Hand container shown');
    }
    if (playerHand) {
      playerHand.style.display = 'flex';
      console.log('[Game] Player hand element shown');
      console.log('[Game] Hand has', game.player?.hand?.length || 0, 'cards');
    }
  }
  if (gameLog) gameLog.style.display = 'block';
  if (endTurnBtn) endTurnBtn.style.display = 'block';
  if (settingsBtn) settingsBtn.classList.remove('hidden');
  if (handCardPreview) handCardPreview.style.display = 'block';

  // Start the game with proper turn
  if (game.player && game.player.hero) {
    log('Game started! Your hero: ' + game.player.hero.name);
  } else {
    console.error('[Game] Player hero not found!', game.player);
    log('Game started!');
  }

  // Update UI to show current state
  updateUI();

  // In multiplayer, don't call startTurn - the server controls turn state
  // The server state has already been applied, so we just need to update UI
  // If it's our turn, the UI will show the end turn button
  console.log('[Game] Current player:', game.currentPlayer);
  if (game.currentPlayer === 'player') {
    console.log('[Game] It is our turn - waiting for player actions');
    // Don't call startTurn in multiplayer - server already started the turn
    // Just log that it's our turn
    log('Your turn begins!', 'player');
  } else {
    console.log('[Game] It is opponent\'s turn - waiting for server updates');
    const enemyName = typeof window.enemyAlias === 'string' ? window.enemyAlias.replace(/^[⚔️\s]+/, '').trim() : (game.enemy?.hero?.name || 'Opponent');
    log(`${enemyName}'s turn...`, 'enemy');
  }
}

function applyServerState(serverState) {
  console.log('[Game] Applying server state, our role:', networkManager?.playerRole);
  console.log('[Game] Server state currentPlayer:', serverState.currentPlayer);
  
  // Check if game board is visible (to prevent animation during initial load)
  const gameBoard = document.querySelector('.game-board');
  const boardVisible = gameBoard && gameBoard.style.display !== 'none' && gameBoard.offsetParent !== null;
  
  // Track previous hand counts and current player to detect card draws
  // IMPORTANT: Track BEFORE mapping server state, so we have the OLD values
  // Use stored previous counts if available, otherwise use current counts
  const prevPlayerHandCount = (game._prevHandCounts?.player !== undefined) ? game._prevHandCounts.player : (game.player?.hand?.length || 0);
  const prevEnemyHandCount = (game._prevHandCounts?.enemy !== undefined) ? game._prevHandCounts.enemy : (game.enemy?.hand?.length || 0);
  const prevCurrentPlayer = game.currentPlayer;
  
  // Also get the server-side hand counts BEFORE mapping to compare
  const serverPlayer1HandCount = serverState.player1?.hand?.length || 0;
  const serverPlayer2HandCount = serverState.player2?.hand?.length || 0;
  
  console.log('[Game] Previous hand counts - Player:', prevPlayerHandCount, ', Enemy:', prevEnemyHandCount, ', Previous currentPlayer:', prevCurrentPlayer);
  console.log('[Game] Server hand counts - player1:', serverPlayer1HandCount, ', player2:', serverPlayer2HandCount);
  
  // Log what's in the server state before mapping
  if (serverState.player1) {
    console.log('[Game] Server player1 hand:', serverState.player1.hand?.map(c => c.name || c.id) || 'NO HAND');
    console.log('[Game] Server player1 hand length:', serverState.player1.hand?.length || 0);
  }
  if (serverState.player2) {
    console.log('[Game] Server player2 hand:', serverState.player2.hand?.map(c => c.name || c.id) || 'NO HAND');
    console.log('[Game] Server player2 hand length:', serverState.player2.hand?.length || 0);
  }
  
  // Map server state to our game state perspective
  // The server sends player1 and player2, we need to map based on our role

  if (!networkManager || !networkManager.playerRole) {
    console.error('[Game] NetworkManager or playerRole not set!');
    return;
  }

  // Log server state before mapping
  console.log('[Game] Server state before mapping - player1 hand size:', serverState.player1?.hand?.length || 0, ', player2 hand size:', serverState.player2?.hand?.length || 0);
  if (serverState.player1?.hand) {
    console.log('[Game] Server player1 hand:', serverState.player1.hand.map(c => `${c.name || c.id}${c.justDrawn ? ' [justDrawn]' : ''}`).join(', '));
  }
  if (serverState.player2?.hand) {
    console.log('[Game] Server player2 hand:', serverState.player2.hand.map(c => `${c.name || c.id}${c.justDrawn ? ' [justDrawn]' : ''}`).join(', '));
  }
  
  if (networkManager.playerRole === 'player1') {
    game.player = JSON.parse(JSON.stringify(serverState.player1));
    game.enemy = JSON.parse(JSON.stringify(serverState.player2));
    console.log('[Game] Mapped as player1 - our hand size:', game.player.hand?.length || 0);
    console.log('[Game] Mapped as player1 - our hand:', game.player.hand?.map(c => `${c.name || c.id}${c.justDrawn ? ' [justDrawn]' : ''}`).join(', ') || 'NO HAND');
    // Set enemy alias from server data
    if (serverState.player2?.username) {
      window.enemyAlias = serverState.player2.username;
      window.enemyFlag = serverState.player2.flag || '⚔️';
      console.log('[Game] Set enemy alias (player1):', window.enemyAlias, 'flag:', window.enemyFlag);
    } else {
      console.warn('[Game] No username found for player2 in serverState:', serverState.player2);
    }
  } else {
    // We're player2, so enemy is player1
    game.player = JSON.parse(JSON.stringify(serverState.player2));
    game.enemy = JSON.parse(JSON.stringify(serverState.player1));
    console.log('[Game] Mapped as player2 - our hand size:', game.player.hand?.length || 0);
    console.log('[Game] Mapped as player2 - our hand:', game.player.hand?.map(c => `${c.name || c.id}${c.justDrawn ? ' [justDrawn]' : ''}`).join(', ') || 'NO HAND');
    // Set enemy alias from server data
    if (serverState.player1?.username) {
      window.enemyAlias = serverState.player1.username;
      window.enemyFlag = serverState.player1.flag || '⚔️';
      console.log('[Game] Set enemy alias (player2):', window.enemyAlias, 'flag:', window.enemyFlag);
    } else {
      console.warn('[Game] No username found for player1 in serverState:', serverState.player1);
    }
  }

  const newCurrentPlayer = (serverState.currentPlayer === networkManager.playerRole) ? 'player' : 'enemy';
  game.currentPlayer = newCurrentPlayer;
  game.turnNumber = serverState.turnNumber;
  
  // Check if cards were drawn (hand count increased)
  const newPlayerHandCount = game.player?.hand?.length || 0;
  const newEnemyHandCount = game.enemy?.hand?.length || 0;
  
  // Determine if turn just started (currentPlayer changed)
  const turnJustStarted = prevCurrentPlayer !== undefined && prevCurrentPlayer !== newCurrentPlayer;
  
  // IMPORTANT: Only store counts AFTER we've checked for animations
  // This ensures we have the correct previous counts for the next update
  // Store current counts for next update (AFTER we've used the previous counts)
  if (!game._prevHandCounts) game._prevHandCounts = {};
  game._prevHandCounts.player = newPlayerHandCount;
  game._prevHandCounts.enemy = newEnemyHandCount;
  
  // Mark newly drawn cards for animation - ALL card draws should animate
  // Both players should see animations:
  // - When it's your turn: you see a card go to your hand
  // - When it's enemy's turn: you see a card go to enemy's hand
  // Check if board is visible to prevent animation during initial load
  
  // Debug: Log what we're seeing
  console.log('[Game] Card draw check - Our role:', networkManager?.playerRole, ', Player hand:', prevPlayerHandCount, '->', newPlayerHandCount, ', Enemy hand:', prevEnemyHandCount, '->', newEnemyHandCount, ', CurrentPlayer:', newCurrentPlayer, ', TurnJustStarted:', turnJustStarted, ', Server currentPlayer:', serverState.currentPlayer);
  
  // At turn start, only ONE player draws a card (the one whose turn it is)
  // So we should only animate ONE hand, based on whose turn it is
  
  // Trust the server's justDrawn flags - don't try to calculate based on hand count differences
  // The server sets justDrawn=true on cards that were actually drawn
  // We only need to clear stale flags if hand count decreased (card played, no draw)
  // OR if hand count stayed the same (no draw, deck empty)
  
  // Clear justDrawn flags only if hand count decreased (card was played, no cards drawn)
  // OR if hand count stayed the same AND no cards have justDrawn flags (no draw happened)
  if (newPlayerHandCount < prevPlayerHandCount && game.player?.hand) {
    // Hand count decreased - card was played but no cards drawn
    // Clear any stale justDrawn flags
    game.player.hand.forEach(card => {
      if (card.justDrawn) {
        delete card.justDrawn;
      }
    });
  } else if (newPlayerHandCount === prevPlayerHandCount && game.player?.hand) {
    // Hand count stayed same - check if any cards have justDrawn flags
    // If no cards have justDrawn, it means no draw happened (deck empty)
    const hasJustDrawnCards = game.player.hand.some(card => card.justDrawn);
    if (!hasJustDrawnCards) {
      // No cards were drawn - clear any stale flags
      game.player.hand.forEach(card => {
        if (card.justDrawn) {
          delete card.justDrawn;
        }
      });
    }
    // If hasJustDrawnCards is true, it means cards were drawn but hand count stayed same
    // (e.g., drew 1 card but played 1 card) - keep the flags
  }
  // If newPlayerHandCount > prevPlayerHandCount, cards were drawn - trust server's justDrawn flags
  
  if (newEnemyHandCount < prevEnemyHandCount && game.enemy?.hand) {
    // Hand count decreased - clear stale flags
    game.enemy.hand.forEach(card => {
      if (card.justDrawn) {
        delete card.justDrawn;
      }
    });
  } else if (newEnemyHandCount === prevEnemyHandCount && game.enemy?.hand) {
    // Hand count stayed same - check if any cards have justDrawn flags
    const hasJustDrawnCards = game.enemy.hand.some(card => card.justDrawn);
    if (!hasJustDrawnCards) {
      // No cards were drawn - clear stale flags
      game.enemy.hand.forEach(card => {
        if (card.justDrawn) {
          delete card.justDrawn;
        }
      });
    }
  }
  
  // Player hand animation - only animate if it's the player's turn
  // This ensures P1 doesn't see cards go to their hand when it's P2's turn
  const playerHasJustDrawnCards = game.player?.hand?.some(card => card.justDrawn) || false;
  const playerHandIncreased = newPlayerHandCount > prevPlayerHandCount;
  
  // Clear justDrawn flags from player hand if it's NOT the player's turn
  // This prevents P1 from seeing cards animate to their hand when it's P2's turn
  if (boardVisible && playerHasJustDrawnCards && newCurrentPlayer !== 'player') {
    console.log('[Game] ✗ Player hand has justDrawn cards but NOT player turn - clearing flags (currentPlayer:', newCurrentPlayer, ')');
    game.player.hand.forEach(card => {
      if (card.justDrawn) {
        delete card.justDrawn;
      }
    });
  }
  
  // Log for debugging
  if (playerHandIncreased && boardVisible && newCurrentPlayer === 'player') {
    const justDrawnCount = game.player?.hand?.filter(card => card.justDrawn).length || 0;
    console.log('[Game] ✓✓✓ Player hand increased on player turn - cards with justDrawn:', justDrawnCount);
  }
  
  // Enemy hand animation - check if enemy's hand has cards with justDrawn flags
  // This happens when it's the enemy's turn and they draw a card
  // OR when enemy draws cards from abilities during their turn
  const enemyHasJustDrawnCards = game.enemy?.hand?.some(card => card.justDrawn) || false;
  const enemyHandIncreased = newEnemyHandCount > prevEnemyHandCount;
  
  console.log('[Game] Enemy hand check - prev:', prevEnemyHandCount, ', new:', newEnemyHandCount, ', increased:', enemyHandIncreased, ', hasJustDrawn:', enemyHasJustDrawnCards, ', boardVisible:', boardVisible, ', currentPlayer:', newCurrentPlayer);
  
  // Set enemyHandJustDrawn if:
  // 1. Enemy hand increased AND board is visible (enemy drew a card)
  // 2. OR enemy hand has cards with justDrawn flags (cards were drawn, maybe hand count stayed same due to card play)
  // BUT only if it's the enemy's turn (so we don't animate when we draw cards)
  if (boardVisible && (enemyHandIncreased || enemyHasJustDrawnCards) && newCurrentPlayer === 'enemy') {
    // Enemy drew a card on their turn - animate to enemy hand
    console.log('[Game] ✓✓✓ Enemy drew a card on their turn - SETTING enemyHandJustDrawn = true');
    game.enemyHandJustDrawn = true;
  } else {
    // Reset flag
    if (game.enemyHandJustDrawn === undefined) {
      game.enemyHandJustDrawn = false;
    } else {
      console.log('[Game] No enemy card draw animation - hand increased:', enemyHandIncreased, ', hasJustDrawn:', enemyHasJustDrawnCards, ', currentPlayer:', newCurrentPlayer);
      game.enemyHandJustDrawn = false;
    }
  }
  
  console.log('[Game] Final enemyHandJustDrawn value:', game.enemyHandJustDrawn);
  
  // Track board changes for card play animations
  const prevPlayerBoardCount = game.player?.board?.length || 0;
  const prevEnemyBoardCount = game.enemy?.board?.length || 0;
  const prevPlayerHand = game.player?.hand || [];
  const prevEnemyHand = game.enemy?.hand || [];
  const newPlayerBoardCount = game.player?.board?.length || 0;
  const newEnemyBoardCount = game.enemy?.board?.length || 0;
  
  // Mark cards that were just played to the board for animation
  if (newPlayerBoardCount > prevPlayerBoardCount && boardVisible) {
    const cardsAdded = newPlayerBoardCount - prevPlayerBoardCount;
    for (let i = game.player.board.length - cardsAdded; i < game.player.board.length; i++) {
      if (game.player.board[i]) {
        game.player.board[i].justPlayed = true;
      }
    }
  }
  
  if (newEnemyBoardCount > prevEnemyBoardCount && boardVisible) {
    const cardsAdded = newEnemyBoardCount - prevEnemyBoardCount;
    for (let i = game.enemy.board.length - cardsAdded; i < game.enemy.board.length; i++) {
      if (game.enemy.board[i]) {
        game.enemy.board[i].justPlayed = true;
      }
    }
  }
  
  // Track ability plays (cards that disappeared from hand and were abilities)
  // Store ability play info for animation
  if (!game.abilityPlays) game.abilityPlays = [];
  
  // Check player's hand for removed ability cards
  const currentPlayerHand = game.player?.hand || [];
  const removedPlayerCards = prevPlayerHand.filter(prevCard => 
    !currentPlayerHand.find(currCard => 
      currCard.id === prevCard.id && (currCard.tier || 1) === (prevCard.tier || 1)
    )
  );
  
  removedPlayerCards.forEach(card => {
    if ((card.type === 'ability' || card.type === 'technique') && boardVisible) {
      // Store ability play info - we'll animate when we know the target
      game.abilityPlays.push({
        card: card,
        owner: 'player',
        timestamp: Date.now()
      });
    }
  });
  
  // Check enemy's hand for removed ability cards
  const currentEnemyHand = game.enemy?.hand || [];
  const removedEnemyCards = prevEnemyHand.filter(prevCard => 
    !currentEnemyHand.find(currCard => 
      currCard.id === prevCard.id && (currCard.tier || 1) === (prevCard.tier || 1)
    )
  );
  
  removedEnemyCards.forEach(card => {
    if ((card.type === 'ability' || card.type === 'technique') && boardVisible) {
      // Store ability play info
      game.abilityPlays.push({
        card: card,
        owner: 'enemy',
        timestamp: Date.now()
      });
    }
  });
  
  // Process game log entries from server (only new entries)
  if (serverState.gameLog && Array.isArray(serverState.gameLog) && serverState.gameLog.length > 0) {
    // Track which log entries we've already processed
    if (!game.processedLogEntries) game.processedLogEntries = new Set();
    
    // Get the last processed log count to only process new entries
    const lastProcessedCount = game.lastProcessedLogCount || 0;
    const newEntries = serverState.gameLog.slice(lastProcessedCount);
    
    newEntries.forEach((logEntry, index) => {
      const logKey = `${logEntry.turn}-${logEntry.message}-${lastProcessedCount + index}`;
      if (logEntry.message && !game.processedLogEntries.has(logKey)) {
        log(logEntry.message, logEntry.type || '');
        game.processedLogEntries.add(logKey);
      }
    });
    
    // Update the count of processed entries
    game.lastProcessedLogCount = serverState.gameLog.length;
  }

  console.log('[Game] Mapped currentPlayer to:', game.currentPlayer);
  console.log('[Game] Player hero:', game.player?.hero?.name);
  console.log('[Game] Enemy hero:', game.enemy?.hero?.name);

  // Initialize UI elements if they don't exist yet
  if (!game.player.equipmentSlots) {
    game.player.equipmentSlots = {
      weapon: null, head: null, chest: null, legs: null,
      shield: null, boots: null, gloves: null, neck: null, back: null
    };
  }
  if (!game.enemy.equipmentSlots) {
    game.enemy.equipmentSlots = {
      weapon: null, head: null, chest: null, legs: null,
      shield: null, boots: null, gloves: null, neck: null, back: null
    };
  }

  // Normalize board units: ensure durability and health are synced
  // Single-player uses durability, server uses health - sync them
  [game.player.board, game.enemy.board].forEach(board => {
    board.forEach(unit => {
      if (unit.durability === undefined && unit.health !== undefined) {
        unit.durability = unit.health;
      } else if (unit.health === undefined && unit.durability !== undefined) {
        unit.health = unit.durability;
      } else if (unit.durability === undefined && unit.health === undefined) {
        // Fallback: use maxHealth or default to 1
        unit.durability = unit.maxHealth || 1;
        unit.health = unit.durability;
      } else {
        // Both exist - keep them in sync (prefer durability as source of truth)
        unit.health = unit.durability;
      }
      
      // CRITICAL FIX: Charge units should always be able to attack when they have charge keyword
      // Fix any charge units that have canAttack: false (server bug workaround)
      if (unit.keywords && unit.keywords.includes('charge')) {
        if (!unit.canAttack) {
          console.log(`[STATE] FIXING: Charge unit ${unit.name} had canAttack=false, setting to true`);
          unit.canAttack = true;
          unit.exhausted = false;
        }
        console.log(`[STATE] Charge unit ${unit.name}: canAttack=${unit.canAttack}, exhausted=${unit.exhausted}, keywords=`, unit.keywords);
      }
      
      // Ensure canAttack and exhausted are initialized if missing
      if (unit.canAttack === undefined) {
        // Default: all units can attack (will be set by server)
        unit.canAttack = true;
      }
      if (unit.exhausted === undefined) {
        // Default: units are not exhausted (will be set by server)
        unit.exhausted = false;
      }
    });
  });

  updateUI();
  
  // Update end turn button state based on whose turn it is (after updateUI)
  const endTurnBtn = document.getElementById('endTurnBtn');
  if (endTurnBtn) {
    if (game.currentPlayer === 'player') {
      endTurnBtn.disabled = false;
      endTurnBtn.style.opacity = '1';
      endTurnBtn.style.cursor = 'pointer';
      endTurnBtn.classList.remove('hidden');
      
      // Check if player has no available moves - highlight green if so
      const hasMoves = hasAvailableMoves('player');
      if (!hasMoves) {
        endTurnBtn.style.background = 'linear-gradient(135deg, #2ecc71 0%, #27ae60 100%)';
        endTurnBtn.style.borderColor = '#2ecc71';
        endTurnBtn.style.boxShadow = '0 8px 25px rgba(46, 204, 113, 0.6), inset 0 2px 8px rgba(255, 255, 255, 0.2)';
      } else {
        // Reset to default red styling
        endTurnBtn.style.background = 'linear-gradient(135deg, #c41e3a 0%, #8b1a1a 100%)';
        endTurnBtn.style.borderColor = '#8b6f47';
        endTurnBtn.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.8), inset 0 2px 8px rgba(255, 215, 0, 0.2)';
      }
    } else {
      endTurnBtn.disabled = true;
      endTurnBtn.style.opacity = '0.5';
      endTurnBtn.style.cursor = 'not-allowed';
      // Reset to default styling when not player's turn
      endTurnBtn.style.background = 'linear-gradient(135deg, #c41e3a 0%, #8b1a1a 100%)';
      endTurnBtn.style.borderColor = '#8b6f47';
      endTurnBtn.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.8), inset 0 2px 8px rgba(255, 215, 0, 0.2)';
      // Don't hide it, just disable it so players can see whose turn it is
    }
  }
  
  // Also update playerEndTurnBtn in applyServerState
  const playerEndTurnBtn = document.getElementById('playerEndTurnBtn');
  if (playerEndTurnBtn) {
    if (game.currentPlayer === 'player') {
      playerEndTurnBtn.disabled = false;
      playerEndTurnBtn.style.opacity = '1';
      playerEndTurnBtn.style.cursor = 'pointer';
      
      // Check if player has no available moves - highlight green if so
      const hasMoves = hasAvailableMoves('player');
      if (!hasMoves) {
        playerEndTurnBtn.style.background = 'linear-gradient(135deg, #2ecc71 0%, #27ae60 100%)';
        playerEndTurnBtn.style.borderColor = '#2ecc71';
        playerEndTurnBtn.style.boxShadow = '0 8px 25px rgba(46, 204, 113, 0.6), inset 0 2px 8px rgba(255, 255, 255, 0.2)';
        playerEndTurnBtn.classList.add('no-moves');
      } else {
        // Reset to default red styling
        playerEndTurnBtn.style.background = 'linear-gradient(135deg, #c41e3a 0%, #8b1a1a 100%)';
        playerEndTurnBtn.style.borderColor = '#8b6f47';
        playerEndTurnBtn.style.boxShadow = 'none';
        playerEndTurnBtn.classList.remove('no-moves');
      }
    } else {
      playerEndTurnBtn.disabled = true;
      playerEndTurnBtn.style.opacity = '0.5';
      playerEndTurnBtn.style.cursor = 'not-allowed';
      // Reset to default styling when not player's turn
      playerEndTurnBtn.style.background = 'linear-gradient(135deg, #c41e3a 0%, #8b1a1a 100%)';
      playerEndTurnBtn.style.borderColor = '#8b6f47';
      playerEndTurnBtn.style.boxShadow = 'none';
      playerEndTurnBtn.classList.remove('no-moves');
    }
  }
  
  console.log('[Game] UI updated, currentPlayer:', game.currentPlayer, 'button disabled:', endTurnBtn?.disabled);
}

// ===== THEME DEFINITIONS (Classic Only) =====
const THEMES = {
    blue: {
        name: 'Blue Classic',
        effect: 'classic',
        cardBg: '#1a2555',
        cardBorder: '#4a7aff',
        containerBg: '#0d1427',
        cardBack: '#1e3a8a'
    },
    red: {
        name: 'Red Classic',
        effect: 'classic',
        cardBg: '#4a1010',
        cardBorder: '#c41e3a',
        containerBg: '#2d0a0a',
        cardBack: '#6b1c1c'
    },
    green: {
        name: 'Green Classic',
        effect: 'classic',
        cardBg: '#1a4a24',
        cardBorder: '#2ecc71',
        containerBg: '#0d2612',
        cardBack: '#1e5631'
    },
    purple: {
        name: 'Purple Classic',
        effect: 'classic',
        cardBg: '#3d1f5c',
        cardBorder: '#9d4edd',
        containerBg: '#1f0f2e',
        cardBack: '#5a2d7d'
    },
    gold: {
        name: 'Gold Classic',
        effect: 'classic',
        cardBg: '#4a4200',
        cardBorder: '#ffd700',
        containerBg: '#2a2800',
        cardBack: '#6b6200'
    }
};

// ===== GAME STATE =====

const game = {
    currentPlayer: 'player',
    turnNumber: 1,
    player: {
        hero: null,
        health: GAME_CONSTANTS.STARTING_HEALTH,
        maxEssence: 0,
        currentEssence: 0,
        heroPowerUsed: false,
        deck: [],
        hand: [],
        board: [],
        weapon: null,
        constructsPlayed: 0
    },
    enemy: {
        hero: null,
        health: GAME_CONSTANTS.STARTING_HEALTH,
        maxEssence: 0,
        currentEssence: 0,
        heroPowerUsed: false,
        deck: [],
        hand: [],
        board: [],
        weapon: null,
        constructsPlayed: 0
    },
    targeting: null,
    tempPowerBuff: 0
};

// ===== UTILITY FUNCTIONS =====

function log(message, type = '') {
    const logArea = document.getElementById('gameLog');
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    
    // Replace player/enemy/opponent with actual usernames
    let logMessage = message;
    if (gameMode === 'multiplayer') {
        // Get player username
        const playerName = typeof window.playerAlias === 'string' ? window.playerAlias.replace(/^[⚔️\s]+/, '').trim() : 'Player';
        // Get enemy name - try multiple sources
        let enemyName = typeof window.enemyAlias === 'string' ? window.enemyAlias.replace(/^[⚔️\s]+/, '').trim() : null;
        if (!enemyName && game.enemy && game.enemy.hero) {
            // Fallback to hero name if alias not available
            enemyName = game.enemy.hero.name;
        }
        if (!enemyName) {
            enemyName = 'Opponent'; // Last resort fallback
        }
        
        // Replace common patterns - be more aggressive with replacements
        logMessage = logMessage.replace(/\bplayer\b/gi, playerName);
        logMessage = logMessage.replace(/\benemy\b/gi, enemyName);
        logMessage = logMessage.replace(/\bopponent\b/gi, enemyName);
        logMessage = logMessage.replace(/\bOpponent\b/g, enemyName);
    }
    
    entry.textContent = `Turn ${game.turnNumber}: ${logMessage}`;
    logArea.appendChild(entry);
    logArea.scrollTop = logArea.scrollHeight;
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

async function getUserDeckConfig(heroUnitType) {
    // Check if user is logged in
    const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
    const userData = sessionStorage.getItem('userData');
    const token = localStorage.getItem('token');

    if (!isLoggedIn || !userData || !token) {
        return []; // Return empty array (no exclusions) for guests
    }

    try {
        const user = JSON.parse(userData);
        const response = await fetch(`/api/deck/${user.userId}/${heroUnitType}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                return data.deck.excludedCards || [];
            }
        }
    } catch (error) {
        console.error('Error loading deck config:', error);
    }

    return []; // Return empty array on error
}

function createDeck(heroUnitType = null, excludedCards = []) {
    const deck = [];
    // Ensure CARD_DATABASE is available
    const cardDatabase = typeof CARD_DATABASE !== 'undefined' ? CARD_DATABASE : 
                   (typeof window.CARD_DATABASE !== 'undefined' ? window.CARD_DATABASE : null);
    
    if (!cardDatabase) {
        console.error('CARD_DATABASE not found!', typeof CARD_DATABASE, typeof window.CARD_DATABASE);
        return deck;
    }

    // Create a balanced deck with units, abilities, and equipment
    const deckList = [];
    
    // ===== REBALANCED DEFAULT DECKS WITH ALL NEW CARDS =====
    
    if (heroUnitType === 'ranged') {
        // RANGED HERO DECK - Balanced 60 cards
        // Units (Bannerman) - 24 cards total
        deckList.push(
            'skirmisher', 'skirmisher', 'skirmisher', 'skirmisher', // 4x Low cost (1)
            'archer', 'archer', 'archer', 'archer', 'archer', 'archer', // 6x Low cost (2)
            'crossbow', 'crossbow', 'crossbow', 'crossbow', // 4x Mid cost (3)
            'scout', 'scout', 'scout', // 3x Mid cost with draw (3)
            'longbowman', 'longbowman', // 2x Mid cost (4)
            'ranger', // 1x Mid cost utility (4)
            'watchTower', // 1x Epic defensive (4)
            'masterArcher', // 1x High cost (5)
            'siegeMaster' // 1x High cost AOE (6)
        );
        
        // Abilities - 20 cards total
        deckList.push(
            'quickShot', 'quickShot', 'quickShot', 'quickShot', 'quickShot', // 5x Low cost (1)
            'aimedShot', 'aimedShot', 'aimedShot', 'aimedShot', // 4x Mid cost (3)
            'rangersMark', 'rangersMark', // 2x Buff (2)
            'launchNet', 'launchNet', // 2x Control (2)
            'masterShot', // 1x High cost (4)
            'quiverRefill', 'quiverRefill', 'quiverRefill', // 3x Draw (3)
            'bowEnchantment', // 1x Enchantment (4)
            'volley', // 1x High cost AOE (5)
            'precisionStrike' // 1x High cost targeted (6)
        );
        
        // Equipment - 8 cards total
        deckList.push(
            'bow', 'bow', 'bow', 'bow', // 4x Weapons (max)
            'clothCoif', 'paddedClothArmor', 'paddedClothChaps', 'rangerBoots' // 4x Armor (1 each)
        );
        
        // Siege - 6 cards total
        deckList.push(
            'ballista', 'ballista', 'ballista', // 3x (max)
            'catapult', 'catapult', 'catapult' // 3x (max)
        );
        
        // Universal abilities - 2 cards
        deckList.push(
            'reinforcements', // 1x Draw (5)
            'tacticalRetreat' // 1x Utility (4)
        );
        
    } else if (heroUnitType === 'infantry') {
        // INFANTRY HERO DECK - Balanced 60 cards
        // Units (Bannerman) - 24 cards total
        deckList.push(
            'footman', 'footman', 'footman', 'footman', 'footman', 'footman', // 6x Low cost (2)
            'swordsman', 'swordsman', 'swordsman', 'swordsman', 'swordsman', // 5x Mid cost (3)
            'sergeant', 'sergeant', 'sergeant', // 3x Mid cost with draw (3)
            'knight', 'knight', 'knight', // 3x High cost (4)
            'battleMedic', 'battleMedic', // 2x Epic utility (3)
            'eliteGuard', // 1x Mid cost heal (5)
            'champion', // 1x High cost (5)
            'fortressGuard', // 1x High cost defensive (6)
            'warGeneral' // 1x Legendary aura (7)
        );
        
        // Abilities - 20 cards total
        deckList.push(
            'quickStrike', 'quickStrike', 'quickStrike', 'quickStrike', 'quickStrike', // 5x Low cost (1)
            'focusStrike', 'focusStrike', 'focusStrike', 'focusStrike', // 4x Mid cost (3)
            'shieldWall', 'shieldWall', 'shieldWall', // 3x Buff (2)
            'disarm', 'disarm', // 2x Equipment removal (3)
            'supplyLine', 'supplyLine', 'supplyLine', // 3x Draw (3)
            'swordEnchantment', // 1x Enchantment (4)
            'battleCry', // 1x High cost mass buff (5)
            'lastStand' // 1x High cost survival (6)
        );
        
        // Equipment - 8 cards total
        deckList.push(
            'sword', 'sword', 'sword', 'sword', // 4x Weapons (max)
            'plateHelmet', 'plateBody', 'plateLegs', 'kiteShield' // 4x Armor (1 each)
        );
        
        // Siege - 6 cards total
        deckList.push(
            'ballista', 'ballista', 'ballista', // 3x (max)
            'catapult', 'catapult', 'catapult' // 3x (max)
        );
        
        // Universal abilities - 2 cards
        deckList.push(
            'reinforcements', // 1x Draw (5)
            'tacticalRetreat' // 1x Utility (4)
        );
        
    } else if (heroUnitType === 'cavalry') {
        // CAVALRY HERO DECK - Balanced 60 cards
        // Units (Bannerman) - 24 cards total
        deckList.push(
            'horseman', 'horseman', 'horseman', 'horseman', 'horseman', 'horseman', // 6x Low cost (2)
            'camelRider', 'camelRider', 'camelRider', 'camelRider', 'camelRider', // 5x Mid cost (3)
            'messenger', 'messenger', 'messenger', // 3x Mid cost with draw (3)
            'mountedKnight', 'mountedKnight', 'mountedKnight', // 3x High cost (4)
            'lightCavalry', 'lightCavalry', // 2x Low cost utility (2)
            'dragoon', 'dragoon', // 2x Mid cost (4)
            'heavyCavalry', // 1x High cost AOE (5)
            'cavalryCommander' // 1x High cost draw (6)
        );
        
        // Abilities - 20 cards total
        deckList.push(
            'quickCharge', 'quickCharge', 'quickCharge', 'quickCharge', 'quickCharge', // 5x Low cost (1)
            'focusCharge', 'focusCharge', 'focusCharge', 'focusCharge', // 4x Mid cost (3)
            'cavalryFormation', 'cavalryFormation', 'cavalryFormation', // 3x Buff (2)
            'sabotage', 'sabotage', // 2x Equipment removal (3)
            'courierNetwork', 'courierNetwork', 'courierNetwork', // 3x Draw (3)
            'axeEnchantment', // 1x Enchantment (4)
            'cavalryCharge', // 1x High cost mass buff (5)
            'flankingManeuver' // 1x High cost utility (6)
        );
        
        // Equipment - 8 cards total
        deckList.push(
            'axe', 'axe', 'axe', 'axe', // 4x Weapons (max)
            'leatherCap', 'leatherArmor', 'leatherLeggings', 'leatherShield' // 4x Armor (1 each)
        );
        
        // Siege - 6 cards total
        deckList.push(
            'ballista', 'ballista', 'ballista', // 3x (max)
            'catapult', 'catapult', 'catapult' // 3x (max)
        );
        
        // Universal abilities - 2 cards
        deckList.push(
            'reinforcements', // 1x Draw (5)
            'tacticalRetreat' // 1x Utility (4)
        );
        
    } else {
        // Default mix (equal distribution) - 60 cards
        deckList.push(
            // Ranged units
            'archer', 'archer', 'crossbow', 'skirmisher', 'scout',
            // Infantry units
            'footman', 'footman', 'swordsman', 'swordsman', 'knight',
            // Cavalry units
            'horseman', 'horseman', 'camelRider', 'mountedKnight',
            // Abilities
            'quickShot', 'aimedShot', 'quickStrike', 'focusStrike', 'quickCharge', 'focusCharge',
            // Equipment
            'bow', 'sword', 'axe',
            'clothCoif', 'paddedClothArmor', 'plateHelmet', 'plateBody', 'leatherCap', 'leatherArmor',
            // Siege
            'ballista', 'ballista', 'catapult', 'catapult'
        );
    }
    
    // Filter out excluded cards
    const filteredDeckList = deckList.filter(cardId => !excludedCards.includes(cardId));
    
    // Fill to 60 cards if needed (should already be 60, but safety check)
    if (filteredDeckList.length < 60) {
        const fillCards = {
            'ranged': ['archer', 'skirmisher', 'quickShot'],
            'infantry': ['footman', 'swordsman', 'quickStrike'],
            'cavalry': ['horseman', 'camelRider', 'quickCharge']
        };
        const fillSet = (fillCards[heroUnitType] || ['archer', 'footman', 'horseman']).filter(cardId => !excludedCards.includes(cardId));
        
        while (filteredDeckList.length < 60 && fillSet.length > 0) {
            filteredDeckList.push(...fillSet);
        }
    }
    
    filteredDeckList.length = Math.min(60, filteredDeckList.length); // Ensure exactly 60 cards

    filteredDeckList.forEach(cardId => {
        const cardData = cardDatabase[cardId];
        if (cardData) {
            // Deep copy
            const cardCopy = { ...cardData };
            deck.push(cardCopy);
        } else {
            console.warn('Card not found in database:', cardId);
        }
    });

    return shuffleArray(deck);
}

function drawCard(player) {
    const playerData = player === 'player' ? game.player : game.enemy;
    if (playerData.deck.length === 0) {
        log(`${player} has no cards left to draw!`, player);
        return null;
    }

    const card = playerData.deck.pop();
    card.justDrawn = true; // Mark for animation
    playerData.hand.push(card);
    log(`${player} drew a card`, player);

    // Play card draw sound
    if (player === 'player' && SoundManager) {
        SoundManager.playCardDraw();
    }

    updateUI();
    return card;
}

// ===== SOUND SYSTEM =====
const SoundManager = {
    audioContext: null,
    soundsEnabled: true,
    cardDrawEnabled: true,
    attackEnabled: true,
    deathEnabled: true,
    
    init() {
        // Check if sounds are enabled
        this.soundsEnabled = localStorage.getItem('settingSoundEffects') !== 'false';
        this.cardDrawEnabled = localStorage.getItem('settingCardDrawSound') !== 'false';
        this.attackEnabled = localStorage.getItem('settingAttackSound') !== 'false';
        this.deathEnabled = localStorage.getItem('settingDeathSound') !== 'false';
        
        // Initialize Web Audio API context (lazy initialization)
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Web Audio API not supported:', e);
        }
    },
    
    playSound(frequency, duration, type = 'sine', volume = 0.1) {
        if (!this.soundsEnabled || !this.audioContext) return;
        
        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.frequency.value = frequency;
            oscillator.type = type;
            
            gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + duration);
        } catch (e) {
            console.warn('Error playing sound:', e);
        }
    },
    
    playCardDraw() {
        if (!this.cardDrawEnabled) return;
        // Short, pleasant sound for card draw
        this.playSound(440, 0.1, 'sine', 0.15);
    },
    
    playAttack() {
        if (!this.attackEnabled) return;
        // Sharp attack sound
        this.playSound(600, 0.15, 'square', 0.2);
    },
    
    playDeath() {
        if (!this.deathEnabled) return;
        // Lower, sad sound for death
        this.playSound(200, 0.2, 'sawtooth', 0.15);
    },
    
    playVictory() {
        if (!this.soundsEnabled) return;
        // Victory fanfare (ascending notes)
        const notes = [440, 554, 659, 880];
        notes.forEach((freq, i) => {
            setTimeout(() => {
                this.playSound(freq, 0.2, 'sine', 0.2);
            }, i * 150);
        });
    },
    
    playDefeat() {
        if (!this.soundsEnabled) return;
        // Defeat sound (descending notes)
        const notes = [440, 370, 330, 247];
        notes.forEach((freq, i) => {
            setTimeout(() => {
                this.playSound(freq, 0.25, 'sawtooth', 0.15);
            }, i * 200);
        });
    },
    
    updateSettings() {
        this.soundsEnabled = localStorage.getItem('settingSoundEffects') !== 'false';
        this.cardDrawEnabled = localStorage.getItem('settingCardDrawSound') !== 'false';
        this.attackEnabled = localStorage.getItem('settingAttackSound') !== 'false';
        this.deathEnabled = localStorage.getItem('settingDeathSound') !== 'false';
    }
};

// Update sound settings when saveSettings is called
const originalSaveSettings = window.saveSettings;
if (typeof window.saveSettings === 'function') {
    window.saveSettings = function() {
        if (originalSaveSettings) originalSaveSettings();
        if (SoundManager) SoundManager.updateSettings();
    };
}

// Initialize sound manager
SoundManager.init();
window.SoundManager = SoundManager;

// ===== GAME INITIALIZATION =====

// Main Menu Functions
// Default selections
window.selectedTheme = 'blue'; // Default to Blue Classic theme

// All world flags
const WORLD_FLAGS = [
    '🇦🇫 Afghanistan', '🇦🇱 Albania', '🇩🇿 Algeria', '🇦🇩 Andorra', '🇦🇴 Angola', '🇦🇬 Antigua & Barbuda', '🇦🇷 Argentina', '🇦🇲 Armenia', '🇦🇺 Australia', '🇦🇹 Austria',
    '🇦🇿 Azerbaijan', '🇧🇸 Bahamas', '🇧🇭 Bahrain', '🇧🇩 Bangladesh', '🇧🇧 Barbados', '🇧🇪 Belgium', '🇧🇿 Belize', '🇧🇯 Benin', '🇧🇹 Bhutan', '🇧🇴 Bolivia',
    '🇧🇦 Bosnia', '🇧🇼 Botswana', '🇧🇷 Brazil', '🇧🇳 Brunei', '🇧🇬 Bulgaria', '🇧🇫 Burkina Faso', '🇧🇮 Burundi', '🇰🇭 Cambodia', '🇨🇲 Cameroon', '🇨🇦 Canada',
    '🇨🇻 Cape Verde', '🇨🇫 Central African Rep', '🇹🇩 Chad', '🇨🇱 Chile', '🇨🇳 China', '🇨🇴 Colombia', '🇰🇲 Comoros', '🇨🇬 Congo', '🇨🇷 Costa Rica', '🇭🇷 Croatia',
    '🇨🇺 Cuba', '🇨🇾 Cyprus', '🇨🇿 Czech Republic', '🇩🇰 Denmark', '🇩🇯 Djibouti', '🇩🇲 Dominica', '🇩🇴 Dominican Republic', '🇪🇨 Ecuador', '🇪🇬 Egypt', '🇸🇻 El Salvador',
    '🇬🇶 Equatorial Guinea', '🇪🇷 Eritrea', '🇪🇪 Estonia', '🇪🇹 Ethiopia', '🇫🇯 Fiji', '🇫🇮 Finland', '🇫🇷 France', '🇬🇦 Gabon', '🇬🇲 Gambia', '🇬🇪 Georgia',
    '🇩🇪 Germany', '🇬🇭 Ghana', '🇬🇷 Greece', '🇬🇩 Grenada', '🇬🇹 Guatemala', '🇬🇬 Guernsey', '🇬🇳 Guinea', '🇬🇼 Guinea-Bissau', '🇬🇾 Guyana', '🇭🇹 Haiti',
    '🇭🇳 Honduras', '🇭🇰 Hong Kong', '🇭🇺 Hungary', '🇮🇸 Iceland', '🇮🇳 India', '🇮🇩 Indonesia', '🇮🇷 Iran', '🇮🇶 Iraq', '🇮🇪 Ireland', '🇮🇲 Isle of Man',
    '🇮🇱 Israel', '🇮🇹 Italy', '🇨🇮 Ivory Coast', '🇯🇲 Jamaica', '🇯🇵 Japan', '🇯🇪 Jersey', '🇯🇴 Jordan', '🇰🇿 Kazakhstan', '🇰🇪 Kenya', '🇰🇮 Kiribati',
    '🇰🇵 North Korea', '🇰🇷 South Korea', '🇰🇼 Kuwait', '🇰🇬 Kyrgyzstan', '🇱🇦 Laos', '🇱🇻 Latvia', '🇱🇧 Lebanon', '🇱🇸 Lesotho', '🇱🇷 Liberia', '🇱🇾 Libya',
    '🇱🇮 Liechtenstein', '🇱🇹 Lithuania', '🇱🇺 Luxembourg', '🇲🇴 Macau', '🇲🇬 Madagascar', '🇲🇼 Malawi', '🇲🇾 Malaysia', '🇲🇻 Maldives', '🇲🇱 Mali', '🇲🇹 Malta',
    '🇲🇭 Marshall Islands', '🇲🇶 Martinique', '🇲🇷 Mauritania', '🇲🇺 Mauritius', '🇲🇽 Mexico', '🇫🇲 Micronesia', '🇲🇩 Moldova', '🇲🇨 Monaco', '🇲🇳 Mongolia', '🇲🇪 Montenegro',
    '🇲🇦 Morocco', '🇲🇿 Mozambique', '🇲🇲 Myanmar', '🇳🇦 Namibia', '🇳🇷 Nauru', '🇳🇵 Nepal', '🇳🇱 Netherlands', '🇳🇿 New Zealand', '🇳🇮 Nicaragua', '🇳🇪 Niger',
    '🇳🇬 Nigeria', '🇳🇴 Norway', '🇴🇲 Oman', '🇵🇰 Pakistan', '🇵🇼 Palau', '🇵🇦 Panama', '🇵🇬 Papua New Guinea', '🇵🇾 Paraguay', '🇵🇪 Peru', '🇵🇭 Philippines',
    '🇵🇱 Poland', '🇵🇹 Portugal', '🇶🇦 Qatar', '🇷🇪 Reunion', '🇷🇴 Romania', '🇷🇺 Russia', '🇷🇼 Rwanda', '🇰🇳 Saint Kitts', '🇱🇨 Saint Lucia', '🇻🇨 Saint Vincent',
    '🇼🇸 Samoa', '🇸🇲 San Marino', '🇸🇹 Sao Tome', '🇸🇦 Saudi Arabia', '🇸🇳 Senegal', '🇷🇸 Serbia', '🇸🇨 Seychelles', '🇸🇱 Sierra Leone', '🇸🇬 Singapore', '🇸🇰 Slovakia',
    '🇸🇮 Slovenia', '🇸🇧 Solomon Islands', '🇸🇴 Somalia', '🇿🇦 South Africa', '🇪🇸 Spain', '🇱🇰 Sri Lanka', '🇸🇩 Sudan', '🇸🇷 Suriname', '🇸🇿 Eswatini', '🇸🇪 Sweden',
    '🇨🇭 Switzerland', '🇸🇾 Syria', '🇹🇼 Taiwan', '🇹🇯 Tajikistan', '🇹🇿 Tanzania', '🇹🇭 Thailand', '🇹🇱 Timor-Leste', '🇹🇬 Togo', '🇹🇴 Tonga', '🇹🇹 Trinidad & Tobago',
    '🇹🇳 Tunisia', '🇹🇷 Turkey', '🇹🇲 Turkmenistan', '🇹🇻 Tuvalu', '🇺🇬 Uganda', '🇺🇦 Ukraine', '🇦🇪 UAE', '🇬🇧 UK', '🇺🇸 USA', '🇺🇾 Uruguay',
    '🇺🇿 Uzbekistan', '🇻🇺 Vanuatu', '🇻🇦 Vatican', '🇻🇪 Venezuela', '🇻🇳 Vietnam', '🇪🇭 Western Sahara', '🇾🇪 Yemen', '🇿🇲 Zambia', '🇿🇼 Zimbabwe', '⚔️ Neutral'
];

function initializeFlagSelector() {
    const flagSelect = document.getElementById('playerFlagSelect');
    const flagDisplay = document.getElementById('flagDisplay');
    if (flagSelect) {
        flagSelect.innerHTML = '';
        WORLD_FLAGS.forEach(flag => {
            const option = document.createElement('option');
            const parts = flag.split(' ');
            const emoji = parts[0]; // Get just the emoji
            const countryName = parts.slice(1).join(' '); // Get country name
            option.value = emoji;
            option.textContent = `${emoji} ${countryName}`; // Show both in dropdown
            flagSelect.appendChild(option);
        });
        flagSelect.value = '🇺🇸'; // Default to USA
        if (flagDisplay) {
            flagDisplay.textContent = '🇺🇸';
        }
        
        // Update display when selection changes
        flagSelect.addEventListener('change', function() {
            if (flagDisplay) {
                flagDisplay.textContent = this.value;
            }
        });
    }
}

function openThemeSelector() {
    const modal = document.getElementById('themeSelectorModal');
    const overlay = document.getElementById('modalOverlay');
    if (modal) {
        modal.style.display = 'block';
        if (overlay) overlay.style.display = 'block';
        populateThemeTable();
    }
}

function closeThemeSelector() {
    const modal = document.getElementById('themeSelectorModal');
    const overlay = document.getElementById('modalOverlay');
    if (modal) {
        modal.style.display = 'none';
        if (overlay) overlay.style.display = 'none';
    }
}

function openSettingsMenu() {
    const modal = document.getElementById('settingsModal');
    const overlay = document.getElementById('modalOverlay');
    if (modal) {
        modal.style.display = 'block';
        if (overlay) overlay.style.display = 'block';
        
        // Load saved settings from localStorage
        const settings = {
            soundEffects: localStorage.getItem('settingSoundEffects') !== 'false',
            cardDrawSound: localStorage.getItem('settingCardDrawSound') !== 'false',
            attackSound: localStorage.getItem('settingAttackSound') !== 'false',
            deathSound: localStorage.getItem('settingDeathSound') !== 'false',
            reduceAnimations: localStorage.getItem('settingReduceAnimations') === 'true',
            disableEffects: localStorage.getItem('settingDisableEffects') === 'true'
        };
        
        const soundEffectsEl = document.getElementById('settingSoundEffects');
        const cardDrawSoundEl = document.getElementById('settingCardDrawSound');
        const attackSoundEl = document.getElementById('settingAttackSound');
        const deathSoundEl = document.getElementById('settingDeathSound');
        const reduceAnimationsEl = document.getElementById('settingReduceAnimations');
        const disableEffectsEl = document.getElementById('settingDisableEffects');
        
        if (soundEffectsEl) soundEffectsEl.checked = settings.soundEffects;
        if (cardDrawSoundEl) cardDrawSoundEl.checked = settings.cardDrawSound;
        if (attackSoundEl) attackSoundEl.checked = settings.attackSound;
        if (deathSoundEl) deathSoundEl.checked = settings.deathSound;
        if (reduceAnimationsEl) reduceAnimationsEl.checked = settings.reduceAnimations;
        if (disableEffectsEl) disableEffectsEl.checked = settings.disableEffects;
    }
}

function closeSettingsMenu() {
    const modal = document.getElementById('settingsModal');
    const overlay = document.getElementById('modalOverlay');
    if (modal) {
        modal.style.display = 'none';
        if (overlay) overlay.style.display = 'none';
    }
}

function closeSettingsModal() {
    closeSettingsMenu(); // Alias for consistency
}

function saveSettings() {
    const soundEffectsEl = document.getElementById('settingSoundEffects');
    const cardDrawSoundEl = document.getElementById('settingCardDrawSound');
    const attackSoundEl = document.getElementById('settingAttackSound');
    const deathSoundEl = document.getElementById('settingDeathSound');
    const reduceAnimationsEl = document.getElementById('settingReduceAnimations');
    const disableEffectsEl = document.getElementById('settingDisableEffects');
    
    if (!soundEffectsEl || !cardDrawSoundEl || !attackSoundEl || !deathSoundEl || !reduceAnimationsEl || !disableEffectsEl) {
        alert('Settings form not found');
        return;
    }
    
    const settings = {
        soundEffects: soundEffectsEl.checked,
        cardDrawSound: cardDrawSoundEl.checked,
        attackSound: attackSoundEl.checked,
        deathSound: deathSoundEl.checked,
        reduceAnimations: reduceAnimationsEl.checked,
        disableEffects: disableEffectsEl.checked
    };
    
    // Save to localStorage
    localStorage.setItem('settingSoundEffects', settings.soundEffects);
    localStorage.setItem('settingCardDrawSound', settings.cardDrawSound);
    localStorage.setItem('settingAttackSound', settings.attackSound);
    localStorage.setItem('settingDeathSound', settings.deathSound);
    localStorage.setItem('settingReduceAnimations', settings.reduceAnimations);
    localStorage.setItem('settingDisableEffects', settings.disableEffects);
    
    // Update sound manager settings
    if (SoundManager) {
        SoundManager.updateSettings();
    }
    
    // Apply visual settings immediately
    if (settings.disableEffects) {
        document.body.classList.add('no-effects');
    } else {
        document.body.classList.remove('no-effects');
    }
    
    if (settings.reduceAnimations) {
        document.body.classList.add('reduce-animations');
    } else {
        document.body.classList.remove('reduce-animations');
    }
    
    // Show confirmation
    alert('Settings saved!');
    closeSettingsMenu();
}

function concedeGame() {
    if (gameMode === 'multiplayer' && socket && socket.connected) {
        // Multiplayer: emit concede event
        socket.emit('concede');
    } else {
        // Single-player: just set health to 0
        game.player.health = 0;
        checkWinCondition();
    }
}

function returnToMainMenuFromGame() {
    returnToMainMenu();
}

function populateThemeTable() {
    const tbody = document.getElementById('themeTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    Object.entries(THEMES).forEach(([key, theme]) => {
        const row = document.createElement('tr');
        row.style.borderBottom = '1px solid #8b6f47';

        // Preview cell
        const previewCell = document.createElement('td');
        previewCell.style.padding = '4px 3px';
        previewCell.style.border = '1px solid #8b6f47';
        previewCell.style.textAlign = 'center';
        const previewBox = document.createElement('div');
        previewBox.style.width = '35px';
        previewBox.style.height = '25px';
        previewBox.style.backgroundColor = theme.cardBg;
        previewBox.style.border = `2px solid ${theme.cardBorder}`;
        previewBox.style.borderRadius = '4px';
        previewBox.style.margin = '0 auto';
        previewCell.appendChild(previewBox);

        // Name cell
        const nameCell = document.createElement('td');
        nameCell.style.padding = '4px 6px';
        nameCell.style.border = '1px solid #8b6f47';
        nameCell.style.color = '#f4e4c1';
        nameCell.style.fontWeight = 'bold';
        nameCell.style.fontSize = '12px';
        nameCell.textContent = theme.name;

        // Select button cell
        const selectCell = document.createElement('td');
        selectCell.style.padding = '4px 3px';
        selectCell.style.border = '1px solid #8b6f47';
        selectCell.style.textAlign = 'center';
        const selectBtn = document.createElement('button');
        selectBtn.textContent = 'Select';
        selectBtn.style.padding = '4px 12px';
        selectBtn.style.backgroundColor = theme.cardBg;
        selectBtn.style.border = `1px solid ${theme.cardBorder}`;
        selectBtn.style.color = '#f4e4c1';
        selectBtn.style.cursor = 'pointer';
        selectBtn.style.borderRadius = '3px';
        selectBtn.style.fontWeight = 'bold';
        selectBtn.style.fontSize = '10px';
        selectBtn.onclick = () => selectTheme(key);
        selectCell.appendChild(selectBtn);

        row.appendChild(previewCell);
        row.appendChild(nameCell);
        row.appendChild(selectCell);
        tbody.appendChild(row);
    });
}

function selectTheme(themeKey) {
    window.selectedTheme = themeKey;

    // Update theme box color
    const themeBox = document.getElementById('themeBoxBtn');
    if (themeBox && THEMES[themeKey]) {
        themeBox.style.backgroundColor = THEMES[themeKey].cardBg;
        themeBox.style.borderColor = THEMES[themeKey].cardBorder;
    }

    closeThemeSelector();
    
    // Only update theme styles, don't call full updateUI() which updates game board
    // Check if a game is actually active before updating game board elements
    const isGameActive = game && game.player && game.player.hero;
    
    if (isGameActive) {
        // Game is active, update UI normally (this will apply theme to game board)
        updateUI();
    } else {
        // No game active, just update theme classes on body
        // Don't touch game board elements
        const theme = THEMES[themeKey];
        if (theme && theme.effect) {
            document.body.classList.remove('theme-classic', 'theme-bubbles', 'theme-hearts', 'theme-sparkles', 'theme-flames');
            document.body.classList.add(`theme-${theme.effect}`);
        }
    }
}

function startSinglePlayer() {
    // Set game mode to singleplayer
    gameMode = 'singleplayer';
    setGameMode('singleplayer');
    
    let playerName = document.getElementById('playerNameInput').value.trim();

    // If no name entered, check if user is logged in and use their username
    if (!playerName) {
        const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
        if (isLoggedIn) {
            try {
                const userData = JSON.parse(sessionStorage.getItem('userData'));
                if (userData && userData.username) {
                    playerName = userData.username;
                    // Update the input field too
                    const playerNameInput = document.getElementById('playerNameInput');
                    if (playerNameInput) {
                        playerNameInput.value = userData.username;
                    }
                }
            } catch (e) {
                console.error('Error reading userData:', e);
            }
        }
        
        // If still no name, generate random anonymous name
        if (!playerName) {
            const randomNum = Math.floor(Math.random() * 999) + 1; // 1-999
            playerName = `Anon${String(randomNum).padStart(3, '0')}`; // Anon001-Anon999
        }
    }

    // Get selected flag
    const playerFlagSelect = document.getElementById('playerFlagSelect');
    const playerFlag = playerFlagSelect ? playerFlagSelect.value : '🇺🇸';

    window.playerAlias = playerName;
    window.playerFlag = playerFlag;
    window.pendingPlayerName = playerName; // Store for later use

    // selectedColor and selectedTheme are already set by selectColor() and selectTheme()

    // Hide main menu, show multiplayer hero selection (same as multiplayer)
    const mainMenu = document.getElementById('mainMenuModal');
    const overlay = document.getElementById('modalOverlay');
    if (mainMenu) mainMenu.style.display = 'none';
    if (overlay) overlay.style.display = 'block'; // Keep overlay visible

    // Use the same hero selection as multiplayer
    showMultiplayerHeroSelection();
}

function switchGuideTab(tab) {
    // Hide all content
    document.getElementById('guideRulesContent').style.display = 'none';
    document.getElementById('guideKeywordsContent').style.display = 'none';
    document.getElementById('guideFAQContent').style.display = 'none';
    const bugReportContent = document.getElementById('guideBugReportContent');
    if (bugReportContent) bugReportContent.style.display = 'none';
    
    // Reset all tab buttons
    document.getElementById('guideTabRules').style.background = 'rgba(139, 111, 71, 0.3)';
    document.getElementById('guideTabRules').style.border = '2px solid #8b6f47';
    document.getElementById('guideTabRules').style.fontWeight = 'normal';
    document.getElementById('guideTabKeywords').style.background = 'rgba(139, 111, 71, 0.3)';
    document.getElementById('guideTabKeywords').style.border = '2px solid #8b6f47';
    document.getElementById('guideTabKeywords').style.fontWeight = 'normal';
    document.getElementById('guideTabFAQ').style.background = 'rgba(139, 111, 71, 0.3)';
    document.getElementById('guideTabFAQ').style.border = '2px solid #8b6f47';
    document.getElementById('guideTabFAQ').style.fontWeight = 'normal';
    const bugReportTab = document.getElementById('guideTabBugReport');
    if (bugReportTab) {
        bugReportTab.style.background = 'rgba(139, 111, 71, 0.3)';
        bugReportTab.style.border = '2px solid #8b6f47';
        bugReportTab.style.fontWeight = 'normal';
    }
    
    // Show selected content and highlight tab
    if (tab === 'rules') {
        document.getElementById('guideRulesContent').style.display = 'block';
        document.getElementById('guideTabRules').style.background = 'linear-gradient(135deg, #8b7355 0%, #6b5344 100%)';
        document.getElementById('guideTabRules').style.border = '2px solid #d4af37';
        document.getElementById('guideTabRules').style.fontWeight = 'bold';
    } else if (tab === 'keywords') {
        document.getElementById('guideKeywordsContent').style.display = 'block';
        document.getElementById('guideTabKeywords').style.background = 'linear-gradient(135deg, #8b7355 0%, #6b5344 100%)';
        document.getElementById('guideTabKeywords').style.border = '2px solid #d4af37';
        document.getElementById('guideTabKeywords').style.fontWeight = 'bold';
    } else if (tab === 'faq') {
        document.getElementById('guideFAQContent').style.display = 'block';
        document.getElementById('guideTabFAQ').style.background = 'linear-gradient(135deg, #8b7355 0%, #6b5344 100%)';
        document.getElementById('guideTabFAQ').style.border = '2px solid #d4af37';
        document.getElementById('guideTabFAQ').style.fontWeight = 'bold';
    } else if (tab === 'bugreport') {
        if (bugReportContent) bugReportContent.style.display = 'block';
        if (bugReportTab) {
            bugReportTab.style.background = 'linear-gradient(135deg, #8b7355 0%, #6b5344 100%)';
            bugReportTab.style.border = '2px solid #d4af37';
            bugReportTab.style.fontWeight = 'bold';
        }
    }
}

function showGameInstructions() {
    const instructionsModal = document.getElementById('instructionsModal');
    switchGuideTab('rules'); // Default to rules tab
    const mainMenu = document.getElementById('mainMenuModal');
    const overlay = document.getElementById('modalOverlay');
    if (mainMenu) mainMenu.style.display = 'none';
    if (instructionsModal) instructionsModal.style.display = 'block';
    if (overlay) overlay.style.display = 'block'; // Keep overlay visible
}

function closeinstructionsModal() {
    const instructionsModal = document.getElementById('instructionsModal');
    const mainMenu = document.getElementById('mainMenuModal');
    const overlay = document.getElementById('modalOverlay');
    if (instructionsModal) instructionsModal.style.display = 'none';
    if (mainMenu) mainMenu.style.display = 'block';
    if (overlay) overlay.style.display = 'block'; // Keep overlay visible
}

function changeLanguage() {
    alert('Language selection coming soon! Currently English only.');
}

function showComingSoon() {
    alert('Multiplayer features coming in a future update!');
}

function chooseUnitType(unitType) {
    // Get HISTORIC_LEADERS from window (defined in lords-of-war.js)
    const HISTORIC_LEADERS = window.HISTORIC_LEADERS || {};

    // Show hero selection for chosen type
    const leaders = HISTORIC_LEADERS[unitType] || [];
    if (leaders.length < 2) {
        console.error('Error: Not enough leaders for this type', unitType, HISTORIC_LEADERS);
        alert('Error: Not enough leaders for this type. Available: ' + Object.keys(HISTORIC_LEADERS).join(', '));
        return;
    }

    // Pick 2 random leaders
    const shuffled = [...leaders].sort(() => Math.random() - 0.5);
    const options = [shuffled[0], shuffled[1]];

    // Show selection modal
    showHeroSelection(unitType, options);
}

function showHeroSelection(unitType, options) {
    const modal = document.getElementById('gameStartModal');
    if (!modal) {
        console.error('gameStartModal element not found!');
        return;
    }
    modal.classList.remove('hidden');
    modal.innerHTML = `
        <h1 style="font-size: 36px;">⚔️ Choose Your Leader ⚔️</h1>
        <p style="font-size: 20px;">Select one of these ${unitType.charAt(0).toUpperCase() + unitType.slice(1)} commanders:</p>
        <div style="display: flex; flex-direction: column; gap: 15px; margin: 20px 0; max-width: 800px; margin-left: auto; margin-right: auto;">
            ${options.map((hero, idx) => `
                <button onclick="selectHero('${hero.id}')" style="display: flex; align-items: center; gap: 15px; padding: 15px; border: 2px solid #8b6f47; border-radius: 8px; background: rgba(0, 0, 0, 0.3); cursor: pointer; text-align: left; transition: all 0.2s;">
                    <div style="width: 100px; height: 120px; border-radius: 4px; border: 2px solid #8b6f47; background: ${hero.color || '#333'}; display: flex; align-items: center; justify-content: center; font-size: 48px; font-weight: bold; color: #ffd700; flex-shrink: 0;">
                        ${hero.portrait}
                    </div>
                    <div style="flex: 1;">
                        <div style="font-size: 28px; font-weight: bold; color: #ffd700;">${hero.name}</div>
                        <div style="font-size: 18px; color: #f4e4c1; margin-top: 5px;"><strong>Health:</strong> ${hero.health}</div>
                        <div style="font-size: 18px; color: #f4e4c1; margin-top: 5px;"><strong>Passive:</strong> ${hero.passive || ''}</div>
                        <div style="font-size: 16px; color: #ffd700; margin-top: 5px;"><strong>${hero.commandName}:</strong> ${hero.commandText}</div>
                    </div>
                </button>
            `).join('')}
        </div>
        <button onclick="showUnitTypeSelection()" style="margin-top: 20px; padding: 12px 40px; font-size: 18px;">← Back</button>
    `;
}

function showUnitTypeSelection() {
    const modal = document.getElementById('gameStartModal');
    if (!modal) {
        console.error('gameStartModal element not found!');
        return;
    }
    modal.classList.remove('hidden');
    modal.innerHTML = `
        <h1 style="font-size: 36px;">⚔️ Lords of War ⚔️</h1>
        <p style="font-size: 20px;">Choose Your Unit Type:</p>

        <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: nowrap; margin: 20px 0; max-width: 100%;">
            <!-- Ranged -->
            <div style="text-align: center; flex: 1; min-width: 0;">
                <button onclick="chooseUnitType('ranged')" style="padding: 15px 25px; font-size: 22px; width: 100%; max-width: 130px;">🏹 Ranged</button>
                <div style="background: rgba(0, 0, 0, 0.5); border: 1px solid #8b6f47; border-radius: 4px; padding: 10px 12px; margin-top: 6px; color: #ffd700; font-size: 16px; line-height: 1.4; text-align: center;">
                    <div style="font-weight: bold; font-size: 16px;">No melee retaliation</div>
                    <div style="font-size: 14px;">Cloth Armor</div>
                    <div style="font-size: 14px;">High ATK, Low DEF</div>
                </div>
            </div>

            <!-- Infantry -->
            <div style="text-align: center; flex: 1; min-width: 0;">
                <button onclick="chooseUnitType('infantry')" style="padding: 15px 25px; font-size: 22px; width: 100%; max-width: 130px;">🛡️ Infantry</button>
                <div style="background: rgba(0, 0, 0, 0.5); border: 1px solid #8b6f47; border-radius: 4px; padding: 10px 12px; margin-top: 6px; color: #ffd700; font-size: 16px; line-height: 1.4; text-align: center;">
                    <div style="font-weight: bold; font-size: 16px;">Hero starts with weapon</div>
                    <div style="font-size: 14px;">Heavy Armor</div>
                    <div style="font-size: 14px;">Med ATK/DEF</div>
                </div>
            </div>

            <!-- Cavalry -->
            <div style="text-align: center; flex: 1; min-width: 0;">
                <button onclick="chooseUnitType('cavalry')" style="padding: 15px 25px; font-size: 22px; width: 100%; max-width: 130px;">🐎 Cavalry</button>
                <div style="background: rgba(0, 0, 0, 0.5); border: 1px solid #8b6f47; border-radius: 4px; padding: 10px 12px; margin-top: 6px; color: #ffd700; font-size: 16px; line-height: 1.4; text-align: center;">
                    <div style="font-weight: bold; font-size: 16px;">All Cav get 'Charge'</div>
                    <div style="font-size: 14px;">Leather Armor</div>
                    <div style="font-size: 14px;">Very High ATK, Low DEF</div>
                </div>
            </div>
        </div>
    `;
}

function selectHero(heroId) {
    startGame(heroId);
}

// Make functions available globally immediately after definition
if (typeof window !== 'undefined') {
    window.startSinglePlayer = startSinglePlayer;
    window.showGameInstructions = showGameInstructions;
    window.closeinstructionsModal = closeinstructionsModal;
    window.switchGuideTab = switchGuideTab;
    window.changeLanguage = changeLanguage;
    window.showComingSoon = showComingSoon;
    window.chooseUnitType = chooseUnitType;
    window.selectHero = selectHero;
    window.showUnitTypeSelection = showUnitTypeSelection;
    window.returnToMainMenu = returnToMainMenu;
}

function startGame(heroId) {
    // Set game start time for match tracking
    window.gameStartTime = Date.now();
    
    // Get data from window (defined in lords-of-war.js)
    const HISTORIC_LEADERS = window.HISTORIC_LEADERS || {};
    const CARD_DATABASE = window.CARD_DATABASE || {};

    // Find hero in HISTORIC_LEADERS
    let heroData = null;
    for (const type in HISTORIC_LEADERS) {
        const hero = HISTORIC_LEADERS[type].find(h => h.id === heroId);
        if (hero) {
            heroData = hero;
            break;
        }
    }

    if (!heroData) {
        console.error('Hero not found:', heroId);
        console.error('Available leaders:', HISTORIC_LEADERS);
        alert('Error: Hero not found. Please refresh the page.');
        return;
    }

    // In multiplayer mode, send hero selection to server
    if (gameMode === 'multiplayer' && networkManager && networkManager.isMultiplayer) {
        // Load deck preset if one is selected
        let deckCardList = null;
        if (selectedHeroDeckId && selectedHeroDeckId !== 'default') {
            const token = localStorage.getItem('authToken');
            const userId = sessionStorage.getItem('userId');
            
            if (token && userId) {
                fetch(`/api/deck/${userId}/${selectedHeroDeckId}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                })
                .then(async res => {
                    if (res.ok) {
                        const data = await res.json();
                        if (data.success && data.deck) {
                            // Convert card IDs to card objects
                            const CARD_DATABASE = window.CARD_DATABASE || {};
                            // Server returns cardList (already parsed) or card_list (JSON string)
                            const cardIds = data.deck.cardList || (data.deck.card_list ? JSON.parse(data.deck.card_list) : []);
                            console.log('[DECK] Loading deck preset, cardIds:', cardIds);
                            deckCardList = [];
                            
                            // Count cards by ID
                            const cardCounts = {};
                            cardIds.forEach(cardId => {
                                cardCounts[cardId] = (cardCounts[cardId] || 0) + 1;
                            });
                            
                            // Create deck from card counts
                            Object.keys(cardCounts).forEach(cardId => {
                                const card = CARD_DATABASE[cardId];
                                if (card) {
                                    for (let i = 0; i < cardCounts[cardId]; i++) {
                                        deckCardList.push(card);
                                    }
                                } else {
                                    console.warn('[DECK] Card not found in CARD_DATABASE:', cardId);
                                }
                            });
                            
                            // Shuffle the deck before sending to server
                            deckCardList = shuffleArray(deckCardList);
                            console.log('[DECK] Created and shuffled deckCardList with', deckCardList.length, 'cards');
                        }
                    }
                    
                    console.log('Sending hero selection to server:', heroData.id, 'Deck:', selectedHeroDeckId);
                    networkManager.socket.emit('selectHero', { 
                        heroId: heroData.id, 
                        hero: heroData,
                        deckPresetId: selectedHeroDeckId !== 'default' ? selectedHeroDeckId : null,
                        deckCardList: deckCardList
                    });
                    log('Hero selected! Waiting for opponent...');
                })
                .catch(error => {
                    console.error('Error loading deck preset:', error);
                    // Send without deck preset
                    networkManager.socket.emit('selectHero', { 
                        heroId: heroData.id, 
                        hero: heroData,
                        deckPresetId: null,
                        deckCardList: null
                    });
                    log('Hero selected! Waiting for opponent...');
                });
            } else {
                // Not logged in, send without deck preset
                networkManager.socket.emit('selectHero', { 
                    heroId: heroData.id, 
                    hero: heroData,
                    deckPresetId: null,
                    deckCardList: null
                });
                log('Hero selected! Waiting for opponent...');
            }
        } else {
            // Default deck, send without preset
            console.log('Sending hero selection to server:', heroData.id, 'Deck: default');
            networkManager.socket.emit('selectHero', { 
                heroId: heroData.id, 
                hero: heroData,
                deckPresetId: null,
                deckCardList: null
            });
            log('Hero selected! Waiting for opponent...');
        }
        return;
    }
    
    // Use the global CARD_DATABASE for deck creation
    const cardDB = window.CARD_DATABASE || {};

    // Set player hero
    game.player.hero = heroData;
    game.player.health = heroData.health;
    game.player.maxHealth = heroData.health;
    
    // Check if a custom deck is selected
    if (selectedHeroDeckId && selectedHeroDeckId !== 'default') {
        // Load custom deck preset
        const token = localStorage.getItem('token');
        const userData = sessionStorage.getItem('userData');
        let userId = null;
        if (userData) {
            try {
                const user = JSON.parse(userData);
                userId = user.userId || user.id;
            } catch (e) {
                console.error('[Game] Error parsing userData:', e);
            }
        }
        
        console.log('[Game] Loading custom deck - token:', !!token, 'userId:', userId, 'deckId:', selectedHeroDeckId);
        
        if (token && userId) {
            fetch(`/api/deck/${userId}/${selectedHeroDeckId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })
            .then(async res => {
                if (!res.ok) {
                    console.error('Failed to load deck preset, using default');
                    // Fallback to default deck
                    getUserDeckConfig(heroData.unitType).then(excludedCards => {
                        game.player.deck = createDeck(heroData.unitType, excludedCards);
                        game.player.hand = [];
                        game.player.board = [];
                        initializePlayerGame();
                    });
                    return;
                }
                const data = await res.json();
                if (data.success && data.deck) {
                    // Convert card IDs to card objects
                    const CARD_DATABASE = window.CARD_DATABASE || {};
                    // Server returns cardList (already parsed) or card_list (JSON string)
                    const cardIds = data.deck.cardList || (data.deck.card_list ? JSON.parse(data.deck.card_list) : []);
                    console.log('[Game] Loading custom deck, cardIds:', cardIds);
                    game.player.deck = [];
                    
                    // Count cards by ID
                    const cardCounts = {};
                    cardIds.forEach(cardId => {
                        cardCounts[cardId] = (cardCounts[cardId] || 0) + 1;
                    });
                    
                    // Create deck from card counts
                    Object.keys(cardCounts).forEach(cardId => {
                        const card = CARD_DATABASE[cardId];
                        if (card) {
                            // Create a copy of the card object for each instance
                            for (let i = 0; i < cardCounts[cardId]; i++) {
                                // Deep copy the card to avoid reference issues
                                const cardCopy = JSON.parse(JSON.stringify(card));
                                game.player.deck.push(cardCopy);
                            }
                            console.log(`[Game] Added ${cardCounts[cardId]}x ${cardId} to deck`);
                        } else {
                            console.warn('[Game] Card not found in database:', cardId, 'Available cards:', Object.keys(CARD_DATABASE).slice(0, 10));
                        }
                    });
                    
                    // Shuffle the deck (like createDeck does)
                    game.player.deck = shuffleArray(game.player.deck);
                    
                    console.log('[Game] Loaded custom deck:', data.deck.deckName || data.deck.deck_name, 'with', game.player.deck.length, 'cards');
                    console.log('[Game] Deck card IDs from server:', cardIds);
                    console.log('[Game] Deck card counts:', cardCounts);
                    console.log('[Game] First few cards in deck:', game.player.deck.slice(0, 5).map(c => ({id: c.id, name: c.name})));
                    console.log('[Game] All card IDs in deck:', game.player.deck.map(c => c.id || c.name));
                    
                    // Verify deck is set before initializing
                    if (game.player.deck.length === 0) {
                        console.error('[Game] ERROR: Custom deck is empty! Falling back to default deck.');
                        getUserDeckConfig(heroData.unitType).then(excludedCards => {
                            game.player.deck = createDeck(heroData.unitType, excludedCards);
                            game.player.hand = [];
                            game.player.board = [];
                            initializePlayerGame();
                        });
                        return;
                    }
                    
                    game.player.hand = [];
                    game.player.board = [];
                    initializePlayerGame();
                } else {
                    // Fallback to default deck
                    getUserDeckConfig(heroData.unitType).then(excludedCards => {
                        game.player.deck = createDeck(heroData.unitType, excludedCards);
                        game.player.hand = [];
                        game.player.board = [];
                        initializePlayerGame();
                    });
                }
            })
            .catch(error => {
                console.error('Error loading deck preset:', error);
                // Fallback to default deck
                getUserDeckConfig(heroData.unitType).then(excludedCards => {
                    game.player.deck = createDeck(heroData.unitType, excludedCards);
                    game.player.hand = [];
                    game.player.board = [];
                    initializePlayerGame();
                });
            });
        } else {
            // Not logged in, use default deck
            getUserDeckConfig(heroData.unitType).then(excludedCards => {
                game.player.deck = createDeck(heroData.unitType, excludedCards);
                game.player.hand = [];
                game.player.board = [];
                initializePlayerGame();
            });
        }
    } else {
        // Use default deck
        getUserDeckConfig(heroData.unitType).then(excludedCards => {
            game.player.deck = createDeck(heroData.unitType, excludedCards);
            game.player.hand = [];
            game.player.board = [];
            initializePlayerGame();
        });
    }
    
    return; // Exit early, initialization continues in promise
}

function initializePlayerGame() {
    // This function contains the rest of startGame logic that depends on deck being created
    const HISTORIC_LEADERS = window.HISTORIC_LEADERS || {};
    const heroData = game.player.hero;
    game.player.equipment = null;
    game.player.equipmentUsed = false;
    game.player.equipmentSlots = {
        weapon: null,
        head: null,
        chest: null,
        legs: null,
        shield: null,
        boots: null
    };

    // Give Infantry a starting sword for balance (+1 attack)
    if (heroData.unitType === 'infantry') {
        const CARD_DATABASE = window.CARD_DATABASE || {};
        const sword = CARD_DATABASE.sword || {
            id: 'sword',
            name: 'Sword',
            type: 'equipment',
            attackPower: 1, // First weapon = +1 attack
            equipSlot: 'weapon',
            equipType: 'infantry'
        };
        game.player.equipmentSlots.weapon = sword;
        // Track weapon count
        if (!game.player.weaponCount) game.player.weaponCount = 0;
        game.player.weaponCount = 1;
        if (!game.player.weaponEnchantments) game.player.weaponEnchantments = 0;
    } else {
        // Initialize weapon tracking for other hero types
        if (!game.player.weaponCount) game.player.weaponCount = 0;
        if (!game.player.weaponEnchantments) game.player.weaponEnchantments = 0;
    }
    
    // Initialize enemy weapon tracking
    if (!game.enemy.weaponCount) game.enemy.weaponCount = 0;
    if (!game.enemy.weaponEnchantments) game.enemy.weaponEnchantments = 0;

    // Set enemy hero (random different type)
    const enemyTypes = Object.keys(HISTORIC_LEADERS).filter(t => t !== heroData.unitType);
    const enemyType = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
    const enemyLeaders = HISTORIC_LEADERS[enemyType] || [];
    const enemyHero = enemyLeaders[Math.floor(Math.random() * enemyLeaders.length)];
    
    game.enemy.hero = enemyHero;
    game.enemy.health = game.enemy.hero.health;
    game.enemy.maxHealth = game.enemy.hero.health;
    game.enemy.deck = createDeck(enemyHero.unitType); // Enemy uses default deck (no exclusions)
    game.enemy.hand = [];
    game.enemy.board = [];
    game.enemy.equipment = null;
    game.enemy.equipmentUsed = false;
    game.enemy.equipmentSlots = {
        weapon: null,
        head: null,
        chest: null,
        legs: null,
        shield: null,
        boots: null
    };

    // Hide modal and overlay, show game board
    const modal = document.getElementById('gameStartModal');
    const overlay = document.getElementById('modalOverlay');
    const gameBoard = document.querySelector('.game-board');
    const bottomBar = document.querySelector('.bottom-bar');
    const gameLog = document.getElementById('gameLog');
    const endTurnBtn = document.getElementById('endTurnBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const handCardPreview = document.getElementById('handCardPreview');

    if (modal) modal.style.display = 'none';
    if (overlay) overlay.style.display = 'none';
    if (gameBoard) gameBoard.style.display = 'block';
    if (bottomBar) bottomBar.style.display = 'flex';
    if (gameLog) gameLog.style.display = 'block';
    if (endTurnBtn) endTurnBtn.style.display = 'block';
    if (settingsBtn) settingsBtn.classList.remove('hidden');
    if (handCardPreview) handCardPreview.style.display = 'block';

    // Draw starting hands
    console.log('[Game] Drawing starting hands. Player deck size:', game.player.deck.length);
    console.log('[Game] Player deck contents:', game.player.deck.map(c => c.id || c.name));
    for (let i = 0; i < 3; i++) {
        const card = drawCard('player');
        if (card) {
            console.log(`[Game] Player drew card ${i+1}:`, card.id || card.name);
        }
        drawCard('enemy');
    }
    console.log('[Game] Player hand after draw:', game.player.hand.map(c => c.id || c.name));

    log('Game started!');
    log(`Player chose ${heroData.name} (${heroData.unitType})`);
    log(`Enemy is ${game.enemy.hero.name} (${game.enemy.hero.unitType})`);

    startTurn('player');
    updateUI();

    // Scroll buttons disabled - cards auto-scale to fit
}

// Functions will be made global after they're defined (see end of file)

function startTurn(player) {
    // In multiplayer mode, don't modify game state - server controls everything
    if (gameMode === 'multiplayer') {
        console.log('[Game] startTurn called in multiplayer - server controls turn state');
        // Just update UI to reflect current state
        updateUI();
        if (player === 'player') {
            log('Your turn begins!', 'player');
        } else {
            const enemyName = typeof window.enemyAlias === 'string' ? window.enemyAlias.replace(/^[⚔️\s]+/, '').trim() : (game.enemy?.hero?.name || 'Opponent');
            log(`${enemyName}'s turn...`, 'enemy');
        }
        return;
    }

    // Single-player mode: handle turn locally
    game.currentPlayer = player;
    const playerData = player === 'player' ? game.player : game.enemy;

    // Increment essence/gold
    if (playerData.maxEssence < GAME_CONSTANTS.MAX_ESSENCE) {
        playerData.maxEssence++;
    }
    playerData.currentEssence = playerData.maxEssence;

    // Reset hero power and equipment
    playerData.heroPowerUsed = false;
    playerData.equipmentUsed = false;
    
    // Initialize equipment slots if not present
    if (!playerData.equipmentSlots) {
        playerData.equipmentSlots = {
            weapon: null,
            head: null,
            chest: null,
            legs: null,
            shield: null,
            boots: null
        };
    }
    if (!playerData.maxHealth) {
        playerData.maxHealth = 30;
    }

    // Refresh constructs
    playerData.board.forEach(construct => {
        construct.canAttack = true;
        construct.exhausted = false;
        // Reset double attack flag for Catapult
        if (construct.doubleAttack) {
            construct.hasAttacked = false;
        }
        // Clear stun if it's expired
        if (construct.stunned && construct.stunnedUntil && game.turn >= construct.stunnedUntil) {
            construct.stunned = false;
            construct.stunnedUntil = null;
            log(`${construct.name} is no longer stunned!`, player);
        }
        // Remove temporary buffs (from Battle Cry, Last Stand, etc.)
        if (construct.tempBuff) {
            // Battle Cry: -2/-2 from infantry
            if (construct.unitType === 'infantry' && construct.power >= 2 && construct.durability >= 2) {
                construct.power -= 2;
                construct.durability -= 2;
            }
            // Last Stand: -1/-1 from all
            if (construct.power >= 1 && construct.durability >= 1) {
                construct.power -= 1;
                construct.durability -= 1;
            }
            // Cavalry Charge: -3/+0 from cavalry
            if (construct.unitType === 'cavalry' && construct.power >= 3) {
                construct.power -= 3;
            }
            construct.tempBuff = false;
        }
    });

    // Reset temp buffs
    game.tempPowerBuff = 0;
    playerData.constructsPlayed = 0;

    // Draw card
    drawCard(player);

    log(`${player}'s turn ${game.turnNumber} begins`, player);

    // Show turn indicator
    showTurnIndicator(player);

    updateUI();

    // AI turn - only in single-player mode
    if (player === 'enemy') {
        // Single-player: run AI
        setTimeout(() => playAITurn(), 1500);
    }
}

function showTurnIndicator(player) {
    const indicator = document.createElement('div');
    indicator.className = 'turn-indicator';
    indicator.textContent = player === 'player' ? 'YOUR TURN' : 'ENEMY TURN';
    indicator.style.color = player === 'player' ? '#4ecdc4' : '#ff6b6b';
    document.body.appendChild(indicator);

    setTimeout(() => {
        indicator.remove();
    }, 2000);
}

function hasAvailableMoves(player) {
    const playerData = player === 'player' ? game.player : game.enemy;
    
    // Check for playable cards
    const playableCards = playerData.hand.filter(card => canPlayCard(card, player));
    if (playableCards.length > 0) return true;
    
    // Check for units that can attack
    const attackableUnits = playerData.board.filter(c => c.canAttack && !c.exhausted);
    if (attackableUnits.length > 0) return true;
    
    // Check for equipment attack
    if (playerData.equipment && !playerData.equipmentUsed) return true;
    
    // Check for hero power (if equipment is equipped)
    if (playerData.equipment && !playerData.equipmentUsed) return true;
    
    return false;
}

function showEndTurnConfirmation() {
    // Create confirmation modal
    const modal = document.createElement('div');
    modal.className = 'confirmation-modal';
    modal.id = 'endTurnConfirmation';
    modal.innerHTML = `
        <h3>⚠️ End Turn? ⚠️</h3>
        <p>You still have moves available:</p>
        <ul style="text-align: left; color: #f4e4c1; margin: 20px 0; padding-left: 40px;">
            ${game.player.hand.filter(c => canPlayCard(c, 'player')).length > 0 ? '<li>Playable cards in hand</li>' : ''}
            ${game.player.board.filter(c => c.canAttack && !c.exhausted).length > 0 ? '<li>Units that can attack</li>' : ''}
            ${game.player.equipment && !game.player.equipmentUsed ? '<li>Equipment attack available</li>' : ''}
        </ul>
        <p>Are you sure you want to end your turn?</p>
        <div class="button-group">
            <button class="confirm" onclick="confirmEndTurn()">Yes, End Turn</button>
            <button class="cancel" onclick="cancelEndTurn()">Cancel</button>
        </div>
    `;
    document.body.appendChild(modal);
}

function confirmEndTurn() {
    const modal = document.getElementById('endTurnConfirmation');
    if (modal) {
        modal.remove();
    }
    actuallyEndTurn();
}

function cancelEndTurn() {
    const modal = document.getElementById('endTurnConfirmation');
    if (modal) {
        modal.remove();
    }
}

function actuallyEndTurn() {
    log(`${game.currentPlayer} ended their turn`, game.currentPlayer);

    // Battle Medic: Heal 1 damage to a friendly character at end of turn
    const currentPlayerData = game.currentPlayer === 'player' ? game.player : game.enemy;
    const medics = currentPlayerData.board.filter(u => u.medicEffect && u.healEndOfTurn);
    
    if (medics.length > 0) {
        // Find all damaged friendly characters (bannermen + hero)
        const damagedBannermen = currentPlayerData.board.filter(u => 
            u.durability !== undefined && u.health !== undefined && u.health < u.durability
        );
        const heroNeedsHealing = currentPlayerData.health < currentPlayerData.maxHealth;
        
        // Heal one random damaged character
        const allDamaged = [...damagedBannermen];
        if (heroNeedsHealing) {
            allDamaged.push({ type: 'hero', name: currentPlayerData.hero?.name || 'Hero' });
        }
        
        if (allDamaged.length > 0) {
            const target = allDamaged[Math.floor(Math.random() * allDamaged.length)];
            if (target.type === 'hero') {
                currentPlayerData.health = Math.min(currentPlayerData.health + 1, currentPlayerData.maxHealth);
                log(`Battle Medic healed ${game.currentPlayer} hero for 1!`, game.currentPlayer);
            } else {
                target.health = Math.min(target.health + 1, target.durability);
                log(`Battle Medic healed ${target.name} for 1!`, game.currentPlayer);
            }
        }
    }

    if (game.currentPlayer === 'player') {
        game.turnNumber++;
        startTurn('enemy');
    } else {
        startTurn('player');
    }
}

function endTurn() {
    if (game.targeting) {
        log('Cancel targeting first');
        return;
    }

    // In multiplayer mode, send action to server
    if (gameMode === 'multiplayer' && game.currentPlayer === 'player') {
        // Double-check that networkManager exists and we're actually in a game
        if (!networkManager || !networkManager.isMultiplayer) {
            console.warn('[Game] Cannot end turn - not in multiplayer game');
            return;
        }
        
        // Prevent endTurn from being called immediately after game start (within 2 seconds)
        const timeSinceStart = Date.now() - gameStartTime;
        if (timeSinceStart < 2000) {
            console.warn('[Game] Prevented endTurn call - game just started', timeSinceStart, 'ms ago');
            return;
        }
        
        // Disable end turn button immediately to prevent double-clicks
        const endTurnBtn = document.getElementById('endTurnBtn');
        if (endTurnBtn) {
            endTurnBtn.disabled = true;
            endTurnBtn.style.opacity = '0.5';
            endTurnBtn.style.cursor = 'not-allowed';
        }
        
        // Verify it's actually our turn
        console.log('[Game] Ending turn in multiplayer mode');
        console.log('[Game] Our role:', networkManager.playerRole);
        console.log('[Game] Client thinks currentPlayer is:', game.currentPlayer);
        console.log('[Game] Sending endTurn to server...');
        networkManager.sendEndTurn();
        return;
    } else if (gameMode === 'multiplayer') {
        console.warn('[Game] Cannot end turn - not your turn. Current player:', game.currentPlayer);
    }

    // Check for available moves and show confirmation modal
    if (game.currentPlayer === 'player' && hasAvailableMoves('player')) {
        showEndTurnConfirmation();
        return;
    }

    actuallyEndTurn();
}

// ===== CARD PLAYING =====

function canPlayCard(card, player) {
    const playerData = player === 'player' ? game.player : game.enemy;

    if (!card || typeof card.cost !== 'number') {
        return false; // Card must have a valid cost
    }

    // Check essence cost
    let cost = card.cost;

    // Shadow Blade passive: first tactic costs 1 less
    if (playerData.hero && playerData.hero.id === 'shadowBlade' && card.type === 'ability' && playerData.constructsPlayed === 0) {
        cost = Math.max(0, cost - 1);
    }

    if (playerData.currentEssence < cost) {
        return false;
    }

    // Check board space for units/constructs (equipment doesn't need board space)
    if (card.type === 'unit' || card.type === 'construct') {
        // Check if this card will merge with an existing one
        const cardTier = card.tier || 1;
        const existingCard = playerData.board.find(c => c.id === card.id && (c.tier || 1) === cardTier);

        // Only reject if board is full AND card won't merge
        if (!existingCard && playerData.board.length >= GAME_CONSTANTS.MAX_BOARD_SIZE) {
            return false;
        }
    }

    return true;
}

function playCard(card, player, target = null) {
    // In multiplayer mode, send action to server instead of executing locally
    if (gameMode === 'multiplayer' && player === 'player') {
        networkManager.sendPlayCard(card, target);
        return true; // Action sent to server
    }

    const playerData = player === 'player' ? game.player : game.enemy;

    if (!canPlayCard(card, player)) {
        log('Cannot play that card', player);
        return false;
    }

    // Tactical Retreat: Check for valid friendly target BEFORE paying cost or removing card
    if (card.id === 'tacticalRetreat' && card.needsTarget) {
        // Check if target is valid (friendly bannerman)
        if (!target || (target.type !== 'unit' && target.type !== 'construct')) {
            // Invalid or no target - don't consume card, start targeting instead
            if (player === 'player') {
                startTargeting(card);
                return true; // Return early, card not consumed yet
            } else {
                // AI: return false to not consume card
                return false;
            }
        }
        // Check if target is friendly (on player's board)
        const boardIndex = playerData.board.findIndex(u => u.instanceId === target.instanceId);
        if (boardIndex < 0) {
            // Target is not on friendly board - don't consume card, show error and start targeting
            if (player === 'player') {
                log(`${card.name} must target a friendly bannerman!`, player);
                startTargeting(card);
                return true; // Return early, card not consumed yet
            } else {
                // AI: return false to not consume card
                return false;
            }
        }
        // Valid friendly target - proceed with card play
    }

    // Calculate cost
    let cost = card.cost;
    if (playerData.hero && playerData.hero.id === 'shadowBlade' && card.type === 'ability' && playerData.constructsPlayed === 0) {
        cost = Math.max(0, cost - 1);
    }

    // Pay essence
    playerData.currentEssence -= cost;

    log(`${player} played ${card.name}`, player);

    // Handle card type - some types handle hand removal themselves (like combine)
    let cardHandledRemoval = false;
    if (card.type === 'construct' || card.type === 'unit') {
        // Check if this will combine (before removing from hand)
        const cardTier = card.tier || 1;
        const existingCard = playerData.board.find(c => c.id === card.id && (c.tier || 1) === cardTier);
        if (existingCard) {
            // Will combine - playConstruct will handle hand removal
            cardHandledRemoval = true;
        }
    }
    
    // Tactical Retreat: Mark that playTechnique will handle removal (we already validated target above)
    if (card.id === 'tacticalRetreat') {
        cardHandledRemoval = true;
    }

    // Remove from hand only if not handled by the play function
    if (!cardHandledRemoval) {
        const handIndex = playerData.hand.findIndex(c => 
            c.id === card.id && 
            (c.tier || 1) === (card.tier || 1) &&
            (!card.instanceId || c.instanceId === card.instanceId)
        );
        if (handIndex >= 0) {
            playerData.hand.splice(handIndex, 1);
        }
    }

    // Handle card type
    if (card.type === 'construct' || card.type === 'unit') {
        playConstruct(card, player);
    } else if (card.type === 'technique' || card.type === 'ability' || card.type === 'ability') {
        playTechnique(card, player, target);
    } else if (card.type === 'forge' || card.type === 'equipment') {
        playForge(card, player, target);
    }

    // Trigger resonance effects
    triggerResonance(player);

    updateUI();
    return true;
}

function playConstruct(card, player) {
    const playerData = player === 'player' ? game.player : game.enemy;

    // Check for combine mechanic: if same card ID exists on board with same tier, merge them
    const cardTier = card.tier || 1; // Default tier 1 for base cards
    const existingCard = playerData.board.find(c => c.id === card.id && (c.tier || 1) === cardTier);
    
    if (existingCard) {
        // Tier up mechanic: upgrade the existing unit on battlefield
        const existingTier = existingCard.tier || 1;
        const newTier = Math.min(existingTier + 1, 5); // Max tier is 5
        const combinedPower = (existingCard.power || 0) + (card.power || 0);
        const combinedDurability = (existingCard.durability || 0) + (card.durability || 0);

        // Upgrade the existing card on the battlefield, preserving its status
        existingCard.tier = newTier;
        existingCard.power = combinedPower;
        existingCard.durability = combinedDurability;
        existingCard.name = `${card.name} T${newTier}`;
        // Keep existingCard.exhausted and existingCard.canAttack as they were

        // Remove the card being played from hand
        const handIndex = playerData.hand.findIndex(c =>
            c.id === card.id &&
            (c.tier || 1) === (card.tier || 1) &&
            (!card.instanceId || c.instanceId === card.instanceId)
        );
        if (handIndex >= 0) {
            playerData.hand.splice(handIndex, 1);
        }

        log(`${card.name} Tier ${existingTier} upgraded! Now Tier ${newTier}: ${combinedPower}/${combinedDurability}`, player);

        updateUI();
        return;
    }

    // Create construct instance
    // All units are exhausted when played (except charge units can attack immediately)
    const hasCharge = card.keywords && card.keywords.includes('charge');
    const construct = {
        ...card,
        type: 'construct', // Normalize type
        tier: card.tier || 1, // Preserve tier (default 1)
        canAttack: hasCharge || 
                   (playerData.hero && playerData.hero.id === 'swiftRider' && card.cost <= 3),
        exhausted: !hasCharge, // Exhausted unless it has charge
        instanceId: Date.now() + Math.random()
    };

    // Mountain King passive: Protection on 5+ durability
    if (playerData.hero && playerData.hero.id === 'mountainKing' && construct.durability >= 5) {
        if (!construct.keywords) construct.keywords = [];
        if (!construct.keywords.includes('protection')) {
            construct.keywords.push('protection');
        }
    }

    // Apply type advantage bonus when unit is played
    if (construct.unitType === 'ranged') {
        const enemyData = player === 'player' ? game.enemy : game.player;
        const hasEnemyInfantry = enemyData.board.some(c => c.unitType === 'infantry');
        if (hasEnemyInfantry) {
            construct.power += 1;
            log(`${construct.name} gained +1 attack against infantry units`);
        }
    }

    playerData.board.push(construct);

    // Auto-merge duplicates on the battlefield
    autoMergeBoard(player);

    // Trigger Formation keyword
    playerData.board.forEach(c => {
        if (c.keywords && c.keywords.includes('formation') && c.instanceId !== construct.instanceId) {
            c.power += 1;
            log(`${c.name} gained +1/+0 from Formation`);
        }
    });

    // Trigger card draw effects when unit is played
    if (construct.scoutEffect || construct.commandEffect || construct.dispatchEffect) {
        drawCard(player);
        log(`${construct.name} drew a card!`, player);
    }

    // Battle Medic: Heal all friendly characters on enter
    if (construct.medicEffect && construct.healOnEnter) {
        // Heal all friendly bannermen
        playerData.board.forEach(unit => {
            if (unit.durability !== undefined && unit.health !== undefined && unit.health < unit.durability) {
                unit.health = Math.min(unit.health + 1, unit.durability);
                log(`${construct.name} healed ${unit.name} for 1!`, player);
            }
        });
        // Heal hero
        if (playerData.health < playerData.maxHealth) {
            playerData.health = Math.min(playerData.health + 1, playerData.maxHealth);
            log(`${construct.name} healed ${player} hero for 1!`, player);
        }
    }

    // Elite Guard: Heal hero on enter
    if (construct.id === 'eliteGuard' && construct.healAmount) {
        const healAmount = construct.healAmount || 3;
        playerData.health = Math.min(playerData.health + healAmount, playerData.maxHealth);
        log(`${construct.name} healed ${player} hero for ${healAmount}!`, player);
    }

    // Siege Master: Deal 2 damage to all enemy units and hero on enter
    if (construct.id === 'siegeMaster' && construct.enterBattlefieldEffect) {
        const enemyData = player === 'player' ? game.enemy : game.player;
        const enemyBoard = enemyData.board || [];
        
        // Damage all enemy units
        if (enemyBoard.length > 0) {
            enemyBoard.forEach(unit => {
                dealDamage(unit, 2, player);
            });
        }
        
        // Also damage enemy hero
        if (enemyData.health > 0) {
            damageHero(enemyData, 2, player);
        }
        
        if (enemyBoard.length > 0 || enemyData.health > 0) {
            log(`${construct.name} dealt 2 damage to all enemies!`, player);
        }
    }

    // Ranger: Destroy random enemy bannerman on enter
    if (construct.id === 'ranger' && construct.keywords && construct.keywords.includes('ranger')) {
        const enemyData = player === 'player' ? game.enemy : game.player;
        const enemyBoard = enemyData.board || [];
        
        if (enemyBoard.length > 0) {
            // Destroy random enemy bannerman
            const randomBannerman = enemyBoard[Math.floor(Math.random() * enemyBoard.length)];
            destroyConstruct(randomBannerman, player === 'player' ? 'enemy' : 'player');
            log(`${construct.name} destroyed enemy ${randomBannerman.name}!`, player);
        } else {
            log(`${construct.name}: No enemy bannermen to destroy.`, player);
        }
    }

    // War General: Aura effect - all infantry gain +1/+1 (handled in calculateTotalPower)
    if (construct.id === 'warGeneral' && construct.auraEffect) {
        log(`${construct.name} entered the battlefield! All friendly infantry gain +1/+1.`, player);
    }

    playerData.constructsPlayed++;
}

// Auto-merge duplicate units on battlefield (same ID and tier)
function autoMergeBoard(player) {
    const playerData = player === 'player' ? game.player : game.enemy;

    // Keep merging until no more duplicates exist
    let merged = true;
    while (merged) {
        merged = false;

        // Group units by ID and tier
        const cardGroups = {};
        playerData.board.forEach((card, idx) => {
            const groupKey = `${card.id}_T${card.tier || 1}`;
            if (!cardGroups[groupKey]) {
                cardGroups[groupKey] = [];
            }
            cardGroups[groupKey].push(idx);
        });

        // Check for duplicates (more than one card with same ID and tier)
        for (const groupKey in cardGroups) {
            if (cardGroups[groupKey].length >= 2) {
                // Found duplicates - merge the first two
                const indices = cardGroups[groupKey];
                const card1Idx = indices[0];
                const card2Idx = indices[1];
                const card1 = playerData.board[card1Idx];
                const card2 = playerData.board[card2Idx];

                // Merge into card1
                const existingTier = card1.tier || 1;
                const newTier = Math.min(existingTier + 1, 5);
                card1.tier = newTier;
                card1.power = (card1.power || 0) + (card2.power || 0);
                card1.durability = (card1.durability || 0) + (card2.durability || 0);
                const baseName = card1.name.replace(/ T\d+$/, ''); // Remove tier from name
                card1.name = `${baseName} T${newTier}`;

                // Remove card2 from board
                playerData.board.splice(card2Idx, 1);

                log(`${baseName} merged! Now Tier ${newTier}: ${card1.power}/${card1.durability}`, player);

                merged = true;
                break; // Start over since board changed
            }
        }
    }
}

function playTechnique(card, player, target) {
    const playerData = player === 'player' ? game.player : game.enemy;

    // Handle ability cards
    if (card.type === 'ability') {
        const damageType = card.damageType;
        const damageAmount = card.id.includes('quick') ? 1 :
                             (card.id.includes('master') ? 4 :
                             (card.id.includes('focus') || card.id.includes('aimed') ? 3 : 0));
        
        if (damageAmount > 0) {
            // Quick Shot is the only "quick" ability that doesn't need a target (random)
            if (card.id === 'quickShot' && !card.needsTarget) {
                // Random target for Quick Shot
                const enemyBoard = player === 'player' ? game.enemy.board : game.player.board;
                const enemyData = player === 'player' ? game.enemy : game.player;

                if (enemyBoard.length > 0) {
                    const randomTarget = enemyBoard[Math.floor(Math.random() * enemyBoard.length)];
                    dealDamage(randomTarget, damageAmount, player);
                    log(`${card.name} dealt ${damageAmount} damage to random target ${randomTarget.name}!`, player);
                } else {
                    damageHero(enemyData, damageAmount, player);
                    log(`${card.name} dealt ${damageAmount} damage to enemy hero!`, player);
                }
            } else if (target) {
                // Targeted abilities (aimedShot, masterShot, quickStrike, focusStrike, quickCharge, focusCharge)
                if (target.type === 'unit' || target.type === 'construct') {
                    dealDamage(target, damageAmount, player);
                    log(`${card.name} dealt ${damageAmount} damage to ${target.name}!`, player);
                } else {
                    const enemyData = player === 'player' ? game.enemy : game.player;
                    damageHero(enemyData, damageAmount, player);
                    log(`${card.name} dealt ${damageAmount} damage to enemy hero!`, player);
                }

                // Master Shot draws a card
                if (card.id === 'masterShot') {
                    drawCard(player);
                    log(`${card.name} drew a card!`, player);
                }
            } else if (card.needsTarget) {
                // Card needs a target but none was provided
                log(`${card.name} requires a target!`, player);
                return false;
            }
        } else if (card.id === 'rangersMark' || card.id === 'cavalryFormation' || card.id === 'shieldWall') {
            // Buff cards - check by exact ID to avoid false matches
            if (target && (target.type === 'unit' || target.type === 'construct')) {
                if (card.id === 'rangersMark' || card.id === 'cavalryFormation') {
                    target.power += 2;
                    target.durability += 2;
                    log(`${target.name} gained +2/+2 from ${card.name}!`, player);
                } else if (card.id === 'shieldWall') {
                    target.durability += 2;
                    log(`${target.name} gained +0/+2 from ${card.name}!`, player);
                }
            } else if (card.needsTarget) {
                log(`${card.name} requires a target!`, player);
                return false;
            }
        } else if (card.id === 'bowEnchantment' || card.id === 'swordEnchantment' || card.id === 'axeEnchantment') {
            // Weapon enchantments: +1 attack per enchantment
            const equipType = card.unitType;
            
            // Initialize weapon tracking
            if (!playerData.weaponCount) playerData.weaponCount = 0;
            if (!playerData.weaponEnchantments) playerData.weaponEnchantments = 0;
            
            // Increment enchantment count
            playerData.weaponEnchantments++;
            
            // Update equipped weapon attack power
            if (playerData.equipmentSlots && playerData.equipmentSlots.weapon) {
                const weapon = playerData.equipmentSlots.weapon;
                if (weapon.equipType === equipType) {
                    // Calculate: weaponCount + enchantments
                    const newAttackPower = (playerData.weaponCount || 0) + playerData.weaponEnchantments;
                    weapon.attackPower = newAttackPower;
                    log(`${weapon.name} gained +1 attack from ${card.name}! (Total: ${newAttackPower})`, player);
                }
            }
            
            // Legacy support
            if (playerData.equipment && playerData.equipment.equipType === equipType) {
                playerData.equipment.attackPower = (playerData.weaponCount || 0) + playerData.weaponEnchantments;
            }
            
            log(`${card.name}: Hero attack increased by +1!`, player);
        } else if (card.id === 'quiverRefill' || card.id === 'supplyLine' || card.id === 'courierNetwork') {
            // Draw 3 cards
            for (let i = 0; i < 3; i++) {
                drawCard(player);
            }
            log(`${card.name}: Drew 3 cards!`, player);
        } else if (card.id === 'launchNet') {
            // Launch Net: Target Bannerman cannot attack next turn
            if (target && (target.type === 'unit' || target.type === 'construct')) {
                target.stunned = true;
                target.stunnedUntil = game.turn + 1; // Can't attack next turn
                log(`${target.name} is stunned and cannot attack next turn!`, player);
            }
        } else if (card.id === 'disarm' || card.id === 'sabotage') {
            // Destroy random enemy equipment
            const enemyData = player === 'player' ? game.enemy : game.player;
            const equipmentSlots = enemyData.equipmentSlots || {};
            const equippedItems = Object.values(equipmentSlots).filter(eq => eq !== null);
            
            if (equippedItems.length > 0) {
                const randomEquipment = equippedItems[Math.floor(Math.random() * equippedItems.length)];
                const slot = Object.keys(equipmentSlots).find(key => equipmentSlots[key] === randomEquipment);
                if (slot) {
                    equipmentSlots[slot] = null;
                    
                    // If weapon was destroyed, reset weapon tracking
                    if (slot === 'weapon') {
                        enemyData.weaponCount = 0;
                        enemyData.weaponEnchantments = 0;
                        // Also clear legacy equipment reference
                        enemyData.equipment = null;
                    }
                    
                    updateHeroMaxHealth(player === 'player' ? 'enemy' : 'player');
                    log(`${card.name} destroyed enemy ${randomEquipment.name}!`, player);
                    
                    // Update UI to refresh hero card with new attack power
                    updateUI();
                }
            } else {
                log(`${card.name}: No enemy equipment to destroy.`, player);
            }
        } else if (card.id === 'volley') {
            // Volley: Deal 2 damage to all enemy units and hero
            const enemyData = player === 'player' ? game.enemy : game.player;
            const enemyBoard = enemyData.board || [];
            let damaged = false;
            
            // Damage all enemy units
            if (enemyBoard.length > 0) {
                enemyBoard.forEach(unit => {
                    dealDamage(unit, 2, player);
                });
                damaged = true;
            }
            
            // Also damage enemy hero
            if (enemyData.health > 0) {
                damageHero(enemyData, 2, player);
                damaged = true;
            }
            
            if (damaged) {
                log(`${card.name} dealt 2 damage to all enemies!`, player);
            } else {
                log(`${card.name}: No enemies to damage.`, player);
            }
        } else if (card.id === 'precisionStrike') {
            // Precision Strike: Deal 5 damage, draw 2 cards
            if (target) {
                if (target.type === 'unit' || target.type === 'construct') {
                    dealDamage(target, 5, player);
                } else {
                    const enemyData = player === 'player' ? game.enemy : game.player;
                    damageHero(enemyData, 5, player);
                }
                for (let i = 0; i < 2; i++) {
                    drawCard(player);
                }
                log(`${card.name} dealt 5 damage and drew 2 cards!`, player);
            } else if (card.needsTarget) {
                log(`${card.name} requires a target!`, player);
                return false;
            }
        } else if (card.id === 'battleCry') {
            // Battle Cry: Give all friendly infantry +2/+2 until end of turn
            const infantryUnits = playerData.board.filter(u => u.unitType === 'infantry');
            infantryUnits.forEach(unit => {
                unit.power += 2;
                unit.durability += 2;
                unit.tempBuff = true; // Mark for removal at end of turn
            });
            log(`${card.name}: All friendly infantry gained +2/+2 until end of turn!`, player);
        } else if (card.id === 'lastStand') {
            // Last Stand: Heal hero 5, draw 3 cards, all units +1/+1
            playerData.health = Math.min(playerData.health + 5, playerData.maxHealth);
            for (let i = 0; i < 3; i++) {
                drawCard(player);
            }
            playerData.board.forEach(unit => {
                unit.power += 1;
                unit.durability += 1;
                unit.tempBuff = true;
            });
            log(`${card.name}: Hero healed 5, drew 3 cards, all units gained +1/+1!`, player);
        } else if (card.id === 'cavalryCharge') {
            // Cavalry Charge: All cavalry +3/+0, draw 1
            const cavalryUnits = playerData.board.filter(u => u.unitType === 'cavalry');
            cavalryUnits.forEach(unit => {
                unit.power += 3;
                unit.tempBuff = true;
            });
            drawCard(player);
            log(`${card.name}: All cavalry gained +3 attack and drew a card!`, player);
        } else if (card.id === 'flankingManeuver') {
            // Flanking Maneuver: Deal 3 damage, all cavalry can attack
            if (target) {
                if (target.type === 'unit' || target.type === 'construct') {
                    dealDamage(target, 3, player);
                } else {
                    const enemyData = player === 'player' ? game.enemy : game.player;
                    damageHero(enemyData, 3, player);
                }
            }
            const cavalryUnits = playerData.board.filter(u => u.unitType === 'cavalry');
            cavalryUnits.forEach(unit => {
                unit.canAttack = true;
                unit.exhausted = false;
            });
            log(`${card.name}: Dealt 3 damage and all cavalry can attack immediately!`, player);
        } else if (card.id === 'reinforcements') {
            // Reinforcements: Draw 5 cards
            for (let i = 0; i < 5; i++) {
                drawCard(player);
            }
            log(`${card.name}: Drew 5 cards!`, player);
        } else if (card.id === 'warCouncil') {
            // War Council: Draw 3 cards, +2 max essence this turn
            for (let i = 0; i < 3; i++) {
                drawCard(player);
            }
            playerData.maxEssence += 2;
            playerData.currentEssence += 2;
            log(`${card.name}: Drew 3 cards and gained +2 essence this turn!`, player);
        } else if (card.id === 'totalWar') {
            // Total War: Deal 3 to all enemies, draw 2, +1 max essence permanently
            const enemyData = player === 'player' ? game.enemy : game.player;
            enemyData.board.forEach(unit => {
                dealDamage(unit, 3, player);
            });
            damageHero(enemyData, 3, player);
            for (let i = 0; i < 2; i++) {
                drawCard(player);
            }
            playerData.maxEssence += 1;
            playerData.currentEssence += 1;
            log(`${card.name}: Dealt 3 to all enemies, drew 2 cards, gained +1 max essence permanently!`, player);
        } else if (card.id === 'tacticalRetreat') {
            // Tactical Retreat: Return unit to hand, draw 2
            // Target validation and card removal already handled in playCard()
            // At this point, we know target is valid and card is marked for removal
            if (target && (target.type === 'unit' || target.type === 'construct')) {
                const boardIndex = playerData.board.findIndex(u => u.instanceId === target.instanceId);
                if (boardIndex >= 0) {
                    // Remove card from hand (if not already removed)
                    const handIndex = playerData.hand.findIndex(c => 
                        c.id === card.id && 
                        (c.tier || 1) === (card.tier || 1) &&
                        (!card.instanceId || c.instanceId === card.instanceId)
                    );
                    if (handIndex >= 0) {
                        playerData.hand.splice(handIndex, 1);
                    }
                    
                    // Return unit to hand and draw cards
                    playerData.board.splice(boardIndex, 1);
                    playerData.hand.push(target);
                    for (let i = 0; i < 2; i++) {
                        drawCard(player);
                    }
                    log(`${card.name}: Returned ${target.name} to hand and drew 2 cards!`, player);
                } else {
                    // This shouldn't happen if validation worked correctly, but handle it anyway
                    log(`${card.name}: Target must be a friendly bannerman!`, player);
                    return false;
                }
            } else {
                // This shouldn't happen if validation worked correctly, but handle it anyway
                log(`${card.name} requires a target!`, player);
                return false;
            }
        } else if (card.drawCards && card.drawCards > 0) {
            // Generic draw cards effect
            for (let i = 0; i < card.drawCards; i++) {
                drawCard(player);
            }
            log(`${card.name}: Drew ${card.drawCards} cards!`, player);
        }
    }
}

function playForge(card, player, target) {
    const playerData = player === 'player' ? game.player : game.enemy;

    // Equipment attaches to hero
    if (card.type === 'equipment') {
        // Ensure equipmentSlots exists
        if (!playerData.equipmentSlots) {
            playerData.equipmentSlots = {
                weapon: null,
                head: null,
                chest: null,
                legs: null,
                shield: null,
                boots: null
            };
        }
        
        const equipSlot = card.equipSlot || 'weapon';
        
        // Handle weapon equipment - new system: +1 per weapon/enchantment
        if (equipSlot === 'weapon') {
            // Initialize weapon tracking
            if (!playerData.weaponCount) playerData.weaponCount = 0;
            if (!playerData.weaponEnchantments) playerData.weaponEnchantments = 0;
            
            if (playerData.equipmentSlots.weapon) {
                // Additional weapon: increment count
                playerData.weaponCount++;
                // Calculate new attack power: 1 (base) + (weaponCount - 1) + enchantments
                const newAttackPower = 1 + (playerData.weaponCount - 1) + playerData.weaponEnchantments;
                playerData.equipmentSlots.weapon.attackPower = newAttackPower;
                // Legacy support
                playerData.equipment = playerData.equipmentSlots.weapon;
                log(`${player} enhanced ${playerData.equipmentSlots.weapon.name} with ${card.name}! Attack increased to ${newAttackPower}`, player);
            } else {
                // First weapon: +1 attack
                playerData.weaponCount = 1;
                playerData.equipmentSlots.weapon = {
                    ...card,
                    attackPower: 1, // First weapon = +1
                    equipType: card.equipType || card.unitType
                };
                // Legacy support
                playerData.equipment = playerData.equipmentSlots.weapon;
                log(`${player} equipped ${card.name} (+1 attack)`, player);
            }
        } else {
            // Handle armor equipment
            if (playerData.equipmentSlots[equipSlot]) {
                log(`${player} replaced ${playerData.equipmentSlots[equipSlot].name} with ${card.name}`, player);
            }
            playerData.equipmentSlots[equipSlot] = {
                ...card,
                armorValue: card.armorValue || 0
            };
            log(`${player} equipped ${card.name} (${equipSlot})`, player);
            
            // Update hero max health based on armor
            updateHeroMaxHealth(player);
        }
        updateUI();
    }
}

function updateHeroMaxHealth(player) {
    const playerData = player === 'player' ? game.player : game.enemy;
    let armorBonus = 0;
    
    // Sum all armor values
    Object.values(playerData.equipmentSlots).forEach(equip => {
        if (equip && equip.armorValue) {
            armorBonus += equip.armorValue;
        }
    });
    
    // Base health is hero's starting health (from hero data), armor adds to max health
    // Always use hero.health as the base, never use maxHealth (which may already include armor)
    const baseHealth = playerData.hero?.health || GAME_CONSTANTS.STARTING_HEALTH || 30;
    const newMaxHealth = baseHealth + armorBonus;
    const oldMaxHealth = playerData.maxHealth || baseHealth;
    
    if (newMaxHealth !== oldMaxHealth) {
        const oldHealth = playerData.health;
        playerData.maxHealth = newMaxHealth;
        
        // If max health decreased, cap current health at new max (don't go below 0)
        if (newMaxHealth < oldMaxHealth) {
            const healthDecrease = oldMaxHealth - newMaxHealth;
            playerData.health = Math.max(0, Math.min(playerData.health, newMaxHealth));
            log(`${player} lost ${healthDecrease} max health from armor removal. Health capped at ${playerData.health}`, player);
        } else {
            // Max health increased - add the difference to current health
            const healthIncrease = newMaxHealth - oldMaxHealth;
            playerData.health += healthIncrease;
            // Ensure health doesn't exceed max health
            if (playerData.health > playerData.maxHealth) {
                playerData.health = playerData.maxHealth;
            }
            log(`${player} gained ${healthIncrease} health from armor! (${oldHealth} -> ${playerData.health}, max: ${newMaxHealth})`, player);
        }
    }
}

function triggerResonance(player) {
    const playerData = player === 'player' ? game.player : game.enemy;

    playerData.board.forEach(construct => {
        if (construct.keywords && construct.keywords.includes('resonance') && construct.resonanceEffect) {
            construct.resonanceEffect(game);
        }
    });
}

// ===== COMBAT =====

// Unit type counter system
// Infantry counters Cavalry
// Ranged counters Infantry
// Cavalry counters Ranged
function getTypeAdvantage(attacker, defender) {
    if (!attacker.unitType || !defender.unitType) return 0;

    const counters = {
        'infantry': 'cavalry',
        'ranged': 'infantry',
        'cavalry': 'ranged'
    };

    // Ranged advantage is applied at play time, so don't apply it again during combat
    // Only apply other type advantages during combat
    if (attacker.unitType === 'ranged' && defender.unitType === 'infantry') {
        return 0; // Already applied at play time
    }

    // Attacker has advantage
    if (counters[attacker.unitType] === defender.unitType) {
        return GAME_CONSTANTS.TYPE_ADVANTAGE_BONUS; // +2 damage bonus
    }

    // Defender has advantage (attacker is countered)
    if (counters[defender.unitType] === attacker.unitType) {
        return -GAME_CONSTANTS.TYPE_ADVANTAGE_BONUS; // -2 damage penalty
    }

    return 0; // No advantage
}

function getUnitTypeIcon(unitType) {
    switch(unitType) {
        case 'infantry': return '🛡️';
        case 'ranged': return '🏹';
        case 'cavalry': return '🐎';
        default: return '';
    }
}

function attack(attacker, target, attackerPlayer) {
    // In multiplayer mode, send action to server
    if (gameMode === 'multiplayer' && attackerPlayer === 'player') {
        // Determine if target is hero (check multiple ways it might be passed)
        const isHeroTarget = target === game.enemy.hero || 
                            target === game.enemy || 
                            (target.type === 'hero') ||
                            (target.name && (target.name === 'Enemy' || target.name === 'Enemy Hero'));
        
        const targetType = isHeroTarget ? 'hero' : 'unit';
        // For hero attacks, use a special identifier or null since heroes don't have instanceId
        const targetId = isHeroTarget ? 'hero' : (target.instanceId || target.id);
        
        console.log('[Attack] Sending attack to server:', {
            attacker: attacker.name,
            attackerId: attacker.instanceId,
            targetType: targetType,
            targetId: targetId,
            target: target
        });
        
        networkManager.sendAttack(attacker.instanceId, targetId, targetType);
        return true; // Action sent to server
    }

    if (!attacker.canAttack) {
        log('That construct cannot attack yet');
        return false;
    }

    // Check if unit is stunned
    if (attacker.stunned && attacker.stunnedUntil && game.turn < attacker.stunnedUntil) {
        log(`${attacker.name} is stunned and cannot attack!`);
        return false;
    }

    // Watch Tower cannot attack hero
    if (attacker.watchTowerEffect && attacker.cannotAttackHero) {
        const isHeroTarget = target === game.enemy.hero || 
                            target === game.enemy || 
                            (target.type === 'hero') ||
                            (target.name && (target.name === 'Enemy' || target.name === 'Enemy Hero'));
        if (isHeroTarget) {
            log('Watch Tower cannot attack the enemy hero!');
            return false;
        }
    }

    // Calculate Watch Tower power based on friendly bannermen
    if (attacker.watchTowerEffect) {
        const attackerData = attackerPlayer === 'player' ? game.player : game.enemy;
        const friendlyBannermen = attackerData.board.filter(u => u.instanceId !== attacker.instanceId);
        const basePower = attacker.power || 0;
        attacker.power = basePower + friendlyBannermen.length;
        if (friendlyBannermen.length > 0) {
            log(`${attacker.name} gains +${friendlyBannermen.length} attack from ${friendlyBannermen.length} friendly bannermen!`, attackerPlayer);
        }
    }

    const attackerData = attackerPlayer === 'player' ? game.player : game.enemy;
    const defenderPlayer = attackerPlayer === 'player' ? 'enemy' : 'player';
    const defenderData = defenderPlayer === 'player' ? game.player : game.enemy;

    log(`${attacker.name} attacks ${target.name || 'Commander'}`, attackerPlayer);

    // Play attack sound
    if (attackerPlayer === 'player' && SoundManager) {
        SoundManager.playAttack();
    }

    // Check for weapon effects
    if (attackerData.weapon && attackerData.weapon.id === 'battleAxe') {
        const enemyBoard = attackerPlayer === 'player' ? game.enemy.board : game.player.board;
        enemyBoard.forEach(construct => {
            dealDamage(construct, 1, attackerPlayer);
        });
        if (attackerData.weapon.currentUses !== undefined) {
            attackerData.weapon.currentUses--;
            if (attackerData.weapon.currentUses <= 0) {
                attackerData.weapon = null;
                log('Battle Axe destroyed');
            }
        }
    }

    if (target.type === 'construct' || target.type === 'unit') {
        // Unit vs Unit - RANGED NO HITBACK, MELEE HITS BACK
        const weaponBonus = attackerData.weapon ? attackerData.weapon.equipPower || 0 : 0;
        const typeAdvantage = getTypeAdvantage(attacker, target);
        const infantryBonus = attacker.unitType === 'infantry' ? 1 : 0;
        const cavalryBonus = attacker.unitType === 'cavalry' ? 1 : 0;
        
        // Hero passive bonus - only for specific heroes with damage passives
        let heroPassiveBonus = 0;
        if (attackerData.hero) {
            // Robin Hood: Your ranged units deal +1 damage
            if (attackerData.hero.id === 'robinHood' && attacker.unitType === 'ranged') {
                heroPassiveBonus = 1;
            }
            // Leonidas: Your infantry units deal +1 damage
            else if (attackerData.hero.id === 'leonidas' && attacker.unitType === 'infantry') {
                heroPassiveBonus = 1;
            }
            // Genghis Khan: Your cavalry units deal +1 damage
            else if (attackerData.hero.id === 'genghisKhan' && attacker.unitType === 'cavalry') {
                heroPassiveBonus = 1;
            }
        }
        
        let attackerPower = attacker.power + weaponBonus + typeAdvantage + infantryBonus + cavalryBonus + heroPassiveBonus;
        // Ensure minimum damage of 1
        attackerPower = Math.max(1, attackerPower);
        const defenderPower = target.power;
        const isRangedAttacker = attacker.unitType === 'ranged';
        const isRangedDefender = target.unitType === 'ranged';

        // Log type advantage
        if (typeAdvantage > 0) {
            log(`⚔️ TYPE ADVANTAGE! ${getUnitTypeIcon(attacker.unitType)} counters ${getUnitTypeIcon(target.unitType)} (+${typeAdvantage} damage)`, attackerPlayer);
        } else if (typeAdvantage < 0) {
            log(`⚠️ TYPE DISADVANTAGE! ${getUnitTypeIcon(target.unitType)} counters ${getUnitTypeIcon(attacker.unitType)} (${typeAdvantage} damage)`, attackerPlayer);
        }

        // Check for Protection/Ward
        if (target.keywords && (target.keywords.includes('ward') || target.keywords.includes('protection'))) {
            target.keywords = target.keywords.filter(k => k !== 'ward' && k !== 'protection');
            log(`${target.name}'s Protection blocked the attack`);
        } else {
            // Animate attacker
            const attackerElement = document.querySelector(`[data-card-id="${attacker.id}"]`);
            animateCardAttack(attackerElement);

            // Deal damage to target
            target.durability -= attackerPower;
            log(`${attacker.name} dealt ${attackerPower} damage to ${target.name}`);

            // Animate target taking hit
            const targetElement = document.querySelector(`[data-card-id="${target.id}"]`);
            setTimeout(() => animateCardHit(targetElement), 150);

            // Hit back logic: Ranged units don't take hitback, but ranged defenders always hit back
            // Melee units always hit back if attacked
            if (!isRangedAttacker && !isRangedDefender) {
                // Melee vs Melee: both hit back
                attacker.durability -= defenderPower;
                log(`${target.name} hit back for ${defenderPower} damage`);
                setTimeout(() => animateCardHit(attackerElement), 300);
            } else if (isRangedAttacker && !isRangedDefender) {
                // Ranged attacker vs Melee defender: ranged attacker doesn't take hitback
                // (Melee defender wants to hit back but ranged ignores it)
                log(`${target.name} tried to hit back but ranged ${attacker.name} evaded`);
            } else if (!isRangedAttacker && isRangedDefender) {
                // Melee attacker vs Ranged defender: ranged defender ALWAYS hits back
                attacker.durability -= defenderPower;
                log(`${target.name} hit back for ${defenderPower} damage`);
                setTimeout(() => animateCardHit(attackerElement), 300);
            } else {
                // Ranged vs Ranged: ranged defender still hits back
                attacker.durability -= defenderPower;
                log(`${target.name} hit back for ${defenderPower} damage`);
                setTimeout(() => animateCardHit(attackerElement), 300);
            }

            // Check for deaths
            if (target.durability <= 0) {
                destroyConstruct(target, defenderPlayer);
            }
            if (attacker.durability <= 0) {
                destroyConstruct(attacker, attackerPlayer);
            }
        }
    } else {
        // Unit vs Hero - ranged attacks don't hit back, melee do
        const isRanged = attacker.unitType === 'ranged';
        const damage = attacker.power + (attackerData.weapon ? attackerData.weapon.equipPower || 0 : 0);
        
        damageHero(defenderData, damage, attackerPlayer);
        
        // Melee attacks from units hit back (hero counter-attacks)
        // Ranged attacks don't trigger hit back
        // Hero must have a weapon equipped to counter-attack
        const hasWeapon = defenderData.equipmentSlots && defenderData.equipmentSlots.weapon;
        if (!isRanged && defenderData.health > 0 && hasWeapon) {
            const heroCounterDamage = 1; // Hero always hits back for 1 when attacked by melee
            attacker.durability -= heroCounterDamage;
            log(`${defenderData.hero.name} hit back for ${heroCounterDamage} damage`);

            if (attacker.durability <= 0) {
                destroyConstruct(attacker, attackerPlayer);
            }
        }
    }

    // Heavy Cavalry: Deal 1 damage to all enemy units when attacking
    if (attacker.id === 'heavyCavalry' && (attacker.keywords && attacker.keywords.includes('trample'))) {
        const enemyData = attackerPlayer === 'player' ? game.enemy : game.player;
        const enemyBoard = enemyData.board || [];
        
        if (enemyBoard.length > 0) {
            enemyBoard.forEach(unit => {
                if (unit.instanceId !== target.instanceId) { // Don't damage the target twice
                    dealDamage(unit, 1, attackerPlayer);
                }
            });
            log(`${attacker.name} trampled all enemy units for 1 damage!`, attackerPlayer);
        }
        
        // Also damage enemy hero
        if (enemyData.health > 0) {
            damageHero(enemyData, 1, attackerPlayer);
        }
    }

    // Catapult can attack twice - only exhaust if it hasn't attacked yet this turn
    if (attacker.doubleAttack && !attacker.hasAttacked) {
        attacker.hasAttacked = true;
        // Keep canAttack true for second attack
        attacker.canAttack = true;
        attacker.exhausted = false;
    } else {
        attacker.canAttack = false;
        attacker.exhausted = true;
        if (attacker.doubleAttack) {
            attacker.hasAttacked = false; // Reset for next turn
        }
    }

    // Reset Watch Tower power to base after attack
    if (attacker.watchTowerEffect) {
        const cardData = CARD_DATABASE[attacker.id] || window.CARD_DATABASE[attacker.id];
        if (cardData) {
            attacker.power = cardData.power || 0;
        }
    }

    updateUI();
    checkWinCondition();
    return true;
}

function dealDamage(target, amount, sourcePlayer) {
    if (target.keywords && (target.keywords.includes('ward') || target.keywords.includes('protection'))) {
        target.keywords = target.keywords.filter(k => k !== 'ward' && k !== 'protection');
        log(`${target.name}'s Protection blocked ${amount} damage`);
        return;
    }

    target.durability -= amount;
    log(`${target.name} took ${amount} damage`);

    if (target.durability <= 0) {
        const owner = game.player.board.includes(target) ? 'player' : 'enemy';
        destroyConstruct(target, owner);
    }
}

function damageHero(heroData, amount, sourcePlayer) {
    heroData.health -= amount;
    log(`Forgemaster took ${amount} damage`, heroData === game.player ? 'player' : 'enemy');

    // Animate hero hit
    const isEnemy = heroData === game.enemy;
    animateHeroHit(isEnemy);

    updateUI();
    checkWinCondition();
}

function destroyConstruct(construct, owner) {
    log(`${construct.name} was destroyed`, owner);

    // Play death sound
    if (SoundManager) {
        SoundManager.playDeath();
    }

    // Trigger Reckless keyword
    if (construct.keywords && construct.keywords.includes('reckless') && construct.recklessAmount) {
        const enemyPlayer = owner === 'player' ? 'enemy' : 'player';
        const enemyData = enemyPlayer === 'player' ? game.player : game.enemy;
        const enemyBoard = enemyPlayer === 'player' ? game.player.board : game.enemy.board;
        if (enemyBoard.length > 0) {
            const randomTarget = enemyBoard[Math.floor(Math.random() * enemyBoard.length)];
            dealDamage(randomTarget, construct.recklessAmount, owner);
        } else {
            damageHero(enemyData, construct.recklessAmount, owner);
        }
        log(`Reckless dealt ${construct.recklessAmount} damage`);
    }

    // Add destroy animation
    const boardId = owner === 'player' ? 'playerBoard' : 'enemyBoard';
    const boardEl = document.getElementById(boardId);
    if (boardEl) {
        const cardEls = boardEl.querySelectorAll('.card');
        cardEls.forEach(cardEl => {
            if (cardEl._cardData && cardEl._cardData.instanceId === construct.instanceId) {
                cardEl.classList.add('card-destroy-animation');
            }
        });
    }

    // Remove from board after animation
    setTimeout(() => {
        const ownerData = owner === 'player' ? game.player : game.enemy;
        const index = ownerData.board.findIndex(c => c.instanceId === construct.instanceId);
        if (index >= 0) ownerData.board.splice(index, 1);

        updateUI();
    }, 500); // Match animation duration
}

// ===== HERO POWERS =====

function useHeroPower(player, target = null) {
    // In multiplayer mode, send action to server
    if (gameMode === 'multiplayer' && player === 'player') {
        networkManager.sendUseHeroPower(target);
        return true; // Action sent to server
    }

    const playerData = player === 'player' ? game.player : game.enemy;
    const hero = playerData.hero;

    if (!hero) return false;

    // Check if this is a "Draw 1 card" ability
    if (hero.commandText && hero.commandText.includes('Draw 1 card')) {
        // Check if player has enough gold (2 gold cost)
        if (playerData.currentEssence < 2) {
            log('Not enough gold to use hero ability', player);
            return false;
        }
        // Draw a card
        if (playerData.deck.length > 0) {
            playerData.currentEssence -= 2;  // Deduct 2 gold for the ability
            const card = playerData.deck.pop();
            card.justDrawn = true;
            playerData.hand.push(card);
            log(`${hero.name} drew a card (spent 2 gold)`, player);
            playerData.heroPowerUsed = true;
            updateUI();
            return true;
        } else {
            log('No cards left in deck', player);
            return false;
        }
    }

    // Default: Hero power requires equipment to be equipped
    if (!playerData.equipment) {
        log('Hero needs a weapon equipped to attack', player);
        return false;
    }

    // Use equipment attack instead (hero power is now equipment-only)
    return useEquipmentAttack(player, target);
}

function useEquipmentAttack(player, target = null) {
    // In multiplayer mode, send action to server
    if (gameMode === 'multiplayer' && player === 'player') {
        // Check if target is hero (multiple ways it might be passed)
        const isHeroTarget = target === game.enemy.hero || 
                            target === game.enemy || 
                            (target && (target.type === 'hero' || target.id === 'enemyHero' || target.name === 'Enemy'));
        const targetType = isHeroTarget ? 'hero' : 'unit';
        const targetId = isHeroTarget ? 'hero' : (target?.instanceId || target?.id);
        
        console.log('[Equipment Attack] Sending to server:', {
            targetType: targetType,
            targetId: targetId,
            target: target
        });
        
        networkManager.sendUseEquipment(targetId, targetType);
        return true; // Action sent to server
    }

    const playerData = player === 'player' ? game.player : game.enemy;

    // Check weapon slot (legacy support for equipment)
    const weapon = (playerData.equipmentSlots && playerData.equipmentSlots.weapon) || playerData.equipment;

    if (!weapon) {
        log('No weapon equipped', player);
        return false;
    }
    
    if (playerData.equipmentUsed) {
        log('Equipment already used this turn', player);
        return false;
    }
    
    if (!target) {
        // Need to select target
        game.targeting = { mode: 'equipment', player };
        startEquipmentTargeting(player);
        return false;
    }
    
    let damage = weapon.attackPower || 2;
    const damageType = weapon.equipType;

    // Apply hero type bonus
    const heroUnitType = playerData.hero.unitType;
    if (target.type === 'unit' || target.type === 'construct') {
        // Hero attacking unit: apply type advantage
        if (heroUnitType === 'ranged' && target.unitType === 'infantry') {
            damage += 1;
            log(`🎯 TYPE ADVANTAGE! Ranged hero deals +1 attack vs Infantry`);
        } else if (heroUnitType === 'infantry' && target.unitType === 'cavalry') {
            damage += 1;
            log(`🎯 TYPE ADVANTAGE! Infantry hero deals +1 attack vs Cavalry`);
        } else if (heroUnitType === 'cavalry' && target.unitType === 'ranged') {
            damage += 1;
            log(`🎯 TYPE ADVANTAGE! Cavalry hero deals +1 attack vs Ranged`);
        }
    }

    if (target.type === 'unit' || target.type === 'construct') {
        // Equipment attack on unit - melee hits back
        if (damageType !== 'ranged') {
            // Melee: both take damage
            dealDamage(target, damage, player);
            const counterDamage = target.power || 1;
            playerData.health -= counterDamage;
            log(`${target.name} hit back for ${counterDamage} damage`);
        } else {
            // Ranged: no hit back
            dealDamage(target, damage, player);
        }
    } else {
        // Equipment attack on hero
        const enemyData = player === 'player' ? game.enemy : game.player;
        damageHero(enemyData, damage, player);
        
        // Melee equipment hits back (hero counter-attacks)
        // Enemy hero must have a weapon equipped to counter-attack
        const enemyHasWeapon = enemyData.equipmentSlots && enemyData.equipmentSlots.weapon;
        if (damageType !== 'ranged' && enemyData.health > 0 && enemyHasWeapon) {
            const counterDamage = 1; // Hero always hits back for 1
            playerData.health -= counterDamage;
            log(`${enemyData.hero.name} hit back for ${counterDamage} damage`);
            checkWinCondition();
        }
    }
    
    playerData.equipmentUsed = true;
    updateUI();
    checkWinCondition();
    return true;
}

function startRangerEquipmentTargeting(player) {
    // Set targeting mode
    game.targeting = { mode: 'rangerEquipment', player: player };
    document.body.classList.add('targeting');
    log('Select enemy equipment to destroy...', player);
    
    console.log('[Targeting] Starting Ranger equipment targeting');
    
    // Wait for UI to update, then target enemy equipment slots
    setTimeout(() => {
        const enemyEquipmentSlots = document.getElementById('enemyEquipmentSlots');
        if (enemyEquipmentSlots) {
            const slotElements = enemyEquipmentSlots.querySelectorAll('.equipment-slot');
            slotElements.forEach(slotEl => {
                // Get slot name from data attribute
                const slotName = slotEl.getAttribute('data-slot');
                const enemyData = player === 'player' ? game.enemy : game.player;
                const equipment = enemyData.equipmentSlots && enemyData.equipmentSlots[slotName];
                
                if (equipment) {
                    slotEl.classList.add('valid-target');
                    slotEl.style.cursor = 'pointer';
                    slotEl.style.border = '3px solid #ff7a7a';
                    slotEl.style.boxShadow = '0 0 10px rgba(255, 122, 122, 0.8)';
                    
                    // Store equipment data on element
                    slotEl._equipmentData = equipment;
                    slotEl._slotName = slotName;
                    
                    // Remove existing handlers and add new one
                    slotEl.onclick = null;
                    slotEl.addEventListener('click', (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        console.log('[Targeting] Equipment slot clicked:', equipment, 'slot:', slotName);
                        if (game.targeting && game.targeting.mode === 'rangerEquipment') {
                            destroyEnemyEquipment(player, slotName);
                            cancelTargeting();
                        }
                    }, { once: true });
                }
            });
        }
    }, 100);
}

function destroyEnemyEquipment(player, slotName) {
    const enemyData = player === 'player' ? game.enemy : game.player;
    const equipmentSlots = enemyData.equipmentSlots || {};
    
    const equipment = equipmentSlots[slotName];
    if (equipment) {
        equipmentSlots[slotName] = null;
        updateHeroMaxHealth(player === 'player' ? 'enemy' : 'player');
        log(`Ranger destroyed enemy ${equipment.name}!`, player);
        updateUI();
    }
}

function startEquipmentTargeting(player) {
    const playerData = player === 'player' ? game.player : game.enemy;
    const weapon = (playerData.equipmentSlots && playerData.equipmentSlots.weapon) || playerData.equipment;
    const equipType = weapon ? weapon.equipType : null;
    
    // Set targeting mode FIRST
    game.targeting = { mode: 'equipment', player: player };
    document.body.classList.add('targeting');
    log('Select target for equipment attack...', player);
    
    console.log('[Targeting] Starting equipment targeting, mode set to:', game.targeting.mode);
    
    // Can target any enemy
    const enemyBoard = document.getElementById('enemyBoard');
    if (enemyBoard) {
        const constructEls = enemyBoard.querySelectorAll('.card');
        constructEls.forEach(el => {
            if (el._cardData) {
                el.classList.add('valid-target');
                // Remove existing handlers and add new one
                el.onclick = null;
                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    console.log('[Targeting] Enemy unit clicked, current mode:', game.targeting?.mode);
                    if (game.targeting && game.targeting.mode === 'equipment') {
                        useEquipmentAttack(player, el._cardData);
                        cancelTargeting();
                    }
                }, { once: true });
            }
        });
    }
    
    // Target enemy hero via hero card - use setTimeout to ensure card exists
    setTimeout(() => {
        const enemyHeroCardContainer = document.getElementById('enemyHeroCard');
        if (enemyHeroCardContainer) {
            const heroCardEl = enemyHeroCardContainer.querySelector('.card');
            if (heroCardEl) {
                console.log('[Targeting] Found enemy hero card, adding targeting');
                heroCardEl.classList.add('valid-target');
                // Remove existing handlers
                heroCardEl.onclick = null;
                // Clone to remove all event listeners
                const newEl = heroCardEl.cloneNode(true);
                heroCardEl.parentNode.replaceChild(newEl, heroCardEl);
                newEl.classList.add('valid-target');
                newEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    console.log('[Targeting] Enemy hero card clicked, mode:', game.targeting?.mode);
                    if (game.targeting && game.targeting.mode === 'equipment') {
                        console.log('[Targeting] Executing hero attack');
                        // Pass enemy hero object directly for better compatibility
                        const enemyHeroTarget = game.enemy.hero || { type: 'hero', name: 'Enemy', id: 'enemyHero' };
                        useEquipmentAttack(player, enemyHeroTarget);
                        cancelTargeting();
                    }
                }, { once: true });
            } else {
                console.log('[Targeting] Hero card element not found in container');
            }
        } else {
            console.log('[Targeting] Enemy hero card container not found');
        }
    }, 100);
    
    // Also support old enemyLord element for backwards compatibility
    const enemyHero = document.getElementById('enemyLord');
    if (enemyHero) {
        enemyHero.classList.add('valid-target');
        enemyHero.onclick = null;
        enemyHero.addEventListener('click', () => {
            if (game.targeting && game.targeting.mode === 'equipment') {
                useEquipmentAttack(player, { type: 'hero', name: 'Enemy' });
                cancelTargeting();
            }
        }, { once: true });
    }
}

// ===== AI =====

function playAITurn() {
    const ai = game.enemy;

    // Phase 1: Equip weapons/armor if AI can afford it
    const equipableCards = ai.hand.filter(c => c.type === 'equipment' && canPlayCard(c, 'enemy'));
    if (equipableCards.length > 0) {
        // Prioritize weapons over armor
        const weapon = equipableCards.find(c => c.attackPower && c.attackPower > 0);
        if (weapon) {
            playCard(weapon, 'enemy');
        } else {
            // Otherwise equip armor
            const armor = equipableCards[0];
            if (armor) playCard(armor, 'enemy');
        }
    }

    // Phase 2: Use hero ability if beneficial
    const handSize = ai.hand.length;
    const shouldUseAbility = !ai.heroPowerUsed && ai.currentEssence >= 2 && handSize <= 3;
    if (shouldUseAbility) {
        // Use hero ability to draw a card
        const cost = ai.hero.commandCost || ai.hero.heroPowerCost || 2;
        if (ai.currentEssence >= cost) {
            ai.currentEssence -= cost;
            ai.heroPowerUsed = true;
            drawCard('enemy');
            log(`Enemy uses hero ability`, 'enemy');
        }
    }

    // Phase 3: Play cards (with safety limit)
    let cardsPlayed = 0;
    let lastHandSize = ai.hand.length;
    while (cardsPlayed < 10 && ai.hand.length > 0) {
        const playableCards = ai.hand.filter(card => canPlayCard(card, 'enemy'));
        if (playableCards.length === 0) break;

        // Priority 1: Play targeted abilities against player threats
        const targetedAbility = playableCards.find(c => (c.type === 'ability' || c.type === 'technique') && c.needsTarget);
        if (targetedAbility && game.player.board.length > 0) {
            // Target the player's strongest unit (highest attack)
            const threat = game.player.board.reduce((max, c) => (c.power || 0) > (max.power || 0) ? c : max);
            playCard(targetedAbility, 'enemy', threat);
            cardsPlayed++;
            if (ai.hand.length === lastHandSize) break;
            lastHandSize = ai.hand.length;
            continue;
        }

        // Priority 2: Play units/constructs
        const construct = playableCards.find(c => c.type === 'construct' || c.type === 'unit');
        if (construct) {
            playCard(construct, 'enemy');
            cardsPlayed++;
            if (ai.hand.length === lastHandSize) break;
            lastHandSize = ai.hand.length;
            continue;
        }

        // Priority 3: Play non-targeted abilities
        const technique = playableCards.find(c => (c.type === 'technique' || c.type === 'ability') && !c.needsTarget);
        if (technique) {
            playCard(technique, 'enemy');
            cardsPlayed++;
            if (ai.hand.length === lastHandSize) break;
            lastHandSize = ai.hand.length;
            continue;
        }

        break;
    }

    // Phase 4: Smart attacks with threat assessment
    setTimeout(() => {
        ai.board.forEach((construct, index) => {
            setTimeout(() => {
                if (construct.canAttack && !construct.exhausted) {
                    // Check for guards/defend - prioritize these
                    const guards = game.player.board.filter(c =>
                        c.keywords && (c.keywords.includes('guard') || c.keywords.includes('defend'))
                    );
                    if (guards.length > 0) {
                        // Always attack guards first
                        attack(construct, guards[0], 'enemy');
                    } else if (game.player.board.length > 0) {
                        // Attack the highest threat (highest attack power)
                        const threat = game.player.board.reduce((max, c) => (c.power || 0) > (max.power || 0) ? c : max);
                        attack(construct, threat, 'enemy');
                    } else {
                        // No units left, attack face
                        attack(construct, { name: 'Player', type: 'hero' }, 'enemy');
                    }
                }
            }, index * 800);
        });

        // Phase 5: Use remaining gold for defensive hero ability if under threat
        setTimeout(() => {
            const playerThreat = game.player.board.reduce((sum, c) => sum + (c.power || 0), 0);
            const aiDefense = ai.board.reduce((sum, c) => sum + (c.durability || 0), 0);
            if (!ai.heroPowerUsed && ai.currentEssence >= 2 && playerThreat > aiDefense && ai.health < ai.maxHealth) {
                // Draw more cards for better survival
                const cost = ai.hero.commandCost || ai.hero.heroPowerCost || 2;
                if (ai.currentEssence >= cost) {
                    ai.currentEssence -= cost;
                    ai.heroPowerUsed = true;
                    drawCard('enemy');
                    log(`Enemy uses hero ability defensively`, 'enemy');
                }
            }

            endTurn();
        }, (ai.board.length + 1) * 800);
    }, 1000);
}

// ===== WIN CONDITION =====

function checkWinCondition() {
    if (game.player.health <= 0) {
        showGameOver('Enemy Wins!');
    } else if (game.enemy.health <= 0) {
        showGameOver('You Win!');
    }
}

function showGameOver(message) {
    // Play victory/defeat sound
    if (SoundManager) {
        if (message.includes('Win')) {
            SoundManager.playVictory();
        } else if (message.includes('Lose') || message.includes('LOSS')) {
            SoundManager.playDefeat();
        }
    }
    
    // Track single-player match if logged in
    const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
    if (isLoggedIn && gameMode === 'singleplayer') {
        try {
            const userData = JSON.parse(sessionStorage.getItem('userData'));
            const token = localStorage.getItem('token');
            
            if (userData && userData.userId && token) {
                const result = message.includes('Win') ? 'win' : 'loss';
                const opponentName = 'AI Opponent';
                const duration = Math.floor((Date.now() - (window.gameStartTime || Date.now())) / 1000);
                const deckId = window.selectedHeroDeckId && window.selectedHeroDeckId !== 'default' ? window.selectedHeroDeckId : null;
                
                // Calculate XP (same formula as server)
                const xpGained = calculateSinglePlayerXP(result, duration);
                
                // Save match history
                fetch('/api/profile/' + userData.userId + '/match-history', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        opponent_name: opponentName,
                        result: result,
                        duration: duration,
                        deck_used_id: deckId,
                        game_mode: 'singleplayer'
                    })
                }).catch(err => console.error('Error saving match history:', err));
                
                // Award XP
                awardSinglePlayerXP(userData.userId, xpGained, token);
                
                // Update preferred unit type
                const unitType = game.player.hero?.unitType;
                if (unitType) {
                    fetch(`/api/profile/${userData.userId}`, {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            preferredUnitType: unitType
                        })
                    }).catch(err => console.error('Error updating preferred unit type:', err));
                }
            }
        } catch (e) {
            console.error('Error tracking match:', e);
        }
    }
    
    const modal = document.createElement('div');
    modal.className = 'game-info';
    modal.innerHTML = `
        <h2>${message}</h2>
        <p>Game Over</p>
        <div style="display: flex; gap: 20px; justify-content: center; flex-wrap: wrap;">
            <button onclick="this.closest('.game-info').remove()">Keep Playing</button>
            <button onclick="playAgain()">Play Again</button>
            <button onclick="returnToMainMenu()">Main Menu</button>
        </div>
    `;
    modal.id = 'gameOverModal';
    document.body.appendChild(modal);
}

function playAgain() {
    const gameOverModal = document.getElementById('gameOverModal');
    if (gameOverModal) {
        gameOverModal.style.display = 'none';
        gameOverModal.remove();
    }
    location.reload();
}

function returnToMainMenu() {
    // Hide game over modal immediately
    const gameOverModal = document.getElementById('gameOverModal');
    if (gameOverModal) {
        gameOverModal.style.display = 'none';
        gameOverModal.remove();
    }

    // Reset game state completely
    game.player.health = game.player.maxHealth;
    game.enemy.health = game.enemy.maxHealth;
    game.currentPlayer = 'player';
    game.player.board = [];
    game.enemy.board = [];
    game.player.hand = [];
    game.enemy.hand = [];
    game.player.heroPowerUsed = false;
    game.enemy.heroPowerUsed = false;

    // Show main menu, hide game board and modals
    const mainMenu = document.getElementById('mainMenuModal');
    const gameStartModal = document.getElementById('gameStartModal');
    const gameBoard = document.querySelector('.game-board');
    const bottomBar = document.querySelector('.bottom-bar');
    const gameLog = document.getElementById('gameLog');
    const handCardPreview = document.getElementById('handCardPreview');
    const endTurnBtn = document.getElementById('endTurnBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const overlay = document.getElementById('modalOverlay');

    if (mainMenu) mainMenu.style.display = 'block';
    if (gameStartModal) gameStartModal.style.display = 'none';
    if (overlay) overlay.style.display = 'block';
    if (gameBoard) gameBoard.style.display = 'none';
    if (bottomBar) bottomBar.style.display = 'none';
    if (gameLog) gameLog.style.display = 'none';
    if (handCardPreview) handCardPreview.style.display = 'none';
    if (endTurnBtn) endTurnBtn.style.display = 'none';
    if (settingsBtn) settingsBtn.classList.add('hidden');
    if (settingsModal) settingsModal.style.display = 'none';

    // Reset player name input based on login status
    const playerNameInput = document.getElementById('playerNameInput');
    if (playerNameInput) {
        const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
        if (isLoggedIn) {
            // First check if we have displayName stored in sessionStorage
            const storedDisplayName = sessionStorage.getItem('userDisplayName');
            if (storedDisplayName) {
                playerNameInput.value = storedDisplayName;
            } else {
                // Try to get displayName from profile, fallback to username
                try {
                    const userData = JSON.parse(sessionStorage.getItem('userData'));
                    if (userData) {
                        // Try to load profile to get displayName
                        const token = localStorage.getItem('token');
                        if (token && userData.userId) {
                            fetch(`/api/profile/${userData.userId}`, {
                                headers: { 'Authorization': `Bearer ${token}` }
                            })
                            .then(res => res.json())
                            .then(data => {
                                if (data.success && data.profile) {
                                    const nameToUse = data.profile.displayName || data.profile.username || '';
                                    if (nameToUse) {
                                        playerNameInput.value = nameToUse;
                                        sessionStorage.setItem('userDisplayName', nameToUse);
                                    }
                                } else if (userData.username) {
                                    playerNameInput.value = userData.username || '';
                                }
                            })
                            .catch(() => {
                                // Fallback to username from userData
                                if (userData.username) {
                                    playerNameInput.value = userData.username || '';
                                }
                            });
                        } else if (userData.username) {
                            playerNameInput.value = userData.username || '';
                        }
                    }
                } catch (e) {
                    // Fallback to guest name if parsing fails
                    const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
                    playerNameInput.value = `Anon${randomNum}`;
                }
            }
        } else {
            // Generate new random guest name
            const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
            playerNameInput.value = `Anon${randomNum}`;
        }
    }

    // Reset all boards and UI elements to empty state
    const playerBoard = document.getElementById('playerBoard');
    const enemyBoard = document.getElementById('enemyBoard');
    const playerHand = document.getElementById('playerHand');
    if (playerBoard) playerBoard.innerHTML = '';
    if (enemyBoard) enemyBoard.innerHTML = '';
    if (playerHand) playerHand.innerHTML = '';
}

// ===== UI UPDATES =====

/**
 * Animate a card flying from hand to the battlefield
 * @param {HTMLElement} cardElement - The card element to animate (will be cloned)
 * @param {string} owner - 'player' or 'enemy'
 * @param {HTMLElement} targetBoardElement - The board element where the card will land
 */
function animateCardPlay(cardElement, owner, targetBoardElement) {
    // Check if game board is visible
    const gameBoard = document.querySelector('.game-board');
    const boardVisible = gameBoard && gameBoard.style.display !== 'none' && gameBoard.offsetParent !== null;
    
    if (!boardVisible) {
        console.log('[Animation] Game board not visible yet, skipping card play animation');
        return;
    }
    
    // Get source hand position
    const hand = owner === 'player' ? document.getElementById('playerHand') : document.getElementById('enemyHandDisplay');
    if (!hand) {
        console.log('[Animation] Hand not found, skipping card play animation');
        return;
    }
    
    const handRect = hand.getBoundingClientRect();
    const startX = handRect.left + handRect.width / 2;
    const startY = handRect.top + handRect.height / 2;
    
    // Get target board position
    if (!targetBoardElement) {
        console.log('[Animation] Target board element not found, skipping card play animation');
        return;
    }
    
    const boardRect = targetBoardElement.getBoundingClientRect();
    const targetX = boardRect.left + boardRect.width / 2;
    const targetY = boardRect.top + boardRect.height / 2;
    
    // Clone the card element for animation
    const flyingCard = cardElement.cloneNode(true);
    flyingCard.classList.add('flying-card');
    flyingCard.style.position = 'fixed';
    flyingCard.style.left = startX + 'px';
    flyingCard.style.top = startY + 'px';
    flyingCard.style.transform = 'translate(-50%, -50%)';
    flyingCard.style.width = cardElement.offsetWidth + 'px';
    flyingCard.style.height = cardElement.offsetHeight + 'px';
    flyingCard.style.opacity = '1';
    flyingCard.style.zIndex = '10000';
    flyingCard.style.pointerEvents = 'none';
    
    // Add to body
    document.body.appendChild(flyingCard);
    
    // Force reflow
    flyingCard.offsetHeight;
    
    // Animate to target position
    const animation = flyingCard.animate([
        {
            left: startX + 'px',
            top: startY + 'px',
            transform: 'translate(-50%, -50%) scale(0.8) rotate(-15deg)',
            opacity: 1
        },
        {
            left: (startX + targetX) / 2 + 'px',
            top: (startY + targetY) / 2 + 'px',
            transform: 'translate(-50%, -50%) scale(1.2) rotate(5deg)',
            opacity: 1
        },
        {
            left: targetX + 'px',
            top: targetY + 'px',
            transform: 'translate(-50%, -50%) scale(1) rotate(0deg)',
            opacity: 0
        }
    ], {
        duration: 1500,
        easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        fill: 'forwards'
    });
    
    animation.onfinish = () => {
        if (flyingCard.parentNode) {
            flyingCard.parentNode.removeChild(flyingCard);
        }
    };
}

/**
 * Animate an ability card flying from hand to target
 * @param {HTMLElement} cardElement - The card element to animate (will be cloned)
 * @param {HTMLElement} targetElement - The target element (unit, hero, or battlefield center)
 */
function animateAbilityPlay(cardElement, targetElement) {
    // Check if game board is visible
    const gameBoard = document.querySelector('.game-board');
    const boardVisible = gameBoard && gameBoard.style.display !== 'none' && gameBoard.offsetParent !== null;
    
    if (!boardVisible) {
        console.log('[Animation] Game board not visible yet, skipping ability animation');
        return;
    }
    
    // Get source hand position
    const hand = document.getElementById('playerHand');
    if (!hand) {
        console.log('[Animation] Hand not found, skipping ability animation');
        return;
    }
    
    const handRect = hand.getBoundingClientRect();
    const startX = handRect.left + handRect.width / 2;
    const startY = handRect.top + handRect.height / 2;
    
    // Get target position
    let targetX, targetY;
    if (targetElement) {
        const targetRect = targetElement.getBoundingClientRect();
        targetX = targetRect.left + targetRect.width / 2;
        targetY = targetRect.top + targetRect.height / 2;
    } else {
        // No target (random) - fly to center of battlefield
        const battlefield = document.querySelector('.battlefield');
        if (!battlefield) {
            console.log('[Animation] Battlefield not found, skipping ability animation');
            return;
        }
        const battlefieldRect = battlefield.getBoundingClientRect();
        targetX = battlefieldRect.left + battlefieldRect.width / 2;
        targetY = battlefieldRect.top + battlefieldRect.height / 2;
    }
    
    // Clone the card element for animation
    const flyingCard = cardElement.cloneNode(true);
    flyingCard.classList.add('flying-card');
    flyingCard.style.position = 'fixed';
    flyingCard.style.left = startX + 'px';
    flyingCard.style.top = startY + 'px';
    flyingCard.style.transform = 'translate(-50%, -50%)';
    flyingCard.style.width = cardElement.offsetWidth + 'px';
    flyingCard.style.height = cardElement.offsetHeight + 'px';
    flyingCard.style.opacity = '1';
    flyingCard.style.zIndex = '10000';
    flyingCard.style.pointerEvents = 'none';
    
    // Add to body
    document.body.appendChild(flyingCard);
    
    // Force reflow
    flyingCard.offsetHeight;
    
    // Animate to target position
    const animation = flyingCard.animate([
        {
            left: startX + 'px',
            top: startY + 'px',
            transform: 'translate(-50%, -50%) scale(0.8) rotate(-15deg)',
            opacity: 1
        },
        {
            left: (startX + targetX) / 2 + 'px',
            top: (startY + targetY) / 2 + 'px',
            transform: 'translate(-50%, -50%) scale(1.3) rotate(10deg)',
            opacity: 1
        },
        {
            left: targetX + 'px',
            top: targetY + 'px',
            transform: 'translate(-50%, -50%) scale(0.5) rotate(0deg)',
            opacity: 0
        }
    ], {
        duration: 1200,
        easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        fill: 'forwards'
    });
    
    animation.onfinish = () => {
        if (flyingCard.parentNode) {
            flyingCard.parentNode.removeChild(flyingCard);
        }
    };
}

/**
 * Animate a card flying from the end turn button area to the hand
 * @param {HTMLElement} cardElement - The card element to animate (will be cloned)
 * @param {string} target - 'player' or 'enemy'
 */
function animateCardDraw(cardElement, target) {
    // Check if game board is visible
    const gameBoard = document.querySelector('.game-board');
    const boardVisible = gameBoard && gameBoard.style.display !== 'none' && gameBoard.offsetParent !== null;
    
    if (!boardVisible) {
        console.log('[Animation] Game board not visible yet, skipping animation');
        return;
    }
    
    // Get end turn button position (or use a fallback position)
    const endTurnBtn = document.getElementById('endTurnBtn');
    let startX, startY;
    
    if (endTurnBtn) {
        try {
            const btnRect = endTurnBtn.getBoundingClientRect();
            // Check if button has valid dimensions (is actually rendered)
            if (btnRect.width > 0 && btnRect.height > 0) {
                startX = btnRect.left + btnRect.width / 2;
                startY = btnRect.top + btnRect.height / 2;
            } else {
                // Button exists but has no dimensions - use fallback
                startX = window.innerWidth - 150;
                startY = window.innerHeight / 2;
                console.log('[Animation] End turn button has no dimensions, using fallback position');
            }
        } catch (e) {
            // Error getting button position - use fallback
            startX = window.innerWidth - 150;
            startY = window.innerHeight / 2;
            console.log('[Animation] Error getting end turn button position, using fallback:', e);
        }
    } else {
        // Fallback: use right side of screen (where end turn button typically is)
        startX = window.innerWidth - 150;
        startY = window.innerHeight / 2;
        console.log('[Animation] End turn button not found, using fallback position:', startX, startY);
    }
    
    // Get target hand position
    let targetX, targetY;
    if (target === 'player') {
        const playerHand = document.getElementById('playerHand');
        if (!playerHand) {
            console.log('[Animation] Player hand not found, skipping animation');
            return;
        }
        // Check if hand is visible
        const handVisible = playerHand.offsetParent !== null && playerHand.style.display !== 'none';
        if (!handVisible) {
            console.log('[Animation] Player hand not visible, skipping animation');
            return;
        }
        const handRect = playerHand.getBoundingClientRect();
        // Check if hand has valid dimensions
        if (handRect.width === 0 || handRect.height === 0) {
            console.log('[Animation] Player hand has no dimensions, skipping animation');
            return;
        }
        targetX = handRect.left + handRect.width / 2;
        targetY = handRect.top + handRect.height / 2;
    } else {
        const enemyHand = document.getElementById('enemyHandDisplay');
        if (!enemyHand) {
            console.log('[Animation] Enemy hand not found, skipping animation');
            return;
        }
        // Check if hand is visible
        const handVisible = enemyHand.offsetParent !== null && enemyHand.style.display !== 'none';
        if (!handVisible) {
            console.log('[Animation] Enemy hand not visible, skipping animation');
            return;
        }
        const handRect = enemyHand.getBoundingClientRect();
        // Check if hand has valid dimensions
        if (handRect.width === 0 || handRect.height === 0) {
            console.log('[Animation] Enemy hand has no dimensions, skipping animation');
            return;
        }
        targetX = handRect.left + handRect.width / 2;
        targetY = handRect.top + handRect.height / 2;
    }
    
    // Clone the card element for animation
    const flyingCard = cardElement.cloneNode(true);
    flyingCard.classList.add('flying-card');
    flyingCard.style.position = 'fixed';
    flyingCard.style.left = startX + 'px';
    flyingCard.style.top = startY + 'px';
    flyingCard.style.transform = 'translate(-50%, -50%)';
    flyingCard.style.width = cardElement.offsetWidth + 'px';
    flyingCard.style.height = cardElement.offsetHeight + 'px';
    flyingCard.style.opacity = '1';
    flyingCard.style.zIndex = '10000';
    flyingCard.style.pointerEvents = 'none';
    
    // Add to body
    document.body.appendChild(flyingCard);
    
    // Force reflow
    flyingCard.offsetHeight;
    
    // Animate to target position
    const animation = flyingCard.animate([
        {
            left: startX + 'px',
            top: startY + 'px',
            transform: 'translate(-50%, -50%) scale(0.8) rotate(15deg)',
            opacity: 1
        },
        {
            left: (startX + targetX) / 2 + 'px',
            top: (startY + targetY) / 2 + 'px',
            transform: 'translate(-50%, -50%) scale(1.2) rotate(-5deg)',
            opacity: 1
        },
        {
            left: targetX + 'px',
            top: targetY + 'px',
            transform: 'translate(-50%, -50%) scale(1) rotate(0deg)',
            opacity: 0
        }
    ], {
        duration: 2000,
        easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        fill: 'forwards'
    });
    
    // Remove element after animation
    animation.onfinish = () => {
        if (flyingCard.parentNode) {
            flyingCard.parentNode.removeChild(flyingCard);
        }
    };
}

function updateUI() {
    // Auto-merge any duplicate units on both boards before rendering
    autoMergeBoard('player');
    autoMergeBoard('enemy');

    // Update hero cards (attack and HP are now inside the cards)
    const playerHeroCardEl = document.getElementById('playerHeroCard');
    const enemyHeroCardEl = document.getElementById('enemyHeroCard');
    
    if (playerHeroCardEl && game.player.hero) {
        playerHeroCardEl.innerHTML = '';
        const heroCard = createHeroCard(game.player.hero, 'player');
        playerHeroCardEl.appendChild(heroCard);
    }
    
    if (enemyHeroCardEl && game.enemy.hero) {
        enemyHeroCardEl.innerHTML = '';
        const heroCard = createHeroCard(game.enemy.hero, 'enemy');
        enemyHeroCardEl.appendChild(heroCard);
    }

    if (game.player.hero) {
        // Update player lord name bar
        // Display player alias and flag
        const playerAliasEl = document.getElementById('playerAlias');
        if (playerAliasEl) {
            const flag = window.playerFlag || '⚔️';
            // Get the base player alias (name only, without flag)
            let playerAlias = window.playerAlias;
            
            // Ensure playerAlias is a string, not an HTML element
            if (playerAlias && typeof playerAlias !== 'string') {
                // If it's an element, try to get its value or textContent
                if (playerAlias.value !== undefined) {
                    playerAlias = playerAlias.value;
                } else if (playerAlias.textContent !== undefined) {
                    playerAlias = playerAlias.textContent;
                } else {
                    playerAlias = 'Player';
                }
            }
            
            // Strip any existing flag emoji from the start of the alias
            // This prevents the flag from being concatenated multiple times
            if (playerAlias && typeof playerAlias === 'string') {
                // Remove flag emoji and any leading/trailing spaces
                playerAlias = playerAlias.replace(/^[⚔️\s]+/, '').replace(/[\s]+$/, '').trim();
                // Also check if it starts with the current flag and remove it
                if (flag && playerAlias.startsWith(flag)) {
                    playerAlias = playerAlias.substring(flag.length).trim();
                }
            }
            
            // In multiplayer, use pendingPlayerName if playerAlias isn't set or is invalid
            if (!playerAlias || playerAlias === 'Player' || playerAlias.length === 0) {
                playerAlias = window.pendingPlayerName || 'Player';
            }
            
            // Ensure we only store the clean name (without flag) in window.playerAlias
            // This prevents accumulation of flags on subsequent updates
            window.playerAlias = playerAlias;
            
            // Display with flag (always use the clean name)
            playerAliasEl.textContent = `${flag} ${playerAlias}`;
        }

        // Apply theme colors and effect to body
        const themeKey = window.selectedTheme || 'blue';
        const theme = THEMES[themeKey];

        // Remove all theme effect classes and add the selected one
        document.body.classList.remove('theme-classic', 'theme-bubbles', 'theme-hearts', 'theme-sparkles', 'theme-flames');
        if (theme && theme.effect) {
            document.body.classList.add(`theme-${theme.effect}`);
        }

        // Apply theme colors to all player-side containers
        const skin = theme;
        if (skin) {
            // Apply to player board area
            const playerBoard = document.querySelector('.battle-row.player');
            if (playerBoard) {
                playerBoard.style.setProperty('background-color', skin.containerBg, 'important');
            }
            // Apply to player hand container
            const handContainer = document.querySelector('.hand-container');
            if (handContainer) {
                handContainer.style.setProperty('background-color', skin.containerBg, 'important');
            }
            // Apply to player hand
            const playerHand = document.querySelector('.player-hand');
            if (playerHand) {
                playerHand.style.setProperty('background-color', skin.containerBg, 'important');
            }
            // Apply to bottom bar (entire player area)
            const bottomBar = document.querySelector('.bottom-bar');
            if (bottomBar) {
                bottomBar.style.setProperty('background-color', skin.containerBg, 'important');
            }
            // Apply to bottom bar right (hero container with all controls)
            const bottomBarRight = document.querySelector('.bottom-bar-right');
            if (bottomBarRight) {
                bottomBarRight.style.setProperty('background-color', skin.containerBg, 'important');
            }
            // Apply to lord area
            const lordArea = document.querySelector('.lord-area.player');
            if (lordArea) {
                lordArea.style.setProperty('background-color', skin.containerBg, 'important');
            }
        }

        const playerCommand = document.getElementById('playerCommand');
        const playerWeaponCommand = document.getElementById('playerWeaponCommand');

        if (playerCommand) {
            const commandTitle = playerCommand.querySelector('.command-title');
            const commandCost = playerCommand.querySelector('.command-cost');
            const commandText = document.getElementById('playerCommandText');

            // Always show hero ability power
            if (commandTitle) {
                commandTitle.textContent = game.player.hero.commandName || 'Command';
            }
            if (commandCost) {
                const cost = game.player.hero.commandCost || game.player.hero.heroPowerCost || 2;
                commandCost.textContent = `${cost} Gold`;
            }
            if (commandText && game.player.hero) {
                commandText.textContent = game.player.hero.commandText || 'Draw 1 card';
            }

            // Check if affordable
            const cost = game.player.hero.commandCost || game.player.hero.heroPowerCost || 2;
            const canAfford = game.player.currentEssence >= cost;
            
            // Check if deck is empty (for "Draw 1 card" ability)
            const isDrawAbility = game.player.hero.commandText && game.player.hero.commandText.includes('Draw 1 card');
            const deckEmpty = isDrawAbility && (!game.player.deck || game.player.deck.length === 0);

            // Disable if already used or not player's turn
            const isDisabled = game.player.heroPowerUsed || game.currentPlayer !== 'player';
            const isNotAffordable = !canAfford && game.currentPlayer === 'player' && !game.player.heroPowerUsed;
            const isDeckEmpty = deckEmpty && game.currentPlayer === 'player' && !game.player.heroPowerUsed;

            playerCommand.classList.toggle('disabled', isDisabled);
            playerCommand.classList.toggle('not-affordable', isNotAffordable);
            playerCommand.classList.toggle('deck-empty', isDeckEmpty);
        }

        // Handle weapon attack button separately
        const weapon = (game.player.equipmentSlots && game.player.equipmentSlots.weapon) || game.player.equipment;
        if (playerWeaponCommand) {
            if (weapon) {
                playerWeaponCommand.style.display = '';
                const weaponTitle = playerWeaponCommand.querySelector('.command-title');
                if (weaponTitle) weaponTitle.textContent = `${weapon.name} Attack`;

                const isDisabled = game.player.equipmentUsed || game.currentPlayer !== 'player';
                playerWeaponCommand.classList.toggle('disabled', isDisabled);
            } else {
                playerWeaponCommand.style.display = 'none';
            }
        }
    }

    if (game.enemy.hero) {
        // Update enemy lord name bar
        // Update enemy alias/username
        const enemyAliasEl = document.getElementById('enemyAlias');
        if (enemyAliasEl) {
            const enemyFlag = typeof window.enemyFlag === 'string' ? window.enemyFlag : '⚔️';
            // Get enemy alias - try multiple sources
            let enemyAlias = typeof window.enemyAlias === 'string' ? window.enemyAlias : null;
            // Fallback to game.enemy.username if available
            if (!enemyAlias && game.enemy && game.enemy.username) {
                enemyAlias = game.enemy.username;
                window.enemyAlias = enemyAlias; // Cache it
            }
            // Last resort fallback
            if (!enemyAlias) {
                enemyAlias = 'Opponent';
            }
            
            // Strip any existing flag from the alias to prevent duplication
            if (enemyAlias && typeof enemyAlias === 'string') {
                enemyAlias = enemyAlias.replace(/^[⚔️\s]+/, '').trim();
            }

            // Clear and set the content
            enemyAliasEl.textContent = `${enemyFlag} ${enemyAlias}`;
            console.log('[UI] Updated enemy alias display:', enemyAlias, 'flag:', enemyFlag);
        }
    }
    
    // Add equipment attack click handler to player hero portrait
    const playerLord = document.getElementById('playerLord');
    if (playerLord) {
        // Remove old handlers
        playerLord.onclick = null;
        
        // Add new handler if weapon is available
        const weapon = (game.player.equipmentSlots && game.player.equipmentSlots.weapon) || game.player.equipment;
        if (weapon && !game.player.equipmentUsed && game.currentPlayer === 'player') {
            playerLord.classList.add('equipped');
            playerLord.onclick = () => {
                useEquipmentAttack('player');
            };
        } else {
            playerLord.classList.remove('equipped');
        }
    }
    
    // Update hero attack display
    updateHeroAttackDisplay('player');
    updateHeroAttackDisplay('enemy');
    
    // Update equipment slots display
    updateEquipmentSlots('player');
    updateEquipmentSlots('enemy');
    
    // Update equipment display (small box like gold) - legacy support
    const equipmentDisplay = document.getElementById('equipmentDisplay');
    if (equipmentDisplay) {
        const weapon = (game.player.equipmentSlots && game.player.equipmentSlots.weapon) || game.player.equipment;
        if (weapon) {
            equipmentDisplay.innerHTML = `
                <div class="equipment-name">${weapon.name}</div>
                <div class="equipment-stats">⚔️${weapon.attackPower || 2}</div>
            `;
            equipmentDisplay.style.display = 'flex';
        } else {
            equipmentDisplay.style.display = 'none';
        }
    }

    // Update essence/gold
    updateEssenceDisplay('player');
    updateEssenceDisplay('enemy');

    // Update deck counts (if elements exist)
    const playerDeckCount = document.getElementById('playerDeckCount');
    if (playerDeckCount) playerDeckCount.textContent = game.player.deck.length;
    const enemyDeckCount = document.getElementById('enemyDeckCount');
    if (enemyDeckCount) enemyDeckCount.textContent = game.enemy.deck.length;
    const enemyHandCount = document.getElementById('enemyHandCount');
    if (enemyHandCount) enemyHandCount.textContent = game.enemy.hand.length;

    // Update boards
    updateBoard('player');
    updateBoard('enemy');

    // Update hand
    updateHand();

    // Update enemy hand display
    updateEnemyHandDisplay();
    
    // Handle ability play animations
    if (game.abilityPlays && game.abilityPlays.length > 0) {
      const gameBoard = document.querySelector('.game-board');
      const boardVisible = gameBoard && gameBoard.style.display !== 'none' && gameBoard.offsetParent !== null;
      
      if (boardVisible) {
        game.abilityPlays.forEach(abilityPlay => {
          // Create a dummy card element for animation
          const dummyCard = createCardElement(abilityPlay.card, abilityPlay.owner, false);
          dummyCard.style.position = 'absolute';
          dummyCard.style.opacity = '0';
          dummyCard.style.pointerEvents = 'none';
          document.body.appendChild(dummyCard);
          
          // Animate ability play (null = random target, goes to battlefield center)
          animateAbilityPlay(dummyCard, null);
          
          // Clean up dummy card after animation
          setTimeout(() => {
            if (dummyCard.parentNode) {
              dummyCard.parentNode.removeChild(dummyCard);
            }
          }, 1200);
        });
      }
      
      // Clear processed ability plays
      game.abilityPlays = [];
    }
    
    // Show/hide end turn button based on current player
    const endTurnBtn = document.getElementById('endTurnBtn');
    const settingsBtn = document.getElementById('settingsBtn');

    if (endTurnBtn) {
        if (game.currentPlayer === 'player') {
            endTurnBtn.classList.remove('hidden');
            // Explicitly enable the button when it's the player's turn
            // (applyServerState also sets this, but ensure it's set here too)
            endTurnBtn.disabled = false;
            endTurnBtn.style.opacity = '1';
            endTurnBtn.style.cursor = 'pointer';
            
            // Check if player has no available moves - highlight green if so
            const hasMoves = hasAvailableMoves('player');
            if (!hasMoves) {
                endTurnBtn.style.background = 'linear-gradient(135deg, #2ecc71 0%, #27ae60 100%)';
                endTurnBtn.style.borderColor = '#2ecc71';
                endTurnBtn.style.boxShadow = '0 8px 25px rgba(46, 204, 113, 0.6), inset 0 2px 8px rgba(255, 255, 255, 0.2)';
            } else {
                // Reset to default red styling
                endTurnBtn.style.background = 'linear-gradient(135deg, #c41e3a 0%, #8b1a1a 100%)';
                endTurnBtn.style.borderColor = '#8b6f47';
                endTurnBtn.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.8), inset 0 2px 8px rgba(255, 215, 0, 0.2)';
            }
        } else {
            // Don't hide it, just disable it so players can see whose turn it is
            endTurnBtn.disabled = true;
            endTurnBtn.style.opacity = '0.5';
            endTurnBtn.style.cursor = 'not-allowed';
            // Reset to default styling when not player's turn
            endTurnBtn.style.background = 'linear-gradient(135deg, #c41e3a 0%, #8b1a1a 100%)';
            endTurnBtn.style.borderColor = '#8b6f47';
            endTurnBtn.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.8), inset 0 2px 8px rgba(255, 215, 0, 0.2)';
        }
    }
    
    // Also update the playerEndTurnBtn in the lord area
    const playerEndTurnBtn = document.getElementById('playerEndTurnBtn');
    if (playerEndTurnBtn) {
        if (game.currentPlayer === 'player') {
            playerEndTurnBtn.disabled = false;
            playerEndTurnBtn.style.opacity = '1';
            playerEndTurnBtn.style.cursor = 'pointer';
            
            // Check if player has no available moves - highlight green if so
            const hasMoves = hasAvailableMoves('player');
            if (!hasMoves) {
                playerEndTurnBtn.style.background = 'linear-gradient(135deg, #2ecc71 0%, #27ae60 100%)';
                playerEndTurnBtn.style.borderColor = '#2ecc71';
                playerEndTurnBtn.style.boxShadow = '0 8px 25px rgba(46, 204, 113, 0.6), inset 0 2px 8px rgba(255, 255, 255, 0.2)';
                playerEndTurnBtn.classList.add('no-moves');
            } else {
                // Reset to default red styling
                playerEndTurnBtn.style.background = 'linear-gradient(135deg, #c41e3a 0%, #8b1a1a 100%)';
                playerEndTurnBtn.style.borderColor = '#8b6f47';
                playerEndTurnBtn.style.boxShadow = 'none';
                playerEndTurnBtn.classList.remove('no-moves');
            }
        } else {
            playerEndTurnBtn.disabled = true;
            playerEndTurnBtn.style.opacity = '0.5';
            playerEndTurnBtn.style.cursor = 'not-allowed';
            // Reset to default styling when not player's turn
            playerEndTurnBtn.style.background = 'linear-gradient(135deg, #c41e3a 0%, #8b1a1a 100%)';
            playerEndTurnBtn.style.borderColor = '#8b6f47';
            playerEndTurnBtn.style.boxShadow = 'none';
        }
    }

    // Show settings button if game is in progress
    if (settingsBtn && game.player.hero && game.enemy.hero) {
        settingsBtn.classList.remove('hidden');
    }
}


function updateHeroAttackDisplay(player) {
    const lordId = player === 'player' ? 'playerLord' : 'enemyLord';
    const lordEl = document.getElementById(lordId);
    const playerData = player === 'player' ? game.player : game.enemy;

    if (!lordEl) return;

    const existingAttack = lordEl.querySelector('.lord-attack');
    if (existingAttack) existingAttack.remove();

    const weapon = (playerData.equipmentSlots && playerData.equipmentSlots.weapon) || playerData.equipment;
    const attackPower = weapon ? (weapon.attackPower || weapon.equipPower || 0) : 0;

    // Attack indicator is hidden, don't create the element
    // if (weapon) {
    //     const attackDisplay = document.createElement('div');
    //     attackDisplay.className = 'lord-attack';
    //     attackDisplay.innerHTML = `⚔️ <span>${attackPower}</span>`;
    //     lordEl.appendChild(attackDisplay);
    // }

    // Hero attack button removed - attack is now shown on hero card
}


function updateEquipmentSlots(player) {
    const playerData = player === 'player' ? game.player : game.enemy;
    const slotsContainer = document.getElementById(`${player}EquipmentSlots`);
    if (!slotsContainer) return;
    
    // Slot order: weapon, head, chest, legs, shield, boots
    const slotOrder = ['weapon', 'head', 'chest', 'legs', 'shield', 'boots'];
    slotsContainer.innerHTML = '';
    
    slotOrder.forEach(slotName => {
        const slot = document.createElement('div');
        slot.className = 'equipment-slot';
        slot.setAttribute('data-slot', slotName);
        
        const equip = playerData.equipmentSlots[slotName];
        if (equip) {
            slot.classList.add('filled');
            if (equip.armorValue) {
                slot.title = `${equip.name} (+${equip.armorValue} HP)`;
            } else {
                slot.title = `${equip.name} (⚔️${equip.attackPower || 2})`;
            }
        } else {
            slot.title = `${slotName} (empty)`;
        }
        
        slotsContainer.appendChild(slot);
    });
}

function updateEssenceDisplay(player) {
    const playerData = player === 'player' ? game.player : game.enemy;
    const goldText = document.getElementById(`${player}Gold`);
    const goldCoinsContainer = document.getElementById(`${player}GoldCoins`);

    if (goldText) {
        goldText.textContent = `${playerData.currentEssence}/${playerData.maxEssence}`;
    }

    if (goldCoinsContainer) {
        goldCoinsContainer.innerHTML = '';
        for (let i = 0; i < playerData.maxEssence; i++) {
            const coin = document.createElement('div');
            coin.className = 'gold-coin';
            if (i >= playerData.currentEssence) {
                coin.classList.add('spent');
            }
            goldCoinsContainer.appendChild(coin);
        }
    }
}

function updateBoard(player) {
    const board = document.getElementById(`${player}Board`);
    if (!board) return;

    const playerData = player === 'player' ? game.player : game.enemy;

    board.innerHTML = '';

    playerData.board.forEach(construct => {
        const cardEl = createCardElement(construct, player, true);
        cardEl.classList.add('card-enter-animation');
        // Store card data for click handlers
        cardEl._cardData = construct;
        // Add click handler for player's board only
        if (player === 'player' && game.currentPlayer === 'player') {
            cardEl.onclick = () => handleConstructClick(construct);
        }
        
        // Append card first
        board.appendChild(cardEl);
        
        // Handle card play animation (card flying from hand to board)
        if (construct.justPlayed) {
            // Temporarily hide the real card during animation
            cardEl.style.opacity = '0';
            
            // Find the card in hand to use as source (if it still exists)
            // Since the card was just played, we'll create a dummy card element
            const hand = player === 'player' ? document.getElementById('playerHand') : document.getElementById('enemyHandDisplay');
            let sourceCard = null;
            if (hand) {
                // Try to find a similar card in hand (for visual consistency)
                const handCards = hand.querySelectorAll('.card');
                if (handCards.length > 0) {
                    sourceCard = handCards[0]; // Use first card as source
                }
            }
            
            // If no source card found, create a dummy one
            if (!sourceCard) {
                sourceCard = createCardElement(construct, player, false);
                sourceCard.style.position = 'absolute';
                sourceCard.style.opacity = '0';
                sourceCard.style.pointerEvents = 'none';
                document.body.appendChild(sourceCard);
            }
            
            // Animate card play
            animateCardPlay(sourceCard, player, board);
            
            // Show the real card after animation completes
            setTimeout(() => {
                cardEl.style.opacity = '1';
                if (sourceCard.parentNode && sourceCard !== cardEl) {
                    sourceCard.parentNode.removeChild(sourceCard);
                }
            }, 1500);
            
            delete construct.justPlayed;
        }
    });
}

function updateHand() {
    const hand = document.getElementById('playerHand');
    if (!hand) {
        console.error('[UI] playerHand element not found!');
        return;
    }
    
    // Check if we have cards to display
    if (!game.player || !game.player.hand || !Array.isArray(game.player.hand)) {
        console.warn('[UI] No hand data available:', game.player);
        hand.innerHTML = '';
        return;
    }
    
    console.log(`[UI] Updating hand with ${game.player.hand.length} cards`);
    hand.innerHTML = '';

    // Group cards by ID and tier to stack duplicates
    // For ability cards, stack by ID only (no tier)
    const cardGroups = [];
    const groupMap = new Map(); // Track groups by key
    
    game.player.hand.forEach((card, index) => {
        // For ability cards, use just the ID (no tier)
        // For other cards, use ID + tier
        const groupKey = (card.type === 'ability' || card.type === 'technique') 
            ? card.id 
            : `${card.id}_T${card.tier || 1}`;
        
        // Check if a group already exists for this key
        if (groupMap.has(groupKey)) {
            // Add to existing group
            const group = groupMap.get(groupKey);
            group.cards.push(card);
        } else {
            // Create new group
            const newGroup = {
                key: groupKey,
                cards: [card],
                originalIndex: index
            };
            cardGroups.push(newGroup);
            groupMap.set(groupKey, newGroup);
        }
    });

    // Sort groups by type, but preserve relative order within same type
    const typeOrder = { 'equipment': 0, 'unit': 1, 'construct': 1, 'ability': 2 };
    cardGroups.sort((a, b) => {
        const typeA = typeOrder[a.cards[0].type] ?? 3;
        const typeB = typeOrder[b.cards[0].type] ?? 3;
        if (typeA !== typeB) {
            return typeA - typeB;
        }
        // If same type, preserve original order
        return a.originalIndex - b.originalIndex;
    });

    // Render cards or stacks in sorted order
    cardGroups.forEach((group) => {
        const cardList = group.cards;
        if (cardList.length === 1) {
            // Single card - render normally
            const card = cardList[0];
            const cardEl = createCardElement(card, 'player', false);
            
            // Append card first (so we can get its position for animation)
            hand.appendChild(cardEl);
            
            // Handle card draw animation (after appending so position is available)
            // Animate ANY card that was marked as justDrawn, regardless of whose turn it is
            // Cards drawn to player's hand should always animate to player's hand
            if (card.justDrawn) {
                // Show the card immediately while animation plays
                cardEl.style.opacity = '1';
                animateCardDraw(cardEl, 'player');
                delete card.justDrawn;
            }
        } else {
            // Multiple cards - create stack
            const stackEl = document.createElement('div');
            stackEl.className = 'card-stack';

            // Add all duplicate cards to the stack
            cardList.forEach((card, index) => {
                const cardEl = createCardElement(card, 'player', false);
                
                // Append card first
                stackEl.appendChild(cardEl);
                
                // Handle card draw animation for first card in stack (after appending)
                // Animate ANY card that was marked as justDrawn, regardless of whose turn it is
                if (card.justDrawn && index === 0) {
                    // Show the card immediately while animation plays
                    cardEl.style.opacity = '1';
                    animateCardDraw(cardEl, 'player');
                    delete card.justDrawn;
                }
            });

            // Add multiplier badge
            const badge = document.createElement('div');
            badge.className = 'card-multiplier';
            badge.textContent = `x${cardList.length}`;
            stackEl.appendChild(badge);

            hand.appendChild(stackEl);
        }
    });

    // Reset scroll to beginning when hand updates
    resetHandScroll();

    // Update scroll button visibility and positioning
    updateHandScroll();
}

function updateHandScroll() {
    // No scrolling needed - cards auto-scale to fit
    const hand = document.getElementById('playerHand');
    if (hand) {
        hand.style.transform = 'translateX(0)';
    }
    handScrollOffset = 0;
}

function scrollHandPrev() {
    if (handScrollOffset > 0) {
        handScrollOffset--;
        updateHandScroll();
    }
}

function scrollHandNext() {
    // Count actual visible card stacks/elements
    const hand = document.getElementById('playerHand');
    const handCount = hand ? hand.children.length : game.player.hand.length;

    if (handScrollOffset < handCount - CARDS_VISIBLE) {
        handScrollOffset++;
        updateHandScroll();
    }
}

// Reset hand scroll when hand updates
function resetHandScroll() {
    handScrollOffset = 0;
}

function updateEnemyHandDisplay() {
    const enemyHandDisplay = document.getElementById('enemyHandDisplay');
    if (!enemyHandDisplay) {
        console.error('[UI] enemyHandDisplay element not found!');
        return;
    }
    
    enemyHandDisplay.innerHTML = '';

    // Get player's theme for card back color
    const themeKey = window.selectedTheme || 'blue';
    const theme = THEMES[themeKey];

    // Show single card back with count indicator
    const handCount = game.enemy.hand ? game.enemy.hand.length : 0;
    
    if (handCount > 0) {
        const cardBack = document.createElement('div');
        cardBack.className = 'card-back enemy-hand-count';
        
        // Add count text
        const countText = document.createElement('div');
        countText.className = 'enemy-hand-count-text';
        countText.textContent = `x${handCount}`;
        cardBack.appendChild(countText);
        
        if (theme) {
            cardBack.style.backgroundColor = theme.cardBack;
            cardBack.style.borderColor = theme.cardBorder;
        }
        
        // Append card back first (so we can get its position for animation)
        enemyHandDisplay.appendChild(cardBack);
        
        // Add animation if a card was just drawn (after appending so we can get position)
        if (game.enemyHandJustDrawn === true) {
            console.log('[UI] Enemy hand just drawn - triggering animation');
            // Show the card back immediately while animation plays
            cardBack.style.opacity = '1';
            animateCardDraw(cardBack, 'enemy');
            game.enemyHandJustDrawn = false; // Reset flag
        } else {
            console.log('[UI] Enemy hand updated but enemyHandJustDrawn is:', game.enemyHandJustDrawn);
        }
    } else {
        // No cards in enemy hand - reset flag
        if (game.enemyHandJustDrawn) {
            console.log('[UI] Enemy hand is empty but flag was set - clearing flag');
            game.enemyHandJustDrawn = false;
        }
    }
}

// Calculate total power including all bonuses for display
function calculateTotalPower(card, playerData, enemyData) {
    if (!card || card.type !== 'unit' && card.type !== 'construct') {
        return card?.power || 0;
    }
    
    // Get base power from card database to avoid using modified power values
    // For Watch Tower and other cards that modify power during attacks, we need the original base power
    let basePower = card.power || 0;
    if (card.id && (window.CARD_DATABASE || CARD_DATABASE)) {
        const cardDatabase = window.CARD_DATABASE || CARD_DATABASE;
        const cardData = cardDatabase[card.id];
        if (cardData && cardData.power !== undefined) {
            // Use base power from database (for Watch Tower, this is 0)
            basePower = cardData.power || 0;
        }
    }
    
    let totalPower = basePower;
    
    // Formation bonus (from keyword)
    if (card.keywords && card.keywords.includes('formation')) {
        totalPower += 1;
    }
    
    // Formation bonus from other units
    const formationBonusCount = playerData.board.filter(c =>
        c.keywords && c.keywords.includes('formation') && c.instanceId !== card.instanceId
    ).length;
    totalPower += formationBonusCount;
    
    // Hero passive bonus - only for specific heroes with damage passives
    if (playerData.hero) {
        // Robin Hood: Your ranged units deal +1 damage
        if (playerData.hero.id === 'robinHood' && card.unitType === 'ranged') {
            totalPower += 1;
        }
        // Leonidas: Your infantry units deal +1 damage
        else if (playerData.hero.id === 'leonidas' && card.unitType === 'infantry') {
            totalPower += 1;
        }
        // Genghis Khan: Your cavalry units deal +1 damage
        else if (playerData.hero.id === 'genghisKhan' && card.unitType === 'cavalry') {
            totalPower += 1;
        }
    }
    
    // War General aura: All infantry gain +1/+1
    const hasWarGeneral = playerData.board.some(c => c.id === 'warGeneral' && c.auraEffect);
    if (hasWarGeneral && card.unitType === 'infantry') {
        totalPower += 1;
    }
    
    // Ranged vs Infantry bonus (already applied at play time, but include for display)
    if (card.unitType === 'ranged' && enemyData) {
        const hasEnemyInfantry = enemyData.board.some(c => c.unitType === 'infantry');
        if (hasEnemyInfantry) {
            totalPower += 1;
        }
    }
    
    // Watch Tower: Gets +1 attack for every friendly bannerman on the battlefield
    // Note: Watch Tower base power is 0, so totalPower starts at 0
    if (card.watchTowerEffect || card.id === 'watchTower') {
        // Count all friendly bannermen (units/constructs) excluding Watch Tower itself
        const friendlyBannermen = playerData.board.filter(u => 
            u.instanceId !== card.instanceId && 
            (u.type === 'unit' || u.type === 'construct')
        );
        // Add +1 attack for each friendly bannerman
        totalPower += friendlyBannermen.length;
    }
    
    return totalPower;
}

function createCardElement(card, owner, onBoard) {
    const cardEl = document.createElement('div');

    // Set card type class
    const cardType = card.type === 'unit' ? 'unit' : (card.type === 'ability' ? 'ability' : (card.type === 'equipment' ? 'equipment' : card.type));
    cardEl.className = `card ${cardType}`;

    if (card.exhausted) {
        cardEl.classList.add('exhausted');
    }

    if (!onBoard && owner === 'player' && game.currentPlayer === 'player') {
        if (canPlayCard(card, 'player')) {
            cardEl.classList.add('can-play');
        }
    }

    // Highlight cards that can attack
    if (onBoard && owner === 'player' && game.currentPlayer === 'player' && card.canAttack && !card.exhausted) {
        cardEl.classList.add('can-attack');
    }

    // Store card data for tooltip and reference
    cardEl._cardData = card;
    cardEl.setAttribute('data-card-id', card.id);
    
    // Calculate total power for display (on board only)
    // Hero cards should NOT use calculateTotalPower - they only show weapon attack
    let displayPower = card.power || 0;
    if (onBoard && (card.type === 'unit' || card.type === 'construct')) {
        // Check if this is a hero card - heroes are identified by being in HISTORIC_LEADERS
        const isHeroCard = card.id && window.HISTORIC_LEADERS && (
            Object.values(window.HISTORIC_LEADERS).some(heroList => 
                heroList.some(h => h.id === card.id)
            )
        );
        
        if (!isHeroCard) {
            const playerData = owner === 'player' ? game.player : game.enemy;
            const enemyData = owner === 'player' ? game.enemy : game.player;
            displayPower = calculateTotalPower(card, playerData, enemyData);
        }
        // For hero cards, displayPower is already set to card.power (weapon attack only)
    }
    
    // Compact card layout: Cost, Name on header, stats on bottom
    const hasStats = (card.type === 'construct' || card.type === 'unit' || card.type === 'equipment');
    const tierClass = card.tier ? `tier-${card.tier}` : 'tier-1';
    const hasAbility = card.keywords && card.keywords.length > 0;
    const abilityIndicator = onBoard && hasAbility ? `<div class="ability-indicator">⚡</div>` : '';

    cardEl.innerHTML = `
        <div class="card-header">
            ${card.cost !== undefined && card.cost !== null ? `<div class="card-cost">${card.cost}</div>` : ''}
            <div class="card-name ${tierClass}">${card.name}</div>
            ${abilityIndicator}
        </div>
        <div class="card-art-frame">
            <div class="card-art">${getCardArt(card)}</div>
        </div>
        <div class="card-text-box">
            <div class="card-text">${card.text || ''}</div>
        </div>
        ${hasStats ? `
            <div class="card-stats-footer">
                ${card.type === 'equipment' ? `
                    <div style="font-size: 10px; font-weight: 900; color: #fff; text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.9);">❤️${card.armorValue || card.attackPower || 0}</div>
                ` : `
                    <div class="card-stat stat-power">⚔️${displayPower}</div>
                    ${card.unitType && getUnitTypeIcon(card.unitType) ? `<div class="card-type-icon">${getUnitTypeIcon(card.unitType)}</div>` : ''}
                    <div class="card-stat stat-health">❤️${card.durability}</div>
                `}
            </div>
        ` : ''}
        ${onBoard && card.keywords ? `<div class="card-type-badge">${card.keywords.join(', ')}</div>` : ''}
    `;

    // Apply theme colors to player cards ONLY when on the board (not in hand)
    // This allows the green playable overlay to show properly on hand cards
    if (owner === 'player' && onBoard) {
        const themeKey = window.selectedTheme || 'blue';
        const theme = THEMES[themeKey];
        if (theme) {
            cardEl.style.backgroundColor = theme.cardBg;
            cardEl.style.borderColor = theme.cardBorder;
        }
    }

    // Add tooltip data attribute for description and effects
    let tooltipText = card.text || '';
    if (card.keywords && card.keywords.length > 0) {
        tooltipText += '\n\nKeywords: ' + card.keywords.join(', ');
    }
    if (card.scoutEffect || card.commandEffect || card.dispatchEffect) {
        tooltipText += '\n\nEffect: Draw a card when played';
    }
    if (card.id === 'quiverRefill' || card.id === 'supplyLine' || card.id === 'courierNetwork') {
        tooltipText += '\n\nEffect: Draw 3 cards';
    }
    if (card.id && (card.id.includes('Enchantment') || card.id.includes('Mark') || card.id.includes('Formation') || card.id.includes('Wall'))) {
        tooltipText += '\n\nEffect: Buffs units or equipment';
    }

    // For cards on board, add bonus breakdown
    if (onBoard && (card.type === 'construct' || card.type === 'unit')) {
        const playerData = owner === 'player' ? game.player : game.enemy;
        let bonusInfo = '\n\n⚔️ BONUS BREAKDOWN:';
        let totalBonus = 0;

        // Formation bonus
        if (card.keywords && card.keywords.includes('formation')) {
            bonusInfo += '\n• Formation: +1 (from formation keyword)';
            totalBonus += 1;
        }

        // Check other units with Formation
        const formationBonusCount = playerData.board.filter(c =>
            c.keywords && c.keywords.includes('formation') && c.instanceId !== card.instanceId
        ).length;
        if (formationBonusCount > 0) {
            bonusInfo += `\n• Formation (other units): +${formationBonusCount}`;
            totalBonus += formationBonusCount;
        }

        // Hero passive bonus - only for specific heroes with damage passives
        if (playerData.hero) {
            // Robin Hood: Your ranged units deal +1 damage
            if (playerData.hero.id === 'robinHood' && card.unitType === 'ranged') {
                bonusInfo += `\n• Hero Passive: +1 (${playerData.hero.name})`;
                totalBonus += 1;
            }
            // Leonidas: Your infantry units deal +1 damage
            else if (playerData.hero.id === 'leonidas' && card.unitType === 'infantry') {
                bonusInfo += `\n• Hero Passive: +1 (${playerData.hero.name})`;
                totalBonus += 1;
            }
            // Genghis Khan: Your cavalry units deal +1 damage
            else if (playerData.hero.id === 'genghisKhan' && card.unitType === 'cavalry') {
                bonusInfo += `\n• Hero Passive: +1 (${playerData.hero.name})`;
                totalBonus += 1;
            }
        }

        // Ranged vs Infantry bonus
        if (card.unitType === 'ranged') {
            const enemyData = owner === 'player' ? game.enemy : game.player;
            const hasEnemyInfantry = enemyData.board.some(c => c.unitType === 'infantry');
            if (hasEnemyInfantry) {
                bonusInfo += '\n• Ranged Advantage: +1 (vs Infantry)';
                totalBonus += 1;
            }
        }

        if (totalBonus > 0) {
            bonusInfo += `\n\nTotal Bonus: +${totalBonus} damage`;
            tooltipText += bonusInfo;
        }
    }

    if (tooltipText) {
        cardEl.setAttribute('data-description', tooltipText);
        cardEl.classList.add('card-tooltip');
    }

    // Click handlers
    if (!onBoard && owner === 'player' && game.currentPlayer === 'player') {
        cardEl.onclick = () => {
            // If in spell targeting mode, prevent targeting cards in hand
            if (game.targeting && game.targeting.mode === 'spell') {
                log('Cannot target a card in your hand', 'player');
                return;
            }
            handleCardPlay(card);
        };
    } else if (onBoard && owner === 'player' && game.currentPlayer === 'player') {
        cardEl.onclick = () => handleConstructClick(card);
    }

    // Hand card hover - show preview in sidebar
    if (!onBoard && owner === 'player') {
        cardEl.addEventListener('mouseenter', () => {
            const preview = document.getElementById('handCardPreview');
            if (!preview) return;

            const hasStats = (card.type === 'construct' || card.type === 'unit');

            let statsHTML = '';
            if (hasStats) {
                statsHTML = `
                    <div class="preview-stats">
                        <div class="preview-stat">⚔️${card.power}</div>
                        <div class="preview-stat">❤️${card.durability}</div>
                        <div class="preview-stat">💰${card.cost}</div>
                    </div>
                `;
            } else {
                statsHTML = `<div class="preview-stats"><div class="preview-stat">💰${card.cost}</div></div>`;
            }

            let keywordsHTML = '';
            if (card.keywords && card.keywords.length > 0) {
                keywordsHTML = `<div class="preview-keywords"><strong>Keywords:</strong> ${card.keywords.join(', ')}</div>`;
            }

            const previewContent = preview.querySelector('.preview-content');
            previewContent.innerHTML = `
                <div class="card-name">${card.name}${card.tier && card.tier > 1 ? ' T' + card.tier : ''}</div>
                ${statsHTML}
                <div class="preview-text">${card.text || '(No description)'}</div>
                ${keywordsHTML}
            `;
        });

        cardEl.addEventListener('mouseleave', () => {
            const preview = document.getElementById('handCardPreview');
            if (preview) {
                const previewContent = preview.querySelector('.preview-content');
                previewContent.innerHTML = '';
            }
        });
    }

    // Store reference
    cardEl._cardData = card;

    // Add hover preview for battlefield cards
    if (onBoard) {
        cardEl.addEventListener('mouseenter', (e) => {
            showCardPreview(card, e);
        });
        cardEl.addEventListener('mouseleave', () => {
            hideCardPreview();
        });
        cardEl.addEventListener('mousemove', (e) => {
            updateCardPreviewPosition(e);
        });
    }

    return cardEl;
}

function createHeroCard(hero, player) {
    // Create a hero card that looks like a bannerman card
    const playerData = player === 'player' ? game.player : game.enemy;
    const weapon = (playerData.equipmentSlots && playerData.equipmentSlots.weapon) || playerData.equipment;
    const attackPower = weapon ? (weapon.attackPower || weapon.equipPower || 0) : 0;
    
    // Ensure unitType is set - get from HISTORIC_LEADERS if missing
    let unitType = hero.unitType;
    if (!unitType && hero.id && window.HISTORIC_LEADERS) {
        // Search all hero types for this hero
        for (const type of ['ranged', 'infantry', 'cavalry']) {
            const heroList = window.HISTORIC_LEADERS[type] || [];
            const foundHero = heroList.find(h => h.id === hero.id);
            if (foundHero && foundHero.unitType) {
                unitType = foundHero.unitType;
                break;
            }
        }
    }
    
    // Create hero as a card-like object - use 'unit' type so stats are displayed
    const heroCard = {
        id: hero.id,
        name: hero.name,
        type: 'unit', // Use 'unit' type so createCardElement will include stats
        cost: null, // No cost for hero
        power: attackPower,
        durability: playerData.health,
        unitType: unitType, // Ensure unitType is set
        text: hero.passive || '',
        portrait: hero.portrait,
        color: hero.color
    };
    
    // Use createCardElement but modify for hero
    const cardEl = createCardElement(heroCard, player, true);
    
    // Override styling for hero card - gold text, no cost
    cardEl.classList.add('hero-card');
    const cardName = cardEl.querySelector('.card-name');
    if (cardName) {
        cardName.style.color = '#ffd700';
    }
    const cardCost = cardEl.querySelector('.card-cost');
    if (cardCost) {
        cardCost.style.display = 'none';
    }
    
    // Update header padding since there's no cost
    const cardHeader = cardEl.querySelector('.card-header');
    if (cardHeader) {
        cardHeader.style.padding = '4px 4px 4px 4px';
    }
    
    // Add click handler for hero card
    if (player === 'player') {
        // Player's hero card - click to attack (only when not targeting)
        cardEl.style.cursor = 'pointer';
        cardEl.style.pointerEvents = 'auto';
        cardEl.title = 'Click to attack with hero';
        // Add visual hover effect
        cardEl.addEventListener('mouseenter', () => {
            if (!game.targeting) {
                cardEl.style.transform = 'scale(1.05)';
                cardEl.style.transition = 'transform 0.2s';
            }
        });
        cardEl.addEventListener('mouseleave', () => {
            cardEl.style.transform = '';
        });
        cardEl.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            console.log('[Hero Card] Player hero card clicked, targeting:', game.targeting);
            // Only handle if not already targeting
            if (!game.targeting) {
                console.log('[Hero Card] Calling handleHeroCardClick');
                handleHeroCardClick(player);
            } else {
                console.log('[Hero Card] Already targeting, ignoring click');
            }
        });
    } else {
        // Enemy hero card - click handler will be set by targeting functions
        // Add a handler that checks for targeting state
        cardEl.style.cursor = 'pointer';
        cardEl.style.pointerEvents = 'auto';
        cardEl.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            console.log('[Hero Card] Enemy hero card clicked, targeting:', game.targeting);
            handleEnemyHeroCardClick();
        });
    }
    
    // Store hero data for reference
    cardEl._heroData = hero;
    cardEl._playerData = playerData;
    cardEl._isHeroCard = true;
    cardEl._heroPlayer = player;
    
    return cardEl;
}

function handleHeroCardClick(player) {
    console.log('[Hero Card] handleHeroCardClick called, currentPlayer:', game.currentPlayer, 'targeting:', game.targeting);
    
    if (game.currentPlayer !== 'player') {
        console.log('[Hero Card] Not player turn, ignoring');
        return;
    }
    
    // If already targeting, don't start new targeting
    if (game.targeting) {
        console.log('[Hero Card] Already targeting, ignoring');
        return;
    }
    
    // Check if player has a weapon equipped
    const playerData = game.player;
    const weapon = (playerData.equipmentSlots && playerData.equipmentSlots.weapon) || playerData.equipment;
    
    console.log('[Hero Card] Weapon check:', { 
        hasEquipmentSlots: !!playerData.equipmentSlots,
        hasWeapon: !!weapon,
        weapon: weapon 
    });
    
    if (!weapon) {
        log('Hero needs a weapon equipped to attack', 'player');
        console.log('[Hero Card] No weapon equipped');
        return;
    }
    
    console.log('[Hero Card] Starting equipment targeting');
    // Start hero attack targeting
    startEquipmentTargeting('player');
}

function handleEnemyHeroCardClick() {
    // Only handle if we're in targeting mode
    if (!game.targeting) {
        console.log('[Enemy Hero Card] No targeting mode active');
        return;
    }
    
    console.log('[Enemy Hero Card] Clicked, targeting mode:', game.targeting.mode);
    
    // Use the actual enemy hero object for better compatibility
    const targetHero = game.enemy.hero || game.enemy || { type: 'hero', name: 'Enemy', id: 'enemyHero' };
    
    if (game.targeting.mode === 'spell' || game.targeting.mode === 'ability') {
        // Ability targeting
        const card = game.targeting.card;
        playCard(card, 'player', targetHero);
        cancelTargeting();
    } else if (game.targeting.mode === 'equipment') {
        // Hero attack targeting
        console.log('[Enemy Hero Card] Calling useEquipmentAttack with target:', targetHero);
        useEquipmentAttack('player', targetHero);
        cancelTargeting();
    } else if (game.targeting.mode === 'heropower') {
        // Hero power targeting
        useHeroPower('player', targetHero);
        cancelTargeting();
    }
}

function getCardArt(card) {
    // Return emoji/icon based on card type and specific card
    if (card.type === 'hero') {
        // Return hero portrait
        return card.portrait || '👑';
    } else if (card.type === 'construct') {
        // Different icons for different constructs
        if (card.id.includes('ember') || card.id.includes('ash')) return '🔥';
        if (card.id.includes('frost') || card.id.includes('ice')) return '❄️';
        if (card.id.includes('storm')) return '⚡';
        if (card.id.includes('iron') || card.id.includes('scrap')) return '⚙️';
        if (card.id.includes('essence')) return '💠';
        if (card.id.includes('quick') || card.id.includes('assassin')) return '⚔️';
        return '🤖'; // Default construct
    } else if (card.type === 'technique') {
        // Different icons for different spells
        if (card.id.includes('lightning') || card.id.includes('chain')) return '⚡';
        if (card.id.includes('meteor') || card.id.includes('strike')) return '☄️';
        if (card.id.includes('shatter') || card.id.includes('reality')) return '💥';
        if (card.id.includes('forge') || card.id.includes('burst')) return '✨';
        return '🌟'; // Default technique
    } else if (card.type === 'forge') {
        // Different icons for different equipment
        if (card.id.includes('blade') || card.id.includes('weapon')) return '⚔️';
        if (card.id.includes('armor') || card.id.includes('plate')) return '🛡️';
        if (card.id.includes('conduit') || card.id.includes('essence')) return '💎';
        return '🔨'; // Default equipment
    }
    return '❓';
}

function getRaritySymbol(rarity) {
    switch (rarity) {
        case 'common': return '⚪';
        case 'rare': return '🔵';
        case 'epic': return '🟣';
        case 'legendary': return '🟡';
        default: return '';
    }
}

function handleCardPlay(card) {
    if (game.currentPlayer !== 'player') return;

    // Check if card needs targeting
    // Abilities with damage typically need a target (unless explicitly random)
    // Always require targeting for ability cards with damage property
    const needsTargeting = card.needsTarget || 
                          (card.targetType && card.targetType !== 'any') ||
                          (card.type === 'ability' && card.damage);

    if (needsTargeting) {
        console.log('[Card Play] Starting targeting for:', card.name, 'needsTarget:', card.needsTarget, 'targetType:', card.targetType, 'damage:', card.damage);
        startTargeting(card);
    } else {
        console.log('[Card Play] Playing card directly (no target needed):', card.name);
        playCard(card, 'player');
    }
}

function handleConstructClick(construct) {
    if (game.currentPlayer !== 'player') return;

    // Only handle attacking - spell targeting is now handled by startTargeting() click handlers
    if (!game.targeting) {
        // Attack with this construct - check canAttack and not exhausted
        // Also find the actual construct from the board to ensure we have the latest data
        const actualConstruct = game.player.board.find(c => c.instanceId === construct.instanceId);
        if (actualConstruct && actualConstruct.canAttack && !actualConstruct.exhausted) {
            startAttacking(actualConstruct);
        } else if (actualConstruct) {
            console.log('[Click] Cannot attack:', {
                canAttack: actualConstruct.canAttack,
                exhausted: actualConstruct.exhausted,
                name: actualConstruct.name
            });
        }
    }
}

function startTargeting(card) {
    // Determine mode based on card type
    const mode = card.type === 'ability' ? 'ability' : 'spell';
    game.targeting = { card, mode: mode };
    document.body.classList.add('targeting');
    log('Select a target for ' + card.name + '...', 'player');

    // For ability cards with damage, always allow targeting enemy units and heroes
    // (unless targetType explicitly restricts to units only)
    const canTargetHero = !card.targetType || card.targetType === 'any' || (card.type === 'ability' && card.damage);
    
    // Add visual highlights and click handlers to valid targets
    if (card.targetType === 'unit' || card.targetType === 'construct') {
        // Check if this is Tactical Retreat (targets friendly bannermen)
        if (card.id === 'tacticalRetreat' || card.targetType === 'bannerman') {
            // Tactical Retreat: Target friendly units/constructs only
            const playerBoard = document.getElementById('playerBoard');
            if (playerBoard) {
                const constructEls = playerBoard.querySelectorAll('.card');
                constructEls.forEach(el => {
                    if (el._cardData) {
                        el.classList.add('valid-target');
                        el.onclick = () => {
                            if (game.targeting && (game.targeting.mode === 'spell' || game.targeting.mode === 'ability')) {
                                playCard(card, 'player', el._cardData);
                                cancelTargeting();
                            }
                        };
                    }
                });
            }
        } else {
            // Target enemy units/constructs only
            const enemyBoard = document.getElementById('enemyBoard');
            if (enemyBoard) {
                const constructEls = enemyBoard.querySelectorAll('.card');
                constructEls.forEach(el => {
                    if (el._cardData) {
                        el.classList.add('valid-target');
                        el.onclick = () => {
                            if (game.targeting && (game.targeting.mode === 'spell' || game.targeting.mode === 'ability')) {
                                playCard(card, 'player', el._cardData);
                                cancelTargeting();
                            }
                        };
                    }
                });
            }
            
            // If ability with damage, also allow hero targeting
            if (canTargetHero) {
                const enemyHeroCard = document.getElementById('enemyHeroCard');
                if (enemyHeroCard) {
                    const heroCardEl = enemyHeroCard.querySelector('.card');
                    if (heroCardEl) {
                        heroCardEl.classList.add('valid-target');
                        heroCardEl.onclick = () => {
                            if (game.targeting && (game.targeting.mode === 'spell' || game.targeting.mode === 'ability')) {
                                playCard(card, 'player', { type: 'hero', name: 'Enemy', id: 'enemyHero' });
                                cancelTargeting();
                            }
                        };
                    }
                }
            }
        }
    } else {
        // Can target any unit or hero
        const allBoards = ['enemyBoard', 'playerBoard'];
        allBoards.forEach(boardId => {
            const board = document.getElementById(boardId);
            if (board) {
                const constructEls = board.querySelectorAll('.card');
                constructEls.forEach(el => {
                    if (el._cardData) {
                        el.classList.add('valid-target');
                        el.onclick = () => {
                            if (game.targeting) {
                                if (game.targeting.mode === 'spell' || game.targeting.mode === 'ability') {
                                    playCard(card, 'player', el._cardData);
                                    cancelTargeting();
                                } else if (game.targeting.mode === 'heropower') {
                                    useHeroPower('player', el._cardData);
                                    cancelTargeting();
                                }
                            }
                        };
                    }
                });
            }
        });

        // Also allow targeting heroes via hero card
        const enemyHeroCard = document.getElementById('enemyHeroCard');
        if (enemyHeroCard) {
            const heroCardEl = enemyHeroCard.querySelector('.card');
            if (heroCardEl) {
                heroCardEl.classList.add('valid-target');
                heroCardEl.onclick = () => {
                    if (game.targeting) {
                        if (game.targeting.mode === 'spell' || game.targeting.mode === 'ability') {
                            playCard(card, 'player', { type: 'hero', name: 'Enemy', id: 'enemyHero' });
                            cancelTargeting();
                        } else if (game.targeting.mode === 'heropower') {
                            useHeroPower('player', { type: 'hero', name: 'Enemy', id: 'enemyHero' });
                            cancelTargeting();
                        }
                    }
                };
            }
        }
        
        // Also support old enemyLord element for backwards compatibility
        const enemyHero = document.getElementById('enemyLord');
        if (enemyHero) {
            enemyHero.classList.add('valid-target');
            enemyHero.onclick = () => {
                if (game.targeting) {
                    if (game.targeting.mode === 'spell' || game.targeting.mode === 'ability') {
                        playCard(card, 'player', { type: 'hero', name: 'Enemy' });
                        cancelTargeting();
                    } else if (game.targeting.mode === 'heropower') {
                        useHeroPower('player', { type: 'hero', name: 'Enemy' });
                        cancelTargeting();
                    }
                }
            };
        }
    }

    // Don't call updateUI() here - it would remove our click handlers!
}

function startHeroPowerTargeting() {
    const hero = game.player.hero;
    if (!hero) return;

    document.body.classList.add('targeting');
    
    if (hero.id === 'warLord') {
        // Can target any unit or hero
        const allBoards = ['enemyBoard', 'playerBoard'];
        allBoards.forEach(boardId => {
            const board = document.getElementById(boardId);
            if (board) {
                const constructEls = board.querySelectorAll('.card');
                constructEls.forEach(el => {
                    if (el._cardData) {
                        el.classList.add('valid-target');
                        el.onclick = () => {
                            if (game.targeting && game.targeting.mode === 'heropower') {
                                useHeroPower('player', el._cardData);
                                cancelTargeting();
                            }
                        };
                    }
                });
            }
        });

        // Target enemy hero via hero card
        const enemyHeroCard = document.getElementById('enemyHeroCard');
        if (enemyHeroCard) {
            const heroCardEl = enemyHeroCard.querySelector('.card');
            if (heroCardEl) {
                heroCardEl.classList.add('valid-target');
                heroCardEl.onclick = () => {
                    if (game.targeting && game.targeting.mode === 'heropower') {
                        useHeroPower('player', { type: 'hero', name: 'Enemy' });
                        cancelTargeting();
                    }
                };
            }
        }
        
        // Also support old enemyLord element for backwards compatibility
        const enemyHero = document.getElementById('enemyLord');
        if (enemyHero) {
            enemyHero.classList.add('valid-target');
            enemyHero.onclick = () => {
                if (game.targeting && game.targeting.mode === 'heropower') {
                    useHeroPower('player', { type: 'hero', name: 'Enemy' });
                    cancelTargeting();
                }
            };
        }
    } else if (hero.id === 'mountainKing' || hero.id === 'swiftRider') {
        // Can only target friendly units
        const playerBoard = document.getElementById('playerBoard');
        if (playerBoard) {
            const constructEls = playerBoard.querySelectorAll('.card');
            constructEls.forEach(el => {
                if (el._cardData) {
                    el.classList.add('valid-target');
                    el.onclick = () => {
                        if (game.targeting && game.targeting.mode === 'heropower') {
                            useHeroPower('player', el._cardData);
                            cancelTargeting();
                        }
                    };
                }
            });
        }
    }
}

function startAttacking(attacker) {
    game.targeting = { attacker, mode: 'attack' };
    document.body.classList.add('targeting');
    log(`${attacker.name} ready to attack! Select target...`, 'player');

    // Highlight the attacking card
    const playerBoard = document.getElementById('playerBoard');
    playerBoard.querySelectorAll('.card').forEach(el => {
        if (el._cardData && el._cardData.instanceId === attacker.instanceId) {
            el.classList.add('attacking');
        }
    });

    // Check for guards/defend
    const guards = game.enemy.board.filter(c => 
        c.keywords && (c.keywords.includes('guard') || c.keywords.includes('defend'))
    );

    // Add click handler to enemy hero card (if no guards)
    if (guards.length === 0) {
        // Use setTimeout to ensure hero card exists
        setTimeout(() => {
            const enemyHeroCard = document.getElementById('enemyHeroCard');
            const enemyHeroCardElement = enemyHeroCard?.querySelector('.card');
            if (enemyHeroCardElement) {
                enemyHeroCardElement.classList.add('valid-target');
                // Clone to remove old listeners
                const newElement = enemyHeroCardElement.cloneNode(true);
                enemyHeroCardElement.parentNode.replaceChild(newElement, enemyHeroCardElement);
                newElement.onclick = (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (game.targeting && game.targeting.mode === 'attack') {
                        console.log('[Attack] Targeting enemy hero card');
                        attack(game.targeting.attacker, game.enemy.hero || { name: 'Enemy', type: 'hero', id: 'enemyHero' }, 'player');
                        cancelTargeting();
                    }
                };
            } else {
                // Fallback to old enemyLord element
                const enemyHero = document.getElementById('enemyLord');
                if (enemyHero) {
                    enemyHero.classList.add('valid-target');
                    enemyHero.onclick = () => {
                        if (game.targeting && game.targeting.mode === 'attack') {
                            console.log('[Attack] Targeting enemy hero (fallback)');
                            attack(game.targeting.attacker, game.enemy.hero || { name: 'Enemy', type: 'hero', id: 'enemyHero' }, 'player');
                            cancelTargeting();
                        }
                    };
                }
            }
        }, 100);
    }

    // Add click handlers to enemy constructs
    const boardEl = document.getElementById('enemyBoard');
    if (boardEl) {
        const constructEls = boardEl.querySelectorAll('.card');
        constructEls.forEach(el => {
            const construct = el._cardData;
            if (construct) {
                // Only guards/defend can be targeted if they exist
                const hasGuard = construct.keywords && 
                    (construct.keywords.includes('guard') || construct.keywords.includes('defend'));
                if (guards.length === 0 || hasGuard) {
                    el.classList.add('valid-target');
                    el.onclick = () => {
                        if (game.targeting && game.targeting.mode === 'attack') {
                            attack(game.targeting.attacker, construct, 'player');
                            cancelTargeting();
                        }
                    };
                }
            }
        });
    }

    // Don't call updateUI() here - it would remove our click handlers!
}

function isValidTarget(target, card) {
    if (card.targetType === 'construct') {
        return target.type === 'construct';
    }
    return true;
}

function cancelTargeting() {
    game.targeting = null;
    document.body.classList.remove('targeting');

    // Remove all targeting highlights
    document.querySelectorAll('.valid-target').forEach(el => {
        el.classList.remove('valid-target');
        el.onclick = null;
    });

    document.querySelectorAll('.attacking').forEach(el => {
        el.classList.remove('attacking');
    });

    const enemyLord = document.getElementById('enemyLord');
    if (enemyLord) {
        enemyLord.onclick = null;
        enemyLord.classList.remove('valid-target');
    }

    updateUI();
}

// ===== EVENT LISTENERS =====

document.getElementById('endTurnBtn').onclick = () => {
    if (game.currentPlayer === 'player') {
        endTurn();
    }
};

// New player end turn button in lord-area
const playerEndTurnBtn = document.getElementById('playerEndTurnBtn');
if (playerEndTurnBtn) {
    playerEndTurnBtn.onclick = () => {
        if (game.currentPlayer === 'player') {
            endTurn();
        }
    };
}

const playerCommandEl = document.getElementById('playerCommand');
if (playerCommandEl) {
    playerCommandEl.onclick = () => {
        if (game.currentPlayer === 'player' && game.player.hero && !game.player.heroPowerUsed) {
            // Check if deck is empty (for "Draw 1 card" ability)
            const isDrawAbility = game.player.hero.commandText && game.player.hero.commandText.includes('Draw 1 card');
            const deckEmpty = isDrawAbility && (!game.player.deck || game.player.deck.length === 0);
            
            if (deckEmpty) {
                log('No cards left in deck', 'player');
                return;
            }
            
            // Use hero power/ability
            const hero = game.player.hero;
            if (hero.commandText && hero.commandText.includes('target')) {
                // Needs a target
                startTargeting({ ...hero, type: 'heropower', needsTarget: true });
            } else {
                // Direct hero power (usually deals damage or has effect)
                useHeroPower('player');
            }
        }
    };
}

const playerWeaponCommandEl = document.getElementById('playerWeaponCommand');
if (playerWeaponCommandEl) {
    playerWeaponCommandEl.onclick = () => {
        if (game.currentPlayer === 'player' && !game.player.equipmentUsed) {
            useEquipmentAttack('player');
        }
    };
}

// Cursor trail for targeting
let cursorGlowElement = null;
let trailCounter = 0;

document.addEventListener('mousemove', (e) => {
    if (!document.body.classList.contains('targeting')) {
        // Remove glow if not targeting
        if (cursorGlowElement) {
            cursorGlowElement.remove();
            cursorGlowElement = null;
        }
        return;
    }

    // Create or update cursor glow
    if (!cursorGlowElement) {
        cursorGlowElement = document.createElement('div');
        cursorGlowElement.className = 'cursor-glow player-glow';
        document.body.appendChild(cursorGlowElement);
    }
    cursorGlowElement.style.left = e.clientX + 'px';
    cursorGlowElement.style.top = e.clientY + 'px';

    // Create trail particles every few pixels
    trailCounter++;
    if (trailCounter % 3 === 0) {
        const trail = document.createElement('div');
        trail.className = 'cursor-trail player-trail';
        trail.style.width = '15px';
        trail.style.height = '15px';
        trail.style.left = (e.clientX - 7.5) + 'px';
        trail.style.top = (e.clientY - 7.5) + 'px';
        document.body.appendChild(trail);

        // Remove trail particle after animation completes
        setTimeout(() => {
            trail.remove();
        }, 600);
    }
});

// Clean up cursor glow when targeting ends
const originalCancelTargeting = cancelTargeting;
cancelTargeting = function() {
    originalCancelTargeting();
    if (cursorGlowElement) {
        cursorGlowElement.remove();
        cursorGlowElement = null;
    }
};

// Card Preview Functions
let cardPreviewEl = null;

function showCardPreview(card, event) {
    // Create preview element if it doesn't exist
    if (!cardPreviewEl) {
        cardPreviewEl = document.createElement('div');
        cardPreviewEl.className = 'card-preview';
        document.body.appendChild(cardPreviewEl);
    }

    // Build preview content
    const hasStats = (card.type === 'construct' || card.type === 'unit');

    // Calculate bonus breakdown for board cards
    let bonusHTML = '';
    if (hasStats) {
        // Determine owner by checking which board the card is in
        // Find the card element (event.target might be a child element)
        const cardElement = event.target.closest('.card') || event.target;
        const playerBoardEl = document.getElementById('playerBoard');
        const enemyBoardEl = document.getElementById('enemyBoard');
        const isPlayerCard = playerBoardEl && (playerBoardEl.contains(cardElement) || playerBoardEl.contains(event.target));
        const ownerClass = isPlayerCard ? 'player' : 'enemy';
        const playerData = ownerClass === 'player' ? game.player : game.enemy;
        let bonusInfo = [];
        let totalBonus = 0;

        // Formation bonus
        if (card.keywords && card.keywords.includes('formation')) {
            bonusInfo.push('Formation: +1');
            totalBonus += 1;
        }

        // Check other units with Formation
        const formationBonusCount = playerData.board.filter(c =>
            c.keywords && c.keywords.includes('formation') && c.instanceId !== card.instanceId
        ).length;
        if (formationBonusCount > 0) {
            bonusInfo.push(`Formation (other units): +${formationBonusCount}`);
            totalBonus += formationBonusCount;
        }

        // Hero passive bonus - only for specific heroes with damage passives
        if (playerData.hero) {
            // Robin Hood: Your ranged units deal +1 damage
            if (playerData.hero.id === 'robinHood' && card.unitType === 'ranged') {
                bonusInfo.push(`Hero Passive: +1 (${playerData.hero.name})`);
                totalBonus += 1;
            }
            // Leonidas: Your infantry units deal +1 damage
            else if (playerData.hero.id === 'leonidas' && card.unitType === 'infantry') {
                bonusInfo.push(`Hero Passive: +1 (${playerData.hero.name})`);
                totalBonus += 1;
            }
            // Genghis Khan: Your cavalry units deal +1 damage
            else if (playerData.hero.id === 'genghisKhan' && card.unitType === 'cavalry') {
                bonusInfo.push(`Hero Passive: +1 (${playerData.hero.name})`);
                totalBonus += 1;
            }
        }

        // Ranged vs Infantry bonus
        if (card.unitType === 'ranged') {
            const enemyData = ownerClass === 'player' ? game.enemy : game.player;
            const hasEnemyInfantry = enemyData.board.some(c => c.unitType === 'infantry');
            if (hasEnemyInfantry) {
                bonusInfo.push('Ranged Advantage: +1 (vs Infantry)');
                totalBonus += 1;
            }
        }

        if (bonusInfo.length > 0) {
            bonusHTML = `
                <div style="font-size: 16px; color: #2ecc71; margin-top: 8px; padding: 6px; border-top: 2px solid #555;">
                    <strong>⚔️ BONUS BREAKDOWN:</strong><br>
                    ${bonusInfo.map(b => `• ${b}`).join('<br>')}
                    <br><strong style="color: #ffd700;">Total Bonus: +${totalBonus}</strong>
                </div>
            `;
        }
    }

    cardPreviewEl.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; gap: 6px;">
            <span style="font-size: 22px; font-weight: bold; color: #ffd700; flex: 1; word-wrap: break-word;">${card.name}</span>
            <div style="background: radial-gradient(circle, #d4af37 0%, #aa8b2c 100%); width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; color: #fff; font-size: 20px; flex-shrink: 0;">${card.cost}</div>
        </div>
        ${hasStats ? `
            <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                <div style="background: radial-gradient(circle, #ff6b35 0%, #c41e3a 100%); width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; color: #fff; font-size: 20px;">⚔️${card.power}</div>
                <div style="background: radial-gradient(circle, #4ecdc4 0%, #2d8b85 100%); width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; color: #fff; font-size: 20px;">❤️${card.durability}</div>
            </div>
        ` : ''}
        <div style="font-size: 18px; line-height: 1.4; color: #f4e4c1; flex: 1; overflow-y: auto;">${card.text || ''}</div>
        ${card.keywords ? `<div style="font-size: 16px; color: #d4af37; margin-top: 8px;"><strong>Keywords:</strong> ${card.keywords.join(', ')}</div>` : ''}
        ${bonusHTML}
    `;

    cardPreviewEl.classList.add('visible');
    updateCardPreviewPosition(event);
}

function hideCardPreview() {
    if (cardPreviewEl) {
        cardPreviewEl.classList.remove('visible');
    }
}

function updateCardPreviewPosition(event) {
    if (!cardPreviewEl) return;
    const padding = 15;
    let left = event.clientX + padding;
    let top = event.clientY + padding;

    // Adjust if preview goes off-screen
    if (left + 280 > window.innerWidth) {
        left = event.clientX - 280 - padding;
    }
    if (top + 400 > window.innerHeight) {
        top = event.clientY - 400 - padding;
    }

    cardPreviewEl.style.left = left + 'px';
    cardPreviewEl.style.top = top + 'px';
}

// Right-click to cancel
document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (game.targeting) {
        cancelTargeting();
        log('Targeting cancelled');
    }
});


// COMPATIBILITY: Use HISTORIC_LEADERS and CARD_DATABASE from lords-of-war.js
// Helper function to apply attack animation to a card element
function animateCardAttack(cardElement) {
    if (!cardElement) return;
    cardElement.classList.remove('card-attack');
    // Trigger reflow to restart animation
    void cardElement.offsetWidth;
    cardElement.classList.add('card-attack');
}

// Helper function to apply hit animation to a card element
function animateCardHit(cardElement) {
    if (!cardElement) return;
    cardElement.classList.remove('card-hit');
    void cardElement.offsetWidth;
    cardElement.classList.add('card-hit');
}

// Helper function to apply hit animation to hero
function animateHeroHit(isEnemy) {
    const heroSection = isEnemy ? document.getElementById('enemy-hero-section') : document.getElementById('player-hero-section');
    if (!heroSection) return;
    heroSection.classList.remove('hero-hit');
    void heroSection.offsetWidth;
    heroSection.classList.add('hero-hit');
}

// Setup unit type tooltips
function setupUnitTypeTooltips() {
    const unitTypeInfo = {
        ranged: {
            title: 'Ranged',
            details: [
                'Do not get hit back when attacking melee units',
                'Cloth Armor',
                'High attack, low durability'
            ]
        },
        infantry: {
            title: 'Infantry',
            details: [
                'Balanced fighter with strong defense',
                'Heavy Armor',
                'Medium attack, medium durability',
                'Starts with a sword'
            ]
        },
        cavalry: {
            title: 'Cavalry',
            details: [
                'Mobile warriors with high attack',
                'Leather Armor',
                'Very high attack, low durability'
            ]
        }
    };

    const infoDivs = document.querySelectorAll('.unit-type-btn');
    const infoDisplay = document.getElementById('unitTypeInfo');

    if (!infoDisplay || infoDivs.length === 0) {
        console.warn('Unit type tooltip elements not found');
        return;
    }

    infoDivs.forEach(btn => {
        btn.addEventListener('mouseenter', function() {
            const type = this.getAttribute('data-type');
            const info = unitTypeInfo[type];
            if (info) {
                infoDisplay.innerHTML = '<strong>' + info.title + ':</strong><br>' + info.details.join('<br>');
            }
        });

        btn.addEventListener('mouseleave', function() {
            infoDisplay.innerHTML = 'Hover over a unit type to see details';
        });
    });

    console.log('Unit type tooltips initialized');
}

// This runs after lords-of-war.js has loaded
function initializeGameData() {
    // HISTORIC_LEADERS and CARD_DATABASE are already on window from lords-of-war.js
    // No need to reassign - just use window.HISTORIC_LEADERS and window.CARD_DATABASE

    // Ensure functions are available globally (replace the stubs with real functions)
    if (typeof window !== 'undefined') {
        window.startGame = startGame;
        window.chooseUnitType = chooseUnitType;
        window.selectHero = selectHero;
        window.showUnitTypeSelection = showUnitTypeSelection;
        window.returnToMainMenu = returnToMainMenu;
        window.selectTheme = selectTheme;
        window.openThemeSelector = openThemeSelector;
        window.closeThemeSelector = closeThemeSelector;
        window.populateThemeTable = populateThemeTable;
        window.openSettingsMenu = openSettingsMenu;
        window.closeSettingsMenu = closeSettingsMenu;
        window.closeSettingsModal = closeSettingsModal;
        window.saveSettings = saveSettings;
        window.switchGuideTab = switchGuideTab;
        window.submitBugReport = submitBugReport;
        window.clearBugReport = clearBugReport;
        window.concedeGame = concedeGame;
        window.returnToMainMenuFromGame = returnToMainMenuFromGame;
        window.setupUnitTypeTooltips = setupUnitTypeTooltips;
        window.startQuickMatch = startQuickMatch;
        window.confirmMultiplayerHero = confirmMultiplayerHero;
        window.selectMultiplayerUnitType = selectMultiplayerUnitType;
        window.selectMultiplayerHero = selectMultiplayerHero;
        window.selectCustomDecks = selectCustomDecks;
        window.selectCustomDeck = selectCustomDeck;
        window.selectRandomHero = selectRandomHero;
        window.cancelHeroSelection = cancelHeroSelection;
        window.cancelMatchmaking = cancelMatchmaking;
        window.startGameAfterRoll = startGameAfterRoll;

        // Initialize modal on page load
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                // Set player name based on login status
                const playerNameInput = document.getElementById('playerNameInput');
                if (playerNameInput) {
                    const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
                    if (isLoggedIn) {
                        // First check if we have displayName stored in sessionStorage
                        const storedDisplayName = sessionStorage.getItem('userDisplayName');
                        if (storedDisplayName) {
                            playerNameInput.value = storedDisplayName;
                        } else {
                            // Try to load profile to get displayName
                            try {
                                const userData = JSON.parse(sessionStorage.getItem('userData'));
                                if (userData && userData.userId) {
                                    const token = localStorage.getItem('token');
                                    if (token) {
                                        fetch(`/api/profile/${userData.userId}`, {
                                            headers: { 'Authorization': `Bearer ${token}` }
                                        })
                                        .then(res => res.json())
                                        .then(data => {
                                            if (data.success && data.profile) {
                                                const nameToUse = data.profile.displayName || data.profile.username || '';
                                                if (nameToUse) {
                                                    playerNameInput.value = nameToUse;
                                                    sessionStorage.setItem('userDisplayName', nameToUse);
                                                }
                                            } else if (userData.username) {
                                                playerNameInput.value = userData.username;
                                            }
                                        })
                                        .catch(() => {
                                            // Fallback to username
                                            if (userData.username) {
                                                playerNameInput.value = userData.username;
                                            }
                                        });
                                    } else if (userData.username) {
                                        playerNameInput.value = userData.username;
                                    }
                                }
                            } catch (e) {
                                // Fallback to guest name if parsing fails
                                const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
                                playerNameInput.value = `Anon${randomNum}`;
                            }
                        }
                    } else {
                        // Generate random guest name
                        const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
                        playerNameInput.value = `Anon${randomNum}`;
                    }
                }
                // Initialize theme box with default color (blue)
                const themeBox = document.getElementById('themeBoxBtn');
                if (themeBox && THEMES['blue']) {
                    themeBox.style.backgroundColor = THEMES['blue'].cardBg;
                    themeBox.style.borderColor = THEMES['blue'].cardBorder;
                }
                // Initialize flag selector dropdown
                if (typeof initializeFlagSelector === 'function') {
                    initializeFlagSelector();
                }
                if (typeof showUnitTypeSelection === 'function') {
                    showUnitTypeSelection();
                }
            });
        } else {
            // Set player name based on login status
            const playerNameInput = document.getElementById('playerNameInput');
            if (playerNameInput) {
                const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
                if (isLoggedIn) {
                    // First check if we have displayName stored in sessionStorage
                    const storedDisplayName = sessionStorage.getItem('userDisplayName');
                    if (storedDisplayName) {
                        playerNameInput.value = storedDisplayName;
                    } else {
                        // Try to load profile to get displayName
                        try {
                            const userData = JSON.parse(sessionStorage.getItem('userData'));
                            if (userData && userData.userId) {
                                const token = localStorage.getItem('token');
                                if (token) {
                                    fetch(`/api/profile/${userData.userId}`, {
                                        headers: { 'Authorization': `Bearer ${token}` }
                                    })
                                    .then(res => res.json())
                                    .then(data => {
                                        if (data.success && data.profile) {
                                            const nameToUse = data.profile.displayName || data.profile.username || '';
                                            if (nameToUse) {
                                                playerNameInput.value = nameToUse;
                                                sessionStorage.setItem('userDisplayName', nameToUse);
                                            }
                                        } else if (userData.username) {
                                            playerNameInput.value = userData.username;
                                        }
                                    })
                                    .catch(() => {
                                        // Fallback to username
                                        if (userData.username) {
                                            playerNameInput.value = userData.username;
                                        }
                                    });
                                } else if (userData.username) {
                                    playerNameInput.value = userData.username;
                                }
                            }
                        } catch (e) {
                            // Fallback to guest name if parsing fails
                            const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
                            playerNameInput.value = `Anon${randomNum}`;
                        }
                    }
                } else {
                    // Generate random guest name
                    const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
                    playerNameInput.value = `Anon${randomNum}`;
                }
            }
            // Initialize theme box with default color (blue)
            const themeBox = document.getElementById('themeBoxBtn');
            if (themeBox && THEMES['blue']) {
                themeBox.style.backgroundColor = THEMES['blue'].cardBg;
                themeBox.style.borderColor = THEMES['blue'].cardBorder;
            }
            // Initialize flag selector dropdown
            if (typeof initializeFlagSelector === 'function') {
                initializeFlagSelector();
            }
            if (typeof showUnitTypeSelection === 'function') {
                showUnitTypeSelection();
            }
        }
    }
}

// ===== MULTIPLAYER UI FUNCTIONS =====

function startQuickMatch() {
    const playerName = document.getElementById('playerNameInput')?.value || 'Player';

    // Store player name for later use
    window.pendingPlayerName = playerName;

    // Set game mode to multiplayer
    gameMode = 'multiplayer';
    setGameMode('multiplayer');

    // Show hero selection FIRST (before joining queue)
    document.getElementById('mainMenuModal').style.display = 'none';
    showMultiplayerHeroSelection();
}

// Store selected hero for multiplayer
let selectedMultiplayerHero = null;
let selectedHeroDeckId = 'default'; // 'default' or deck preset ID

// Track when game started to prevent immediate endTurn calls
let gameStartTime = 0;

function showMultiplayerHeroSelection() {
    document.getElementById('lobbyModal').style.display = 'none';
    document.getElementById('multiplayerHeroModal').style.display = 'flex';
    document.getElementById('modalOverlay').style.display = 'block';

    // Reset selections
    selectedMultiplayerHero = null;
    selectedHeroDeckId = 'default';
    
    // Reset deck selection UI
    const deckSelection = document.getElementById('heroDeckSelection');
    if (deckSelection) {
        deckSelection.style.display = 'none';
    }
    
    // Reset button styles
    updateUnitTypeButtonStyles(null);
    
    document.getElementById('multiplayerHeroDetails').style.display = 'none';
    document.getElementById('mechanicsBox').style.display = 'none';
    document.getElementById('confirmHeroBtn').style.display = 'none';

    // Hide game board
    const gameBoard = document.querySelector('.game-board');
    if (gameBoard) gameBoard.style.display = 'none';
}

function selectMultiplayerUnitType(unitType) {
    const HISTORIC_LEADERS = window.HISTORIC_LEADERS || {};
    const heroes = HISTORIC_LEADERS[unitType] || [];

    // Update button styles
    updateUnitTypeButtonStyles(unitType);

    const heroList = document.getElementById('multiplayerHeroList');
    heroList.innerHTML = '';

    heroes.forEach(hero => {
        const btn = document.createElement('button');
        btn.textContent = hero.name;
        btn.style.cssText = 'display: block; width: 100%; padding: 13px 11px; margin: 0; font-size: 24px; background: rgba(74, 144, 226, 0.15); border: 0; border-bottom: 1px solid rgba(139, 111, 71, 0.5); border-radius: 0; cursor: pointer; color: #f4e4c1; text-align: left; transition: all 0.15s; font-weight: 500;';
        btn.onmouseover = () => btn.style.background = 'rgba(74, 144, 226, 0.4)';
        btn.onmouseout = () => btn.style.background = 'rgba(74, 144, 226, 0.15)';
        btn.onclick = () => selectMultiplayerHero(hero);
        heroList.appendChild(btn);
    });

    // Reset hero selection
    selectedMultiplayerHero = null;
    selectedHeroDeckId = 'default';
    document.getElementById('multiplayerHeroDetails').style.display = 'none';
    document.getElementById('mechanicsBox').style.display = 'none';
    document.getElementById('confirmHeroBtn').style.display = 'none';
}

function selectCustomDecks() {
    // Update button styles
    updateUnitTypeButtonStyles('custom');
    
    const heroList = document.getElementById('multiplayerHeroList');
    heroList.innerHTML = '';

    const token = localStorage.getItem('token');
    const userData = sessionStorage.getItem('userData');
    const isLoggedIn = sessionStorage.getItem('isLoggedIn');
    
    console.log('[DECK] selectCustomDecks called');
    console.log('[DECK] Token exists:', !!token);
    console.log('[DECK] userData exists:', !!userData);
    console.log('[DECK] isLoggedIn:', isLoggedIn);
    
    if (!token) {
        console.log('[DECK] No token found');
        const msg = document.createElement('div');
        msg.textContent = 'Log in to see custom decks';
        msg.style.cssText = 'padding: 20px; text-align: center; color: #888; font-size: 18px;';
        heroList.appendChild(msg);
        return;
    }

    if (!userData) {
        console.log('[DECK] No userData found');
        const msg = document.createElement('div');
        msg.textContent = 'Log in to see custom decks';
        msg.style.cssText = 'padding: 20px; text-align: center; color: #888; font-size: 18px;';
        heroList.appendChild(msg);
        return;
    }

    let userId;
    try {
        const user = JSON.parse(userData);
        console.log('[DECK] Parsed userData:', user);
        userId = user.userId || user.id;
        console.log('[DECK] Extracted userId:', userId);
    } catch (e) {
        console.error('[DECK] Error parsing userData:', e);
        const msg = document.createElement('div');
        msg.textContent = 'Error loading user data';
        msg.style.cssText = 'padding: 20px; text-align: center; color: #888; font-size: 18px;';
        heroList.appendChild(msg);
        return;
    }

    if (!userId) {
        console.error('[DECK] No userId found in userData');
        const msg = document.createElement('div');
        msg.textContent = 'Log in to see custom decks';
        msg.style.cssText = 'padding: 20px; text-align: center; color: #888; font-size: 18px;';
        heroList.appendChild(msg);
        return;
    }

    console.log('[DECK] Loading all custom decks for userId:', userId);

    fetch(`/api/deck/${userId}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(async res => {
        console.log('[DECK] API response status:', res.status);
        if (!res.ok) {
            const errorText = await res.text();
            console.error('[DECK] Failed to load decks:', res.status, errorText);
            const msg = document.createElement('div');
            msg.textContent = `Failed to load decks (${res.status})`;
            msg.style.cssText = 'padding: 20px; text-align: center; color: #ff6b6b; font-size: 18px;';
            heroList.appendChild(msg);
            return;
        }
        const data = await res.json();
        console.log('[DECK] API response data:', data);
        
        if (data.success) {
            const decks = data.decks || [];
            
            console.log('[DECK] Found', decks.length, 'custom decks');
            console.log('[DECK] Decks data:', decks);

            if (decks.length === 0) {
                const msg = document.createElement('div');
                msg.textContent = 'No custom decks found. Create one in the Deck Builder!';
                msg.style.cssText = 'padding: 20px; text-align: center; color: #888; font-size: 18px;';
                heroList.appendChild(msg);
                return;
            }

            // Add buttons for each deck
            decks.forEach((deck, index) => {
                console.log(`[DECK] Processing deck ${index}:`, deck);
                const btn = document.createElement('button');
                btn.textContent = deck.deckName || `Deck ${deck.id}`;
                btn.style.cssText = 'display: block; width: 100%; padding: 13px 11px; margin: 0; font-size: 20px; background: rgba(76, 175, 80, 0.15); border: 0; border-bottom: 1px solid rgba(139, 111, 71, 0.5); border-radius: 0; cursor: pointer; color: #f4e4c1; text-align: left; transition: all 0.15s; font-weight: 500;';
                btn.onmouseover = () => btn.style.background = 'rgba(76, 175, 80, 0.4)';
                btn.onmouseout = () => btn.style.background = 'rgba(76, 175, 80, 0.15)';
                btn.onclick = () => {
                    console.log('[DECK] Clicked deck:', deck);
                    selectCustomDeck(deck);
                };
                heroList.appendChild(btn);
            });
            
            console.log('[DECK] Added', decks.length, 'deck buttons to list');
        } else {
            console.error('[DECK] API returned success: false', data);
            const msg = document.createElement('div');
            msg.textContent = data.message || 'Failed to load decks';
            msg.style.cssText = 'padding: 20px; text-align: center; color: #ff6b6b; font-size: 18px;';
            heroList.appendChild(msg);
        }
    })
    .catch(error => {
        console.error('[DECK] Error loading custom decks:', error);
        const msg = document.createElement('div');
        msg.textContent = 'Error loading decks: ' + error.message;
        msg.style.cssText = 'padding: 20px; text-align: center; color: #ff6b6b; font-size: 18px;';
        heroList.appendChild(msg);
    });

    // Reset hero selection
    selectedMultiplayerHero = null;
    selectedHeroDeckId = 'default';
    document.getElementById('multiplayerHeroDetails').style.display = 'none';
    document.getElementById('mechanicsBox').style.display = 'none';
    document.getElementById('confirmHeroBtn').style.display = 'none';
}

function updateUnitTypeButtonStyles(selectedType) {
    const buttons = {
        'ranged': document.getElementById('rangedBtn'),
        'infantry': document.getElementById('infantryBtn'),
        'cavalry': document.getElementById('cavalryBtn'),
        'custom': document.getElementById('customBtn'),
        'random': document.getElementById('randomBtn')
    };

    // Reset all buttons
    Object.values(buttons).forEach(btn => {
        if (btn) {
            btn.style.opacity = '0.7';
            btn.style.transform = 'scale(1)';
        }
    });

    // Highlight selected button
    if (selectedType && buttons[selectedType]) {
        buttons[selectedType].style.opacity = '1';
        buttons[selectedType].style.transform = 'scale(1.05)';
    }
}

function selectRandomHero() {
    console.log('[DECK] Selecting random hero');
    
    // Update button styles
    updateUnitTypeButtonStyles('random');
    
    // Get all heroes from all unit types
    const HISTORIC_LEADERS = window.HISTORIC_LEADERS || {};
    const allHeroes = [];
    
    for (const unitType in HISTORIC_LEADERS) {
        const heroes = HISTORIC_LEADERS[unitType] || [];
        allHeroes.push(...heroes);
    }
    
    if (allHeroes.length === 0) {
        alert('No heroes available');
        return;
    }
    
    // Pick a random hero
    const randomHero = allHeroes[Math.floor(Math.random() * allHeroes.length)];
    console.log('[DECK] Random hero selected:', randomHero.name, '(hidden from user)');
    
    // Set selected hero with default deck
    selectedMultiplayerHero = randomHero;
    selectedHeroDeckId = 'default';
    
    // Clear the hero list
    const heroList = document.getElementById('multiplayerHeroList');
    heroList.innerHTML = '';
    
    // Show a generic message without revealing the hero
    const msg = document.createElement('div');
    msg.textContent = 'Random hero selected';
    msg.style.cssText = 'padding: 20px; text-align: center; color: #ffd700; font-size: 20px; font-weight: bold;';
    heroList.appendChild(msg);
    
    // Hide hero details and mechanics - don't reveal anything
    document.getElementById('multiplayerHeroDetails').style.display = 'none';
    document.getElementById('mechanicsBox').style.display = 'none';

    // Hide deck selection section
    const deckSelection = document.getElementById('heroDeckSelection');
    if (deckSelection) {
        deckSelection.style.display = 'none';
    }

    // Show confirm button
    document.getElementById('confirmHeroBtn').style.display = 'inline-block';
}

function selectCustomDeck(deck) {
    console.log('[DECK] Selected custom deck:', deck.deckName);
    
    // Find the hero associated with this deck
    const HISTORIC_LEADERS = window.HISTORIC_LEADERS || {};
    let hero = null;
    
    // Search for the hero by heroId
    for (const unitType in HISTORIC_LEADERS) {
        hero = HISTORIC_LEADERS[unitType].find(h => h.id === deck.heroId);
        if (hero) break;
    }

    if (!hero) {
        console.error('[DECK] Hero not found for deck:', deck.heroId);
        alert('Error: Hero not found for this deck');
        return;
    }

    // Set selected deck and hero
    selectedHeroDeckId = deck.id;
    selectedMultiplayerHero = hero;

    // Show hero details and mechanics
    document.getElementById('multiplayerHeroDetails').style.display = 'block';
    document.getElementById('mechanicsBox').style.display = 'block';

    // Show full description (or fallback to basic info)
    let descriptionText = hero.description;
    if (!descriptionText) {
        descriptionText = hero.name + '\n\nHP: ' + (hero.health || 30) + '\n\nPassive: ' + (hero.passive || 'Draw 1 card');
    }

    // Split description and mechanics
    const lines = descriptionText.split('\n');
    let descriptionLines = [];
    let mechanicsLines = [];
    let inMechanics = false;

    for (const line of lines) {
        if (line.includes('Mechanics:')) {
            inMechanics = true;
            mechanicsLines.push(line);
        } else if (inMechanics) {
            mechanicsLines.push(line);
        } else {
            descriptionLines.push(line);
        }
    }

    // Format and display description
    let formattedDescription = formatDescriptionOnly(descriptionLines);
    document.getElementById('selectedHeroPassive').innerHTML = formattedDescription;

    // Format and display mechanics with color coding
    let formattedMechanics = formatMechanicsOnly(mechanicsLines);
    document.getElementById('selectedHeroMechanics').innerHTML = formattedMechanics;

    // Hide deck selection section (we're using tabs now)
    const deckSelection = document.getElementById('heroDeckSelection');
    if (deckSelection) {
        deckSelection.style.display = 'none';
    }

    // Show confirm button
    document.getElementById('confirmHeroBtn').style.display = 'inline-block';
    
    console.log('[DECK] Selected deck:', deck.deckName, 'for hero:', hero.name);
}

function selectMultiplayerHero(hero) {
    console.log('[Game] Selected hero:', hero.name);
    selectedMultiplayerHero = hero;
    selectedHeroDeckId = 'default'; // Reset deck selection

    // Show hero details and mechanics
    document.getElementById('multiplayerHeroDetails').style.display = 'block';
    document.getElementById('mechanicsBox').style.display = 'block';

    // Show full description (or fallback to basic info)
    let descriptionText = hero.description;
    if (!descriptionText) {
        descriptionText = hero.name + '\n\nHP: ' + (hero.health || 30) + '\n\nPassive: ' + (hero.passive || 'Draw 1 card');
    }

    // Split description and mechanics
    const lines = descriptionText.split('\n');
    let descriptionLines = [];
    let mechanicsLines = [];
    let inMechanics = false;

    for (const line of lines) {
        if (line.includes('Mechanics:')) {
            inMechanics = true;
            mechanicsLines.push(line);
        } else if (inMechanics) {
            mechanicsLines.push(line);
        } else {
            descriptionLines.push(line);
        }
    }

    // Format and display description
    let formattedDescription = formatDescriptionOnly(descriptionLines);
    document.getElementById('selectedHeroPassive').innerHTML = formattedDescription;

    // Format and display mechanics with color coding
    let formattedMechanics = formatMechanicsOnly(mechanicsLines);
    document.getElementById('selectedHeroMechanics').innerHTML = formattedMechanics;

    // Reset deck selection to default when selecting a hero
    selectedHeroDeckId = 'default';

    // Hide deck selection section (we're using tabs now)
    const deckSelection = document.getElementById('heroDeckSelection');
    if (deckSelection) {
        deckSelection.style.display = 'none';
    }

    // Show confirm button
    document.getElementById('confirmHeroBtn').style.display = 'inline-block';
}

function formatDescriptionOnly(lines) {
    let html = '';

    for (const line of lines) {
        if (line === '') {
            html += '<br>';
        } else {
            html += '<div>' + escapeHtml(line) + '</div>';
        }
    }

    return html;
}

function formatMechanicsOnly(lines) {
    let html = '';

    for (const line of lines) {
        if (line.startsWith('• ')) {
            // Mechanics line - color code based on whether it's a counter or counter-to
            const mechanicText = line.substring(2); // Remove "• "
            if (mechanicText.includes('deal') || mechanicText.match(/^\w+ (deal|take)/)) {
                // Red - this is what counters this hero
                html += '<div style="color: #ff6b6b;">• ' + escapeHtml(mechanicText) + '</div>';
            } else {
                // Green - this is what this hero counters
                html += '<div style="color: #2ecc71;">• ' + escapeHtml(mechanicText) + '</div>';
            }
        } else if (line === '') {
            html += '<br>';
        } else {
            html += '<div>' + escapeHtml(line) + '</div>';
        }
    }

    return html;
}


function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Load decks for the selected hero in hero selection
function loadHeroDecks(heroId) {
    console.log('[DECK] loadHeroDecks called for hero:', heroId);
    
    // Ensure deck selection is visible
    const deckSelection = document.getElementById('heroDeckSelection');
    if (!deckSelection) {
        console.error('[DECK] heroDeckSelection element not found!');
        return;
    }
    deckSelection.style.display = 'block';
    console.log('[DECK] Deck selection element found and displayed');
    
    const deckList = document.getElementById('heroDeckList');
    if (!deckList) {
        console.error('[DECK] heroDeckList element not found!');
        return;
    }
    deckList.innerHTML = '';

    const token = localStorage.getItem('authToken');
    if (!token) {
        // Not logged in, only show default deck option
        console.log('[DECK] Not logged in, showing default deck only');
        return;
    }

    const userId = sessionStorage.getItem('userId');
    if (!userId) {
        // No userId, only show default deck option
        console.log('[DECK] No userId, showing default deck only');
        return;
    }

    console.log('[DECK] Loading decks for hero:', heroId, 'user:', userId);

    fetch(`/api/deck/${userId}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(async res => {
        if (!res.ok) {
            console.error('Failed to load decks:', res.status);
            return;
        }
        const data = await res.json();
        if (data.success) {
            const decks = data.decks || [];
            // Filter decks for this hero
            const heroDecks = decks.filter(d => d.heroId === heroId);
            
            console.log('[DECK] Found', heroDecks.length, 'decks for hero', heroId);

            if (heroDecks.length === 0) {
                // No custom decks, but keep deck selection visible with just default option
                console.log('[DECK] No custom decks found for this hero');
                return;
            }

            // Add radio buttons for each deck
            heroDecks.forEach(deck => {
                const label = document.createElement('label');
                label.style.cssText = 'display: flex; align-items: center; gap: 8px; padding: 8px; background: rgba(139, 111, 71, 0.2); border: 2px solid #8b6f47; border-radius: 4px; cursor: pointer; color: #f4e4c1;';
                
                const radio = document.createElement('input');
                radio.type = 'radio';
                radio.name = 'heroDeckSelect';
                radio.value = deck.id;
                radio.style.cssText = 'width: 18px; height: 18px; cursor: pointer;';
                radio.onchange = () => selectHeroDeck(deck.id);
                
                const span = document.createElement('span');
                span.style.fontSize = '16px';
                span.textContent = `${deck.deckName} (${deck.cardList.length} cards)`;
                
                label.appendChild(radio);
                label.appendChild(span);
                deckList.appendChild(label);
            });
        }
    })
    .catch(error => {
        console.error('Error loading hero decks:', error);
        // Keep deck selection visible even on error
    });
}

function selectHeroDeck(deckId) {
    selectedHeroDeckId = deckId;
    console.log('[Game] Selected deck:', deckId);
}

function confirmMultiplayerHero() {
    if (!selectedMultiplayerHero) {
        alert('Please select a hero first');
        return;
    }

    console.log('[Game] Confirming hero:', selectedMultiplayerHero.name);
    console.log('[Game] Current gameMode:', gameMode);
    console.log('[Game] networkManager exists:', !!networkManager);
    console.log('[Game] networkManager.isMultiplayer:', networkManager?.isMultiplayer);

    // Check if this is single player or multiplayer
    // If gameMode is explicitly 'singleplayer', treat as single player
    // Otherwise, if we're in the multiplayer hero modal, treat as multiplayer
    const isSinglePlayer = gameMode === 'singleplayer';
    console.log('[Game] Is single player?', isSinglePlayer);
    
    if (isSinglePlayer) {
        // Single player: close modal and start game directly
        console.log('[Game] Starting single player game');
        // Ensure gameMode is set correctly
        gameMode = 'singleplayer';
        setGameMode('singleplayer');
        document.getElementById('multiplayerHeroModal').style.display = 'none';
        startGame(selectedMultiplayerHero.id);
        return;
    }
    
    // Ensure gameMode is set to multiplayer
    gameMode = 'multiplayer';
    setGameMode('multiplayer');

    console.log('[Game] Starting multiplayer matchmaking');

    // Multiplayer: Hide hero selection modal and show lobby (searching for opponent)
    document.getElementById('multiplayerHeroModal').style.display = 'none';
    document.getElementById('lobbyModal').style.display = 'flex';

    // Disconnect any existing connection first
    if (window.networkManager && networkManager) {
        networkManager.disconnect();
        networkManager = null;
        window.networkManager = null;
    }

    // Create fresh network manager
    window.networkManager = new NetworkManager();
    networkManager = window.networkManager;

    // Load deck preset if one is selected (for multiplayer)
    let deckCardList = null;
    const loadDeckForMultiplayer = async () => {
        if (selectedHeroDeckId && selectedHeroDeckId !== 'default') {
            const token = localStorage.getItem('token') || localStorage.getItem('authToken');
            let userId = null;
            try {
                const userData = JSON.parse(sessionStorage.getItem('userData'));
                if (userData && userData.userId) {
                    userId = userData.userId;
                }
            } catch (e) {
                console.error('Error reading userData:', e);
            }
            
            if (token && userId) {
                try {
                    const res = await fetch(`/api/deck/${userId}/${selectedHeroDeckId}`, {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });
                    if (res.ok) {
                        const data = await res.json();
                        if (data.success && data.deck) {
                            // Convert card IDs to card objects
                            const CARD_DATABASE = window.CARD_DATABASE || {};
                            const cardIds = JSON.parse(data.deck.card_list);
                            deckCardList = [];
                            
                            // Count cards by ID
                            const cardCounts = {};
                            cardIds.forEach(cardId => {
                                cardCounts[cardId] = (cardCounts[cardId] || 0) + 1;
                            });
                            
                            // Create deck from card counts
                            Object.keys(cardCounts).forEach(cardId => {
                                const card = CARD_DATABASE[cardId];
                                if (card) {
                                    for (let i = 0; i < cardCounts[cardId]; i++) {
                                        deckCardList.push(card);
                                    }
                                } else {
                                    console.warn('Card not found in database:', cardId);
                                }
                            });
                            
                            console.log('[Game] Loaded deck preset for multiplayer:', data.deck.deck_name, 'with', deckCardList.length, 'cards');
                        }
                    }
                } catch (error) {
                    console.error('Error loading deck preset for multiplayer:', error);
                }
            }
        }
    };

    // Set up game found handler - if we already have a hero, send it immediately
    const gameFoundHandler = async () => {
        console.log('[Game] Opponent found! We have hero:', selectedMultiplayerHero?.name);
        
        // Load deck if needed
        await loadDeckForMultiplayer();
        
        // If we already have a hero selected, send it to the server immediately
        // This handles the case where the server didn't receive it in the queue data
        if (selectedMultiplayerHero && networkManager && networkManager.isConnected()) {
            console.log('[Game] Sending hero selection to server:', selectedMultiplayerHero.id, 'Deck:', selectedHeroDeckId);
            networkManager.socket.emit('selectHero', { 
                heroId: selectedMultiplayerHero.id, 
                hero: selectedMultiplayerHero,
                deckPresetId: selectedHeroDeckId !== 'default' ? selectedHeroDeckId : null,
                deckCardList: deckCardList // Send full deck card list
            });
        }
    };

    // Register game found handler
    networkManager.on('gameFound', gameFoundHandler);
    
    // Make sure gameStart handler is registered (it should be in initMultiplayer, but ensure it's there)
    // The gameStart handler is already registered in initMultiplayer(), so we don't need to register it again

    // Connect and wait for connection before joining queue
    initMultiplayer();

    // Get player name - prioritize logged-in username
    let playerName = window.pendingPlayerName;
    if (!playerName) {
        const playerNameInput = document.getElementById('playerNameInput');
        if (playerNameInput && playerNameInput.value) {
            playerName = playerNameInput.value.trim();
        }
    }
    
    // If still no name, check if user is logged in
    if (!playerName) {
        const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
        if (isLoggedIn) {
            // First check if we have displayName stored in sessionStorage
            const storedDisplayName = sessionStorage.getItem('userDisplayName');
            if (storedDisplayName) {
                playerName = storedDisplayName;
            } else {
                try {
                    const userData = JSON.parse(sessionStorage.getItem('userData'));
                    if (userData && userData.username) {
                        playerName = userData.username;
                    }
                } catch (e) {
                    console.error('Error reading userData:', e);
                }
            }
        }
    }
    
    // Final fallback
    if (!playerName) {
        playerName = 'Player';
    }
    
    const playerFlag = window.playerFlag || '⚔️';
    // Get userId if logged in
    let userId = null;
    const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
    if (isLoggedIn) {
        try {
            const userData = JSON.parse(sessionStorage.getItem('userData'));
            if (userData && userData.userId) {
                userId = userData.userId;
            }
        } catch (e) {
            console.error('Error reading userData:', e);
        }
    }
    
    const playerData = {
        playerId: generatePlayerId(),
        name: playerName,
        username: playerName, // Add username for logging
        flag: playerFlag, // Add flag for display
        unitType: selectedMultiplayerHero.unitType,
        hero: selectedMultiplayerHero, // Include hero in queue data
        userId: userId, // Add userId for match history
        selectedDeckId: selectedHeroDeckId && selectedHeroDeckId !== 'default' ? selectedHeroDeckId : null // Add deck ID
    };
    
    console.log('[Game] Player data being sent:', {
        name: playerData.name,
        unitType: playerData.unitType,
        hasHero: !!playerData.hero,
        heroName: playerData.hero?.name,
        heroId: playerData.hero?.id
    });

    // Wait for connection to be established before joining queue
    let connectionCheckInterval = null;
    let connectionTimeout = null;

    connectionCheckInterval = setInterval(() => {
        if (networkManager && networkManager.isConnected()) {
            console.log('[Game] Connected! Joining queue with hero:', selectedMultiplayerHero.name);
            clearInterval(connectionCheckInterval);
            if (connectionTimeout) clearTimeout(connectionTimeout);
            networkManager.joinQueue(playerData);
        }
    }, 100);

    // Safety timeout - if not connected after 10 seconds, give up
    connectionTimeout = setTimeout(() => {
        if (connectionCheckInterval) clearInterval(connectionCheckInterval);
        if (!networkManager || !networkManager.isConnected()) {
            console.error('[Game] Failed to connect to server after 10 seconds');
            alert('Failed to connect to multiplayer server. Check that the server is running on localhost:3000');
            document.getElementById('lobbyModal').style.display = 'none';
            document.getElementById('mainMenuModal').style.display = 'flex';
        }
    }, 10000);
}

function cancelHeroSelection() {
    // Reset hero selection
    selectedMultiplayerHero = null;
    document.getElementById('confirmHeroBtn').style.display = 'none';
    document.getElementById('waitingMessage').style.display = 'none';
    document.getElementById('multiplayerHeroDetails').style.display = 'none';
    document.getElementById('mechanicsBox').style.display = 'none';

    // Hide all modals
    document.getElementById('multiplayerHeroModal').style.display = 'none';
    document.getElementById('lobbyModal').style.display = 'none';
    document.getElementById('gameStartModal').style.display = 'none';
    
    // Show main menu with overlay
    const mainMenu = document.getElementById('mainMenuModal');
    const overlay = document.getElementById('modalOverlay');
    if (mainMenu) {
        mainMenu.style.display = 'block'; // Use 'block' instead of 'flex' to match initial state
    }
    if (overlay) {
        overlay.style.display = 'block';
    }
}

function cancelMatchmaking() {
    if (networkManager) {
        networkManager.leaveQueue();
        networkManager.disconnect();
    }

    // Reset hero selection
    selectedMultiplayerHero = null;
    document.getElementById('confirmHeroBtn').style.display = 'none';
    document.getElementById('waitingMessage').style.display = 'none';

    // Hide all modals
    document.getElementById('lobbyModal').style.display = 'none';
    document.getElementById('multiplayerHeroModal').style.display = 'none';
    document.getElementById('gameStartModal').style.display = 'none';
    
    // Show main menu with overlay
    const mainMenu = document.getElementById('mainMenuModal');
    const overlay = document.getElementById('modalOverlay');
    if (mainMenu) {
        mainMenu.style.display = 'block'; // Use 'block' instead of 'flex' to match initial state
    }
    if (overlay) {
        overlay.style.display = 'block';
    }
}

function generatePlayerId() {
    return 'player_' + Math.random().toString(36).substr(2, 9);
}

function handleGameEnd(result) {
    console.log('Game ended:', result);

    // Show game end modal
    let message = '';
    if (result.result === 'win') {
        message = '🎉 YOU WIN! 🎉';
    } else if (result.result === 'loss') {
        message = '😔 YOU LOSE...';
    } else if (result.result === 'draw') {
        message = '🤝 DRAW';
    }

    log(message);

    // Show proper win screen modal
    showGameOver(message);
}

function resetGame() {
    // Reset game state
    game.currentPlayer = 'player';
    game.turnNumber = 1;
    game.player = {
        hero: null,
        health: GAME_CONSTANTS.STARTING_HEALTH,
        maxEssence: 0,
        currentEssence: 0,
        heroPowerUsed: false,
        deck: [],
        hand: [],
        board: [],
        weapon: null,
        constructsPlayed: 0
    };
    game.enemy = {
        hero: null,
        health: GAME_CONSTANTS.STARTING_HEALTH,
        maxEssence: 0,
        currentEssence: 0,
        heroPowerUsed: false,
        deck: [],
        hand: [],
        board: [],
        weapon: null,
        constructsPlayed: 0
    };

    // Reset mode
    gameMode = 'singleplayer';
    if (networkManager) {
        networkManager.disconnect();
        networkManager = null;
        window.networkManager = null;
    }
}

// ===== ACCOUNT DASHBOARD FUNCTIONS =====
function openAccountDashboard() {
    // Wait for auth verification to complete if it's still in progress
    if (!window.authVerificationComplete) {
        console.log('[DASHBOARD] Auth verification not complete, waiting...');
        // Auth verification in progress, wait a bit and try again
        setTimeout(() => {
            openAccountDashboard();
        }, 100);
        return;
    }

    const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
    const userData = sessionStorage.getItem('userData');

    console.log('[DASHBOARD] isLoggedIn:', isLoggedIn, 'userData:', !!userData);

    if (!isLoggedIn || !userData) {
        // Guest user - show prompt
        console.log('[DASHBOARD] User is guest - showing prompt');
        showGuestPromptModal();
        return;
    }

    try {
        const user = JSON.parse(userData);
        console.log('[DASHBOARD] Parsed user data:', user);
        if (user.userId) {
            console.log('[DASHBOARD] Loading profile for userId:', user.userId);
            loadProfileData(user.userId);
        } else {
            console.log('[DASHBOARD] No userId in user data');
            showGuestPromptModal();
        }
    } catch (error) {
        console.error('[DASHBOARD] Error parsing user data:', error);
        showGuestPromptModal();
    }
}

function loadProfileData(userId) {
    const token = localStorage.getItem('token');

    if (!token) {
        showGuestPromptModal();
        return;
    }

    fetch(`/api/profile/${userId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            populateProfileUI(data.profile);
            populateStatsUI(data.stats);
            // Update player name input with displayName
            updatePlayerNameInput(data.profile);
            document.getElementById('accountDashboardModal').style.display = 'block';
            
            // Load match history
            loadMatchHistory(userId, token);
            
            // Load achievements
            loadAchievements(userId, token);
            
            // Load notifications
            loadNotifications(userId, token);
        } else {
            alert('Error loading profile: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Error loading profile:', error);
        alert('Failed to load profile data');
    });
}

function loadMatchHistory(userId, token) {
    fetch(`/api/profile/${userId}/match-history?limit=10`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(res => {
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error('Response is not JSON');
        }
        return res.json();
    })
    .then(data => {
        if (data.success) {
            populateMatchHistory(data.matches || []);
        } else {
            console.error('Error loading match history:', data.message);
            const container = document.getElementById('matchHistoryList');
            if (container) {
                container.innerHTML = '<div style="text-align: center; color: #888; padding: 10px;">No matches yet</div>';
            }
        }
    })
    .catch(error => {
        console.error('Error loading match history:', error);
        const container = document.getElementById('matchHistoryList');
        if (container) {
            container.innerHTML = '<div style="text-align: center; color: #888; padding: 10px;">Failed to load</div>';
        }
    });
}

// ===== XP & LEVELING SYSTEM (Client-side) =====
function calculateSinglePlayerXP(result, duration) {
    // No XP if game duration was less than 60 seconds
    if (duration < 60) {
        return 0;
    }
    
    let baseXP = 0;
    
    if (result === 'win') {
        baseXP = 20; // Single-player win
    } else if (result === 'loss') {
        baseXP = 10; // Single-player loss
    } else {
        baseXP = 15; // Draw (if draws are possible)
    }
    
    return baseXP;
}

function awardSinglePlayerXP(userId, xpGained, token) {
    fetch(`/api/profile/${userId}/award-xp`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ xpGained })
    }).catch(err => console.error('Error awarding XP:', err));
}

function loadAchievements(userId, token) {
    fetch(`/api/profile/${userId}/achievements`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(res => {
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error('Response is not JSON');
        }
        return res.json();
    })
    .then(data => {
        if (data.success) {
            populateAchievements(data.achievements || []);
        } else {
            console.error('Error loading achievements:', data.message);
            const container = document.getElementById('achievementsList');
            if (container) {
                container.innerHTML = '<div style="text-align: center; color: #888; padding: 10px;">No achievements yet</div>';
            }
        }
    })
    .catch(error => {
        console.error('Error loading achievements:', error);
        const container = document.getElementById('achievementsList');
        if (container) {
            container.innerHTML = '<div style="text-align: center; color: #888; padding: 10px;">Failed to load</div>';
        }
    });
}

function loadNotifications(userId, token) {
    fetch(`/api/profile/${userId}/notifications?limit=10`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(res => {
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error('Response is not JSON');
        }
        return res.json();
    })
    .then(data => {
        if (data.success) {
            populateNotifications(data.notifications || []);
        } else {
            console.error('Error loading notifications:', data.message);
            const container = document.getElementById('notificationsList');
            if (container) {
                container.innerHTML = '<div style="text-align: center; color: #888; padding: 10px;">No notifications</div>';
            }
        }
    })
    .catch(error => {
        console.error('Error loading notifications:', error);
        const container = document.getElementById('notificationsList');
        if (container) {
            container.innerHTML = '<div style="text-align: center; color: #888; padding: 10px;">Failed to load</div>';
        }
    });
}

function populateNotifications(notifications) {
    const container = document.getElementById('notificationsList');
    if (!container) return;
    
    if (notifications.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #888; padding: 20px; font-size: 13px;">No notifications</div>';
        return;
    }
    
    const typeIcons = {
        'level_up': '⬆️',
        'achievement': '🏆',
        'match_result': '⚔️',
        'reward': '🎁',
        'system': '📢'
    };
    
    container.innerHTML = notifications.map(notification => {
        const icon = typeIcons[notification.type] || '📌';
        const isUnread = !notification.read;
        const bgColor = isUnread ? 'rgba(212, 175, 55, 0.2)' : 'rgba(0,0,0,0.2)';
        const borderColor = isUnread ? '#d4af37' : '#8b6f47';
        const date = new Date(notification.created_at).toLocaleDateString();
        
        return `
            <div style="padding: 8px; margin-bottom: 6px; background: ${bgColor}; border-left: 3px solid ${borderColor}; border-radius: 4px; cursor: pointer;" onclick="markNotificationRead(${notification.id})">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div style="flex: 1;">
                        <div style="color: ${isUnread ? '#d4af37' : '#f4e4c1'}; font-weight: ${isUnread ? 'bold' : 'normal'}; font-size: 13px; margin-bottom: 4px;">
                            ${icon} ${notification.title}
                        </div>
                        <div style="color: #aaa; font-size: 12px;">${notification.message}</div>
                    </div>
                    ${isUnread ? '<span style="color: #d4af37; font-size: 10px; margin-left: 4px;">●</span>' : ''}
                </div>
                <div style="color: #888; font-size: 11px; margin-top: 4px;">${date}</div>
            </div>
        `;
    }).join('');
}

function markNotificationRead(notificationId) {
    const userData = JSON.parse(sessionStorage.getItem('userData'));
    const token = localStorage.getItem('token');
    
    if (!userData || !token) return;
    
    fetch(`/api/profile/${userData.userId}/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            // Reload notifications
            loadNotifications(userData.userId, token);
        }
    })
    .catch(error => {
        console.error('Error marking notification as read:', error);
    });
}

function markAllNotificationsRead() {
    const userData = JSON.parse(sessionStorage.getItem('userData'));
    const token = localStorage.getItem('token');
    
    if (!userData || !token) return;
    
    fetch(`/api/profile/${userData.userId}/notifications/read-all`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            // Reload notifications
            loadNotifications(userData.userId, token);
        }
    })
    .catch(error => {
        console.error('Error marking all notifications as read:', error);
    });
}

function switchDashboardTab(tab) {
    // Hide all tab contents
    const tabs = ['account', 'decks', 'history', 'achievements', 'social', 'notifications'];
    tabs.forEach(t => {
        const content = document.getElementById(`dashboardContent${t.charAt(0).toUpperCase() + t.slice(1)}`);
        const tabBtn = document.getElementById(`dashboardTab${t.charAt(0).toUpperCase() + t.slice(1)}`);
        if (content) content.style.display = 'none';
        if (tabBtn) {
            tabBtn.style.background = 'rgba(139, 111, 71, 0.3)';
            tabBtn.style.border = '2px solid #8b6f47';
            tabBtn.style.fontWeight = 'normal';
        }
    });
    
    // Show selected tab content
    const selectedContent = document.getElementById(`dashboardContent${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
    const selectedTabBtn = document.getElementById(`dashboardTab${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
    if (selectedContent) selectedContent.style.display = 'block';
    if (selectedTabBtn) {
        selectedTabBtn.style.background = 'linear-gradient(135deg, #8b7355 0%, #6b5344 100%)';
        selectedTabBtn.style.border = '2px solid #d4af37';
        selectedTabBtn.style.fontWeight = 'bold';
    }
    
    // Load data for the selected tab if needed
    const userData = JSON.parse(sessionStorage.getItem('userData'));
    const token = localStorage.getItem('token');
    
    if (userData && token) {
        if (tab === 'history') {
            // Load match history
            loadMatchHistory(userData.userId, token);
        } else if (tab === 'achievements') {
            // Load achievements
            loadAchievements(userData.userId, token);
        } else if (tab === 'social') {
            // Load friends and friend requests when social tab is opened
            loadFriends(userData.userId, token);
            loadFriendRequests(userData.userId, token);
            // Default to friends view
            switchSocialView('friends');
        } else if (tab === 'notifications') {
            // Load notifications
            loadNotifications(userData.userId, token);
        } else if (tab === 'account') {
            // Account tab - no special loading needed
        } else if (tab === 'decks') {
            // Load user decks
            loadDashboardDecks(userData.userId, token);
        }
    }
}

function loadDashboardDecks(userId, token) {
    const decksList = document.getElementById('dashboardDecksList');
    if (!decksList) return;
    
    decksList.innerHTML = '<div style="text-align: center; color: #888; padding: 20px;">Loading decks...</div>';
    
    fetch(`/api/deck/${userId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(async res => {
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error('Response is not JSON');
        }
        return res.json();
    })
    .then(data => {
        if (data.success && data.decks) {
            const decks = data.decks || [];
            
            if (decks.length === 0) {
                decksList.innerHTML = '<div style="text-align: center; color: #888; padding: 20px; font-size: 14px;">No custom decks found. Create one in the Deck Builder!</div>';
                return;
            }
            
            // Group decks by unit type
            const decksByType = {};
            decks.forEach(deck => {
                const unitType = deck.heroUnitType || deck.unitType || 'unknown';
                if (!decksByType[unitType]) {
                    decksByType[unitType] = [];
                }
                decksByType[unitType].push(deck);
            });
            
            let html = '';
            Object.keys(decksByType).forEach(unitType => {
                const unitTypeNames = {
                    'ranged': '🏹 Ranged',
                    'infantry': '🛡️ Infantry',
                    'cavalry': '🐎 Cavalry'
                };
                const typeName = unitTypeNames[unitType] || unitType;
                html += `<div style="margin-bottom: 15px; padding: 12px; background: rgba(0,0,0,0.2); border: 1px solid #8b6f47; border-radius: 4px;">`;
                html += `<p style="color: #d4af37; font-size: 15px; font-weight: bold; margin-bottom: 10px;">${typeName}</p>`;
                
                decksByType[unitType].forEach(deck => {
                    const cardCount = deck.cardList ? (Array.isArray(deck.cardList) ? deck.cardList.length : JSON.parse(deck.cardList).length) : 0;
                    html += `<div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; margin-bottom: 8px; background: rgba(0,0,0,0.3); border: 1px solid #8b6f47; border-radius: 4px;">`;
                    html += `<div>`;
                    html += `<div style="color: #f4e4c1; font-size: 15px; font-weight: bold;">${deck.deckName || 'Unnamed Deck'}</div>`;
                    html += `<div style="color: #aaa; font-size: 13px; margin-top: 3px;">${cardCount} cards</div>`;
                    html += `</div>`;
                    html += `<div style="display: flex; gap: 5px;">`;
                    html += `<button onclick="editDashboardDeck(${deck.id})" style="padding: 8px 12px; font-size: 13px; background: rgba(139, 111, 71, 0.3); border: 1px solid #8b6f47; cursor: pointer; border-radius: 3px; color: #f4e4c1;">Edit</button>`;
                    html += `</div>`;
                    html += `</div>`;
                });
                
                html += `</div>`;
            });
            
            decksList.innerHTML = html;
        } else {
            decksList.innerHTML = '<div style="text-align: center; color: #888; padding: 20px; font-size: 14px;">Error loading decks.</div>';
        }
    })
    .catch(error => {
        console.error('Error loading dashboard decks:', error);
        decksList.innerHTML = '<div style="text-align: center; color: #888; padding: 20px; font-size: 14px;">Error loading decks.</div>';
    });
}

function editDashboardDeck(deckId) {
    const token = localStorage.getItem('token');
    const userData = JSON.parse(sessionStorage.getItem('userData'));
    
    if (!token || !userData) {
        alert('Session expired. Please log in again.');
        return;
    }
    
    // Find the deck in userSavedDecks
    const deck = userSavedDecks.find(d => d.id === deckId);
    if (deck) {
        openDeckBuilderFromDashboard();
        setTimeout(() => {
            editSavedDeck(deck);
        }, 500);
    } else {
        // If not found, fetch it
        const user = JSON.parse(userData);
        fetch(`/api/deck/${user.userId}/${deckId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(async res => {
            if (!res.ok) throw new Error('Failed to load deck');
            return res.json();
        })
        .then(data => {
            if (data.success && data.deck) {
                openDeckBuilderFromDashboard();
                setTimeout(() => {
                    editSavedDeck(data.deck);
                }, 500);
            }
        })
        .catch(error => {
            console.error('Error loading deck:', error);
            alert('Failed to load deck for editing.');
        });
    }
}

function switchSocialView(view) {
    // Hide all social views
    const views = ['friends', 'messages', 'alliances'];
    views.forEach(v => {
        const viewContent = document.getElementById(`socialView${v.charAt(0).toUpperCase() + v.slice(1)}`);
        const viewTab = document.getElementById(`socialTab${v.charAt(0).toUpperCase() + v.slice(1)}`);
        if (viewContent) viewContent.style.display = 'none';
        if (viewTab) {
            viewTab.style.background = 'rgba(139, 111, 71, 0.3)';
            viewTab.style.border = '1px solid #8b6f47';
            viewTab.style.fontWeight = 'normal';
        }
    });
    
    // Show selected view
    const selectedView = document.getElementById(`socialView${view.charAt(0).toUpperCase() + view.slice(1)}`);
    const selectedTab = document.getElementById(`socialTab${view.charAt(0).toUpperCase() + view.slice(1)}`);
    if (selectedView) selectedView.style.display = 'block';
    if (selectedTab) {
        selectedTab.style.background = 'linear-gradient(135deg, #8b7355 0%, #6b5344 100%)';
        selectedTab.style.border = '1px solid #d4af37';
        selectedTab.style.fontWeight = 'bold';
    }
    
    // Load data for the selected view if needed
    const userData = JSON.parse(sessionStorage.getItem('userData'));
    const token = localStorage.getItem('token');
    
    if (userData && token) {
        if (view === 'friends') {
            // Load friends and friend requests
            loadFriends(userData.userId, token);
            loadFriendRequests(userData.userId, token);
        } else if (view === 'messages') {
            // Load messages
            loadMessages(userData.userId, token, 'inbox');
        }
    }
}

function logoutAllSessions() {
    if (!confirm('Are you sure you want to log out of all sessions? You will need to log in again on all devices.')) {
        return;
    }
    
    const token = localStorage.getItem('token');
    if (!token) {
        alert('You are not logged in.');
        return;
    }
    
    fetch('/api/auth/logout-all', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            alert(`Successfully logged out of ${data.sessionsLoggedOut} session(s). You will be logged out now.`);
            // Clear local storage and redirect to login
            localStorage.removeItem('token');
            sessionStorage.removeItem('userData');
            sessionStorage.removeItem('isLoggedIn');
            window.location.href = '/auth.html';
        } else {
            alert('Error: ' + (data.message || 'Failed to log out all sessions'));
        }
    })
    .catch(error => {
        console.error('Error logging out all sessions:', error);
        alert('An error occurred while logging out all sessions.');
    });
}

function loadDeletionStatus() {
    const token = localStorage.getItem('token');
    if (!token) return;
    
    fetch('/api/auth/deletion-status', {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(res => res.json())
    .then(data => {
        const statusDiv = document.getElementById('deletionStatus');
        if (!statusDiv) return;
        
        if (data.success && data.hasPendingDeletion) {
            const requestedDate = new Date(data.deletionRequest.requestedAt);
            const deletionDate = new Date(requestedDate.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days later
            const daysRemaining = Math.ceil((deletionDate - new Date()) / (24 * 60 * 60 * 1000));
            
            statusDiv.innerHTML = `
                <div style="color: #c41e3a; font-weight: bold; margin-bottom: 8px;">⚠️ Account Deletion Pending</div>
                <div style="color: #f4e4c1; font-size: 11px; margin-bottom: 8px;">
                    Your account will be deleted on ${deletionDate.toLocaleDateString()} (${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining).
                </div>
                <button onclick="cancelAccountDeletion()" style="width: 100%; padding: 6px; background: linear-gradient(135deg, #2a7f32 0%, #1e5d25 100%); border: 1px solid #4caf50; font-size: 11px; cursor: pointer; border-radius: 3px; color: #f4e4c1; font-weight: bold;">Cancel Deletion Request</button>
            `;
        } else {
            statusDiv.innerHTML = '<div style="text-align: center; color: #888; font-size: 11px;">No pending deletion request</div>';
        }
    })
    .catch(error => {
        console.error('Error loading deletion status:', error);
        const statusDiv = document.getElementById('deletionStatus');
        if (statusDiv) {
            statusDiv.innerHTML = '<div style="text-align: center; color: #888; font-size: 11px;">Unable to load status</div>';
        }
    });
}

function openAccountDeletionModal() {
    const modal = document.getElementById('accountDeletionModal');
    const dashboard = document.getElementById('accountDashboardModal');
    if (modal) {
        modal.style.display = 'block';
        if (dashboard) dashboard.style.display = 'none';
        document.getElementById('deletionPassword').value = '';
        document.getElementById('deletionMessage').style.display = 'none';
    }
}

function closeAccountDeletionModal() {
    const modal = document.getElementById('accountDeletionModal');
    const dashboard = document.getElementById('accountDashboardModal');
    if (modal) {
        modal.style.display = 'none';
        if (dashboard) dashboard.style.display = 'block';
        document.getElementById('deletionPassword').value = '';
        document.getElementById('deletionMessage').style.display = 'none';
    }
}

function submitAccountDeletion() {
    const token = localStorage.getItem('token');
    const password = document.getElementById('deletionPassword').value;
    const messageDiv = document.getElementById('deletionMessage');
    
    if (!password) {
        messageDiv.textContent = 'Password is required to confirm account deletion.';
        messageDiv.style.display = 'block';
        messageDiv.style.background = 'rgba(255, 0, 0, 0.2)';
        messageDiv.style.border = '1px solid #ff6b6b';
        messageDiv.style.color = '#ff6b6b';
        return;
    }
    
    fetch('/api/auth/request-deletion', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            messageDiv.textContent = data.message;
            messageDiv.style.display = 'block';
            messageDiv.style.background = 'rgba(0, 255, 0, 0.2)';
            messageDiv.style.border = '1px solid #4caf50';
            messageDiv.style.color = '#4caf50';
            
            // Reload deletion status
            setTimeout(() => {
                closeAccountDeletionModal();
                loadDeletionStatus();
            }, 2000);
        } else {
            messageDiv.textContent = data.message || 'Failed to request account deletion.';
            messageDiv.style.display = 'block';
            messageDiv.style.background = 'rgba(255, 0, 0, 0.2)';
            messageDiv.style.border = '1px solid #ff6b6b';
            messageDiv.style.color = '#ff6b6b';
        }
    })
    .catch(error => {
        console.error('Error requesting account deletion:', error);
        messageDiv.textContent = 'An unexpected error occurred.';
        messageDiv.style.display = 'block';
        messageDiv.style.background = 'rgba(255, 0, 0, 0.2)';
        messageDiv.style.border = '1px solid #ff6b6b';
        messageDiv.style.color = '#ff6b6b';
    });
}

function cancelAccountDeletion() {
    if (!confirm('Are you sure you want to cancel your account deletion request?')) {
        return;
    }
    
    const token = localStorage.getItem('token');
    
    fetch('/api/auth/cancel-deletion', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            alert(data.message);
            loadDeletionStatus();
        } else {
            alert('Error: ' + (data.message || 'Failed to cancel deletion request'));
        }
    })
    .catch(error => {
        console.error('Error canceling account deletion:', error);
        alert('An error occurred while canceling the deletion request.');
    });
}

function openChangeEmailModal() {
    const modal = document.getElementById('changeEmailModal');
    const dashboard = document.getElementById('accountDashboardModal');
    if (modal) {
        modal.style.display = 'block';
        if (dashboard) dashboard.style.display = 'none';
        // Clear form
        document.getElementById('changeEmailPassword').value = '';
        document.getElementById('newEmail').value = '';
        document.getElementById('changeEmailMessage').style.display = 'none';
    }
}

function closeChangeEmailModal() {
    const modal = document.getElementById('changeEmailModal');
    const dashboard = document.getElementById('accountDashboardModal');
    if (modal) {
        modal.style.display = 'none';
        if (dashboard) dashboard.style.display = 'block';
    }
}

function submitChangeEmail() {
    const token = localStorage.getItem('token');
    const password = document.getElementById('changeEmailPassword').value;
    const newEmail = document.getElementById('newEmail').value.trim();
    const messageDiv = document.getElementById('changeEmailMessage');

    // Validation
    if (!password || !newEmail) {
        messageDiv.textContent = 'All fields are required';
        messageDiv.style.display = 'block';
        messageDiv.style.background = 'rgba(255, 0, 0, 0.2)';
        messageDiv.style.border = '1px solid #ff6b6b';
        messageDiv.style.color = '#ff6b6b';
        return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
        messageDiv.textContent = 'Please enter a valid email address';
        messageDiv.style.display = 'block';
        messageDiv.style.background = 'rgba(255, 0, 0, 0.2)';
        messageDiv.style.border = '1px solid #ff6b6b';
        messageDiv.style.color = '#ff6b6b';
        return;
    }

    if (!token) {
        messageDiv.textContent = 'Session expired. Please log in again.';
        messageDiv.style.display = 'block';
        messageDiv.style.background = 'rgba(255, 0, 0, 0.2)';
        messageDiv.style.border = '1px solid #ff6b6b';
        messageDiv.style.color = '#ff6b6b';
        return;
    }

    // Submit to API
    fetch('/api/auth/change-email', {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            password,
            newEmail
        })
    })
    .then(res => {
        if (!res.ok) {
            return res.text().then(text => {
                try {
                    return JSON.parse(text);
                } catch {
                    throw new Error(`Server error: ${res.status} ${text}`);
                }
            });
        }
        return res.json();
    })
    .then(data => {
        if (data.success) {
            messageDiv.textContent = data.message || 'Email changed successfully';
            messageDiv.style.display = 'block';
            messageDiv.style.background = 'rgba(0, 255, 0, 0.2)';
            messageDiv.style.border = '1px solid #4caf50';
            messageDiv.style.color = '#4caf50';
            // Clear form
            document.getElementById('changeEmailPassword').value = '';
            document.getElementById('newEmail').value = '';
            setTimeout(() => {
                closeChangeEmailModal();
            }, 2000);
        } else {
            messageDiv.textContent = data.message || 'Failed to change email';
            messageDiv.style.display = 'block';
            messageDiv.style.background = 'rgba(255, 0, 0, 0.2)';
            messageDiv.style.border = '1px solid #ff6b6b';
            messageDiv.style.color = '#ff6b6b';
        }
    })
    .catch(error => {
        console.error('Error changing email:', error);
        messageDiv.textContent = 'An error occurred while changing email';
        messageDiv.style.display = 'block';
        messageDiv.style.background = 'rgba(255, 0, 0, 0.2)';
        messageDiv.style.border = '1px solid #ff6b6b';
        messageDiv.style.color = '#ff6b6b';
    });
}

// ===== FRIENDS SYSTEM FUNCTIONS =====

function loadFriends(userId, token) {
    fetch('/api/friends', {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(res => {
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error('Response is not JSON');
        }
        return res.json();
    })
    .then(data => {
        const container = document.getElementById('friendsList');
        if (!container) return;
        
        if (data.success) {
            populateFriendsList(data.friends || []);
            
            // Set up socket listeners for friend status updates if not already set
            if (window.networkManager && window.networkManager.socket && !window.friendStatusListenersSet) {
                window.networkManager.socket.on('friendStatusChange', (data) => {
                    // Update friend status in UI
                    updateFriendStatus(data.userId, data.status);
                });
                
                window.networkManager.socket.on('friendChallenge', (data) => {
                    handleFriendChallenge(data);
                });
                
                window.friendStatusListenersSet = true;
            }
        } else {
            container.innerHTML = '<div style="text-align: center; color: #888; padding: 20px; font-size: 13px;">Failed to load friends</div>';
        }
    })
    .catch(error => {
        console.error('Error loading friends:', error);
        const container = document.getElementById('friendsList');
        if (container) {
            container.innerHTML = '<div style="text-align: center; color: #888; padding: 20px; font-size: 13px;">Failed to load friends</div>';
        }
    });
}

function updateFriendStatus(friendUserId, status) {
    // Reload friends list to get updated status
    const userData = JSON.parse(sessionStorage.getItem('userData'));
    const token = localStorage.getItem('token');
    if (userData && token) {
        loadFriends(userData.userId, token);
    }
}

function challengeFriend(friendId, friendUsername) {
    if (!window.networkManager || !window.networkManager.socket || !window.networkManager.socket.connected) {
        alert('You must be connected to the multiplayer server to challenge friends. Please start a quick match first.');
        return;
    }
    
    const userData = JSON.parse(sessionStorage.getItem('userData'));
    if (!userData) {
        alert('You must be logged in to challenge friends.');
        return;
    }
    
    if (confirm(`Challenge ${friendUsername} to a duel?`)) {
        window.networkManager.socket.emit('challengeFriend', { friendUserId: friendId });
        alert(`Challenge sent to ${friendUsername}!`);
    }
}

function handleFriendChallenge(data) {
    const { challengeId, challengerUserId, challengerUsername } = data;
    if (confirm(`${challengerUsername} has challenged you to a duel! Accept?`)) {
        if (window.networkManager && window.networkManager.socket) {
            window.networkManager.socket.emit('acceptChallenge', { challengeId });
            // TODO: Start match with challenger
            alert('Challenge accepted! Starting match...');
        }
    } else {
        if (window.networkManager && window.networkManager.socket) {
            window.networkManager.socket.emit('rejectChallenge', { challengeId });
        }
    }
}

function loadFriendRequests(userId, token) {
    fetch('/api/friends/requests', {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(res => {
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error('Response is not JSON');
        }
        return res.json();
    })
    .then(data => {
        const container = document.getElementById('friendRequestsList');
        if (!container) return;
        
        if (data.success) {
            populateFriendRequests(data.requests || []);
        } else {
            container.innerHTML = '<div style="text-align: center; color: #888; padding: 10px; font-size: 11px;">Failed to load requests</div>';
        }
    })
    .catch(error => {
        console.error('Error loading friend requests:', error);
        const container = document.getElementById('friendRequestsList');
        if (container) {
            container.innerHTML = '<div style="text-align: center; color: #888; padding: 10px; font-size: 11px;">Failed to load requests</div>';
        }
    });
}

function populateFriendsList(friends) {
    const container = document.getElementById('friendsList');
    if (!container) return;
    
    if (friends.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #888; padding: 20px; font-size: 13px;">No friends yet. Add some friends to get started!</div>';
        return;
    }
    
    container.innerHTML = friends.map(friend => {
        const date = new Date(friend.created_at).toLocaleDateString();
        const statusColor = friend.isOnline ? '#4caf50' : '#888';
        const statusText = friend.isOnline ? '🟢 Online' : '⚫ Offline';
        return `
            <div style="padding: 8px; margin-bottom: 6px; background: rgba(0,0,0,0.2); border: 1px solid #8b6f47; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
                <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <div style="color: #f4e4c1; font-weight: bold; font-size: 13px;">${friend.username}</div>
                        <span style="color: ${statusColor}; font-size: 10px;">${statusText}</span>
                    </div>
                    <div style="color: #888; font-size: 11px; margin-top: 2px;">Friends since ${date}</div>
                </div>
                <div style="display: flex; gap: 4px;">
                    ${friend.isOnline ? `<button onclick="challengeFriend(${friend.friend_id}, '${friend.username}')" style="padding: 4px 8px; font-size: 10px; background: rgba(76, 175, 80, 0.3); border: 1px solid #4caf50; cursor: pointer; border-radius: 3px; color: #f4e4c1;">Challenge</button>` : ''}
                    <button onclick="blockUser(${friend.friend_id}, '${friend.username}')" style="padding: 4px 8px; font-size: 10px; background: rgba(139, 71, 71, 0.3); border: 1px solid #8b4a4a; cursor: pointer; border-radius: 3px; color: #f4e4c1;">Block</button>
                    <button onclick="removeFriend(${friend.friend_id})" style="padding: 4px 8px; font-size: 10px; background: rgba(139, 71, 71, 0.3); border: 1px solid #8b4a4a; cursor: pointer; border-radius: 3px; color: #f4e4c1;">Remove</button>
                </div>
            </div>
        `;
    }).join('');
}

function blockUser(userId, username) {
    if (!confirm(`Block ${username}? This will remove them from your friends list and prevent them from messaging or challenging you.`)) {
        return;
    }
    
    const token = localStorage.getItem('token');
    const userData = JSON.parse(sessionStorage.getItem('userData'));
    
    fetch(`/api/friends/block/${userId}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            alert(data.message);
            loadFriends(userData.userId, token);
        } else {
            alert('Error: ' + (data.message || 'Failed to block user'));
        }
    })
    .catch(error => {
        console.error('Error blocking user:', error);
        alert('An error occurred while blocking the user.');
    });
}

function unblockUser(userId, username) {
    if (!confirm(`Unblock ${username}?`)) {
        return;
    }
    
    const token = localStorage.getItem('token');
    const userData = JSON.parse(sessionStorage.getItem('userData'));
    
    fetch(`/api/friends/unblock/${userId}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            alert(data.message);
            loadBlockedUsers(userData.userId, token);
        } else {
            alert('Error: ' + (data.message || 'Failed to unblock user'));
        }
    })
    .catch(error => {
        console.error('Error unblocking user:', error);
        alert('An error occurred while unblocking the user.');
    });
}

function populateFriendRequests(requests) {
    const container = document.getElementById('friendRequestsList');
    if (!container) return;
    
    if (requests.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #888; padding: 10px; font-size: 11px;">No pending requests</div>';
        return;
    }
    
    container.innerHTML = requests.map(request => {
        const date = new Date(request.created_at).toLocaleDateString();
        return `
            <div style="padding: 8px; margin-bottom: 6px; background: rgba(212, 175, 55, 0.1); border: 1px solid #d4af37; border-radius: 4px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <div>
                        <div style="color: #d4af37; font-weight: bold; font-size: 12px;">${request.username}</div>
                        <div style="color: #888; font-size: 10px; margin-top: 2px;">Requested ${date}</div>
                    </div>
                    <div style="display: flex; gap: 4px;">
                        <button onclick="acceptFriendRequest(${request.id})" style="padding: 4px 8px; font-size: 10px; background: rgba(76, 175, 80, 0.3); border: 1px solid #4caf50; cursor: pointer; border-radius: 3px; color: #f4e4c1;">Accept</button>
                        <button onclick="rejectFriendRequest(${request.id})" style="padding: 4px 8px; font-size: 10px; background: rgba(139, 71, 71, 0.3); border: 1px solid #8b4a4a; cursor: pointer; border-radius: 3px; color: #f4e4c1;">Reject</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function openAddFriendModal() {
    const modal = document.getElementById('addFriendModal');
    const dashboard = document.getElementById('accountDashboardModal');
    if (modal) {
        modal.style.display = 'block';
        if (dashboard) dashboard.style.display = 'none';
        document.getElementById('friendUsername').value = '';
        document.getElementById('addFriendMessage').style.display = 'none';
    }
}

function closeAddFriendModal() {
    const modal = document.getElementById('addFriendModal');
    const dashboard = document.getElementById('accountDashboardModal');
    if (modal) {
        modal.style.display = 'none';
        if (dashboard) dashboard.style.display = 'block';
        document.getElementById('friendUsername').value = '';
        document.getElementById('addFriendMessage').style.display = 'none';
    }
}

function sendFriendRequest() {
    const token = localStorage.getItem('token');
    const username = document.getElementById('friendUsername').value.trim();
    const messageDiv = document.getElementById('addFriendMessage');
    
    if (!username) {
        messageDiv.textContent = 'Please enter a username.';
        messageDiv.style.display = 'block';
        messageDiv.style.background = 'rgba(255, 0, 0, 0.2)';
        messageDiv.style.border = '1px solid #ff6b6b';
        messageDiv.style.color = '#ff6b6b';
        return;
    }
    
    fetch('/api/friends/request', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            messageDiv.textContent = data.message;
            messageDiv.style.display = 'block';
            messageDiv.style.background = 'rgba(0, 255, 0, 0.2)';
            messageDiv.style.border = '1px solid #4caf50';
            messageDiv.style.color = '#4caf50';
            
            const userData = JSON.parse(sessionStorage.getItem('userData'));
            if (data.autoAccepted) {
                // Reload friends list
                setTimeout(() => {
                    closeAddFriendModal();
                    loadFriends(userData.userId, token);
                    loadFriendRequests(userData.userId, token);
                }, 2000);
            } else {
                setTimeout(() => {
                    closeAddFriendModal();
                    loadFriendRequests(userData.userId, token);
                }, 2000);
            }
        } else {
            messageDiv.textContent = data.message || 'Failed to send friend request.';
            messageDiv.style.display = 'block';
            messageDiv.style.background = 'rgba(255, 0, 0, 0.2)';
            messageDiv.style.border = '1px solid #ff6b6b';
            messageDiv.style.color = '#ff6b6b';
        }
    })
    .catch(error => {
        console.error('Error sending friend request:', error);
        messageDiv.textContent = 'An unexpected error occurred.';
        messageDiv.style.display = 'block';
        messageDiv.style.background = 'rgba(255, 0, 0, 0.2)';
        messageDiv.style.border = '1px solid #ff6b6b';
        messageDiv.style.color = '#ff6b6b';
    });
}

function acceptFriendRequest(requestId) {
    const token = localStorage.getItem('token');
    const userData = JSON.parse(sessionStorage.getItem('userData'));
    
    fetch(`/api/friends/accept/${requestId}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            alert(data.message);
            loadFriends(userData.userId, token);
            loadFriendRequests(userData.userId, token);
        } else {
            alert('Error: ' + (data.message || 'Failed to accept friend request'));
        }
    })
    .catch(error => {
        console.error('Error accepting friend request:', error);
        alert('An error occurred while accepting the friend request.');
    });
}

function rejectFriendRequest(requestId) {
    const token = localStorage.getItem('token');
    const userData = JSON.parse(sessionStorage.getItem('userData'));
    
    fetch(`/api/friends/reject/${requestId}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            loadFriendRequests(userData.userId, token);
        } else {
            alert('Error: ' + (data.message || 'Failed to reject friend request'));
        }
    })
    .catch(error => {
        console.error('Error rejecting friend request:', error);
        alert('An error occurred while rejecting the friend request.');
    });
}

function removeFriend(friendId) {
    if (!confirm('Are you sure you want to remove this friend?')) {
        return;
    }
    
    const token = localStorage.getItem('token');
    const userData = JSON.parse(sessionStorage.getItem('userData'));
    
    fetch(`/api/friends/${friendId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            alert(data.message);
            loadFriends(userData.userId, token);
        } else {
            alert('Error: ' + (data.message || 'Failed to remove friend'));
        }
    })
    .catch(error => {
        console.error('Error removing friend:', error);
        alert('An error occurred while removing the friend.');
    });
}

// ===== MESSAGING SYSTEM FUNCTIONS =====

let currentMessagesView = 'inbox'; // 'inbox' or 'sent'

function switchMessagesView(view) {
    currentMessagesView = view;
    
    // Update tab buttons
    const inboxBtn = document.getElementById('messagesTabInbox');
    const sentBtn = document.getElementById('messagesTabSent');
    
    if (inboxBtn && sentBtn) {
        if (view === 'inbox') {
            inboxBtn.style.background = 'linear-gradient(135deg, #8b7355 0%, #6b5344 100%)';
            inboxBtn.style.border = '1px solid #d4af37';
            inboxBtn.style.fontWeight = 'bold';
            sentBtn.style.background = 'rgba(139, 111, 71, 0.3)';
            sentBtn.style.border = '1px solid #8b6f47';
            sentBtn.style.fontWeight = 'normal';
        } else {
            sentBtn.style.background = 'linear-gradient(135deg, #8b7355 0%, #6b5344 100%)';
            sentBtn.style.border = '1px solid #d4af37';
            sentBtn.style.fontWeight = 'bold';
            inboxBtn.style.background = 'rgba(139, 111, 71, 0.3)';
            inboxBtn.style.border = '1px solid #8b6f47';
            inboxBtn.style.fontWeight = 'normal';
        }
    }
    
    // Load messages
    const userData = JSON.parse(sessionStorage.getItem('userData'));
    const token = localStorage.getItem('token');
    if (userData && token) {
        loadMessages(userData.userId, token, view);
    }
}

function loadMessages(userId, token, view = 'inbox') {
    const endpoint = view === 'sent' ? '/api/messages/sent' : '/api/messages';
    
    fetch(endpoint, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(res => res.json())
    .then(data => {
        const container = document.getElementById('messagesList');
        if (!container) return;
        
        if (data.success) {
            populateMessagesList(data.messages || [], view);
        } else {
            container.innerHTML = '<div style="text-align: center; color: #888; padding: 20px; font-size: 13px;">Failed to load messages</div>';
        }
    })
    .catch(error => {
        console.error('Error loading messages:', error);
        const container = document.getElementById('messagesList');
        if (container) {
            container.innerHTML = '<div style="text-align: center; color: #888; padding: 20px; font-size: 13px;">Failed to load messages</div>';
        }
    });
}

function populateMessagesList(messages, view) {
    const container = document.getElementById('messagesList');
    if (!container) return;
    
    if (messages.length === 0) {
        container.innerHTML = `<div style="text-align: center; color: #888; padding: 20px; font-size: 13px;">No ${view === 'sent' ? 'sent' : 'inbox'} messages</div>`;
        return;
    }
    
    container.innerHTML = messages.map(msg => {
        const isUnread = !msg.read && view === 'inbox';
        const bgColor = isUnread ? 'rgba(212, 175, 55, 0.2)' : 'rgba(0,0,0,0.2)';
        const borderColor = isUnread ? '#d4af37' : '#8b6f47';
        const date = new Date(msg.created_at).toLocaleDateString();
        const otherUser = view === 'sent' ? msg.recipient_username : msg.sender_username;
        const preview = msg.body.length > 50 ? msg.body.substring(0, 50) + '...' : msg.body;
        
        return `
            <div style="padding: 8px; margin-bottom: 6px; background: ${bgColor}; border-left: 3px solid ${borderColor}; border-radius: 4px; cursor: pointer;" onclick="viewMessage(${msg.id}, '${view}')">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 4px;">
                    <div style="flex: 1;">
                        <div style="color: ${isUnread ? '#d4af37' : '#f4e4c1'}; font-weight: ${isUnread ? 'bold' : 'normal'}; font-size: 13px; margin-bottom: 2px;">
                            ${view === 'sent' ? 'To' : 'From'}: ${otherUser}
                        </div>
                        ${msg.subject ? `<div style="color: #d4af37; font-size: 12px; margin-bottom: 2px;">${msg.subject}</div>` : ''}
                        <div style="color: #aaa; font-size: 11px;">${preview}</div>
                    </div>
                    ${isUnread ? '<span style="color: #d4af37; font-size: 10px; margin-left: 4px;">●</span>' : ''}
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                    <span style="color: #888; font-size: 10px;">${date}</span>
                    <button onclick="event.stopPropagation(); deleteMessage(${msg.id}, '${view}')" style="padding: 2px 6px; font-size: 9px; background: rgba(139, 71, 71, 0.3); border: 1px solid #8b4a4a; cursor: pointer; border-radius: 2px; color: #f4e4c1;">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

function viewMessage(messageId, view) {
    const token = localStorage.getItem('token');
    
    fetch(`/api/messages/${messageId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            const msg = data.message;
            const date = new Date(msg.created_at).toLocaleDateString();
            const otherUser = view === 'sent' ? msg.recipient_username : msg.sender_username;
            
            const messageHTML = `
                <div style="padding: 15px; background: rgba(0,0,0,0.3); border: 1px solid #8b6f47; border-radius: 4px; margin-bottom: 10px;">
                    <div style="margin-bottom: 10px;">
                        <div style="color: #d4af37; font-size: 12px; font-weight: bold; margin-bottom: 4px;">${view === 'sent' ? 'To' : 'From'}: ${otherUser}</div>
                        ${msg.subject ? `<div style="color: #f4e4c1; font-size: 13px; font-weight: bold; margin-bottom: 4px;">${msg.subject}</div>` : ''}
                        <div style="color: #888; font-size: 10px;">${date}</div>
                    </div>
                    <div style="color: #f4e4c1; font-size: 12px; line-height: 1.6; white-space: pre-wrap;">${msg.body}</div>
                </div>
                <div style="display: flex; gap: 5px; justify-content: center;">
                    <button onclick="closeMessageView()" style="padding: 6px 12px; font-size: 11px; background: rgba(139, 111, 71, 0.3); border: 1px solid #8b6f47; cursor: pointer; border-radius: 3px; color: #f4e4c1;">Close</button>
                </div>
            `;
            
            const container = document.getElementById('messagesList');
            if (container) {
                container.innerHTML = messageHTML;
            }
            
            // Mark as read if viewing inbox message
            if (view === 'inbox' && !msg.read) {
                markMessageRead(messageId);
            }
        } else {
            alert('Error: ' + (data.message || 'Failed to load message'));
        }
    })
    .catch(error => {
        console.error('Error viewing message:', error);
        alert('An error occurred while loading the message.');
    });
}

function closeMessageView() {
    const userData = JSON.parse(sessionStorage.getItem('userData'));
    const token = localStorage.getItem('token');
    if (userData && token) {
        loadMessages(userData.userId, token, currentMessagesView);
    }
}

function openComposeMessageModal() {
    const modal = document.getElementById('composeMessageModal');
    const dashboard = document.getElementById('accountDashboardModal');
    if (modal) {
        modal.style.display = 'block';
        if (dashboard) dashboard.style.display = 'none';
        document.getElementById('messageRecipient').value = '';
        document.getElementById('messageSubject').value = '';
        document.getElementById('messageBody').value = '';
        document.getElementById('composeMessageMessage').style.display = 'none';
    }
}

function closeComposeMessageModal() {
    const modal = document.getElementById('composeMessageModal');
    const dashboard = document.getElementById('accountDashboardModal');
    if (modal) {
        modal.style.display = 'none';
        if (dashboard) dashboard.style.display = 'block';
        document.getElementById('messageRecipient').value = '';
        document.getElementById('messageSubject').value = '';
        document.getElementById('messageBody').value = '';
        document.getElementById('composeMessageMessage').style.display = 'none';
    }
}

function sendMessage() {
    const token = localStorage.getItem('token');
    const recipient = document.getElementById('messageRecipient').value.trim();
    const subject = document.getElementById('messageSubject').value.trim();
    const body = document.getElementById('messageBody').value.trim();
    const messageDiv = document.getElementById('composeMessageMessage');
    
    if (!recipient || !body) {
        messageDiv.textContent = 'Recipient and message body are required.';
        messageDiv.style.display = 'block';
        messageDiv.style.background = 'rgba(255, 0, 0, 0.2)';
        messageDiv.style.border = '1px solid #ff6b6b';
        messageDiv.style.color = '#ff6b6b';
        return;
    }
    
    fetch('/api/messages', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ recipientUsername: recipient, subject: subject || null, body })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            messageDiv.textContent = data.message;
            messageDiv.style.display = 'block';
            messageDiv.style.background = 'rgba(0, 255, 0, 0.2)';
            messageDiv.style.border = '1px solid #4caf50';
            messageDiv.style.color = '#4caf50';
            
            setTimeout(() => {
                closeComposeMessageModal();
                const userData = JSON.parse(sessionStorage.getItem('userData'));
                loadMessages(userData.userId, token, 'sent');
            }, 1500);
        } else {
            messageDiv.textContent = data.message || 'Failed to send message.';
            messageDiv.style.display = 'block';
            messageDiv.style.background = 'rgba(255, 0, 0, 0.2)';
            messageDiv.style.border = '1px solid #ff6b6b';
            messageDiv.style.color = '#ff6b6b';
        }
    })
    .catch(error => {
        console.error('Error sending message:', error);
        messageDiv.textContent = 'An unexpected error occurred.';
        messageDiv.style.display = 'block';
        messageDiv.style.background = 'rgba(255, 0, 0, 0.2)';
        messageDiv.style.border = '1px solid #ff6b6b';
        messageDiv.style.color = '#ff6b6b';
    });
}

function markMessageRead(messageId) {
    const token = localStorage.getItem('token');
    
    fetch(`/api/messages/${messageId}/read`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            // Reload messages to update read status
            const userData = JSON.parse(sessionStorage.getItem('userData'));
            loadMessages(userData.userId, token, currentMessagesView);
        }
    })
    .catch(error => {
        console.error('Error marking message as read:', error);
    });
}

function markAllMessagesRead() {
    const token = localStorage.getItem('token');
    
    fetch('/api/messages/read-all', {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            alert(data.message);
            const userData = JSON.parse(sessionStorage.getItem('userData'));
            loadMessages(userData.userId, token, 'inbox');
        } else {
            alert('Error: ' + (data.message || 'Failed to mark all messages as read'));
        }
    })
    .catch(error => {
        console.error('Error marking all messages as read:', error);
        alert('An error occurred while marking all messages as read.');
    });
}

function deleteMessage(messageId, view) {
    if (!confirm('Are you sure you want to delete this message?')) {
        return;
    }
    
    const token = localStorage.getItem('token');
    const userData = JSON.parse(sessionStorage.getItem('userData'));
    
    fetch(`/api/messages/${messageId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            loadMessages(userData.userId, token, view);
        } else {
            alert('Error: ' + (data.message || 'Failed to delete message'));
        }
    })
    .catch(error => {
        console.error('Error deleting message:', error);
        alert('An error occurred while deleting the message.');
    });
}

function populateAchievements(achievements) {
    const container = document.getElementById('achievementsList');
    if (!container) return;
    
    if (achievements.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #888; padding: 20px; font-size: 13px;">No achievements yet</div>';
        return;
    }
    
    const achievementNames = {
        'level_5': '🏅 Level 5',
        'level_10': '🥇 Level 10',
        'level_15': '🥈 Level 15',
        'level_20': '🥉 Level 20',
        'level_25': '⭐ Level 25',
        'level_30': '💎 Level 30',
        'level_40': '👑 Level 40',
        'level_50': '🌟 Level 50'
    };
    
    container.innerHTML = achievements.map(achievement => {
        const name = achievementNames[achievement.achievement_id] || achievement.achievement_id;
        const date = new Date(achievement.unlocked_at).toLocaleDateString();
        
        return `
            <div style="padding: 8px; margin-bottom: 6px; background: rgba(212, 175, 55, 0.1); border: 1px solid #d4af37; border-radius: 4px;">
                <div style="color: #d4af37; font-weight: bold; font-size: 13px;">${name}</div>
                <div style="color: #888; font-size: 11px; margin-top: 4px;">Unlocked: ${date}</div>
            </div>
        `;
    }).join('');
}

function populateMatchHistory(matches) {
    const container = document.getElementById('matchHistoryList');
    if (!container) return;
    
    if (matches.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #888; padding: 20px; font-size: 13px;">No matches yet</div>';
        return;
    }
    
    container.innerHTML = matches.map(match => {
        const resultColor = match.result === 'win' ? '#4caf50' : match.result === 'loss' ? '#ff6b6b' : '#d4af37';
        const resultIcon = match.result === 'win' ? '✓' : match.result === 'loss' ? '✗' : '=';
        const duration = match.duration ? `${Math.floor(match.duration / 60)}:${String(match.duration % 60).padStart(2, '0')}` : '-';
        const date = new Date(match.created_at).toLocaleDateString();
        const mode = match.game_mode === 'singleplayer' ? 'SP' : 'MP';
        
        return `
            <div style="padding: 8px; margin-bottom: 6px; background: rgba(0,0,0,0.2); border-left: 3px solid ${resultColor}; border-radius: 4px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: ${resultColor}; font-weight: bold; font-size: 13px;">${resultIcon} ${match.result.toUpperCase()}</span>
                    <span style="color: #aaa; font-size: 11px;">${mode}</span>
                </div>
                <div style="color: #aaa; font-size: 12px; margin-top: 4px;">vs ${match.opponent_name}</div>
                <div style="display: flex; justify-content: space-between; margin-top: 4px;">
                    <span style="color: #888; font-size: 11px;">${duration}</span>
                    <span style="color: #888; font-size: 11px;">${date}</span>
                </div>
            </div>
        `;
    }).join('');
}

function updatePlayerNameInput(profile) {
    const playerNameInput = document.getElementById('playerNameInput');
    if (playerNameInput && profile) {
        // Use displayName if available, otherwise fallback to username
        const nameToUse = profile.displayName || profile.username || '';
        if (nameToUse) {
            playerNameInput.value = nameToUse;
            // Store in sessionStorage for quick access
            sessionStorage.setItem('userDisplayName', nameToUse);
        }
    }
}

function populateProfileUI(profile) {
    // Update username in Account tab (now a div, not input)
    const usernameEls = document.querySelectorAll('#profileUsername');
    usernameEls.forEach(el => {
        el.textContent = profile.username || '-';
    });
    
    const displayNameEl = document.getElementById('profileDisplayName');
    if (displayNameEl) displayNameEl.value = profile.displayName || '';
    
    const emailEl = document.getElementById('profileEmail');
    if (emailEl) emailEl.value = profile.email || '';
    
    const bioEl = document.getElementById('profileBio');
    if (bioEl) bioEl.value = profile.bio || '';
    
    // Update player name input with displayName
    updatePlayerNameInput(profile);

    // Format and display join date in Account tab (now a div, not input)
    if (profile.createdAt) {
        const joinDate = new Date(profile.createdAt);
        const formattedDate = joinDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const joinDateEls = document.querySelectorAll('#profileJoinDate');
        joinDateEls.forEach(el => {
            el.textContent = formattedDate;
        });
    } else {
        const joinDateEls = document.querySelectorAll('#profileJoinDate');
        joinDateEls.forEach(el => {
            el.textContent = '-';
        });
    }

    // Display preferred unit type
    const preferredUnitTypeEl = document.getElementById('profilePreferredUnitType');
    if (preferredUnitTypeEl) {
        if (profile.preferredUnitType) {
            const unitTypeNames = {
                'ranged': '🏹 Ranged',
                'infantry': '🛡️ Infantry',
                'cavalry': '🐎 Cavalry'
            };
            preferredUnitTypeEl.value = unitTypeNames[profile.preferredUnitType] || profile.preferredUnitType;
        } else {
            preferredUnitTypeEl.value = 'None';
        }
    }

    // Set avatar display
    const avatars = ['', '🤴', '👸', '🧙', '🧝', '⚔️', '🛡️', '👑', '🦅'];
    document.getElementById('profileAvatarDisplay').textContent = avatars[profile.avatarId] || '🤴';

    // Store current avatar for selection UI
    window.currentAvatarId = profile.avatarId;
    
    // Update avatar level badge (will be set when stats are loaded)

    // Set up bio character counter
    updateBioCharCount();
    document.getElementById('profileBio').addEventListener('input', updateBioCharCount);
}

function updateBioCharCount() {
    const bio = document.getElementById('profileBio').value;
    document.getElementById('bioCharCount').textContent = `(${bio.length}/200)`;
}

function populateStatsUI(stats) {
    const setIfExists = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };

    setIfExists('statsWins', stats.wins);
    setIfExists('statsLosses', stats.losses);
    setIfExists('statsWinRate', stats.winRate.toFixed(1) + '%');
    setIfExists('statsGamesPlayed', stats.gamesPlayed);
    setIfExists('statsLevel', stats.level);
    setIfExists('statsRank', stats.rank);
    setIfExists('statsGold', stats.gold);
    setIfExists('statsGems', stats.gems);
    
    // Update avatar level badge
    const avatarLevelBadge = document.getElementById('avatarLevelBadge');
    if (avatarLevelBadge && stats.level) {
        avatarLevelBadge.textContent = stats.level;
    }
    
    // Display level and XP progress
    const levelEl = document.getElementById('profileLevel');
    const xpEl = document.getElementById('profileXP');
    const xpProgressEl = document.getElementById('profileXPProgress');
    
    if (levelEl && stats.level) {
        levelEl.textContent = `Level ${stats.level}`;
    }
    
    if (xpEl && stats.xp !== undefined && stats.xpToNextLevel) {
        xpEl.textContent = `${stats.xp} / ${stats.xpToNextLevel} XP`;
        
        if (xpProgressEl) {
            const xpPercent = Math.floor((stats.xp / stats.xpToNextLevel) * 100);
            xpProgressEl.style.width = `${xpPercent}%`;
        }
    }
}

function switchAccountTab(tabName) {
    // Tab switching removed - all content now displays on one page
}

function saveProfile() {
    const token = localStorage.getItem('token');
    const userData = sessionStorage.getItem('userData');

    if (!token || !userData) {
        alert('Session expired. Please log in again.');
        return;
    }

    const user = JSON.parse(userData);
    const displayName = document.getElementById('profileDisplayName').value.trim();
    const bio = document.getElementById('profileBio').value.trim();

    // Validation
    if (displayName.length > 50) {
        alert('Display name must be 50 characters or less');
        return;
    }

    if (bio.length > 200) {
        alert('Bio must be 200 characters or less');
        return;
    }

    const updateData = {
        displayName: displayName || undefined,
        bio: bio || undefined,
        avatarId: window.currentAvatarId || undefined
    };

    fetch(`/api/profile/${user.userId}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            alert('Profile updated successfully!');
            // Reload profile data to show latest
            loadProfileData(user.userId);
        } else {
            alert('Error updating profile: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Error updating profile:', error);
        alert('Failed to update profile');
    });
}

function openChangePasswordModal() {
    const modal = document.getElementById('changePasswordModal');
    const dashboard = document.getElementById('accountDashboardModal');
    if (modal) {
        modal.style.display = 'block';
        if (dashboard) dashboard.style.display = 'none';
        // Clear form
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmNewPassword').value = '';
        document.getElementById('changePasswordMessage').style.display = 'none';
    }
}

function closeChangePasswordModal() {
    const modal = document.getElementById('changePasswordModal');
    const dashboard = document.getElementById('accountDashboardModal');
    if (modal) {
        modal.style.display = 'none';
        if (dashboard) dashboard.style.display = 'block';
        // Clear form
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmNewPassword').value = '';
        document.getElementById('changePasswordMessage').style.display = 'none';
    }
}

function openGameSettingsModal() {
    const modal = document.getElementById('gameSettingsModal');
    const dashboard = document.getElementById('accountDashboardModal');
    if (modal) {
        modal.style.display = 'block';
        if (dashboard) dashboard.style.display = 'none';
    }
}

function closeGameSettingsModal() {
    const modal = document.getElementById('gameSettingsModal');
    const dashboard = document.getElementById('accountDashboardModal');
    if (modal) {
        modal.style.display = 'none';
        if (dashboard) dashboard.style.display = 'block';
    }
}

function submitChangePassword() {
    const token = localStorage.getItem('token');
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmNewPassword').value;
    const messageDiv = document.getElementById('changePasswordMessage');

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
        messageDiv.textContent = 'All fields are required';
        messageDiv.style.display = 'block';
        messageDiv.style.background = 'rgba(255, 0, 0, 0.2)';
        messageDiv.style.border = '1px solid #ff6b6b';
        messageDiv.style.color = '#ff6b6b';
        return;
    }

    if (newPassword.length < 6) {
        messageDiv.textContent = 'New password must be at least 6 characters';
        messageDiv.style.display = 'block';
        messageDiv.style.background = 'rgba(255, 0, 0, 0.2)';
        messageDiv.style.border = '1px solid #ff6b6b';
        messageDiv.style.color = '#ff6b6b';
        return;
    }

    if (newPassword !== confirmPassword) {
        messageDiv.textContent = 'New passwords do not match';
        messageDiv.style.display = 'block';
        messageDiv.style.background = 'rgba(255, 0, 0, 0.2)';
        messageDiv.style.border = '1px solid #ff6b6b';
        messageDiv.style.color = '#ff6b6b';
        return;
    }

    if (!token) {
        messageDiv.textContent = 'Session expired. Please log in again.';
        messageDiv.style.display = 'block';
        messageDiv.style.background = 'rgba(255, 0, 0, 0.2)';
        messageDiv.style.border = '1px solid #ff6b6b';
        messageDiv.style.color = '#ff6b6b';
        return;
    }

    // Submit to API
    fetch('/api/auth/change-password', {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            currentPassword,
            newPassword,
            confirmPassword
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            messageDiv.textContent = 'Password changed successfully!';
            messageDiv.style.display = 'block';
            messageDiv.style.background = 'rgba(0, 255, 0, 0.2)';
            messageDiv.style.border = '1px solid #4caf50';
            messageDiv.style.color = '#4caf50';
            
            // Clear form after success
            setTimeout(() => {
                document.getElementById('currentPassword').value = '';
                document.getElementById('newPassword').value = '';
                document.getElementById('confirmNewPassword').value = '';
                closeChangePasswordModal();
            }, 2000);
        } else {
            messageDiv.textContent = data.message || 'Failed to change password';
            messageDiv.style.display = 'block';
            messageDiv.style.background = 'rgba(255, 0, 0, 0.2)';
            messageDiv.style.border = '1px solid #ff6b6b';
            messageDiv.style.color = '#ff6b6b';
        }
    })
    .catch(error => {
        console.error('Error changing password:', error);
        messageDiv.textContent = 'Failed to change password. Please try again.';
        messageDiv.style.display = 'block';
        messageDiv.style.background = 'rgba(255, 0, 0, 0.2)';
        messageDiv.style.border = '1px solid #ff6b6b';
        messageDiv.style.color = '#ff6b6b';
    });
}

function openAvatarSelector() {
    document.getElementById('avatarSelectorModal').style.display = 'block';

    // Highlight current avatar
    document.querySelectorAll('.avatar-option').forEach(option => {
        option.classList.remove('selected');
    });
    const currentOption = document.querySelector(`.avatar-option[data-avatar="${window.currentAvatarId || 1}"]`);
    if (currentOption) {
        currentOption.classList.add('selected');
    }
}

function selectAvatar(avatarId) {
    window.currentAvatarId = avatarId;

    // Update avatar display
    const avatars = ['', '🤴', '👸', '🧙', '🧝', '⚔️', '🛡️', '👑', '🦅'];
    document.getElementById('profileAvatarDisplay').textContent = avatars[avatarId] || '🤴';

    // Update selected state
    document.querySelectorAll('.avatar-option').forEach(option => {
        option.classList.remove('selected');
    });
    document.querySelector(`.avatar-option[data-avatar="${avatarId}"]`).classList.add('selected');
}

function closeAvatarSelector() {
    document.getElementById('avatarSelectorModal').style.display = 'none';
}

function closeAccountDashboard() {
    document.getElementById('accountDashboardModal').style.display = 'none';
    document.getElementById('mainMenuModal').style.display = 'block';
}

function showGuestPromptModal() {
    document.getElementById('guestPromptModal').style.display = 'block';
}

function closeGuestPrompt() {
    document.getElementById('guestPromptModal').style.display = 'none';
}

// ===== DECK BUILDER FUNCTIONS =====
let currentDeckBuilderHero = null; // Selected hero object
let currentDeckBuilderDeck = []; // Array of card IDs (60 cards)
const DECK_SIZE_LIMIT = 60; // Total deck size limit

// Deck limits by card type
function getMaxCopiesForCard(card) {
    if (!card) return 0;
    
    // Equipment - Weapons: Max 4
    if (card.type === 'equipment' && card.equipSlot === 'weapon') {
        return 4;
    }
    
    // Equipment - Armor: Max 1 of each piece (one of each)
    if (card.type === 'equipment' && card.equipSlot && card.equipSlot !== 'weapon') {
        return 1;
    }
    
    // Abilities: Max 5
    if (card.type === 'ability') {
        return 5;
    }
    
    // Siege: Max 3
    if (card.unitType === 'siege') {
        return 3;
    }
    
    // Bannerman (units): Max 16 (to allow T5)
    if (card.type === 'unit' || card.type === 'construct') {
        return 16;
    }
    
    // Default fallback
    return 3;
}
let currentDeckBuilderTab = 'all'; // 'all', 'unit', 'ability', 'equipment', 'siege'
let currentDeckBuilderEditingId = null; // If editing existing deck

function openDeckBuilder() {
    // Wait for auth verification to complete
    if (!window.authVerificationComplete) {
        setTimeout(() => {
            openDeckBuilder();
        }, 100);
        return;
    }

    const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
    const userData = sessionStorage.getItem('userData');

    if (!isLoggedIn || !userData) {
        alert('Please log in to use the Deck Builder');
        return;
    }

    // Reset state
    currentDeckBuilderHero = null;
    currentDeckBuilderDeck = [];
    currentDeckBuilderTab = 'all';
    currentDeckBuilderEditingId = null;
    
    // Show hero selection
    document.getElementById('deckBuilderHeroSelection').style.display = 'block';
    document.getElementById('deckBuilderCardSelection').style.display = 'none';
    document.getElementById('deckBuilderModal').style.display = 'block';
    document.getElementById('mainMenuModal').style.display = 'none';
    
    // Clear hero list and load user decks
    document.getElementById('deckBuilderHeroList').innerHTML = '';
    document.getElementById('deckBuilderSavedDecksList').innerHTML = '';
    document.getElementById('deckBuilderSavedDecksSection').style.display = 'none';
    
    // Load user's saved decks
    loadUserDecks();
}

function openDeckBuilderFromDashboard() {
    openDeckBuilder();
    // Close dashboard
    document.getElementById('accountDashboardModal').style.display = 'none';
}

let userSavedDecks = []; // Store user's saved decks

function loadUserDecks() {
    const token = localStorage.getItem('token');
    const userData = sessionStorage.getItem('userData');
    
    if (!token || !userData) {
        return;
    }
    
    const user = JSON.parse(userData);
    
    fetch(`/api/deck/${user.userId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(async res => {
        if (!res.ok) {
            console.error('Failed to load decks:', res.status);
            return;
        }
        const data = await res.json();
        if (data.success) {
            userSavedDecks = data.decks || [];
            console.log('[DECK BUILDER] Loaded user decks:', userSavedDecks.length);
        }
    })
    .catch(error => {
        console.error('Error loading user decks:', error);
    });
}

function selectDeckBuilderUnitType(unitType) {
    const HISTORIC_LEADERS = window.HISTORIC_LEADERS || {};
    const heroes = HISTORIC_LEADERS[unitType] || [];
    const heroList = document.getElementById('deckBuilderHeroList');
    const savedDecksList = document.getElementById('deckBuilderSavedDecksList');
    const savedDecksSection = document.getElementById('deckBuilderSavedDecksSection');
    
    heroList.innerHTML = '';
    savedDecksList.innerHTML = '';
    
    // Filter saved decks for this unit type
    const decksForType = userSavedDecks.filter(deck => deck.heroUnitType === unitType);
    
    // Show saved decks section if there are decks
    if (decksForType.length > 0) {
        savedDecksSection.style.display = 'block';
        
        decksForType.forEach(deck => {
            const deckDiv = document.createElement('div');
            deckDiv.style.cssText = 'padding: 12px; background: rgba(76, 175, 80, 0.2); border: 2px solid #4caf50; border-radius: 6px; cursor: pointer; text-align: center; transition: all 0.2s; position: relative;';
            deckDiv.onmouseenter = () => deckDiv.style.background = 'rgba(76, 175, 80, 0.4)';
            deckDiv.onmouseleave = () => deckDiv.style.background = 'rgba(76, 175, 80, 0.2)';
            deckDiv.onclick = () => editSavedDeck(deck);
            
            // Find hero name
            const hero = HISTORIC_LEADERS[unitType]?.find(h => h.id === deck.heroId);
            const heroName = hero ? hero.name : deck.heroId;
            
            const editBtn = document.createElement('button');
            editBtn.textContent = '✏️ Edit';
            editBtn.style.cssText = 'padding: 4px 8px; font-size: 10px; background: rgba(139, 111, 71, 0.3); border: 1px solid #8b6f47; border-radius: 3px; cursor: pointer; color: #f4e4c1;';
            editBtn.onclick = (e) => {
                e.stopPropagation();
                editSavedDeck(deck);
            };
            
            const renameBtn = document.createElement('button');
            renameBtn.textContent = '✏️ Rename';
            renameBtn.style.cssText = 'padding: 4px 8px; font-size: 10px; background: rgba(139, 111, 71, 0.3); border: 1px solid #8b6f47; border-radius: 3px; cursor: pointer; color: #f4e4c1;';
            renameBtn.onclick = (e) => {
                e.stopPropagation();
                renameSavedDeck(deck);
            };
            
            const copyBtn = document.createElement('button');
            copyBtn.textContent = '📋 Copy';
            copyBtn.style.cssText = 'padding: 4px 8px; font-size: 10px; background: rgba(139, 111, 71, 0.3); border: 1px solid #8b6f47; border-radius: 3px; cursor: pointer; color: #f4e4c1;';
            copyBtn.onclick = (e) => {
                e.stopPropagation();
                copySavedDeck(deck);
            };
            
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = '🗑️ Delete';
            deleteBtn.style.cssText = 'padding: 4px 8px; font-size: 10px; background: rgba(139, 0, 0, 0.3); border: 1px solid #8b4747; border-radius: 3px; cursor: pointer; color: #ff7a7a;';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                deleteSavedDeck(deck.id, deck.deckName);
            };
            
            const buttonContainer = document.createElement('div');
            buttonContainer.style.cssText = 'display: flex; gap: 5px; justify-content: center; margin-top: 8px; flex-wrap: wrap;';
            buttonContainer.appendChild(editBtn);
            buttonContainer.appendChild(renameBtn);
            buttonContainer.appendChild(copyBtn);
            buttonContainer.appendChild(deleteBtn);
            
            // Get hero type icon/emoji
            const typeEmoji = deck.heroUnitType === 'ranged' ? '🏹' : 
                             deck.heroUnitType === 'infantry' ? '🛡️' : 
                             deck.heroUnitType === 'cavalry' ? '🐎' : '⚔️';
            const typeName = deck.heroUnitType ? deck.heroUnitType.charAt(0).toUpperCase() + deck.heroUnitType.slice(1) : 'Unknown';
            
            deckDiv.innerHTML = `
                <div style="font-size: 17px; font-weight: 700; color: #4caf50; margin-bottom: 8px; letter-spacing: 0.5px;">${deck.deckName}</div>
                <div style="font-size: 12px; color: #f4e4c1; margin-bottom: 6px; font-weight: 600;">${heroName}</div>
                <div style="font-size: 11px; color: #d4af37; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">${typeEmoji} ${typeName}</div>
                <div style="font-size: 11px; color: #aaa; padding-top: 8px; border-top: 1px solid rgba(76, 175, 80, 0.3);">${deck.cardList.length} cards</div>
            `;
            deckDiv.appendChild(buttonContainer);
            
            savedDecksList.appendChild(deckDiv);
        });
    } else {
        savedDecksSection.style.display = 'none';
    }
    
    // Show heroes
    heroes.forEach(hero => {
        const heroDiv = document.createElement('div');
        heroDiv.style.cssText = 'padding: 18px; background: rgba(139, 111, 71, 0.15); border: 2px solid #8b6f47; border-radius: 8px; cursor: pointer; text-align: center; transition: all 0.2s;';
        heroDiv.onmouseenter = () => {
            heroDiv.style.background = 'rgba(139, 111, 71, 0.35)';
            heroDiv.style.borderColor = '#d4af37';
            heroDiv.style.transform = 'translateY(-2px)';
            heroDiv.style.boxShadow = '0 4px 12px rgba(212, 175, 55, 0.3)';
        };
        heroDiv.onmouseleave = () => {
            heroDiv.style.background = 'rgba(139, 111, 71, 0.15)';
            heroDiv.style.borderColor = '#8b6f47';
            heroDiv.style.transform = 'translateY(0)';
            heroDiv.style.boxShadow = 'none';
        };
        heroDiv.onclick = () => previewDeckBuilderHero(hero);
        
        const typeEmoji = hero.unitType === 'ranged' ? '🏹' : hero.unitType === 'infantry' ? '🛡️' : '🐎';
        
        heroDiv.innerHTML = `
            <div style="font-size: 20px; font-weight: 700; color: #d4af37; margin-bottom: 8px; letter-spacing: 1px;">${hero.name}</div>
            <div style="font-size: 11px; color: #aaa; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px;">${typeEmoji} ${hero.unitType}</div>
            <div style="padding: 10px; background: rgba(0,0,0,0.3); border-radius: 6px; border: 1px solid rgba(139, 111, 71, 0.5);">
                <div style="font-size: 10px; color: #d4af37; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Passive Ability</div>
                <div style="font-size: 11px; color: #f4e4c1; font-style: italic; line-height: 1.4;">${hero.passive || 'No passive ability'}</div>
            </div>
        `;
        
        heroList.appendChild(heroDiv);
    });
}

function renameSavedDeck(deck) {
    const newName = prompt(`Rename "${deck.deckName}":`, deck.deckName);
    if (!newName || newName.trim() === deck.deckName || newName.trim() === '') {
        return;
    }
    
    const token = localStorage.getItem('token');
    const userData = JSON.parse(sessionStorage.getItem('userData'));
    if (!token || !userData) {
        alert('Please log in to rename decks');
        return;
    }
    
    fetch(`/api/deck/${userData.userId}/${deck.id}/rename`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ newName: newName.trim() })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            alert('Deck renamed successfully!');
            // Reload decks
            loadUserDecks();
        } else {
            alert('Error: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Error renaming deck:', error);
        alert('Failed to rename deck. Please try again.');
    });
}

function copySavedDeck(deck) {
    const newName = prompt(`Copy "${deck.deckName}" as:`, `${deck.deckName} (Copy)`);
    if (!newName || newName.trim() === '') {
        return;
    }
    
    const token = localStorage.getItem('token');
    const userData = JSON.parse(sessionStorage.getItem('userData'));
    if (!token || !userData) {
        alert('Please log in to copy decks');
        return;
    }
    
    fetch(`/api/deck/${userData.userId}/${deck.id}/copy`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ newName: newName.trim() })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            alert('Deck copied successfully!');
            // Reload decks
            loadUserDecks();
        } else {
            alert('Error: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Error copying deck:', error);
        alert('Failed to copy deck. Please try again.');
    });
}

function editSavedDeck(deck) {
    // Load the deck for editing
    const token = localStorage.getItem('token');
    const userData = sessionStorage.getItem('userData');
    
    if (!token || !userData) {
        alert('Session expired. Please log in again.');
        return;
    }
    
    const user = JSON.parse(userData);
    
    fetch(`/api/deck/${user.userId}/${deck.id}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(async res => {
        if (!res.ok) {
            throw new Error('Failed to load deck');
        }
        const data = await res.json();
        if (data.success) {
            // Find the hero
            const HISTORIC_LEADERS = window.HISTORIC_LEADERS || {};
            const hero = HISTORIC_LEADERS[data.deck.heroUnitType]?.find(h => h.id === data.deck.heroId);
            
            if (!hero) {
                alert('Hero not found for this deck');
                return;
            }
            
            // Set up editing state
            currentDeckBuilderHero = hero;
            currentDeckBuilderDeck = data.deck.cardList || [];
            currentDeckBuilderEditingId = data.deck.id;
            
            // Show card selection
            document.getElementById('deckBuilderHeroSelection').style.display = 'none';
            document.getElementById('deckBuilderCardSelection').style.display = 'block';
            
            // Update UI
            document.getElementById('selectedHeroName').textContent = hero.name;
            
            // Update hero passive ability display
            const passiveAbilityElement = document.getElementById('selectedHeroPassiveAbility');
            if (passiveAbilityElement) {
                passiveAbilityElement.textContent = hero.passive || 'No passive ability';
            }
            
            document.getElementById('deckNameInput').value = data.deck.deckName;
            
            // Render cards and update display
            renderDeckBuilderCards();
            updateDeckDisplay();
        }
    })
    .catch(error => {
        console.error('Error loading deck:', error);
        alert('Failed to load deck for editing');
    });
}

function deleteSavedDeck(deckId, deckName) {
    if (!confirm(`Delete deck "${deckName}"? This cannot be undone.`)) {
        return;
    }
    
    const token = localStorage.getItem('token');
    const userData = sessionStorage.getItem('userData');
    
    if (!token || !userData) {
        alert('Session expired. Please log in again.');
        return;
    }
    
    const user = JSON.parse(userData);
    
    fetch(`/api/deck/${user.userId}/${deckId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(async res => {
        const data = await res.json();
        if (data.success) {
            alert(`Deck "${deckName}" deleted successfully!`);
            // Reload decks and refresh the current view
            loadUserDecks();
            // Refresh the current unit type view if one is selected
            const currentUnitType = document.querySelector('[onclick*="selectDeckBuilderUnitType"]')?.getAttribute('onclick')?.match(/'(\w+)'/)?.[1];
            if (currentUnitType) {
                selectDeckBuilderUnitType(currentUnitType);
            }
        } else {
            alert('Error deleting deck: ' + (data.message || 'Unknown error'));
        }
    })
    .catch(error => {
        console.error('Error deleting deck:', error);
        alert('Failed to delete deck');
    });
}

// Preview hero selection (show confirmation)
function previewDeckBuilderHero(hero) {
    // Store the previewed hero temporarily
    window.previewedDeckBuilderHero = hero;
    
    // Show confirmation section
    const confirmationSection = document.getElementById('deckBuilderHeroConfirmation');
    if (confirmationSection) {
        confirmationSection.style.display = 'block';
        document.getElementById('confirmHeroName').textContent = hero.name;
        document.getElementById('confirmHeroType').textContent = hero.unitType.charAt(0).toUpperCase() + hero.unitType.slice(1);
        document.getElementById('confirmHeroPassive').textContent = hero.passive || 'No passive ability';
        
        // Scroll to confirmation section
        confirmationSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// Confirm hero selection and proceed to deck builder
function confirmDeckBuilderHero() {
    const hero = window.previewedDeckBuilderHero;
    if (!hero) {
        console.error('No hero previewed');
        return;
    }
    
    selectDeckBuilderHero(hero);
}

// Cancel hero selection preview (deck builder)
function cancelDeckBuilderHeroSelection() {
    window.previewedDeckBuilderHero = null;
    const confirmationSection = document.getElementById('deckBuilderHeroConfirmation');
    if (confirmationSection) {
        confirmationSection.style.display = 'none';
    }
}

function selectDeckBuilderHero(hero) {
    currentDeckBuilderHero = hero;
    currentDeckBuilderDeck = []; // Start with empty deck
    currentDeckBuilderEditingId = null; // New deck, not editing
    
    // Hide confirmation section
    const confirmationSection = document.getElementById('deckBuilderHeroConfirmation');
    if (confirmationSection) {
        confirmationSection.style.display = 'none';
    }
    
    // Show card selection, hide hero selection
    document.getElementById('deckBuilderHeroSelection').style.display = 'none';
    document.getElementById('deckBuilderCardSelection').style.display = 'block';
    
    // Update hero name display
    document.getElementById('selectedHeroName').textContent = hero.name;
    
    // Update hero passive ability display
    const passiveAbilityElement = document.getElementById('selectedHeroPassiveAbility');
    if (passiveAbilityElement) {
        passiveAbilityElement.textContent = hero.passive || 'No passive ability';
    }
    
    // Clear deck name
    document.getElementById('deckNameInput').value = '';
    
    // Render cards
    renderDeckBuilderCards();
    updateDeckDisplay();
}

function selectDeckBuilderTab(tabType) {
    currentDeckBuilderTab = tabType;
    
    // Update tab button styles
    const tabs = ['all', 'unit', 'ability', 'equipment', 'siege'];
    tabs.forEach(tab => {
        const btn = document.getElementById(`deckBuilderTab${tab === 'all' ? 'All' : tab.charAt(0).toUpperCase() + tab.slice(1)}`);
        if (btn) {
            if (tab === tabType) {
                btn.style.background = 'linear-gradient(135deg, #8b7355 0%, #6b5344 100%)';
                btn.style.border = '2px solid #d4af37';
                btn.style.fontWeight = 'bold';
            } else {
                btn.style.background = 'rgba(139, 111, 71, 0.3)';
                btn.style.border = '2px solid #8b6f47';
                btn.style.fontWeight = 'normal';
            }
        }
    });

    // Re-render cards with new filter
    renderDeckBuilderCards();
}


function renderDeckBuilderCards() {
    if (!currentDeckBuilderHero) return;
    
    const container = document.getElementById('deckBuilderCardsContainer');
    if (!container) return;

    const cardDatabase = window.CARD_DATABASE || {};
    if (!cardDatabase) {
        container.innerHTML = '<p style="color: #ff7a7a;">Card database not loaded. Please refresh the page.</p>';
        return;
    }

    // Get all cards for this hero type + siege cards (available to all)
    const cardsForType = [];
    for (const cardId in cardDatabase) {
        const card = cardDatabase[cardId];
        // Siege cards are available to all hero types
        const isSiege = card.unitType === 'siege';
        const matchesHeroType = card.unitType === currentDeckBuilderHero.unitType;
        
        if (isSiege || matchesHeroType) {
            // Filter by tab
            if (currentDeckBuilderTab === 'all') {
                cardsForType.push(card);
            } else if (currentDeckBuilderTab === 'siege' && isSiege) {
                cardsForType.push(card);
            } else if (currentDeckBuilderTab !== 'siege' && card.type === currentDeckBuilderTab && !isSiege) {
                cardsForType.push(card);
            }
        }
    }

    // Sort by type (units, abilities, equipment, siege) then by cost
    cardsForType.sort((a, b) => {
        // Siege first if siege tab, otherwise normal order
        if (currentDeckBuilderTab === 'siege') {
            if (a.unitType === 'siege' && b.unitType !== 'siege') return -1;
            if (a.unitType !== 'siege' && b.unitType === 'siege') return 1;
        }
        const typeOrder = { 'unit': 0, 'ability': 1, 'equipment': 2 };
        if (typeOrder[a.type] !== typeOrder[b.type]) {
            return typeOrder[a.type] - typeOrder[b.type];
        }
        return (a.cost || 0) - (b.cost || 0);
    });

    container.innerHTML = '';

    cardsForType.forEach(card => {
        const countInDeck = currentDeckBuilderDeck.filter(id => id === card.id).length;
        const maxCopies = getMaxCopiesForCard(card);
        const canAdd = currentDeckBuilderDeck.length < DECK_SIZE_LIMIT && countInDeck < maxCopies;
        
        const cardDiv = document.createElement('div');
        cardDiv.className = 'deck-builder-card';
        cardDiv.style.cssText = `
            padding: 8px;
            background: ${countInDeck > 0 ? 'rgba(76, 175, 80, 0.3)' : 'rgba(139, 111, 71, 0.2)'};
            border: 2px solid ${countInDeck > 0 ? '#4caf50' : '#8b6f47'};
            border-radius: 4px;
            cursor: ${canAdd || countInDeck > 0 ? 'pointer' : 'not-allowed'};
            transition: all 0.2s;
            text-align: center;
            opacity: ${canAdd || countInDeck > 0 ? '1' : '0.5'};
        `;
        cardDiv.onmouseenter = () => {
            if (canAdd || countInDeck > 0) cardDiv.style.background = countInDeck > 0 ? 'rgba(76, 175, 80, 0.5)' : 'rgba(139, 111, 71, 0.4)';
        };
        cardDiv.onmouseleave = () => {
            if (canAdd || countInDeck > 0) cardDiv.style.background = countInDeck > 0 ? 'rgba(76, 175, 80, 0.3)' : 'rgba(139, 111, 71, 0.2)';
        };
        cardDiv.onclick = (e) => {
            // Left click: Add card (if under max and deck not full)
            if (canAdd) {
                toggleCardInDeck(card.id, 'add');
            } else if (countInDeck > 0) {
                // If at max but card is in deck, show info
                log(`You have ${countInDeck}/${maxCopies} copies of ${card.name} in your deck. Right-click to remove.`, 'player');
            }
        };
        
        // Right click: Remove card
        cardDiv.oncontextmenu = (e) => {
            e.preventDefault();
            if (countInDeck > 0) {
                toggleCardInDeck(card.id, 'remove');
            }
            return false;
        };

        const costText = card.cost ? `[${card.cost}] ` : '';
        const statsText = card.power && card.durability ? ` ${card.power}/${card.durability}` : '';
        const typeEmoji = card.unitType === 'siege' ? '🏰' : card.type === 'unit' ? '⚔️' : card.type === 'ability' ? '✨' : '🛡️';
        // maxCopies already declared above, reuse it
        const countText = countInDeck > 0 ? ` <span style="color: ${countInDeck >= maxCopies ? '#ff7a7a' : '#4caf50'}; font-weight: bold;">(x${countInDeck}/${maxCopies})</span>` : '';

        cardDiv.innerHTML = `
            <div style="font-size: 10px; color: #d4af37; font-weight: bold; margin-bottom: 4px;">
                ${typeEmoji}
            </div>
            <div style="font-size: 11px; color: #f4e4c1; font-weight: bold; margin-bottom: 2px;">
                ${costText}${card.name}${statsText}${countText}
            </div>
            <div style="font-size: 9px; color: #aaa; line-height: 1.2;">
                ${card.text || ''}
            </div>
            <div style="font-size: 9px; color: ${canAdd ? '#4caf50' : countInDeck >= maxCopies ? '#ff7a7a' : '#ff7a7a'}; margin-top: 4px;">
                ${canAdd ? 'Click to add' : countInDeck > 0 ? `Right-click to remove (${countInDeck}/${maxCopies})` : countInDeck >= maxCopies ? `Max copies (${maxCopies})` : 'Deck full'}
            </div>
        `;

        container.appendChild(cardDiv);
    });

    updateDeckDisplay();
}

function toggleCardInDeck(cardId, action = 'toggle') {
    const cardDatabase = window.CARD_DATABASE || {};
    const card = cardDatabase[cardId];
    if (!card) {
        console.error('Card not found:', cardId);
        return;
    }
    
    const countInDeck = currentDeckBuilderDeck.filter(id => id === cardId).length;
    const maxCopies = getMaxCopiesForCard(card);
    const deckFull = currentDeckBuilderDeck.length >= DECK_SIZE_LIMIT;
    
    console.log(`[DECK BUILDER] ${action} card: ${card.name} (${cardId})`, {
        type: card.type,
        unitType: card.unitType,
        equipSlot: card.equipSlot,
        countInDeck,
        maxCopies,
        deckFull
    });
    
    if (action === 'remove') {
        // Remove one copy
        const index = currentDeckBuilderDeck.indexOf(cardId);
        if (index > -1) {
            currentDeckBuilderDeck.splice(index, 1);
        }
    } else if (action === 'add' || action === 'toggle') {
        // Add card if deck isn't full and we haven't hit the max copies limit
        if (deckFull) {
            log(`Deck is full (${DECK_SIZE_LIMIT} cards)! Remove cards to add more.`, 'player');
            return;
        } else if (countInDeck >= maxCopies) {
            const cardName = card.name || cardId;
            log(`Maximum ${maxCopies} copies of ${cardName} allowed per deck! Right-click to remove.`, 'player');
            return;
        } else {
            // Add card
            currentDeckBuilderDeck.push(cardId);
        }
    }
    
    renderDeckBuilderCards();
    updateDeckDisplay();
}

function updateDeckDisplay() {
    // Update deck size
    const sizeEl = document.getElementById('currentDeckSize');
    if (sizeEl) {
        const size = currentDeckBuilderDeck.length;
        sizeEl.textContent = size;
        sizeEl.style.color = size === DECK_SIZE_LIMIT ? '#4caf50' : size < 30 ? '#ff7a7a' : '#d4af37';
    }
    
    // Update deck list
    const listEl = document.getElementById('currentDeckList');
    if (listEl) {
        if (currentDeckBuilderDeck.length === 0) {
            listEl.textContent = 'Empty - Add cards to build your deck';
            listEl.style.color = '#aaa';
        } else {
            const cardDatabase = window.CARD_DATABASE || {};
            const cardCounts = {};
            currentDeckBuilderDeck.forEach(cardId => {
                cardCounts[cardId] = (cardCounts[cardId] || 0) + 1;
            });
            
            const cardEntries = Object.entries(cardCounts).map(([id, count]) => {
                const card = cardDatabase[id];
                return `${card?.name || id} x${count}`;
            }).join(', ');
            
            listEl.textContent = cardEntries || 'Empty';
            listEl.style.color = '#f4e4c1';
        }
    }
    
    // Enable/disable save button
    const saveBtn = document.getElementById('saveDeckBtn');
    if (saveBtn) {
        const deckName = document.getElementById('deckNameInput')?.value.trim() || '';
        saveBtn.disabled = currentDeckBuilderDeck.length !== DECK_SIZE_LIMIT || deckName.length === 0;
    }
}

function saveDeckPreset() {
    const deckName = document.getElementById('deckNameInput')?.value.trim() || '';
    
    if (!deckName) {
        alert('Please enter a deck name');
        return;
    }
    
    if (currentDeckBuilderDeck.length !== DECK_SIZE_LIMIT) {
        alert(`Deck must contain exactly ${DECK_SIZE_LIMIT} cards. Current: ${currentDeckBuilderDeck.length}`);
        return;
    }
    
    if (!currentDeckBuilderHero) {
        alert('No hero selected');
        return;
    }
    
    const token = localStorage.getItem('token');
    const userData = sessionStorage.getItem('userData');
    
    if (!token || !userData) {
        alert('Session expired. Please log in again.');
        return;
    }
    
    const user = JSON.parse(userData);
    const url = currentDeckBuilderEditingId 
        ? `/api/deck/${user.userId}/${currentDeckBuilderEditingId}`
        : `/api/deck/${user.userId}`;
    const method = currentDeckBuilderEditingId ? 'PUT' : 'POST';
    
    const body = currentDeckBuilderEditingId
        ? { deckName, cardList: currentDeckBuilderDeck }
        : {
            deckName,
            heroId: currentDeckBuilderHero.id,
            heroUnitType: currentDeckBuilderHero.unitType,
            cardList: currentDeckBuilderDeck
        };
    
    console.log('[DECK BUILDER] Saving deck:', { url, method, body: { ...body, cardList: `[${body.cardList.length} cards]` } });
    
    fetch(url, {
        method,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    })
    .then(async res => {
        console.log('[DECK BUILDER] Response status:', res.status, res.statusText);
        console.log('[DECK BUILDER] Response headers:', res.headers.get('content-type'));
        
        // Check if response is OK and is JSON
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await res.text();
            console.error('[DECK BUILDER] Non-JSON response:', text.substring(0, 500));
            throw new Error('Server returned non-JSON response. Status: ' + res.status + '. Response: ' + text.substring(0, 200));
        }
        
        const data = await res.json();
        
        if (!res.ok) {
            throw new Error(data.message || `HTTP ${res.status}: ${res.statusText}`);
        }
        
        return data;
    })
    .then(data => {
        if (data.success) {
            alert(`Deck "${deckName}" saved successfully!`);
            // Reload user decks to show the new/updated deck
            loadUserDecks();
            closeDeckBuilder();
        } else {
            alert('Error saving deck: ' + (data.message || 'Unknown error'));
        }
    })
    .catch(error => {
        console.error('Error saving deck:', error);
        alert('Failed to save deck: ' + (error.message || 'Unknown error'));
    });
}

function resetDeckBuilder() {
    if (confirm('Reset deck? This will clear all cards from your deck.')) {
        currentDeckBuilderDeck = [];
        document.getElementById('deckNameInput').value = '';
        renderDeckBuilderCards();
        updateDeckDisplay();
    }
}

function backToHeroSelection() {
    if (confirm('Go back to hero selection? Your current deck will be lost.')) {
        document.getElementById('deckBuilderHeroSelection').style.display = 'block';
        document.getElementById('deckBuilderCardSelection').style.display = 'none';
        currentDeckBuilderHero = null;
        currentDeckBuilderDeck = [];
        currentDeckBuilderEditingId = null;
        document.getElementById('deckBuilderHeroList').innerHTML = '';
        document.getElementById('deckBuilderSavedDecksList').innerHTML = '';
        document.getElementById('deckBuilderSavedDecksSection').style.display = 'none';
        // Reload decks in case any were deleted/updated
        loadUserDecks();
    }
}

function closeDeckBuilder() {
    document.getElementById('deckBuilderModal').style.display = 'none';
    // Reset state
    currentDeckBuilderHero = null;
    currentDeckBuilderDeck = [];
    currentDeckBuilderTab = 'all';
    currentDeckBuilderEditingId = null;
    // Return to either main menu or account dashboard, whichever was open
    const accountDashboard = document.getElementById('accountDashboardModal');
    if (accountDashboard && accountDashboard.style.display !== 'none') {
        accountDashboard.style.display = 'block';
    } else {
        document.getElementById('mainMenuModal').style.display = 'block';
    }
}

// Make functions available globally
if (typeof window !== 'undefined') {
    window.openDeckBuilder = openDeckBuilder;
    window.openDeckBuilderFromDashboard = openDeckBuilderFromDashboard;
    window.selectDeckBuilderUnitType = selectDeckBuilderUnitType;
    window.previewDeckBuilderHero = previewDeckBuilderHero;
    window.openChangePasswordModal = openChangePasswordModal;
    window.closeChangePasswordModal = closeChangePasswordModal;
    window.submitChangePassword = submitChangePassword;
    window.openChangeEmailModal = openChangeEmailModal;
    window.closeChangeEmailModal = closeChangeEmailModal;
    window.submitChangeEmail = submitChangeEmail;
    window.openGameSettingsModal = openGameSettingsModal;
    window.closeGameSettingsModal = closeGameSettingsModal;
    window.confirmDeckBuilderHero = confirmDeckBuilderHero;
    window.cancelDeckBuilderHeroSelection = cancelDeckBuilderHeroSelection;
    window.selectDeckBuilderHero = selectDeckBuilderHero;
    window.selectDeckBuilderTab = selectDeckBuilderTab;
    window.saveDeckPreset = saveDeckPreset;
    window.resetDeckBuilder = resetDeckBuilder;
    window.backToHeroSelection = backToHeroSelection;
    window.closeDeckBuilder = closeDeckBuilder;
    window.toggleCardInDeck = toggleCardInDeck;
    window.editSavedDeck = editSavedDeck;
    window.deleteSavedDeck = deleteSavedDeck;
    window.renameSavedDeck = renameSavedDeck;
    window.copySavedDeck = copySavedDeck;
    window.switchDashboardTab = switchDashboardTab;
    window.switchSocialView = switchSocialView;
    window.loadDashboardDecks = loadDashboardDecks;
    window.editDashboardDeck = editDashboardDeck;
    window.logoutAllSessions = logoutAllSessions;
    window.openAccountDeletionModal = openAccountDeletionModal;
    window.closeAccountDeletionModal = closeAccountDeletionModal;
    window.submitAccountDeletion = submitAccountDeletion;
    window.cancelAccountDeletion = cancelAccountDeletion;
    window.loadDeletionStatus = loadDeletionStatus;
    window.loadFriends = loadFriends;
    window.loadFriendRequests = loadFriendRequests;
    window.challengeFriend = challengeFriend;
    window.handleFriendChallenge = handleFriendChallenge;
    window.updateFriendStatus = updateFriendStatus;
    window.switchFriendsView = switchFriendsView;
    window.blockUser = blockUser;
    window.unblockUser = unblockUser;
    window.loadBlockedUsers = loadBlockedUsers;
    window.openComposeMessageModal = openComposeMessageModal;
    window.closeComposeMessageModal = closeComposeMessageModal;
    window.sendMessage = sendMessage;
    window.switchMessagesView = switchMessagesView;
    window.loadMessages = loadMessages;
    window.viewMessage = viewMessage;
    window.deleteMessage = deleteMessage;
    window.markMessageRead = markMessageRead;
    window.markAllMessagesRead = markAllMessagesRead;
}

function logout() {
    // Clear authentication data
    localStorage.removeItem('token');
    sessionStorage.removeItem('userData');
    sessionStorage.removeItem('isLoggedIn');

    console.log('[LOGOUT] User logged out');

    // Update login/logout button if it exists
    if (typeof updateLoginLogoutButton === 'function') {
        updateLoginLogoutButton();
    }

    // Redirect to auth page
    window.location.href = '/auth.html';
}

// Initialize when script loads (after lords-of-war.js)
if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeGameData);
    } else {
        // Scripts load synchronously, so wait a tick
        setTimeout(initializeGameData, 0);
    }
}
