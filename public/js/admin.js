/* admin.js — Admin dashboard: analytics, products, orders */

const Admin = (() => {
  let currentTab = 'analytics';
  let allOrders  = [];

  function showTab(tab) {
    currentTab = tab;
    ['analytics', 'products', 'orders'].forEach(t => {
      document.getElementById(`admin-panel-${t}`).style.display = t === tab ? 'block' : 'none';
      document.getElementById(`admin-tab-${t}`).classList.toggle('active', t === tab);
    });
    if (tab === 'analytics') loadAnalytics();
    if (tab === 'products')  loadProducts();
    if (tab === 'orders')    loadOrders();
  }

  // ─── Analytics ──────────────────────────────────────────────────────────────

  async function loadAnalytics() {
    try {
      const data = await api.get('/orders/analytics/summary');
      renderStats(data);
    } catch (e) {
      document.getElementById('stats-grid').innerHTML = `<p style="color:var(--error)">${e.message}</p>`;
    }
  }

  function renderStats(data) {
    const grid = document.getElementById('stats-grid');
    grid.innerHTML = `
      <div class="stat-card">
        <div class="stat-label">Today's Revenue</div>
        <div class="stat-value">₹${Number(data.today_revenue).toFixed(0)}</div>
        <div class="stat-sub">${data.today_orders} orders today</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Revenue</div>
        <div class="stat-value">₹${Number(data.total_revenue).toFixed(0)}</div>
        <div class="stat-sub">${data.total_orders} all time orders</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Pending Orders</div>
        <div class="stat-value">${data.pending_orders}</div>
        <div class="stat-sub">Awaiting preparation</div>
      </div>
      ${(data.status_breakdown || []).map(s => `
        <div class="stat-card">
          <div class="stat-label">${s.status}</div>
          <div class="stat-value" style="font-size:1.5rem">${s.count}</div>
          <div class="stat-sub">orders</div>
        </div>
      `).join('')}
    `;

    // Top items
    const topList = document.getElementById('top-items-list');
    const maxSold = data.top_items[0]?.total_sold || 1;
    topList.innerHTML = (data.top_items || []).map(item => `
      <div class="top-item-row">
        <span class="top-item-name">${item.name}</span>
        <div class="top-item-bar-wrap">
          <div class="top-item-bar" style="width:${(item.total_sold / maxSold * 100).toFixed(1)}%"></div>
        </div>
        <span class="top-item-count">${item.total_sold} sold</span>
      </div>
    `).join('') || '<p style="color:var(--text-muted);font-size:0.875rem">No orders yet — data will appear once students start ordering.</p>';
  }

  // ─── Products ────────────────────────────────────────────────────────────────

  async function loadProducts() {
    const tbody = document.getElementById('products-admin-tbody');
    tbody.innerHTML = '<tr><td colspan="8"><div class="loading-center"><div class="spinner"></div></div></td></tr>';
    try {
      const products = await api.get('/products');
      tbody.innerHTML = products.map(p => `
        <tr>
          <td><img class="product-thumb" src="${p.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100'}"
                   alt="${p.name}" onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100'" /></td>
          <td style="font-weight:600;max-width:150px">${p.name}</td>
          <td><span class="badge badge-available" style="font-size:0.68rem">${p.category}</span></td>
          <td style="color:var(--primary);font-weight:700">₹${p.price.toFixed(2)}</td>
          <td>${p.stock}</td>
          <td><span class="badge" style="font-size:0.68rem;background:rgba(59,130,246,0.15);color:#60A5FA">${p.condition || 'Freshly Prepared'}</span></td>
          <td><span class="badge ${p.available ? 'badge-available' : 'badge-unavailable'}">${p.available ? 'Active' : 'Hidden'}</span></td>
          <td>
            <div class="actions">
              <button class="btn btn-ghost btn-sm" onclick="Admin.openProductModal(${p.id})"><i class="fas fa-edit"></i></button>
              <button class="btn btn-danger btn-sm" onclick="Admin.deleteProduct(${p.id}, '${p.name.replace(/'/g,"\\'")}')"><i class="fas fa-trash"></i></button>
            </div>
          </td>
        </tr>
      `).join('');
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="8" style="color:var(--error);padding:20px">${e.message}</td></tr>`;
    }
  }

  let editingProductId = null;

  function openProductModal(id = null) {
    editingProductId = id;
    const form  = document.getElementById('product-form');
    const title = document.getElementById('product-modal-title');
    form.reset();
    document.getElementById('p-available').checked = true;
    document.getElementById('p-stock').value = 100;

    if (id) {
      title.textContent = 'Edit Listing';
      api.get(`/products/${id}`).then(p => {
        document.getElementById('p-id').value        = p.id;
        document.getElementById('p-name').value      = p.name;
        document.getElementById('p-desc').value      = p.description || '';
        document.getElementById('p-price').value     = p.price;
        document.getElementById('p-category').value  = p.category;
        document.getElementById('p-condition').value = p.condition || 'Freshly Prepared';
        document.getElementById('p-image').value     = p.image_url || '';
        document.getElementById('p-stock').value     = p.stock;
        document.getElementById('p-available').checked = !!p.available;
      });
    } else {
      title.textContent = 'Add Listing';
      document.getElementById('p-id').value = '';
      document.getElementById('p-condition').value = 'Freshly Prepared';
    }

    document.getElementById('product-modal-overlay').classList.remove('hidden');
  }

  function closeProductModal() {
    document.getElementById('product-modal-overlay').classList.add('hidden');
  }

  async function saveProduct(e) {
    e.preventDefault();
    const btn = document.getElementById('save-product-btn');
    btn.disabled = true; btn.innerHTML = '<div class="spinner"></div>';

    try {
      const body = {
        name:        document.getElementById('p-name').value,
        description: document.getElementById('p-desc').value,
        price:       parseFloat(document.getElementById('p-price').value),
        category:    document.getElementById('p-category').value,
        condition:   document.getElementById('p-condition').value,
        image_url:   document.getElementById('p-image').value,
        stock:       parseInt(document.getElementById('p-stock').value),
        available:   document.getElementById('p-available').checked ? 1 : 0,
      };

      const id = document.getElementById('p-id').value;
      if (id) {
        await api.put(`/products/${id}`, body);
        showToast('Product updated ✅', 'success');
      } else {
        await api.post('/products', body);
        showToast('Product added ✅', 'success');
      }
      closeProductModal();
      loadProducts();
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      btn.disabled = false; btn.innerHTML = 'Save Product';
    }
  }

  async function deleteProduct(id, name) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/products/${id}`);
      showToast(`"${name}" deleted`, 'info');
      loadProducts();
    } catch (e) { showToast(e.message, 'error'); }
  }

  // ─── Admin Orders ────────────────────────────────────────────────────────────

  async function loadOrders() {
    const tbody = document.getElementById('orders-admin-tbody');
    tbody.innerHTML = '<tr><td colspan="7"><div class="loading-center"><div class="spinner"></div></div></td></tr>';
    try {
      allOrders = await api.get('/orders');
      renderOrdersTable(allOrders);
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="7" style="color:var(--error);padding:20px">${e.message}</td></tr>`;
    }
  }

  function filterOrders(status) {
    const filtered = status ? allOrders.filter(o => o.status === status) : allOrders;
    renderOrdersTable(filtered);
  }

  function renderOrdersTable(orders) {
    const tbody = document.getElementById('orders-admin-tbody');
    if (!orders.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-state" style="padding:40px">No orders found</td></tr>';
      return;
    }

    const STATUSES = ['Pending', 'Preparing', 'Ready', 'Completed', 'Cancelled'];
    tbody.innerHTML = orders.map(o => `
      <tr>
        <td style="font-weight:700;color:var(--primary)">#QB${String(o.id).padStart(4,'0')}</td>
        <td>
          <div style="font-weight:600;font-size:0.875rem">${o.user_name || '—'}</div>
          <div style="font-size:0.75rem;color:var(--text-muted)">${o.user_email || ''}</div>
        </td>
        <td style="font-size:0.8rem;max-width:180px">
          ${(o.items || []).map(i => `${i.product_name} ×${i.quantity}`).join('<br>')}
        </td>
        <td style="font-weight:700;color:var(--primary)">₹${o.total.toFixed(2)}</td>
        <td style="font-size:0.8rem">${o.pickup_time ? new Date(o.pickup_time).toLocaleTimeString('en-IN',{timeStyle:'short'}) : '—'}</td>
        <td><span class="badge badge-${o.status.toLowerCase()}">${o.status}</span></td>
        <td>
          <select class="status-select" onchange="Admin.updateOrderStatus(${o.id}, this.value)">
            ${STATUSES.map(s => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </td>
      </tr>
    `).join('');
  }

  async function updateOrderStatus(orderId, status) {
    try {
      await api.put(`/orders/${orderId}/status`, { status });
      showToast(`Order #QB${String(orderId).padStart(4,'0')} → ${status}`, 'success');
      // Update in-memory list
      const order = allOrders.find(o => o.id === orderId);
      if (order) order.status = status;
    } catch (e) { showToast(e.message, 'error'); }
  }

  return { showTab, openProductModal, closeProductModal, saveProduct, deleteProduct, loadOrders, filterOrders, updateOrderStatus };
})();
