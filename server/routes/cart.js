const express = require('express');
const { getDb } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/cart
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    const items = db.prepare(`
      SELECT ci.id, ci.quantity, p.id as product_id, p.name, p.price, p.image_url, p.available, p.stock
      FROM cart_items ci JOIN products p ON ci.product_id = p.id
      WHERE ci.user_id = ?
    `).all(req.user.id);
    res.json(items);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/cart
router.post('/', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    const { product_id, quantity = 1 } = req.body;
    if (!product_id) return res.status(400).json({ error: 'product_id required' });
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (!product.available) return res.status(400).json({ error: 'Product not available' });
    const existing = db.prepare('SELECT * FROM cart_items WHERE user_id = ? AND product_id = ?').get(req.user.id, product_id);
    if (existing) {
      db.prepare('UPDATE cart_items SET quantity = quantity + ? WHERE id = ?').run(quantity, existing.id);
    } else {
      db.prepare('INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)').run(req.user.id, product_id, quantity);
    }
    res.json({ message: 'Cart updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/cart/:id
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    const { quantity } = req.body;
    if (!quantity || quantity < 1) return res.status(400).json({ error: 'quantity must be >= 1' });
    const item = db.prepare('SELECT * FROM cart_items WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!item) return res.status(404).json({ error: 'Cart item not found' });
    db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(quantity, req.params.id);
    res.json({ message: 'Quantity updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/cart/:id
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    const result = db.prepare('DELETE FROM cart_items WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Cart item not found' });
    res.json({ message: 'Item removed' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/cart
router.delete('/', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(req.user.id);
    res.json({ message: 'Cart cleared' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
