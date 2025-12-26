// ===== ADVENTURE MODE ROUTES =====
const express = require('express');
const router = express.Router();
const { db } = require('./database');
const { authenticateToken } = require('./auth');

/**
 * GET /api/adventure/locations
 * Get all adventure locations
 */
router.get('/locations', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;

    // Get all locations
    db.all('SELECT * FROM adventure_locations ORDER BY difficulty, name', [], (err, locations) => {
      if (err) {
        console.error('Error fetching locations:', err);
        return res.status(500).json({ success: false, message: 'Database error' });
      }

      // Get user progress
      db.all(`
        SELECT location_id, cleared, cleared_at
        FROM user_adventure_progress
        WHERE user_id = ?
      `, [userId], (err, progress) => {
        if (err) {
          console.error('Error fetching progress:', err);
          progress = [];
        }

        const clearedLocations = progress.filter(p => p.cleared).map(p => p.location_id);

        res.json({
          success: true,
          locations: locations || [],
          progress: {
            clearedLocations
          }
        });
      });
    });
  } catch (error) {
    console.error('Adventure locations error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * POST /api/adventure/challenge
 * Challenge an adventure location
 */
router.post('/challenge', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    const { locationId } = req.body;

    if (!locationId) {
      return res.status(400).json({ success: false, message: 'Location ID required' });
    }

    // Get location data
    db.get('SELECT * FROM adventure_locations WHERE id = ?', [locationId], (err, location) => {
      if (err || !location) {
        return res.status(404).json({ success: false, message: 'Location not found' });
      }

      // Increment attempts
      db.run(`
        INSERT INTO user_adventure_progress (user_id, location_id, attempts)
        VALUES (?, ?, 1)
        ON CONFLICT(user_id, location_id) DO UPDATE SET attempts = attempts + 1
      `, [userId, locationId], () => {});

      // Return battle data (simplified - would need actual opponent setup)
      res.json({
        success: true,
        battle: {
          locationId: location.id,
          locationName: location.name,
          opponent: {
            name: location.name,
            difficulty: location.difficulty
          }
        }
      });
    });
  } catch (error) {
    console.error('Adventure challenge error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * POST /api/adventure/complete
 * Mark an adventure location as completed
 */
router.post('/complete', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    const { locationId } = req.body;

    if (!locationId) {
      return res.status(400).json({ success: false, message: 'Location ID required' });
    }

    // Mark as cleared
    db.run(`
      INSERT INTO user_adventure_progress (user_id, location_id, cleared, cleared_at)
      VALUES (?, ?, 1, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, location_id) DO UPDATE SET cleared = 1, cleared_at = CURRENT_TIMESTAMP
    `, [userId, locationId], function(err) {
      if (err) {
        console.error('Error completing adventure:', err);
        return res.status(500).json({ success: false, message: 'Database error' });
      }

      res.json({
        success: true,
        message: 'Location cleared!'
      });
    });
  } catch (error) {
    console.error('Adventure complete error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;

