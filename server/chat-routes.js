// ===== CHAT ROUTES =====
const express = require('express');
const router = express.Router();
const { db } = require('./database');
const { authenticateToken } = require('./auth');

/**
 * GET /api/chat/global
 * Get recent global chat messages
 */
router.get('/global', authenticateToken, (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;

    db.all(`
      SELECT 
        gc.id,
        gc.user_id,
        gc.username,
        gc.message,
        gc.created_at,
        ps.display_name,
        ps.avatar_id
      FROM global_chat gc
      LEFT JOIN player_stats ps ON gc.user_id = ps.user_id
      ORDER BY gc.created_at DESC
      LIMIT ?
    `, [limit], (err, messages) => {
      if (err) {
        console.error('Error fetching global chat:', err);
        return res.status(500).json({ success: false, message: 'Database error' });
      }

      res.json({
        success: true,
        messages: (messages || []).reverse() // Reverse to show oldest first
      });
    });
  } catch (error) {
    console.error('Global chat error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * POST /api/chat/global
 * Send a global chat message
 */
router.post('/global', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    const { message } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Message cannot be empty' });
    }

    if (message.length > 500) {
      return res.status(400).json({ success: false, message: 'Message too long (max 500 characters)' });
    }

    // Get username
    db.get('SELECT username FROM users WHERE id = ?', [userId], (err, user) => {
      if (err || !user) {
        return res.status(500).json({ success: false, message: 'Database error' });
      }

      // Insert message
      db.run(`
        INSERT INTO global_chat (user_id, username, message)
        VALUES (?, ?, ?)
      `, [userId, user.username, message.trim()], function(err) {
        if (err) {
          console.error('Error sending global chat:', err);
          return res.status(500).json({ success: false, message: 'Failed to send message' });
        }

        // Clean old messages (keep last 1000)
        db.run(`
          DELETE FROM global_chat
          WHERE id NOT IN (
            SELECT id FROM global_chat
            ORDER BY created_at DESC
            LIMIT 1000
          )
        `, () => {});

        res.json({
          success: true,
          message: 'Message sent',
          messageId: this.lastID
        });
      });
    });
  } catch (error) {
    console.error('Send global chat error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * GET /api/chat/alliance
 * Get recent alliance chat messages
 */
router.get('/alliance', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    const limit = parseInt(req.query.limit) || 50;

    // Get user's alliance
    db.get(`
      SELECT alliance_id
      FROM alliance_members
      WHERE user_id = ?
    `, [userId], (err, member) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error' });
      }

      if (!member) {
        return res.json({ success: true, messages: [] });
      }

      db.all(`
        SELECT 
          ac.id,
          ac.user_id,
          ac.username,
          ac.message,
          ac.created_at,
          ps.display_name,
          ps.avatar_id
        FROM alliance_chat ac
        LEFT JOIN player_stats ps ON ac.user_id = ps.user_id
        WHERE ac.alliance_id = ?
        ORDER BY ac.created_at DESC
        LIMIT ?
      `, [member.alliance_id, limit], (err, messages) => {
        if (err) {
          console.error('Error fetching alliance chat:', err);
          return res.status(500).json({ success: false, message: 'Database error' });
        }

        res.json({
          success: true,
          messages: (messages || []).reverse()
        });
      });
    });
  } catch (error) {
    console.error('Alliance chat error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * POST /api/chat/alliance
 * Send an alliance chat message
 */
router.post('/alliance', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    const { message } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Message cannot be empty' });
    }

    if (message.length > 500) {
      return res.status(400).json({ success: false, message: 'Message too long (max 500 characters)' });
    }

    // Get user's alliance
    db.get(`
      SELECT alliance_id
      FROM alliance_members
      WHERE user_id = ?
    `, [userId], (err, member) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error' });
      }

      if (!member) {
        return res.status(400).json({ success: false, message: 'You are not in an alliance' });
      }

      // Get username
      db.get('SELECT username FROM users WHERE id = ?', [userId], (err, user) => {
        if (err || !user) {
          return res.status(500).json({ success: false, message: 'Database error' });
        }

        // Insert message
        db.run(`
          INSERT INTO alliance_chat (user_id, alliance_id, username, message)
          VALUES (?, ?, ?, ?)
        `, [userId, member.alliance_id, user.username, message.trim()], function(err) {
          if (err) {
            console.error('Error sending alliance chat:', err);
            return res.status(500).json({ success: false, message: 'Failed to send message' });
          }

          // Clean old messages (keep last 500 per alliance)
          db.run(`
            DELETE FROM alliance_chat
            WHERE alliance_id = ? AND id NOT IN (
              SELECT id FROM alliance_chat
              WHERE alliance_id = ?
              ORDER BY created_at DESC
              LIMIT 500
            )
          `, [member.alliance_id, member.alliance_id], () => {});

          res.json({
            success: true,
            message: 'Message sent',
            messageId: this.lastID
          });
        });
      });
    });
  } catch (error) {
    console.error('Send alliance chat error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;

