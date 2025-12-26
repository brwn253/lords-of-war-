// ===== AUCTION HOUSE UI =====
let currentAuctionTab = 'browse';

function openAuctionModal() {
    document.getElementById('auctionModal').style.display = 'flex';
    switchAuctionTab('browse');
}

function closeAuctionModal() {
    document.getElementById('auctionModal').style.display = 'none';
}

function switchAuctionTab(tab) {
    currentAuctionTab = tab;
    
    // Update tab buttons
    ['browse', 'mylistings', 'list'].forEach(t => {
        const btn = document.getElementById(`auctionTab${t.charAt(0).toUpperCase() + t.slice(1)}`);
        if (btn) {
            btn.style.background = tab === t 
                ? 'linear-gradient(135deg, #8b7355 0%, #6b5344 100%)' 
                : 'rgba(139, 111, 71, 0.3)';
        }
    });
    
    // Load content
    if (tab === 'browse') {
        loadAuctionListings();
    } else if (tab === 'mylistings') {
        loadMyListings();
    } else if (tab === 'list') {
        showListItemForm();
    }
}

async function loadAuctionListings() {
    const contentDiv = document.getElementById('auctionContent');
    contentDiv.innerHTML = '<div style="color: #aaa; text-align: center; padding: 20px;">Loading listings...</div>';
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/auction/listings', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            if (data.listings && data.listings.length > 0) {
                contentDiv.innerHTML = `
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 15px;">
                        ${data.listings.map(listing => `
                            <div style="padding: 15px; background: rgba(0,0,0,0.3); border: 2px solid #8b6f47; border-radius: 6px;">
                                <h3 style="color: #d4af37; margin-bottom: 10px;">${listing.item_type === 'card' ? 'Card' : listing.item_type}</h3>
                                <p style="color: #f4e4c1; margin-bottom: 5px;">Item: ${listing.item_id}</p>
                                <p style="color: #aaa; font-size: 12px; margin-bottom: 10px;">Seller: ${listing.seller_username}</p>
                                <div style="margin-bottom: 10px;">
                                    <p style="color: #d4af37;">Starting: ${listing.starting_price} Gold</p>
                                    ${listing.current_bid ? `<p style="color: #f4e4c1;">Current: ${listing.current_bid} Gold</p>` : ''}
                                    ${listing.buyout_price ? `<p style="color: #2ecc71;">Buyout: ${listing.buyout_price} Gold</p>` : ''}
                                </div>
                                <div style="margin-bottom: 10px;">
                                    <input type="number" id="bidAmount_${listing.id}" placeholder="Bid amount" min="${listing.current_bid ? listing.current_bid + 1 : listing.starting_price}" style="width: 100%; padding: 8px; border: 2px solid #8b6f47; background: rgba(0,0,0,0.5); color: #f4e4c1; border-radius: 4px; margin-bottom: 8px;">
                                    <div style="display: flex; gap: 8px;">
                                        <button onclick="placeBid(${listing.id})" style="flex: 1; padding: 8px; background: linear-gradient(135deg, #2ecc71 0%, #27ae60 100%); border: 2px solid #8b6f47; border-radius: 4px; cursor: pointer; color: white; font-weight: bold;">Bid</button>
                                        ${listing.buyout_price ? `<button onclick="buyoutItem(${listing.id}, ${listing.buyout_price})" style="flex: 1; padding: 8px; background: linear-gradient(135deg, #d4af37 0%, #b8941f 100%); border: 2px solid #8b6f47; border-radius: 4px; cursor: pointer; color: white; font-weight: bold;">Buyout</button>` : ''}
                                    </div>
                                </div>
                                <p style="color: #aaa; font-size: 11px;">Expires: ${new Date(listing.expires_at).toLocaleString()}</p>
                            </div>
                        `).join('')}
                    </div>
                `;
            } else {
                contentDiv.innerHTML = '<div style="color: #aaa; text-align: center; padding: 20px;">No active listings</div>';
            }
        }
    } catch (error) {
        console.error('Error loading listings:', error);
        contentDiv.innerHTML = '<div style="color: #c41e3a; text-align: center; padding: 20px;">Error loading listings</div>';
    }
}

