/* app.js — SPA Router + App Bootstrap */

const Router = (() => {
  const pages = {
    menu:   'page-menu',
    orders: 'page-orders',
    admin:  'page-admin',
  };
  const navMap = {
    menu:   'nav-menu',
    orders: 'nav-orders',
    admin:  'nav-admin',
  };

  function go(page) {
    const user = Auth.getUser();

    // Guard admin page
    if (page === 'admin' && user?.role !== 'admin') {
      page = 'menu';
    }

    // Activate page
    Object.entries(pages).forEach(([key, id]) => {
      document.getElementById(id)?.classList.toggle('active', key === page);
    });

    // Activate nav tab
    Object.entries(navMap).forEach(([key, id]) => {
      document.getElementById(id)?.classList.toggle('active', key === page);
    });

    // Trigger page load
    if (page === 'menu')   Menu.init();
    if (page === 'orders') Orders.load();
    if (page === 'admin')  Admin.showTab('analytics');
  }

  return { go };
})();

// ─── Bootstrap ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  Auth.init();

  // Available toggle label sync
  const availableToggle = document.getElementById('p-available');
  const availableLabel  = document.getElementById('p-available-label');
  if (availableToggle) {
    availableToggle.addEventListener('change', () => {
      availableLabel.textContent = availableToggle.checked ? 'Available' : 'Hidden';
      availableLabel.style.color = availableToggle.checked ? 'var(--success)' : 'var(--error)';
    });
  }

  // Close modal on overlay click
  document.getElementById('product-modal-overlay')?.addEventListener('click', function(e) {
    if (e.target === this) Admin.closeProductModal();
  });
});
