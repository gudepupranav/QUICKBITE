/* cart.js — Cart sidebar + checkout */

const CartUI = (() => {
  let cartItems = [];

  function toggle() {
    const sidebar = document.getElementById('cart-sidebar');
    const overlay = document.getElementById('cart-overlay');
    if (sidebar.classList.contains('open')) {
      close();
    } else {
      open();
    }
  }

  function open() {
    document.getElementById('cart-sidebar').classList.add('open');
    document.getElementById('cart-overlay').classList.add('open');
    loadCart();
  }

  function close() {
    document.getElementById('cart-sidebar').classList.remove('open');
    document.getElementById('cart-overlay').classList.remove('open');
  }

  async function loadCart() {
    try {
      cartItems = await api.get('/cart');
      renderCart();
      updateBadge();
    } catch (e) {
      // Not logged in yet, or empty
      cartItems = [];
      updateBadge();
    }
  }

  function renderCart() {
    const list   = document.getElementById('cart-items-list');
    const footer = document.getElementById('cart-footer');

    if (!cartItems.length) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🛒</div>
          <h3>Cart is empty</h3>
          <p>Add items from the menu to get started</p>
        </div>`;
      footer.style.display = 'none';
      return;
    }

    list.innerHTML = cartItems.map(item => `
      <div class="cart-item" id="cart-item-${item.id}">
        <img class="cart-item-img"
          src="${item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100'}"
          alt="${item.name}"
          onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100'" />
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-price">₹${(item.price * item.quantity).toFixed(2)}</div>
          <div class="qty-controls">
            <button class="qty-btn" onclick="CartUI.updateQty(${item.id}, ${item.quantity - 1})">−</button>
            <span class="qty-val">${item.quantity}</span>
            <button class="qty-btn" onclick="CartUI.updateQty(${item.id}, ${item.quantity + 1})">+</button>
            <button class="remove-item-btn" onclick="CartUI.removeItem(${item.id})" title="Remove">
              <i class="fas fa-trash-alt"></i>
            </button>
          </div>
        </div>
      </div>
    `).join('');

    // Set default pickup time (30 min from now)
    const pickupInput = document.getElementById('pickup-time');
    if (!pickupInput.value) {
      const d = new Date(Date.now() + 30 * 60000);
      pickupInput.value = d.toISOString().slice(0, 16);
    }

    const total = cartItems.reduce((s, i) => s + i.price * i.quantity, 0);
    document.getElementById('cart-total').textContent = total.toFixed(2);
    footer.style.display = 'flex';
  }

  function updateBadge() {
    const count = cartItems.reduce((s, i) => s + i.quantity, 0);
    const badge = document.getElementById('cart-badge');
    const navCount = document.getElementById('cart-count-nav');

    if (count > 0) {
      badge.textContent = count;
      badge.classList.remove('hidden');
      navCount.textContent = `Cart (${count})`;
    } else {
      badge.classList.add('hidden');
      navCount.textContent = 'Cart';
    }
  }

  async function addToCart(productId, name) {
    const btn = document.getElementById(`add-btn-${productId}`);
    if (btn) { btn.disabled = true; btn.innerHTML = '<div class="spinner"></div>'; }
    try {
      await api.post('/cart', { product_id: productId, quantity: 1 });
      await loadCart();
      showToast(`${name} added to cart 🛒`, 'success');
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-plus"></i> Add'; }
    }
  }

  async function updateQty(itemId, newQty) {
    if (newQty < 1) { return removeItem(itemId); }
    try {
      await api.put(`/cart/${itemId}`, { quantity: newQty });
      await loadCart();
    } catch (e) { showToast(e.message, 'error'); }
  }

  async function removeItem(itemId) {
    try {
      await api.delete(`/cart/${itemId}`);
      await loadCart();
      showToast('Item removed', 'info');
    } catch (e) { showToast(e.message, 'error'); }
  }

  async function checkout() {
    const btn = document.getElementById('checkout-btn');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> Placing Order...';

    try {
      const pickup_time = document.getElementById('pickup-time').value;
      const order = await api.post('/orders', { pickup_time });

      close();
      await loadCart();
      showToast(`🎉 Order #${order.id} placed! Track it in My Orders.`, 'success');
      Router.go('orders');
      Orders.load();
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-bolt"></i> Place Order';
    }
  }

  return { toggle, open, close, loadCart, addToCart, updateQty, removeItem, checkout };
})();
