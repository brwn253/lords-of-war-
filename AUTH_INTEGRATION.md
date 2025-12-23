# Authentication Integration Guide

This guide shows how to integrate the auth system into your existing `game-server.js`.

## Files Created

- `server/auth.js` - Authentication utilities (password hashing, JWT)
- `server/database.js` - SQLite database initialization
- `server/auth-routes.js` - Express routes for register/login
- `auth.html` - Login/registration page
- `AUTH_INTEGRATION.md` - This file

## Steps to Integrate

### Step 1: Install New Dependencies

```bash
cd server
npm install
```

This will install the new packages added to `package.json`:
- `sqlite3`
- `bcryptjs`
- `jsonwebtoken`
- `cors`

### Step 2: Update `game-server.js`

Add these lines **at the top** of `game-server.js`, right after the existing imports:

```javascript
// ===== ADD THESE IMPORTS =====
const cors = require('cors');
const { db, initializeDatabase } = require('./database');
const authRoutes = require('./auth-routes');

// ===== THEN UPDATE THE EXISTING app.use() SECTION =====
// Find this line (around line 8):
app.use(express.static(path.join(__dirname, '..')));

// Replace with:
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize database
initializeDatabase();

// Auth routes BEFORE socket.io
app.use('/api/auth', authRoutes);

// Default route - serve auth.html if not authenticated
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'auth.html'));
});

// Serve static files
app.use(express.static(path.join(__dirname, '..')));
```

### Step 3: Verify Socket.io Authentication (Optional but Recommended)

When a player joins the queue, they should have a valid token. This prevents unauthorized players from joining.

Find the `joinQueue` handler (around line 47) and add token verification:

```javascript
socket.on('joinQueue', (playerData) => {
  // Optionally verify token here:
  const token = playerData.token || socket.handshake.auth.token;
  if (!token) {
    socket.emit('error', { message: 'Unauthorized: No token provided' });
    return;
  }

  console.log(`[QUEUE] ${playerData.name} joined queue`);
  // ... rest of existing code
});
```

### Step 4: Start the Server

```bash
npm start
```

You should see:
```
✓ Connected to SQLite database
✓ Users table ready
✓ Player stats table ready
✓ Feedback table ready
🎮 Lords of War Server running on port 3000
```

## File Structure After Integration

```
lords-of-war-/
├── auth.html                          (NEW)
├── index.html                         (existing game)
├── lords-of-war.js
├── lords-of-war-engine.js
├── network-manager.js
└── server/
    ├── game-server.js                 (MODIFIED)
    ├── package.json                   (MODIFIED)
    ├── auth.js                        (NEW)
    ├── database.js                    (NEW)
    ├── auth-routes.js                 (NEW)
    ├── lords_of_war.db                (AUTO-CREATED)
    └── node_modules/
```

## How It Works

### Player Flow

1. Player visits `http://YOUR_IP:3000`
2. Server redirects to `auth.html` (login/register page)
3. Player creates account or logs in
4. JWT token stored in browser's `localStorage`
5. Redirect to `index.html` (main game)
6. Game code uses token in Socket.io connection
7. Player joins matchmaking queue
8. Plays the game!

### Data Persistence

- User accounts saved in `lords_of_war.db` (SQLite)
- Stats persist across server restarts
- Each beta tester gets their own account
- You can view the database using SQLite tools

## Testing Locally

```bash
# Terminal 1 - Start server
cd server
npm start

# Terminal 2 - Access game
# Open http://localhost:3000 in browser
```

### Create Test Account

1. Click "Forge a Legend"
2. Username: `testplayer`
3. Email: `test@example.com`
4. Password: `TestPassword123!`
5. Click "CREATE ACCOUNT"
6. Game should load

## For Beta Testers (External)

Share this URL:
```
http://73.193.82.179:3000
```

Beta testers can:
1. Create their own account
2. Log in anytime
3. Play games
4. Accounts persist forever

## Database

SQLite database is auto-created at: `server/lords_of_war.db`

### Tables

**users**
- id, username, email, password_hash, created_at

**player_stats**
- id, user_id, gold, gems, total_wins, total_losses, current_rank, level

**feedback** (optional, for bug reports)
- id, user_id, feedback, created_at

## Security Notes for Production

⚠️ **For testing only!** Before deploying to production:

1. Change `JWT_SECRET` in `auth.js`:
   ```javascript
   const JWT_SECRET = process.env.JWT_SECRET || 'use_a_strong_random_string_here';
   ```

2. Use environment variables:
   ```bash
   export JWT_SECRET="your-secret-key-here"
   export PORT=3000
   npm start
   ```

3. Use HTTPS (port forwarding should use HTTPS)

4. Add email verification (not implemented in beta version)

5. Add password reset feature (not implemented in beta version)

## Troubleshooting

### Database locked error
Delete `server/lords_of_war.db` and restart server

### Port 3000 in use
```bash
# Find process using port 3000
netstat -ano | findstr :3000

# Kill it (replace PID)
taskkill /PID <PID> /F
```

### Dependencies not installing
```bash
cd server
rm -rf node_modules package-lock.json
npm install
```

### Server won't start
Check that all 4 files exist in `server/`:
- game-server.js
- auth.js
- database.js
- auth-routes.js

---

**That's it!** Your game now has authentication and persistent accounts for beta testing. 🎮
