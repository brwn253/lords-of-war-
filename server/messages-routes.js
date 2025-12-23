// ===== MESSAGES ROUTES =====
const express = require('express');
const router = express.Router();
const { db } = require('./database');
const { authenticateToken } = require('./auth');

/**
 * GET /api/messages
 * Get user's messages (inbox)
 * Requires: Auth token
 */
router.get('/', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    const limit = parseInt(req.query.limit) || 50;
    const unreadOnly = req.query.unreadOnly === 'true';

    let query = `
      SELECT 
        m.id,
        m.sender_id,
        m.recipient_id,
        m.subject,
        m.body,
        m.read,
        m.created_at,
        u.username as sender_username
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.recipient_id = ?
    `;
    const params = [userId];

    if (unreadOnly) {
      query += ' AND m.read = 0';
    }

    query += ' ORDER BY m.created_at DESC LIMIT ?';
    params.push(limit);

    db.all(query, params, (err, messages) => {
      if (err) {
        console.error('Error fetching messages:', err);
        return res.status(500).json({
          success: false,
          message: 'Database error occurred'
        });
      }

      res.json({
        success: true,
        messages: messages || []
      });
    });
  } catch (error) {
    console.error('Messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/messages/sent
 * Get messages sent by user
 * Requires: Auth token
 */
router.get('/sent', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    const limit = parseInt(req.query.limit) || 50;

    db.all(
      `SELECT 
        m.id,
        m.sender_id,
        m.recipient_id,
        m.subject,
        m.body,
        m.read,
        m.created_at,
        u.username as recipient_username
      FROM messages m
      JOIN users u ON m.recipient_id = u.id
      WHERE m.sender_id = ?
      ORDER BY m.created_at DESC
      LIMIT ?`,
      [userId, limit],
      (err, messages) => {
        if (err) {
          console.error('Error fetching sent messages:', err);
          return res.status(500).json({
            success: false,
            message: 'Database error occurred'
          });
        }

        res.json({
          success: true,
          messages: messages || []
        });
      }
    );
  } catch (error) {
    console.error('Sent messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/messages
 * Send a message
 * Requires: Auth token
 */
router.post('/', authenticateToken, (req, res) => {
  try {
    const senderId = req.user.userId;
    const { recipientUsername, subject, body } = req.body;

    if (!recipientUsername || !body) {
      return res.status(400).json({
        success: false,
        message: 'Recipient username and message body are required'
      });
    }

    if (body.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message body cannot be empty'
      });
    }

    // Find recipient user
    db.get(
      'SELECT id, username FROM users WHERE username COLLATE NOCASE = ?',
      [recipientUsername],
      (err, recipient) => {
        if (err) {
          console.error('Error finding recipient:', err);
          return res.status(500).json({
            success: false,
            message: 'Database error occurred'
          });
        }

        if (!recipient) {
          return res.status(404).json({
            success: false,
            message: 'Recipient user not found'
          });
        }

        if (recipient.id === senderId) {
          return res.status(400).json({
            success: false,
            message: 'You cannot send a message to yourself'
          });
        }

        // Check if sender is blocked by recipient
        db.get(
          'SELECT id FROM blocked_users WHERE user_id = ? AND blocked_user_id = ?',
          [recipient.id, senderId],
          (err, blocked) => {
            if (err) {
              console.error('Error checking blocked users:', err);
              return res.status(500).json({
                success: false,
                message: 'Database error occurred'
              });
            }

            if (blocked) {
              return res.status(403).json({
                success: false,
                message: 'You cannot send messages to this user'
              });
            }

            // Create message
            db.run(
              'INSERT INTO messages (sender_id, recipient_id, subject, body) VALUES (?, ?, ?, ?)',
              [senderId, recipient.id, subject || null, body],
              function(err) {
                if (err) {
                  console.error('Error creating message:', err);
                  return res.status(500).json({
                    success: false,
                    message: 'Failed to send message'
                  });
                }

                res.json({
                  success: true,
                  message: 'Message sent successfully',
                  messageId: this.lastID
                });
              }
            );
          }
        );
      }
    );
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/messages/:messageId
 * Get a specific message
 * Requires: Auth token
 */
router.get('/:messageId', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    const messageId = parseInt(req.params.messageId);

    db.get(
      `SELECT 
        m.id,
        m.sender_id,
        m.recipient_id,
        m.subject,
        m.body,
        m.read,
        m.created_at,
        u1.username as sender_username,
        u2.username as recipient_username
      FROM messages m
      JOIN users u1 ON m.sender_id = u1.id
      JOIN users u2 ON m.recipient_id = u2.id
      WHERE m.id = ? AND (m.recipient_id = ? OR m.sender_id = ?)`,
      [messageId, userId, userId],
      (err, message) => {
        if (err) {
          console.error('Error fetching message:', err);
          return res.status(500).json({
            success: false,
            message: 'Database error occurred'
          });
        }

        if (!message) {
          return res.status(404).json({
            success: false,
            message: 'Message not found'
          });
        }

        // Mark as read if recipient is viewing
        if (message.recipient_id === userId && !message.read) {
          db.run(
            'UPDATE messages SET read = 1 WHERE id = ?',
            [messageId],
            () => {}
          );
        }

        res.json({
          success: true,
          message: message
        });
      }
    );
  } catch (error) {
    console.error('Get message error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * PUT /api/messages/:messageId/read
 * Mark message as read
 * Requires: Auth token
 */
router.put('/:messageId/read', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    const messageId = parseInt(req.params.messageId);

    db.run(
      'UPDATE messages SET read = 1 WHERE id = ? AND recipient_id = ?',
      [messageId, userId],
      function(err) {
        if (err) {
          console.error('Error marking message as read:', err);
          return res.status(500).json({
            success: false,
            message: 'Database error occurred'
          });
        }

        if (this.changes === 0) {
          return res.status(404).json({
            success: false,
            message: 'Message not found or already read'
          });
        }

        res.json({
          success: true,
          message: 'Message marked as read'
        });
      }
    );
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * PUT /api/messages/read-all
 * Mark all messages as read
 * Requires: Auth token
 */
router.put('/read-all', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;

    db.run(
      'UPDATE messages SET read = 1 WHERE recipient_id = ? AND read = 0',
      [userId],
      function(err) {
        if (err) {
          console.error('Error marking all messages as read:', err);
          return res.status(500).json({
            success: false,
            message: 'Database error occurred'
          });
        }

        res.json({
          success: true,
          message: `Marked ${this.changes} message(s) as read`
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

/**
 * DELETE /api/messages/:messageId
 * Delete a message
 * Requires: Auth token
 */
router.delete('/:messageId', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    const messageId = parseInt(req.params.messageId);

    db.run(
      'DELETE FROM messages WHERE id = ? AND (sender_id = ? OR recipient_id = ?)',
      [messageId, userId, userId],
      function(err) {
        if (err) {
          console.error('Error deleting message:', err);
          return res.status(500).json({
            success: false,
            message: 'Database error occurred'
          });
        }

        if (this.changes === 0) {
          return res.status(404).json({
            success: false,
            message: 'Message not found'
          });
        }

        res.json({
          success: true,
          message: 'Message deleted successfully'
        });
      }
    );
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;

