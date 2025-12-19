# Multiplayer Game Fixes - Handoff Prompt

## Context
We're working on a multiplayer card game (Lords of War) built with Node.js/Socket.IO server and vanilla JavaScript client. The game was working in single-player mode, but multiplayer had numerous issues where features that worked in single-player weren't working in multiplayer.

## Architecture
- **Server**: `server/game-server.js` - Handles game logic, state management, and Socket.IO events
- **Client**: `lords-of-war-engine.js` - Client-side game logic and UI updates
- **Network**: `network-manager.js` - Socket.IO wrapper for client-server communication
- **UI**: `index.html` - Game interface

## Key Changes Made

### 1. Hero Selection Flow
- **Issue**: Hero selection menu was overlaying the game, and heroes had to be selected after queuing
- **Fix**: 
  - Moved hero selection BEFORE queuing (saves time for both players)
  - Added cancel button to return to main menu
  - Server now stores heroes from queue data and initializes game immediately

### 2. Network Connection Issues
- **Issue**: "Connecting endlessly" - stale connection state
- **Fix**: 
  - `NetworkManager.connect()` now checks `socket.connected` and cleans up disconnected sockets
  - `NetworkManager.disconnect()` clears all event listeners and resets state
  - Explicit disconnect before new connections

### 3. Turn Management
- **Issue**: Turns weren't changing, "Not your turn" errors, game never starting
- **Fix**:
  - Server now explicitly joins sockets to Socket.IO rooms (`socket.join(roomId)`)
  - Added fallback direct socket emits in `broadcastGameState()`
  - Client-side `endTurn()` immediately disables button to prevent double-clicks
  - `startTurn()` and `startGameAfterRoll()` skip local state modification in multiplayer (server controls everything)
  - Server calls `executeTurnStart()` to properly initialize turns

### 4. Deck Creation
- **Issue**: Only drawing 1 kind of card (e.g., only archers)
- **Fix**: 
  - `createMultiplayerDeck()` now creates diverse decks with multiple card types
  - Added equipment and ability cards to decks (matching single-player)
  - Cards include: units, abilities, and equipment based on hero type

### 5. Card Hand Positioning
- **Issue**: Cards moving positions when one is removed
- **Fix**: 
  - `updateHand()` now preserves original order within card types
  - Groups cards by ID/tier but maintains relative order

### 6. Player Name Display
- **Issue**: Name showing as "[object HTMLDivElement]" or accumulating flag emojis
- **Fix**: 
  - Ensured `window.playerAlias` is always a string
  - Strips existing flag emoji before prepending to prevent accumulation
  - Sets player alias correctly in `confirmMultiplayerHero()` and `initializeMultiplayerGame()`

### 7. Combat System - Hitback Logic
- **Issue**: Ranged units taking hitback when they shouldn't, archers not hitting back
- **Fix**: 
  - Fixed hitback logic to match single-player exactly:
    - Ranged attacker vs Melee defender: NO hitback (ranged evades)
    - Melee attacker vs Ranged defender: YES hitback (ranged always hits back)
    - Melee vs Melee: YES hitback
    - Ranged vs Ranged: YES hitback
  - Added explicit power checks and logging

### 8. Combat System - Damage Application
- **Issue**: Units not taking damage, math not adding up
- **Fix**:
  - Switched from `health` to `durability` (matching single-player)
  - Added defensive checks for `null`/`undefined`/`0` values
  - Explicit number conversion and validation
  - Direct board array updates to ensure changes persist
  - Enhanced logging before/after damage

### 9. Tier Name Display
- **Issue**: T2 units not showing "T2" in name
- **Fix**: 
  - Extract base name (remove existing tier suffix) before adding new tier
  - Format: `${baseName} T${tier}`

### 10. Charge Units
- **Issue**: Charge units (cavalry) can't attack on first turn
- **Fix**:
  - Server sets `canAttack: true` and `exhausted: false` for charge units when played
  - Client-side fix in `applyServerState()` to correct charge units with `canAttack: false`
  - Turn refresh now refreshes ALL units (charge only affects initial play)
  - Multiple safety checks to ensure charge units have `canAttack: true`

### 11. Card Draw Effects
- **Issue**: Scout/Command/Dispatch effects not drawing cards
- **Fix**: 
  - Server now checks for `scoutEffect`, `commandEffect`, `dispatchEffect` properties
  - Draws card from deck when unit with effect is played
  - Preserves effect properties in `newUnit`

### 12. Missing Features Added
- **Mountain King passive**: Protection keyword on units with 5+ durability
- **Swift Rider passive**: Units with cost <= 3 can attack immediately
- **Type advantage bonuses**: Ranged vs Infantry (+1 when played), combat type advantages
- **Formation keyword**: Other units with formation get +1 power when unit is played
- **Protection/Ward keyword**: Blocks first attack/damage
- **Combat bonuses**: Weapon bonuses, Infantry +1, Cavalry +1
- **Infantry hero starting sword**: Infantry heroes now start with sword equipped

