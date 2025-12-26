// ===== AUTHENTICATION ROUTES =====
const express = require('express');
const router = express.Router();
const { db } = require('./database');
const {
  hashPassword,
  comparePassword,
  generateToken,
  isValidEmail,
  isValidUsername,
  isValidPassword,
  authenticateToken
} = require('./auth');

/**
 * POST /api/auth/register
 * Register a new user account
 */
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, confirmPassword } = req.body;

    // Validation
    if (!username || !email || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    if (!isValidUsername(username)) {
      return res.status(400).json({
        success: false,
        message: 'Username must be 3-20 alphanumeric characters (-, _ allowed)'
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters with uppercase, number, and special character'
      });
    }

    // Check if user exists
    db.get(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email],
      async (err, row) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({
            success: false,
            message: 'Database error occurred'
          });
        }

        if (row) {
          return res.status(400).json({
            success: false,
            message: 'Username or email already exists'
          });
        }

        try {
          // Hash password
          const passwordHash = await hashPassword(password);

          // Insert user
          db.run(
            `INSERT INTO users (username, email, password_hash)
             VALUES (?, ?, ?)`,
            [username, email, passwordHash],
            function (err) {
              if (err) {
                console.error('Insert error:', err);
                return res.status(500).json({
                  success: false,
                  message: 'Failed to create account'
                });
              }

              const userId = this.lastID;

              // Create player stats
              db.run(
                `INSERT INTO player_stats (user_id, gold, gems)
                 VALUES (?, ?, ?)`,
                [userId, 0, 0],
                (err) => {
                  if (err) {
                    console.error('Stats error:', err);
                  } else {
                    // Give new account starter cards (60 of each type)
                    const { giveNewAccountStarterCards } = require('./new-account-cards');
                    giveNewAccountStarterCards(userId, () => {
                      console.log(`[NEW ACCOUNT] Starter cards given to user ${userId}`);
                    });
                    
                    // Unlock "Create an Account" achievement with 1 booster pack reward
                    const { unlockAchievement } = require('./achievement-helper');
                    unlockAchievement(userId, 'create_account', {
                      type: 'booster_pack',
                      amount: 1
                    });
                  }
                }
              );

              // Generate token
              const token = generateToken(userId, username);
              
              // Store session
              const crypto = require('crypto');
              const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
              db.run(
                'INSERT OR IGNORE INTO active_sessions (user_id, token_hash) VALUES (?, ?)',
                [userId, tokenHash],
                (err) => {
                  if (err) console.error('Error storing session:', err);
                }
              );

              console.log(`[AUTH] New account created: ${username}`);

              res.status(201).json({
                success: true,
                message: 'Account created successfully',
                data: {
                  userId,
                  username,
                  email,
                  token
                }
              });
            }
          );
        } catch (error) {
          console.error('Error:', error);
          res.status(500).json({
            success: false,
            message: 'Server error occurred'
          });
        }
      }
    );
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error occurred'
    });
  }
});

/**
 * POST /api/auth/login
 * Login user
 */
