// ===== CHAT UI =====
let currentChatTab = 'global';
let persistentChatTab = 'global';
let chatMinimized = false;

function initChat() {
    // Get socket from NetworkManager if available
    if (typeof networkManager !== 'undefined' && networkManager.socket) {
        const socket = networkManager.socket;
        
        // Listen for chat messages
        socket.on('globalChatMessage', (data) => {
            if (currentChatTab === 'global' || persistentChatTab === 'global') {
                addChatMessage(data, 'global');
                addPersistentChatMessage(data, 'global');
            }
        });
        
        socket.on('allianceChatMessage', (data) => {
            if (currentChatTab === 'alliance' || persistentChatTab === 'alliance') {
                addChatMessage(data, 'alliance');
                addPersistentChatMessage(data, 'alliance');
            }
        });
    }
}

// Initialize when page loads
if (typeof networkManager !== 'undefined') {
    // Wait for connection
    setTimeout(() => {
        if (networkManager && networkManager.socket) {
            initChat();
        }
    }, 1000);
}

// Show persistent chat on page load (if logged in)
window.addEventListener('load', () => {
    setTimeout(() => {
        const token = localStorage.getItem('token');
        if (token) {
            openPersistentChat();
            loadPersistentChatMessages('global');
        }
    }, 2000);
});

// ===== PERSISTENT CHAT FUNCTIONS =====
function openPersistentChat() {
    document.getElementById('persistentChatBox').style.display = 'flex';
    document.getElementById('chatMinimizeButton').style.display = 'none';
    chatMinimized = false;
    loadPersistentChatMessages(persistentChatTab);
}

function closePersistentChat() {
    document.getElementById('persistentChatBox').style.display = 'none';
    document.getElementById('chatMinimizeButton').style.display = 'flex';
    chatMinimized = true;
}

function toggleChatMinimize() {
    if (chatMinimized) {
        openPersistentChat();
    } else {
        closePersistentChat();
    }
}

function switchPersistentChatTab(tab) {
    persistentChatTab = tab;
    
    // Update tab buttons
    document.getElementById('persistentChatTabGlobal').style.background = tab === 'global' 
        ? 'linear-gradient(135deg, #8b7355 0%, #6b5344 100%)' 
        : 'rgba(139, 111, 71, 0.3)';
    document.getElementById('persistentChatTabAlliance').style.background = tab === 'alliance' 
        ? 'linear-gradient(135deg, #8b7355 0%, #6b5344 100%)' 
        : 'rgba(139, 111, 71, 0.3)';
    
    loadPersistentChatMessages(tab);
}

async function loadPersistentChatMessages(tab) {
    const messagesDiv = document.getElementById('persistentChatMessages');
    if (!messagesDiv) return;
    
    messagesDiv.innerHTML = '<div style="color: #aaa; text-align: center; padding: 10px;">Loading...</div>';
    
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            messagesDiv.innerHTML = '<div style="color: #c41e3a; text-align: center; padding: 10px; font-size: 11px;">Please log in</div>';
            return;
        }
        
        let response;
        if (tab === 'global') {
            response = await fetch('/api/chat/global?limit=20', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
        } else if (tab === 'alliance') {
            response = await fetch('/api/chat/alliance?limit=20', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
        }
        
        if (!response) {
            messagesDiv.innerHTML = '<div style="color: #aaa; text-align: center; padding: 10px; font-size: 11px;">Unable to connect to chat server</div>';
            return;
        }
        
        // Check if response is OK and is JSON
        if (!response.ok) {
            if (response.status === 404) {
                messagesDiv.innerHTML = '<div style="color: #aaa; text-align: center; padding: 10px; font-size: 11px;">Chat feature not available. Please restart the server.</div>';
            } else {
                messagesDiv.innerHTML = `<div style="color: #c41e3a; text-align: center; padding: 10px; font-size: 11px;">Error: HTTP ${response.status}</div>`;
            }
            return;
        }
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            messagesDiv.innerHTML = '<div style="color: #c41e3a; text-align: center; padding: 10px; font-size: 11px;">Invalid response from server</div>';
            return;
        }
        
        const data = await response.json();
        
        if (data.success) {
            messagesDiv.innerHTML = '';
            
            if (data.messages && data.messages.length > 0) {
                data.messages.forEach(msg => {
                    addPersistentChatMessage(msg, tab, false);
                });
            } else {
                messagesDiv.innerHTML = '<div style="color: #aaa; text-align: center; padding: 10px; font-size: 11px;">No messages yet</div>';
            }
            
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        } else {
            messagesDiv.innerHTML = `<div style="color: #c41e3a; text-align: center; padding: 10px; font-size: 11px;">Error: ${data.message || 'Failed to load'}</div>`;
        }
    } catch (error) {
        console.error('Error loading persistent chat:', error);
        const messagesDiv = document.getElementById('persistentChatMessages');
        if (messagesDiv) {
            messagesDiv.innerHTML = '<div style="color: #aaa; text-align: center; padding: 10px; font-size: 11px;">Unable to load messages</div>';
        }
    }
}

