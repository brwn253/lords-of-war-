// ===== ALLIANCE UI =====

function openAllianceModal() {
    document.getElementById('allianceModal').style.display = 'flex';
    loadAllianceData();
}

function closeAllianceModal() {
    document.getElementById('allianceModal').style.display = 'none';
}

async function loadAllianceData() {
    const contentDiv = document.getElementById('allianceContent');
    contentDiv.innerHTML = '<div style="color: #aaa; text-align: center; padding: 20px;">Loading...</div>';
    
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            contentDiv.innerHTML = '<div style="color: #c41e3a; text-align: center; padding: 20px;">Please log in</div>';
            return;
        }
        
        const response = await fetch('/api/alliance', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            if (data.alliance) {
                // User is in an alliance - show alliance info
                displayAllianceInfo(data.alliance);
            } else {
                // User is not in an alliance - show create/join options
                displayNoAlliance();
            }
        } else {
            contentDiv.innerHTML = `<div style="color: #c41e3a; text-align: center; padding: 20px;">Error: ${data.message}</div>`;
        }
    } catch (error) {
        console.error('Error loading alliance data:', error);
        contentDiv.innerHTML = '<div style="color: #c41e3a; text-align: center; padding: 20px;">Error loading alliance data</div>';
    }
}

function displayAllianceInfo(alliance) {
    const contentDiv = document.getElementById('allianceContent');
    
    contentDiv.innerHTML = `
        <div style="padding: 20px; background: rgba(0,0,0,0.3); border: 2px solid #8b6f47; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #d4af37; margin-bottom: 10px;">${alliance.alliance_name} [${alliance.alliance_tag}]</h2>
            <p style="color: #aaa; margin-bottom: 15px;">Tier ${alliance.tier} - ${alliance.liege_username ? `Bannerman of ${alliance.liege_username}` : 'High Lord'}</p>
            
            <div style="margin-bottom: 15px;">
                <h3 style="color: #d4af37; margin-bottom: 10px;">Your Bannermen (${alliance.bannerman_count || 0}/5)</h3>
                <div id="bannermenList" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px;">
                    ${alliance.bannermen && alliance.bannermen.length > 0 
                        ? alliance.bannermen.map(b => `
                            <div style="padding: 10px; background: rgba(139, 111, 71, 0.2); border: 1px solid #8b6f47; border-radius: 4px;">
                                <strong style="color: #f4e4c1;">${b.display_name || b.username}</strong>
                            </div>
                        `).join('')
                        : '<div style="color: #aaa;">No bannermen</div>'
                    }
                </div>
            </div>
            
            <div style="display: flex; gap: 10px;">
                <button onclick="showFealtyRequests()" style="flex: 1; padding: 10px; background: linear-gradient(135deg, #2ecc71 0%, #27ae60 100%); border: 2px solid #8b6f47; border-radius: 4px; cursor: pointer; color: white; font-weight: bold;">View Requests</button>
                <button onclick="showApplyFealty()" style="flex: 1; padding: 10px; background: rgba(139, 111, 71, 0.3); border: 2px solid #8b6f47; border-radius: 4px; cursor: pointer; color: #f4e4c1;">Apply to Liege</button>
                <button onclick="leaveAlliance()" style="flex: 1; padding: 10px; background: linear-gradient(135deg, #c41e3a 0%, #8b1a1a 100%); border: 2px solid #8b6f47; border-radius: 4px; cursor: pointer; color: white; font-weight: bold;">Leave Alliance</button>
            </div>
        </div>
    `;
}

