// ===== PROFILE ROUTES =====
const express = require('express');
const router = express.Router();
const { db } = require('./database');
const { authenticateToken } = require('./auth');

/**
 * GET /api/profile/:userId
 * Fetch user profile and stats
 * Requires: Auth token
 */
router.get('/:userId', authenticateToken, (req, res) => {
  try {
    const { userId } = req.params;

    // Verify user is requesting their own profile or has permission
    if (req.user.userId !== parseInt(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Cannot access other user profiles'
      });
    }

    // Query user and stats
    db.get(
      `SELECT
        u.id,
        u.username,
        u.email,
        u.created_at,
        ps.total_wins,
        ps.total_losses,
        ps.level,
        ps.current_rank,
        ps.gold,
        ps.gems,
        ps.display_name,
        ps.avatar_id,
        ps.bio,
        ps.preferred_unit_type,
        ps.xp,
        ps.xp_to_next_level
      FROM users u
      LEFT JOIN player_stats ps ON u.id = ps.user_id
      WHERE u.id = ?`,
      [userId],
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
            message: 'User not found'
          });
        }

        // Calculate win rate
        const games = (row.total_wins || 0) + (row.total_losses || 0);
        const winRate = games > 0 ? ((row.total_wins || 0) / games * 100).toFixed(1) : 0;

        res.json({
          success: true,
          profile: {
            userId: row.id,
            username: row.username,
            email: row.email,
            createdAt: row.created_at,
            displayName: row.display_name || row.username,
            bio: row.bio || '',
            avatarId: row.avatar_id || 1,
            preferredUnitType: row.preferred_unit_type || null
          },
          stats: {
            wins: row.total_wins || 0,
            losses: row.total_losses || 0,
            gamesPlayed: games,
            winRate: parseFloat(winRate),
            level: row.level || 1,
            rank: row.current_rank || 'Unranked',
            gold: row.gold || 0,
            gems: row.gems || 0,
            xp: row.xp || 0,
            xpToNextLevel: row.xp_to_next_level || 100
          }
        });
      }
    );
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * PUT /api/profile/:userId
 * Update user profile
 * Requires: Auth token, user ownership verification
 */
router.put('/:userId', authenticateToken, (req, res) => {
  try {
    const { userId } = req.params;
    const { displayName, bio, avatarId, preferredUnitType } = req.body;

    // Verify user is updating their own profile
    if (req.user.userId !== parseInt(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Cannot update other user profiles'
      });
    }

    // Validation
    if (displayName && (displayName.length < 1 || displayName.length > 50)) {
      return res.status(400).json({
        success: false,
        message: 'Display name must be 1-50 characters'
      });
    }

    if (bio && bio.length > 200) {
      return res.status(400).json({
        success: false,
        message: 'Bio must be 200 characters or less'
      });
    }

    if (avatarId && (avatarId < 1 || avatarId > 8)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid avatar ID (must be 1-8)'
      });
    }

    if (preferredUnitType && !['ranged', 'infantry', 'cavalry'].includes(preferredUnitType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid unit type'
      });
    }

    // Build update query
    const updates = [];
    const values = [];

    if (displayName !== undefined) {
      updates.push('display_name = ?');
      values.push(displayName);
    }

    if (bio !== undefined) {
      updates.push('bio = ?');
      values.push(bio);
    }

    if (avatarId !== undefined) {
      updates.push('avatar_id = ?');
      values.push(avatarId);
    }

    if (preferredUnitType !== undefined) {
      updates.push('preferred_unit_type = ?');
      values.push(preferredUnitType);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    values.push(userId);

    // Execute update
    db.run(
      `UPDATE player_stats SET ${updates.join(', ')} WHERE user_id = ?`,
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
            message: 'User not found'
          });
        }

        res.json({
          success: true,
          message: 'Profile updated successfully'
        });
      }
    );
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * GET /api/profile/:userId/match-history
 * Fetch user's match history
 * Requires: Auth token
 */
