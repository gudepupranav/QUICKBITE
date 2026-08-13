const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

// Vercel's filesystem is read-only except /tmp; use /tmp on Vercel
const DB_PATH = process.env.VERCEL
  ? '/tmp/quickbite.db'
  : path.join(__dirname, '..', 'quickbite.db');


let _sqlDb;  // raw sql.js Database
let wrappedDb;
let dbReady = false;
let dbReadyCallbacks = [];

// ─── Persist to disk ─────────────────────────────────────────────────────────
function saveDb() {
  if (!_sqlDb) return;
  try {
    const data = _sqlDb.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  } catch (e) {
    console.error('Error saving DB:', e.message);
  }
}

// ─── Wrapper (mimics better-sqlite3 synchronous API safely) ──────────────────
function createWrapper(sqlDb) {
  let inTransaction = false;

  return {
    prepare(sql) {
      return {
        run(...params) {
          sqlDb.run(sql, params);
          const changes = sqlDb.getRowsModified();  // capture BEFORE any SELECT resets it
          if (!inTransaction) saveDb();
          const res = sqlDb.exec('SELECT last_insert_rowid()');
          const rowid = res[0]?.values[0][0] ?? null;
          return { lastInsertRowid: rowid, changes };
        },
        get(...params) {
          const stmt = sqlDb.prepare(sql);
          stmt.bind(params.length ? params : []);
          if (stmt.step()) {
            const row = stmt.getAsObject();
            stmt.free();
            return row;
          }
          stmt.free();
          return undefined;
        },
        all(...params) {
          const stmt = sqlDb.prepare(sql);
          stmt.bind(params.length ? params : []);
          const rows = [];
          while (stmt.step()) rows.push(stmt.getAsObject());
          stmt.free();
          return rows;
        }
      };
    },
    transaction(fn) {
      return (...args) => {
        sqlDb.run('BEGIN TRANSACTION');
        inTransaction = true;
        try {
          const result = fn(...args);
          sqlDb.run('COMMIT');
          inTransaction = false;
          saveDb();
          return result;
        } catch (e) {
          try { sqlDb.run('ROLLBACK'); } catch (_) {}
          inTransaction = false;
          throw e;
        }
      };
    }
  };
}

// ─── Schema ───────────────────────────────────────────────────────────────────
const SCHEMA = `
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'student',
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    price REAL NOT NULL,
    category TEXT NOT NULL,
    image_url TEXT DEFAULT '',
    available INTEGER DEFAULT 1,
    stock INTEGER DEFAULT 100,
    condition TEXT DEFAULT 'Freshly Prepared',
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS cart_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    UNIQUE(user_id, product_id)
  );
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    total REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending',
    pickup_time TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    price_at_order REAL NOT NULL
  );
`;

