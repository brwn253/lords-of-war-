// ===== LEADERBOARDS ROUTES =====
const express = require('express');
const router = express.Router();
const { db } = require('./database');
const { authenticateToken } = require('./auth');

/**
 * GET /api/leaderboards/:type
 * Get leaderboard for a specific type
 * Types: alliance, 1v1, raid, adventure, experience, singleplayer
 */
router.get('/:type', authenticateToken, (req, res) => {
  try {
    const { type } = req.params;
    const limit = parseInt(req.query.limit) || 15;
    const userId = req.user ? req.user.userId : null;

    // Get current active season
    db.get('SELECT * FROM seasons WHERE status = ? ORDER BY start_date DESC LIMIT 1', ['active'], (err, season) => {
      if (err) {
        console.error('Error fetching season:', err);
        return res.status(500).json({ success: false, message: 'Database error' });
      }

      if (!season) {
        return res.status(404).json({ success: false, message: 'No active season' });
      }

      // Calculate days remaining
      const endDate = new Date(season.end_date);
      const now = new Date();
      const daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

      // Get leaderboard based on type
      getLeaderboardData(type, season.id, limit, (err, entries) => {
        if (err) {
          return res.status(500).json({ success: false, message: 'Error fetching leaderboard' });
        }

        // Get user's rank if logged in
        let userRank = null;
        if (userId) {
          getUserRank(type, season.id, userId, (err, rank) => {
            if (!err) userRank = rank;
            
            res.json({
              success: true,
              leaderboard: entries,
              currentSeason: {
                id: season.id,
                name: season.name,
                daysRemaining: Math.max(0, daysRemaining)
              },
              userRank
            });
          });
        } else {
          res.json({
            success: true,
            leaderboard: entries,
            currentSeason: {
              id: season.id,
              name: season.name,
              daysRemaining: Math.max(0, daysRemaining)
            },
            userRank: null
          });
        }
      });
    });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

function getLeaderboardData(type, seasonId, limit, callback) {
  let query = '';
  let params = [seasonId];

  switch (type) {
    case 'alliance':
      // Alliance points leaderboard
      query = `
        SELECT 
          a.id as alliance_id,
          a.name as alliance_name,
          a.tag as alliance_tag,
          COALESCE(SUM(am.alliance_points), 0) as value
        FROM alliances a
        LEFT JOIN alliance_members am ON a.id = am.alliance_id
        GROUP BY a.id
        ORDER BY value DESC
        LIMIT ?
      `;
      params = [limit];
      break;

    case '1v1':
      // 1v1 wins leaderboard
      query = `
        SELECT 
          u.id as user_id,
          u.username,
          ps.display_name,
          COALESCE(le.value, 0) as value,
          am.alliance_id,
          a.name as alliance_name
        FROM users u
        LEFT JOIN player_stats ps ON u.id = ps.user_id
        LEFT JOIN leaderboard_entries le ON u.id = le.user_id AND le.leaderboard_type = ? AND le.season_id = ?
        LEFT JOIN alliance_members am ON u.id = am.user_id
        LEFT JOIN alliances a ON am.alliance_id = a.id
        WHERE le.leaderboard_type = ? OR le.leaderboard_type IS NULL
        ORDER BY value DESC
        LIMIT ?
      `;
      params = ['1v1', seasonId, '1v1', limit];
      break;

    case 'raid':
      // Raid completions
      query = `
        SELECT 
          u.id as user_id,
          u.username,
          ps.display_name,
          COALESCE(rs.raids_completed, 0) as value,
          am.alliance_id,
          a.name as alliance_name
        FROM users u
        LEFT JOIN player_stats ps ON u.id = ps.user_id
        LEFT JOIN raid_stats rs ON u.id = rs.user_id AND rs.season_id = ?
        LEFT JOIN alliance_members am ON u.id = am.user_id
        LEFT JOIN alliances a ON am.alliance_id = a.id
        ORDER BY value DESC
        LIMIT ?
      `;
      params = [seasonId, limit];
      break;

    case 'adventure':
      // Adventure locations cleared
      query = `
        SELECT 
          u.id as user_id,
          u.username,
          ps.display_name,
          COUNT(DISTINCT uap.location_id) as value,
          am.alliance_id,
          a.name as alliance_name
        FROM users u
        LEFT JOIN player_stats ps ON u.id = ps.user_id
        LEFT JOIN user_adventure_progress uap ON u.id = uap.user_id AND uap.cleared = 1
        LEFT JOIN alliance_members am ON u.id = am.user_id
        LEFT JOIN alliances a ON am.alliance_id = a.id
        GROUP BY u.id
        ORDER BY value DESC
        LIMIT ?
      `;
      params = [limit];
      break;

    case 'experience':
      // Total XP
      query = `
        SELECT 
          u.id as user_id,
          u.username,
          ps.display_name,
          COALESCE(ps.xp, 0) as value,
          am.alliance_id,
          a.name as alliance_name
        FROM users u
        LEFT JOIN player_stats ps ON u.id = ps.user_id
        LEFT JOIN alliance_members am ON u.id = am.user_id
        LEFT JOIN alliances a ON am.alliance_id = a.id
        ORDER BY value DESC
        LIMIT ?
      `;
      params = [limit];
      break;

    case 'singleplayer':
      // Single player wins vs AI
      query = `
        SELECT 
          u.id as user_id,
          u.username,
          ps.display_name,
          COALESCE(ps.total_wins, 0) as value,
          am.alliance_id,
          a.name as alliance_name
        FROM users u
        LEFT JOIN player_stats ps ON u.id = ps.user_id
        LEFT JOIN alliance_members am ON u.id = am.user_id
        LEFT JOIN alliances a ON am.alliance_id = a.id
        WHERE ps.total_wins > 0
        ORDER BY value DESC
        LIMIT ?
      `;
      params = [limit];
      break;

    default:
      return callback(new Error('Invalid leaderboard type'));
  }

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Error fetching leaderboard data:', err);
      return callback(err);
    }
    callback(null, rows || []);
  });
}

function getUserRank(type, seasonId, userId, callback) {
  // This would need to be implemented based on the leaderboard type
  // For now, return null
  callback(null, null);
}

module.exports = router;

