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

function initMultiplayer(serverUrl = 'http://localhost:3000') {
  if (window.networkManager) {
    networkManager = window.networkManager;
  } else {
    networkManager = new NetworkManager();
    window.networkManager = networkManager;
  }

  networkManager.connect(serverUrl);

  // Register event handlers
  networkManager.on('gameStart', (data) => {
    console.log('[Game] Game started, initializing with state:', data.gameState);
    initializeMultiplayerGame(data);
  });

  networkManager.on('stateUpdate', (gameState) => {
    console.log('[Game] Received state update from server');
    applyServerState(gameState);
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
}

function initializeMultiplayerGame(data) {
  gameMode = 'multiplayer';
  setGameMode('multiplayer');

  // Store game info
  game.roomId = data.roomId;
  game.playerRole = data.yourRole;

  // Apply the server state (which has heroes, decks, hands)
  applyServerState(data.gameState);

  // Show roll modal
  showRollModal(data.gameState.currentPlayer);
}

function showRollModal(firstPlayerRole) {
  // Hide all modals
  const modals = document.querySelectorAll('.modal');
  modals.forEach(m => m.style.display = 'none');

  // Show roll modal
  document.getElementById('rollModal').style.display = 'flex';
  document.getElementById('modalOverlay').style.display = 'block';

  // Animate the dice roll
  let rollCount = 0;
  const rollInterval = setInterval(() => {
    rollCount++;
    const roll = Math.floor(Math.random() * 6) + 1;
    document.getElementById('rollDisplay').textContent = ['⚫', '🔴', '🟡', '🟢', '🔵', '🟣'][roll - 1];

    if (rollCount > 15) {
      clearInterval(rollInterval);

      // Show result
      const isPlayerFirst = firstPlayerRole === networkManager.playerRole;
      const resultText = isPlayerFirst
        ? '🎯 YOU GO FIRST!'
        : '⏳ OPPONENT GOES FIRST';
      const resultColor = isPlayerFirst ? '#2ecc71' : '#ff6b6b';

      document.getElementById('rollResult').textContent = resultText;
      document.getElementById('rollResult').style.color = resultColor;
      document.getElementById('rollStartBtn').style.display = 'inline-block';
    }
  }, 100);
}

function startGameAfterRoll() {
  // Hide modals
  document.getElementById('rollModal').style.display = 'none';
  document.getElementById('modalOverlay').style.display = 'none';

  // Show game board
  const gameBoard = document.querySelector('.game-board');
  if (gameBoard) gameBoard.style.display = 'grid';

  // Start the game with proper turn
  log('Game started! Your hero: ' + game.player.hero.name);

  // Determine whose turn it is
  if (game.currentPlayer === 'player') {
    startTurn('player');
  } else {
    startTurn('enemy');
  }
}

function applyServerState(serverState) {
  // Map server state to our game state perspective
  // The server sends player1 and player2, we need to map based on our role

  if (networkManager.playerRole === 'player1') {
    game.player = JSON.parse(JSON.stringify(serverState.player1));
    game.enemy = JSON.parse(JSON.stringify(serverState.player2));
  } else {
    // We're player2, so enemy is player1
    game.player = JSON.parse(JSON.stringify(serverState.player2));
    game.enemy = JSON.parse(JSON.stringify(serverState.player1));
  }

  game.currentPlayer = (serverState.currentPlayer === networkManager.playerRole) ? 'player' : 'enemy';
  game.turnNumber = serverState.turnNumber;

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

  updateUI();
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
    entry.textContent = `Turn ${game.turnNumber}: ${message}`;
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

function createDeck(heroUnitType = null) {
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
    
    // Add units based on hero type (ONLY hero's type)
    if (heroUnitType === 'ranged') {
        // Ranged hero: ONLY ranged units
        deckList.push('archer', 'archer', 'archer', 'crossbow', 'crossbow', 'skirmisher', 'skirmisher', 'scout', 'scout');
    } else if (heroUnitType === 'infantry') {
        // Infantry hero: ONLY infantry units
        deckList.push('footman', 'footman', 'footman', 'swordsman', 'swordsman', 'swordsman', 'knight', 'sergeant', 'sergeant');
    } else if (heroUnitType === 'cavalry') {
        // Cavalry hero: ONLY cavalry units
        deckList.push('horseman', 'horseman', 'horseman', 'camelRider', 'camelRider', 'mountedKnight', 'messenger', 'messenger');
    } else {
        // Default mix (equal distribution)
        deckList.push('archer', 'archer', 'crossbow', 'skirmisher', 'skirmisher');
        deckList.push('footman', 'footman', 'swordsman', 'swordsman', 'knight');
        deckList.push('horseman', 'horseman', 'camelRider', 'mountedKnight');
    }
    
    // Add abilities based on hero type (ONLY hero's type abilities)
    if (heroUnitType === 'ranged') {
        deckList.push('quickShot', 'quickShot', 'aimedShot', 'aimedShot', 'masterShot', 'rangersMark', 'bowEnchantment', 'quiverRefill', 'quiverRefill');
    } else if (heroUnitType === 'infantry') {
        deckList.push('quickStrike', 'quickStrike', 'focusStrike', 'focusStrike', 'swordEnchantment', 'shieldWall', 'supplyLine', 'supplyLine');
    } else if (heroUnitType === 'cavalry') {
        deckList.push('quickCharge', 'quickCharge', 'focusCharge', 'focusCharge', 'axeEnchantment', 'cavalryFormation', 'courierNetwork', 'courierNetwork');
    } else {
        // Default mix
        deckList.push('quickShot', 'aimedShot', 'quickStrike', 'focusStrike', 'quickCharge', 'focusCharge');
    }
    
    // Add equipment based on hero type (weapons and armor)
    if (heroUnitType === 'ranged') {
        deckList.push('bow', 'bow');
        // Ranged armor (no shield/back/boots/necklace)
        deckList.push('clothCoif', 'paddedClothArmor', 'paddedClothChaps');
    } else if (heroUnitType === 'infantry') {
        deckList.push('sword', 'sword');
        // Infantry armor (no boots/gloves/necklace/cape)
        deckList.push('plateHelmet', 'plateBody', 'plateLegs', 'kiteShield');
    } else if (heroUnitType === 'cavalry') {
        deckList.push('axe', 'axe');
        // Cavalry armor (no boots/gloves/necklace/cape)
        deckList.push('leatherCap', 'leatherArmor', 'leatherLeggings', 'leatherShield');
    } else {
        // Default: one of each
        deckList.push('bow', 'sword', 'axe');
    }
    
    // Fill to 30 cards with cards matching hero type
    const fillCards = {
        'ranged': ['archer', 'skirmisher', 'quickShot'],
        'infantry': ['footman', 'swordsman', 'quickStrike'],
        'cavalry': ['horseman', 'camelRider', 'quickCharge']
    };
    const fillSet = fillCards[heroUnitType] || ['archer', 'footman', 'horseman'];
    
    while (deckList.length < 60) {
        deckList.push(...fillSet);
    }
    deckList.length = 60; // Trim to exactly 60 (doubled from 30)

    deckList.forEach(cardId => {
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

    updateUI();
    return card;
}

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
    if (flagSelect) {
        flagSelect.innerHTML = '';
        WORLD_FLAGS.forEach(flag => {
            const option = document.createElement('option');
            option.value = flag.split(' ')[0]; // Get just the emoji
            option.textContent = flag;
            flagSelect.appendChild(option);
        });
        flagSelect.value = '🇺🇸'; // Default to USA
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

function concedeGame() {
    game.player.health = 0;
    checkWinCondition();
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
    updateUI(); // Refresh UI to apply theme changes
}

function startSinglePlayer() {
    let playerName = document.getElementById('playerNameInput').value.trim();

    // If no name entered, generate random anonymous name
    if (!playerName) {
        const randomNum = Math.floor(Math.random() * 999) + 1; // 1-999
        playerName = `Anon${String(randomNum).padStart(3, '0')}`; // Anon001-Anon999
    }

    // Get selected flag
    const playerFlagSelect = document.getElementById('playerFlagSelect');
    const playerFlag = playerFlagSelect ? playerFlagSelect.value : '🇺🇸';

    window.playerAlias = playerName;
    window.playerFlag = playerFlag;

    // selectedColor and selectedTheme are already set by selectColor() and selectTheme()

    // Hide main menu, show game start modal
    const mainMenu = document.getElementById('mainMenuModal');
    const gameStart = document.getElementById('gameStartModal');
    const overlay = document.getElementById('modalOverlay');
    if (mainMenu) mainMenu.style.display = 'none';
    if (gameStart) gameStart.style.display = 'block';
    if (overlay) overlay.style.display = 'block'; // Keep overlay visible

    // Show unit type selection
    showUnitTypeSelection();
}

function showGameInstructions() {
    const instructionsModal = document.getElementById('instructionsModal');
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
        <h1>⚔️ Choose Your Leader ⚔️</h1>
        <p>Select one of these ${unitType.charAt(0).toUpperCase() + unitType.slice(1)} commanders:</p>
        <div style="display: flex; flex-direction: column; gap: 15px; margin: 20px 0; max-width: 800px; margin-left: auto; margin-right: auto;">
            ${options.map((hero, idx) => `
                <button onclick="selectHero('${hero.id}')" style="display: flex; align-items: center; gap: 15px; padding: 15px; border: 2px solid #8b6f47; border-radius: 8px; background: rgba(0, 0, 0, 0.3); cursor: pointer; text-align: left; transition: all 0.2s;">
                    <div style="width: 100px; height: 120px; border-radius: 4px; border: 2px solid #8b6f47; background: ${hero.color || '#333'}; display: flex; align-items: center; justify-content: center; font-size: 32px; font-weight: bold; color: #ffd700; flex-shrink: 0;">
                        ${hero.portrait}
                    </div>
                    <div style="flex: 1;">
                        <div style="font-size: 18px; font-weight: bold; color: #ffd700;">${hero.name}</div>
                        <div style="font-size: 12px; color: #f4e4c1; margin-top: 5px;"><strong>Health:</strong> ${hero.health}</div>
                        <div style="font-size: 12px; color: #f4e4c1; margin-top: 5px;"><strong>Passive:</strong> ${hero.passive || ''}</div>
                        <div style="font-size: 11px; color: #ffd700; margin-top: 5px;"><strong>${hero.commandName}:</strong> ${hero.commandText}</div>
                    </div>
                </button>
            `).join('')}
        </div>
        <button onclick="showUnitTypeSelection()" style="margin-top: 20px; padding: 10px 30px; font-size: 12px;">← Back</button>
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
        <h1>⚔️ Lords of War ⚔️</h1>
        <p>Choose Your Unit Type:</p>

        <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: nowrap; margin: 20px 0; max-width: 100%;">
            <!-- Ranged -->
            <div style="text-align: center; flex: 1; min-width: 0;">
                <button onclick="chooseUnitType('ranged')" style="padding: 12px 20px; font-size: 14px; width: 100%; max-width: 130px;">🏹 Ranged</button>
                <div style="background: rgba(0, 0, 0, 0.5); border: 1px solid #8b6f47; border-radius: 4px; padding: 8px 10px; margin-top: 6px; color: #ffd700; font-size: 10px; line-height: 1.4; text-align: center;">
                    <div style="font-weight: bold; font-size: 10px;">No melee retaliation</div>
                    <div style="font-size: 9px;">Cloth Armor</div>
                    <div style="font-size: 9px;">High ATK, Low DEF</div>
                </div>
            </div>

            <!-- Infantry -->
            <div style="text-align: center; flex: 1; min-width: 0;">
                <button onclick="chooseUnitType('infantry')" style="padding: 12px 20px; font-size: 14px; width: 100%; max-width: 130px;">🛡️ Infantry</button>
                <div style="background: rgba(0, 0, 0, 0.5); border: 1px solid #8b6f47; border-radius: 4px; padding: 8px 10px; margin-top: 6px; color: #ffd700; font-size: 10px; line-height: 1.4; text-align: center;">
                    <div style="font-weight: bold; font-size: 10px;">Hero starts with weapon</div>
                    <div style="font-size: 9px;">Heavy Armor</div>
                    <div style="font-size: 9px;">Med ATK/DEF</div>
                </div>
            </div>

            <!-- Cavalry -->
            <div style="text-align: center; flex: 1; min-width: 0;">
                <button onclick="chooseUnitType('cavalry')" style="padding: 12px 20px; font-size: 14px; width: 100%; max-width: 130px;">🐎 Cavalry</button>
                <div style="background: rgba(0, 0, 0, 0.5); border: 1px solid #8b6f47; border-radius: 4px; padding: 8px 10px; margin-top: 6px; color: #ffd700; font-size: 10px; line-height: 1.4; text-align: center;">
                    <div style="font-weight: bold; font-size: 10px;">All Cav get 'Charge'</div>
                    <div style="font-size: 9px;">Leather Armor</div>
                    <div style="font-size: 9px;">Very High ATK, Low DEF</div>
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
    window.changeLanguage = changeLanguage;
    window.showComingSoon = showComingSoon;
    window.chooseUnitType = chooseUnitType;
    window.selectHero = selectHero;
    window.showUnitTypeSelection = showUnitTypeSelection;
    window.returnToMainMenu = returnToMainMenu;
}

function startGame(heroId) {
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
        console.log('Sending hero selection to server:', heroData.id);
        networkManager.socket.emit('selectHero', { heroId: heroData.id, hero: heroData });
        log('Hero selected! Waiting for opponent...');
        return;
    }
    
    // Use the global CARD_DATABASE for deck creation
    const cardDB = window.CARD_DATABASE || {};

    // Set player hero
    game.player.hero = heroData;
    game.player.health = heroData.health;
    game.player.maxHealth = heroData.health;
    game.player.deck = createDeck(heroData.unitType);
    game.player.hand = [];
    game.player.board = [];
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

    // Give Infantry a starting sword for balance
    if (heroData.unitType === 'infantry') {
        const CARD_DATABASE = window.CARD_DATABASE || {};
        const sword = CARD_DATABASE.sword || {
            id: 'sword',
            name: 'Sword',
            type: 'equipment',
            attackPower: 2,
            equipSlot: 'weapon'
        };
        game.player.equipmentSlots.weapon = sword;
    }

    // Set enemy hero (random different type)
    const enemyTypes = Object.keys(HISTORIC_LEADERS).filter(t => t !== heroData.unitType);
    const enemyType = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
    const enemyLeaders = HISTORIC_LEADERS[enemyType] || [];
    const enemyHero = enemyLeaders[Math.floor(Math.random() * enemyLeaders.length)];
    
    game.enemy.hero = enemyHero;
    game.enemy.health = game.enemy.hero.health;
    game.enemy.maxHealth = game.enemy.hero.health;
    game.enemy.deck = createDeck(enemyHero.unitType);
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

    if (modal) modal.style.display = 'none';
    if (overlay) overlay.style.display = 'none';
    if (gameBoard) gameBoard.style.display = 'block';
    if (bottomBar) bottomBar.style.display = 'flex';
    if (gameLog) gameLog.style.display = 'block';
    if (endTurnBtn) endTurnBtn.style.display = 'block';
    if (settingsBtn) settingsBtn.classList.remove('hidden');

    // Draw starting hands
    for (let i = 0; i < 3; i++) {
        drawCard('player');
        drawCard('enemy');
    }

    log('Game started!');
    log(`Player chose ${heroData.name} (${heroData.unitType})`);
    log(`Enemy is ${game.enemy.hero.name} (${game.enemy.hero.unitType})`);

    startTurn('player');
    updateUI();

    // Scroll buttons disabled - cards auto-scale to fit
}

// Functions will be made global after they're defined (see end of file)

function startTurn(player) {
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
        if (gameMode === 'multiplayer') {
            // In multiplayer, opponent's actions come from server
            log('Waiting for opponent...', 'enemy');
        } else {
            // Single-player: run AI
            setTimeout(() => playAITurn(), 1500);
        }
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
        networkManager.sendEndTurn();
        return;
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
            if (card.id.includes('quick') && !card.needsTarget) {
                // Random target
                const enemyBoard = player === 'player' ? game.enemy.board : game.player.board;
                const enemyData = player === 'player' ? game.enemy : game.player;

                if (enemyBoard.length > 0) {
                    const randomTarget = enemyBoard[Math.floor(Math.random() * enemyBoard.length)];
                    dealDamage(randomTarget, damageAmount, player);
                } else {
                    damageHero(enemyData, damageAmount, player);
                }
            } else if (target) {
                if (target.type === 'unit' || target.type === 'construct') {
                    dealDamage(target, damageAmount, player);
                } else {
                    const enemyData = player === 'player' ? game.enemy : game.player;
                    damageHero(enemyData, damageAmount, player);
                }

                // Master Shot draws a card
                if (card.id === 'masterShot') {
                    drawCard(player);
                    log(`${card.name} drew a card!`, player);
                }
            }
        } else if (card.id.includes('Mark') || card.id.includes('Formation') || card.id.includes('Wall')) {
            // Buff cards
            if (target && (target.type === 'unit' || target.type === 'construct')) {
                if (card.id.includes('Mark') || card.id.includes('Formation')) {
                    target.power += 2;
                    target.durability += 2;
                    log(`${target.name} gained +2/+2`);
                } else if (card.id.includes('Wall')) {
                    target.durability += 2;
                    log(`${target.name} gained +0/+2`);
                }
            }
        } else if (card.id.includes('Enchantment')) {
            // Permanent enchantments
            const equipType = card.unitType;
            const allCards = [...playerData.hand, ...playerData.board, ...playerData.deck];
            if (playerData.equipment && playerData.equipment.equipType === equipType) {
                playerData.equipment.attackPower = (playerData.equipment.attackPower || 2) + 1;
                log(`All ${equipType} equipment gained +1 attack permanently`);
            }
            allCards.forEach(c => {
                if (c.type === 'equipment' && c.equipType === equipType) {
                    c.attackPower = (c.attackPower || 2) + 1;
                }
            });
            log(`All ${equipType} equipment in deck, hand, and board gained +1 attack!`);
        } else if (card.id === 'quiverRefill' || card.id === 'supplyLine' || card.id === 'courierNetwork') {
            // Draw 3 cards
            for (let i = 0; i < 3; i++) {
                drawCard(player);
            }
            log(`${card.name}: Drew 3 cards!`, player);
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
        
        // Handle weapon equipment (legacy support)
        if (equipSlot === 'weapon') {
            // If weapon already exists, add attack power instead of replacing
            if (playerData.equipmentSlots.weapon) {
                const newAttackPower = (playerData.equipmentSlots.weapon.attackPower || 2) + (card.attackPower || 2);
                playerData.equipmentSlots.weapon.attackPower = newAttackPower;
                // Legacy support
                playerData.equipment = playerData.equipmentSlots.weapon;
                log(`${player} enhanced ${playerData.equipmentSlots.weapon.name} with ${card.name}! Attack increased to ${newAttackPower}`);
            } else {
                playerData.equipmentSlots.weapon = {
                    ...card,
                    attackPower: card.attackPower || 2,
                    equipType: card.equipType || card.unitType
                };
                // Legacy support
                playerData.equipment = playerData.equipmentSlots.weapon;
                log(`${player} equipped ${card.name} to their hero`);
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
    
    // Base health is 30, armor adds to max health
    const newMaxHealth = 30 + armorBonus;
    const oldMaxHealth = playerData.maxHealth || 30;
    const healthIncrease = newMaxHealth - oldMaxHealth;
    
    if (healthIncrease !== 0) {
        playerData.maxHealth = newMaxHealth;
        playerData.health += healthIncrease; // Add the difference to current health
        if (healthIncrease > 0) {
            log(`${player} gained ${healthIncrease} health from armor!`, player);
        } else {
            log(`${player} lost ${Math.abs(healthIncrease)} health from armor change`, player);
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
        const targetType = target === game.enemy.hero ? 'hero' : 'unit';
        networkManager.sendAttack(attacker.instanceId, target.instanceId, targetType);
        return true; // Action sent to server
    }

    if (!attacker.canAttack) {
        log('That construct cannot attack yet');
        return false;
    }

    const attackerData = attackerPlayer === 'player' ? game.player : game.enemy;
    const defenderPlayer = attackerPlayer === 'player' ? 'enemy' : 'player';
    const defenderData = defenderPlayer === 'player' ? game.player : game.enemy;

    log(`${attacker.name} attacks ${target.name || 'Commander'}`, attackerPlayer);

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
        let attackerPower = attacker.power + weaponBonus + typeAdvantage + infantryBonus;
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

    attacker.canAttack = false;
    attacker.exhausted = true;

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
        const targetType = target === game.enemy.hero ? 'hero' : 'unit';
        networkManager.sendUseEquipment(target?.instanceId, targetType);
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
    
    const damage = weapon.attackPower || 2;
    const damageType = weapon.equipType;
    
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

function startEquipmentTargeting(player) {
    const playerData = player === 'player' ? game.player : game.enemy;
    const weapon = (playerData.equipmentSlots && playerData.equipmentSlots.weapon) || playerData.equipment;
    const equipType = weapon ? weapon.equipType : null;
    
    document.body.classList.add('targeting');
    log('Select target for equipment attack...', player);
    
    // Can target any enemy
    const enemyBoard = document.getElementById('enemyBoard');
    if (enemyBoard) {
        const constructEls = enemyBoard.querySelectorAll('.card');
        constructEls.forEach(el => {
            if (el._cardData) {
                el.classList.add('valid-target');
                el.onclick = () => {
                    if (game.targeting && game.targeting.mode === 'equipment') {
                        useEquipmentAttack(player, el._cardData);
                        cancelTargeting();
                    }
                };
            }
        });
    }
    
    const enemyHero = document.getElementById('enemyLord');
    if (enemyHero) {
        enemyHero.classList.add('valid-target');
        enemyHero.onclick = () => {
            if (game.targeting && game.targeting.mode === 'equipment') {
                useEquipmentAttack(player, { type: 'hero', name: 'Enemy' });
                cancelTargeting();
            }
        };
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
    const modal = document.createElement('div');
    modal.className = 'game-info';
    modal.innerHTML = `
        <h2>${message}</h2>
        <p>Game Over</p>
        <div style="display: flex; gap: 20px; justify-content: center; flex-wrap: wrap;">
            <button onclick="this.closest('.game-info').remove()">Keep Playing</button>
            <button onclick="location.reload()">Play Again</button>
            <button onclick="returnToMainMenu()">Main Menu</button>
        </div>
    `;
    modal.id = 'gameOverModal';
    document.body.appendChild(modal);
}

function returnToMainMenu() {
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
    const gameOverModal = document.getElementById('gameOverModal');
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
    if (gameOverModal) gameOverModal.remove();

    // Reset player name input with new random name
    const playerNameInput = document.getElementById('playerNameInput');
    if (playerNameInput) {
        const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        playerNameInput.value = `Anon${randomNum}`;
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

function updateUI() {
    // Auto-merge any duplicate units on both boards before rendering
    autoMergeBoard('player');
    autoMergeBoard('enemy');

    // Update heroes
    document.getElementById('playerHealth').textContent = game.player.health;
    document.getElementById('enemyHealth').textContent = game.enemy.health;

    if (game.player.hero) {
        const playerLordName = document.querySelector('#playerLord .lord-name');
        if (playerLordName) playerLordName.textContent = game.player.hero.name;

        // Display player alias and flag below hero name
        const playerAliasEl = document.getElementById('playerAlias');
        if (playerAliasEl) {
            const flag = window.playerFlag || '⚔️';
            playerAliasEl.textContent = `${flag} ${window.playerAlias || 'Player'}`;
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

            // Always show hero ability power
            if (commandTitle) {
                commandTitle.textContent = game.player.hero.commandName || 'Command';
            }
            if (commandCost) {
                const cost = game.player.hero.commandCost || game.player.hero.heroPowerCost || 2;
                commandCost.textContent = `${cost} Gold`;
            }

            // Check if afford able
            const cost = game.player.hero.commandCost || game.player.hero.heroPowerCost || 2;
            const canAfford = game.player.currentEssence >= cost;

            // Disable if already used or not player's turn
            const isDisabled = game.player.heroPowerUsed || game.currentPlayer !== 'player';
            const isNotAffordable = !canAfford && game.currentPlayer === 'player' && !game.player.heroPowerUsed;

            playerCommand.classList.toggle('disabled', isDisabled);
            playerCommand.classList.toggle('not-affordable', isNotAffordable);
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
        const enemyLordName = document.querySelector('#enemyLord .lord-name');
        if (enemyLordName) enemyLordName.textContent = game.enemy.hero.name;
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
    
    // Show/hide end turn button based on current player
    const endTurnBtn = document.getElementById('endTurnBtn');
    const settingsBtn = document.getElementById('settingsBtn');

    if (endTurnBtn) {
        if (game.currentPlayer === 'player') {
            endTurnBtn.classList.remove('hidden');
        } else {
            endTurnBtn.classList.add('hidden');
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
    if (weapon) {
        const attackDisplay = document.createElement('div');
        attackDisplay.className = 'lord-attack';
        attackDisplay.innerHTML = `⚔️ <span>${weapon.attackPower || 2}</span>`;
        lordEl.appendChild(attackDisplay);
    }
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
        board.appendChild(cardEl);
    });
}

function updateHand() {
    const hand = document.getElementById('playerHand');
    hand.innerHTML = '';

    // Group cards by ID and tier to detect duplicates (different tiers are separate stacks)
    const cardGroups = {};
    game.player.hand.forEach((card, index) => {
        const groupKey = `${card.id}_T${card.tier || 1}`;
        if (!cardGroups[groupKey]) {
            cardGroups[groupKey] = [];
        }
        cardGroups[groupKey].push(card);
    });

    // Sort cards by type: equipment (left), monsters/units (middle), abilities (right)
    const typeOrder = { 'equipment': 0, 'unit': 1, 'construct': 1, 'ability': 2 };
    const sortedGroups = Object.entries(cardGroups).sort((a, b) => {
        const typeA = typeOrder[a[1][0].type] ?? 3;
        const typeB = typeOrder[b[1][0].type] ?? 3;
        return typeA - typeB;
    });

    // Render cards or stacks in sorted order
    sortedGroups.forEach(([cardId, cardList]) => {
        if (cardList.length === 1) {
            // Single card - render normally
            const card = cardList[0];
            const cardEl = createCardElement(card, 'player', false);
            if (card.justDrawn) {
                cardEl.classList.add('card-draw-animation');
                delete card.justDrawn;
            }
            hand.appendChild(cardEl);
        } else {
            // Multiple cards - create stack
            const stackEl = document.createElement('div');
            stackEl.className = 'card-stack';

            // Add all duplicate cards to the stack
            cardList.forEach((card) => {
                const cardEl = createCardElement(card, 'player', false);
                if (card.justDrawn) {
                    cardEl.classList.add('card-draw-animation');
                    delete card.justDrawn;
                }
                stackEl.appendChild(cardEl);
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
    enemyHandDisplay.innerHTML = '';

    // Get player's theme for card back color
    const themeKey = window.selectedTheme || 'blue';
    const theme = THEMES[themeKey];

    // Show card backs for enemy hand (with player's theme color)
    game.enemy.hand.forEach((card, index) => {
        const cardBack = document.createElement('div');
        cardBack.className = 'card-back';
        cardBack.style.zIndex = index;
        if (theme) {
            cardBack.style.backgroundColor = theme.cardBack;
            cardBack.style.borderColor = theme.cardBorder;
        }
        enemyHandDisplay.appendChild(cardBack);
    });
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
    
    // Compact card layout: Cost, Name on header, stats on bottom
    const hasStats = (card.type === 'construct' || card.type === 'unit' || card.type === 'equipment');
    const tierClass = card.tier ? `tier-${card.tier}` : 'tier-1';
    cardEl.innerHTML = `
        <div class="card-header">
            <div class="card-cost">${card.cost}</div>
            <div class="card-name ${tierClass}">${card.name}</div>
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
                    <div class="card-stat stat-power">⚔️${card.power}</div>
                    ${card.unitType ? `<div class="card-type-icon">${getUnitTypeIcon(card.unitType)}</div>` : ''}
                    <div class="card-stat stat-health">❤️${card.durability}</div>
                `}
            </div>
        ` : ''}
        ${onBoard && card.keywords ? `<div class="card-type-badge">${card.keywords.join(', ')}</div>` : ''}
    `;

    // Apply theme colors to player cards
    if (owner === 'player') {
        const themeKey = window.selectedTheme || 'blue';
        const theme = THEMES[themeKey];
        if (theme) {
            cardEl.style.backgroundColor = theme.cardBg;
            cardEl.style.borderColor = theme.cardBorder;
        }
    }

    // Add tooltip data attribute for description and effects (after innerHTML so it persists)
    if (!onBoard) {
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
        if (tooltipText) {
            cardEl.setAttribute('data-description', tooltipText);
            cardEl.classList.add('card-tooltip');
        }
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

function getCardArt(card) {
    // Return emoji/icon based on card type and specific card
    if (card.type === 'construct') {
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

    if (card.needsTarget || (card.targetType && card.targetType !== 'any')) {
        startTargeting(card);
    } else {
        playCard(card, 'player');
    }
}

function handleConstructClick(construct) {
    if (game.currentPlayer !== 'player') return;

    // Only handle attacking - spell targeting is now handled by startTargeting() click handlers
    if (!game.targeting) {
        // Attack with this construct
        if (construct.canAttack) {
            startAttacking(construct);
        }
    }
}

function startTargeting(card) {
    game.targeting = { card, mode: 'spell' };
    document.body.classList.add('targeting');
    log('Select a target for ' + card.name + '...', 'player');

    // Add visual highlights and click handlers to valid targets
    if (card.targetType === 'unit' || card.targetType === 'construct') {
        // Target enemy units/constructs
        const enemyBoard = document.getElementById('enemyBoard');
        if (enemyBoard) {
            const constructEls = enemyBoard.querySelectorAll('.card');
            constructEls.forEach(el => {
                if (el._cardData) {
                    el.classList.add('valid-target');
                    el.onclick = () => {
                        if (game.targeting && game.targeting.mode === 'spell') {
                            playCard(card, 'player', el._cardData);
                            cancelTargeting();
                        }
                    };
                }
            });
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
                                if (game.targeting.mode === 'spell') {
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

        // Also allow targeting heroes if applicable
        const enemyHero = document.getElementById('enemyLord');
        if (enemyHero) {
            enemyHero.classList.add('valid-target');
            enemyHero.onclick = () => {
                if (game.targeting) {
                    if (game.targeting.mode === 'spell') {
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

    // Add click handler to enemy hero (if no guards)
    if (guards.length === 0) {
        const enemyHero = document.getElementById('enemyLord');
        enemyHero.classList.add('valid-target');
        enemyHero.onclick = () => {
            if (game.targeting && game.targeting.mode === 'attack') {
                attack(game.targeting.attacker, { name: 'Enemy' }, 'player');
                cancelTargeting();
            }
        };
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

const playerCommandEl = document.getElementById('playerCommand');
if (playerCommandEl) {
    playerCommandEl.onclick = () => {
        if (game.currentPlayer === 'player' && game.player.hero && !game.player.heroPowerUsed) {
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
    cardPreviewEl.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; gap: 3px;">
            <span style="font-size: 13px; font-weight: bold; color: #ffd700; flex: 1; word-wrap: break-word;">${card.name}</span>
            <div style="background: radial-gradient(circle, #d4af37 0%, #aa8b2c 100%); width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; color: #fff; font-size: 10px; flex-shrink: 0;">${card.cost}</div>
        </div>
        ${hasStats ? `
            <div style="display: flex; gap: 5px; margin-bottom: 6px;">
                <div style="background: radial-gradient(circle, #ff6b35 0%, #c41e3a 100%); width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; color: #fff; font-size: 10px;">⚔️${card.power}</div>
                <div style="background: radial-gradient(circle, #4ecdc4 0%, #2d8b85 100%); width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; color: #fff; font-size: 10px;">❤️${card.durability}</div>
            </div>
        ` : ''}
        <div style="font-size: 11px; line-height: 1.2; color: #f4e4c1; flex: 1; overflow-y: auto;">${card.text || ''}</div>
        ${card.keywords ? `<div style="font-size: 10px; color: #d4af37; margin-top: 3px;"><strong>Keywords:</strong> ${card.keywords.join(', ')}</div>` : ''}
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
    if (left + 160 > window.innerWidth) {
        left = event.clientX - 160 - padding;
    }
    if (top + 230 > window.innerHeight) {
        top = event.clientY - 230 - padding;
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
        window.concedeGame = concedeGame;
        window.returnToMainMenuFromGame = returnToMainMenuFromGame;
        window.setupUnitTypeTooltips = setupUnitTypeTooltips;

        // Initialize modal on page load
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                // Set default random player name
                const playerNameInput = document.getElementById('playerNameInput');
                if (playerNameInput) {
                    const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
                    playerNameInput.value = `Anon${randomNum}`;
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
            // Set default random player name
            const playerNameInput = document.getElementById('playerNameInput');
            if (playerNameInput) {
                const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
                playerNameInput.value = `Anon${randomNum}`;
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

    // Initialize network manager
    if (!window.networkManager || !networkManager) {
        window.networkManager = new NetworkManager();
        networkManager = window.networkManager;
    }

    // Show lobby
    document.getElementById('mainMenuModal').style.display = 'none';
    document.getElementById('lobbyModal').style.display = 'flex';

    // Set up game found handler to show hero selection
    const tempHandler = () => {
        console.log('[Game] Opponent found! Showing hero selection...');
        showMultiplayerHeroSelection();
    };

    // Register game found handler FIRST
    networkManager.on('gameFound', tempHandler);

    // Connect and wait for connection before joining queue
    initMultiplayer();

    const playerData = {
        playerId: generatePlayerId(),
        name: playerName,
        unitType: 'ranged', // Default, can be changed
        hero: null
    };

    // Wait for connection to be established before joining queue
    const checkConnection = setInterval(() => {
        if (networkManager && networkManager.isConnected()) {
            console.log('[Game] Connected! Joining queue...');
            clearInterval(checkConnection);
            networkManager.joinQueue(playerData);
        }
    }, 100);

    // Safety timeout - if not connected after 10 seconds, give up
    setTimeout(() => {
        if (!networkManager.isConnected()) {
            clearInterval(checkConnection);
            console.error('[Game] Failed to connect to server after 10 seconds');
            alert('Failed to connect to multiplayer server. Check that the server is running on localhost:3000');
            document.getElementById('lobbyModal').style.display = 'none';
            document.getElementById('mainMenuModal').style.display = 'flex';
        }
    }, 10000);
}

// Store selected hero for multiplayer
let selectedMultiplayerHero = null;

function showMultiplayerHeroSelection() {
    document.getElementById('lobbyModal').style.display = 'none';
    document.getElementById('multiplayerHeroModal').style.display = 'flex';
    document.getElementById('modalOverlay').style.display = 'block';

    // Hide game board
    const gameBoard = document.querySelector('.game-board');
    if (gameBoard) gameBoard.style.display = 'none';
}

function selectMultiplayerUnitType(unitType) {
    const HISTORIC_LEADERS = window.HISTORIC_LEADERS || {};
    const heroes = HISTORIC_LEADERS[unitType] || [];

    const heroList = document.getElementById('multiplayerHeroList');
    heroList.innerHTML = '';

    heroes.forEach(hero => {
        const btn = document.createElement('button');
        btn.textContent = hero.name;
        btn.style.cssText = 'display: block; width: 100%; padding: 8px 10px; margin: 0; font-size: 12px; background: rgba(74, 144, 226, 0.2); border: 1px solid #8b6f47; border-radius: 0; cursor: pointer; color: #f4e4c1; text-align: left; transition: all 0.15s;';
        btn.onmouseover = () => btn.style.background = 'rgba(74, 144, 226, 0.5)';
        btn.onmouseout = () => btn.style.background = 'rgba(74, 144, 226, 0.2)';
        btn.onclick = () => selectMultiplayerHero(hero);
        heroList.appendChild(btn);
    });
}

function selectMultiplayerHero(hero) {
    console.log('[Game] Selected hero:', hero.name);
    selectedMultiplayerHero = hero;

    // Show hero details
    document.getElementById('multiplayerHeroDetails').style.display = 'flex';
    document.getElementById('selectedHeroName').textContent = hero.name;

    // Show passive ability description
    let passiveText = 'Draw 1 card (costs 2 gold per turn)';
    if (hero.passiveAbility) {
        passiveText = hero.passiveAbility;
    }
    document.getElementById('selectedHeroPassive').textContent = passiveText;

    // Show confirm button
    document.getElementById('confirmHeroBtn').style.display = 'inline-block';
}

function confirmMultiplayerHero() {
    if (!selectedMultiplayerHero) {
        alert('Please select a hero first');
        return;
    }

    console.log('[Game] Confirming hero:', selectedMultiplayerHero.name);

    // Hide confirm button and show waiting message
    document.getElementById('confirmHeroBtn').style.display = 'none';
    document.getElementById('waitingMessage').style.display = 'block';

    // Start game with selected hero (send to server)
    startGame(selectedMultiplayerHero.id);
}

function cancelMatchmaking() {
    if (networkManager) {
        networkManager.leaveQueue();
        networkManager.disconnect();
    }

    // Return to main menu
    document.getElementById('lobbyModal').style.display = 'none';
    document.getElementById('mainMenuModal').style.display = 'flex';
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

    // Show result for 5 seconds then return to menu
    setTimeout(() => {
        resetGame();
        document.getElementById('mainMenuModal').style.display = 'flex';
    }, 5000);
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

// Initialize when script loads (after lords-of-war.js)
if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeGameData);
    } else {
        // Scripts load synchronously, so wait a tick
        setTimeout(initializeGameData, 0);
    }
}
