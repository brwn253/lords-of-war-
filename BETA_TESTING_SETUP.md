# Beta Testing Setup - Quick Start

Your game is ready for external beta testers! Here's what you need to do:

## 📋 What Was Created

✅ **Authentication System**
- User registration with validation
- User login with JWT tokens
- Password hashing with bcryptjs
- SQLite database for persistent data

✅ **Login Page** (`auth.html`)
- Medieval-themed design matching your game
- Registration form with real-time validation
- Login form
- Token stored in browser localStorage

✅ **Database Setup** (`server/database.js`)
- SQLite database (auto-created)
- Users table (accounts)
- Player stats table (gold, gems, wins, losses, rank)
- Feedback table (for beta testers to submit feedback)

✅ **Auth Routes** (`server/auth-routes.js`)
- POST /api/auth/register - Create account
- POST /api/auth/login - User login
- GET /api/auth/verify - Verify token

✅ **Documentation** (`AUTH_INTEGRATION.md`)
- Step-by-step integration guide
- File locations and structure
- Troubleshooting guide

## 🚀 Quick Setup (3 Steps)

### Step 1: Install Dependencies
```bash
cd server
npm install
```

### Step 2: Modify game-server.js
Follow the instructions in `AUTH_INTEGRATION.md` to add these lines at the top:

```javascript
const cors = require('cors');
const { db, initializeDatabase } = require('./database');
const authRoutes = require('./auth-routes');

// ... then modify the app.use() sections as shown in AUTH_INTEGRATION.md
```

### Step 3: Start the Server
```bash
npm start
```

## ✅ Verification Checklist

Before sharing with beta testers, verify:

- [ ] All new files in `/server/` exist:
  - [ ] `auth.js`
  - [ ] `database.js`
  - [ ] `auth-routes.js`

- [ ] `auth.html` in root directory

- [ ] `package.json` updated with new dependencies

- [ ] `game-server.js` modified with auth imports and routes

- [ ] Server starts without errors

- [ ] Database created: `server/lords_of_war.db`

- [ ] Can access http://localhost:3000 and see login page

- [ ] Can create account with validation working

- [ ] Can login with created account

- [ ] Can play game after login

## 🎮 For External Beta Testers

Share this information:

**Game URL:**
```
http://73.193.82.179:3000
```

**Instructions:**
1. Go to the URL above
2. Click "Forge a Legend"
3. Create account with:
   - Username (3-20 characters)
   - Email
   - Password (8+ chars, uppercase, number, special char)
4. Click "CREATE ACCOUNT"
5. Play the game!

**Account Requirements:**
- Username: 3-20 alphanumeric characters, hyphens (-), underscores (_)
- Email: Valid email address
- Password: At least 8 characters
  - Must have uppercase letter
  - Must have lowercase letter
  - Must have number
  - Must have special character (@$!%*?&)

## 📊 Viewing Beta Test Data

After testers play, you can check:

**Players created:**
```bash
cd server
sqlite3 lords_of_war.db "SELECT username, email, created_at FROM users;"
```

**Player stats:**
```bash
sqlite3 lords_of_war.db "SELECT u.username, p.gold, p.gems, p.total_wins, p.total_losses FROM players_stats p JOIN users u ON p.user_id = u.id;"
```

## 🔐 Security Notes

For beta testing (localhost), the current setup is fine.

**Before production:**
- Change JWT_SECRET in `auth.js`
- Use HTTPS instead of HTTP
- Add email verification
- Add password reset functionality
- Consider using environment variables for secrets

## 📁 Final File Structure

```
C:\Users\JWBrown\Desktop\lords-of-war-\
├── auth.html                          ← NEW (Login page)
├── index.html                         ← Existing (Game)
├── lords-of-war.js
├── lords-of-war-engine.js
├── network-manager.js
├── AUTH_INTEGRATION.md                ← NEW (Integration guide)
├── BETA_TESTING_SETUP.md              ← This file
└── server/
    ├── game-server.js                 ← MODIFIED (Add auth)
    ├── package.json                   ← MODIFIED (New deps)
    ├── auth.js                        ← NEW
    ├── database.js                    ← NEW
    ├── auth-routes.js                 ← NEW
    ├── lords_of_war.db                ← AUTO-CREATED
    └── node_modules/                  ← AUTO-CREATED
```

## 🐛 Troubleshooting

**"Cannot find module 'sqlite3'"**
→ Run `npm install` in `/server` folder

**"Port 3000 already in use"**
→ Close other apps or change PORT in game-server.js

**"Database is locked"**
→ Delete `server/lords_of_war.db` and restart server

**Login page not showing**
→ Check that `auth.html` exists in root directory

**Game won't load after login**
→ Check browser console (F12) for errors

## 📞 Next Steps

1. ✅ Add auth imports to game-server.js (see AUTH_INTEGRATION.md)
2. ✅ Install dependencies (`npm install`)
3. ✅ Test locally at http://localhost:3000
4. ✅ Share URL with beta testers: `http://73.193.82.179:3000`
5. ✅ Monitor player accounts and feedback

---

**Ready to launch beta testing!** 🚀

For detailed integration instructions, see: `AUTH_INTEGRATION.md`
