// ===== DATABASE INITIALIZATION =====
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'lords_of_war.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err);
  } else {
    console.log('✓ Connected to SQLite database at:', dbPath);
  }
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

const initializeDatabase = () => {
  db.serialize(() => {
    // Users table
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('Error creating users table:', err);
      } else {
        console.log('✓ Users table ready');
      }
    });

    // Player stats table
    db.run(`
      CREATE TABLE IF NOT EXISTS player_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE NOT NULL,
        gold INTEGER DEFAULT 0,
        gems INTEGER DEFAULT 0,
        total_wins INTEGER DEFAULT 0,
        total_losses INTEGER DEFAULT 0,
        current_rank TEXT DEFAULT 'Unranked',
        level INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
      )
    `, (err) => {
      if (err) {
        console.error('Error creating player_stats table:', err);
      } else {
        console.log('✓ Player stats table ready');
      }
    });

    // Beta tester feedback table (optional)
    db.run(`
      CREATE TABLE IF NOT EXISTS feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        feedback TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
      )
    `, (err) => {
      if (err) {
        console.error('Error creating feedback table:', err);
      } else {
        console.log('✓ Feedback table ready');
      }
    });

    // ===== PROFILE FIELDS (Dashboard) =====
    // Add profile columns to player_stats if they don't exist
    db.run(`
      ALTER TABLE player_stats ADD COLUMN display_name TEXT NULL
    `, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding display_name column:', err);
      } else if (!err) {
        console.log('✓ display_name column added to player_stats');
      }
    });

    db.run(`
      ALTER TABLE player_stats ADD COLUMN avatar_id INTEGER DEFAULT 1
    `, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding avatar_id column:', err);
      } else if (!err) {
        console.log('✓ avatar_id column added to player_stats');
      }
    });

    db.run(`
      ALTER TABLE player_stats ADD COLUMN bio TEXT NULL
    `, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding bio column:', err);
      } else if (!err) {
        console.log('✓ bio column added to player_stats');
      }
    });

    // Deck presets table - stores custom deck presets
    db.run(`
      CREATE TABLE IF NOT EXISTS deck_presets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        deck_name TEXT NOT NULL,
        hero_id TEXT NOT NULL,
        hero_unit_type TEXT NOT NULL,
        card_list TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) {
        console.error('Error creating deck_presets table:', err);
      } else {
        console.log('✓ Deck presets table ready');
      }
    });

    // Create index for faster lookups
    db.run(`
      CREATE INDEX IF NOT EXISTS idx_deck_presets_user ON deck_presets(user_id)
    `, (err) => {
      if (err) {
        console.error('Error creating deck_presets index:', err);
      }
    });

    // Match history table - tracks all games played
    db.run(`
      CREATE TABLE IF NOT EXISTS match_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        opponent_name TEXT NOT NULL,
        result TEXT NOT NULL,
        duration INTEGER,
        deck_used_id INTEGER,
        game_mode TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) {
        console.error('Error creating match_history table:', err);
      } else {
        console.log('✓ Match history table ready');
      }
    });

    // Add deck statistics columns to deck_presets
    db.run(`
      ALTER TABLE deck_presets ADD COLUMN wins INTEGER DEFAULT 0
    `, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding wins column:', err);
      } else if (!err) {
        console.log('✓ wins column added to deck_presets');
      }
    });

    db.run(`
      ALTER TABLE deck_presets ADD COLUMN losses INTEGER DEFAULT 0
    `, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding losses column:', err);
      } else if (!err) {
        console.log('✓ losses column added to deck_presets');
      }
    });

    db.run(`
      ALTER TABLE deck_presets ADD COLUMN last_used DATETIME NULL
    `, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding last_used column:', err);
      } else if (!err) {
        console.log('✓ last_used column added to deck_presets');
      }
    });

    // Add preferred unit type to player_stats
    db.run(`
      ALTER TABLE player_stats ADD COLUMN preferred_unit_type TEXT NULL
    `, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding preferred_unit_type column:', err);
      } else if (!err) {
        console.log('✓ preferred_unit_type column added to player_stats');
      }
    });

    // Add XP columns to player_stats
    db.run(`
      ALTER TABLE player_stats ADD COLUMN xp INTEGER DEFAULT 0
    `, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding xp column:', err);
      } else if (!err) {
        console.log('✓ xp column added to player_stats');
      }
    });

    db.run(`
      ALTER TABLE player_stats ADD COLUMN xp_to_next_level INTEGER DEFAULT 100
    `, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding xp_to_next_level column:', err);
      } else if (!err) {
        console.log('✓ xp_to_next_level column added to player_stats');
      }
    });

    // Achievements table
    db.run(`
      CREATE TABLE IF NOT EXISTS achievements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        achievement_id TEXT NOT NULL,
        unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, achievement_id)
      )
    `, (err) => {
      if (err) {
        console.error('Error creating achievements table:', err);
      } else {
        console.log('✓ Achievements table ready');
      }
    });

    // Create index for faster achievement lookups
    db.run(`
      CREATE INDEX IF NOT EXISTS idx_achievements_user ON achievements(user_id)
    `, (err) => {
      if (err && !err.message.includes('already exists')) {
        console.error('Error creating achievements index:', err);
      }
    });

    // Notifications table
    db.run(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        read BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) {
        console.error('Error creating notifications table:', err);
      } else {
        console.log('✓ Notifications table ready');
      }
    });

    // Create index for faster notification lookups
    db.run(`
      CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)
    `, (err) => {
      if (err && !err.message.includes('already exists')) {
        console.error('Error creating notifications index:', err);
      }
    });

    // Active sessions table (for logout all functionality)
    db.run(`
      CREATE TABLE IF NOT EXISTS active_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_used DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, token_hash)
      )
    `, (err) => {
      if (err) {
        console.error('Error creating active_sessions table:', err);
      } else {
        console.log('✓ Active sessions table ready');
      }
    });

    // Create index for faster session lookups
    db.run(`
      CREATE INDEX IF NOT EXISTS idx_sessions_user ON active_sessions(user_id)
    `, (err) => {
      if (err && !err.message.includes('already exists')) {
        console.error('Error creating sessions index:', err);
      }
    });

    // Create index for token lookups
    db.run(`
      CREATE INDEX IF NOT EXISTS idx_sessions_token ON active_sessions(token_hash)
    `, (err) => {
      if (err && !err.message.includes('already exists')) {
        console.error('Error creating sessions token index:', err);
      }
    });

    // Account deletion requests table
    db.run(`
      CREATE TABLE IF NOT EXISTS deletion_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        processed_at DATETIME,
        status TEXT DEFAULT 'pending',
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id)
      )
    `, (err) => {
      if (err) {
        console.error('Error creating deletion_requests table:', err);
      } else {
        console.log('✓ Deletion requests table ready');
      }
    });

    // Create index for deletion requests
    db.run(`
      CREATE INDEX IF NOT EXISTS idx_deletion_requests_user ON deletion_requests(user_id)
    `, (err) => {
      if (err && !err.message.includes('already exists')) {
        console.error('Error creating deletion requests index:', err);
      }
    });

    // Friends table
    db.run(`
      CREATE TABLE IF NOT EXISTS friends (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        friend_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(friend_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, friend_id)
      )
    `, (err) => {
      if (err) {
        console.error('Error creating friends table:', err);
      } else {
        console.log('✓ Friends table ready');
      }
    });

    // Friend requests table
    db.run(`
      CREATE TABLE IF NOT EXISTS friend_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        requester_id INTEGER NOT NULL,
        recipient_id INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        responded_at DATETIME,
        FOREIGN KEY(requester_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(recipient_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(requester_id, recipient_id)
      )
    `, (err) => {
      if (err) {
        console.error('Error creating friend_requests table:', err);
      } else {
        console.log('✓ Friend requests table ready');
      }
    });

    // Create indexes for friends
    db.run(`
      CREATE INDEX IF NOT EXISTS idx_friends_user ON friends(user_id)
    `, (err) => {
      if (err && !err.message.includes('already exists')) {
        console.error('Error creating friends index:', err);
      }
    });

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_friend_requests_recipient ON friend_requests(recipient_id)
    `, (err) => {
      if (err && !err.message.includes('already exists')) {
        console.error('Error creating friend requests index:', err);
      }
    });

    // Messages table
    db.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER NOT NULL,
        recipient_id INTEGER NOT NULL,
        subject TEXT,
        body TEXT NOT NULL,
        read BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(sender_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(recipient_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) {
        console.error('Error creating messages table:', err);
      } else {
        console.log('✓ Messages table ready');
      }
    });

    // Create indexes for messages
    db.run(`
      CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id)
    `, (err) => {
      if (err && !err.message.includes('already exists')) {
        console.error('Error creating messages recipient index:', err);
      }
    });

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id)
    `, (err) => {
      if (err && !err.message.includes('already exists')) {
        console.error('Error creating messages sender index:', err);
      }
    });

    // Blocked users table
    db.run(`
      CREATE TABLE IF NOT EXISTS blocked_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        blocked_user_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(blocked_user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, blocked_user_id)
      )
    `, (err) => {
      if (err) {
        console.error('Error creating blocked_users table:', err);
      } else {
        console.log('✓ Blocked users table ready');
      }
    });

    // Create indexes for blocked users
    db.run(`
      CREATE INDEX IF NOT EXISTS idx_blocked_users_user ON blocked_users(user_id)
    `, (err) => {
      if (err && !err.message.includes('already exists')) {
        console.error('Error creating blocked users index:', err);
      }
    });

    // ===== ALLIANCES SYSTEM =====
    // Alliances table - stores alliance information
    db.run(`
      CREATE TABLE IF NOT EXISTS alliances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        tag TEXT UNIQUE NOT NULL,
        high_lord_id INTEGER NOT NULL,
        banner_id INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(high_lord_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) {
        console.error('Error creating alliances table:', err);
      } else {
        console.log('✓ Alliances table ready');
      }
    });

    // Alliance members table - tracks fealty relationships (4-tier hierarchy)
    db.run(`
      CREATE TABLE IF NOT EXISTS alliance_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE NOT NULL,
        alliance_id INTEGER NOT NULL,
        liege_id INTEGER,
        tier INTEGER NOT NULL DEFAULT 4,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(alliance_id) REFERENCES alliances(id) ON DELETE CASCADE,
        FOREIGN KEY(liege_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `, (err) => {
      if (err) {
        console.error('Error creating alliance_members table:', err);
      } else {
        console.log('✓ Alliance members table ready');
      }
    });

    // Fealty requests table
    db.run(`
      CREATE TABLE IF NOT EXISTS fealty_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        requester_id INTEGER NOT NULL,
        liege_id INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        responded_at DATETIME,
        FOREIGN KEY(requester_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(liege_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(requester_id, liege_id)
      )
    `, (err) => {
      if (err) {
        console.error('Error creating fealty_requests table:', err);
      } else {
        console.log('✓ Fealty requests table ready');
      }
    });

    // Create indexes for alliances
    db.run(`CREATE INDEX IF NOT EXISTS idx_alliance_members_user ON alliance_members(user_id)`, () => {});
    db.run(`CREATE INDEX IF NOT EXISTS idx_alliance_members_alliance ON alliance_members(alliance_id)`, () => {});
    db.run(`CREATE INDEX IF NOT EXISTS idx_alliance_members_liege ON alliance_members(liege_id)`, () => {});

    // ===== CHAT SYSTEM =====
    // Global chat messages table
    db.run(`
      CREATE TABLE IF NOT EXISTS global_chat (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        username TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) {
        console.error('Error creating global_chat table:', err);
      } else {
        console.log('✓ Global chat table ready');
      }
    });

    // Alliance chat messages table
    db.run(`
      CREATE TABLE IF NOT EXISTS alliance_chat (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        alliance_id INTEGER NOT NULL,
        username TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(alliance_id) REFERENCES alliances(id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) {
        console.error('Error creating alliance_chat table:', err);
      } else {
        console.log('✓ Alliance chat table ready');
      }
    });

    // Create indexes for chat
    db.run(`CREATE INDEX IF NOT EXISTS idx_global_chat_user ON global_chat(user_id)`, () => {});
    db.run(`CREATE INDEX IF NOT EXISTS idx_alliance_chat_alliance ON alliance_chat(alliance_id)`, () => {});

    // ===== CARD COLLECTION SYSTEM =====
    // User card collection table
    db.run(`
      CREATE TABLE IF NOT EXISTS user_cards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        card_id TEXT NOT NULL,
        quantity INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, card_id)
      )
    `, (err) => {
      if (err) {
        console.error('Error creating user_cards table:', err);
      } else {
        console.log('✓ User cards table ready');
      }
    });

    // Unopened products table (booster packs, boxes)
    db.run(`
      CREATE TABLE IF NOT EXISTS unopened_products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        product_type TEXT NOT NULL,
        product_id TEXT NOT NULL,
        quantity INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) {
        console.error('Error creating unopened_products table:', err);
      } else {
        console.log('✓ Unopened products table ready');
      }
    });

    // Fragments and scrap for crafting
    db.run(`
      ALTER TABLE player_stats ADD COLUMN fragments INTEGER DEFAULT 0
    `, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding fragments column:', err);
      } else if (!err) {
        console.log('✓ fragments column added to player_stats');
      }
    });

    db.run(`
      ALTER TABLE player_stats ADD COLUMN scrap INTEGER DEFAULT 0
    `, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding scrap column:', err);
      } else if (!err) {
        console.log('✓ scrap column added to player_stats');
      }
    });

    // Create indexes for card collection
    db.run(`CREATE INDEX IF NOT EXISTS idx_user_cards_user ON user_cards(user_id)`, () => {});
    db.run(`CREATE INDEX IF NOT EXISTS idx_unopened_products_user ON unopened_products(user_id)`, () => {});

    // ===== AUCTION HOUSE =====
    // Auction listings table
    db.run(`
      CREATE TABLE IF NOT EXISTS auction_listings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        seller_id INTEGER NOT NULL,
        item_type TEXT NOT NULL,
        item_id TEXT NOT NULL,
        item_data TEXT,
        starting_price INTEGER NOT NULL,
        buyout_price INTEGER,
        current_bid INTEGER,
        bidder_id INTEGER,
        slot_number INTEGER NOT NULL,
        expires_at DATETIME NOT NULL,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(seller_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(bidder_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `, (err) => {
      if (err) {
        console.error('Error creating auction_listings table:', err);
      } else {
        console.log('✓ Auction listings table ready');
      }
    });

    // Auction bids history
    db.run(`
      CREATE TABLE IF NOT EXISTS auction_bids (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        listing_id INTEGER NOT NULL,
        bidder_id INTEGER NOT NULL,
        bid_amount INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(listing_id) REFERENCES auction_listings(id) ON DELETE CASCADE,
        FOREIGN KEY(bidder_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) {
        console.error('Error creating auction_bids table:', err);
      } else {
        console.log('✓ Auction bids table ready');
      }
    });

    // User auction slots (unlocked slots)
    db.run(`
      CREATE TABLE IF NOT EXISTS user_auction_slots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        slot_number INTEGER NOT NULL,
        unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, slot_number)
      )
    `, (err) => {
      if (err) {
        console.error('Error creating user_auction_slots table:', err);
      } else {
        console.log('✓ User auction slots table ready');
      }
    });

    // Create indexes for auction house
    db.run(`CREATE INDEX IF NOT EXISTS idx_auction_listings_seller ON auction_listings(seller_id)`, () => {});
    db.run(`CREATE INDEX IF NOT EXISTS idx_auction_listings_status ON auction_listings(status)`, () => {});
    db.run(`CREATE INDEX IF NOT EXISTS idx_auction_bids_listing ON auction_bids(listing_id)`, () => {});

    // ===== SHOP =====
    // Shop purchases history (optional, for tracking)
    db.run(`
      CREATE TABLE IF NOT EXISTS shop_purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        item_type TEXT NOT NULL,
        item_id TEXT,
        quantity INTEGER DEFAULT 1,
        cost_gold INTEGER,
        cost_gems INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) {
        console.error('Error creating shop_purchases table:', err);
      } else {
        console.log('✓ Shop purchases table ready');
      }
    });

    // Auction statistics table (for tracking achievements)
    db.run(`
      CREATE TABLE IF NOT EXISTS auction_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        cards_listed INTEGER DEFAULT 0,
        cards_bought INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id)
      )
    `, (err) => {
      if (err) {
        console.error('Error creating auction_stats table:', err);
      } else {
        console.log('✓ Auction stats table ready');
      }
    });

    // Create index for auction stats
    db.run(`CREATE INDEX IF NOT EXISTS idx_auction_stats_user ON auction_stats(user_id)`, () => {});

    // Add alliance_points column to alliance_members if it doesn't exist
    db.run(`
      ALTER TABLE alliance_members ADD COLUMN alliance_points INTEGER DEFAULT 0
    `, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding alliance_points column:', err);
      } else if (!err) {
        console.log('✓ alliance_points column added to alliance_members');
      }
    });

    // Seasons table (for leaderboard resets)
    db.run(`
      CREATE TABLE IF NOT EXISTS seasons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        start_date DATETIME NOT NULL,
        end_date DATETIME NOT NULL,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('Error creating seasons table:', err);
      } else {
        console.log('✓ Seasons table ready');
        // Create current season if none exists
        db.get('SELECT id FROM seasons WHERE status = ?', ['active'], (err, season) => {
          if (!err && !season) {
            const now = new Date();
            const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            const monthName = now.toLocaleString('default', { month: 'long', year: 'numeric' });
            db.run(`
              INSERT INTO seasons (name, start_date, end_date, status)
              VALUES (?, ?, ?, 'active')
            `, [`${monthName} Season`, now.toISOString(), endDate.toISOString()]);
          }
        });
      }
    });

    // Leaderboard entries table
    db.run(`
      CREATE TABLE IF NOT EXISTS leaderboard_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        season_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        leaderboard_type TEXT NOT NULL,
        value INTEGER DEFAULT 0,
        rank INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(season_id) REFERENCES seasons(id),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(season_id, user_id, leaderboard_type)
      )
    `, (err) => {
      if (err) {
        console.error('Error creating leaderboard_entries table:', err);
      } else {
        console.log('✓ Leaderboard entries table ready');
      }
    });

    // Create indexes for leaderboards
    db.run(`CREATE INDEX IF NOT EXISTS idx_leaderboard_season_type ON leaderboard_entries(season_id, leaderboard_type, value DESC)`, () => {});
    db.run(`CREATE INDEX IF NOT EXISTS idx_leaderboard_user ON leaderboard_entries(user_id)`, () => {});

    // Adventure locations table
    db.run(`
      CREATE TABLE IF NOT EXISTS adventure_locations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        icon TEXT DEFAULT '📍',
        x REAL,
        y REAL,
        difficulty INTEGER DEFAULT 1,
        opponent_data TEXT,
        reward_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('Error creating adventure_locations table:', err);
      } else {
        console.log('✓ Adventure locations table ready');
        // Seed default locations
        seedAdventureLocations(db);
      }
    });

    // User adventure progress
    db.run(`
      CREATE TABLE IF NOT EXISTS user_adventure_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        location_id INTEGER NOT NULL,
        cleared BOOLEAN DEFAULT 0,
        cleared_at DATETIME,
        attempts INTEGER DEFAULT 0,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(location_id) REFERENCES adventure_locations(id),
        UNIQUE(user_id, location_id)
      )
    `, (err) => {
      if (err) {
        console.error('Error creating user_adventure_progress table:', err);
      } else {
        console.log('✓ User adventure progress table ready');
      }
    });

    // Raid stats (for raid leaderboard)
    db.run(`
      CREATE TABLE IF NOT EXISTS raid_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        raids_completed INTEGER DEFAULT 0,
        season_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(season_id) REFERENCES seasons(id),
        UNIQUE(user_id, season_id)
      )
    `, (err) => {
      if (err) {
        console.error('Error creating raid_stats table:', err);
      } else {
        console.log('✓ Raid stats table ready');
      }
    });
  });
};