// ─── Seed Data — [name, desc, price, category, image_url, available, stock, condition] ─────
const SEED_PRODUCTS = [
  ['Masala Dosa', 'Crispy golden rice crepe filled with spiced potatoes, served with hot sambar & coconut chutney', 45, 'Breakfast', 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=500', 1, 50, 'Made to Order'],
  ['Idli Sambar', 'Steamed soft rice cakes served with aromatic lentil sambar & coconut chutney', 35, 'Breakfast', 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=500', 1, 60, 'Freshly Prepared'],
  ['Poha', 'Steamed flattened rice seasoned with mustard seeds, curry leaves, crunchy peanuts & lemon juice', 30, 'Breakfast', 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=500', 1, 40, 'Freshly Prepared'],
  ['Vada Pav', 'Mumbai favorite — spiced potato fritter in a soft bun with garlic & green chutneys', 25, 'Breakfast', 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=500', 1, 80, 'Freshly Prepared'],
  ['Thali (Veg)', 'Grand Indian meal platter with basmati rice, dal tadka, 2 sabzis, rotis, papad & pickle', 90, 'Lunch', 'https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?w=500', 1, 30, 'Made to Order'],
  ['Rajma Chawal', 'North Indian specialty — slow-cooked red kidney bean curry served over fragrant basmati rice', 70, 'Lunch', 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500', 1, 40, 'Freshly Prepared'],
  ['Paneer Butter Masala + Roti', 'Tender paneer cubes in rich tomato-butter gravy served with 3 fluffy butter rotis', 110, 'Lunch', 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=500', 1, 25, 'Made to Order'],
  ['Chole Bhature', 'Spiced chickpea curry paired with 2 large puffed fried bread & pickled onions', 75, 'Lunch', 'https://images.unsplash.com/photo-1626132647523-66f5bf380027?w=500', 1, 35, 'Freshly Prepared'],
  ['Veg Biryani', 'Aromatic dum-cooked basmati rice loaded with vegetables, mint & caramelized onions', 85, 'Lunch', 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=500', 1, 45, 'Made to Order'],
  ['Samosa (2 pcs)', 'Crispy golden triangular pastry stuffed with crushed spiced potato & green peas filling', 20, 'Snacks', 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500', 1, 100, 'Pre-Packed'],
  ['Pav Bhaji', 'Thick spiced mashed vegetable curry loaded with butter, served with toasted warm pav buns', 55, 'Snacks', 'https://images.unsplash.com/photo-1606755456206-b25206cde27e?w=500', 1, 60, 'Freshly Prepared'],
  ['French Fries', 'Crispy golden potato fries lightly salted, served with hot tomato ketchup & dip', 60, 'Snacks', 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=500', 1, 70, 'Freshly Prepared'],
  ['Spring Rolls (3 pcs)', 'Crispy fried rolls stuffed with shredded vegetables & glass noodles, served with sweet chili sauce', 50, 'Snacks', 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?w=500', 1, 50, 'Freshly Prepared'],
  ['Bhel Puri', 'Tangy street snack with puffed rice, crispy sev, onions, tomatoes & sweet-spicy chutneys', 30, 'Snacks', 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500', 1, 80, 'Pre-Packed'],
  ['Masala Chai', 'Piping hot Indian spiced milk tea brewed with cardamom, ginger & cinnamon', 15, 'Drinks', 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=500', 1, 150, 'Made to Order'],
  ['Mango Lassi', 'Rich & chilled sweet yogurt drink blended with Alphonso mango pulp', 40, 'Drinks', 'https://images.unsplash.com/photo-1553530979-a6e5ca5a0ece?w=500', 1, 80, 'Made to Order'],
  ['Cold Coffee', 'Creamy iced coffee shake made with rich espresso, dark chocolate & vanilla ice cream', 55, 'Drinks', 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=500', 1, 60, 'Made to Order'],
  ['Fresh Lime Soda', 'Zesty fresh lemon soda served sweet or salted with crushed ice', 30, 'Drinks', 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500', 1, 100, 'Made to Order'],
  ['Student Combo A', 'Rajma Chawal + Hot Masala Chai + Crispy Samosa — The Ultimate Hunger Buster!', 100, 'Combos', 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=500', 1, 30, 'Freshly Prepared'],
  ['Student Combo B', 'Veg Biryani + Chilled Mango Lassi + Golden French Fries', 145, 'Combos', 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500', 1, 25, 'Freshly Prepared'],
];

function seed(sqlDb) {
  const res = sqlDb.exec('SELECT COUNT(*) as c FROM users');
  const count = res[0]?.values[0][0] ?? 0;
  if (count > 0) return;

  const hash = pw => bcrypt.hashSync(pw, 10);
  sqlDb.run('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)',
    ['Admin', 'admin@quickbite.com', hash('admin123'), 'admin']);
  sqlDb.run('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)',
    ['Alex Student', 'student@quickbite.com', hash('student123'), 'student']);

  const ins = 'INSERT INTO products (name,description,price,category,image_url,available,stock,condition) VALUES (?,?,?,?,?,?,?,?)';
  SEED_PRODUCTS.forEach(p => sqlDb.run(ins, [p[0],p[1],p[2],p[3],p[4],p[5],p[6],p[7]||'Freshly Prepared']));
  console.log('✅ Database seeded with default users & products');
}

// Update existing products with correct, unique images, descriptions and condition
function updateProductsIfSeed(sqlDb) {
  const upd = 'UPDATE products SET name=?, description=?, price=?, category=?, image_url=?, condition=? WHERE id=?';
  SEED_PRODUCTS.forEach((p, index) => {
    try {
      // p = [name, desc, price, category, image_url, available, stock, condition]
      sqlDb.run(upd, [p[0], p[1], p[2], p[3], p[4], p[7] || 'Freshly Prepared', index + 1]);
    } catch (e) {
      console.error(`Failed to update product ${index + 1}:`, e.message);
    }
  });
}

// ─── Init ─────────────────────────────────────────────────────────────────────
async function initDb() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    _sqlDb = new SQL.Database(buf);
  } else {
    _sqlDb = new SQL.Database();
  }

  _sqlDb.exec(SCHEMA);
  // Safe migration: add condition column if it doesn't exist
  try { _sqlDb.run("ALTER TABLE products ADD COLUMN condition TEXT DEFAULT 'Freshly Prepared'"); } catch(_) {}
  seed(_sqlDb);
  updateProductsIfSeed(_sqlDb);
  saveDb();

  wrappedDb = createWrapper(_sqlDb);
  dbReady = true;
  dbReadyCallbacks.forEach(cb => cb(wrappedDb));
  dbReadyCallbacks = [];
  console.log('✅ Database ready');
}

function getDb() {
  return new Promise(resolve => {
    if (dbReady) return resolve(wrappedDb);
    dbReadyCallbacks.push(resolve);
  });
}

initDb().catch(err => {
  console.error('DB init failed:', err);
  process.exit(1);
});

module.exports = { getDb };
