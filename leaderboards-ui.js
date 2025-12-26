// ===== LEADERBOARDS UI =====

let currentLeaderboardTab = 'alliance';

function openLeaderboardsModal() {
    const modal = document.getElementById('leaderboardsModal');
    if (modal) {
        modal.style.display = 'flex';
        switchLeaderboardTab('alliance');
    }
}

function closeLeaderboardsModal() {
    const modal = document.getElementById('leaderboardsModal');
    if (modal) modal.style.display = 'none';
}

function switchLeaderboardTab(tab) {
    currentLeaderboardTab = tab;
    
    // Update tab buttons
    const tabs = ['alliance', '1v1', 'raid', 'adventure', 'experience', 'singleplayer'];
    tabs.forEach(t => {
        const btn = document.getElementById(`leaderboardTab${t.charAt(0).toUpperCase() + t.slice(1)}`);
        if (btn) {
            btn.style.background = tab === t 
                ? 'linear-gradient(135deg, #8b7355 0%, #6b5344 100%)' 
                : 'rgba(139, 111, 71, 0.3)';
            btn.style.border = tab === t ? '2px solid #d4af37' : '2px solid #8b6f47';
            btn.style.fontWeight = tab === t ? 'bold' : 'normal';
        }
    });
    
    // Load leaderboard data
    loadLeaderboard(tab);
}

async function loadLeaderboard(type) {
    const container = document.getElementById('leaderboardsList');
    if (!container) return;
    
    container.innerHTML = '<div style="color: #aaa; text-align: center; padding: 20px;">Loading leaderboard...</div>';
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/leaderboards/${type}?limit=15`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        
        const data = await response.json();
        
        if (data.success) {
            displayLeaderboard(data.leaderboard, data.currentSeason, data.userRank);
        } else {
            container.innerHTML = `<div style="color: #c41e3a; text-align: center; padding: 20px;">Error: ${data.message}</div>`;
        }
    } catch (error) {
        console.error('Error loading leaderboard:', error);
        container.innerHTML = '<div style="color: #c41e3a; text-align: center; padding: 20px;">Error loading leaderboard</div>';
    }
}

function displayLeaderboard(entries, season, userRank) {
    const container = document.getElementById('leaderboardsList');
    if (!container) return;
    
    if (!entries || entries.length === 0) {
        container.innerHTML = '<div style="color: #aaa; text-align: center; padding: 20px;">No entries yet</div>';
        return;
    }
    
    const medals = ['🥇', '🥈', '🥉'];
    
    container.innerHTML = `
        <div style="margin-bottom: 15px; padding: 10px; background: rgba(0,0,0,0.3); border: 1px solid #8b6f47; border-radius: 4px;">
            <div style="color: #d4af37; font-size: 12px; font-weight: bold; margin-bottom: 5px;">Current Season</div>
            <div style="color: #f4e4c1; font-size: 14px;">${season.name} (${season.daysRemaining} days remaining)</div>
            ${userRank ? `<div style="color: #aaa; font-size: 11px; margin-top: 5px;">Your Rank: #${userRank}</div>` : ''}
        </div>
        ${entries.map((entry, index) => {
            const rank = index + 1;
            const medal = rank <= 3 ? medals[rank - 1] : '';
            const rankDisplay = rank <= 3 ? medal : `#${rank}`;
            const isTop3 = rank <= 3;
            const bgColor = isTop3 ? 'rgba(212, 175, 55, 0.2)' : 'rgba(0,0,0,0.2)';
            const borderColor = isTop3 ? '#d4af37' : '#8b6f47';
            
            return `
                <div style="padding: 12px; margin-bottom: 8px; background: ${bgColor}; border-left: 4px solid ${borderColor}; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <div style="font-size: 18px; font-weight: bold; color: ${isTop3 ? '#d4af37' : '#f4e4c1'}; min-width: 50px; text-align: center;">${rankDisplay}</div>
                        <div>
                            <div style="color: #f4e4c1; font-weight: bold; font-size: 14px;">${escapeHtml(entry.displayName || entry.username)}</div>
                            ${entry.allianceName ? `<div style="color: #aaa; font-size: 11px;">${escapeHtml(entry.allianceName)}</div>` : ''}
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="color: #d4af37; font-size: 16px; font-weight: bold;">${formatLeaderboardValue(entry.value, currentLeaderboardTab)}</div>
                    </div>
                </div>
            `;
        }).join('')}
    `;
}

function formatLeaderboardValue(value, type) {
    if (type === 'experience') {
        return `${value.toLocaleString()} XP`;
    } else if (type === 'alliance') {
        return `${value} Points`;
    } else {
        return value.toLocaleString();
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