function displayNoAlliance() {
    const contentDiv = document.getElementById('allianceContent');
    
    contentDiv.innerHTML = `
        <div style="padding: 20px; background: rgba(0,0,0,0.3); border: 2px solid #8b6f47; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #d4af37; margin-bottom: 15px; text-align: center;">You are not in an alliance</h2>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                <div style="padding: 15px; background: rgba(139, 111, 71, 0.2); border: 2px solid #8b6f47; border-radius: 6px;">
                    <h3 style="color: #d4af37; margin-bottom: 10px;">Create Alliance</h3>
                    <p style="color: #aaa; margin-bottom: 15px; font-size: 14px;">Start your own alliance and become a High Lord</p>
                    <button onclick="showCreateAlliance()" style="width: 100%; padding: 10px; background: linear-gradient(135deg, #2ecc71 0%, #27ae60 100%); border: 2px solid #8b6f47; border-radius: 4px; cursor: pointer; color: white; font-weight: bold;">Create</button>
                </div>
                
                <div style="padding: 15px; background: rgba(139, 111, 71, 0.2); border: 2px solid #8b6f47; border-radius: 6px;">
                    <h3 style="color: #d4af37; margin-bottom: 10px;">Join Alliance</h3>
                    <p style="color: #aaa; margin-bottom: 15px; font-size: 14px;">Swear fealty to another player</p>
                    <button onclick="showApplyFealty()" style="width: 100%; padding: 10px; background: rgba(139, 111, 71, 0.3); border: 2px solid #8b6f47; border-radius: 4px; cursor: pointer; color: #f4e4c1;">Apply</button>
                </div>
            </div>
        </div>
    `;
}

function showCreateAlliance() {
    const contentDiv = document.getElementById('allianceContent');
    
    contentDiv.innerHTML = `
        <div style="padding: 20px; background: rgba(0,0,0,0.3); border: 2px solid #8b6f47; border-radius: 8px;">
            <h2 style="color: #d4af37; margin-bottom: 20px;">Create Alliance</h2>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; color: #d4af37; margin-bottom: 5px;">Alliance Name:</label>
                <input type="text" id="allianceNameInput" placeholder="Enter alliance name" maxlength="50" style="width: 100%; padding: 10px; border: 2px solid #8b6f47; background: rgba(0,0,0,0.5); color: #f4e4c1; border-radius: 4px;">
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; color: #d4af37; margin-bottom: 5px;">Alliance Tag (3-5 characters):</label>
                <input type="text" id="allianceTagInput" placeholder="TAG" maxlength="5" style="width: 100%; padding: 10px; border: 2px solid #8b6f47; background: rgba(0,0,0,0.5); color: #f4e4c1; border-radius: 4px; text-transform: uppercase;">
            </div>
            
            <div style="display: flex; gap: 10px;">
                <button onclick="createAlliance()" style="flex: 1; padding: 12px; background: linear-gradient(135deg, #2ecc71 0%, #27ae60 100%); border: 2px solid #8b6f47; border-radius: 4px; cursor: pointer; color: white; font-weight: bold;">Create</button>
                <button onclick="loadAllianceData()" style="flex: 1; padding: 12px; background: rgba(139, 111, 71, 0.3); border: 2px solid #8b6f47; border-radius: 4px; cursor: pointer; color: #f4e4c1;">Cancel</button>
            </div>
        </div>
    `;
}

async function createAlliance() {
    const name = document.getElementById('allianceNameInput').value.trim();
    const tag = document.getElementById('allianceTagInput').value.trim().toUpperCase();
    
    if (!name || !tag || tag.length < 3) {
        alert('Please enter alliance name and tag (3-5 characters)');
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/alliance/create', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, tag })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('Alliance created successfully!');
            loadAllianceData();
        } else {
            alert(`Error: ${data.message}`);
        }
    } catch (error) {
        console.error('Error creating alliance:', error);
        alert('Failed to create alliance');
    }
}

function showApplyFealty() {
    const contentDiv = document.getElementById('allianceContent');
    
    contentDiv.innerHTML = `
        <div style="padding: 20px; background: rgba(0,0,0,0.3); border: 2px solid #8b6f47; border-radius: 8px;">
            <h2 style="color: #d4af37; margin-bottom: 20px;">Apply to Swear Fealty</h2>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; color: #d4af37; margin-bottom: 5px;">Liege Username:</label>
                <input type="text" id="liegeUsernameInput" placeholder="Enter username" style="width: 100%; padding: 10px; border: 2px solid #8b6f47; background: rgba(0,0,0,0.5); color: #f4e4c1; border-radius: 4px;">
            </div>
            
            <div style="display: flex; gap: 10px;">
                <button onclick="applyFealty()" style="flex: 1; padding: 12px; background: linear-gradient(135deg, #2ecc71 0%, #27ae60 100%); border: 2px solid #8b6f47; border-radius: 4px; cursor: pointer; color: white; font-weight: bold;">Apply</button>
                <button onclick="loadAllianceData()" style="flex: 1; padding: 12px; background: rgba(139, 111, 71, 0.3); border: 2px solid #8b6f47; border-radius: 4px; cursor: pointer; color: #f4e4c1;">Cancel</button>
            </div>
        </div>
    `;
}