function seedAdventureLocations(db) {
  const locations = [
    { name: 'Hastings', description: 'Battle of Hastings - 1066', x: 20, y: 30, difficulty: 1 },
    { name: 'Agincourt', description: 'Battle of Agincourt - 1415', x: 25, y: 25, difficulty: 2 },
    { name: 'Waterloo', description: 'Battle of Waterloo - 1815', x: 30, y: 35, difficulty: 3 },
    { name: 'Thermopylae', description: 'Battle of Thermopylae - 480 BC', x: 40, y: 40, difficulty: 4 },
    { name: 'Cannae', description: 'Battle of Cannae - 216 BC', x: 35, y: 45, difficulty: 3 },
    { name: 'Marathon', description: 'Battle of Marathon - 490 BC', x: 45, y: 42, difficulty: 2 },
    { name: 'Gettysburg', description: 'Battle of Gettysburg - 1863', x: 15, y: 50, difficulty: 3 },
    { name: 'Stalingrad', description: 'Battle of Stalingrad - 1942', x: 50, y: 30, difficulty: 5 }
  ];

  locations.forEach(loc => {
    db.run(`
      INSERT OR IGNORE INTO adventure_locations (name, description, icon, x, y, difficulty)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [loc.name, loc.description, '📍', loc.x, loc.y, loc.difficulty]);
  });
}

module.exports = { db, initializeDatabase };
