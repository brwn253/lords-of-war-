// ===== ACHIEVEMENT HELPER =====
const { db } = require('./database');

/**
 * Unlock an achievement for a user
 * @param {number} userId - User ID
 * @param {string} achievementId - Achievement ID
 * @param {object} reward - Optional reward { type: 'booster_pack'|'gold'|'gems', amount: number }
 * @param {function} callback - Optional callback
 */
function unlockAchievement(userId, achievementId, reward = null, callback = null) {
  // Check if already unlocked
  db.get('SELECT id FROM achievements WHERE user_id = ? AND achievement_id = ?', [userId, achievementId], (err, existing) => {
    if (err) {
      console.error('Error checking achievement:', err);
      if (callback) callback(err);
      return;
    }
    
    if (existing) {
      // Already unlocked
      if (callback) callback(null, false);
      return;
    }
    
    // Unlock achievement
    db.run('INSERT INTO achievements (user_id, achievement_id) VALUES (?, ?)', [userId, achievementId], (err) => {
      if (err) {
        console.error('Error unlocking achievement:', err);
        if (callback) callback(err);
        return;
      }
      
      console.log(`[ACHIEVEMENT] User ${userId} unlocked: ${achievementId}`);
      
      // Create notification
      createAchievementNotification(userId, achievementId, db);
      
      // Award reward if provided
      if (reward) {
        awardAchievementReward(userId, reward, (err) => {
          if (err) {
            console.error('Error awarding achievement reward:', err);
          }
          if (callback) callback(null, true);
        });
      } else {
        if (callback) callback(null, true);
      }
    });
  });
}

/**
 * Create notification for achievement unlock
 */
function createAchievementNotification(userId, achievementId, db) {
  const achievementNames = {
    'create_account': 'Create an Account',
    'list_card_5': 'List 5 Cards',
    'list_card_50': 'List 50 Cards',
    'list_card_500': 'List 500 Cards',
    'list_card_1000': 'List 1000 Cards',
    'buy_card_5': 'Buy 5 Cards',
    'buy_card_50': 'Buy 50 Cards',
    'buy_card_500': 'Buy 500 Cards',
    'buy_card_1000': 'Buy 1000 Cards',
    'win_10_games': 'Win 10 Games',
    'win_50_games': 'Win 50 Games'
  };
  
  const name = achievementNames[achievementId] || achievementId;
  
  db.run(
    'INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)',
    [userId, 'achievement', 'Achievement Unlocked!', `You've unlocked: ${name}!`],
    (err) => {
      if (err) {
        console.error('Error creating achievement notification:', err);
      }
    }
  );
}

/**
 * Award achievement reward
 */
function awardAchievementReward(userId, reward, callback) {
  if (reward.type === 'booster_pack') {
    // Add booster pack to unopened products
    db.run(`
      INSERT INTO unopened_products (user_id, product_type, product_id, quantity)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, product_type, product_id) DO UPDATE SET quantity = quantity + ?
    `, [userId, 'booster_pack', 'booster_pack', reward.amount || 1, reward.amount || 1], (err) => {
      if (err) {
        console.error('Error awarding booster pack:', err);
      } else {
        console.log(`[REWARD] User ${userId} received ${reward.amount || 1} booster pack(s)`);
      }
      if (callback) callback(err);
    });
  } else if (reward.type === 'gold') {
    db.run('UPDATE player_stats SET gold = gold + ? WHERE user_id = ?', [reward.amount || 0, userId], (err) => {
      if (err) {
        console.error('Error awarding gold:', err);
      } else {
        console.log(`[REWARD] User ${userId} received ${reward.amount || 0} gold`);
      }
      if (callback) callback(err);
    });
  } else if (reward.type === 'gems') {
    db.run('UPDATE player_stats SET gems = gems + ? WHERE user_id = ?', [reward.amount || 0, userId], (err) => {
      if (err) {
        console.error('Error awarding gems:', err);
      } else {
        console.log(`[REWARD] User ${userId} received ${reward.amount || 0} gems`);
      }
      if (callback) callback(err);
    });
  } else {
    if (callback) callback(new Error('Unknown reward type'));
  }
}

/**
 * Check and unlock tiered achievements (e.g., list 5, 50, 500, 1000 cards)
 */
function checkTieredAchievement(userId, achievementType, currentCount, db) {
  const tiers = [5, 50, 500, 1000];
  
  tiers.forEach(tier => {
    if (currentCount >= tier) {
      const achievementId = `${achievementType}_${tier}`;
      
      // Check if already unlocked
      db.get('SELECT id FROM achievements WHERE user_id = ? AND achievement_id = ?', [userId, achievementId], (err, existing) => {
        if (err) {
          console.error('Error checking tiered achievement:', err);
          return;
        }
        
        if (!existing) {
          unlockAchievement(userId, achievementId, null, (err, unlocked) => {
            if (!err && unlocked) {
              console.log(`[ACHIEVEMENT] User ${userId} unlocked ${achievementId}`);
            }
          });
        }
      });
    }
  });
}

module.exports = {
  unlockAchievement,
  checkTieredAchievement,
  awardAchievementReward
};