async function applyFealty() {
    const username = document.getElementById('liegeUsernameInput').value.trim();
    
    if (!username) {
        alert('Please enter a username');
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/alliance/apply', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ liegeUsername: username })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('Fealty request sent!');
            loadAllianceData();
        } else {
            alert(`Error: ${data.message}`);
        }
    } catch (error) {
        console.error('Error applying fealty:', error);
        alert('Failed to send fealty request');
    }
}

async function showFealtyRequests() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/alliance/requests', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            const contentDiv = document.getElementById('allianceContent');
            contentDiv.innerHTML = `
                <div style="padding: 20px; background: rgba(0,0,0,0.3); border: 2px solid #8b6f47; border-radius: 8px;">
                    <h2 style="color: #d4af37; margin-bottom: 20px;">Fealty Requests</h2>
                    
                    ${data.requests && data.requests.length > 0
                        ? data.requests.map(req => `
                            <div style="padding: 15px; margin-bottom: 10px; background: rgba(139, 111, 71, 0.2); border: 1px solid #8b6f47; border-radius: 4px;">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <strong style="color: #f4e4c1;">${req.requester_username}</strong>
                                        <p style="color: #aaa; font-size: 12px; margin-top: 5px;">${new Date(req.created_at).toLocaleString()}</p>
                                    </div>
                                    <div style="display: flex; gap: 10px;">
                                        <button onclick="acceptFealtyRequest(${req.id})" style="padding: 8px 15px; background: linear-gradient(135deg, #2ecc71 0%, #27ae60 100%); border: 2px solid #8b6f47; border-radius: 4px; cursor: pointer; color: white; font-weight: bold;">Accept</button>
                                        <button onclick="rejectFealtyRequest(${req.id})" style="padding: 8px 15px; background: linear-gradient(135deg, #c41e3a 0%, #8b1a1a 100%); border: 2px solid #8b6f47; border-radius: 4px; cursor: pointer; color: white; font-weight: bold;">Reject</button>
                                    </div>
                                </div>
                            </div>
                        `).join('')
                        : '<div style="color: #aaa; text-align: center; padding: 20px;">No pending requests</div>'
                    }
                    
                    <button onclick="loadAllianceData()" style="margin-top: 20px; padding: 10px 20px; background: rgba(139, 111, 71, 0.3); border: 2px solid #8b6f47; border-radius: 4px; cursor: pointer; color: #f4e4c1;">Back</button>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading fealty requests:', error);
    }
}

async function acceptFealtyRequest(requestId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/alliance/requests/${requestId}/accept`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('Fealty request accepted!');
            showFealtyRequests();
        } else {
            alert(`Error: ${data.message}`);
        }
    } catch (error) {
        console.error('Error accepting request:', error);
        alert('Failed to accept request');
    }
}

async function rejectFealtyRequest(requestId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/alliance/requests/${requestId}/reject`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('Fealty request rejected');
            showFealtyRequests();
        } else {
            alert(`Error: ${data.message}`);
        }
    } catch (error) {
        console.error('Error rejecting request:', error);
        alert('Failed to reject request');
    }
}

async function leaveAlliance() {
    if (!confirm('Are you sure you want to leave your alliance? You must release all bannermen first.')) {
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/alliance/leave', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('Left alliance successfully');
            loadAllianceData();
        } else {
            alert(`Error: ${data.message}`);
        }
    } catch (error) {
        console.error('Error leaving alliance:', error);
        alert('Failed to leave alliance');
    }
}

