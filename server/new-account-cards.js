// ===== NEW ACCOUNT CARD SETUP =====
const { db } = require('./database');

/**
 * Give new account starter cards: 60 Ranged total, 60 Infantry total, 60 Cavalry total
 * Mix of units, abilities, equipment, and weapons for each type
 */
function giveNewAccountStarterCards(userId, callback) {
  // Ranged cards (60 total) - Units, Abilities, Equipment, Weapons
  const rangedCards = [
    // Units (35 total)
    { cardId: 'skirmisher', quantity: 12 },
    { cardId: 'archer', quantity: 12 },
    { cardId: 'crossbow', quantity: 8 },
    { cardId: 'scout', quantity: 3 },
    // Abilities (15 total)
    { cardId: 'quickShot', quantity: 6 },
    { cardId: 'aimedShot', quantity: 5 },
    { cardId: 'quiverRefill', quantity: 2 },
    { cardId: 'rangersMark', quantity: 2 },
    // Equipment/Weapons (10 total)
    { cardId: 'bow', quantity: 3 },
    { cardId: 'clothCoif', quantity: 2 },
    { cardId: 'paddedClothArmor', quantity: 2 },
    { cardId: 'paddedClothChaps', quantity: 2 },
    { cardId: 'rangerBoots', quantity: 1 }
  ];
  
  // Infantry cards (60 total) - Units, Abilities, Equipment, Weapons
  const infantryCards = [
    // Units (35 total)
    { cardId: 'footman', quantity: 12 },
    { cardId: 'swordsman', quantity: 12 },
    { cardId: 'sergeant', quantity: 8 },
    { cardId: 'knight', quantity: 3 },
    // Abilities (15 total)
    { cardId: 'quickStrike', quantity: 6 },
    { cardId: 'focusStrike', quantity: 5 },
    { cardId: 'supplyLine', quantity: 2 },
    { cardId: 'shieldWall', quantity: 2 },
    // Equipment/Weapons (10 total)
    { cardId: 'sword', quantity: 3 },
    { cardId: 'plateHelmet', quantity: 2 },
    { cardId: 'plateBody', quantity: 2 },
    { cardId: 'plateLegs', quantity: 2 },
    { cardId: 'kiteShield', quantity: 1 }
  ];
  
  // Cavalry cards (60 total) - Units, Abilities, Equipment, Weapons
  const cavalryCards = [
    // Units (35 total)
    { cardId: 'horseman', quantity: 12 },
    { cardId: 'camelRider', quantity: 12 },
    { cardId: 'messenger', quantity: 8 },
    { cardId: 'mountedKnight', quantity: 3 },
    // Abilities (15 total)
    { cardId: 'quickCharge', quantity: 6 },
    { cardId: 'focusCharge', quantity: 5 },
    { cardId: 'courierNetwork', quantity: 2 },
    { cardId: 'cavalryFormation', quantity: 2 },
    // Equipment/Weapons (10 total)
    { cardId: 'axe', quantity: 3 },
    { cardId: 'leatherCap', quantity: 2 },
    { cardId: 'leatherArmor', quantity: 2 },
    { cardId: 'leatherLeggings', quantity: 2 },
    { cardId: 'leatherShield', quantity: 1 }
  ];
  
  const starterCards = [...rangedCards, ...infantryCards, ...cavalryCards];

  let completed = 0;
  const total = starterCards.length;

  starterCards.forEach(({ cardId, quantity }) => {
    db.run(`
      INSERT INTO user_cards (user_id, card_id, quantity)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id, card_id) DO UPDATE SET quantity = quantity + ?
    `, [userId, cardId, quantity, quantity], (err) => {
      if (err) {
        console.error(`Error giving starter card ${cardId} to user ${userId}:`, err);
      } else {
        console.log(`[NEW ACCOUNT] Gave ${quantity} ${cardId} to user ${userId}`);
      }
      
      completed++;
      if (completed === total && callback) {
        callback();
      }
    });
  });
}

/**
 * Check if user has minimum cards (60 of each type)
 */
