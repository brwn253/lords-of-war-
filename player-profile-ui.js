// ===== PLAYER PROFILE VIEWER =====

async function openPlayerProfileModal(username) {
    // Create or show profile modal
    let modal = document.getElementById('playerProfileModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'playerProfileModal';
        modal.className = 'modal';
        modal.style.cssText = 'display: none; max-width: 800px; width: 90%; max-height: 90vh; overflow-y: auto;';
        document.body.appendChild(modal);
    }
    
    modal.style.display = 'flex';
    modal.innerHTML = '<div style="color: #aaa; text-align: center; padding: 20px;">Loading profile...</div>';
    
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            modal.innerHTML = '<div style="color: #c41e3a; text-align: center; padding: 20px;">Please log in to view profiles</div>';
            return;
        }
        
        // Fetch player profile by username
        const response = await fetch(`/api/profile/view/${encodeURIComponent(username)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            displayPlayerProfile(data.profile, data.stats, data.alliance);
        } else {
            modal.innerHTML = `<div style="color: #c41e3a; text-align: center; padding: 20px;">Error: ${data.message}</div>`;
        }
    } catch (error) {
        console.error('Error loading player profile:', error);
        modal.innerHTML = '<div style="color: #c41e3a; text-align: center; padding: 20px;">Error loading profile</div>';
    }
}

function displayPlayerProfile(profile, stats, alliance) {
    const modal = document.getElementById('playerProfileModal');
    
    modal.innerHTML = `
        <div style="padding: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h1 style="color: #d4af37; font-size: 24px; margin: 0;">${escapeHtml(profile.displayName || profile.username)}</h1>
                <button onclick="closePlayerProfileModal()" style="padding: 8px 16px; background: linear-gradient(135deg, #c41e3a 0%, #8b1a1a 100%); border: 2px solid #8b6f47; border-radius: 4px; cursor: pointer; color: white; font-weight: bold;">Close</button>
            </div>
            
            <!-- Tabs -->
            <div style="display: flex; gap: 5px; margin-bottom: 15px; border-bottom: 2px solid #8b6f47;">
                <button id="profileTabOverview" onclick="switchProfileTab('overview')" style="flex: 1; padding: 8px; font-size: 12px; background: linear-gradient(135deg, #8b7355 0%, #6b5344 100%); border: 2px solid #d4af37; border-bottom: none; cursor: pointer; border-radius: 4px 4px 0 0; color: #f4e4c1; font-weight: bold;">Overview</button>
                <button id="profileTabAlliance" onclick="switchProfileTab('alliance')" style="flex: 1; padding: 8px; font-size: 12px; background: rgba(139, 111, 71, 0.3); border: 2px solid #8b6f47; border-bottom: none; cursor: pointer; border-radius: 4px 4px 0 0; color: #f4e4c1;">Alliance</button>
            </div>
            
            <!-- Overview Tab -->
            <div id="profileContentOverview" style="display: block;">
                <div style="display: grid; grid-template-columns: auto 1fr; gap: 20px; margin-bottom: 20px;">
                    <div style="text-align: center;">
                        <div style="font-size: 60px; margin-bottom: 10px;">${getAvatarEmoji(profile.avatarId || 1)}</div>
                        <div style="color: #d4af37; font-size: 18px; font-weight: bold;">Level ${stats.level || 1}</div>
                    </div>
                    
                    <div>
                        <p style="color: #aaa; margin-bottom: 5px;">Username: <strong style="color: #f4e4c1;">${escapeHtml(profile.username)}</strong></p>
                        <p style="color: #aaa; margin-bottom: 5px;">Joined: <strong style="color: #f4e4c1;">${new Date(profile.createdAt).toLocaleDateString()}</strong></p>
                        ${profile.bio ? `<p style="color: #aaa; margin-bottom: 5px;">Bio: <span style="color: #f4e4c1;">${escapeHtml(profile.bio)}</span></p>` : ''}
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px;">
                    <div style="text-align: center; padding: 15px; background: rgba(0,0,0,0.3); border: 1px solid #8b6f47; border-radius: 4px;">
                        <div style="color: #4caf50; font-size: 24px; font-weight: bold;">${stats.wins || 0}</div>
                        <div style="color: #aaa; font-size: 12px;">Wins</div>
                    </div>
                    <div style="text-align: center; padding: 15px; background: rgba(0,0,0,0.3); border: 1px solid #8b6f47; border-radius: 4px;">
                        <div style="color: #ff6b6b; font-size: 24px; font-weight: bold;">${stats.losses || 0}</div>
                        <div style="color: #aaa; font-size: 12px;">Losses</div>
                    </div>
                    <div style="text-align: center; padding: 15px; background: rgba(0,0,0,0.3); border: 1px solid #8b6f47; border-radius: 4px;">
                        <div style="color: #d4af37; font-size: 24px; font-weight: bold;">${stats.winRate || 0}%</div>
                        <div style="color: #aaa; font-size: 12px;">Win Rate</div>
                    </div>
                    <div style="text-align: center; padding: 15px; background: rgba(0,0,0,0.3); border: 1px solid #8b6f47; border-radius: 4px;">
                        <div style="color: #ffd700; font-size: 24px; font-weight: bold;">${stats.rank || 'Unranked'}</div>
                        <div style="color: #aaa; font-size: 12px;">Rank</div>
                    </div>
                </div>
            </div>
            
            <!-- Alliance Tab -->
            <div id="profileContentAlliance" style="display: none;">
                ${alliance ? `
                    <div style="padding: 15px; background: rgba(0,0,0,0.3); border: 2px solid #8b6f47; border-radius: 6px;">
                        <h2 style="color: #d4af37; margin-bottom: 10px;">${alliance.alliance_name} [${alliance.alliance_tag}]</h2>
                        <p style="color: #aaa; margin-bottom: 10px;">Tier ${alliance.tier} - ${alliance.liege_username ? `Bannerman of ${alliance.liege_username}` : 'High Lord'}</p>
                        
                        ${alliance.high_lord_name ? `
                            <div style="margin-top: 15px; padding: 10px; background: rgba(139, 111, 71, 0.2); border: 1px solid #8b6f47; border-radius: 4px;">
                                <p style="color: #d4af37; font-weight: bold; margin-bottom: 5px;">High Lord (Tier I):</p>
                                <p style="color: #f4e4c1;">${alliance.high_lord_name}</p>
                            </div>
                        ` : ''}
                        
                        ${alliance.bannermen && alliance.bannermen.length > 0 ? `
                            <div style="margin-top: 15px;">
                                <p style="color: #d4af37; font-weight: bold; margin-bottom: 10px;">Bannermen (${alliance.bannermen.length}/5):</p>
                                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px;">
                                    ${alliance.bannermen.map(b => `
                                        <div style="padding: 8px; background: rgba(139, 111, 71, 0.2); border: 1px solid #8b6f47; border-radius: 4px;">
                                            <strong style="color: #f4e4c1;">${b.display_name || b.username}</strong>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                ` : '<div style="color: #aaa; text-align: center; padding: 20px;">Not in an alliance</div>'}
            </div>
        </div>
    `;
}

function switchProfileTab(tab) {
    ['overview', 'alliance'].forEach(t => {
        const content = document.getElementById(`profileContent${t.charAt(0).toUpperCase() + t.slice(1)}`);
        const btn = document.getElementById(`profileTab${t.charAt(0).toUpperCase() + t.slice(1)}`);
        if (content) content.style.display = tab === t ? 'block' : 'none';
        if (btn) {
            btn.style.background = tab === t 
                ? 'linear-gradient(135deg, #8b7355 0%, #6b5344 100%)' 
                : 'rgba(139, 111, 71, 0.3)';
        }
    });
}

function closePlayerProfileModal() {
    const modal = document.getElementById('playerProfileModal');
    if (modal) modal.style.display = 'none';
}

function getAvatarEmoji(avatarId) {
    const avatars = ['🤴', '👑', '⚔️', '🛡️', '🏰', '🐉', '👸', '🗡️'];
    return avatars[avatarId - 1] || avatars[0];
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