router.get('/:userId/match-history', authenticateToken, (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 20; // Default to 20 matches

    // Verify user is requesting their own match history
    if (req.user.userId !== parseInt(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Cannot access other user match history'
      });
    }

    // Query match history
    db.all(
      `SELECT 
        id,
        opponent_name,
        result,
        duration,
        deck_used_id,
        game_mode,
        created_at
      FROM match_history
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?`,
      [userId, limit],
      (err, rows) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({
            success: false,
            message: 'Database error occurred'
          });
        }

        res.json({
          success: true,
          matches: rows || []
        });
      }
    );
  } catch (error) {
    console.error('Match history error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/profile/:userId/match-history
 * Record a new match
 * Requires: Auth token
 */
router.post('/:userId/match-history', authenticateToken, (req, res) => {
  try {
    const { userId } = req.params;
    const { opponent_name, result, duration, deck_used_id, game_mode } = req.body;

    // Verify user is recording their own match
    if (req.user.userId !== parseInt(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // Validation
    if (!opponent_name || !result || !game_mode) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Insert match history
    db.run(
      'INSERT INTO match_history (user_id, opponent_name, result, duration, deck_used_id, game_mode) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, opponent_name, result, duration || null, deck_used_id || null, game_mode],
      function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({
            success: false,
            message: 'Failed to save match history'
          });
        }

        // Calculate and award XP
        const { calculateXP, awardXP } = require('./game-server');
        const xpGained = calculateXP(result, duration || 0, game_mode || 'singleplayer');
        awardXP(userId, xpGained, db);
        
        // Update deck stats if deck was used
        if (deck_used_id) {
          if (result === 'win') {
            db.run('UPDATE deck_presets SET wins = wins + 1, last_used = CURRENT_TIMESTAMP WHERE id = ?', [deck_used_id]);
          } else if (result === 'loss') {
            db.run('UPDATE deck_presets SET losses = losses + 1, last_used = CURRENT_TIMESTAMP WHERE id = ?', [deck_used_id]);
          }
        }

        // Update player stats
        if (result === 'win') {
          db.run('UPDATE player_stats SET total_wins = total_wins + 1 WHERE user_id = ?', [userId]);
        } else if (result === 'loss') {
          db.run('UPDATE player_stats SET total_losses = total_losses + 1 WHERE user_id = ?', [userId]);
        }

        res.json({
          success: true,
          matchId: this.lastID
        });
      }
    );
  } catch (error) {
    console.error('Save match history error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/profile/:userId/achievements
 * Fetch user's achievements
 * Requires: Auth token
 */
router.get('/:userId/achievements', authenticateToken, (req, res) => {
  try {
    const { userId } = req.params;

    // Verify user is requesting their own achievements
    if (req.user.userId !== parseInt(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // Query achievements
    db.all(
      'SELECT achievement_id, unlocked_at FROM achievements WHERE user_id = ? ORDER BY unlocked_at DESC',
      [userId],
      (err, rows) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({
            success: false,
            message: 'Database error occurred'
          });
        }

        res.json({
          success: true,
          achievements: rows || []
        });
      }
    );
  } catch (error) {
    console.error('Achievements error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/profile/:userId/notifications
 * Fetch user's notifications
 * Requires: Auth token
 */
router.get('/:userId/notifications', authenticateToken, (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 20;
    const unreadOnly = req.query.unreadOnly === 'true';

    // Verify user is requesting their own notifications
    if (req.user.userId !== parseInt(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    let query = 'SELECT id, type, title, message, read, created_at FROM notifications WHERE user_id = ?';
    const params = [userId];

    if (unreadOnly) {
      query += ' AND read = 0';
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    db.all(query, params, (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({
          success: false,
          message: 'Database error occurred'
        });
      }

      res.json({
        success: true,
        notifications: rows || [],
        unreadCount: 0 // Will be calculated separately if needed
      });
    });
  } catch (error) {
    console.error('Notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * PUT /api/profile/:userId/notifications/:notificationId/read
 * Mark notification as read
 * Requires: Auth token
 */
router.put('/:userId/notifications/:notificationId/read', authenticateToken, (req, res) => {
  try {
    const { userId, notificationId } = req.params;

    // Verify user owns this notification
    if (req.user.userId !== parseInt(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    db.run(
      'UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?',
      [notificationId, userId],
      function(err) {
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
            message: 'Notification not found'
          });
        }

        res.json({
          success: true,
          message: 'Notification marked as read'
        });
      }
    );
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * PUT /api/profile/:userId/notifications/read-all
 * Mark all notifications as read
 * Requires: Auth token
 */
router.put('/:userId/notifications/read-all', authenticateToken, (req, res) => {
  try {
    const { userId } = req.params;

    // Verify user owns these notifications
    if (req.user.userId !== parseInt(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    db.run(
      'UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0',
      [userId],
      function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({
            success: false,
            message: 'Database error occurred'
          });
        }

        res.json({
          success: true,
          message: `Marked ${this.changes} notifications as read`
        });
      }
    );
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;
