// ===== ADVENTURE MODE UI =====

function openAdventureMode() {
    const modal = document.getElementById('adventureModeModal');
    if (modal) {
        modal.style.display = 'flex';
        loadAdventureMap();
    }
}

function closeAdventureMode() {
    const modal = document.getElementById('adventureModeModal');
    if (modal) modal.style.display = 'none';
}

function loadAdventureMap() {
    // Load adventure locations and user progress
    fetch('/api/adventure/locations', {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            displayAdventureMap(data.locations, data.progress);
        }
    })
    .catch(err => {
        console.error('Error loading adventure map:', err);
    });
}

function displayAdventureMap(locations, progress) {
    const container = document.getElementById('adventureMapContainer');
    if (!container) return;
    
    // Create interactive globe/map
    container.innerHTML = `
        <div style="position: relative; width: 100%; height: 500px; background: rgba(0,0,0,0.3); border: 2px solid #8b6f47; border-radius: 8px; overflow: hidden;">
            <div id="globeContainer" style="width: 100%; height: 100%; position: relative; cursor: grab;">
                ${locations.map(loc => {
                    const isCleared = progress && progress.clearedLocations && progress.clearedLocations.includes(loc.id);
                    const x = loc.x || Math.random() * 80 + 10;
                    const y = loc.y || Math.random() * 80 + 10;
                    
                    return `
                        <div 
                            onclick="challengeAdventureLocation('${loc.id}')" 
                            style="position: absolute; left: ${x}%; top: ${y}%; transform: translate(-50%, -50%); cursor: pointer; z-index: 10;"
                            title="${loc.name} - ${loc.description}"
                        >
                            <div style="font-size: 24px; filter: ${isCleared ? 'grayscale(0.5)' : 'none'};">
                                ${isCleared ? '✅' : loc.icon || '📍'}
                            </div>
                            <div style="background: rgba(0,0,0,0.8); padding: 4px 8px; border-radius: 4px; border: 1px solid #8b6f47; font-size: 11px; color: #f4e4c1; white-space: nowrap; margin-top: 5px;">
                                ${escapeHtml(loc.name)}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
        <div style="margin-top: 15px; padding: 10px; background: rgba(0,0,0,0.3); border: 1px solid #8b6f47; border-radius: 4px;">
            <div style="color: #d4af37; font-size: 12px; font-weight: bold; margin-bottom: 5px;">Progress</div>
            <div style="color: #f4e4c1; font-size: 14px;">
                Locations Cleared: ${progress ? (progress.clearedLocations?.length || 0) : 0} / ${locations.length}
            </div>
        </div>
    `;
}

function challengeAdventureLocation(locationId) {
    if (confirm('Challenge this location? You will face a historical leader or event.')) {
        // Start adventure battle
        fetch('/api/adventure/challenge', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ locationId })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                closeAdventureMode();
                // Start the game with the adventure opponent
                startAdventureBattle(data.battle);
            } else {
                alert(data.message || 'Failed to start adventure battle');
            }
        })
        .catch(err => {
            console.error('Error starting adventure:', err);
            alert('Error starting adventure battle');
        });
    }
}

function startAdventureBattle(battleData) {
    // Close adventure modal
    closeAdventureMode();
    
    // Start single player game with adventure opponent
    window.adventureMode = true;
    window.adventureLocationId = battleData.locationId;
    startSinglePlayer();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Expose functions to window
if (typeof window !== 'undefined') {
    window.openAdventureMode = openAdventureMode;
    window.closeAdventureMode = closeAdventureMode;
}

