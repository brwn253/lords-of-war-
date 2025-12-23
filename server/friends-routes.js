// ===== FRIENDS ROUTES =====
const express = require('express');
const router = express.Router();
const { db } = require('./database');
const { authenticateToken } = require('./auth');

/**
 * GET /api/friends
 * Get user's friends list with online status
 * Requires: Auth token
 */
router.get('/', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    // Import userSockets from game-server (must be done inside function to avoid circular dependency)
    const gameServer = require('../game-server');
    const userSockets = gameServer.userSockets || new Map();

    db.all(
      `SELECT 
        f.id,
        f.friend_id,
        f.created_at,
        u.username,
        u.id as user_id
      FROM friends f
      JOIN users u ON f.friend_id = u.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC`,
      [userId],
      (err, friends) => {
        if (err) {
          console.error('Error fetching friends:', err);
          return res.status(500).json({
            success: false,
            message: 'Database error occurred'
          });
        }

        // Add online status
        const friendsWithStatus = (friends || []).map(friend => {
          const isOnline = userSockets.has(friend.friend_id) && userSockets.get(friend.friend_id).size > 0;
          return {
            ...friend,
            isOnline
          };
        });

        res.json({
          success: true,
          friends: friendsWithStatus
        });
      }
    );
  } catch (error) {
    console.error('Friends error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/friends/request
 * Send a friend request
 * Requires: Auth token
 */
router.post('/request', authenticateToken, (req, res) => {
  try {
    const requesterId = req.user.userId;
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({
        success: false,
        message: 'Username is required'
      });
    }

    // Find recipient user
    db.get(
      'SELECT id, username FROM users WHERE username COLLATE NOCASE = ?',
      [username],
      (err, recipient) => {
        if (err) {
          console.error('Error finding user:', err);
          return res.status(500).json({
            success: false,
            message: 'Database error occurred'
          });
        }

        if (!recipient) {
          return res.status(404).json({
            success: false,
            message: 'User not found'
          });
        }

        if (recipient.id === requesterId) {
          return res.status(400).json({
            success: false,
            message: 'You cannot send a friend request to yourself'
          });
        }

        // Check if either user has blocked the other
        db.get(
          'SELECT id FROM blocked_users WHERE (user_id = ? AND blocked_user_id = ?) OR (user_id = ? AND blocked_user_id = ?)',
          [requesterId, recipient.id, recipient.id, requesterId],
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
                message: 'Cannot send friend request - user is blocked'
              });
            }

            // Check if already friends
            db.get(
              'SELECT id FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)',
              [requesterId, recipient.id, recipient.id, requesterId],
              (err, existingFriend) => {
                if (err) {
                  console.error('Error checking friends:', err);
                  return res.status(500).json({
                    success: false,
                    message: 'Database error occurred'
                  });
                }

                if (existingFriend) {
                  return res.status(400).json({
                    success: false,
                    message: 'You are already friends with this user'
                  });
                }

                // Check if request already exists
                db.get(
                  'SELECT id, status, requester_id FROM friend_requests WHERE (requester_id = ? AND recipient_id = ?) OR (requester_id = ? AND recipient_id = ?)',
                  [requesterId, recipient.id, recipient.id, requesterId],
                  (err, existingRequest) => {
                    if (err) {
                      console.error('Error checking requests:', err);
                      return res.status(500).json({
                        success: false,
                        message: 'Database error occurred'
                      });
                    }

                    if (existingRequest) {
                      if (existingRequest.status === 'pending') {
                        if (existingRequest.requester_id === requesterId) {
                          return res.status(400).json({
                            success: false,
                            message: 'Friend request already sent'
                          });
                        } else {
                          // Auto-accept if they're requesting back
                          db.run(
                            'INSERT INTO friends (user_id, friend_id) VALUES (?, ?), (?, ?)',
                            [requesterId, recipient.id, recipient.id, requesterId],
                            function(err) {
                              if (err) {
                                console.error('Error creating friendship:', err);
                                return res.status(500).json({
                                  success: false,
                                  message: 'Failed to create friendship'
                                });
                              }

                              // Update request status
                              db.run(
                                'UPDATE friend_requests SET status = ?, responded_at = CURRENT_TIMESTAMP WHERE id = ?',
                                ['accepted', existingRequest.id],
                                () => {}
                              );

                              res.json({
                                success: true,
                                message: `Friend request accepted! You are now friends with ${recipient.username}`,
                                autoAccepted: true
                              });
                            }
                          );
                          return;
                        }
                      }
                    }

                    // Create new friend request
                    db.run(
                      'INSERT INTO friend_requests (requester_id, recipient_id) VALUES (?, ?)',
                      [requesterId, recipient.id],
                      function(err) {
                        if (err) {
                          console.error('Error creating friend request:', err);
                          return res.status(500).json({
                            success: false,
                            message: 'Failed to send friend request'
                          });
                        }

                        res.json({
                          success: true,
                          message: `Friend request sent to ${recipient.username}`
                        });
                      }
                    );
                  }
                );
              }
            );
          }
        );
      }
    );
  } catch (error) {
    console.error('Send friend request error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/friends/requests
 * Get pending friend requests
 * Requires: Auth token
 */
router.get('/requests', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;

    db.all(
      `SELECT 
        fr.id,
        fr.requester_id,
        fr.created_at,
        u.username
      FROM friend_requests fr
      JOIN users u ON fr.requester_id = u.id
      WHERE fr.recipient_id = ? AND fr.status = ?
      ORDER BY fr.created_at DESC`,
      [userId, 'pending'],
      (err, requests) => {
        if (err) {
          console.error('Error fetching friend requests:', err);
          return res.status(500).json({
            success: false,
            message: 'Database error occurred'
          });
        }

        res.json({
          success: true,
          requests: requests || []
        });
      }
    );
  } catch (error) {
    console.error('Friend requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/friends/accept/:requestId
 * Accept a friend request
 * Requires: Auth token
 */
router.post('/accept/:requestId', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    const requestId = parseInt(req.params.requestId);

    // Get request details
    db.get(
      'SELECT requester_id, recipient_id FROM friend_requests WHERE id = ? AND recipient_id = ? AND status = ?',
      [requestId, userId, 'pending'],
      (err, request) => {
        if (err) {
          console.error('Error fetching request:', err);
          return res.status(500).json({
            success: false,
            message: 'Database error occurred'
          });
        }

        if (!request) {
          return res.status(404).json({
            success: false,
            message: 'Friend request not found or already processed'
          });
        }

        // Create friendship (bidirectional)
        db.run(
          'INSERT INTO friends (user_id, friend_id) VALUES (?, ?), (?, ?)',
          [userId, request.requester_id, request.requester_id, userId],
          function(err) {
            if (err) {
              console.error('Error creating friendship:', err);
              return res.status(500).json({
                success: false,
                message: 'Failed to create friendship'
              });
            }

            // Update request status
            db.run(
              'UPDATE friend_requests SET status = ?, responded_at = CURRENT_TIMESTAMP WHERE id = ?',
              ['accepted', requestId],
              (err) => {
                if (err) {
                  console.error('Error updating request:', err);
                }

                res.json({
                  success: true,
                  message: 'Friend request accepted'
                });
              }
            );
          }
        );
      }
    );
  } catch (error) {
    console.error('Accept friend request error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/friends/reject/:requestId
 * Reject a friend request
 * Requires: Auth token
 */
router.post('/reject/:requestId', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    const requestId = parseInt(req.params.requestId);

    db.run(
      'UPDATE friend_requests SET status = ?, responded_at = CURRENT_TIMESTAMP WHERE id = ? AND recipient_id = ? AND status = ?',
      ['rejected', requestId, userId, 'pending'],
      function(err) {
        if (err) {
          console.error('Error rejecting request:', err);
          return res.status(500).json({
            success: false,
            message: 'Database error occurred'
          });
        }

        if (this.changes === 0) {
          return res.status(404).json({
            success: false,
            message: 'Friend request not found or already processed'
          });
        }

        res.json({
          success: true,
          message: 'Friend request rejected'
        });
      }
    );
  } catch (error) {
    console.error('Reject friend request error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * DELETE /api/friends/:friendId
 * Remove a friend
 * Requires: Auth token
 */
router.delete('/:friendId', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    const friendId = parseInt(req.params.friendId);

    db.run(
      'DELETE FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)',
      [userId, friendId, friendId, userId],
      function(err) {
        if (err) {
          console.error('Error removing friend:', err);
          return res.status(500).json({
            success: false,
            message: 'Database error occurred'
          });
        }

        if (this.changes === 0) {
          return res.status(404).json({
            success: false,
            message: 'Friend relationship not found'
          });
        }

        res.json({
          success: true,
          message: 'Friend removed successfully'
        });
      }
    );
  } catch (error) {
    console.error('Remove friend error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/friends/block/:userId
 * Block a user
 * Requires: Auth token
 */
router.post('/block/:userId', authenticateToken, (req, res) => {
  try {
    const blockerId = req.user.userId;
    const blockedUserId = parseInt(req.params.userId);

    if (blockedUserId === blockerId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot block yourself'
      });
    }

    // Check if already blocked
    db.get(
      'SELECT id FROM blocked_users WHERE user_id = ? AND blocked_user_id = ?',
      [blockerId, blockedUserId],
      (err, existing) => {
        if (err) {
          console.error('Error checking blocked users:', err);
          return res.status(500).json({
            success: false,
            message: 'Database error occurred'
          });
        }

        if (existing) {
          return res.status(400).json({
            success: false,
            message: 'User is already blocked'
          });
        }

        // Remove from friends if they are friends
        db.run(
          'DELETE FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)',
          [blockerId, blockedUserId, blockedUserId, blockerId],
          () => {}
        );

        // Block user
        db.run(
          'INSERT INTO blocked_users (user_id, blocked_user_id) VALUES (?, ?)',
          [blockerId, blockedUserId],
          function(err) {
            if (err) {
              console.error('Error blocking user:', err);
              return res.status(500).json({
                success: false,
                message: 'Failed to block user'
              });
            }

            res.json({
              success: true,
              message: 'User blocked successfully'
            });
          }
        );
      }
    );
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/friends/unblock/:userId
 * Unblock a user
 * Requires: Auth token
 */
router.post('/unblock/:userId', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    const blockedUserId = parseInt(req.params.userId);

    db.run(
      'DELETE FROM blocked_users WHERE user_id = ? AND blocked_user_id = ?',
      [userId, blockedUserId],
      function(err) {
        if (err) {
          console.error('Error unblocking user:', err);
          return res.status(500).json({
            success: false,
            message: 'Database error occurred'
          });
        }

        if (this.changes === 0) {
          return res.status(404).json({
            success: false,
            message: 'User is not blocked'
          });
        }

        res.json({
          success: true,
          message: 'User unblocked successfully'
        });
      }
    );
  } catch (error) {
    console.error('Unblock user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/friends/blocked
 * Get list of blocked users
 * Requires: Auth token
 */
router.get('/blocked', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;

    db.all(
      `SELECT 
        bu.id,
        bu.blocked_user_id,
        bu.created_at,
        u.username
      FROM blocked_users bu
      JOIN users u ON bu.blocked_user_id = u.id
      WHERE bu.user_id = ?
      ORDER BY bu.created_at DESC`,
      [userId],
      (err, blocked) => {
        if (err) {
          console.error('Error fetching blocked users:', err);
          return res.status(500).json({
            success: false,
            message: 'Database error occurred'
          });
        }

        res.json({
          success: true,
          blocked: blocked || []
        });
      }
    );
  } catch (error) {
    console.error('Get blocked users error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;

