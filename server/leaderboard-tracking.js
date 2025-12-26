// ===== LEADERBOARD TRACKING =====
const { db } = require('./database');

/**
 * Update leaderboard entry for a user
 */
function updateLeaderboardEntry(userId, leaderboardType, value, seasonId, callback) {
  db.run(`
    INSERT INTO leaderboard_entries (season_id, user_id, leaderboard_type, value, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(season_id, user_id, leaderboard_type) DO UPDATE SET
      value = value + ?,
      updated_at = CURRENT_TIMESTAMP
  `, [seasonId, userId, leaderboardType, value, value], (err) => {
    if (err) {
      console.error('Error updating leaderboard entry:', err);
    }
    if (callback) callback(err);
  });
}

/**
 * Track 1v1 win
 */
function track1v1Win(userId, seasonId) {
  updateLeaderboardEntry(userId, '1v1', 1, seasonId);
}

/**
 * Track raid completion
 */
function trackRaidCompletion(userId, seasonId) {
  // Update raid stats
  db.run(`
    INSERT INTO raid_stats (user_id, season_id, raids_completed)
    VALUES (?, ?, 1)
    ON CONFLICT(user_id, season_id) DO UPDATE SET
      raids_completed = raids_completed + 1,
      updated_at = CURRENT_TIMESTAMP
  `, [userId, seasonId], (err) => {
    if (err) {
      console.error('Error tracking raid:', err);
    }
  });
}

/**
 * Track single player win vs AI
 */
function trackSinglePlayerWin(userId) {
  // This is tracked via player_stats.total_wins which is already updated
  // No additional tracking needed for leaderboard
}

/**
 * Track adventure location cleared
 */
function trackAdventureClear(userId, locationId) {
  // This is tracked via user_adventure_progress table
  // No additional leaderboard entry needed
}

/**
 * Get current active season ID
 */
function getCurrentSeasonId(callback) {
  db.get('SELECT id FROM seasons WHERE status = ? ORDER BY start_date DESC LIMIT 1', ['active'], (err, season) => {
    if (err || !season) {
      console.error('Error getting current season:', err);
      return callback(err, null);
    }
    callback(null, season.id);
  });
}

/**
 * Award season rewards for top 3 players
 */
function awardSeasonRewards(leaderboardType, seasonId, callback) {
  // Get top 3
  db.all(`
    SELECT user_id, value, rank
    FROM leaderboard_entries
    WHERE season_id = ? AND leaderboard_type = ?
    ORDER BY value DESC
    LIMIT 3
  `, [seasonId, leaderboardType], (err, top3) => {
    if (err) {
      console.error('Error getting top 3:', err);
      return callback(err);
    }

    // Define rewards based on leaderboard type
    const rewards = getRewardsForLeaderboard(leaderboardType);

    top3.forEach((entry, index) => {
      const rank = index + 1;
      const reward = rewards[rank];
      if (!reward) return;

      // Award to user
      if (reward.userGold) {
        db.run('UPDATE player_stats SET gold = gold + ? WHERE user_id = ?', 
          [reward.userGold, entry.user_id]);
      }

      // Award to alliance members
      db.all('SELECT user_id FROM alliance_members WHERE alliance_id = (SELECT alliance_id FROM alliance_members WHERE user_id = ?)', 
        [entry.user_id], (err, members) => {
          if (!err && members) {
            members.forEach(member => {
              if (reward.allianceMemberGold) {
                db.run('UPDATE player_stats SET gold = gold + ? WHERE user_id = ?', 
                  [reward.allianceMemberGold, member.user_id]);
              }
            });

            // Award alliance points
            if (reward.alliancePoints) {
              db.run(`
                UPDATE alliance_members 
                SET alliance_points = alliance_points + ?
                WHERE alliance_id = (SELECT alliance_id FROM alliance_members WHERE user_id = ?)
              `, [reward.alliancePoints, entry.user_id]);
            }
          }
        });
    });

    callback(null);
  });
}

function getRewardsForLeaderboard(type) {
  const rewards = {
    '1v1': {
      1: { userGold: 500, allianceMemberGold: 50, alliancePoints: 3 },
      2: { userGold: 250, allianceMemberGold: 25, alliancePoints: 2 },
      3: { userGold: 100, allianceMemberGold: 10, alliancePoints: 1 }
    },
    'raid': {
      1: { userGold: 500, allianceMemberGold: 50, alliancePoints: 3 },
      2: { userGold: 250, allianceMemberGold: 25, alliancePoints: 2 },
      3: { userGold: 100, allianceMemberGold: 10, alliancePoints: 1 }
    },
    'adventure': {
      1: { userGold: 250, allianceMemberGold: 25, alliancePoints: 3 },
      2: { userGold: 125, allianceMemberGold: 15, alliancePoints: 2 },
      3: { userGold: 50, allianceMemberGold: 5, alliancePoints: 1 }
    },
    'experience': {
      1: { userGold: 500, allianceMemberGold: 50, alliancePoints: 3 },
      2: { userGold: 250, allianceMemberGold: 25, alliancePoints: 2 },
      3: { userGold: 100, allianceMemberGold: 10, alliancePoints: 1 }
    },
    'singleplayer': {
      1: { userGold: 250, allianceMemberGold: 25, alliancePoints: 3 },
      2: { userGold: 125, allianceMemberGold: 15, alliancePoints: 2 },
      3: { userGold: 75, allianceMemberGold: 5, alliancePoints: 1 }
    }
  };

  return rewards[type] || {};
}

module.exports = {
  updateLeaderboardEntry,
  track1v1Win,
  trackRaidCompletion,
  trackSinglePlayerWin,
  trackAdventureClear,
  getCurrentSeasonId,
  awardSeasonRewards
};

