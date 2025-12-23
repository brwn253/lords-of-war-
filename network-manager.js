// ===== LORDS OF WAR - NETWORK MANAGER =====
// Client-side Socket.io wrapper for multiplayer communication

class NetworkManager {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.roomId = null;
    this.playerId = null;
    this.playerRole = null; // 'player1' or 'player2'
    this.isMultiplayer = false;
    this.eventCallbacks = {};
  }

  /**
   * Connect to the multiplayer server
   * @param {string} serverUrl - Server URL (auto-detects if not provided)
   */
  connect(serverUrl = null) {
    // Auto-detect server URL if not provided
    if (!serverUrl) {
      const protocol = window.location.protocol;
      const hostname = window.location.hostname;
      const port = 8080;
      serverUrl = `${protocol}//${hostname}:${port}`;
    }
    // If already connected and socket is active, ensure handlers are registered
    if (this.connected && this.socket && this.socket.connected) {
      console.log('Already connected to server, ensuring handlers are registered');
      // Handlers should already be registered, but ensure they are
      this._registerSocketHandlers();
      return;
    }

    // Clean up any existing disconnected socket
    if (this.socket && !this.socket.connected) {
      console.log('[NetworkManager] Cleaning up disconnected socket');
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }

    console.log(`[NetworkManager] Connecting to ${serverUrl}`);

    // Check if Socket.io is loaded
    if (typeof io === 'undefined') {
      console.error('[NetworkManager] Socket.io library not loaded! Make sure the CDN script is included in index.html');
      this.emit('error', { message: 'Socket.io library not loaded' });
      return;
    }

    try {
      this.socket = io(serverUrl, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5
      });
    } catch (error) {
      console.error('[NetworkManager] Error creating Socket.io connection:', error);
      this.emit('error', { message: error.message });
      return;
    }

    // Register socket handlers
    this._registerSocketHandlers();
  }

  /**
   * Register all socket event handlers
   * @private
   */
  _registerSocketHandlers() {
    if (!this.socket) {
      console.error('[NetworkManager] Cannot register handlers: socket is null');
      return;
    }

    // Remove existing handlers to prevent duplicates (only for events we care about)
    this.socket.off('bothPlayersReady');
    this.socket.off('waitingForOpponent');

    // Connection events
    this.socket.on('connect', () => {
      this.connected = true;
      console.log('Connected to server:', this.socket.id);
      this.emit('connected');
    });

    this.socket.on('disconnect', () => {
      this.connected = false;
      console.log('Disconnected from server');
      this.emit('disconnected');
    });

    // Game events
    this.socket.on('gameFound', () => {
      console.log('Game found! Waiting to start...');
      this.emit('gameFound');
    });

    this.socket.on('gameStart', (data) => {
      console.log('[NetworkManager] Game starting! Your role:', data.yourRole);
      console.log('[NetworkManager] Game state received:', data.gameState);
      this.roomId = data.roomId;
      this.playerRole = data.yourRole;
      this.isMultiplayer = true;
      this.emit('gameStart', data);
    });

    this.socket.on('bothPlayersReady', (data) => {
      console.log('[NetworkManager] ✓✓✓ Both players ready! Received bothPlayersReady event ✓✓✓');
      console.log('[NetworkManager] Event data:', data);
      this.emit('bothPlayersReady', data);
    });

    this.socket.on('waitingForOpponent', () => {
      console.log('[NetworkManager] Waiting for opponent');
      this.emit('waitingForOpponent');
    });

    this.socket.on('stateUpdate', (gameState) => {
      console.log('[NetworkManager] ⭐ State update received from server!');
      console.log('[NetworkManager] State update currentPlayer:', gameState.currentPlayer);
      console.log('[NetworkManager] Our role:', this.playerRole);
      console.log('[NetworkManager] Room ID:', this.roomId);
      this.emit('stateUpdate', gameState);
    });

    this.socket.on('gameEnd', (result) => {
      console.log('Game ended:', result.result);
      this.isMultiplayer = false;
      this.emit('gameEnd', result);
    });

    this.socket.on('opponentDisconnected', () => {
      console.log('Opponent disconnected');
      this.emit('opponentDisconnected');
    });

    this.socket.on('opponentReconnected', () => {
      console.log('Opponent reconnected');
      this.emit('opponentReconnected');
    });

    this.socket.on('stateSync', (gameState) => {
      console.log('State sync received (reconnection)');
      this.emit('stateSync', gameState);
    });

    this.socket.on('error', (error) => {
      console.error('[NetworkManager] Server error:', error.message || error);
      this.emit('error', { message: typeof error === 'string' ? error : error.message });
    });

    this.socket.on('connect_error', (error) => {
      console.error('[NetworkManager] Connection error:', error.message || error);
      this.emit('error', { message: 'Connection failed: ' + (error.message || error) });
    });

    this.socket.on('disconnect', () => {
      console.log('[NetworkManager] Disconnected from server');
      this.connected = false;
      this.emit('disconnected');
    });
  }

  /**
   * Disconnect from the server
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket.removeAllListeners(); // Remove all event listeners
      this.socket = null;
    }
    this.connected = false;
    this.roomId = null;
    this.playerId = null;
    this.playerRole = null;
    this.isMultiplayer = false;
  }

  // ===== MATCHMAKING =====

  /**
   * Join the quick match queue
   * @param {object} playerData - Player info { name, playerId, unitType, hero }
   */
  joinQueue(playerData) {
    if (!this.connected) {
      console.error('[NetworkManager] Not connected to server - cannot join queue');
      console.error('[NetworkManager] Socket status:', this.socket?.connected);
      return false;
    }

    console.log('[NetworkManager] Joining queue with player data:', playerData);
    this.playerId = playerData.playerId;
    this.socket.emit('joinQueue', playerData);
    return true;
  }

  /**
   * Leave the quick match queue
   */
  leaveQueue() {
    if (!this.connected) return;

    console.log('Leaving queue...');
    this.socket.emit('leaveQueue');
  }

  // ===== GAME ACTIONS =====

  /**
   * Send play card action to server
   * @param {object} card - Card object with id, cost, type, etc.
   * @param {object} target - Target unit/hero if applicable
   */
  sendPlayCard(card, target = null) {
    if (!this.isMultiplayer) return;

    console.log(`Sending playCard: ${card.name}`);
    this.socket.emit('playCard', { card, target });
  }

  /**
   * Send attack action to server
   * @param {string} attackerId - Instance ID of attacking unit
   * @param {string} targetId - Instance ID of target unit
   * @param {string} targetType - 'unit' or 'hero'
   */
  sendAttack(attackerId, targetId, targetType = 'unit') {
    if (!this.isMultiplayer) return;

    console.log('Sending attack');
    this.socket.emit('attack', { attackerId, targetId, targetType });
  }

  /**
   * Send end turn action to server
   */
  sendEndTurn() {
    if (!this.isMultiplayer) {
      console.warn('[NetworkManager] Cannot send endTurn - not in multiplayer game');
      return;
    }

    if (!this.socket) {
      console.error('[NetworkManager] Cannot send endTurn - socket is null!');
      return;
    }

    if (!this.socket.connected) {
      console.error('[NetworkManager] Cannot send endTurn - socket is not connected!');
      return;
    }

    console.log('[NetworkManager] Sending endTurn to server');
    console.log('[NetworkManager] Socket ID:', this.socket.id);
    console.log('[NetworkManager] Socket connected:', this.socket.connected);
    console.log('[NetworkManager] Room ID:', this.roomId);
    console.log('[NetworkManager] Player role:', this.playerRole);
    
    // Send the event with a callback to verify server received it
    this.socket.emit('endTurn');
    console.log('[NetworkManager] endTurn event emitted');
    
    // Also listen for any immediate errors
    const errorTimeout = setTimeout(() => {
      console.log('[NetworkManager] No immediate error received (good sign)');
    }, 1000);
    
    this.socket.once('error', (error) => {
      clearTimeout(errorTimeout);
      console.error('[NetworkManager] Error received from server:', error);
    });
  }

  /**
   * Send hero power usage to server
   * @param {object} target - Target unit/hero if applicable
   */
  sendUseHeroPower(target = null) {
    if (!this.isMultiplayer) return;

    console.log('Sending useHeroPower');
    this.socket.emit('useHeroPower', { target });
  }

  /**
   * Send equipment usage to server
   * @param {string} targetId - Target ID
   * @param {string} targetType - 'unit' or 'hero'
   */
  sendUseEquipment(targetId, targetType = 'hero') {
    if (!this.isMultiplayer) return;

    console.log('Sending useEquipment');
    this.socket.emit('useEquipment', { targetId, targetType });
  }

  /**
   * Send concede action to server
   */
  sendConcede() {
    if (!this.isMultiplayer) return;

    console.log('Sending concede');
    this.socket.emit('concede');
  }

  // ===== EVENT MANAGEMENT =====

  /**
   * Register callback for event
   * @param {string} eventName - Event name
   * @param {function} callback - Callback function
   */
  on(eventName, callback) {
    if (!this.eventCallbacks[eventName]) {
      this.eventCallbacks[eventName] = [];
    }
    this.eventCallbacks[eventName].push(callback);
  }

  /**
   * Emit event to all registered callbacks
   * @param {string} eventName - Event name
   * @param {any} data - Event data
   */
  emit(eventName, data = null) {
    if (this.eventCallbacks[eventName]) {
      this.eventCallbacks[eventName].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${eventName} callback:`, error);
        }
      });
    }
  }

  /**
   * Remove callback for event
   * @param {string} eventName - Event name
   * @param {function} callback - Callback to remove (optional - if not provided, removes all handlers)
   */
  off(eventName, callback) {
    if (!this.eventCallbacks[eventName]) return;
    
    if (callback) {
      // Remove specific callback
      const index = this.eventCallbacks[eventName].indexOf(callback);
      if (index >= 0) {
        this.eventCallbacks[eventName].splice(index, 1);
      }
    } else {
      // Remove all callbacks for this event
      this.eventCallbacks[eventName] = [];
    }
  }

  // ===== HELPER METHODS =====

  /**
   * Check if connected to server
   */
  isConnected() {
    return this.connected;
  }

  /**
   * Check if in active multiplayer game
   */
  isInGame() {
    return this.isMultiplayer && this.roomId;
  }

  /**
   * Get current player role
   */
  getPlayerRole() {
    return this.playerRole;
  }

  /**
   * Get room ID
   */
  getRoomId() {
    return this.roomId;
  }
}

// Create global instance
window.networkManager = null;