function checkMinimumCards(userId, callback) {
  // Get all cards and sum by type
  db.all(`
    SELECT card_id, quantity
    FROM user_cards
    WHERE user_id = ?
  `, [userId], (err, cards) => {
    if (err) {
      console.error('Error checking minimum cards:', err);
      return callback(err, null);
    }

    const cardTypeMap = {
      // Ranged Units
      'skirmisher': 'ranged', 'archer': 'ranged', 'crossbow': 'ranged', 'scout': 'ranged', 'watchTower': 'ranged',
      // Ranged Abilities
      'quickShot': 'ranged', 'aimedShot': 'ranged', 'masterShot': 'ranged', 'rangersMark': 'ranged',
      'bowEnchantment': 'ranged', 'quiverRefill': 'ranged', 'launchNet': 'ranged',
      // Ranged Equipment/Weapons
      'bow': 'ranged', 'clothCoif': 'ranged', 'paddedClothArmor': 'ranged', 'paddedClothChaps': 'ranged', 'rangerBoots': 'ranged',
      // Infantry Units
      'footman': 'infantry', 'swordsman': 'infantry', 'knight': 'infantry', 'sergeant': 'infantry', 'battleMedic': 'infantry',
      // Infantry Abilities
      'quickStrike': 'infantry', 'focusStrike': 'infantry', 'swordEnchantment': 'infantry',
      'supplyLine': 'infantry', 'shieldWall': 'infantry', 'disarm': 'infantry',
      // Infantry Equipment/Weapons
      'sword': 'infantry', 'plateHelmet': 'infantry', 'plateBody': 'infantry', 'plateLegs': 'infantry', 'kiteShield': 'infantry', 'plateBoots': 'infantry',
      // Cavalry Units
      'horseman': 'cavalry', 'camelRider': 'cavalry', 'mountedKnight': 'cavalry', 'messenger': 'cavalry',
      // Cavalry Abilities
      'quickCharge': 'cavalry', 'focusCharge': 'cavalry', 'axeEnchantment': 'cavalry',
      'courierNetwork': 'cavalry', 'cavalryFormation': 'cavalry', 'sabotage': 'cavalry',
      // Cavalry Equipment/Weapons
      'axe': 'cavalry', 'leatherCap': 'cavalry', 'leatherArmor': 'cavalry', 'leatherLeggings': 'cavalry', 'leatherShield': 'cavalry', 'leatherBoots': 'cavalry'
    };

    const totals = {
      ranged: 0,
      infantry: 0,
      cavalry: 0
    };

    (cards || []).forEach(card => {
      const unitType = cardTypeMap[card.card_id];
      if (unitType && totals[unitType] !== undefined) {
        totals[unitType] += card.quantity || 0;
      }
    });

    const minimums = {
      ranged: totals.ranged >= 60,
      infantry: totals.infantry >= 60,
      cavalry: totals.cavalry >= 60
    };

    callback(null, { totals, minimums });
  });
}

/**
 * Check if user can sell/salvage a card (must have >60 of that type)
 */
function canSellOrSalvageCard(userId, cardId, callback) {
  // Determine card type from card database
  // Map card IDs to their unit types
  const cardTypeMap = {
    // Ranged Units
    'skirmisher': 'ranged', 'archer': 'ranged', 'crossbow': 'ranged', 'scout': 'ranged', 'watchTower': 'ranged',
    // Ranged Abilities
    'quickShot': 'ranged', 'aimedShot': 'ranged', 'masterShot': 'ranged', 'rangersMark': 'ranged',
    'bowEnchantment': 'ranged', 'quiverRefill': 'ranged', 'launchNet': 'ranged',
    // Ranged Equipment/Weapons
    'bow': 'ranged', 'clothCoif': 'ranged', 'paddedClothArmor': 'ranged', 'paddedClothChaps': 'ranged', 'rangerBoots': 'ranged',
    // Infantry Units
    'footman': 'infantry', 'swordsman': 'infantry', 'knight': 'infantry', 'sergeant': 'infantry', 'battleMedic': 'infantry',
    // Infantry Abilities
    'quickStrike': 'infantry', 'focusStrike': 'infantry', 'swordEnchantment': 'infantry',
    'supplyLine': 'infantry', 'shieldWall': 'infantry', 'disarm': 'infantry',
    // Infantry Equipment/Weapons
    'sword': 'infantry', 'plateHelmet': 'infantry', 'plateBody': 'infantry', 'plateLegs': 'infantry', 'kiteShield': 'infantry', 'plateBoots': 'infantry',
    // Cavalry Units
    'horseman': 'cavalry', 'camelRider': 'cavalry', 'mountedKnight': 'cavalry', 'messenger': 'cavalry',
    // Cavalry Abilities
    'quickCharge': 'cavalry', 'focusCharge': 'cavalry', 'axeEnchantment': 'cavalry',
    'courierNetwork': 'cavalry', 'cavalryFormation': 'cavalry', 'sabotage': 'cavalry',
    // Cavalry Equipment/Weapons
    'axe': 'cavalry', 'leatherCap': 'cavalry', 'leatherArmor': 'cavalry', 'leatherLeggings': 'cavalry', 'leatherShield': 'cavalry', 'leatherBoots': 'cavalry'
  };
  
  const unitType = cardTypeMap[cardId];
  
  // If not a typed card (universal abilities, etc.), allow selling
  if (!unitType) {
    return callback(null, true);
  }

  checkMinimumCards(userId, (err, result) => {
    if (err) {
      return callback(err, false);
    }

    const canSell = result.totals[unitType] > 60;
    callback(null, canSell);
  });
}

module.exports = {
  giveNewAccountStarterCards,
  checkMinimumCards,
  canSellOrSalvageCard
};

