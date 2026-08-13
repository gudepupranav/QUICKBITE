const express = require('express');
const { getDb } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/orders/analytics/summary — admin only (MUST come before /:id)
router.get('/analytics/summary', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = await getDb();
    const today = new Date().toISOString().split('T')[0];

    const todayRevenue = db.prepare(
      `SELECT COALESCE(SUM(total), 0) as revenue FROM orders WHERE date(created_at) = ? AND status != 'Cancelled'`
    ).get(today);
    const todayOrders = db.prepare(`SELECT COUNT(*) as count FROM orders WHERE date(created_at) = ?`).get(today);
    const totalOrders = db.prepare('SELECT COUNT(*) as count FROM orders').get();
    const totalRevenue = db.prepare(`SELECT COALESCE(SUM(total),0) as revenue FROM orders WHERE status != 'Cancelled'`).get();
    const pendingOrders = db.prepare(`SELECT COUNT(*) as count FROM orders WHERE status = 'Pending'`).get();
    const topItems = db.prepare(`
      SELECT p.name, SUM(oi.quantity) as total_sold
      FROM order_items oi JOIN products p ON oi.product_id = p.id
      GROUP BY oi.product_id ORDER BY total_sold DESC LIMIT 5
    `).all();
    const statusBreakdown = db.prepare(`SELECT status, COUNT(*) as count FROM orders GROUP BY status`).all();

    res.json({
      today_revenue: todayRevenue?.revenue ?? 0,
      today_orders: todayOrders?.count ?? 0,
      total_orders: totalOrders?.count ?? 0,
      total_revenue: totalRevenue?.revenue ?? 0,
      pending_orders: pendingOrders?.count ?? 0,
      top_items: topItems,
      status_breakdown: statusBreakdown
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/orders
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    let orders;
    if (req.user.role === 'admin') {
      orders = db.prepare(`
        SELECT o.*, u.name as user_name, u.email as user_email
        FROM orders o JOIN users u ON o.user_id = u.id
        ORDER BY o.created_at DESC
      `).all();
    } else {
      orders = db.prepare(`SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC`).all(req.user.id);
    }
    const orderItems = db.prepare(`
      SELECT oi.*, p.name as product_name, p.image_url
      FROM order_items oi JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `);
    orders = orders.map(o => ({ ...o, items: orderItems.all(o.id) }));
    res.json(orders);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/orders/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (req.user.role !== 'admin' && order.user_id !== req.user.id)
      return res.status(403).json({ error: 'Access denied' });
    const items = db.prepare(`
      SELECT oi.*, p.name as product_name, p.image_url
      FROM order_items oi JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).all(order.id);
    res.json({ ...order, items });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/orders — place order from cart
router.post('/', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    const { pickup_time, notes } = req.body;
    const cartItems = db.prepare(`
      SELECT ci.*, p.price, p.available, p.stock, p.name
      FROM cart_items ci JOIN products p ON ci.product_id = p.id
      WHERE ci.user_id = ?
    `).all(req.user.id);

    if (cartItems.length === 0) return res.status(400).json({ error: 'Cart is empty' });
    const unavailable = cartItems.find(item => !item.available);
    if (unavailable) return res.status(400).json({ error: `"${unavailable.name}" is no longer available` });

    const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const placeOrder = db.transaction(() => {
      const orderResult = db.prepare(
        `INSERT INTO orders (user_id, total, status, pickup_time, notes) VALUES (?, ?, 'Pending', ?, ?)`
      ).run(req.user.id, total, pickup_time || null, notes || null);

      const orderId = orderResult.lastInsertRowid;
      const insertItem = db.prepare(
        'INSERT INTO order_items (order_id, product_id, quantity, price_at_order) VALUES (?, ?, ?, ?)'
      );
      cartItems.forEach(item => {
        insertItem.run(orderId, item.product_id, item.quantity, item.price);
        db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(item.quantity, item.product_id);
      });
      db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(req.user.id);
      return orderId;
    });

    const orderId = placeOrder();
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    res.status(201).json(order);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/orders/:id/status — admin only
router.put('/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = await getDb();
    const { status } = req.body;
    const validStatuses = ['Pending', 'Preparing', 'Ready', 'Completed', 'Cancelled'];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const result = db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Order not found' });
    res.json(db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
