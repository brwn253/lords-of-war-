// ===== SHOP UI =====

function openShopModal() {
    document.getElementById('shopModal').style.display = 'flex';
    loadShopItems();
}

function closeShopModal() {
    document.getElementById('shopModal').style.display = 'none';
}

async function loadShopItems() {
    const contentDiv = document.getElementById('shopContent');
    contentDiv.innerHTML = '<div style="color: #aaa; text-align: center; padding: 20px;">Loading shop...</div>';
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/shop/items', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Group items by type
            const boosterPacks = data.items.filter(i => i.type === 'booster_pack');
            const boosterBoxes = data.items.filter(i => i.type === 'booster_box');
            const cards = data.items.filter(i => i.type === 'card');
            
            contentDiv.innerHTML = `
                <div style="margin-bottom: 30px;">
                    <h2 style="color: #d4af37; margin-bottom: 15px;">Booster Packs</h2>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 15px;">
                        ${boosterPacks.map(item => createShopItemCard(item)).join('')}
                    </div>
                </div>
                
                <div style="margin-bottom: 30px;">
                    <h2 style="color: #d4af37; margin-bottom: 15px;">Booster Boxes</h2>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 15px;">
                        ${boosterBoxes.map(item => createShopItemCard(item)).join('')}
                    </div>
                </div>
                
                <div style="margin-bottom: 30px;">
                    <h2 style="color: #d4af37; margin-bottom: 15px;">Cards</h2>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 15px;">
                        ${cards.map(item => createShopItemCard(item)).join('')}
                    </div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading shop items:', error);
        contentDiv.innerHTML = '<div style="color: #c41e3a; text-align: center; padding: 20px;">Error loading shop</div>';
    }
}

function createShopItemCard(item) {
    return `
        <div style="padding: 15px; background: rgba(0,0,0,0.3); border: 2px solid #8b6f47; border-radius: 6px;">
            <h3 style="color: #d4af37; margin-bottom: 10px;">${item.name}</h3>
            <p style="color: #aaa; font-size: 12px; margin-bottom: 10px;">${item.description}</p>
            <div style="margin-bottom: 15px;">
                ${item.cost_gold > 0 ? `<p style="color: #d4af37; font-size: 18px; font-weight: bold;">${item.cost_gold} Gold</p>` : ''}
                ${item.cost_gems > 0 ? `<p style="color: #d4af37; font-size: 18px; font-weight: bold;">${item.cost_gems} Gems</p>` : ''}
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
                <input type="number" id="quantity_${item.id}" value="1" min="1" max="10" style="width: 60px; padding: 8px; border: 2px solid #8b6f47; background: rgba(0,0,0,0.5); color: #f4e4c1; border-radius: 4px;">
                <button onclick="purchaseItem('${item.id}')" style="flex: 1; padding: 10px; background: linear-gradient(135deg, #2ecc71 0%, #27ae60 100%); border: 2px solid #8b6f47; border-radius: 4px; cursor: pointer; color: white; font-weight: bold;">Buy</button>
            </div>
        </div>
    `;
}

async function purchaseItem(itemId) {
    const quantityInput = document.getElementById(`quantity_${itemId}`);
    const quantity = parseInt(quantityInput.value) || 1;
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/shop/purchase', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ itemId, quantity })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(`Purchased ${quantity} ${data.item} successfully!`);
            loadShopItems();
        } else {
            alert(`Error: ${data.message}`);
        }
    } catch (error) {
        console.error('Error purchasing item:', error);
        alert('Failed to purchase item');
    }
}

// Expose functions to window
if (typeof window !== 'undefined') {
    window.openShopModal = openShopModal;
    window.closeShopModal = closeShopModal;
}

