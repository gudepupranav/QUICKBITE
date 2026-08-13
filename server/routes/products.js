const express = require('express');
const { getDb } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/products — public, supports search/category/sort/condition filter
router.get('/', async (req, res) => {
  try {
    const db = await getDb();
    const { category, search, sort, condition } = req.query;
    let query = 'SELECT * FROM products WHERE 1=1';
    const params = [];
    if (category && category !== 'All') { query += ' AND category = ?'; params.push(category); }
    if (search) { query += ' AND (name LIKE ? OR description LIKE ? OR category LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    if (condition && condition !== 'All') { query += ' AND condition = ?'; params.push(condition); }
    if (sort === 'price_asc') query += ' ORDER BY price ASC';
    else if (sort === 'price_desc') query += ' ORDER BY price DESC';
    else if (sort === 'name_asc') query += ' ORDER BY name ASC';
    else query += ' ORDER BY category, id';
    res.json(db.prepare(query).all(...params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/products/:id — public
router.get('/:id', async (req, res) => {
  try {
    const db = await getDb();
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/products — admin only
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = await getDb();
    const { name, description, price, category, image_url, available, stock, condition } = req.body;
    if (!name || !price || !category) return res.status(400).json({ error: 'name, price, category required' });
    const result = db.prepare(
      'INSERT INTO products (name, description, price, category, image_url, available, stock, condition) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(name, description || '', price, category, image_url || '', available ?? 1, stock ?? 100, condition || 'Freshly Prepared');
    res.status(201).json(db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/products/:id — admin only
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = await getDb();
    const { name, description, price, category, image_url, available, stock, condition } = req.body;
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Product not found' });
    db.prepare(
      'UPDATE products SET name=?, description=?, price=?, category=?, image_url=?, available=?, stock=?, condition=? WHERE id=?'
    ).run(
      name ?? existing.name,
      description ?? existing.description,
      price ?? existing.price,
      category ?? existing.category,
      image_url ?? existing.image_url,
      available ?? existing.available,
      stock ?? existing.stock,
      condition ?? existing.condition ?? 'Freshly Prepared',
      req.params.id
    );
    res.json(db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/products/:id — admin only
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = await getDb();
    const result = db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
