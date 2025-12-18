# Lords of War - Medieval Card Game

## Project Overview
This is a medieval-themed card game built with HTML, CSS, and JavaScript. The game features hero selection, unit combat, equipment/armor systems, and turn-based gameplay.

## Current State (Latest Update)

### Game Mechanics

#### Unit Types
- **Ranged**: No charge, no hitback when attacking or attacked
- **Infantry**: No charge, higher HP, melee hitback
- **Cavalry**: All have Charge (can attack the turn they're played), melee hitback

#### Combat System
- **Ranged vs Melee**: Ranged doesn't hit back, melee does
- **Melee vs Ranged**: Melee hits back, ranged doesn't
- **Ranged vs Ranged**: No hitback
- **Melee vs Melee**: Both hit back

#### Equipment System
- **Weapons**: Bow (Ranged), Sword (Infantry), Axe (Cavalry)
- **Armor Sets**:
  - Ranged: Padded Cloth (6 pieces - no shield/back)
  - Cavalry: Leather (8 pieces - full set)
  - Infantry: Plate (8 pieces - full set)
- **Equipment Slots**: Weapon, Head, Chest, Legs, Shield, Boots, Gloves, Neck, Back
- Armor increases hero max HP when equipped

#### Card Types
- **Monsters/Units**: Played to board, can attack
- **Abilities**: Instant effects (damage, buffs, card draw)
- **Equipment**: Attaches to hero (weapons for attack, armor for HP)

### File Structure
- `lords-of-war.html` - Main HTML file with game UI and styling
- `lords-of-war.js` - Card database and historic leaders definitions
- `lords-of-war-engine.js` - Core game logic, combat, UI updates

### Key Features Implemented
1. Hero selection by unit type (Ranged, Infantry, Cavalry)
2. Type-specific deck generation (each hero only gets their type's cards)
3. Equipment slot system with visual display
4. Armor system that increases hero HP
5. Combat with type-specific hitback rules
6. Card combine/tier system (merge same units for higher tiers)
7. Turn-based gameplay with gold/essence system
8. Battle log sidebar
9. Card hover popout with descriptions
10. End turn confirmation modal

### Recent Changes
- Added full armor system for all three unit types
- Implemented equipment slot UI (visible to both players)
- Updated combat logic for ranged no-hitback rules
- Increased Infantry HP for balance
- All Cavalry units now have Charge
- Removed Charge from Ranged units

### Known Issues/Notes
- Equipment slots are initialized in `startGame()` function
- Legacy support for `game.player.equipment` alongside `equipmentSlots.weapon`
- Cards use compact layout: Cost, Name, Stats on same line
- Description area is larger for readability

### Game Flow
1. Player selects unit type (Ranged/Infantry/Cavalry)
2. Player selects one of two random heroes of that type
3. Game starts with 30 HP, deck is shuffled
4. Turn structure: Draw card, gain gold, play cards, attack, end turn
5. Win condition: Reduce enemy hero to 0 HP

### Card Database Structure
Cards are defined in `lords-of-war.js` with properties:
- `id`, `name`, `type`, `unitType`, `cost`
- `power`, `durability` (for units)
- `keywords` (e.g., 'charge', 'scout')
- `equipSlot`, `armorValue` (for equipment)
- `attackPower` (for weapons)

### UI Elements
- Hero portraits with health display
- Equipment slot grid (3x3) next to each hero
- Battlefield for units
- Player hand at bottom
- Enemy hand display (card backs)
- Battle log sidebar (left side)
- End turn button (only visible on player's turn)

## For New Agent/Developer

### To Continue Development:
1. All three files must be in the same directory
2. Open `lords-of-war.html` in a browser
3. The game loads `lords-of-war.js` first, then `lords-of-war-engine.js`
4. Global variables: `CARD_DATABASE`, `HISTORIC_LEADERS`, `game` object
5. Main entry point: `startGame(heroId)` function

### Key Functions:
- `createDeck(heroUnitType)` - Generates type-specific deck
- `playCard(card, player, target)` - Handles card playing
- `attack(attacker, target, attackerPlayer)` - Combat resolution
- `playForge(card, player, target)` - Equipment/armor equipping
- `updateUI()` - Refreshes all UI elements
- `updateEquipmentSlots(player)` - Updates equipment slot display

### Testing:
- Open in browser (Firefox tested)
- Select unit type and hero
- Play cards, equip armor, test combat
- Check console for errors

### Balance Notes:
- Infantry has higher HP to compensate for no Charge
- Ranged units have no hitback (advantage/disadvantage)
- Cavalry has Charge but standard HP
- Armor provides defensive value through HP increases

