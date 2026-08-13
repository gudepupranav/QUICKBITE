/* orders.js — Order history + status tracking */

const Orders = (() => {
  const STATUS_STEPS = ['Pending', 'Preparing', 'Ready', 'Completed'];
  const STATUS_ICONS = { Pending: '⏳', Preparing: '👨‍🍳', Ready: '✅', Completed: '🎉', Cancelled: '❌' };

  async function load() {
    const list = document.getElementById('orders-list');
    list.innerHTML = '<div class="loading-center"><div class="spinner"></div></div>';
    try {
      const orders = await api.get('/orders');
      render(orders);
    } catch (e) {
      list.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>Failed to load orders</h3><p>${e.message}</p></div>`;
    }
  }

  function render(orders) {
    const list = document.getElementById('orders-list');
    if (!orders.length) {
      list.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><h3>No orders yet</h3><p>Place your first order from the Menu!</p></div>`;
      return;
    }

    list.innerHTML = orders.map(o => buildOrderCard(o)).join('');
  }

  function buildOrderCard(o) {
    const date = new Date(o.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    const pickup = o.pickup_time ? new Date(o.pickup_time).toLocaleString('en-IN', { timeStyle: 'short' }) : '—';
    const cancelled = o.status === 'Cancelled';

    return `
      <div class="order-card" id="order-card-${o.id}">
        <div class="order-card-header" onclick="Orders.toggleCard(${o.id})">
          <div>
            <div class="order-id">#QB${String(o.id).padStart(4,'0')}</div>
            <div class="order-meta">${date} &middot; Pickup: ${pickup}</div>
          </div>
          <span class="badge badge-${o.status.toLowerCase()}">${STATUS_ICONS[o.status] || ''} ${o.status}</span>
          <span style="font-size:1.2rem;font-weight:700;color:var(--primary);margin-left:auto;">₹${o.total.toFixed(2)}</span>
          <i class="fas fa-chevron-down order-toggle"></i>
        </div>
        <div class="order-card-body">
          <table class="order-items-table">
            <thead><tr><th>Item</th><th>Qty</th><th>Price</th></tr></thead>
            <tbody>
              ${(o.items || []).map(item => `
                <tr>
                  <td>${item.product_name}</td>
                  <td>${item.quantity}</td>
                  <td>₹${(item.price_at_order * item.quantity).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          ${!cancelled ? buildStepper(o.status) : `<p style="color:var(--error);font-size:0.875rem;margin-top:8px">❌ This order was cancelled.</p>`}
        </div>
      </div>
    `;
  }

  function buildStepper(currentStatus) {
    const currentIdx = STATUS_STEPS.indexOf(currentStatus);
    return `
      <div class="status-stepper">
        ${STATUS_STEPS.map((step, i) => {
          const done    = i < currentIdx;
          const current = i === currentIdx;
          return `
            <div class="step ${done ? 'done' : ''} ${current ? 'current' : ''}">
              <div class="step-dot">${done ? '✓' : i + 1}</div>
              <div class="step-label">${step}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function toggleCard(id) {
    const card = document.getElementById(`order-card-${id}`);
    card.classList.toggle('expanded');
  }

  return { load, toggleCard };
})();
