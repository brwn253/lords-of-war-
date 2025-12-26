// ===== AUCTION HOUSE ROUTES =====
const express = require('express');
const router = express.Router();
const { db } = require('./database');
const { authenticateToken } = require('./auth');
const { checkTieredAchievement } = require('./achievement-helper');
const { canSellOrSalvageCard } = require('./new-account-cards');

// Auction slot costs
const AUCTION_SLOT_COSTS = {
  3: { type: 'achievement', id: 'win_10_games' },
  4: { type: 'achievement', id: 'win_50_games' },
  5: { type: 'gold', amount: 50 },
  6: { type: 'gold', amount: 500 },
  7: { type: 'gems', amount: 10 },
  8: { type: 'gems', amount: 100 },
  9: { type: 'gems', amount: 1000 },
  10: { type: 'gems', amount: 1500 },
  11: { type: 'gems', amount: 1500 },
  12: { type: 'gems', amount: 1500 },
  13: { type: 'gems', amount: 1500 },
  14: { type: 'gems', amount: 1500 },
  15: { type: 'gems', amount: 1500 }
};

/**
 * GET /api/auction/slots
 * Get user's unlocked auction slots
 */
router.get('/slots', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;

    // Get unlocked slots
    db.all(`
      SELECT slot_number, unlocked_at
      FROM user_auction_slots
      WHERE user_id = ?
      ORDER BY slot_number
    `, [userId], (err, unlockedSlots) => {
      if (err) {
        console.error('Error fetching auction slots:', err);
        return res.status(500).json({ success: false, message: 'Database error' });
      }

      const slotNumbers = (unlockedSlots || []).map(s => s.slot_number);
      
      // Default slots 1 and 2 are always available
      const availableSlots = [1, 2, ...slotNumbers];

      // Get achievements to check for slot 3 and 4
      db.all(`
        SELECT achievement_id
        FROM achievements
        WHERE user_id = ?
      `, [userId], (err, achievements) => {
        if (err) {
          achievements = [];
        }

        const achievementIds = (achievements || []).map(a => a.achievement_id);
        
        // Check if slot 3 and 4 should be unlocked
        if (achievementIds.includes('win_10_games') && !slotNumbers.includes(3)) {
          availableSlots.push(3);
        }
        if (achievementIds.includes('win_50_games') && !slotNumbers.includes(4)) {
          availableSlots.push(4);
        }

        res.json({
          success: true,
          unlockedSlots: availableSlots.sort((a, b) => a - b),
          maxSlots: 15
        });
      });
    });
  } catch (error) {
    console.error('Get auction slots error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * POST /api/auction/slots/unlock
 * Unlock an auction slot
 */
router.post('/slots/unlock', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    const { slotNumber } = req.body;

    if (!slotNumber || slotNumber < 1 || slotNumber > 15) {
      return res.status(400).json({ success: false, message: 'Invalid slot number' });
    }

    // Slots 1 and 2 are always available
    if (slotNumber <= 2) {
      return res.status(400).json({ success: false, message: 'This slot is already available' });
    }

    const slotCost = AUCTION_SLOT_COSTS[slotNumber];
    if (!slotCost) {
      return res.status(400).json({ success: false, message: 'Invalid slot number' });
    }

    // Check if already unlocked
    db.get(`
      SELECT id FROM user_auction_slots WHERE user_id = ? AND slot_number = ?
    `, [userId, slotNumber], (err, existing) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error' });
      }
      if (existing) {
        return res.status(400).json({ success: false, message: 'Slot already unlocked' });
      }

      // Check requirements based on slot cost type
      if (slotCost.type === 'achievement') {
        db.get(`
          SELECT id FROM achievements
          WHERE user_id = ? AND achievement_id = ?
        `, [userId, slotCost.id], (err, achievement) => {
          if (err || !achievement) {
            return res.status(400).json({ success: false, message: 'Achievement requirement not met' });
          }

          // Unlock slot
          db.run(`
            INSERT INTO user_auction_slots (user_id, slot_number)
            VALUES (?, ?)
          `, [userId, slotNumber], (err) => {
            if (err) {
              return res.status(500).json({ success: false, message: 'Failed to unlock slot' });
            }

            res.json({ success: true, message: 'Slot unlocked' });
          });
        });
      } else if (slotCost.type === 'gold') {
        // Check and deduct gold
        db.get('SELECT gold FROM player_stats WHERE user_id = ?', [userId], (err, stats) => {
          if (err || !stats) {
            return res.status(500).json({ success: false, message: 'Database error' });
          }

          if (stats.gold < slotCost.amount) {
            return res.status(400).json({ success: false, message: `Not enough gold. Need ${slotCost.amount}` });
          }

          db.run(`
            UPDATE player_stats
            SET gold = gold - ?
            WHERE user_id = ?
          `, [slotCost.amount, userId], (err) => {
            if (err) {
              return res.status(500).json({ success: false, message: 'Failed to deduct gold' });
            }

            db.run(`
              INSERT INTO user_auction_slots (user_id, slot_number)
              VALUES (?, ?)
            `, [userId, slotNumber], (err) => {
              if (err) {
                return res.status(500).json({ success: false, message: 'Failed to unlock slot' });
              }

              res.json({ success: true, message: 'Slot unlocked' });
            });
          });
        });
      } else if (slotCost.type === 'gems') {
        // Check and deduct gems
        db.get('SELECT gems FROM player_stats WHERE user_id = ?', [userId], (err, stats) => {
          if (err || !stats) {
            return res.status(500).json({ success: false, message: 'Database error' });
          }

          if (stats.gems < slotCost.amount) {
            return res.status(400).json({ success: false, message: `Not enough gems. Need ${slotCost.amount}` });
          }

          db.run(`
            UPDATE player_stats
            SET gems = gems - ?
            WHERE user_id = ?
          `, [slotCost.amount, userId], (err) => {
            if (err) {
              return res.status(500).json({ success: false, message: 'Failed to deduct gems' });
            }

            db.run(`
              INSERT INTO user_auction_slots (user_id, slot_number)
              VALUES (?, ?)
            `, [userId, slotNumber], (err) => {
              if (err) {
                return res.status(500).json({ success: false, message: 'Failed to unlock slot' });
              }

              res.json({ success: true, message: 'Slot unlocked' });
            });
          });
        });
      }
    });
  } catch (error) {
    console.error('Unlock slot error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * GET /api/auction/listings
 * Get active auction listings
 */
router.get('/listings', authenticateToken, (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const itemType = req.query.itemType; // Optional filter

    let query = `
      SELECT 
        al.*,
        u.username as seller_username,
        ps.display_name as seller_display_name,
        u2.username as bidder_username
      FROM auction_listings al
      JOIN users u ON al.seller_id = u.id
      LEFT JOIN users u2 ON al.bidder_id = u2.id
      LEFT JOIN player_stats ps ON u.id = ps.user_id
      WHERE al.status = 'active' AND al.expires_at > datetime('now')
    `;

    const params = [];
    if (itemType) {
      query += ' AND al.item_type = ?';
      params.push(itemType);
    }

    query += ' ORDER BY al.created_at DESC LIMIT ?';
    params.push(limit);

    db.all(query, params, (err, listings) => {
      if (err) {
        console.error('Error fetching listings:', err);
        return res.status(500).json({ success: false, message: 'Database error' });
      }

      res.json({
        success: true,
        listings: listings || []
      });
    });
  } catch (error) {
    console.error('Get listings error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * POST /api/auction/list
 * List an item on the auction house
 */
router.post('/list', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    const { itemType, itemId, itemData, startingPrice, buyoutPrice, slotNumber, durationHours } = req.body;

    if (!itemType || !itemId || !startingPrice || !slotNumber) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Check if slot is available
    db.get(`
      SELECT slot_number FROM user_auction_slots WHERE user_id = ? AND slot_number = ?
      UNION SELECT 1 WHERE ? <= 2
      UNION SELECT 2 WHERE ? <= 2
    `, [userId, slotNumber, slotNumber, slotNumber], (err, slot) => {
      if (err || !slot) {
        return res.status(400).json({ success: false, message: 'Slot not unlocked' });
      }

      // Check if slot is already in use
      db.get(`
        SELECT id FROM auction_listings
        WHERE seller_id = ? AND slot_number = ? AND status = 'active'
      `, [userId, slotNumber], (err, existing) => {
        if (err) {
          return res.status(500).json({ success: false, message: 'Database error' });
        }
        if (existing) {
          return res.status(400).json({ success: false, message: 'Slot already in use' });
        }

        // Check minimum card limits if listing a card, then verify ownership
        if (itemType === 'card') {
          canSellOrSalvageCard(userId, itemId, (err, canSell) => {
            if (err) {
              return res.status(500).json({ success: false, message: 'Error checking card limits' });
            }
            if (!canSell) {
              return res.status(400).json({ 
                success: false, 
                message: 'Cannot list this card. You must maintain a minimum of 60 cards of each type (Ranged, Infantry, Cavalry).' 
              });
            }
            
            // Verify user owns the card
            verifyOwnership();
          });
        } else {
          verifyOwnership();
        }
        
        function verifyOwnership() {
          // Verify user owns the item
          if (itemType === 'card') {
          db.get(`
            SELECT quantity FROM user_cards
            WHERE user_id = ? AND card_id = ?
          `, [userId, itemId], (err, card) => {
            if (err || !card || card.quantity < 1) {
              return res.status(400).json({ success: false, message: 'You do not own this card' });
            }

            createListing();
          });
        } else if (itemType === 'booster_pack' || itemType === 'booster_box') {
          db.get(`
            SELECT quantity FROM unopened_products
            WHERE user_id = ? AND product_type = ? AND product_id = ?
          `, [userId, itemType, itemId], (err, product) => {
            if (err || !product || product.quantity < 1) {
              return res.status(400).json({ success: false, message: 'You do not own this product' });
            }

            createListing();
          });
        } else {
          return res.status(400).json({ success: false, message: 'Invalid item type' });
        }
        }

        function createListing() {
          const expiresAt = new Date();
          expiresAt.setHours(expiresAt.getHours() + (durationHours || 48));

          db.run(`
            INSERT INTO auction_listings (
              seller_id, item_type, item_id, item_data,
              starting_price, buyout_price, slot_number, expires_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            userId, itemType, itemId, JSON.stringify(itemData || {}),
            startingPrice, buyoutPrice || null, slotNumber, expiresAt.toISOString()
          ], function(err) {
            if (err) {
              console.error('Error creating listing:', err);
              return res.status(500).json({ success: false, message: 'Failed to create listing' });
            }

            // Remove item from user's inventory
            if (itemType === 'card') {
              db.run(`
                UPDATE user_cards
                SET quantity = quantity - 1
                WHERE user_id = ? AND card_id = ?
              `, [userId, itemId], () => {});
              
              // Update auction stats and check achievements
              db.run(`
                INSERT INTO auction_stats (user_id, cards_listed)
                VALUES (?, 1)
                ON CONFLICT(user_id) DO UPDATE SET cards_listed = cards_listed + 1, updated_at = CURRENT_TIMESTAMP
              `, [userId], (err) => {
                if (!err) {
                  // Get updated count and check achievements
                  db.get('SELECT cards_listed FROM auction_stats WHERE user_id = ?', [userId], (err, stats) => {
                    if (!err && stats) {
                      checkTieredAchievement(userId, 'list_card', stats.cards_listed, db);
                    }
                  });
                }
              });
            } else {
              db.run(`
                UPDATE unopened_products
                SET quantity = quantity - 1
                WHERE user_id = ? AND product_type = ? AND product_id = ?
              `, [userId, itemType, itemId], () => {});
            }

            res.json({
              success: true,
              message: 'Item listed successfully',
              listingId: this.lastID
            });
          });
        }
      });
    });
  } catch (error) {
    console.error('List item error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * POST /api/auction/bid
 * Place a bid on an auction
 */
router.post('/bid', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    const { listingId, bidAmount } = req.body;

    if (!listingId || !bidAmount) {
      return res.status(400).json({ success: false, message: 'Listing ID and bid amount required' });
    }

    // Get listing
    db.get(`
      SELECT * FROM auction_listings
      WHERE id = ? AND status = 'active' AND expires_at > datetime('now')
    `, [listingId], (err, listing) => {
      if (err || !listing) {
        return res.status(404).json({ success: false, message: 'Listing not found or expired' });
      }

      if (listing.seller_id === userId) {
        return res.status(400).json({ success: false, message: 'You cannot bid on your own listing' });
      }

      // Check bid amount
      const minBid = listing.current_bid ? listing.current_bid + 1 : listing.starting_price;
      if (bidAmount < minBid) {
        return res.status(400).json({ success: false, message: `Minimum bid is ${minBid}` });
      }

      // Check if buyout
      if (listing.buyout_price && bidAmount >= listing.buyout_price) {
        // Buyout - complete immediately
        completePurchase(listing.buyout_price, true);
        return;
      }

      // Check user has enough gold
      db.get('SELECT gold FROM player_stats WHERE user_id = ?', [userId], (err, stats) => {
        if (err || !stats) {
          return res.status(500).json({ success: false, message: 'Database error' });
        }

        // Refund previous bidder if exists
        if (listing.bidder_id && listing.current_bid) {
          db.run(`
            UPDATE player_stats
            SET gold = gold + ?
            WHERE user_id = ?
          `, [listing.current_bid, listing.bidder_id], () => {});
        }

        // Check if user has enough after refund
        const requiredGold = bidAmount - (listing.bidder_id === userId ? listing.current_bid : 0);
        if (stats.gold < requiredGold) {
          return res.status(400).json({ success: false, message: 'Not enough gold' });
        }

        // Deduct gold
        db.run(`
          UPDATE player_stats
          SET gold = gold - ?
          WHERE user_id = ?
        `, [requiredGold, userId], (err) => {
          if (err) {
            return res.status(500).json({ success: false, message: 'Failed to process bid' });
          }

          // Update listing
          db.run(`
            UPDATE auction_listings
            SET current_bid = ?, bidder_id = ?
            WHERE id = ?
          `, [bidAmount, userId, listingId], (err) => {
            if (err) {
              return res.status(500).json({ success: false, message: 'Failed to update listing' });
            }

            // Record bid
            db.run(`
              INSERT INTO auction_bids (listing_id, bidder_id, bid_amount)
              VALUES (?, ?, ?)
            `, [listingId, userId, bidAmount], () => {});

            res.json({
              success: true,
              message: 'Bid placed successfully'
            });
          });
        });
      });
    });

    function completePurchase(price, isBuyout) {
      db.get('SELECT gold FROM player_stats WHERE user_id = ?', [userId], (err, stats) => {
        if (err || !stats || stats.gold < price) {
          return res.status(400).json({ success: false, message: 'Not enough gold' });
        }

        // Deduct gold from buyer
        db.run(`
          UPDATE player_stats
          SET gold = gold - ?
          WHERE user_id = ?
        `, [price, userId], (err) => {
          if (err) {
            return res.status(500).json({ success: false, message: 'Failed to process purchase' });
          }

          // Give gold to seller
          db.run(`
            UPDATE player_stats
            SET gold = gold + ?
            WHERE user_id = ?
          `, [price, listing.seller_id], () => {});

          // Give item to buyer
          if (listing.item_type === 'card') {
            db.run(`
              INSERT INTO user_cards (user_id, card_id, quantity)
              VALUES (?, ?, 1)
              ON CONFLICT(user_id, card_id) DO UPDATE SET quantity = quantity + 1
            `, [userId, listing.item_id], () => {});
            
            // Update auction stats and check achievements for buyer
            db.run(`
              INSERT INTO auction_stats (user_id, cards_bought)
              VALUES (?, 1)
              ON CONFLICT(user_id) DO UPDATE SET cards_bought = cards_bought + 1, updated_at = CURRENT_TIMESTAMP
            `, [userId], (err) => {
              if (!err) {
                // Get updated count and check achievements
                db.get('SELECT cards_bought FROM auction_stats WHERE user_id = ?', [userId], (err, stats) => {
                  if (!err && stats) {
                    checkTieredAchievement(userId, 'buy_card', stats.cards_bought, db);
                  }
                });
              }
            });
          } else {
            db.run(`
              INSERT INTO unopened_products (user_id, product_type, product_id, quantity)
              VALUES (?, ?, ?, 1)
            `, [userId, listing.item_type, listing.item_id], () => {});
          }

          // Close listing
          db.run(`
            UPDATE auction_listings
            SET status = 'completed', current_bid = ?, bidder_id = ?
            WHERE id = ?
          `, [price, userId, listingId], () => {});

          res.json({
            success: true,
            message: isBuyout ? 'Item purchased' : 'Auction won'
          });
        });
      });
    }
  } catch (error) {
    console.error('Bid error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * POST /api/auction/cancel
 * Cancel your own listing
 */
router.post('/cancel', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    const { listingId } = req.body;

    db.get('SELECT * FROM auction_listings WHERE id = ? AND seller_id = ?', [listingId, userId], (err, listing) => {
      if (err || !listing) {
        return res.status(404).json({ success: false, message: 'Listing not found' });
      }

      if (listing.status !== 'active') {
        return res.status(400).json({ success: false, message: 'Listing is not active' });
      }

      // Refund bidder if exists
      if (listing.bidder_id && listing.current_bid) {
        db.run(`
          UPDATE player_stats
          SET gold = gold + ?
          WHERE user_id = ?
        `, [listing.current_bid, listing.bidder_id], () => {});
      }

      // Return item to seller
      if (listing.item_type === 'card') {
        db.run(`
          INSERT INTO user_cards (user_id, card_id, quantity)
          VALUES (?, ?, 1)
          ON CONFLICT(user_id, card_id) DO UPDATE SET quantity = quantity + 1
        `, [userId, listing.item_id], () => {});
      } else {
        db.run(`
          INSERT INTO unopened_products (user_id, product_type, product_id, quantity)
          VALUES (?, ?, ?, 1)
        `, [userId, listing.item_type, listing.item_id], () => {});
      }

      // Cancel listing
      db.run('UPDATE auction_listings SET status = "cancelled" WHERE id = ?', [listingId], (err) => {
        if (err) {
          return res.status(500).json({ success: false, message: 'Failed to cancel listing' });
        }

        res.json({ success: true, message: 'Listing cancelled' });
      });
    });
  } catch (error) {
    console.error('Cancel listing error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;

