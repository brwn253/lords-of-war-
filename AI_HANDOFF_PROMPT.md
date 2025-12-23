# Lords of War - Game Project Summary

## Project Overview

Lords of War is a multiplayer medieval card game built with Node.js backend and HTML/CSS/JavaScript frontend. Players build decks, select heroes, and battle against opponents or AI. The game features user authentication, player profiles, stats tracking, and both single-player and multiplayer modes.

## Tech Stack

- **Frontend**: HTML5, CSS3, JavaScript (vanilla)
- **Backend**: Node.js, Express.js, Socket.io for real-time multiplayer
- **Database**: SQLite3
- **Authentication**: JWT token-based with localStorage
- **Hosting**: Local server accessible internally and externally via port forwarding

## Recent Implementations & Fixes

### Authentication System
- Registration and login with JWT tokens stored in localStorage (key: 'token')
- Auth verification on page load with `authVerificationComplete` flag to prevent race conditions
- User data stored in sessionStorage as JSON: `{userId, username, email}`
- Guest mode: generates random "AnonXXXX" (4 digits) usernames for non-logged-in players

### Database Schema
- **Users table**: `id`, `username`, `email`, `password_hash`, `created_at`, `updated_at`
- **Player_stats table**: `user_id`, `gold`, `gems`, `total_wins`, `total_losses`, `current_rank`, `level`, `display_name`, `avatar_id`, `bio`
- Currently 3 registered accounts: `testplayer`, `test12345`, `test123456`

### Profile & Stats Dashboard
- Compact modal matching the clean login page design
- Displays: username, profile info (display name, email, join date, bio), stats (wins/losses/win rate/level), vault (gold/gems)
- Avatar selector (8 emoji avatars)
- Profile edit functionality with validation
- Logout button

### UI Redesigns
All pages now match clean, minimalist aesthetic:
- **Auth page** (login/register) - compact forms with medieval theme
- **Main menu** - reduced size, clean grid layout for game modes
- **All modals** - consistent styling, reduced padding/margins, efficient spacing
- **Hero selection modal** - closes properly after confirmation

### Bug Fixes Applied
1. Hero selection modal now closes when user confirms in single-player mode
2. Game over screens (Enemy Wins/You Win) now close when clicking "Main Menu" or "Play Again"
3. Logged-in users now have their username pre-filled in player name input; guests get random Anon names
4. Registration form now responsive and fits properly
5. Profile data loading with proper error handling and null checks

### Networking & Server
- Server migrated from port 3000 to port 8080 (ISP was blocking 3000)
- Server listens on all interfaces (0.0.0.0:8080)
- Port forwarding configured on router (10.0.0.207:8080 → external IP 73.193.82.179:8080)
- Client auto-detects server URL based on current hostname/port
- Socket.io with CORS configured to accept all origins

## Current Status

✅ Authentication system working (3 test accounts registered)  
✅ Profile dashboard fully functional  
✅ Game modes working (single-player, multiplayer queue)  
✅ Modal transitions clean and functional  
✅ External access working (accessible from internet via port 8080)  
✅ Internal access working (accessible via local network)  
✅ Server running and stable with proper logging

## File Locations

- **Frontend**: `C:\Users\JWBrown\Desktop\lords-of-war-\`
  - `index.html` - Main game page
  - `auth.html` - Authentication page (login/register)
  - `lords-of-war-engine.js` - Core game logic
  - `network-manager.js` - Socket.io client and networking
  - `lords-of-war.js` - Card database and game data

- **Backend**: `C:\Users\JWBrown\Desktop\lords-of-war-\server\`
  - `game-server.js` - Main Express server with Socket.io
  - `database.js` - SQLite database operations
  - `auth-routes.js` - Authentication API endpoints
  - `profile-routes.js` - Profile API endpoints
  - `auth.js` - JWT authentication utilities
  - `package.json` - Node.js dependencies

- **Database**: `C:\Users\JWBrown\Desktop\lords-of-war-\server\lords_of_war.db`

## Known Details

- Player can login or play as guest
- Heroes available: Hou Yi and others (hero selection modal)
- Game board includes player health, enemy health, cards, essence, and action buttons
- Multiplayer uses Socket.io for real-time communication
- Profile API endpoints: `GET/PUT /api/profile/:userId` (requires JWT auth)
- Auth API endpoints: `POST /api/auth/register`, `POST /api/auth/login`

## Game Mechanics (Reference)

### Unit Types
- **Ranged**: No charge, no hitback when attacking or attacked
- **Infantry**: No charge, higher HP, melee hitback
- **Cavalry**: All have Charge (can attack the turn they're played), melee hitback

### Combat System
- **Ranged vs Melee**: Ranged doesn't hit back, melee does
- **Melee vs Ranged**: Melee hits back, ranged doesn't
- **Ranged vs Ranged**: No hitback
- **Melee vs Melee**: Both hit back

### Equipment System
- **Weapons**: Bow (Ranged), Sword (Infantry), Axe (Cavalry)
- **Armor Sets**:
  - Ranged: Padded Cloth (6 pieces - no shield/back)
  - Cavalry: Leather (8 pieces - full set)
  - Infantry: Plate (8 pieces - full set)
- **Equipment Slots**: Weapon, Head, Chest, Legs, Shield, Boots, Gloves, Neck, Back
- Armor increases hero max HP when equipped

## Quick Start Guide

### Running the Server
1. Navigate to `server/` directory
2. Run `npm install` (if dependencies not installed)
3. Run `node game-server.js` or `npm start`
4. Server will start on port 8080

### Accessing the Game
- **Local**: `http://localhost:8080` or `http://127.0.0.1:8080`
- **Network**: `http://10.0.0.207:8080` (local network)
- **External**: `http://73.193.82.179:8080` (via port forwarding)

### Testing Accounts
- Username: `testplayer`
- Username: `test12345`
- Username: `test123456`
- (Passwords stored as hashes in database)

## Important Notes for Developers

- JWT tokens are stored in `localStorage` with key `'token'`
- User session data stored in `sessionStorage` as JSON
- Auth verification runs on page load - check `authVerificationComplete` flag before accessing user data
- Guest players get random "AnonXXXX" usernames
- Server CORS is configured to accept all origins (development setup)
- Database uses SQLite3 - file location: `server/lords_of_war.db`

---

*Last Updated: Based on current project state as of latest session*
