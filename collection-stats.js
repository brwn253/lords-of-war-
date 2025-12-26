// ===== COLLECTION STATS LOADER =====

async function loadCollectionStats() {
    try {
        const token = localStorage.getItem('token');
        if (!token) return;
        
        const response = await fetch('/api/collection/stats', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        
        if (data.success && data.stats) {
            const stats = data.stats;
            
            // Update dashboard stats
            const totalCardsEl = document.getElementById('collectionTotalCards');
            const fragmentsEl = document.getElementById('collectionFragments');
            const scrapEl = document.getElementById('collectionScrap');
            
            if (totalCardsEl) totalCardsEl.textContent = stats.total_card_count || 0;
            if (fragmentsEl) fragmentsEl.textContent = stats.fragments || 0;
            if (scrapEl) scrapEl.textContent = stats.scrap || 0;
        }
    } catch (error) {
        console.error('Error loading collection stats:', error);
    }
}

