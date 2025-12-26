// ===== SHOP ROUTES =====
const express = require('express');
const router = express.Router();
const { db } = require('./database');
const { authenticateToken } = require('./auth');

// Shop items configuration
const SHOP_ITEMS = {
  booster_pack: {
    id: 'booster_pack',
    name: 'Booster Pack',
    type: 'booster_pack',
    cost_gold: 100,
    cost_gems: 0,
    description: 'Contains 5 random cards'
  },
  booster_box: {
    id: 'booster_box',
    name: 'Booster Box',
    type: 'booster_box',
    cost_gold: 800,
    cost_gems: 0,
    description: 'Contains 10 Booster Packs (50 cards total)'
  },
  // Cheapest T1 Bannermen for each type
  skirmisher: {
    id: 'skirmisher',
    name: 'Skirmisher',
    type: 'card',
    card_id: 'skirmisher',
    cost_gold: 15,
    cost_gems: 0,
    description: 'Ranged unit - 1 cost, 1 power, 2 durability'
  },
  footman: {
    id: 'footman',
    name: 'Footman',
    type: 'card',
    card_id: 'footman',
    cost_gold: 15,
    cost_gems: 0,
    description: 'Infantry unit - 1 cost, 1 power, 2 durability'
  },
  scout: {
    id: 'scout',
    name: 'Scout',
    type: 'card',
    card_id: 'scout',
    cost_gold: 15,
    cost_gems: 0,
    description: 'Cavalry unit - 1 cost, 1 power, 2 durability'
  },
  // Cheapest abilities for each type (you'll need to define these based on your card database)
  // These are placeholders - adjust based on actual card IDs
  quick_shot: {
    id: 'quick_shot',
    name: 'Quick Shot',
    type: 'card',
    card_id: 'quickShot',
    cost_gold: 15,
    cost_gems: 0,
    description: 'Ranged ability'
  },
  shield_bash: {
    id: 'shield_bash',
    name: 'Shield Bash',
    type: 'card',
    card_id: 'shieldBash',
    cost_gold: 15,
    cost_gems: 0,
    description: 'Infantry ability'
  },
  charge: {
    id: 'charge',
    name: 'Charge',
    type: 'card',
    card_id: 'charge',
    cost_gold: 15,
    cost_gems: 0,
    description: 'Cavalry ability'
  }
};

/**
 * GET /api/shop/items
 * Get available shop items
 */
router.get('/items', authenticateToken, (req, res) => {
  try {
    res.json({
      success: true,
      items: Object.values(SHOP_ITEMS)
    });
  } catch (error) {
    console.error('Get shop items error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * POST /api/shop/purchase
 * Purchase an item from the shop
 */
router.post('/purchase', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    const { itemId, quantity = 1 } = req.body;

    if (!itemId) {
      return res.status(400).json({ success: false, message: 'Item ID required' });
    }

    const item = SHOP_ITEMS[itemId];
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    const totalCostGold = item.cost_gold * quantity;
    const totalCostGems = item.cost_gems * quantity;

    // Get user stats
    db.get('SELECT gold, gems FROM player_stats WHERE user_id = ?', [userId], (err, stats) => {
      if (err || !stats) {
        return res.status(500).json({ success: false, message: 'Database error' });
      }

      if (stats.gold < totalCostGold) {
        return res.status(400).json({ success: false, message: `Not enough gold. Need ${totalCostGold}` });
      }

      if (stats.gems < totalCostGems) {
        return res.status(400).json({ success: false, message: `Not enough gems. Need ${totalCostGems}` });
      }

      // Deduct currency
      db.run(`
        UPDATE player_stats
        SET gold = gold - ?, gems = gems - ?
        WHERE user_id = ?
      `, [totalCostGold, totalCostGems, userId], (err) => {
        if (err) {
          return res.status(500).json({ success: false, message: 'Failed to process purchase' });
        }

        // Give item to user
        if (item.type === 'booster_pack') {
          // Add booster pack to unopened products
          db.run(`
            INSERT INTO unopened_products (user_id, product_type, product_id, quantity)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id, product_type, product_id) DO UPDATE SET quantity = quantity + ?
          `, [userId, 'booster_pack', 'booster_pack', quantity, quantity], (err) => {
            if (err) {
              console.error('Error adding booster pack:', err);
              return res.status(500).json({ success: false, message: 'Failed to add item' });
            }

            recordPurchase();
          });
        } else if (item.type === 'booster_box') {
          // Add 10 booster packs
          db.run(`
            INSERT INTO unopened_products (user_id, product_type, product_id, quantity)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id, product_type, product_id) DO UPDATE SET quantity = quantity + ?
          `, [userId, 'booster_pack', 'booster_pack', quantity * 10, quantity * 10], (err) => {
            if (err) {
              console.error('Error adding booster box:', err);
              return res.status(500).json({ success: false, message: 'Failed to add item' });
            }

            recordPurchase();
          });
        } else if (item.type === 'card') {
          // Add card to collection
          for (let i = 0; i < quantity; i++) {
            db.run(`
              INSERT INTO user_cards (user_id, card_id, quantity)
              VALUES (?, ?, 1)
              ON CONFLICT(user_id, card_id) DO UPDATE SET quantity = quantity + 1
            `, [userId, item.card_id], (err) => {
              if (err) {
                console.error('Error adding card:', err);
              }
            });
          }

          recordPurchase();
        } else {
          return res.status(400).json({ success: false, message: 'Invalid item type' });
        }

        function recordPurchase() {
          // Record purchase
          db.run(`
            INSERT INTO shop_purchases (user_id, item_type, item_id, quantity, cost_gold, cost_gems)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [userId, item.type, item.id, quantity, totalCostGold, totalCostGems], () => {});

          res.json({
            success: true,
            message: 'Purchase successful',
            item: item.name,
            quantity: quantity
          });
        }
      });
    });
  } catch (error) {
    console.error('Purchase error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;