### 13. Card Power Display
- **Issue**: Cards showing base power, not total power with bonuses
- **Fix**: 
  - Created `calculateTotalPower()` function that includes:
    - Base power
    - Formation bonuses
    - Hero passive bonuses
    - Type advantage bonuses
  - Cards on battlefield now show total damage including all bonuses

## Current Issues

### 1. Charge Units Still Can't Attack
- **Symptom**: Horseman shows `canAttack: false, exhausted: false` in client console
- **Status**: Added multiple fixes but issue persists
- **Server logs needed**: Check if server is setting `canAttack: true` when Horseman is played
- **Client logs**: Shows `[STATE] Charge unit Horseman: canAttack=false` - client is receiving `false` from server
- **Possible causes**: 
  - Server not detecting charge correctly
  - State being overwritten after creation
  - JSON serialization losing properties

### 2. Units Not Taking Damage
- **Symptom**: "cards arent taking damage when they should"
- **Status**: Added defensive checks and logging, but issue persists
- **Server logs needed**: Check `[ATTACK] BEFORE damage` and `[ATTACK] AFTER damage` logs
- **Possible causes**:
  - Target reference not persisting in board array
  - State not being broadcast correctly
  - Client not applying damage correctly
  - Durability initialization issues

### 3. Equipment and Abilities Not Being Drawn
- **Symptom**: "equipment and abilitys are still not being pulled/drawn"
- **Status**: Added to deck creation, but may not be in deck or not being drawn
- **Check**: Server console should show `[DECK] Card types breakdown:` with equipment and ability counts
- **Possible causes**:
  - Cards not being added to deck
  - Cards being filtered out somewhere
  - Deck not being shuffled correctly

### 4. Math Not Adding Up
- **Symptom**: "the math isnt adding up"
- **Status**: Added total power calculation, but damage calculation may still be wrong
- **Check**: Verify damage calculation includes all bonuses (weapon, type advantage, infantry/cavalry bonuses)
- **Possible causes**:
  - Bonuses not being calculated correctly
  - Display showing wrong values
  - Damage being applied incorrectly

## Key Files to Review

### Server (`server/game-server.js`)
- **Line ~580-650**: `executePlayCard()` - Card playing logic, charge detection, unit creation
- **Line ~525-540**: `executeTurnStart()` - Turn refresh logic
- **Line ~756-884**: `executeAttack()` - Attack and damage calculation
- **Line ~1153-1185**: `broadcastGameState()` - State broadcasting
- **Line ~886-1110**: `initializeMultiplayerGame()` - Deck creation and game initialization

### Client (`lords-of-war-engine.js`)
- **Line ~255-363**: `applyServerState()` - State synchronization and normalization
- **Line ~2968-3039**: `handleConstructClick()` - Card click handling for attacks
- **Line ~2712-2840**: `createCardElement()` - Card rendering with total power calculation
- **Line ~1629-1776**: `attack()` - Client-side attack logic (single-player only)

## Testing Checklist

1. **Charge Units**: Play a Horseman → Should be able to attack immediately
2. **Damage**: Skirmisher (ranged, 1 power) attacks Footman (melee, 3 durability) → Footman should take 1 damage, survive with 2 durability
3. **Hitback**: Footman attacks Archer → Archer should hit back, Footman should take damage
4. **No Hitback**: Skirmisher attacks Footman → Skirmisher should NOT take hitback
5. **Equipment**: Check if equipment cards appear in deck and can be drawn
6. **Abilities**: Check if ability cards appear in deck and can be drawn
7. **Total Power**: Unit with bonuses should show total power on battlefield
8. **Tier Names**: Merged units should show "T2", "T3", etc.

## Server Console Logs to Check

When testing, look for these key logs:
- `[PLAYCARD] playing Horseman, keywords: ['charge'], hasCharge: true`
- `[PLAYCARD] Created unit: { canAttack: true, ... }`
- `[ATTACK] BEFORE damage - Target Footman: durability=3`
- `[ATTACK] AFTER damage - Target Footman: durability 3 -> 2`
- `[DECK] Card types breakdown: { unit: X, ability: Y, equipment: Z }`

## Next Steps

1. **Debug charge units**: Check server logs when Horseman is played - is `hasCharge` true? Is `canAttack` set to true?
2. **Debug damage**: Check server logs during attack - is damage calculated correctly? Is durability being updated?
3. **Debug deck**: Check if equipment/abilities are actually in the deck when created
4. **Verify state sync**: Ensure server state changes are being broadcast and received correctly
5. **Test edge cases**: Units with 0 durability, negative damage, etc.

## Important Notes

- **Single-player works**: All these features work correctly in single-player mode
- **Server is authoritative**: In multiplayer, server controls all game state
- **Client is display-only**: Client should only display server state, not modify it
- **State synchronization**: `applyServerState()` maps server `player1`/`player2` to client `player`/`enemy`
- **Durability vs Health**: Server uses both, but `durability` is source of truth (matching single-player)