router.post('/login', async (req, res) => {
  try {
    const { loginIdentifier, password } = req.body;

    console.log('[LOGIN] Received login request:', { loginIdentifier: loginIdentifier ? 'provided' : 'missing', hasPassword: !!password });

    // Validation
    if (!loginIdentifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username/email and password are required'
      });
    }

    const trimmedIdentifier = loginIdentifier.trim();
    console.log('[LOGIN] Searching for user with identifier:', trimmedIdentifier);

    // Find user by email OR username (case-insensitive)
    // Use COLLATE NOCASE for case-insensitive comparison in SQLite
    const lowerIdentifier = trimmedIdentifier.toLowerCase();
    db.get(
      'SELECT id, username, email, password_hash FROM users WHERE (email COLLATE NOCASE = ? OR username COLLATE NOCASE = ?)',
      [trimmedIdentifier, trimmedIdentifier],
      async (err, user) => {
        if (err) {
          console.error('[LOGIN] Database error:', err);
          return res.status(500).json({
            success: false,
            message: 'Database error occurred'
          });
        }

        if (!user) {
          console.log('[LOGIN] User not found for identifier:', trimmedIdentifier);
          return res.status(401).json({
            success: false,
            message: 'Invalid username/email or password'
          });
        }

        console.log('[LOGIN] User found:', { id: user.id, username: user.username, email: user.email });

        try {
          // Compare password
          const isPasswordValid = await comparePassword(password, user.password_hash);

          if (!isPasswordValid) {
            return res.status(401).json({
              success: false,
              message: 'Invalid username/email or password'
            });
          }

          // Generate token
          const token = generateToken(user.id, user.username);
          
          // Store session
          const crypto = require('crypto');
          const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
          db.run(
            'INSERT OR IGNORE INTO active_sessions (user_id, token_hash) VALUES (?, ?)',
            [user.id, tokenHash],
            (err) => {
              if (err) console.error('Error storing session:', err);
            }
          );

          // Get player stats
          db.get(
            'SELECT gold, gems, total_wins, total_losses, current_rank, level FROM player_stats WHERE user_id = ?',
            [user.id],
            (err, stats) => {
              console.log(`[AUTH] User logged in: ${user.username}`);

              res.json({
                success: true,
                message: 'Login successful',
                data: {
                  userId: user.id,
                  username: user.username,
                  email: user.email,
                  token,
                  stats: stats || {
                    gold: 0,
                    gems: 0,
                    total_wins: 0,
                    total_losses: 0,
                    current_rank: 'Unranked',
                    level: 1
                  }
                }
              });
            }
          );
        } catch (error) {
          console.error('Error:', error);
          res.status(500).json({
            success: false,
            message: 'Server error occurred'
          });
        }
      }
    );
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error occurred'
    });
  }
});

/**
 * GET /api/auth/verify
 * Verify JWT token
 */
router.get('/verify', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'No token provided'
    });
  }

  const { verifyToken } = require('./auth');
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }

  // Get user data
  db.get(
    'SELECT id, username, email FROM users WHERE id = ?',
    [decoded.userId],
    (err, user) => {
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        data: {
          userId: user.id,
          username: user.username,
          email: user.email
        }
      });
    }
  );
});

/**
 * PUT /api/auth/change-email
 * Change user email (requires authentication)
 */
router.put('/change-email', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { verifyToken } = require('./auth');
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    const { newEmail, password } = req.body;
    const userId = decoded.userId;

    if (!newEmail || !password) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    if (!isValidEmail(newEmail)) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }

    // Check if email is already in use
    db.get('SELECT id FROM users WHERE email = ? AND id != ?', [newEmail, userId], async (err, existingUser) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
      }
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'Email is already in use' });
      }

      // Verify password
      db.get('SELECT password_hash FROM users WHERE id = ?', [userId], async (err, user) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ success: false, message: 'Internal server error' });
        }
        if (!user) {
          return res.status(404).json({ success: false, message: 'User not found' });
        }

        const passwordMatch = await comparePassword(password, user.password_hash);
        if (!passwordMatch) {
          return res.status(401).json({ success: false, message: 'Incorrect password' });
        }

        // Update email
        db.run('UPDATE users SET email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newEmail, userId], (err) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ success: false, message: 'Failed to update email' });
          }
          res.json({ success: true, message: 'Email updated successfully', email: newEmail });
        });
      });
    });
  } catch (error) {
    console.error('Change email error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * PUT /api/auth/change-password
 * Change user password (requires authentication)
 */
router.put('/change-password', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { verifyToken } = require('./auth');
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'New passwords do not match'
      });
    }

    if (!isValidPassword(newPassword)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from current password'
      });
    }

    // Get user and verify current password
    db.get(
      'SELECT id, password_hash FROM users WHERE id = ?',
      [decoded.userId],
      async (err, user) => {
        if (err) {
          return res.status(500).json({
            success: false,
            message: 'Database error'
          });
        }

        if (!user) {
          return res.status(404).json({
            success: false,
            message: 'User not found'
          });
        }

        // Verify current password
        const isValid = await comparePassword(currentPassword, user.password_hash);
        if (!isValid) {
          return res.status(401).json({
            success: false,
            message: 'Current password is incorrect'
          });
        }

        // Hash new password
        const newPasswordHash = await hashPassword(newPassword);

        // Update password
        db.run(
          'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [newPasswordHash, decoded.userId],
          (err) => {
            if (err) {
              return res.status(500).json({
                success: false,
                message: 'Failed to update password'
              });
            }

            res.json({
              success: true,
              message: 'Password changed successfully'
            });
          }
        );
      }
    );
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/auth/logout-all
 * Log out of all sessions (requires authentication)
 */
