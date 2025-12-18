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
   * @param {string} serverUrl - Server URL (default: http://localhost:3000)
   */
  connect(serverUrl = 'http://localhost:3000') {
    if (this.connected) {
      console.log('Already connected to server');
      return;
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

    this.socket.on('stateUpdate', (gameState) => {
      console.log('State update received');
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
      this.connected = false;
    }
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
    if (!this.isMultiplayer) return;

    console.log('Sending endTurn');
    this.socket.emit('endTurn');
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
   * @param {function} callback - Callback to remove
   */
  off(eventName, callback) {
    if (this.eventCallbacks[eventName]) {
      const index = this.eventCallbacks[eventName].indexOf(callback);
      if (index >= 0) {
        this.eventCallbacks[eventName].splice(index, 1);
      }
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