async function placeBid(listingId) {
    const bidInput = document.getElementById(`bidAmount_${listingId}`);
    const bidAmount = parseInt(bidInput.value);
    
    if (!bidAmount || bidAmount <= 0) {
        alert('Please enter a valid bid amount');
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/auction/bid', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ listingId, bidAmount })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('Bid placed successfully!');
            loadAuctionListings();
        } else {
            alert(`Error: ${data.message}`);
        }
    } catch (error) {
        console.error('Error placing bid:', error);
        alert('Failed to place bid');
    }
}

async function buyoutItem(listingId, price) {
    if (!confirm(`Buyout this item for ${price} Gold?`)) {
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/auction/bid', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ listingId, bidAmount: price })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('Item purchased!');
            loadAuctionListings();
        } else {
            alert(`Error: ${data.message}`);
        }
    } catch (error) {
        console.error('Error buying item:', error);
        alert('Failed to purchase item');
    }
}

async function loadMyListings() {
    const contentDiv = document.getElementById('auctionContent');
    contentDiv.innerHTML = '<div style="color: #aaa; text-align: center; padding: 20px;">Loading your listings...</div>';
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/auction/listings', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Filter to only user's listings
            const myListings = data.listings.filter(l => l.seller_id === getUserId());
            
            if (myListings.length > 0) {
                contentDiv.innerHTML = `
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 15px;">
                        ${myListings.map(listing => `
                            <div style="padding: 15px; background: rgba(0,0,0,0.3); border: 2px solid #8b6f47; border-radius: 6px;">
                                <h3 style="color: #d4af37; margin-bottom: 10px;">${listing.item_type === 'card' ? 'Card' : listing.item_type}</h3>
                                <p style="color: #f4e4c1; margin-bottom: 5px;">Item: ${listing.item_id}</p>
                                <div style="margin-bottom: 10px;">
                                    <p style="color: #d4af37;">Starting: ${listing.starting_price} Gold</p>
                                    ${listing.current_bid ? `<p style="color: #f4e4c1;">Current Bid: ${listing.current_bid} Gold</p>` : '<p style="color: #aaa;">No bids yet</p>'}
                                    ${listing.buyout_price ? `<p style="color: #2ecc71;">Buyout: ${listing.buyout_price} Gold</p>` : ''}
                                </div>
                                <p style="color: #aaa; font-size: 11px; margin-bottom: 10px;">Expires: ${new Date(listing.expires_at).toLocaleString()}</p>
                                <button onclick="cancelListing(${listing.id})" style="width: 100%; padding: 8px; background: linear-gradient(135deg, #c41e3a 0%, #8b1a1a 100%); border: 2px solid #8b6f47; border-radius: 4px; cursor: pointer; color: white; font-weight: bold;">Cancel Listing</button>
                            </div>
                        `).join('')}
                    </div>
                `;
            } else {
                contentDiv.innerHTML = '<div style="color: #aaa; text-align: center; padding: 20px;">You have no active listings</div>';
            }
        }
    } catch (error) {
        console.error('Error loading my listings:', error);
        contentDiv.innerHTML = '<div style="color: #c41e3a; text-align: center; padding: 20px;">Error loading listings</div>';
    }
}

async function cancelListing(listingId) {
    if (!confirm('Cancel this listing? The item will be returned to you.')) {
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/auction/cancel', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ listingId })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('Listing cancelled');
            loadMyListings();
        } else {
            alert(`Error: ${data.message}`);
        }
    } catch (error) {
        console.error('Error cancelling listing:', error);
        alert('Failed to cancel listing');
    }
}

