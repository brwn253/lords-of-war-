// ===== CARD COLLECTION UI =====
let currentCollectionTab = 'manage';

function openCollectionModal() {
    document.getElementById('collectionModal').style.display = 'flex';
    switchCollectionTab('manage');
}

function closeCollectionModal() {
    document.getElementById('collectionModal').style.display = 'none';
}

function switchCollectionTab(tab) {
    currentCollectionTab = tab;
    
    // Update tab buttons
    ['manage', 'build', 'custom', 'unopened'].forEach(t => {
        const btn = document.getElementById(`collectionTab${t.charAt(0).toUpperCase() + t.slice(1)}`);
        if (btn) {
            btn.style.background = tab === t 
                ? 'linear-gradient(135deg, #8b7355 0%, #6b5344 100%)' 
                : 'rgba(139, 111, 71, 0.3)';
        }
    });
    
    // Load content
    if (tab === 'manage') {
        loadCardCollection();
    } else if (tab === 'build') {
        // Open deck builder from collection modal
        closeCollectionModal();
        if (typeof window.openDeckBuilderFromDashboard === 'function') {
            window.openDeckBuilderFromDashboard();
        } else if (typeof window.openDeckBuilder === 'function') {
            window.openDeckBuilder();
        } else {
            alert('Deck Builder is not available. Please refresh the page.');
        }
    } else if (tab === 'custom') {
        loadCustomDecks();
    } else if (tab === 'unopened') {
        loadUnopenedProducts();
    }
}

async function loadCardCollection() {
    const contentDiv = document.getElementById('collectionContent');
    if (!contentDiv) {
        console.error('[COLLECTION] collectionContent div not found');
        return;
    }
    contentDiv.innerHTML = '<div style="color: #aaa; text-align: center; padding: 20px;">Loading collection...</div>';
    
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            contentDiv.innerHTML = '<div style="color: #c41e3a; text-align: center; padding: 20px;">Please log in to view your collection</div>';
            return;
        }
        
        const response = await fetch('/api/collection', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error('Response is not JSON');
        }
        
        const data = await response.json();
        
        console.log('[COLLECTION UI] Received data:', data);
        
        if (data.success) {
            // Group cards by type
            const cards = data.cards || [];
            const cardTypes = {
                ranged: [],
                infantry: [],
                cavalry: [],
                ability: [],
                equipment: [],
                other: []
            };
            
            // CARD_DATABASE mapping - matches server-side mapping
            const cardTypeMap = {
                // Ranged Units
                'skirmisher': 'ranged', 'archer': 'ranged', 'crossbow': 'ranged', 'scout': 'ranged', 'watchTower': 'ranged',
                // Ranged Abilities
                'quickShot': 'ability', 'aimedShot': 'ability', 'masterShot': 'ability', 'rangersMark': 'ability',
                'bowEnchantment': 'ability', 'quiverRefill': 'ability', 'launchNet': 'ability',
                // Ranged Equipment/Weapons
                'bow': 'equipment', 'clothCoif': 'equipment', 'paddedClothArmor': 'equipment', 
                'paddedClothChaps': 'equipment', 'rangerBoots': 'equipment',
                // Infantry Units
                'footman': 'infantry', 'swordsman': 'infantry', 'knight': 'infantry', 'sergeant': 'infantry', 'battleMedic': 'infantry',
                // Infantry Abilities
                'quickStrike': 'ability', 'focusStrike': 'ability', 'swordEnchantment': 'ability',
                'supplyLine': 'ability', 'shieldWall': 'ability', 'disarm': 'ability',
                // Infantry Equipment/Weapons
                'sword': 'equipment', 'plateHelmet': 'equipment', 'plateBody': 'equipment', 
                'plateLegs': 'equipment', 'kiteShield': 'equipment', 'plateBoots': 'equipment',
                // Cavalry Units
                'horseman': 'cavalry', 'camelRider': 'cavalry', 'mountedKnight': 'cavalry', 'messenger': 'cavalry',
                // Cavalry Abilities
                'quickCharge': 'ability', 'focusCharge': 'ability', 'axeEnchantment': 'ability',
                'courierNetwork': 'ability', 'cavalryFormation': 'ability', 'sabotage': 'ability',
                // Cavalry Equipment/Weapons
                'axe': 'equipment', 'leatherCap': 'equipment', 'leatherArmor': 'equipment', 
                'leatherLeggings': 'equipment', 'leatherShield': 'equipment', 'leatherBoots': 'equipment'
            };
            
            cards.forEach(card => {
                const type = cardTypeMap[card.card_id] || 'other';
                if (cardTypes[type]) {
                    cardTypes[type].push(card);
                } else {
                    cardTypes.other.push(card);
                }
            });
            
            if (cards.length > 0) {
                let html = '<div style="max-height: 500px; overflow-y: auto;">';
                
                // Ranged Cards
                if (cardTypes.ranged.length > 0) {
                    html += createCardTypeSection('Ranged', cardTypes.ranged);
                }
                
                // Infantry Cards
                if (cardTypes.infantry.length > 0) {
                    html += createCardTypeSection('Infantry', cardTypes.infantry);
                }
                
                // Cavalry Cards
                if (cardTypes.cavalry.length > 0) {
                    html += createCardTypeSection('Cavalry', cardTypes.cavalry);
                }
                
                // Ability Cards
                if (cardTypes.ability.length > 0) {
                    html += createCardTypeSection('Abilities', cardTypes.ability);
                }
                
                // Other Cards
                if (cardTypes.other.length > 0) {
                    html += createCardTypeSection('Other', cardTypes.other);
                }
                
                html += '</div>';
                contentDiv.innerHTML = html;
            } else {
                contentDiv.innerHTML = `
                    <div style="color: #aaa; text-align: center; padding: 20px;">
                        <p>Your collection is empty</p>
                        <p style="margin-top: 10px; font-size: 12px; color: #888;">If you're an existing user, you may need starter cards.</p>
                        <button onclick="addStarterCards()" style="margin-top: 10px; padding: 8px 16px; background: linear-gradient(135deg, #2ecc71 0%, #27ae60 100%); border: 2px solid #8b6f47; border-radius: 4px; cursor: pointer; color: white; font-weight: bold;">Add Starter Cards</button>
                    </div>
                `;
            }
        } else {
            contentDiv.innerHTML = `<div style="color: #c41e3a; text-align: center; padding: 20px;">Error: ${data.message || 'Failed to load'}</div>`;
        }
    } catch (error) {
        console.error('Error loading collection:', error);
        contentDiv.innerHTML = '<div style="color: #c41e3a; text-align: center; padding: 20px;">Error loading collection</div>';
    }
}

