// ===== CARD COLLECTION ROUTES =====
const express = require('express');
const router = express.Router();
const { db } = require('./database');
const { authenticateToken } = require('./auth');

/**
 * GET /api/collection
 * Get user's card collection organized by type
 */
router.get('/', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    
    console.log(`[COLLECTION] Fetching cards for user ${userId}`);

    db.all(`
      SELECT card_id, quantity
      FROM user_cards
      WHERE user_id = ?
      ORDER BY card_id
    `, [userId], (err, cards) => {
      if (err) {
        console.error('Error fetching collection:', err);
        return res.status(500).json({ success: false, message: 'Database error' });
      }

      console.log(`[COLLECTION] Found ${(cards || []).length} card entries for user ${userId}`);
      
      // Organize by type (you'll need to match card IDs to types from card database)
      // For now, return as-is and let frontend organize
      res.json({
        success: true,
        cards: cards || []
      });
    });
  } catch (error) {
    console.error('Get collection error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * GET /api/collection/unopened
 * Get user's unopened products (booster packs, boxes)
 */
router.get('/unopened', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;

    db.all(`
      SELECT product_type, product_id, quantity
      FROM unopened_products
      WHERE user_id = ?
      ORDER BY product_type, product_id
    `, [userId], (err, products) => {
      if (err) {
        console.error('Error fetching unopened products:', err);
        return res.status(500).json({ success: false, message: 'Database error' });
      }

      res.json({
        success: true,
        products: products || []
      });
    });
  } catch (error) {
    console.error('Get unopened products error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * POST /api/collection/open
 * Open a booster pack or box
 */
router.post('/open', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    const { productType, productId, quantity = 1 } = req.body;

    if (!productType || !productId) {
      return res.status(400).json({ success: false, message: 'Product type and ID required' });
    }

    // Check if user owns the product
    db.get(`
      SELECT quantity FROM unopened_products
      WHERE user_id = ? AND product_type = ? AND product_id = ?
    `, [userId, productType, productId], (err, product) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error' });
      }

      if (!product || product.quantity < quantity) {
        return res.status(400).json({ success: false, message: 'You do not own this product' });
      }

      // Remove products
      db.run(`
        UPDATE unopened_products
        SET quantity = quantity - ?
        WHERE user_id = ? AND product_type = ? AND product_id = ?
      `, [quantity, userId, productType, productId], (err) => {
        if (err) {
          return res.status(500).json({ success: false, message: 'Failed to open product' });
        }

        // Generate cards (5 cards per pack, 10 packs per box)
        const cardsPerPack = 5;
        const packsToOpen = productType === 'booster_box' ? quantity * 10 : quantity;
        const totalCards = packsToOpen * cardsPerPack;

        // This is a placeholder - you'll need to implement actual card generation logic
        // based on your card database and rarity system
        const openedCards = generateBoosterCards(totalCards);

        // Add cards to collection
        const cardUpdates = [];
        openedCards.forEach(cardId => {
          db.run(`
            INSERT INTO user_cards (user_id, card_id, quantity)
            VALUES (?, ?, 1)
            ON CONFLICT(user_id, card_id) DO UPDATE SET quantity = quantity + 1
          `, [userId, cardId], () => {});
        });

        res.json({
          success: true,
          message: `Opened ${packsToOpen} ${productType === 'booster_box' ? 'boxes' : 'packs'}`,
          cards: openedCards,
          totalCards: totalCards
        });
      });
    });
  } catch (error) {
    console.error('Open product error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * POST /api/collection/salvage
 * Salvage a card to get fragments and scrap
 */
router.post('/salvage', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    const { cardId, quantity = 1 } = req.body;

    if (!cardId) {
      return res.status(400).json({ success: false, message: 'Card ID required' });
    }

    // Check if user owns the card
    db.get(`
      SELECT quantity FROM user_cards
      WHERE user_id = ? AND card_id = ?
    `, [userId, cardId], (err, card) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error' });
      }

      if (!card || card.quantity < quantity) {
        return res.status(400).json({ success: false, message: 'You do not own enough of this card' });
      }

      // Check minimum card limits
      const { canSellOrSalvageCard } = require('./new-account-cards');
      canSellOrSalvageCard(userId, cardId, (err, canSalvage) => {
        if (err) {
          return res.status(500).json({ success: false, message: 'Error checking card limits' });
        }
        if (!canSalvage) {
          return res.status(400).json({ 
            success: false, 
            message: 'Cannot salvage this card. You must maintain a minimum of 60 cards of each type (Ranged, Infantry, Cavalry).' 
          });
        }

        // Calculate fragments and scrap based on card rarity
        const rewards = calculateSalvageRewards(cardId, quantity);

        // Remove cards
        db.run(`
          UPDATE user_cards
          SET quantity = quantity - ?
          WHERE user_id = ? AND card_id = ?
        `, [quantity, userId, cardId], (err) => {
          if (err) {
            return res.status(500).json({ success: false, message: 'Failed to salvage card' });
          }

          // Add fragments and scrap
          db.run(`
            UPDATE player_stats
            SET fragments = fragments + ?, scrap = scrap + ?
            WHERE user_id = ?
          `, [rewards.fragments, rewards.scrap, userId], (err) => {
            if (err) {
              return res.status(500).json({ success: false, message: 'Failed to add rewards' });
            }

            res.json({
              success: true,
              message: 'Card salvaged',
              fragments: rewards.fragments,
              scrap: rewards.scrap
            });
          });
        });
      });
    });
  } catch (error) {
    console.error('Salvage error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * GET /api/collection/stats
 * Get collection statistics (fragments, scrap, total cards)
 */
router.get('/stats', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;

    db.get(`
      SELECT 
        ps.fragments,
        ps.scrap,
        (SELECT COUNT(*) FROM user_cards WHERE user_id = ?) as total_cards,
        (SELECT SUM(quantity) FROM user_cards WHERE user_id = ?) as total_card_count
      FROM player_stats ps
      WHERE ps.user_id = ?
    `, [userId, userId, userId], (err, stats) => {
      if (err) {
        console.error('Error fetching collection stats:', err);
        return res.status(500).json({ success: false, message: 'Database error' });
      }

      res.json({
        success: true,
        stats: stats || {
          fragments: 0,
          scrap: 0,
          total_cards: 0,
          total_card_count: 0
        }
      });
    });
  } catch (error) {
    console.error('Get collection stats error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Helper functions
function generateBoosterCards(count) {
  // Placeholder - implement actual card generation with rarity system
  // This should pull from your CARD_DATABASE and use rarity weights
  const cards = [];
  for (let i = 0; i < count; i++) {
    // Random card selection - replace with proper rarity system
    cards.push('skirmisher'); // Placeholder
  }
  return cards;
}

function calculateSalvageRewards(cardId, quantity) {
  // Placeholder - implement based on card rarity
  // Common: 1 fragment, 1 scrap
  // Uncommon: 2 fragments, 2 scrap
  // Rare: 5 fragments, 5 scrap
  // Epic: 10 fragments, 10 scrap
  // Legendary: 25 fragments, 25 scrap
  
  // For now, return default values
  return {
    fragments: quantity * 1,
    scrap: quantity * 1
  };
}

/**
 * POST /api/collection/add-starter-cards
 * Add starter cards to an existing user (for users created before starter cards feature)
 */
router.post('/add-starter-cards', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    const { giveNewAccountStarterCards } = require('./new-account-cards');
    
    // Check if user already has cards
    db.get('SELECT COUNT(*) as count FROM user_cards WHERE user_id = ?', [userId], (err, result) => {
      if (err) {
        console.error('Error checking existing cards:', err);
        return res.status(500).json({ success: false, message: 'Database error' });
      }
      
      if (result.count > 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'You already have cards in your collection. This is only for accounts without cards.' 
        });
      }
      
      // Add starter cards
      giveNewAccountStarterCards(userId, () => {
        console.log(`[COLLECTION] Added starter cards to user ${userId}`);
        res.json({
          success: true,
          message: 'Starter cards added successfully!'
        });
      });
    });
  } catch (error) {
    console.error('Add starter cards error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;

