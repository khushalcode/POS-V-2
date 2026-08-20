'use client'

import initSqlJs, { type Database } from 'sql.js'
import { isValidKey } from '@/lib/license-keys'

/**
 * ClientSideDB — Offline-first SQLite in the browser via WebAssembly
 *
 * Architecture:
 * - sql.js loads SQLite as WebAssembly in the browser
 * - Database file persisted in IndexedDB (survives page reload)
 * - ALL data operations happen client-side — NO server needed
 * - Works in APK (Capacitor), EXE (Tauri/Electron), and browser
 * - Supabase used ONLY for KOT event sync (not data storage)
 */

let db: Database | null = null
let initialized = false
const DB_KEY = 'thuso-database'
const DB_VERSION = 1

// ─── IndexedDB helpers (for persisting SQLite file) ───
function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('thuso', DB_VERSION)
    req.onupgradeneeded = () => {
      req.result.createObjectStore('database')
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function saveDB(database: Database) {
  const idb = await openIDB()
  const data = database.export()
  return new Promise<void>((resolve, reject) => {
    const tx = idb.transaction('database', 'readwrite')
    tx.objectStore('database').put(data, DB_KEY)
    tx.oncomplete = () => { idb.close(); resolve() }
    tx.onerror = () => { idb.close(); reject(tx.error) }
  })
}

async function loadDB(): Promise<Uint8Array | null> {
  const idb = await openIDB()
  return new Promise((resolve, reject) => {
    const tx = idb.transaction('database', 'readonly')
    const req = tx.objectStore('database').get(DB_KEY)
    req.onsuccess = () => { idb.close(); resolve(req.result || null) }
    req.onerror = () => { idb.close(); reject(req.error) }
  })
}

// ─── Schema creation ───
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS Shop (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  address TEXT,
  phone TEXT,
  gstin TEXT,
  taxRate REAL NOT NULL DEFAULT 5,
  serviceRate REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'Rs.',
  color TEXT NOT NULL DEFAULT 'orange',
  active INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS MenuItem (
  id TEXT PRIMARY KEY,
  shopId TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  price REAL NOT NULL,
  cost REAL NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'Pcs',
  image TEXT,
  available INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (shopId) REFERENCES Shop(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_menuitem_shop_cat ON MenuItem(shopId, category);

CREATE TABLE IF NOT EXISTS RestaurantTable (
  id TEXT PRIMARY KEY,
  shopId TEXT NOT NULL,
  number INTEGER NOT NULL,
  name TEXT NOT NULL DEFAULT 'Table',
  capacity INTEGER NOT NULL DEFAULT 4,
  status TEXT NOT NULL DEFAULT 'available',
  currentOrderId TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (shopId) REFERENCES Shop(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_table_shop_num ON RestaurantTable(shopId, number);

CREATE TABLE IF NOT EXISTS Orders (
  id TEXT PRIMARY KEY,
  shopId TEXT NOT NULL,
  tableId TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  type TEXT NOT NULL DEFAULT 'dine_in',
  guests INTEGER NOT NULL DEFAULT 1,
  waiterName TEXT,
  customerName TEXT,
  notes TEXT,
  kotPrinted INTEGER NOT NULL DEFAULT 0,
  billPrinted INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (shopId) REFERENCES Shop(id) ON DELETE CASCADE,
  FOREIGN KEY (tableId) REFERENCES RestaurantTable(id)
);
CREATE INDEX IF NOT EXISTS idx_order_shop_status ON Orders(shopId, status);

CREATE TABLE IF NOT EXISTS OrderItem (
  id TEXT PRIMARY KEY,
  orderId TEXT NOT NULL,
  menuItemId TEXT NOT NULL,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (orderId) REFERENCES Orders(id) ON DELETE CASCADE,
  FOREIGN KEY (menuItemId) REFERENCES MenuItem(id)
);
CREATE INDEX IF NOT EXISTS idx_orderitem_order ON OrderItem(orderId);

CREATE TABLE IF NOT EXISTS Bill (
  id TEXT PRIMARY KEY,
  shopId TEXT NOT NULL,
  billNo INTEGER NOT NULL,
  orderId TEXT NOT NULL UNIQUE,
  tableNumber INTEGER NOT NULL,
  subtotal REAL NOT NULL,
  taxRate REAL NOT NULL DEFAULT 0,
  taxAmount REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  serviceCharge REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL,
  paymentMode TEXT NOT NULL DEFAULT 'cash',
  paymentStatus TEXT NOT NULL DEFAULT 'paid',
  paidAt TEXT NOT NULL DEFAULT (datetime('now')),
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (shopId) REFERENCES Shop(id) ON DELETE CASCADE,
  FOREIGN KEY (orderId) REFERENCES Orders(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bill_shop_no ON Bill(shopId, billNo);

CREATE TABLE IF NOT EXISTS AppUser (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff',
  active INTEGER NOT NULL DEFAULT 1,
  shopId TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ShopSetting (
  id TEXT PRIMARY KEY,
  shopId TEXT NOT NULL UNIQUE,
  shopName TEXT NOT NULL DEFAULT 'Thuso',
  address TEXT, phone TEXT, email TEXT, gstin TEXT,
  taxRate REAL NOT NULL DEFAULT 5,
  serviceRate REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'Rs.',
  invoicePrefix TEXT NOT NULL DEFAULT 'INV',
  kotPrefix TEXT NOT NULL DEFAULT 'KOT',
  footerNote TEXT NOT NULL DEFAULT 'Thank you for dining with us!',
  billShowLogo INTEGER NOT NULL DEFAULT 1,
  billShowGstin INTEGER NOT NULL DEFAULT 1,
  billShowPhone INTEGER NOT NULL DEFAULT 1,
  billShowAddress INTEGER NOT NULL DEFAULT 1,
  billShowEmail INTEGER NOT NULL DEFAULT 0,
  billShowDateTime INTEGER NOT NULL DEFAULT 1,
  billShowWaiter INTEGER NOT NULL DEFAULT 1,
  billShowCustomer INTEGER NOT NULL DEFAULT 1,
  billShowKotNo INTEGER NOT NULL DEFAULT 1,
  billFontSize INTEGER NOT NULL DEFAULT 11,
  billHeaderAlign TEXT NOT NULL DEFAULT 'center',
  billExtraNote TEXT,
  billAccentColor TEXT NOT NULL DEFAULT '#f97316',
  billBoldFont INTEGER NOT NULL DEFAULT 0,
  kotShowLogo INTEGER NOT NULL DEFAULT 1,
  kotShowWaiter INTEGER NOT NULL DEFAULT 1,
  kotShowDateTime INTEGER NOT NULL DEFAULT 1,
  kotShowTable INTEGER NOT NULL DEFAULT 1,
  kotShowGuests INTEGER NOT NULL DEFAULT 1,
  kotFontSize INTEGER NOT NULL DEFAULT 12,
  kotHeaderAlign TEXT NOT NULL DEFAULT 'center',
  kotAccentColor TEXT NOT NULL DEFAULT '#f97316',
  kotBoldFont INTEGER NOT NULL DEFAULT 0,
  kotExtraNote TEXT,
  zomatoEnabled INTEGER NOT NULL DEFAULT 0,
  zomatoApiKey TEXT,
  zomatoRestaurantId TEXT,
  zomatoApiBaseUrl TEXT,
  zomatoWebhookSecret TEXT,
  paperWidth INTEGER NOT NULL DEFAULT 80,
  printFontSize INTEGER NOT NULL DEFAULT 11,
  printMargin INTEGER NOT NULL DEFAULT 4,
  autoPrint INTEGER NOT NULL DEFAULT 1,
  billCopies INTEGER NOT NULL DEFAULT 1,
  silentPrint INTEGER NOT NULL DEFAULT 0,
  printHeaderText TEXT,
  printFooterText TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (shopId) REFERENCES Shop(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Customer (
  id TEXT PRIMARY KEY, shopId TEXT NOT NULL, name TEXT NOT NULL,
  phone TEXT, email TEXT, address TEXT, notes TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS Supplier (
  id TEXT PRIMARY KEY, shopId TEXT NOT NULL, name TEXT NOT NULL,
  phone TEXT, email TEXT, address TEXT, notes TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS Purchase (
  id TEXT PRIMARY KEY, shopId TEXT NOT NULL,
  invoiceNumber TEXT NOT NULL UNIQUE,
  supplierId TEXT, supplierName TEXT,
  subtotal REAL NOT NULL, taxAmount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL, paymentMode TEXT NOT NULL DEFAULT 'cash',
  notes TEXT, items TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS Expense (
  id TEXT PRIMARY KEY, shopId TEXT NOT NULL,
  category TEXT NOT NULL, description TEXT NOT NULL,
  amount REAL NOT NULL, paymentMode TEXT NOT NULL DEFAULT 'cash',
  date TEXT NOT NULL DEFAULT (datetime('now')),
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS MoneyIn (
  id TEXT PRIMARY KEY, shopId TEXT NOT NULL,
  amount REAL NOT NULL, source TEXT NOT NULL,
  description TEXT, partyName TEXT,
  paymentMode TEXT NOT NULL DEFAULT 'cash',
  date TEXT NOT NULL DEFAULT (datetime('now')),
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS MoneyOut (
  id TEXT PRIMARY KEY, shopId TEXT NOT NULL,
  amount REAL NOT NULL, purpose TEXT NOT NULL,
  description TEXT, partyName TEXT,
  paymentMode TEXT NOT NULL DEFAULT 'cash',
  date TEXT NOT NULL DEFAULT (datetime('now')),
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ZomatoOrder (
  id TEXT PRIMARY KEY, shopId TEXT NOT NULL,
  zomatoOrderId TEXT NOT NULL UNIQUE,
  customerName TEXT NOT NULL, customerPhone TEXT,
  deliveryType TEXT NOT NULL DEFAULT 'delivery',
  address TEXT, items TEXT NOT NULL,
  subtotal REAL NOT NULL, taxAmount REAL NOT NULL DEFAULT 0,
  packagingCharge REAL NOT NULL DEFAULT 0, deliveryFee REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0, total REAL NOT NULL,
  paymentMode TEXT NOT NULL DEFAULT 'prepaid',
  status TEXT NOT NULL DEFAULT 'new',
  notes TEXT, internalOrderId TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS LicenseKey (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  duration INTEGER NOT NULL DEFAULT 365,
  used INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS LicenseActivation (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  activatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  expiresAt TEXT NOT NULL,
  machineId TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS AuditLog (
  id TEXT PRIMARY KEY, shopId TEXT, userId TEXT, userName TEXT, userRole TEXT,
  action TEXT NOT NULL, details TEXT, ipAddress TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS SyncOutbox (
  id TEXT PRIMARY KEY,
  eventType TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  syncedAt TEXT
);

-- Deleted bills archive. When a bill is deleted (voided) we capture a
-- full snapshot here BEFORE the Bill row is removed, so:
--   • the dashboard / reports can show "Deleted Bill Amount" as its own
--     metric and subtract it from the net cash flow
--   • the Money Out page can list every deleted bill with reason + user
--   • an audit trail survives even after the original Bill row is gone
CREATE TABLE IF NOT EXISTS DeletedBill (
  id TEXT PRIMARY KEY,
  shopId TEXT NOT NULL,
  originalBillId TEXT NOT NULL,
  billNo INTEGER NOT NULL,
  orderId TEXT NOT NULL,
  tableNumber INTEGER NOT NULL,
  subtotal REAL NOT NULL DEFAULT 0,
  taxRate REAL NOT NULL DEFAULT 0,
  taxAmount REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  serviceCharge REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL,
  paymentMode TEXT NOT NULL DEFAULT 'cash',
  paymentStatus TEXT NOT NULL DEFAULT 'paid',
  originalPaidAt TEXT NOT NULL,
  originalCreatedAt TEXT NOT NULL,
  reason TEXT,
  deletedBy TEXT,
  deletedById TEXT,
  deletedAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (shopId) REFERENCES Shop(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_deletedbill_shop_deletedAt ON DeletedBill(shopId, deletedAt);
CREATE INDEX IF NOT EXISTS idx_deletedbill_shop_originalPaidAt ON DeletedBill(shopId, originalPaidAt);
CREATE INDEX IF NOT EXISTS idx_deletedbill_deletedById ON DeletedBill(deletedById);

-- Menu categories (per-shop, user-manageable). Mirrors the Prisma model
-- added for the server-side / Supabase migration. The client UI reads &
-- writes through here via the use-shop-fetch shim.
CREATE TABLE IF NOT EXISTS MenuCategory (
  id TEXT PRIMARY KEY,
  shopId TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'slate',
  sortOrder INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (shopId) REFERENCES Shop(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_menucategory_shop_name ON MenuCategory(shopId, name);
CREATE INDEX IF NOT EXISTS idx_menucategory_shop_sort ON MenuCategory(shopId, sortOrder);
`

// ─── Seed data ───
const MENU_ITEMS = [
  { name: 'Maha Jumbo Sandwich', category: 'Sandwich', price: 150 }, { name: 'Cheese Chutney Sandwich', category: 'Sandwich', price: 90 },
  { name: 'Ultimate Cheese Burst Pizza', category: 'Pizza', price: 250 }, { name: 'Royal Paneer Tandoori Pizza', category: 'Pizza', price: 200 },
  { name: 'Classic Veg Delight Pizza', category: 'Pizza', price: 180 }, { name: 'Cheesy Corn Burst Pizza', category: 'Pizza', price: 180 },
  { name: 'Thuso Special Loaded Maggie', category: 'Maggie', price: 180 }, { name: 'Tandoori Paneer Maggie', category: 'Maggie', price: 150 },
  { name: 'Double Masala Cheese Maggie', category: 'Maggie', price: 100 },
  { name: 'Cheese Corn Momos', category: 'Momos', price: 90 }, { name: 'Paneer Momos', category: 'Momos', price: 80 }, { name: 'Veg Momos', category: 'Momos', price: 70 },
  { name: 'Double Tikki Cheese Royale Burger', category: 'Burgers', price: 130 }, { name: 'Classic Veg Cheese Burger', category: 'Burgers', price: 90 },
  { name: 'Cheese Ling Chips', category: 'Chips & Fries', price: 100 }, { name: 'Peri Peri Fries', category: 'Chips & Fries', price: 90 }, { name: 'Salted Fries', category: 'Chips & Fries', price: 90 },
  { name: 'Cold Coffee', category: 'Drinks', price: 80 }, { name: 'Classic Mojito', category: 'Drinks', price: 80 },
  { name: 'Watermelon Juice', category: 'Juices', price: 70 }, { name: 'Papaya Juice', category: 'Juices', price: 70 },
  { name: 'Muskmelon Juice', category: 'Juices', price: 80 }, { name: 'Pink Guava Juice', category: 'Juices', price: 80 },
  { name: 'Chikoo Juice', category: 'Juices', price: 80 }, { name: 'Pineapple Juice', category: 'Juices', price: 90 },
  { name: 'Alphonso Mango Juice', category: 'Juices', price: 90 }, { name: 'Custard Apple Juice', category: 'Juices', price: 90 },
  { name: 'Oreo Shake', category: 'Shakes', price: 100 }, { name: 'KitKat Shake', category: 'Shakes', price: 100 },
  { name: 'Watermelon Shake', category: 'Shakes', price: 100 }, { name: 'Papaya Shake', category: 'Shakes', price: 100 },
  { name: 'Muskmelon Shake', category: 'Shakes', price: 110 }, { name: 'Pink Guava Shake', category: 'Shakes', price: 110 },
  { name: 'Chikoo Shake', category: 'Shakes', price: 110 }, { name: 'Pineapple Shake', category: 'Shakes', price: 120 },
  { name: 'Alphonso Mango Shake', category: 'Shakes', price: 120 }, { name: 'Custard Apple Shake', category: 'Shakes', price: 120 },
]

const LICENSE_KEYS = [
  'SSYNC-PVKN-9U9R-HDCR','SSYNC-L2U4-6QND-DZ2D','SSYNC-QNQG-25HG-LMXK','SSYNC-4GTM-DJ4T-TQ5H','SSYNC-VZ4Y-7XAD-6JJF',
  'SSYNC-3H2E-RUFH-5YEE','SSYNC-EPNX-49ZJ-ZUNP','SSYNC-CQ26-NQ4P-EXHG','SSYNC-NYM5-UHGD-257M','SSYNC-8E6P-CPJ8-SH6Q',
  'SSYNC-CW5J-CJY2-4N35','SSYNC-DV2E-YNQB-UESS','SSYNC-RW8Y-2X3R-QAK5','SSYNC-YX9E-VAFG-A438','SSYNC-YBBG-AWF4-8SJB',
  'SSYNC-JLFC-KR6V-7HE3','SSYNC-L2XC-NJMB-U7EG','SSYNC-H36K-RD2Y-5XGW','SSYNC-JFF9-N789-YGJ2','SSYNC-3PAZ-HBEE-WAYR',
]

function genId(): string {
  return 'id_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function seedDatabase(database: Database) {
  // Check if already seeded
  const result = database.exec('SELECT COUNT(*) as count FROM Shop')
  if (result[0]?.values[0]?.[0] > 0) return

  // ─── Single-shop setup ────────────────────────────────────────────────
  // This POS is configured for ONE shop only. The shop-picker screen is
  // skipped automatically because session.tsx auto-selects when the user
  // has exactly one shop. If you ever need multi-shop, re-add a second
  // INSERT here and the picker will reappear.
  const shopId = genId()
  database.run('INSERT INTO Shop (id, name, code, color, address, phone, gstin, taxRate, currency) VALUES (?,?,?,?,?,?,?,?,?)',
    [shopId, 'Spice Garden', 'SPICE', 'orange', '12 Marine Drive, Mumbai', '+91 98200 11223', '27SPICE2024G1Z9', 5, 'Rs.'])

  // Seed settings for the single shop
  database.run(`INSERT INTO ShopSetting (id, shopId, shopName, billAccentColor, kotAccentColor) VALUES (?,?,?,?,?)`,
    [genId(), shopId, 'Spice Garden', '#f97316', '#f97316'])

  // Seed tables (0=Direct Counter + 1-10)
  database.run('INSERT INTO RestaurantTable (id, shopId, number, name, capacity, status) VALUES (?,?,?,?,?,?)',
    [genId(), shopId, 0, 'Direct Counter', 0, 'available'])
  for (let i = 1; i <= 10; i++) {
    database.run('INSERT INTO RestaurantTable (id, shopId, number, name, capacity, status) VALUES (?,?,?,?,?,?)',
      [genId(), shopId, i, `Table ${i}`, 4, 'available'])
  }

  // Seed menu items for the single shop
  for (const item of MENU_ITEMS) {
    database.run('INSERT INTO MenuItem (id, shopId, name, category, price, cost, stock, unit, available) VALUES (?,?,?,?,?,?,?,?,?)',
      [genId(), shopId, item.name, item.category, item.price, Math.round(item.price * 0.4), 100, 'Pcs', 1])
  }

  // Seed super admin
  database.run('INSERT INTO AppUser (id, name, email, password, role, active) VALUES (?,?,?,?,?,?)',
    [genId(), 'Super Admin', 'super@thuso.com', 'admin123', 'admin', 1])

  // Seed license keys
  for (const key of LICENSE_KEYS) {
    database.run('INSERT INTO LicenseKey (id, key, duration, used) VALUES (?,?,?,?)', [genId(), key, 365, 0])
  }
}

// ─── Initialize ───
export async function initDB(): Promise<Database> {
  if (db && initialized) return db

  // Load sql.js WASM. Try local bundle FIRST (works offline + in APK/EXE),
  // fall back to CDN only if local file is missing (e.g. dev server misconfig).
  const wasmLocators = [
    (file: string) => `./${file}`,                          // Capacitor (capacitor://localhost/sql-wasm.wasm)
    (file: string) => `/${file}`,                           // Web root (next.js static export)
    (file: string) => `https://sql.js.org/dist/${file}`,    // CDN fallback (online only)
  ]

  let SQL: any = null
  let lastErr: any = null
  for (const locate of wasmLocators) {
    try {
      SQL = await initSqlJs({ locateFile: locate })
      break
    } catch (e) {
      lastErr = e
      // try next locator
    }
  }
  if (!SQL) {
    console.error('[client-db] All sql.js WASM loaders failed:', lastErr)
    throw lastErr || new Error('Failed to load sql.js WASM')
  }

  // Try to load existing database from IndexedDB
  const existingData = await loadDB()
  if (existingData) {
    db = new SQL.Database(existingData)
    migrateSchema(db)
  } else {
    db = new SQL.Database()
    db.run(SCHEMA_SQL)
    seedDatabase(db)
    await saveDB(db)
  }

  initialized = true
  return db
}

// ─── Schema migrations (idempotent ALTER TABLE for missing columns) ───
function migrateSchema(database: Database) {
  const getColumns = (table: string): string[] => {
    const result = database.exec(`PRAGMA table_info(${table})`)
    if (!result[0]) return []
    return result[0].values.map((row) => String(row[1]))
  }
  const addColumn = (table: string, column: string, defn: string) => {
    const cols = getColumns(table)
    if (!cols.includes(column)) {
      try {
        database.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${defn}`)
      } catch (e) {
        console.warn(`[migrate] could not add ${table}.${column}:`, e)
      }
    }
  }
  addColumn('ShopSetting', 'paperWidth', 'INTEGER NOT NULL DEFAULT 80')
  addColumn('ShopSetting', 'printFontSize', 'INTEGER NOT NULL DEFAULT 11')
  addColumn('ShopSetting', 'printMargin', 'INTEGER NOT NULL DEFAULT 4')
  addColumn('ShopSetting', 'autoPrint', 'INTEGER NOT NULL DEFAULT 1')
  addColumn('ShopSetting', 'billCopies', 'INTEGER NOT NULL DEFAULT 1')
  addColumn('ShopSetting', 'silentPrint', 'INTEGER NOT NULL DEFAULT 0')
  addColumn('ShopSetting', 'printHeaderText', 'TEXT')
  addColumn('ShopSetting', 'printFooterText', 'TEXT')
  addColumn('Orders', 'customerName', 'TEXT')
  addColumn('Orders', 'type', "TEXT NOT NULL DEFAULT 'dine_in'")
  addColumn('MenuItem', 'image', 'TEXT')
  addColumn('MenuItem', 'cost', 'REAL NOT NULL DEFAULT 0')
  addColumn('MenuItem', 'stock', 'INTEGER NOT NULL DEFAULT 0')
  addColumn('MenuItem', 'unit', "TEXT NOT NULL DEFAULT 'Pcs'")
  addColumn('MenuItem', 'available', 'INTEGER NOT NULL DEFAULT 1')
  addColumn('ShopSetting', 'billBoldFont', 'INTEGER NOT NULL DEFAULT 0')
  addColumn('ShopSetting', 'kotBoldFont', 'INTEGER NOT NULL DEFAULT 0')

  // ─── Idempotent table creation for upgrades ───────────────────────────
  // Existing user databases (in IndexedDB) won't have the DeletedBill or
  // MenuCategory tables because they were created before these features
  // existed. CREATE TABLE IF NOT EXISTS is safe to re-run on every boot.
  const ensureTable = (ddl: string) => {
    try { database.run(ddl) } catch (e) {
      console.warn('[migrate] could not ensure table:', e)
    }
  }
  ensureTable(`CREATE TABLE IF NOT EXISTS DeletedBill (
    id TEXT PRIMARY KEY,
    shopId TEXT NOT NULL,
    originalBillId TEXT NOT NULL,
    billNo INTEGER NOT NULL,
    orderId TEXT NOT NULL,
    tableNumber INTEGER NOT NULL,
    subtotal REAL NOT NULL DEFAULT 0,
    taxRate REAL NOT NULL DEFAULT 0,
    taxAmount REAL NOT NULL DEFAULT 0,
    discount REAL NOT NULL DEFAULT 0,
    serviceCharge REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL,
    paymentMode TEXT NOT NULL DEFAULT 'cash',
    paymentStatus TEXT NOT NULL DEFAULT 'paid',
    originalPaidAt TEXT NOT NULL,
    originalCreatedAt TEXT NOT NULL,
    reason TEXT,
    deletedBy TEXT,
    deletedById TEXT,
    deletedAt TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (shopId) REFERENCES Shop(id) ON DELETE CASCADE
  )`)
  ensureTable('CREATE INDEX IF NOT EXISTS idx_deletedbill_shop_deletedAt ON DeletedBill(shopId, deletedAt)')
  ensureTable('CREATE INDEX IF NOT EXISTS idx_deletedbill_shop_originalPaidAt ON DeletedBill(shopId, originalPaidAt)')
  ensureTable('CREATE INDEX IF NOT EXISTS idx_deletedbill_deletedById ON DeletedBill(deletedById)')

  ensureTable(`CREATE TABLE IF NOT EXISTS MenuCategory (
    id TEXT PRIMARY KEY,
    shopId TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT 'slate',
    sortOrder INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (shopId) REFERENCES Shop(id) ON DELETE CASCADE
  )`)
  ensureTable('CREATE UNIQUE INDEX IF NOT EXISTS idx_menucategory_shop_name ON MenuCategory(shopId, name)')
  ensureTable('CREATE INDEX IF NOT EXISTS idx_menucategory_shop_sort ON MenuCategory(shopId, sortOrder)')

  // ─── Single-shop enforcement ──────────────────────────────────────────
  // This POS is configured for ONE shop only. Existing user databases
  // (created before this change) have 2 seeded shops ("Spice Garden" +
  // "Belly Bytes"). We keep the first shop (alphabetically by code, which
  // is "SPICE" → Spice Garden) and delete the rest. Cascade rules on all
  // child tables (MenuItem, RestaurantTable, Orders, Bill, etc.) clean
  // up the second shop's data automatically.
  //
  // Safe to re-run: if the shop count is already 1, this is a no-op.
  try {
    const shopCount = database.exec('SELECT COUNT(*) as c FROM Shop')
    const count = shopCount[0]?.values[0]?.[0]
    if (count && count > 1) {
      // Keep the shop with the smallest rowid (i.e. the first one inserted,
      // which is Spice Garden in the original seed). Delete the rest.
      database.run(`DELETE FROM Shop WHERE id NOT IN (
        SELECT id FROM Shop ORDER BY rowid ASC LIMIT 1
      )`)
      console.warn('[migrate] single-shop enforcement: removed extra shops')
    }
  } catch (e) {
    console.warn('[migrate] single-shop enforcement failed (non-fatal):', e)
  }
}

// ─── Get DB (must call initDB first) ───
export function getDB(): Database {
  if (!db) throw new Error('Database not initialized. Call initDB() first.')
  return db
}

// ─── Check if DB has been initialized (non-throwing version of getDB) ───
export function isDbReady(): boolean {
  return !!db && initialized
}

// ─── Save after writes ───
let saveTimer: any = null
export function persistDB() {
  if (!db) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    await saveDB(db!)
  }, 500) // Debounce saves (500ms)
}

// ─── Query helpers ───
export function query<T = any>(sql: string, params: any[] = []): T[] {
  const database = getDB()
  const stmt = database.prepare(sql)
  stmt.bind(params)
  const results: T[] = []
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T)
  }
  stmt.free()
  return results
}

export function queryOne<T = any>(sql: string, params: any[] = []): T | null {
  const results = query<T>(sql, params)
  return results[0] || null
}

export function execute(sql: string, params: any[] = []): void {
  const database = getDB()
  database.run(sql, params)
  persistDB()
}

export { genId }