router.post('/logout-all', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId; // From verifyTokenMiddleware

    // Delete all sessions for this user
    db.run('DELETE FROM active_sessions WHERE user_id = ?', [userId], function(err) {
      if (err) {
        console.error('Error logging out all sessions:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to log out all sessions'
        });
      }

      console.log(`[AUTH] User ${userId} logged out of all sessions (${this.changes} sessions)`);
      
      res.json({
        success: true,
        message: `Logged out of ${this.changes} session(s)`,
        sessionsLoggedOut: this.changes
      });
    });
  } catch (error) {
    console.error('Logout all error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/auth/request-deletion
 * Request account deletion (requires authentication)
 */
router.post('/request-deletion', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required to confirm account deletion'
      });
    }

    // Verify password
    db.get('SELECT password_hash FROM users WHERE id = ?', [userId], async (err, user) => {
      if (err) {
        console.error('Error fetching user:', err);
        return res.status(500).json({
          success: false,
          message: 'Database error occurred'
        });
      }

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const isValidPassword = await comparePassword(password, user.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: 'Incorrect password'
        });
      }

      // Check if deletion request already exists
      db.get('SELECT id FROM deletion_requests WHERE user_id = ? AND status = ?', [userId, 'pending'], (err, existing) => {
        if (err) {
          console.error('Error checking deletion request:', err);
          return res.status(500).json({
            success: false,
            message: 'Database error occurred'
          });
        }

        if (existing) {
          return res.status(400).json({
            success: false,
            message: 'Account deletion request already pending'
          });
        }

        // Create deletion request
        db.run(
          'INSERT INTO deletion_requests (user_id, status) VALUES (?, ?)',
          [userId, 'pending'],
          function(err) {
            if (err) {
              console.error('Error creating deletion request:', err);
              return res.status(500).json({
                success: false,
                message: 'Failed to create deletion request'
              });
            }

            console.log(`[AUTH] Account deletion requested for user ${userId}`);
            
            res.json({
              success: true,
              message: 'Account deletion request submitted. Your account will be deleted within 7 days unless you cancel the request.',
              requestId: this.lastID
            });
          }
        );
      });
    });
  } catch (error) {
    console.error('Request deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/auth/cancel-deletion
 * Cancel pending account deletion request (requires authentication)
 */
router.post('/cancel-deletion', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;

    db.run(
      'DELETE FROM deletion_requests WHERE user_id = ? AND status = ?',
      [userId, 'pending'],
      function(err) {
        if (err) {
          console.error('Error canceling deletion request:', err);
          return res.status(500).json({
            success: false,
            message: 'Failed to cancel deletion request'
          });
        }

        if (this.changes === 0) {
          return res.status(404).json({
            success: false,
            message: 'No pending deletion request found'
          });
        }

        console.log(`[AUTH] Account deletion request canceled for user ${userId}`);
        
        res.json({
          success: true,
          message: 'Account deletion request canceled successfully'
        });
      }
    );
  } catch (error) {
    console.error('Cancel deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/auth/deletion-status
 * Get account deletion request status (requires authentication)
 */
router.get('/deletion-status', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;

    db.get(
      'SELECT id, requested_at, status FROM deletion_requests WHERE user_id = ?',
      [userId],
      (err, request) => {
        if (err) {
          console.error('Error fetching deletion status:', err);
          return res.status(500).json({
            success: false,
            message: 'Database error occurred'
          });
        }

        if (!request) {
          return res.json({
            success: true,
            hasPendingDeletion: false
          });
        }

        res.json({
          success: true,
          hasPendingDeletion: request.status === 'pending',
          deletionRequest: {
            id: request.id,
            requestedAt: request.requested_at,
            status: request.status
          }
        });
      }
    );
  } catch (error) {
    console.error('Deletion status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;
