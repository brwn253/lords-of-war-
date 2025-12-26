// ===== ALLIANCE ROUTES =====
const express = require('express');
const router = express.Router();
const { db } = require('./database');
const { authenticateToken } = require('./auth');

/**
 * GET /api/alliance
 * Get user's alliance information
 */
router.get('/', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;

    db.get(`
      SELECT 
        am.*,
        a.name as alliance_name,
        a.tag as alliance_tag,
        a.high_lord_id,
        u.username as liege_username,
        COUNT(DISTINCT b.id) as bannerman_count
      FROM alliance_members am
      LEFT JOIN alliances a ON am.alliance_id = a.id
      LEFT JOIN users u ON am.liege_id = u.id
      LEFT JOIN alliance_members b ON b.liege_id = am.user_id
      WHERE am.user_id = ?
      GROUP BY am.id
    `, [userId], (err, member) => {
      if (err) {
        console.error('Error fetching alliance:', err);
        return res.status(500).json({ success: false, message: 'Database error' });
      }

      if (!member) {
        return res.json({ success: true, alliance: null });
      }

      // Get all bannermen
      db.all(`
        SELECT 
          am.user_id,
          u.username,
          u.id,
          ps.display_name,
          ps.avatar_id
        FROM alliance_members am
        JOIN users u ON am.user_id = u.id
        LEFT JOIN player_stats ps ON u.id = ps.user_id
        WHERE am.liege_id = ?
      `, [userId], (err, bannermen) => {
        if (err) {
          console.error('Error fetching bannermen:', err);
          bannermen = [];
        }

        // Get all alliance members (for alliance chat)
        db.all(`
          SELECT 
            am.user_id,
            u.username,
            am.tier
          FROM alliance_members am
          JOIN users u ON am.user_id = u.id
          WHERE am.alliance_id = ?
          ORDER BY am.tier, u.username
        `, [member.alliance_id], (err, members) => {
          if (err) {
            console.error('Error fetching alliance members:', err);
            members = [];
          }

          res.json({
            success: true,
            alliance: {
              ...member,
              bannermen: bannermen || [],
              members: members || []
            }
          });
        });
      });
    });
  } catch (error) {
    console.error('Alliance error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * POST /api/alliance/create
 * Create a new alliance
 */
router.post('/create', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, tag } = req.body;

    if (!name || !tag) {
      return res.status(400).json({ success: false, message: 'Alliance name and tag are required' });
    }

    // Check if user is already in an alliance
    db.get('SELECT id FROM alliance_members WHERE user_id = ?', [userId], (err, existing) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error' });
      }
      if (existing) {
        return res.status(400).json({ success: false, message: 'You are already in an alliance' });
      }

      // Check if tag is taken
      db.get('SELECT id FROM alliances WHERE tag = ?', [tag], (err, existingTag) => {
        if (err) {
          return res.status(500).json({ success: false, message: 'Database error' });
        }
        if (existingTag) {
          return res.status(400).json({ success: false, message: 'Alliance tag already taken' });
        }

        // Create alliance
        db.run(`
          INSERT INTO alliances (name, tag, high_lord_id)
          VALUES (?, ?, ?)
        `, [name, tag, userId], function(err) {
          if (err) {
            console.error('Error creating alliance:', err);
            return res.status(500).json({ success: false, message: 'Failed to create alliance' });
          }

          const allianceId = this.lastID;

          // Add creator as high lord (tier 1)
          db.run(`
            INSERT INTO alliance_members (user_id, alliance_id, liege_id, tier)
            VALUES (?, ?, NULL, 1)
          `, [userId, allianceId], (err) => {
            if (err) {
              console.error('Error adding high lord:', err);
              return res.status(500).json({ success: false, message: 'Failed to create alliance' });
            }

            res.json({
              success: true,
              message: 'Alliance created successfully',
              allianceId: allianceId
            });
          });
        });
      });
    });
  } catch (error) {
    console.error('Create alliance error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * POST /api/alliance/apply
 * Apply to become a bannerman (swear fealty)
 */
router.post('/apply', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    const { liegeUsername } = req.body;

    if (!liegeUsername) {
      return res.status(400).json({ success: false, message: 'Liege username is required' });
    }

    // Find liege
    db.get('SELECT id FROM users WHERE username COLLATE NOCASE = ?', [liegeUsername], (err, liege) => {
      if (err || !liege) {
        return res.status(404).json({ success: false, message: 'Liege not found' });
      }

      if (liege.id === userId) {
        return res.status(400).json({ success: false, message: 'You cannot swear fealty to yourself' });
      }

      // Check if user is already in an alliance
      db.get('SELECT * FROM alliance_members WHERE user_id = ?', [userId], (err, existing) => {
        if (err) {
          return res.status(500).json({ success: false, message: 'Database error' });
        }
        if (existing) {
          return res.status(400).json({ success: false, message: 'You are already in an alliance' });
        }

        // Check if liege is in an alliance and can accept bannermen
        db.get(`
          SELECT am.*, a.id as alliance_id
          FROM alliance_members am
          JOIN alliances a ON am.alliance_id = a.id
          WHERE am.user_id = ?
        `, [liege.id], (err, liegeMember) => {
          if (err || !liegeMember) {
            return res.status(400).json({ success: false, message: 'Liege is not in an alliance' });
          }

          // Check if liege is tier 4 (can't accept bannermen)
          if (liegeMember.tier >= 4) {
            return res.status(400).json({ success: false, message: 'This player cannot accept more bannermen (tier limit)' });
          }

          // Check if liege already has 5 bannermen
          db.get(`
            SELECT COUNT(*) as count
            FROM alliance_members
            WHERE liege_id = ?
          `, [liege.id], (err, result) => {
            if (err) {
              return res.status(500).json({ success: false, message: 'Database error' });
            }
            if (result.count >= 5) {
              return res.status(400).json({ success: false, message: 'This player already has 5 bannermen' });
            }

            // Create fealty request
            db.run(`
              INSERT OR IGNORE INTO fealty_requests (requester_id, liege_id)
              VALUES (?, ?)
            `, [userId, liege.id], function(err) {
              if (err) {
                console.error('Error creating fealty request:', err);
                return res.status(500).json({ success: false, message: 'Failed to create request' });
              }

              if (this.changes === 0) {
                return res.status(400).json({ success: false, message: 'Request already exists' });
              }

              res.json({
                success: true,
                message: 'Fealty request sent'
              });
            });
          });
        });
      });
    });
  } catch (error) {
    console.error('Apply fealty error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * GET /api/alliance/requests
 * Get pending fealty requests (as liege)
 */
router.get('/requests', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;

    db.all(`
      SELECT 
        fr.id,
        fr.requester_id,
        fr.status,
        fr.created_at,
        u.username as requester_username,
        ps.display_name,
        ps.avatar_id
      FROM fealty_requests fr
      JOIN users u ON fr.requester_id = u.id
      LEFT JOIN player_stats ps ON u.id = ps.user_id
      WHERE fr.liege_id = ? AND fr.status = 'pending'
      ORDER BY fr.created_at DESC
    `, [userId], (err, requests) => {
      if (err) {
        console.error('Error fetching fealty requests:', err);
        return res.status(500).json({ success: false, message: 'Database error' });
      }

      res.json({
        success: true,
        requests: requests || []
      });
    });
  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * POST /api/alliance/requests/:requestId/accept
 * Accept a fealty request
 */
router.post('/requests/:requestId/accept', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    const requestId = parseInt(req.params.requestId);

    // Get the request
    db.get(`
      SELECT fr.*, am.alliance_id, am.tier as liege_tier
      FROM fealty_requests fr
      JOIN alliance_members am ON am.user_id = fr.liege_id
      WHERE fr.id = ? AND fr.liege_id = ? AND fr.status = 'pending'
    `, [requestId, userId], (err, request) => {
      if (err || !request) {
        return res.status(404).json({ success: false, message: 'Request not found' });
      }

      // Check if liege can accept (not tier 4, less than 5 bannermen)
      if (request.liege_tier >= 4) {
        return res.status(400).json({ success: false, message: 'You cannot accept more bannermen (tier limit)' });
      }

      db.get(`
        SELECT COUNT(*) as count
        FROM alliance_members
        WHERE liege_id = ?
      `, [userId], (err, result) => {
        if (err) {
          return res.status(500).json({ success: false, message: 'Database error' });
        }
        if (result.count >= 5) {
          return res.status(400).json({ success: false, message: 'You already have 5 bannermen' });
        }

        // Calculate new tier (liege tier + 1)
        const newTier = request.liege_tier + 1;
        if (newTier > 4) {
          return res.status(400).json({ success: false, message: 'Cannot exceed tier 4' });
        }

        // Add to alliance
        db.run(`
          INSERT INTO alliance_members (user_id, alliance_id, liege_id, tier)
          VALUES (?, ?, ?, ?)
        `, [request.requester_id, request.alliance_id, userId, newTier], (err) => {
          if (err) {
            console.error('Error adding bannerman:', err);
            return res.status(500).json({ success: false, message: 'Failed to accept request' });
          }

          // Update request status
          db.run(`
            UPDATE fealty_requests
            SET status = 'accepted', responded_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [requestId], () => {});

          res.json({
            success: true,
            message: 'Fealty request accepted'
          });
        });
      });
    });
  } catch (error) {
    console.error('Accept request error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * POST /api/alliance/requests/:requestId/reject
 * Reject a fealty request
 */
router.post('/requests/:requestId/reject', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    const requestId = parseInt(req.params.requestId);

    db.run(`
      UPDATE fealty_requests
      SET status = 'rejected', responded_at = CURRENT_TIMESTAMP
      WHERE id = ? AND liege_id = ? AND status = 'pending'
    `, [requestId, userId], function(err) {
      if (err) {
        console.error('Error rejecting request:', err);
        return res.status(500).json({ success: false, message: 'Database error' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ success: false, message: 'Request not found' });
      }

      res.json({
        success: true,
        message: 'Fealty request rejected'
      });
    });
  } catch (error) {
    console.error('Reject request error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * POST /api/alliance/leave
 * Leave current alliance
 */
router.post('/leave', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;

    // Check if user has bannermen
    db.get(`
      SELECT COUNT(*) as count
      FROM alliance_members
      WHERE liege_id = ?
    `, [userId], (err, result) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error' });
      }

      if (result.count > 0) {
        return res.status(400).json({ success: false, message: 'You must release all bannermen before leaving' });
      }

      // Check if user is high lord
      db.get(`
        SELECT a.id as alliance_id
        FROM alliances a
        JOIN alliance_members am ON a.id = am.alliance_id
        WHERE am.user_id = ? AND a.high_lord_id = ?
      `, [userId, userId], (err, alliance) => {
        if (err) {
          return res.status(500).json({ success: false, message: 'Database error' });
        }

        if (alliance) {
          // High lord leaving - delete alliance or transfer
          // For now, just prevent leaving
          return res.status(400).json({ success: false, message: 'High lord cannot leave alliance. Transfer leadership first.' });
        }

        // Remove from alliance
        db.run('DELETE FROM alliance_members WHERE user_id = ?', [userId], function(err) {
          if (err) {
            console.error('Error leaving alliance:', err);
            return res.status(500).json({ success: false, message: 'Failed to leave alliance' });
          }

          res.json({
            success: true,
            message: 'Left alliance successfully'
          });
        });
      });
    });
  } catch (error) {
    console.error('Leave alliance error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;

