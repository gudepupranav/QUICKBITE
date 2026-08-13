/* menu.js — Menu browsing, search, filter, sort */

const Menu = (() => {
  const CATEGORIES = ['All', 'Breakfast', 'Lunch', 'Snacks', 'Drinks', 'Combos'];
  const CONDITIONS  = ['All', 'Freshly Prepared', 'Made to Order', 'Pre-Packed'];

  const CONDITION_COLORS = {
    'Made to Order':    { bg: 'rgba(59,130,246,0.15)',  color: '#60A5FA' },
    'Freshly Prepared': { bg: 'rgba(16,185,129,0.15)',  color: '#34D399' },
    'Pre-Packed':       { bg: 'rgba(245,158,11,0.15)',  color: '#F59E0B' },
  };

  let currentCategory  = 'All';
  let currentCondition = 'All';
  let searchTerm = '';
  let sortValue  = '';
  let debounceTimer;

  function init() {
    renderCategoryPills();
    load();
  }

  function renderCategoryPills() {
    const container = document.getElementById('category-pills');
    container.innerHTML = CATEGORIES.map(cat => `
      <button class="pill ${cat === currentCategory ? 'active' : ''}"
        onclick="Menu.setCategory('${cat}')">${cat}</button>
    `).join('');
  }

  function setCategory(cat) {
    currentCategory = cat;
    renderCategoryPills();
    load();
  }

  function setCondition(cond) {
    currentCondition = cond;
    // update condition pill UI
    document.querySelectorAll('.cond-pill').forEach(el => {
      el.classList.toggle('active', el.dataset.cond === cond);
    });
    load();
  }

  function onSearch(val) {
    searchTerm = val;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(load, 300);
  }

  function onSort(val) {
    sortValue = val;
    load();
  }

  async function load() {
    const grid = document.getElementById('food-grid');
    grid.innerHTML = '<div class="loading-center"><div class="spinner"></div><span>Loading...</span></div>';

    try {
      const params = new URLSearchParams();
      if (currentCategory !== 'All') params.set('category', currentCategory);
      if (searchTerm) params.set('search', searchTerm);
      if (sortValue) params.set('sort', sortValue);
      if (currentCondition !== 'All') params.set('condition', currentCondition);

      const products = await api.get(`/products?${params}`);
      renderProducts(products);
    } catch (e) {
      grid.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>Failed to load menu</h3><p>${e.message}</p></div>`;
    }
  }

  function conditionBadge(cond) {
    if (!cond) return '';
    const style = CONDITION_COLORS[cond] || { bg: 'rgba(100,100,120,0.15)', color: '#9CA3AF' };
    return `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:99px;font-size:0.68rem;font-weight:700;background:${style.bg};color:${style.color}">
      ${cond === 'Made to Order' ? '👨‍🍳' : cond === 'Pre-Packed' ? '📦' : '✨'} ${cond}
    </span>`;
  }

  function renderProducts(products) {
    const grid = document.getElementById('food-grid');
    if (!products.length) {
      grid.innerHTML = `<div class="empty-state"><div class="empty-icon">🍽️</div><h3>No items found</h3><p>Try a different search or category</p></div>`;
      return;
    }

    grid.innerHTML = products.map(p => `
      <div class="food-card ${!p.available ? 'unavailable' : ''}">
        <div class="food-img-wrap">
          <img src="${p.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400'}"
               alt="${p.name}" loading="lazy"
               onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400'" />
          <span class="food-category-tag">${p.category}</span>
          <span class="food-avail-tag">
            <span class="badge ${p.available ? 'badge-available' : 'badge-unavailable'}">
              ${p.available ? 'Available' : 'Unavailable'}
            </span>
          </span>
        </div>
        <div class="food-info">
          <div class="food-name">${p.name}</div>
          <div style="margin-bottom:8px">${conditionBadge(p.condition)}</div>
          <div class="food-desc">${p.description || ''}</div>
          <div class="food-footer">
            <div class="food-price">${p.price.toFixed(2)}</div>
            <button class="add-btn" onclick="CartUI.addToCart(${p.id}, '${escapeAttr(p.name)}')"
              ${!p.available ? 'disabled' : ''} id="add-btn-${p.id}">
              <i class="fas fa-plus"></i> Add
            </button>
          </div>
        </div>
      </div>
    `).join('');
  }

  function escapeAttr(str) {
    return str.replace(/'/g, "\\'");
  }

  return { init, setCategory, setCondition, onSearch, onSort, load };
})();