function addPersistentChatMessage(msg, tab, scroll = true) {
    const messagesDiv = document.getElementById('persistentChatMessages');
    if (!messagesDiv) return;
    
    const msgDiv = document.createElement('div');
    msgDiv.style.cssText = 'padding: 6px; margin-bottom: 4px; background: rgba(139, 111, 71, 0.2); border-left: 2px solid #d4af37; border-radius: 3px; font-size: 11px;';
    
    const timestamp = msg.timestamp ? new Date(msg.timestamp) : new Date(msg.created_at);
    const username = msg.username || msg.sender_username || 'Unknown';
    
    msgDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
            <strong style="color: #d4af37; cursor: pointer; text-decoration: underline;" onclick="viewPlayerProfile('${username}')">${escapeHtml(username)}</strong>
            <span style="color: #aaa; font-size: 10px;">${timestamp.toLocaleTimeString()}</span>
        </div>
        <div style="color: #f4e4c1; font-size: 11px;">${escapeHtml(msg.message || msg.body)}</div>
    `;
    
    messagesDiv.appendChild(msgDiv);
    
    if (scroll) {
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
}

async function sendPersistentChatMessage() {
    const input = document.getElementById('persistentChatInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    const socket = (typeof networkManager !== 'undefined' && networkManager.socket) ? networkManager.socket : null;
    
    if (!socket || !socket.connected) {
        alert('Not connected to server');
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            alert('Please log in to send messages');
            return;
        }
        
        if (persistentChatTab === 'global') {
            socket.emit('globalChatMessage', { message });
        } else if (persistentChatTab === 'alliance') {
            socket.emit('allianceChatMessage', { message });
        }
        
        input.value = '';
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message');
    }
}

function viewPlayerProfile(username) {
    // Open profile view modal for the clicked player
    if (typeof openPlayerProfileModal === 'function') {
        openPlayerProfileModal(username);
    } else {
        // Fallback - open account dashboard and search
        alert(`Viewing profile for: ${username}\n\nProfile viewer will be implemented.`);
    }
}

function openChatModal() {
    document.getElementById('chatModal').style.display = 'flex';
    switchChatTab('global');
    loadChatMessages('global');
}

function closeChatModal() {
    document.getElementById('chatModal').style.display = 'none';
}

function switchChatTab(tab) {
    currentChatTab = tab;
    
    // Update tab buttons
    document.getElementById('chatTabGlobal').style.background = tab === 'global' 
        ? 'linear-gradient(135deg, #8b7355 0%, #6b5344 100%)' 
        : 'rgba(139, 111, 71, 0.3)';
    document.getElementById('chatTabAlliance').style.background = tab === 'alliance' 
        ? 'linear-gradient(135deg, #8b7355 0%, #6b5344 100%)' 
        : 'rgba(139, 111, 71, 0.3)';
    document.getElementById('chatTabPrivate').style.background = tab === 'private' 
        ? 'linear-gradient(135deg, #8b7355 0%, #6b5344 100%)' 
        : 'rgba(139, 111, 71, 0.3)';
    
    // Load messages for selected tab
    loadChatMessages(tab);
}

async function loadChatMessages(tab) {
    const messagesDiv = document.getElementById('chatMessages');
    messagesDiv.innerHTML = '<div style="color: #aaa; text-align: center; padding: 20px;">Loading messages...</div>';
    
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            messagesDiv.innerHTML = '<div style="color: #c41e3a; text-align: center; padding: 20px;">Please log in to use chat</div>';
            return;
        }
        
        let response;
        if (tab === 'global') {
            response = await fetch('/api/chat/global', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
        } else if (tab === 'alliance') {
            response = await fetch('/api/chat/alliance', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
        } else {
            // Private messages - use existing messages API
            response = await fetch('/api/messages?unreadOnly=false', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
        }
        
        const data = await response.json();
        
        if (data.success) {
            messagesDiv.innerHTML = '';
            
            if (tab === 'private') {
                // Display private messages differently
                if (data.messages && data.messages.length > 0) {
                    data.messages.forEach(msg => {
                        const msgDiv = document.createElement('div');
                        msgDiv.style.cssText = 'padding: 10px; margin-bottom: 8px; background: rgba(139, 111, 71, 0.2); border-left: 3px solid #d4af37; border-radius: 4px;';
                        msgDiv.innerHTML = `
                            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                                <strong style="color: #d4af37;">${msg.sender_username}</strong>
                                <span style="color: #aaa; font-size: 12px;">${new Date(msg.created_at).toLocaleString()}</span>
                            </div>
                            <div style="color: #f4e4c1;">${msg.subject ? `<strong>${msg.subject}:</strong> ` : ''}${msg.body}</div>
                        `;
                        messagesDiv.appendChild(msgDiv);
                    });
                } else {
                    messagesDiv.innerHTML = '<div style="color: #aaa; text-align: center; padding: 20px;">No private messages</div>';
                }
            } else {
                // Global or Alliance chat
                if (data.messages && data.messages.length > 0) {
                    data.messages.forEach(msg => {
                        addChatMessage(msg, tab, false);
                    });
                } else {
                    messagesDiv.innerHTML = '<div style="color: #aaa; text-align: center; padding: 20px;">No messages yet</div>';
                }
            }
            
            // Scroll to bottom
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        } else {
            messagesDiv.innerHTML = `<div style="color: #c41e3a; text-align: center; padding: 20px;">Error: ${data.message}</div>`;
        }
    } catch (error) {
        console.error('Error loading chat messages:', error);
        messagesDiv.innerHTML = '<div style="color: #c41e3a; text-align: center; padding: 20px;">Error loading messages</div>';
    }
}

function addChatMessage(msg, tab, scroll = true) {
    const messagesDiv = document.getElementById('chatMessages');
    if (!messagesDiv) return;
    
    const msgDiv = document.createElement('div');
    msgDiv.style.cssText = 'padding: 10px; margin-bottom: 8px; background: rgba(139, 111, 71, 0.2); border-left: 3px solid #d4af37; border-radius: 4px;';
    
    const timestamp = msg.timestamp ? new Date(msg.timestamp) : new Date(msg.created_at);
    const username = msg.username || msg.sender_username || 'Unknown';
    
    msgDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
            <strong style="color: #d4af37; cursor: pointer; text-decoration: underline;" onclick="viewPlayerProfile('${username}')">${escapeHtml(username)}</strong>
            <span style="color: #aaa; font-size: 12px;">${timestamp.toLocaleTimeString()}</span>
        </div>
        <div style="color: #f4e4c1;">${escapeHtml(msg.message || msg.body)}</div>
    `;
    
    messagesDiv.appendChild(msgDiv);
    
    if (scroll) {
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
}

async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    // Get socket from NetworkManager
    const socket = (typeof networkManager !== 'undefined' && networkManager.socket) ? networkManager.socket : null;
    
    if (!socket || !socket.connected) {
        alert('Not connected to server');
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            alert('Please log in to send messages');
            return;
        }
        
        if (currentChatTab === 'global') {
            socket.emit('globalChatMessage', { message });
        } else if (currentChatTab === 'alliance') {
            socket.emit('allianceChatMessage', { message });
        } else {
            // Private messages - would need recipient selection
            alert('Private messages require selecting a recipient');
            return;
        }
        
        input.value = '';
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message');
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

