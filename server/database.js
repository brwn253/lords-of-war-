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
  });
};

module.exports = { db, initializeDatabase };
