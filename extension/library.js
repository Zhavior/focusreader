document.addEventListener('DOMContentLoaded', () => {
  const cardsGrid = document.getElementById('cardsGrid');
  const searchInput = document.getElementById('searchInput');
  const statTotal = document.getElementById('statTotal');
  const statFavs = document.getElementById('statFavs');
  const btnClearAll = document.getElementById('btnClearAll');
  const tabBtns = document.querySelectorAll('.tab-btn');

  let currentTab = 'all';
  let searchQuery = '';
  let libraryItems = [];

  function loadLibrary() {
    if (!chrome?.storage?.local) {
      // Fallback for local testing or demo
      libraryItems = JSON.parse(localStorage.getItem('zhaviorLibrary') || '[]');
      render();
      return;
    }
    chrome.storage.local.get(['zhaviorLibrary'], (res) => {
      libraryItems = res.zhaviorLibrary || [];
      // Sort newest first by default
      libraryItems.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      render();
    });
  }

  function saveLibrary(cb) {
    if (!chrome?.storage?.local) {
      localStorage.setItem('zhaviorLibrary', JSON.stringify(libraryItems));
      if (cb) cb();
      return;
    }
    chrome.storage.local.set({ zhaviorLibrary: libraryItems }, () => {
      if (cb) cb();
    });
  }

  function render() {
    // Update Stats
    statTotal.textContent = libraryItems.length;
    const favCount = libraryItems.filter(i => i.isFavorite).length;
    statFavs.textContent = favCount;

    // Filter items
    const filtered = libraryItems.filter(item => {
      if (currentTab === 'favs' && !item.isFavorite) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const titleMatch = (item.title || '').toLowerCase().includes(q);
        const domainMatch = (item.domain || '').toLowerCase().includes(q);
        const urlMatch = (item.url || '').toLowerCase().includes(q);
        if (!titleMatch && !domainMatch && !urlMatch) return false;
      }
      return true;
    });

    cardsGrid.innerHTML = '';

    if (filtered.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'empty-state';
      if (searchQuery || currentTab === 'favs') {
        emptyDiv.innerHTML = `
          <div class="empty-icon">🔍</div>
          <h3>No matching articles found</h3>
          <p>Try broadening your search or switching back to the "All Articles" tab.</p>
        `;
      } else {
        emptyDiv.innerHTML = `
          <div class="empty-icon">📚</div>
          <h3>Your reading library is empty</h3>
          <p>When you launch Hyperfi Reader on any article or website across the web, it will automatically be collected right here so you can revisit, organize, and favorite your top reads.</p>
        `;
      }
      cardsGrid.appendChild(emptyDiv);
      return;
    }

    filtered.forEach(item => {
      const card = document.createElement('div');
      card.className = 'card';

      const dateStr = item.date 
        ? new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'Recently';

      const wordCount = item.wordCount || 0;
      const readMin = Math.max(1, Math.round(wordCount / 200));
      const metaText = wordCount > 0 ? `⏱️ ~${readMin} min read • 📝 ${wordCount.toLocaleString()} words` : `🔗 Saved website`;

      card.innerHTML = `
        <div>
          <div class="card-top">
            <span class="badge-domain">🌐 ${item.domain || 'website.com'}</span>
            <span class="badge-date">${dateStr}</span>
          </div>
          <a href="${item.url}" target="_blank" class="card-title">${item.title || item.url}</a>
          <div class="card-meta">${metaText}</div>
        </div>
        <div class="card-actions">
          <button class="btn-card btn-read" title="Go to website and read with focus">🚀 Read Again</button>
          <button class="btn-card btn-fav ${item.isFavorite ? 'active' : ''}" title="${item.isFavorite ? 'Remove from favorites' : 'Add to favorites'}">${item.isFavorite ? '★' : '☆'}</button>
          <button class="btn-card btn-del" title="Delete from library">🗑️</button>
        </div>
      `;

      // Event listeners for buttons inside card
      const btnRead = card.querySelector('.btn-read');
      const btnFav = card.querySelector('.btn-fav');
      const btnDel = card.querySelector('.btn-del');

      btnRead.addEventListener('click', () => {
        window.open(item.url, '_blank');
      });

      btnFav.addEventListener('click', () => {
        item.isFavorite = !item.isFavorite;
        saveLibrary(() => render());
      });

      btnDel.addEventListener('click', () => {
        libraryItems = libraryItems.filter(i => (i.id !== item.id && i.url !== item.url));
        saveLibrary(() => render());
      });

      cardsGrid.appendChild(card);
    });
  }

  // Tab switching
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTab = btn.getAttribute('data-tab');
      render();
    });
  });

  // Search input
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim();
    render();
  });

  // Clear All
  btnClearAll.addEventListener('click', () => {
    if (libraryItems.length === 0) return;
    if (confirm("Are you sure you want to delete all saved articles from your reading history?")) {
      libraryItems = [];
      saveLibrary(() => render());
    }
  });

  // Initial load
  loadLibrary();
});