function createCardTypeSection(typeName, cards) {
    const typeId = typeName.toLowerCase().replace(/\s+/g, '');
    return `
        <div style="margin-bottom: 15px;">
            <button onclick="toggleCardSection('${typeId}')" style="width: 100%; padding: 10px; background: linear-gradient(135deg, #8b7355 0%, #6b5344 100%); border: 2px solid #d4af37; border-radius: 4px; cursor: pointer; color: #f4e4c1; font-weight: bold; text-align: left; display: flex; justify-content: space-between; align-items: center;">
                <span>${typeName} (${cards.length})</span>
                <span id="${typeId}Toggle">▼</span>
            </button>
            <div id="${typeId}Section" style="display: none; margin-top: 10px; padding: 10px; background: rgba(0,0,0,0.2); border: 1px solid #8b6f47; border-radius: 4px;">
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px;">
                    ${cards.map(card => `
                        <div style="padding: 8px; background: rgba(139, 111, 71, 0.2); border: 1px solid #8b6f47; border-radius: 4px;">
                            <div style="color: #d4af37; font-weight: bold; font-size: 12px; margin-bottom: 4px;">${escapeHtml(card.card_id)}</div>
                            <div style="color: #aaa; font-size: 11px; margin-bottom: 6px;">Qty: ${card.quantity}</div>
                            <div style="display: flex; gap: 4px;">
                                <button onclick="viewCard('${card.card_id}')" style="flex: 1; padding: 4px; font-size: 10px; background: rgba(139, 111, 71, 0.3); border: 1px solid #8b6f47; border-radius: 3px; cursor: pointer; color: #f4e4c1;">View</button>
                                <button onclick="salvageCard('${card.card_id}')" style="flex: 1; padding: 4px; font-size: 10px; background: linear-gradient(135deg, #e67e22 0%, #d35400 100%); border: 1px solid #8b6f47; border-radius: 3px; cursor: pointer; color: white;">Salvage</button>
                                <button onclick="sellCard('${card.card_id}')" style="flex: 1; padding: 4px; font-size: 10px; background: linear-gradient(135deg, #d4af37 0%, #b8941f 100%); border: 1px solid #8b6f47; border-radius: 3px; cursor: pointer; color: white;">Sell</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

function toggleCardSection(typeId) {
    const section = document.getElementById(`${typeId}Section`);
    const toggle = document.getElementById(`${typeId}Toggle`);
    if (section && toggle) {
        if (section.style.display === 'none') {
            section.style.display = 'block';
            toggle.textContent = '▲';
        } else {
            section.style.display = 'none';
            toggle.textContent = '▼';
        }
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function viewCard(cardId) {
    // Show card details - you'll need to fetch card data from CARD_DATABASE
    alert(`Viewing card: ${cardId}\n\nThis will show detailed card information.`);
}

async function salvageCard(cardId) {
    const quantity = prompt('How many to salvage?', '1');
    if (!quantity || parseInt(quantity) <= 0) return;
    
    if (!confirm(`Salvage ${quantity} ${cardId}? You will receive fragments and scrap.`)) {
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/collection/salvage', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ cardId, quantity: parseInt(quantity) })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(`Salvaged! Received ${data.fragments} fragments and ${data.scrap} scrap.`);
            loadCardCollection();
        } else {
            alert(`Error: ${data.message}`);
        }
    } catch (error) {
        console.error('Error salvaging card:', error);
        alert('Failed to salvage card');
    }
}

function sellCard(cardId) {
    // Open auction house with this card pre-selected
    closeCollectionModal();
    openAuctionModal();
    switchAuctionTab('list');
    // You'll need to pre-fill the form with this card
    setTimeout(() => {
        document.getElementById('listItemType').value = 'card';
        document.getElementById('listItemId').value = cardId;
        updateListItemForm();
    }, 100);
}

async function loadCustomDecks() {
    const contentDiv = document.getElementById('collectionContent');
    if (!contentDiv) {
        console.error('[COLLECTION] collectionContent div not found');
        return;
    }
    contentDiv.innerHTML = '<div style="color: #aaa; text-align: center; padding: 20px;">Loading custom decks...</div>';
    
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            contentDiv.innerHTML = '<div style="color: #c41e3a; text-align: center; padding: 20px;">Please log in to view your decks</div>';
            return;
        }
        
        const userData = JSON.parse(sessionStorage.getItem('userData') || '{}');
        const userId = userData.userId;
        
        if (!userId) {
            contentDiv.innerHTML = '<div style="color: #c41e3a; text-align: center; padding: 20px;">User ID not found</div>';
            return;
        }
        
        const response = await fetch(`/api/deck/${userId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.decks && data.decks.length > 0) {
            contentDiv.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 15px;">
                    ${data.decks.map(deck => `
                        <div style="padding: 15px; background: rgba(0,0,0,0.3); border: 2px solid #8b6f47; border-radius: 6px;">
                            <h3 style="color: #d4af37; margin-bottom: 10px;">${escapeHtml(deck.deck_name || 'Unnamed Deck')}</h3>
                            <p style="color: #aaa; font-size: 12px; margin-bottom: 5px;">Hero: ${deck.hero_name || 'Unknown'}</p>
                            <p style="color: #aaa; font-size: 12px; margin-bottom: 10px;">Cards: ${deck.card_count || 0}</p>
                            <div style="display: flex; gap: 8px;">
                                <button onclick="editDeckFromCollection(${deck.id})" style="flex: 1; padding: 8px; background: linear-gradient(135deg, #4a90e2 0%, #2563eb 100%); border: 1px solid #8b6f47; border-radius: 4px; cursor: pointer; color: white; font-weight: bold; font-size: 12px;">Edit</button>
                                <button onclick="deleteDeckFromCollection(${deck.id})" style="flex: 1; padding: 8px; background: linear-gradient(135deg, #c41e3a 0%, #8b1a1a 100%); border: 1px solid #8b6f47; border-radius: 4px; cursor: pointer; color: white; font-weight: bold; font-size: 12px;">Delete</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            contentDiv.innerHTML = `
                <div style="padding: 20px; background: rgba(0,0,0,0.3); border: 2px solid #8b6f47; border-radius: 8px; text-align: center;">
                    <p style="color: #aaa; margin-bottom: 15px;">No custom decks found.</p>
                    <button onclick="switchCollectionTab('build')" style="padding: 10px 20px; background: linear-gradient(135deg, #2ecc71 0%, #27ae60 100%); border: 2px solid #8b6f47; border-radius: 4px; cursor: pointer; color: white; font-weight: bold;">Create Your First Deck</button>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading custom decks:', error);
        contentDiv.innerHTML = '<div style="color: #c41e3a; text-align: center; padding: 20px;">Error loading decks. Please try again.</div>';
    }
}

async function loadUnopenedProducts() {
    const contentDiv = document.getElementById('collectionContent');
    if (!contentDiv) {
        console.error('[COLLECTION] collectionContent div not found');
        return;
    }
    contentDiv.innerHTML = '<div style="color: #aaa; text-align: center; padding: 20px;">Loading unopened products...</div>';
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/collection/unopened', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error('Response is not JSON');
        }
        
        const data = await response.json();
        
        console.log('[COLLECTION UI] Unopened products data:', data);
        
        if (data.success) {
            const products = data.products || [];
            
            if (products.length > 0) {
                contentDiv.innerHTML = `
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 15px;">
                        ${products.map(product => `
                            <div style="padding: 15px; background: rgba(0,0,0,0.3); border: 2px solid #8b6f47; border-radius: 6px;">
                                <h3 style="color: #d4af37; margin-bottom: 10px;">${product.product_type.replace('_', ' ')}</h3>
                                <p style="color: #f4e4c1; margin-bottom: 15px;">Quantity: ${product.quantity}</p>
                                <button onclick="openProduct('${product.product_type}', '${product.product_id}')" style="width: 100%; padding: 10px; background: linear-gradient(135deg, #2ecc71 0%, #27ae60 100%); border: 2px solid #8b6f47; border-radius: 4px; cursor: pointer; color: white; font-weight: bold;">Open</button>
                            </div>
                        `).join('')}
                    </div>
                `;
            } else {
                contentDiv.innerHTML = '<div style="color: #aaa; text-align: center; padding: 20px;">No unopened products</div>';
            }
        } else {
            contentDiv.innerHTML = `<div style="color: #c41e3a; text-align: center; padding: 20px;">Error: ${data.message || 'Failed to load'}</div>`;
        }
    } catch (error) {
        console.error('Error loading unopened products:', error);
        contentDiv.innerHTML = `<div style="color: #c41e3a; text-align: center; padding: 20px;">Error loading products: ${error.message}</div>`;
    }
}

function editDeckFromCollection(deckId) {
    closeCollectionModal();
    if (typeof window.openDeckBuilderFromDashboard === 'function') {
        window.openDeckBuilderFromDashboard();
        // TODO: Load the specific deck for editing
    }
}

async function deleteDeckFromCollection(deckId) {
    if (!confirm('Are you sure you want to delete this deck?')) {
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const userData = JSON.parse(sessionStorage.getItem('userData') || '{}');
        const userId = userData.userId;
        
        const response = await fetch(`/api/deck/${userId}/${deckId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('Deck deleted successfully');
            loadCustomDecks();
        } else {
            alert(`Error: ${data.message || 'Failed to delete deck'}`);
        }
    } catch (error) {
        console.error('Error deleting deck:', error);
        alert('Failed to delete deck');
    }
}

async function addStarterCards() {
    if (!confirm('This will add starter cards (60 Ranged, 60 Infantry, 60 Cavalry) to your account. Continue?')) {
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/collection/add-starter-cards', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('Starter cards added successfully! Refreshing collection...');
            loadCardCollection();
        } else {
            alert(`Error: ${data.message || 'Failed to add starter cards'}`);
        }
    } catch (error) {
        console.error('Error adding starter cards:', error);
        alert('Failed to add starter cards');
    }
}

async function openProduct(productType, productId) {
    const quantity = prompt('How many to open?', '1');
    if (!quantity || parseInt(quantity) <= 0) return;
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/collection/open', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ productType, productId, quantity: parseInt(quantity) })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(`Opened ${data.totalCards} cards! Check your collection.`);
            loadUnopenedProducts();
            loadCardCollection();
        } else {
            alert(`Error: ${data.message}`);
        }
    } catch (error) {
        console.error('Error opening product:', error);
        alert('Failed to open product');
    }
}