async function showListItemForm() {
    // First load available slots
    try {
        const token = localStorage.getItem('token');
        const slotsResponse = await fetch('/api/auction/slots', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const slotsData = await slotsResponse.json();
        
        if (slotsData.success) {
            const contentDiv = document.getElementById('auctionContent');
            contentDiv.innerHTML = `
                <div style="padding: 20px; background: rgba(0,0,0,0.3); border: 2px solid #8b6f47; border-radius: 8px;">
                    <h2 style="color: #d4af37; margin-bottom: 20px;">List Item on Auction House</h2>
                    
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; color: #d4af37; margin-bottom: 5px;">Item Type:</label>
                        <select id="listItemType" onchange="updateListItemForm()" style="width: 100%; padding: 10px; border: 2px solid #8b6f47; background: rgba(0,0,0,0.5); color: #f4e4c1; border-radius: 4px;">
                            <option value="">Select type...</option>
                            <option value="card">Card</option>
                            <option value="booster_pack">Booster Pack</option>
                            <option value="booster_box">Booster Box</option>
                        </select>
                    </div>
                    
                    <div id="listItemDetails" style="display: none;">
                        <!-- Will be populated dynamically -->
                    </div>
                    
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; color: #d4af37; margin-bottom: 5px;">Starting Price (Gold):</label>
                        <input type="number" id="listStartingPrice" min="1" style="width: 100%; padding: 10px; border: 2px solid #8b6f47; background: rgba(0,0,0,0.5); color: #f4e4c1; border-radius: 4px;">
                    </div>
                    
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; color: #d4af37; margin-bottom: 5px;">Buyout Price (Gold, optional):</label>
                        <input type="number" id="listBuyoutPrice" min="1" style="width: 100%; padding: 10px; border: 2px solid #8b6f47; background: rgba(0,0,0,0.5); color: #f4e4c1; border-radius: 4px;">
                    </div>
                    
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; color: #d4af37; margin-bottom: 5px;">Duration (hours):</label>
                        <input type="number" id="listDuration" value="48" min="1" max="168" style="width: 100%; padding: 10px; border: 2px solid #8b6f47; background: rgba(0,0,0,0.5); color: #f4e4c1; border-radius: 4px;">
                    </div>
                    
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; color: #d4af37; margin-bottom: 5px;">Auction Slot:</label>
                        <select id="listSlotNumber" style="width: 100%; padding: 10px; border: 2px solid #8b6f47; background: rgba(0,0,0,0.5); color: #f4e4c1; border-radius: 4px;">
                            ${slotsData.unlockedSlots.map(slot => `<option value="${slot}">Slot ${slot}</option>`).join('')}
                        </select>
                    </div>
                    
                    <button onclick="submitListing()" style="width: 100%; padding: 12px; background: linear-gradient(135deg, #2ecc71 0%, #27ae60 100%); border: 2px solid #8b6f47; border-radius: 4px; cursor: pointer; color: white; font-weight: bold;">List Item</button>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading slots:', error);
    }
}

function updateListItemForm() {
    const itemType = document.getElementById('listItemType').value;
    const detailsDiv = document.getElementById('listItemDetails');
    
    if (!itemType) {
        detailsDiv.style.display = 'none';
        return;
    }
    
    detailsDiv.style.display = 'block';
    
    if (itemType === 'card') {
        detailsDiv.innerHTML = `
            <label style="display: block; color: #d4af37; margin-bottom: 5px;">Card ID:</label>
            <input type="text" id="listItemId" placeholder="Enter card ID" style="width: 100%; padding: 10px; border: 2px solid #8b6f47; background: rgba(0,0,0,0.5); color: #f4e4c1; border-radius: 4px;">
        `;
    } else {
        detailsDiv.innerHTML = `
            <input type="hidden" id="listItemId" value="${itemType}">
            <p style="color: #f4e4c1;">Listing: ${itemType.replace('_', ' ')}</p>
        `;
    }
}

async function submitListing() {
    const itemType = document.getElementById('listItemType').value;
    const itemId = document.getElementById('listItemId').value;
    const startingPrice = parseInt(document.getElementById('listStartingPrice').value);
    const buyoutPrice = parseInt(document.getElementById('listBuyoutPrice').value) || null;
    const durationHours = parseInt(document.getElementById('listDuration').value);
    const slotNumber = parseInt(document.getElementById('listSlotNumber').value);
    
    if (!itemType || !itemId || !startingPrice || !slotNumber) {
        alert('Please fill in all required fields');
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/auction/list', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                itemType,
                itemId,
                startingPrice,
                buyoutPrice,
                durationHours,
                slotNumber
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('Item listed successfully!');
            switchAuctionTab('mylistings');
        } else {
            alert(`Error: ${data.message}`);
        }
    } catch (error) {
        console.error('Error listing item:', error);
        alert('Failed to list item');
    }
}

function getUserId() {
    // This should get the user ID from token or stored data
    // For now, return null - you'll need to implement this based on your auth system
    return null;
}

// Expose functions to window
if (typeof window !== 'undefined') {
    window.openAuctionModal = openAuctionModal;
    window.closeAuctionModal = closeAuctionModal;
    window.switchAuctionTab = switchAuctionTab;
}

