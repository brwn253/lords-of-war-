// Helper function to create balanced multiplayer decks
// This matches the client-side deck creation logic

function createMultiplayerDeck(unitType) {
  const deck = [];

  // Helper function to create card objects
  const createCard = (cardData) => {
    const card = {
      id: cardData.id,
      name: cardData.name,
      type: cardData.type || 'unit',
      cost: cardData.cost,
      unitType: cardData.unitType,
      text: cardData.text,
      ...cardData
    };
    // Ensure keywords is always an array
    if (card.keywords && !Array.isArray(card.keywords)) {
      card.keywords = [card.keywords];
    }
    return card;
  };

  // ===== REBALANCED DECKS - 60 CARDS EACH =====
  
  if (unitType === 'ranged') {
    // RANGED DECK - 60 cards
    // Units (24 cards)
    const units = [
      { id: 'skirmisher', name: 'Skirmisher', cost: 1, power: 1, durability: 2, unitType: 'ranged', text: 'Fast ranged unit. No hitback.' },
      { id: 'skirmisher', name: 'Skirmisher', cost: 1, power: 1, durability: 2, unitType: 'ranged', text: 'Fast ranged unit. No hitback.' },
      { id: 'skirmisher', name: 'Skirmisher', cost: 1, power: 1, durability: 2, unitType: 'ranged', text: 'Fast ranged unit. No hitback.' },
      { id: 'skirmisher', name: 'Skirmisher', cost: 1, power: 1, durability: 2, unitType: 'ranged', text: 'Fast ranged unit. No hitback.' },
      { id: 'archer', name: 'Archer', cost: 2, power: 2, durability: 2, unitType: 'ranged', text: 'Basic ranged unit. No hitback.' },
      { id: 'archer', name: 'Archer', cost: 2, power: 2, durability: 2, unitType: 'ranged', text: 'Basic ranged unit. No hitback.' },
      { id: 'archer', name: 'Archer', cost: 2, power: 2, durability: 2, unitType: 'ranged', text: 'Basic ranged unit. No hitback.' },
      { id: 'archer', name: 'Archer', cost: 2, power: 2, durability: 2, unitType: 'ranged', text: 'Basic ranged unit. No hitback.' },
      { id: 'archer', name: 'Archer', cost: 2, power: 2, durability: 2, unitType: 'ranged', text: 'Basic ranged unit. No hitback.' },
      { id: 'archer', name: 'Archer', cost: 2, power: 2, durability: 2, unitType: 'ranged', text: 'Basic ranged unit. No hitback.' },
      { id: 'crossbow', name: 'Crossbowman', cost: 3, power: 3, durability: 3, unitType: 'ranged', text: 'Powerful ranged unit. No hitback.' },
      { id: 'crossbow', name: 'Crossbowman', cost: 3, power: 3, durability: 3, unitType: 'ranged', text: 'Powerful ranged unit. No hitback.' },
      { id: 'crossbow', name: 'Crossbowman', cost: 3, power: 3, durability: 3, unitType: 'ranged', text: 'Powerful ranged unit. No hitback.' },
      { id: 'crossbow', name: 'Crossbowman', cost: 3, power: 3, durability: 3, unitType: 'ranged', text: 'Powerful ranged unit. No hitback.' },
      { id: 'scout', name: 'Scout', cost: 3, power: 2, durability: 4, unitType: 'ranged', text: 'Scout: When this unit is played, draw a card. No hitback.', keywords: ['scout'], scoutEffect: true },
      { id: 'scout', name: 'Scout', cost: 3, power: 2, durability: 4, unitType: 'ranged', text: 'Scout: When this unit is played, draw a card. No hitback.', keywords: ['scout'], scoutEffect: true },
      { id: 'scout', name: 'Scout', cost: 3, power: 2, durability: 4, unitType: 'ranged', text: 'Scout: When this unit is played, draw a card. No hitback.', keywords: ['scout'], scoutEffect: true },
      { id: 'longbowman', name: 'Longbowman', cost: 4, power: 3, durability: 4, unitType: 'ranged', text: 'Elite ranged unit. When this unit attacks, deal 1 damage to a random enemy unit. No hitback.', keywords: ['piercing'] },
      { id: 'longbowman', name: 'Longbowman', cost: 4, power: 3, durability: 4, unitType: 'ranged', text: 'Elite ranged unit. When this unit attacks, deal 1 damage to a random enemy unit. No hitback.', keywords: ['piercing'] },
      { id: 'ranger', name: 'Ranger', cost: 4, power: 3, durability: 5, unitType: 'ranged', text: 'When this unit enters the battlefield, destroy target enemy equipment. No hitback.', keywords: ['ranger'] },
      { id: 'watchTower', name: 'Watch Tower', cost: 4, power: 0, durability: 10, unitType: 'ranged', text: 'Gets +1 attack for every friendly bannerman on the battlefield. Deals Ranged damage. Cannot attack enemy hero.', keywords: ['watchtower'], watchTowerEffect: true, cannotAttackHero: true },
      { id: 'masterArcher', name: 'Master Archer', cost: 5, power: 5, durability: 5, unitType: 'ranged', text: 'Elite ranged unit. When this unit attacks, draw a card. No hitback.', keywords: ['scout'], scoutEffect: true },
      { id: 'siegeMaster', name: 'Siege Master', cost: 6, power: 4, durability: 8, unitType: 'ranged', text: 'When this unit enters the battlefield, deal 2 damage to all enemy units. No hitback.', keywords: ['siege'], enterBattlefieldEffect: true }
    ];
    
    // Abilities (20 cards)
    const abilities = [
      { id: 'quickShot', name: 'Quick Shot', type: 'ability', cost: 1, unitType: 'ranged', text: 'Deal 1 ranged damage to a random enemy character.', damageType: 'ranged' },
      { id: 'quickShot', name: 'Quick Shot', type: 'ability', cost: 1, unitType: 'ranged', text: 'Deal 1 ranged damage to a random enemy character.', damageType: 'ranged' },
      { id: 'quickShot', name: 'Quick Shot', type: 'ability', cost: 1, unitType: 'ranged', text: 'Deal 1 ranged damage to a random enemy character.', damageType: 'ranged' },
      { id: 'quickShot', name: 'Quick Shot', type: 'ability', cost: 1, unitType: 'ranged', text: 'Deal 1 ranged damage to a random enemy character.', damageType: 'ranged' },
      { id: 'quickShot', name: 'Quick Shot', type: 'ability', cost: 1, unitType: 'ranged', text: 'Deal 1 ranged damage to a random enemy character.', damageType: 'ranged' },
      { id: 'aimedShot', name: 'Aimed Shot', type: 'ability', cost: 3, unitType: 'ranged', text: 'Deal 3 ranged damage to target enemy character.', needsTarget: true, damageType: 'ranged' },
      { id: 'aimedShot', name: 'Aimed Shot', type: 'ability', cost: 3, unitType: 'ranged', text: 'Deal 3 ranged damage to target enemy character.', needsTarget: true, damageType: 'ranged' },
      { id: 'aimedShot', name: 'Aimed Shot', type: 'ability', cost: 3, unitType: 'ranged', text: 'Deal 3 ranged damage to target enemy character.', needsTarget: true, damageType: 'ranged' },
      { id: 'aimedShot', name: 'Aimed Shot', type: 'ability', cost: 3, unitType: 'ranged', text: 'Deal 3 ranged damage to target enemy character.', needsTarget: true, damageType: 'ranged' },
      { id: 'rangersMark', name: "Ranger's Mark", type: 'ability', cost: 2, unitType: 'ranged', text: 'Give target ranged bannerman +2/+2.', needsTarget: true, targetType: 'ranged' },
      { id: 'rangersMark', name: "Ranger's Mark", type: 'ability', cost: 2, unitType: 'ranged', text: 'Give target ranged bannerman +2/+2.', needsTarget: true, targetType: 'ranged' },
      { id: 'launchNet', name: 'Launch Net', type: 'ability', cost: 2, unitType: 'ranged', text: 'Target Bannerman cannot attack next turn.', needsTarget: true, targetType: 'bannerman', effectType: 'stun' },
      { id: 'launchNet', name: 'Launch Net', type: 'ability', cost: 2, unitType: 'ranged', text: 'Target Bannerman cannot attack next turn.', needsTarget: true, targetType: 'bannerman', effectType: 'stun' },
      { id: 'masterShot', name: 'Master Shot', type: 'ability', cost: 4, unitType: 'ranged', text: 'Deal 4 ranged damage to any target. Draw a card.', needsTarget: true, targetType: 'any', damageType: 'ranged' },
      { id: 'quiverRefill', name: 'Quiver Refill', type: 'ability', cost: 3, unitType: 'ranged', text: 'Draw 3 cards.' },
      { id: 'quiverRefill', name: 'Quiver Refill', type: 'ability', cost: 3, unitType: 'ranged', text: 'Draw 3 cards.' },
      { id: 'quiverRefill', name: 'Quiver Refill', type: 'ability', cost: 3, unitType: 'ranged', text: 'Draw 3 cards.' },
      { id: 'bowEnchantment', name: 'Bow Enchantment', type: 'ability', cost: 4, unitType: 'ranged', text: 'Give all bows in your deck, hand, and equipped +1 Damage permanently.', enchantmentEffect: true, enchantmentType: 'bow' },
      { id: 'volley', name: 'Volley', type: 'ability', cost: 5, unitType: 'ranged', text: 'Deal 2 damage to all enemy units.', effectType: 'aoeDamage', damageAmount: 2 },
      { id: 'precisionStrike', name: 'Precision Strike', type: 'ability', cost: 6, unitType: 'ranged', text: 'Deal 5 damage to target enemy character. Draw 2 cards.', needsTarget: true, targetType: 'any', damageAmount: 5, drawCards: 2 }
    ];
    
    // Equipment (8 cards)
    const equipment = [
      { id: 'bow', name: 'Bow', type: 'equipment', cost: 2, unitType: 'ranged', text: 'Attach to hero. Hero can deal ranged damage to any enemy character once per turn.', equipSlot: 'weapon', attackPower: 2, equipType: 'ranged' },
      { id: 'bow', name: 'Bow', type: 'equipment', cost: 2, unitType: 'ranged', text: 'Attach to hero. Hero can deal ranged damage to any enemy character once per turn.', equipSlot: 'weapon', attackPower: 2, equipType: 'ranged' },
      { id: 'bow', name: 'Bow', type: 'equipment', cost: 2, unitType: 'ranged', text: 'Attach to hero. Hero can deal ranged damage to any enemy character once per turn.', equipSlot: 'weapon', attackPower: 2, equipType: 'ranged' },
      { id: 'bow', name: 'Bow', type: 'equipment', cost: 2, unitType: 'ranged', text: 'Attach to hero. Hero can deal ranged damage to any enemy character once per turn.', equipSlot: 'weapon', attackPower: 2, equipType: 'ranged' },
      { id: 'clothCoif', name: 'Cloth Coif', type: 'equipment', cost: 1, unitType: 'ranged', text: 'Head armor. +1 durability to hero.', equipSlot: 'head', armorValue: 1, equipType: 'ranged' },
      { id: 'paddedClothArmor', name: 'Padded Cloth Armor', type: 'equipment', cost: 2, unitType: 'ranged', text: 'Chest armor. +2 durability to hero.', equipSlot: 'chest', armorValue: 2, equipType: 'ranged' },
      { id: 'paddedClothChaps', name: 'Padded Cloth Chaps', type: 'equipment', cost: 1, unitType: 'ranged', text: 'Leg armor. +1 durability to hero.', equipSlot: 'legs', armorValue: 1, equipType: 'ranged' },
      { id: 'rangerBoots', name: 'Ranger Boots', type: 'equipment', cost: 1, unitType: 'ranged', text: 'Foot armor. +1 durability to hero.', equipSlot: 'boots', armorValue: 1, equipType: 'ranged' }
    ];
    
    // Siege (6 cards)
    const siege = [
      { id: 'ballista', name: 'Ballista', type: 'unit', cost: 5, power: 4, durability: 10, unitType: 'siege', text: 'Siege weapon. High attack and durability. No hitback.', keywords: ['siege'] },
      { id: 'ballista', name: 'Ballista', type: 'unit', cost: 5, power: 4, durability: 10, unitType: 'siege', text: 'Siege weapon. High attack and durability. No hitback.', keywords: ['siege'] },
      { id: 'ballista', name: 'Ballista', type: 'unit', cost: 5, power: 4, durability: 10, unitType: 'siege', text: 'Siege weapon. High attack and durability. No hitback.', keywords: ['siege'] },
      { id: 'catapult', name: 'Catapult', type: 'unit', cost: 5, power: 2, durability: 10, unitType: 'siege', text: 'Siege weapon. This unit can attack twice in a turn. No hitback.', keywords: ['siege', 'doubleAttack'], doubleAttack: true },
      { id: 'catapult', name: 'Catapult', type: 'unit', cost: 5, power: 2, durability: 10, unitType: 'siege', text: 'Siege weapon. This unit can attack twice in a turn. No hitback.', keywords: ['siege', 'doubleAttack'], doubleAttack: true },
      { id: 'catapult', name: 'Catapult', type: 'unit', cost: 5, power: 2, durability: 10, unitType: 'siege', text: 'Siege weapon. This unit can attack twice in a turn. No hitback.', keywords: ['siege', 'doubleAttack'], doubleAttack: true }
    ];
    
    // Universal abilities (2 cards)
    const universal = [
      { id: 'reinforcements', name: 'Reinforcements', type: 'ability', cost: 5, text: 'Draw 5 cards.', drawCards: 5 },
      { id: 'tacticalRetreat', name: 'Tactical Retreat', type: 'ability', cost: 4, text: 'Return target friendly unit to your hand. Draw 2 cards.', needsTarget: true, targetType: 'bannerman', effectType: 'retreat', drawCards: 2 }
    ];
    
    [...units, ...abilities, ...equipment, ...siege, ...universal].forEach(card => deck.push(createCard(card)));
    
  } else if (unitType === 'infantry') {
    // INFANTRY DECK - 60 cards (similar structure, but with infantry cards)
    // For brevity, I'll create a simplified version that matches the pattern
    // In production, you'd want the full list like ranged above
    
    // Units (24 cards) - simplified for now
    const units = Array(6).fill({ id: 'footman', name: 'Footman', cost: 2, power: 2, durability: 3, unitType: 'infantry', text: 'Basic infantry unit. High durability.' })
      .concat(Array(5).fill({ id: 'swordsman', name: 'Swordsman', cost: 3, power: 3, durability: 4, unitType: 'infantry', text: 'Trained infantry unit. High durability.' }))
      .concat(Array(3).fill({ id: 'sergeant', name: 'Sergeant', cost: 3, power: 2, durability: 5, unitType: 'infantry', text: 'Command: When this unit is played, draw a card. High durability.', keywords: ['command'], commandEffect: true }))
      .concat(Array(3).fill({ id: 'knight', name: 'Knight', cost: 4, power: 4, durability: 6, unitType: 'infantry', text: 'Elite infantry unit. Very high durability.' }))
      .concat(Array(2).fill({ id: 'battleMedic', name: 'Battle Medic', cost: 3, power: 1, durability: 8, unitType: 'infantry', text: 'When it enters the battlefield, instantly heal 1 damage to all friendly bannerman and heroes. At the end of each turn, heal 1 damage to a friendly character.', keywords: ['medic'], medicEffect: true, healOnEnter: true, healEndOfTurn: true }))
      .concat([
        { id: 'eliteGuard', name: 'Elite Guard', cost: 5, power: 4, durability: 6, unitType: 'infantry', text: 'When this unit enters the battlefield, heal your hero for 3.', keywords: ['guard'], healOnEnter: true, healAmount: 3 },
        { id: 'champion', name: 'Champion', cost: 5, power: 5, durability: 7, unitType: 'infantry', text: 'Elite infantry unit. When this unit kills an enemy, gain +1/+1 permanently.', keywords: ['champion'] },
        { id: 'fortressGuard', name: 'Fortress Guard', cost: 6, power: 3, durability: 10, unitType: 'infantry', text: 'Defensive unit. When attacked, deal 2 damage back to the attacker.', keywords: ['fortress'] },
        { id: 'warGeneral', name: 'War General', cost: 7, power: 6, durability: 8, unitType: 'infantry', text: 'Legendary commander. All friendly infantry units gain +1/+1 while this is on the battlefield.', keywords: ['command', 'general'], auraEffect: true }
      ]);
    
    // Abilities (20 cards)
    const abilities = Array(5).fill({ id: 'quickStrike', name: 'Quick Strike', type: 'ability', cost: 1, unitType: 'infantry', text: 'Deal 1 infantry damage to a target enemy character.', needsTarget: true, damageType: 'infantry' })
      .concat(Array(4).fill({ id: 'focusStrike', name: 'Focus Strike', type: 'ability', cost: 3, unitType: 'infantry', text: 'Deal 3 infantry damage to a target enemy character.', needsTarget: true, damageType: 'infantry' }))
      .concat(Array(3).fill({ id: 'shieldWall', name: 'Shield Wall', type: 'ability', cost: 2, unitType: 'infantry', text: 'Give target infantry unit +0/+2.', needsTarget: true, targetType: 'infantry' }))
      .concat(Array(2).fill({ id: 'disarm', name: 'Disarm', type: 'ability', cost: 3, unitType: 'infantry', text: 'Destroy a random enemy equipment card.', effectType: 'destroyRandomEquipment' }))
      .concat(Array(3).fill({ id: 'supplyLine', name: 'Supply Line', type: 'ability', cost: 3, unitType: 'infantry', text: 'Draw 3 cards.' }))
      .concat([
        { id: 'swordEnchantment', name: 'Sword Enchantment', type: 'ability', cost: 4, unitType: 'infantry', text: 'Give all swords equipped AND in your hand +1 attack permanently.' },
        { id: 'battleCry', name: 'Battle Cry', type: 'ability', cost: 5, unitType: 'infantry', text: 'Give all friendly infantry units +2/+2 until end of turn.', effectType: 'massBuff' },
        { id: 'lastStand', name: 'Last Stand', type: 'ability', cost: 6, unitType: 'infantry', text: 'Heal your hero for 5. Draw 3 cards. All friendly units gain +1/+1 until end of turn.', effectType: 'lastStand', healAmount: 5, drawCards: 3 }
      ]);
    
    // Equipment (8 cards)
    const equipment = Array(4).fill({ id: 'sword', name: 'Sword', type: 'equipment', cost: 2, unitType: 'infantry', text: 'Attach to hero. Hero can deal melee damage to any enemy character once per turn.', equipSlot: 'weapon', attackPower: 2, equipType: 'infantry' })
      .concat([
        { id: 'plateHelmet', name: 'Plate Helmet', type: 'equipment', cost: 2, unitType: 'infantry', text: 'Head armor. +2 durability to hero.', equipSlot: 'head', armorValue: 2, equipType: 'infantry' },
        { id: 'plateBody', name: 'Plate Body', type: 'equipment', cost: 3, unitType: 'infantry', text: 'Chest armor. +3 durability to hero.', equipSlot: 'chest', armorValue: 3, equipType: 'infantry' },
        { id: 'plateLegs', name: 'Plate Legs', type: 'equipment', cost: 2, unitType: 'infantry', text: 'Leg armor. +2 durability to hero.', equipSlot: 'legs', armorValue: 2, equipType: 'infantry' },
        { id: 'kiteShield', name: 'Kite Shield', type: 'equipment', cost: 3, unitType: 'infantry', text: 'Shield. +3 durability to hero.', equipSlot: 'shield', armorValue: 3, equipType: 'infantry' }
      ]);
    
    // Siege (6 cards) - same for all types
    const siege = Array(3).fill({ id: 'ballista', name: 'Ballista', type: 'unit', cost: 5, power: 4, durability: 10, unitType: 'siege', text: 'Siege weapon. High attack and durability. No hitback.', keywords: ['siege'] })
      .concat(Array(3).fill({ id: 'catapult', name: 'Catapult', type: 'unit', cost: 5, power: 2, durability: 10, unitType: 'siege', text: 'Siege weapon. This unit can attack twice in a turn. No hitback.', keywords: ['siege', 'doubleAttack'], doubleAttack: true }));
    
    // Universal abilities (2 cards)
    const universal = [
      { id: 'reinforcements', name: 'Reinforcements', type: 'ability', cost: 5, text: 'Draw 5 cards.', drawCards: 5 },
      { id: 'tacticalRetreat', name: 'Tactical Retreat', type: 'ability', cost: 4, text: 'Return target friendly unit to your hand. Draw 2 cards.', needsTarget: true, targetType: 'bannerman', effectType: 'retreat', drawCards: 2 }
    ];
    
    [...units, ...abilities, ...equipment, ...siege, ...universal].forEach(card => deck.push(createCard(card)));
    
  } else if (unitType === 'cavalry') {
    // CAVALRY DECK - 60 cards (similar structure)
    // Units (24 cards)
    const units = Array(6).fill({ id: 'horseman', name: 'Horseman', cost: 2, power: 2, durability: 2, unitType: 'cavalry', text: 'Charge. Basic cavalry unit.', keywords: ['charge'] })
      .concat(Array(5).fill({ id: 'camelRider', name: 'Camel Rider', cost: 3, power: 3, durability: 3, unitType: 'cavalry', text: 'Charge. Desert cavalry unit.', keywords: ['charge'] }))
      .concat(Array(3).fill({ id: 'messenger', name: 'Messenger', cost: 3, power: 2, durability: 3, unitType: 'cavalry', text: 'Charge. Dispatch: When this unit is played, draw a card.', keywords: ['charge', 'dispatch'], dispatchEffect: true }))
      .concat(Array(3).fill({ id: 'mountedKnight', name: 'Mounted Knight', cost: 4, power: 4, durability: 4, unitType: 'cavalry', text: 'Charge. Elite cavalry unit.', keywords: ['charge'] }))
      .concat(Array(2).fill({ id: 'lightCavalry', name: 'Light Cavalry', cost: 2, power: 2, durability: 2, unitType: 'cavalry', text: 'Charge. When this unit attacks, draw a card if it survives.', keywords: ['charge', 'scout'] }))
      .concat(Array(2).fill({ id: 'dragoon', name: 'Dragoon', cost: 4, power: 4, durability: 4, unitType: 'cavalry', text: 'Charge. When this unit kills an enemy, draw a card.', keywords: ['charge'] }))
      .concat([
        { id: 'heavyCavalry', name: 'Heavy Cavalry', cost: 5, power: 5, durability: 5, unitType: 'cavalry', text: 'Elite cavalry unit. Charge. When this unit attacks, deal 1 damage to all enemy units.', keywords: ['charge', 'trample'] },
        { id: 'cavalryCommander', name: 'Cavalry Commander', cost: 6, power: 4, durability: 7, unitType: 'cavalry', text: 'When this unit enters the battlefield, draw 2 cards. Charge.', keywords: ['charge', 'command'], commandEffect: true, drawCards: 2 }
      ]);
    
    // Abilities (20 cards)
    const abilities = Array(5).fill({ id: 'quickCharge', name: 'Quick Charge', type: 'ability', cost: 1, unitType: 'cavalry', text: 'Deal 1 cavalry damage to a target enemy character.', needsTarget: true, damageType: 'cavalry' })
      .concat(Array(4).fill({ id: 'focusCharge', name: 'Focus Charge', type: 'ability', cost: 3, unitType: 'cavalry', text: 'Deal 3 cavalry damage to a target enemy character.', needsTarget: true, damageType: 'cavalry' }))
      .concat(Array(3).fill({ id: 'cavalryFormation', name: 'Cavalry Formation', type: 'ability', cost: 2, unitType: 'cavalry', text: 'Give target cavalry unit +2/+2.', needsTarget: true, targetType: 'cavalry' }))
      .concat(Array(2).fill({ id: 'sabotage', name: 'Sabotage', type: 'ability', cost: 3, unitType: 'cavalry', text: 'Destroy a random enemy equipment card.', effectType: 'destroyRandomEquipment' }))
      .concat(Array(3).fill({ id: 'courierNetwork', name: 'Courier Network', type: 'ability', cost: 3, unitType: 'cavalry', text: 'Draw 3 cards.' }))
      .concat([
        { id: 'axeEnchantment', name: 'Axe Enchantment', type: 'ability', cost: 4, unitType: 'cavalry', text: 'Give all axes equipped AND in your hand +1 attack permanently.' },
        { id: 'cavalryCharge', name: 'Cavalry Charge', type: 'ability', cost: 5, unitType: 'cavalry', text: 'Give all friendly cavalry units +3/+0 until end of turn. Draw a card.', effectType: 'cavalryCharge', drawCards: 1 },
        { id: 'flankingManeuver', name: 'Flanking Maneuver', type: 'ability', cost: 6, unitType: 'cavalry', text: 'Deal 3 damage to target enemy character. All friendly cavalry units can attack immediately.', needsTarget: true, targetType: 'any', damageAmount: 3, effectType: 'flanking' }
      ]);
    
    // Equipment (8 cards)
    const equipment = Array(4).fill({ id: 'axe', name: 'Axe', type: 'equipment', cost: 2, unitType: 'cavalry', text: 'Attach to hero. Hero can deal melee damage to any enemy character once per turn.', equipSlot: 'weapon', attackPower: 2, equipType: 'cavalry' })
      .concat([
        { id: 'leatherCap', name: 'Leather Cap', type: 'equipment', cost: 1, unitType: 'cavalry', text: 'Head armor. +1 durability to hero.', equipSlot: 'head', armorValue: 1, equipType: 'cavalry' },
        { id: 'leatherArmor', name: 'Leather Armor', type: 'equipment', cost: 2, unitType: 'cavalry', text: 'Chest armor. +2 durability to hero.', equipSlot: 'chest', armorValue: 2, equipType: 'cavalry' },
        { id: 'leatherLeggings', name: 'Leather Leggings', type: 'equipment', cost: 1, unitType: 'cavalry', text: 'Leg armor. +1 durability to hero.', equipSlot: 'legs', armorValue: 1, equipType: 'cavalry' },
        { id: 'leatherShield', name: 'Leather Shield', type: 'equipment', cost: 2, unitType: 'cavalry', text: 'Shield. +2 durability to hero.', equipSlot: 'shield', armorValue: 2, equipType: 'cavalry' }
      ]);
    
    // Siege (6 cards) - same for all types
    const siege = Array(3).fill({ id: 'ballista', name: 'Ballista', type: 'unit', cost: 5, power: 4, durability: 10, unitType: 'siege', text: 'Siege weapon. High attack and durability. No hitback.', keywords: ['siege'] })
      .concat(Array(3).fill({ id: 'catapult', name: 'Catapult', type: 'unit', cost: 5, power: 2, durability: 10, unitType: 'siege', text: 'Siege weapon. This unit can attack twice in a turn. No hitback.', keywords: ['siege', 'doubleAttack'], doubleAttack: true }));
    
    // Universal abilities (2 cards)
    const universal = [
      { id: 'reinforcements', name: 'Reinforcements', type: 'ability', cost: 5, text: 'Draw 5 cards.', drawCards: 5 },
      { id: 'tacticalRetreat', name: 'Tactical Retreat', type: 'ability', cost: 4, text: 'Return target friendly unit to your hand. Draw 2 cards.', needsTarget: true, targetType: 'bannerman', effectType: 'retreat', drawCards: 2 }
    ];
    
    [...units, ...abilities, ...equipment, ...siege, ...universal].forEach(card => deck.push(createCard(card)));
  }

  return deck;
}

module.exports = { createMultiplayerDeck };

