// ===== DECK PRESET ROUTES =====
const express = require('express');
const router = express.Router();
const { db } = require('./database');
const { authenticateToken } = require('./auth');

/**
 * GET /api/deck/:userId
 * Fetch all deck presets for a user
 * Requires: Auth token
 */
router.get('/:userId', authenticateToken, (req, res) => {
  try {
    const { userId } = req.params;

    // Verify user is requesting their own decks
    if (req.user.userId !== parseInt(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Cannot access other user decks'
      });
    }

    // Query all deck presets
    db.all(
      `SELECT id, deck_name, hero_id, hero_unit_type, card_list, created_at, updated_at
       FROM deck_presets
       WHERE user_id = ?
       ORDER BY updated_at DESC`,
      [userId],
      (err, rows) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({
            success: false,
            message: 'Database error occurred'
          });
        }

        const decks = rows.map(row => ({
          id: row.id,
          deckName: row.deck_name,
          heroId: row.hero_id,
          heroUnitType: row.hero_unit_type,
          cardList: row.card_list ? JSON.parse(row.card_list) : [],
          createdAt: row.created_at,
          updatedAt: row.updated_at
        }));

        res.json({
          success: true,
          decks
        });
      }
    );
  } catch (error) {
    console.error('Error fetching decks:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * POST /api/deck/:userId
 * Create a new deck preset
 * Requires: Auth token
 */
router.post('/:userId', authenticateToken, (req, res) => {
  console.log('[DECK ROUTES] POST /:userId hit', req.params, req.body);
  try {
    const { userId } = req.params;
    const { deckName, heroId, heroUnitType, cardList } = req.body;
    
    console.log('[DECK ROUTES] Creating deck:', { userId, deckName, heroId, heroUnitType, cardListLength: cardList?.length });

    // Verify user is creating their own deck
    if (req.user.userId !== parseInt(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Cannot create decks for other users'
      });
    }

    // Validation
    if (!deckName || deckName.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Deck name is required'
      });
    }

    if (deckName.length > 50) {
      return res.status(400).json({
        success: false,
        message: 'Deck name must be 50 characters or less'
      });
    }

    if (!heroId || !heroUnitType) {
      return res.status(400).json({
        success: false,
        message: 'Hero ID and unit type are required'
      });
    }

    const validTypes = ['ranged', 'infantry', 'cavalry'];
    if (!validTypes.includes(heroUnitType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid hero unit type'
      });
    }

    if (!Array.isArray(cardList)) {
      return res.status(400).json({
        success: false,
        message: 'cardList must be an array'
      });
    }

    if (cardList.length !== 60) {
      return res.status(400).json({
        success: false,
        message: 'Deck must contain exactly 60 cards'
      });
    }

    // Store card list as JSON string
    const cardListJson = JSON.stringify(cardList);

    // Insert deck preset
    db.run(
      `INSERT INTO deck_presets (user_id, deck_name, hero_id, hero_unit_type, card_list, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [userId, deckName.trim(), heroId, heroUnitType, cardListJson],
      function (err) {
        if (err) {
          console.error('Database error:', err);
          console.error('Error details:', err.message, err.code);
          return res.status(500).json({
            success: false,
            message: 'Database error occurred: ' + err.message
          });
        }

        console.log(`[DECK] Created deck preset: ${deckName} for user ${userId}, ID: ${this.lastID}`);

        res.json({
          success: true,
          message: 'Deck preset created successfully',
          deck: {
            id: this.lastID,
            deckName: deckName.trim(),
            heroId,
            heroUnitType,
            cardList
          }
        });
      }
    );
  } catch (error) {
    console.error('Error creating deck:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * GET /api/deck/:userId/:deckId
 * Fetch a specific deck preset
 * Requires: Auth token
 */
router.get('/:userId/:deckId', authenticateToken, (req, res) => {
  try {
    const { userId, deckId } = req.params;

    // Verify user is requesting their own deck
    if (req.user.userId !== parseInt(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Cannot access other user decks'
      });
    }

    // Query deck preset
    db.get(
      `SELECT id, deck_name, hero_id, hero_unit_type, card_list, created_at, updated_at
       FROM deck_presets
       WHERE id = ? AND user_id = ?`,
      [deckId, userId],
      (err, row) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({
            success: false,
            message: 'Database error occurred'
          });
        }

        if (!row) {
          return res.status(404).json({
            success: false,
            message: 'Deck not found'
          });
        }

        res.json({
          success: true,
          deck: {
            id: row.id,
            deckName: row.deck_name,
            heroId: row.hero_id,
            heroUnitType: row.hero_unit_type,
            cardList: row.card_list ? JSON.parse(row.card_list) : [],
            createdAt: row.created_at,
            updatedAt: row.updated_at
          }
        });
      }
    );
  } catch (error) {
    console.error('Error fetching deck:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * PUT /api/deck/:userId/:deckId
 * Update an existing deck preset
 * Requires: Auth token
 */
router.put('/:userId/:deckId', authenticateToken, (req, res) => {
  try {
    const { userId, deckId } = req.params;
    const { deckName, cardList } = req.body;

    // Verify user is updating their own deck
    if (req.user.userId !== parseInt(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Cannot update other user decks'
      });
    }

    // Build update query
    const updates = [];
    const values = [];

    if (deckName !== undefined) {
      if (deckName.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Deck name cannot be empty'
        });
      }
      if (deckName.length > 50) {
        return res.status(400).json({
          success: false,
          message: 'Deck name must be 50 characters or less'
        });
      }
      updates.push('deck_name = ?');
      values.push(deckName.trim());
    }

    if (cardList !== undefined) {
      if (!Array.isArray(cardList)) {
        return res.status(400).json({
          success: false,
          message: 'cardList must be an array'
        });
      }
      if (cardList.length !== 60) {
        return res.status(400).json({
          success: false,
          message: 'Deck must contain exactly 60 cards'
        });
      }
      updates.push('card_list = ?');
      values.push(JSON.stringify(cardList));
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(deckId, userId);

    // Execute update
    db.run(
      `UPDATE deck_presets SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
      values,
      function (err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({
            success: false,
            message: 'Database error occurred'
          });
        }

        if (this.changes === 0) {
          return res.status(404).json({
            success: false,
            message: 'Deck not found'
          });
        }

        res.json({
          success: true,
          message: 'Deck preset updated successfully'
        });
      }
    );
  } catch (error) {
    console.error('Error updating deck:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * DELETE /api/deck/:userId/:deckId
 * Delete a deck preset
 * Requires: Auth token
 */
router.delete('/:userId/:deckId', authenticateToken, (req, res) => {
  try {
    const { userId, deckId } = req.params;

    // Verify user is deleting their own deck
    if (req.user.userId !== parseInt(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Cannot delete other user decks'
      });
    }

    // Delete deck preset
    db.run(
      `DELETE FROM deck_presets WHERE id = ? AND user_id = ?`,
      [deckId, userId],
      function (err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({
            success: false,
            message: 'Database error occurred'
          });
        }

        if (this.changes === 0) {
          return res.status(404).json({
            success: false,
            message: 'Deck not found'
          });
        }

        res.json({
          success: true,
          message: 'Deck preset deleted successfully'
        });
      }
    );
  } catch (error) {
    console.error('Error deleting deck:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Log registered routes for debugging
console.log('[DECK ROUTES] Routes registered:');
console.log('  GET    /:userId');
console.log('  GET    /:userId/:deckId');
console.log('  POST   /:userId');
console.log('  PUT    /:userId/:deckId');
console.log('  DELETE /:userId/:deckId');

/**
 * PUT /api/deck/:userId/:deckId/rename
 * Rename a deck preset
 * Requires: Auth token
 */
router.put('/:userId/:deckId/rename', authenticateToken, (req, res) => {
  try {
    const { userId, deckId } = req.params;
    const { newName } = req.body;

    // Verify user owns this deck
    if (req.user.userId !== parseInt(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    if (!newName || newName.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Deck name is required'
      });
    }

    if (newName.length > 50) {
      return res.status(400).json({
        success: false,
        message: 'Deck name must be 50 characters or less'
      });
    }

    // Check if name already exists for this user
    db.get(
      'SELECT id FROM deck_presets WHERE user_id = ? AND deck_name = ? AND id != ?',
      [userId, newName.trim(), deckId],
      (err, existing) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({
            success: false,
            message: 'Database error occurred'
          });
        }

        if (existing) {
          return res.status(400).json({
            success: false,
            message: 'A deck with this name already exists'
          });
        }

        // Update deck name
        db.run(
          'UPDATE deck_presets SET deck_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
          [newName.trim(), deckId, userId],
          function(err) {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({
                success: false,
                message: 'Failed to rename deck'
              });
            }

            if (this.changes === 0) {
              return res.status(404).json({
                success: false,
                message: 'Deck not found'
              });
            }

            res.json({
              success: true,
              message: 'Deck renamed successfully',
              deckName: newName.trim()
            });
          }
        );
      }
    );
  } catch (error) {
    console.error('Rename deck error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * POST /api/deck/:userId/:deckId/copy
 * Copy a deck preset
 * Requires: Auth token
 */
router.post('/:userId/:deckId/copy', authenticateToken, (req, res) => {
  try {
    const { userId, deckId } = req.params;
    const { newName } = req.body;

    // Verify user owns this deck
    if (req.user.userId !== parseInt(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // Get original deck
    db.get(
      'SELECT deck_name, hero_id, hero_unit_type, card_list FROM deck_presets WHERE id = ? AND user_id = ?',
      [deckId, userId],
      (err, deck) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({
            success: false,
            message: 'Database error occurred'
          });
        }

        if (!deck) {
          return res.status(404).json({
            success: false,
            message: 'Deck not found'
          });
        }

        // Generate new name if not provided
        const copyName = newName && newName.trim() ? newName.trim() : `${deck.deck_name} (Copy)`;

        // Check if name already exists
        db.get(
          'SELECT id FROM deck_presets WHERE user_id = ? AND deck_name = ?',
          [userId, copyName],
          (err, existing) => {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({
                success: false,
                message: 'Database error occurred'
              });
            }

            if (existing) {
              // Append number if name exists
              let finalName = copyName;
              let counter = 1;
              const checkName = () => {
                db.get(
                  'SELECT id FROM deck_presets WHERE user_id = ? AND deck_name = ?',
                  [userId, finalName],
                  (err, exists) => {
                    if (err) {
                      return res.status(500).json({
                        success: false,
                        message: 'Database error occurred'
                      });
                    }
                    if (exists) {
                      finalName = `${copyName} (${counter})`;
                      counter++;
                      checkName();
                    } else {
                      createCopy(finalName);
                    }
                  }
                );
              };

              const createCopy = (name) => {
                db.run(
                  'INSERT INTO deck_presets (user_id, deck_name, hero_id, hero_unit_type, card_list) VALUES (?, ?, ?, ?, ?)',
                  [userId, name, deck.hero_id, deck.hero_unit_type, deck.card_list],
                  function(err) {
                    if (err) {
                      console.error('Database error:', err);
                      return res.status(500).json({
                        success: false,
                        message: 'Failed to copy deck'
                      });
                    }

                    res.json({
                      success: true,
                      message: 'Deck copied successfully',
                      deckId: this.lastID,
                      deckName: name
                    });
                  }
                );
              };

              checkName();
            } else {
              // Name is available, create copy
              db.run(
                'INSERT INTO deck_presets (user_id, deck_name, hero_id, hero_unit_type, card_list) VALUES (?, ?, ?, ?, ?)',
                [userId, copyName, deck.hero_id, deck.hero_unit_type, deck.card_list],
                function(err) {
                  if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({
                      success: false,
                      message: 'Failed to copy deck'
                    });
                  }

                  res.json({
                    success: true,
                    message: 'Deck copied successfully',
                    deckId: this.lastID,
                    deckName: copyName
                  });
                }
              );
            }
          }
        );
      }
    );
  } catch (error) {
    console.error('Copy deck error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
