/* auth.js — Auth UI and state */

const Auth = (() => {
  let currentUser = null;

  function getUser() { return currentUser; }

  function showTab(tab) {
    document.getElementById('login-form').style.display    = tab === 'login' ? 'flex' : 'none';
    document.getElementById('register-form').style.display = tab === 'register' ? 'flex' : 'none';
    document.getElementById('tab-login').classList.toggle('active', tab === 'login');
    document.getElementById('tab-register').classList.toggle('active', tab === 'register');
  }

  async function login(e) {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div>';
    try {
      const email    = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;
      const data = await api.post('/auth/login', { email, password });
      handleAuthSuccess(data);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span>Sign In</span>';
    }
  }

  async function register(e) {
    e.preventDefault();
    const btn = document.getElementById('register-btn');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div>';
    try {
      const name     = document.getElementById('reg-name').value;
      const email    = document.getElementById('reg-email').value;
      const password = document.getElementById('reg-password').value;
      const data = await api.post('/auth/register', { name, email, password });
      handleAuthSuccess(data);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = 'Create Account';
    }
  }

  function handleAuthSuccess(data) {
    localStorage.setItem('qb_token', data.token);
    localStorage.setItem('qb_user', JSON.stringify(data.user));
    currentUser = data.user;
    showApp();
  }

  function logout() {
    localStorage.removeItem('qb_token');
    localStorage.removeItem('qb_user');
    currentUser = null;
    location.reload();
  }

  function showApp() {
    document.getElementById('auth-overlay').classList.add('hidden');
    document.getElementById('app').style.display = 'flex';

    // Update navbar
    document.getElementById('user-name-display').textContent = currentUser.name;
    const roleBadge = document.getElementById('user-role-badge');
    roleBadge.textContent  = currentUser.role;
    roleBadge.className    = `role-badge ${currentUser.role}`;

    // Show/hide admin tab
    document.querySelectorAll('.admin-only').forEach(el => {
      el.classList.toggle('hidden', currentUser.role !== 'admin');
    });

    // Initialize app
    Router.go('menu');
    CartUI.loadCart();
    showToast(`Welcome back, ${currentUser.name}! 👋`, 'success');
  }

  function init() {
    const savedUser  = localStorage.getItem('qb_user');
    const savedToken = localStorage.getItem('qb_token');
    if (savedUser && savedToken) {
      currentUser = JSON.parse(savedUser);
      showApp();
    }
  }

  return { init, login, register, logout, showTab, getUser };
})();
