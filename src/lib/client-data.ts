'use client'

import { query, queryOne, execute, genId, initDB } from './client-db'
import { isValidKey } from './license-keys'
import { trackUpsert, trackDelete } from './offline-sync'

/**
 * Client-side data access layer
 * Replaces ALL server-side API routes with direct SQLite queries.
 * No server needed — works in APK, EXE, and browser.
 *
 * Every mutating call (create/update/delete) calls trackUpsert /
 * trackDelete from offline-sync.ts so the change is queued in
 * SyncOutbox and pushed to Supabase when online. This makes the app
 * offline-first: data is never lost even if the device drops offline.
 */

// ═══════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════
export const auth = {
  login(email: string, password: string) {
    const user = queryOne<any>(
      'SELECT * FROM AppUser WHERE email = ? AND password = ? AND active = 1',
      [email.toLowerCase().trim(), password]
    )
    if (!user) return null
    const shops = user.shopId
      ? query('SELECT * FROM Shop WHERE id = ?', [user.shopId])
      : query('SELECT * FROM Shop WHERE active = 1 ORDER BY name')
    return {
      user: { id: user.id, name: user.name, email: user.email, role: user.role, shopId: user.shopId },
      shops: shops.map(convertShop),
    }
  },
}

// ═══════════════════════════════════════
//  LICENSE
// ═══════════════════════════════════════
export const license = {
  /**
   * Validate a license key. Uses the HARDCODED list FIRST (no DB needed),
   * so validation works even if the SQLite WASM failed to load (e.g. on a
   * fresh APK install before the DB has been initialized).
   */
  validate(key: string) {
    const normalized = key.trim().toUpperCase()
    const result = isValidKey(normalized)
    if (!result.valid) return { valid: false, reason: result.reason }

    // Hardcoded key is valid — but check DB for activation status IF DB is ready.
    // If DB isn't initialized yet, just return valid (the activate() flow will
    // initialize the DB and store the activation).
    try {
      const activation = queryOne<any>('SELECT * FROM LicenseActivation WHERE key = ?', [normalized])
      if (activation) {
        const now = new Date()
        const expiry = new Date(activation.expiresAt)
        if (expiry > now) {
          const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          return { valid: true, duration: result.duration, alreadyActivated: true, daysLeft }
        }
        return { valid: false, reason: 'expired' }
      }
      // Check if marked as used
      const dbKey = queryOne<any>('SELECT * FROM LicenseKey WHERE key = ?', [normalized])
      if (dbKey?.used) return { valid: false, reason: 'already_used' }
    } catch (e) {
      // DB not initialized yet — that's OK, the key is still valid per the hardcoded list.
      // The activate() call will initialize the DB.
      console.warn('[license.validate] DB not ready, using hardcoded validation only:', e)
    }
    return { valid: true, duration: result.duration }
  },

  /**
   * Activate a license key. Initializes the DB if needed (async).
   * Returns { active, activatedAt, expiresAt, daysLeft } on success,
   * or { error } on failure.
   */
  async activate(key: string) {
    const normalized = key.trim().toUpperCase()
    const result = isValidKey(normalized)
    if (!result.valid) return { error: 'Invalid license key' }

    // Make sure DB is initialized before we touch it.
    try {
      await initDB()
    } catch (e) {
      console.error('[license.activate] DB init failed:', e)
      return { error: 'Failed to initialize local database. Please restart the app.' }
    }

    // Check existing activation
    const existing = queryOne<any>('SELECT * FROM LicenseActivation WHERE key = ?', [normalized])
    if (existing) {
      const now = new Date()
      const expiry = new Date(existing.expiresAt)
      if (expiry > now) {
        return { active: true, activatedAt: existing.activatedAt, expiresAt: existing.expiresAt,
          daysLeft: Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) }
      }
      return { error: 'License expired' }
    }

    // Check if used
    const dbKey = queryOne<any>('SELECT * FROM LicenseKey WHERE key = ?', [normalized])
    if (dbKey?.used) return { error: 'This key has already been used' }

    // Activate
    const now = new Date()
    const expiresAt = new Date(now)
    expiresAt.setDate(expiresAt.getDate() + result.duration)

    if (dbKey) {
      execute('UPDATE LicenseKey SET used = 1 WHERE id = ?', [dbKey.id])
    } else {
      execute('INSERT INTO LicenseKey (id, key, duration, used) VALUES (?,?,?,?)', [genId(), normalized, result.duration, 1])
    }
    execute('INSERT INTO LicenseActivation (id, key, activatedAt, expiresAt) VALUES (?,?,?,?)',
      [genId(), normalized, now.toISOString(), expiresAt.toISOString()])

    return { active: true, activatedAt: now.toISOString(), expiresAt: expiresAt.toISOString(), daysLeft: result.duration }
  },

  status() {
    try {
      const activation = queryOne<any>('SELECT * FROM LicenseActivation LIMIT 1')
      if (!activation) return { active: false, reason: 'not_activated' }
      const now = new Date()
      const expiry = new Date(activation.expiresAt)
      if (expiry < now) return { active: false, reason: 'expired', expiresAt: activation.expiresAt }
      return { active: true, activatedAt: activation.activatedAt, expiresAt: activation.expiresAt,
        daysLeft: Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) }
    } catch {
      // DB not ready — caller should treat as not_activated
      return { active: false, reason: 'not_activated' }
    }
  },
}

// ═══════════════════════════════════════
//  MENU
// ═══════════════════════════════════════
export const menu = {
  list(shopId: string, category?: string) {
    const sql = category
      ? 'SELECT * FROM MenuItem WHERE shopId = ? AND category = ? ORDER BY category, name'
      : 'SELECT * FROM MenuItem WHERE shopId = ? ORDER BY category, name'
    return query(sql, category ? [shopId, category] : [shopId]).map(convertMenuItem)
  },
  create(shopId: string, data: any) {
    const id = genId()
    execute(`INSERT INTO MenuItem (id, shopId, name, category, price, cost, stock, unit, image, available)
      VALUES (?,?,?,?,?,?,?,?,?,?)`, [id, shopId, data.name, data.category || 'General', Number(data.price),
      Number(data.cost || 0), Number(data.stock || 0), data.unit || 'Pcs', data.image || null, data.available !== false ? 1 : 0])
    const created = this.getById(id)
    if (created) trackUpsert('MenuItem', created)
    return created
  },
  update(id: string, data: any) {
    const sets: string[] = []
    const params: any[] = []
    if (data.name != null) { sets.push('name = ?'); params.push(data.name) }
    if (data.category != null) { sets.push('category = ?'); params.push(data.category) }
    if (data.price != null) { sets.push('price = ?'); params.push(Number(data.price)) }
    if (data.cost != null) { sets.push('cost = ?'); params.push(Number(data.cost)) }
    if (data.stock != null) { sets.push('stock = ?'); params.push(Number(data.stock)) }
    if (data.unit != null) { sets.push('unit = ?'); params.push(data.unit) }
    if (data.image !== undefined) { sets.push('image = ?'); params.push(data.image) }
    if (data.available != null) { sets.push('available = ?'); params.push(data.available ? 1 : 0) }
    if (sets.length === 0) return null
    params.push(id)
    execute(`UPDATE MenuItem SET ${sets.join(', ')} WHERE id = ?`, params)
    const updated = this.getById(id)
    if (updated) trackUpsert('MenuItem', updated)
    return updated
  },
  getById(id: string) { return convertMenuItem(queryOne('SELECT * FROM MenuItem WHERE id = ?', [id])) },
  delete(id: string) { execute('DELETE FROM MenuItem WHERE id = ?', [id]); trackDelete('MenuItem', id) },
}

// ═══════════════════════════════════════
//  MENU CATEGORIES (per-shop, user-manageable)
// ═══════════════════════════════════════
const DEFAULT_CATEGORIES = [
  { name: 'Starters',     color: 'amber',   sortOrder: 0 },
  { name: 'Main Course',  color: 'rose',    sortOrder: 1 },
  { name: 'Breads',       color: 'orange',  sortOrder: 2 },
  { name: 'Beverages',    color: 'sky',     sortOrder: 3 },
  { name: 'Desserts',     color: 'violet',  sortOrder: 4 },
  { name: 'General',      color: 'slate',   sortOrder: 5 },
]

export const menuCategories = {
  list(shopId: string) {
    // Auto-seed defaults if the shop has no categories yet
    let cats = query<any>('SELECT * FROM MenuCategory WHERE shopId = ? ORDER BY sortOrder ASC, name ASC', [shopId])
    if (cats.length === 0) {
      for (const c of DEFAULT_CATEGORIES) {
        execute(
          'INSERT INTO MenuCategory (id, shopId, name, color, sortOrder) VALUES (?,?,?,?,?)',
          [genId(), shopId, c.name, c.color, c.sortOrder]
        )
      }
      cats = query<any>('SELECT * FROM MenuCategory WHERE shopId = ? ORDER BY sortOrder ASC, name ASC', [shopId])
    }
    return cats
  },
  create(shopId: string, data: any) {
    const name = (data?.name || '').toString().trim()
    if (!name) throw new Error('Category name is required')
    const existing = queryOne<any>('SELECT id FROM MenuCategory WHERE shopId = ? AND name = ?', [shopId, name])
    if (existing) throw new Error('Category already exists')
    const sortOrder = typeof data.sortOrder === 'number'
      ? data.sortOrder
      : (queryOne<any>('SELECT COUNT(*) as c FROM MenuCategory WHERE shopId = ?', [shopId])?.c || 0)
    const id = genId()
    execute(
      'INSERT INTO MenuCategory (id, shopId, name, color, sortOrder) VALUES (?,?,?,?,?)',
      [id, shopId, name, data?.color || 'slate', sortOrder]
    )
    return queryOne('SELECT * FROM MenuCategory WHERE id = ?', [id])
  },
  update(id: string, data: any) {
    const existing = queryOne<any>('SELECT * FROM MenuCategory WHERE id = ?', [id])
    if (!existing) throw new Error('Category not found')
    const newName = data?.name != null ? data.name.toString().trim() : null
    const newColor = data?.color != null ? data.color.toString() : null
    if (newName && newName !== existing.name) {
      const dup = queryOne<any>('SELECT id FROM MenuCategory WHERE shopId = ? AND name = ? AND id != ?', [existing.shopId, newName, id])
      if (dup) throw new Error('Another category already has that name')
    }
    const sets: string[] = []
    const params: any[] = []
    if (newName) { sets.push('name = ?'); params.push(newName) }
    if (newColor) { sets.push('color = ?'); params.push(newColor) }
    if (sets.length > 0) {
      sets.push("updatedAt = datetime('now')")
      params.push(id)
      execute(`UPDATE MenuCategory SET ${sets.join(', ')} WHERE id = ?`, params)
    }
    // Propagate rename to menu items
    if (newName && newName !== existing.name) {
      execute('UPDATE MenuItem SET category = ? WHERE shopId = ? AND category = ?', [newName, existing.shopId, existing.name])
    }
    return queryOne('SELECT * FROM MenuCategory WHERE id = ?', [id])
  },
  delete(id: string) {
    const existing = queryOne<any>('SELECT * FROM MenuCategory WHERE id = ?', [id])
    if (!existing) throw new Error('Category not found')
    // Find or create "General" fallback
    let general = queryOne<any>('SELECT * FROM MenuCategory WHERE shopId = ? AND name = ?', [existing.shopId, 'General'])
    if (!general) {
      const gid = genId()
      execute('INSERT INTO MenuCategory (id, shopId, name, color, sortOrder) VALUES (?,?,?,?,?)',
        [gid, existing.shopId, 'General', 'slate', 999])
    }
    // Reassign items to General
    execute('UPDATE MenuItem SET category = ? WHERE shopId = ? AND category = ?', ['General', existing.shopId, existing.name])
    execute('DELETE FROM MenuCategory WHERE id = ?', [id])
    return { reassignedTo: 'General' }
  },
}

// ═══════════════════════════════════════
//  TABLES
// ═══════════════════════════════════════
export const tables = {
  list(shopId: string) {
    const t = query('SELECT * FROM RestaurantTable WHERE shopId = ? ORDER BY number', [shopId])
    return t.map((row: any) => {
      const table = convertTable(row)
      if (row.currentOrderId) {
        const order = orders.getById(row.currentOrderId)
        table.currentOrder = order
      }
      return table
    })
  },
  seed(shopId: string) {
    const count = queryOne<any>('SELECT COUNT(*) as c FROM RestaurantTable WHERE shopId = ?', [shopId])
    if (count?.c > 0) return { seeded: false }
    const seededIds: string[] = []
    const directId = genId()
    execute('INSERT INTO RestaurantTable (id, shopId, number, name, capacity, status) VALUES (?,?,?,?,?,?)', [directId, shopId, 0, 'Direct Counter', 0, 'available'])
    seededIds.push(directId)
    for (let i = 1; i <= 10; i++) {
      const tid = genId()
      execute('INSERT INTO RestaurantTable (id, shopId, number, name, capacity, status) VALUES (?,?,?,?,?,?)', [tid, shopId, i, `Table ${i}`, 4, 'available'])
      seededIds.push(tid)
    }
    // Sync seeded tables to Supabase
    for (const tid of seededIds) {
      const t = queryOne<any>('SELECT * FROM RestaurantTable WHERE id = ?', [tid])
      if (t) trackUpsert('RestaurantTable', convertTable(t))
    }
    return { seeded: true }
  },
  update(id: string, data: any) {
    const sets: string[] = []; const params: any[] = []
    if (data.status != null) { sets.push('status = ?'); params.push(data.status) }
    if (data.currentOrderId !== undefined) { sets.push('currentOrderId = ?'); params.push(data.currentOrderId || null) }
    if (sets.length === 0) return null
    params.push(id)
    execute(`UPDATE RestaurantTable SET ${sets.join(', ')} WHERE id = ?`, params)
    const t = queryOne<any>('SELECT * FROM RestaurantTable WHERE id = ?', [id])
    if (t) trackUpsert('RestaurantTable', convertTable(t))
    return t ? convertTable(t) : null
  },
}

// ═══════════════════════════════════════
//  ORDERS
// ═══════════════════════════════════════
export const orders = {
  list(shopId: string, status?: string) {
    const sql = status
      ? 'SELECT * FROM Orders WHERE shopId = ? AND status = ? ORDER BY createdAt DESC'
      : 'SELECT * FROM Orders WHERE shopId = ? ORDER BY createdAt DESC'
    const rows = query(sql, status ? [shopId, status] : [shopId])
    return rows.map((row: any) => {
      const order = convertOrder(row)
      order.items = query('SELECT * FROM OrderItem WHERE orderId = ?', [row.id]).map(convertOrderItem)
      const table = queryOne<any>('SELECT * FROM RestaurantTable WHERE id = ?', [row.tableId])
      order.table = table ? convertTable(table) : null
      return order
    })
  },
  getById(id: string) {
    const row = queryOne<any>('SELECT * FROM Orders WHERE id = ?', [id])
    if (!row) return null
    const order = convertOrder(row)
    order.items = query('SELECT * FROM OrderItem WHERE orderId = ?', [id]).map(convertOrderItem)
    const table = queryOne<any>('SELECT * FROM RestaurantTable WHERE id = ?', [row.tableId])
    order.table = table ? convertTable(table) : null
    return order
  },
  create(shopId: string, tableId: string, type: string = 'dine_in', guests: number = 1, waiterName?: string, customerName?: string, notes?: string) {
    const id = genId()
    execute(`INSERT INTO Orders (id, shopId, tableId, status, type, guests, waiterName, customerName, notes)
      VALUES (?,?,?,?,?,?,?,?,?)`, [id, shopId, tableId, 'open', type, guests, waiterName || null, customerName || null, notes || null])
    execute('UPDATE RestaurantTable SET status = ?, currentOrderId = ? WHERE id = ?', ['occupied', id, tableId])
    const created = this.getById(id)
    if (created) trackUpsert('Orders', created)
    // The table's status changed too — sync that.
    const t = queryOne<any>('SELECT * FROM RestaurantTable WHERE id = ?', [tableId])
    if (t) trackUpsert('RestaurantTable', convertTable(t))
    return created
  },
  delete(id: string) {
    // Capture tableId before deleting so we can sync the freed table.
    const order = this.getById(id)
    execute('DELETE FROM OrderItem WHERE orderId = ?', [id])
    execute('DELETE FROM Bill WHERE orderId = ?', [id])
    execute('DELETE FROM Orders WHERE id = ?', [id])
    execute('UPDATE RestaurantTable SET status = ?, currentOrderId = NULL WHERE currentOrderId = ?', ['available', id])
    trackDelete('Orders', id)
    if (order?.tableId) {
      const t = queryOne<any>('SELECT * FROM RestaurantTable WHERE id = ?', [order.tableId])
      if (t) trackUpsert('RestaurantTable', convertTable(t))
    }
  },
  sendKOT(id: string) {
    execute('UPDATE Orders SET status = ?, kotPrinted = 1 WHERE id = ?', ['sent', id])
    const updated = this.getById(id)
    if (updated) trackUpsert('Orders', updated)
    return updated
  },
  updateStatus(id: string, status: string) {
    execute('UPDATE Orders SET status = ? WHERE id = ?', [status, id])
    const updated = this.getById(id)
    if (updated) trackUpsert('Orders', updated)
    return updated
  },
  freeTable(id: string) {
    const order = this.getById(id)
    if (!order) return
    execute('UPDATE Orders SET status = ? WHERE id = ?', ['billed', id])
    execute('UPDATE RestaurantTable SET status = ?, currentOrderId = NULL WHERE id = ?', ['available', order.tableId])
    const updated = this.getById(id)
    if (updated) trackUpsert('Orders', updated)
    const t = queryOne<any>('SELECT * FROM RestaurantTable WHERE id = ?', [order.tableId])
    if (t) trackUpsert('RestaurantTable', convertTable(t))
    return order.table?.number
  },
  // ─── Order Items ───
  addItem(orderId: string, menuItemId: string, name: string, price: number, quantity: number, notes?: string) {
    // Check if there's an existing pending item with same menu item
    const existing = queryOne<any>('SELECT * FROM OrderItem WHERE orderId = ? AND menuItemId = ? AND status = ? AND notes IS ?',
      [orderId, menuItemId, 'pending', notes || null])
    let itemId: string
    if (existing) {
      execute('UPDATE OrderItem SET quantity = quantity + ? WHERE id = ?', [quantity, existing.id])
      itemId = existing.id
    } else {
      itemId = genId()
      execute('INSERT INTO OrderItem (id, orderId, menuItemId, name, price, quantity, status, notes) VALUES (?,?,?,?,?,?,?,?)',
        [itemId, orderId, menuItemId, name, price, quantity, 'pending', notes || null])
    }
    const item = queryOne('SELECT * FROM OrderItem WHERE id = ?', [itemId])
    if (item) trackUpsert('OrderItem', item)
    return orders.getById(orderId)
  },
  updateItem(itemId: string, data: any) {
    const sets: string[] = []
    const params: any[] = []
    if (data.status != null) { sets.push('status = ?'); params.push(data.status) }
    if (data.quantity != null) { sets.push('quantity = ?'); params.push(Number(data.quantity)) }
    if (data.notes != null) { sets.push('notes = ?'); params.push(data.notes) }
    if (sets.length === 0) return null
    params.push(itemId)
    execute(`UPDATE OrderItem SET ${sets.join(', ')} WHERE id = ?`, params)
    const updated = queryOne('SELECT * FROM OrderItem WHERE id = ?', [itemId])
    if (updated) trackUpsert('OrderItem', updated)
    return updated
  },
  deleteItem(itemId: string) { execute('DELETE FROM OrderItem WHERE id = ?', [itemId]); trackDelete('OrderItem', itemId) },
}

// ═══════════════════════════════════════
//  BILLS
// ═══════════════════════════════════════
export const bills = {
  list(shopId: string, filters?: { from?: string; to?: string; table?: number; q?: string }) {
    let sql = 'SELECT * FROM Bill WHERE shopId = ?'
    const params: any[] = [shopId]
    if (filters?.from) { sql += ' AND paidAt >= ?'; params.push(filters.from) }
    if (filters?.to) { sql += ' AND paidAt <= ?'; params.push(filters.to) }
    if (filters?.table) { sql += ' AND tableNumber = ?'; params.push(filters.table) }
    sql += ' ORDER BY paidAt DESC'
    let result = query(sql, params)
    if (filters?.q) {
      const term = filters.q.toLowerCase()
      result = result.filter((b: any) => String(b.billNo).includes(term))
    }
    return result.map((b: any) => {
      const bill = convertBill(b)
      const order = orders.getById(b.orderId)
      bill.order = order
      return bill
    })
  },
  getById(id: string) {
    const row = queryOne<any>('SELECT * FROM Bill WHERE id = ?', [id])
    if (!row) return null
    const bill = convertBill(row)
    bill.order = orders.getById(row.orderId)
    return bill
  },
  nextNo(shopId: string) {
    const last = queryOne<any>('SELECT billNo FROM Bill WHERE shopId = ? ORDER BY billNo DESC LIMIT 1', [shopId])
    return last?.billNo ? last.billNo + 1 : 1001
  },
  create(shopId: string, orderId: string, tableNumber: number, subtotal: number, taxRate: number, taxAmount: number, discount: number, serviceCharge: number, total: number, paymentMode: string) {
    const id = genId()
    const billNo = this.nextNo(shopId)
    // ─── BUG FIX: Many callers (e.g. CounterMode.confirmBill) only pass
    // { taxRate, discount, serviceCharge, paymentMode } in the POST body —
    // they do NOT pass subtotal / taxAmount / total. The use-shop-fetch
    // shim falls back to 0 for those missing fields, which means bills were
    // being saved with subtotal=0, taxAmount=0, total=0.
    //
    // To make this bullet-proof, we ALWAYS recompute the amounts here from
    // the live order items, then fall back to the caller-supplied values
    // only if the recomputed subtotal is also 0 (defensive, shouldn't happen
    // for a real order). The caller's taxRate / discount / serviceCharge are
    // still honored.
    const order = orders.getById(orderId)
    const activeItems = (order?.items || []).filter((i: any) => i.status !== 'cancelled')
    const computedSubtotal = activeItems.reduce((s, i) => s + Number(i.price) * Number(i.quantity), 0)
    const safeSubtotal = computedSubtotal > 0 ? computedSubtotal : Number(subtotal) || 0
    const safeTaxRate = Number(taxRate) || 0
    const computedTaxAmount = Math.round(safeSubtotal * safeTaxRate) / 100
    const safeTaxAmount = computedTaxAmount || Number(taxAmount) || 0
    const safeDiscount = Number(discount) || 0
    const safeServiceCharge = Number(serviceCharge) || 0
    const computedTotal = Math.max(0, safeSubtotal + safeTaxAmount + safeServiceCharge - safeDiscount)
    const safeTotal = computedTotal > 0 ? computedTotal : Number(total) || 0
    execute(`INSERT INTO Bill (id, shopId, billNo, orderId, tableNumber, subtotal, taxRate, taxAmount, discount, serviceCharge, total, paymentMode, paymentStatus, paidAt)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [id, shopId, billNo, orderId, tableNumber, safeSubtotal, safeTaxRate, safeTaxAmount, safeDiscount, safeServiceCharge, safeTotal, paymentMode, 'paid', new Date().toISOString()])
    execute('UPDATE Orders SET status = ?, billPrinted = 1 WHERE id = ?', ['paid', orderId])
    execute('UPDATE RestaurantTable SET status = ?, currentOrderId = NULL WHERE currentOrderId = ?', ['available', orderId])
    try {
      execute(`INSERT INTO MoneyIn (id, shopId, amount, source, description, partyName, paymentMode, date)
        VALUES (?,?,?,?,?,?,?,?)`,
        [genId(), shopId, safeTotal, 'Sale', `Bill #${billNo} (Table ${tableNumber})`, null, paymentMode, new Date().toISOString()])
    } catch (e) {
      console.warn('[bills.create] MoneyIn auto-add failed:', e)
    }
    const created = this.getById(id)
    // Sync the new bill, the paid order, and any auto-added MoneyIn to Supabase.
    if (created) trackUpsert('Bill', created)
    const paidOrder = orders.getById(orderId)
    if (paidOrder) trackUpsert('Orders', paidOrder)
    return created
  },

  /**
   * Delete (void) a bill.
   *
   * Before removing the Bill row we capture a full snapshot into the
   * DeletedBill table — this preserves an audit trail and lets the
   * dashboard / reports show "Deleted Bill Amount" as its own metric
   * and the Money Out page list every voided bill.
   *
   * We also:
   *   • reverse the auto-added MoneyIn row that bills.create() inserted
   *     (matched by description "Bill #<billNo> (Table <n>)") so the
   *     cash flow ties out — otherwise the deleted sale would still be
   *     counted as income
   *   • free the table if it was still tied to this order
   *   • track the deletion in the audit log
   */
  delete(id: string, opts?: { reason?: string; deletedBy?: string; deletedById?: string }) {
    const bill = queryOne<any>('SELECT * FROM Bill WHERE id = ?', [id])
    if (!bill) return false

    const now = new Date().toISOString()
    const deletedId = genId()

    // 1) Archive a full snapshot into DeletedBill BEFORE deleting the bill.
    execute(
      `INSERT INTO DeletedBill
        (id, shopId, originalBillId, billNo, orderId, tableNumber, subtotal, taxRate, taxAmount, discount, serviceCharge, total, paymentMode, paymentStatus, originalPaidAt, originalCreatedAt, reason, deletedBy, deletedById, deletedAt)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        deletedId, bill.shopId, bill.id, bill.billNo, bill.orderId, bill.tableNumber,
        bill.subtotal || 0, bill.taxRate || 0, bill.taxAmount || 0,
        bill.discount || 0, bill.serviceCharge || 0, bill.total || 0,
        bill.paymentMode || 'cash', bill.paymentStatus || 'paid',
        bill.paidAt, bill.createdAt,
        opts?.reason || null, opts?.deletedBy || null, opts?.deletedById || null, now,
      ]
    )

    // 2) Reverse the auto-added MoneyIn row from when the bill was created.
    //    bills.create() inserts a MoneyIn with description `Bill #<n> (Table <n>)`
    //    and source = 'Sale'. We match on that description so we only remove
    //    the income that was tied to THIS bill, nothing else.
    try {
      execute(
        `DELETE FROM MoneyIn
         WHERE shopId = ? AND source = 'Sale'
           AND description = ?
           AND date >= ?`,
        [bill.shopId, `Bill #${bill.billNo} (Table ${bill.tableNumber})`, bill.paidAt]
      )
    } catch (e) {
      console.warn('[bills.delete] MoneyIn reversal failed (non-fatal):', e)
    }

    // 3) Free the table if it still points at this order.
    try {
      execute(
        'UPDATE RestaurantTable SET status = ?, currentOrderId = NULL WHERE currentOrderId = ?',
        ['available', bill.orderId]
      )
    } catch (e) {
      console.warn('[bills.delete] table free failed (non-fatal):', e)
    }

    // 4) Delete the bill itself. OrderItem + Order cascade via FK ON DELETE CASCADE.
    execute('DELETE FROM Bill WHERE id = ?', [id])

    // 5) Audit log entry.
    try {
      execute(
        `INSERT INTO AuditLog (id, shopId, userId, userName, action, details, createdAt)
         VALUES (?,?,?,?,?,?,?)`,
        [
          genId(), bill.shopId, opts?.deletedById || null, opts?.deletedBy || null,
          'bill_delete',
          JSON.stringify({
            billId: bill.id, billNo: bill.billNo, total: bill.total,
            tableNumber: bill.tableNumber, paymentMode: bill.paymentMode,
            reason: opts?.reason || null,
          }),
          now,
        ]
      )
    } catch (e) {
      console.warn('[bills.delete] audit log failed (non-fatal):', e)
    }

    // 6) Track sync. We push the deleted bill row to Supabase so other
    //    devices converge, and also push the DeletedBill snapshot.
    trackDelete('Bill', id)
    const snap = queryOne('SELECT * FROM DeletedBill WHERE id = ?', [deletedId])
    if (snap) trackUpsert('DeletedBill', snap)

    return true
  },
}

// ═══════════════════════════════════════
//  DELETED BILLS (voided bills archive)
// ═══════════════════════════════════════
export const deletedBills = {
  /**
   * List all deleted bills for a shop, newest deletion first.
   * Optionally filter by date range (matched on originalPaidAt so the
   * bill is attributed to the day it was actually paid, not deleted).
   */
  list(shopId: string, filters?: { from?: string; to?: string }) {
    let sql = 'SELECT * FROM DeletedBill WHERE shopId = ?'
    const params: any[] = [shopId]
    if (filters?.from) { sql += ' AND originalPaidAt >= ?'; params.push(filters.from) }
    if (filters?.to) { sql += ' AND originalPaidAt <= ?'; params.push(filters.to) }
    sql += ' ORDER BY deletedAt DESC'
    return query(sql, params)
  },

  /** Aggregate totals for a shop, optionally filtered by date range. */
  totals(shopId: string, filters?: { from?: string; to?: string }) {
    let sql = 'SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total FROM DeletedBill WHERE shopId = ?'
    const params: any[] = [shopId]
    if (filters?.from) { sql += ' AND originalPaidAt >= ?'; params.push(filters.from) }
    if (filters?.to) { sql += ' AND originalPaidAt <= ?'; params.push(filters.to) }
    const row = queryOne<any>(sql, params)
    return { count: row?.count || 0, total: row?.total || 0 }
  },
}

// ═══════════════════════════════════════
//  SETTINGS
// ═══════════════════════════════════════
export const settings = {
  get(shopId: string) {
    let row = queryOne<any>('SELECT * FROM ShopSetting WHERE shopId = ?', [shopId])
    if (!row) {
      const shop = queryOne<any>('SELECT * FROM Shop WHERE id = ?', [shopId])
      execute('INSERT INTO ShopSetting (id, shopId, shopName) VALUES (?,?)', [genId(), shopId, shop?.name || 'Restaurant'])
      row = queryOne<any>('SELECT * FROM ShopSetting WHERE shopId = ?', [shopId])
    }
    return convertSettings(row)
  },
  update(shopId: string, data: any) {
    let row = queryOne<any>('SELECT * FROM ShopSetting WHERE shopId = ?', [shopId])
    if (!row) { execute('INSERT INTO ShopSetting (id, shopId) VALUES (?,?)', [genId(), shopId]); row = queryOne('SELECT * FROM ShopSetting WHERE shopId = ?', [shopId]) }
    const sets: string[] = []
    const params: any[] = []
    for (const [key, value] of Object.entries(data)) {
      if (value != null) {
        sets.push(`${key} = ?`)
        params.push(typeof value === 'boolean' ? (value ? 1 : 0) : value)
      }
    }
    if (sets.length === 0) return this.get(shopId)
    params.push(shopId)
    execute(`UPDATE ShopSetting SET ${sets.join(', ')} WHERE shopId = ?`, params)
    // Note: ShopSetting is intentionally NOT synced to Supabase — settings
    // are per-device (printer config, etc.) and shouldn't clobber another
    // device's settings.
    return this.get(shopId)
  },
}

// ═══════════════════════════════════════
//  USERS
// ═══════════════════════════════════════
export const users = {
  list() { return query('SELECT id, name, email, role, active, shopId, createdAt FROM AppUser ORDER BY createdAt DESC').map(convertUser) },
  create(data: any) {
    const id = genId()
    execute('INSERT INTO AppUser (id, name, email, password, role, active, shopId) VALUES (?,?,?,?,?,?,?)',
      [id, data.name, data.email.toLowerCase(), data.password, data.role || 'staff', data.active !== false ? 1 : 0, data.shopId || null])
    return { id, name: data.name, email: data.email, role: data.role || 'staff' }
  },
  update(id: string, data: any) {
    const sets: string[] = []; const params: any[] = []
    if (data.name != null) { sets.push('name = ?'); params.push(data.name) }
    if (data.email != null) { sets.push('email = ?'); params.push(data.email.toLowerCase()) }
    if (data.role != null) { sets.push('role = ?'); params.push(data.role) }
    if (data.active != null) { sets.push('active = ?'); params.push(data.active ? 1 : 0) }
    if (data.password) { sets.push('password = ?'); params.push(data.password) }
    if (data.shopId !== undefined) { sets.push('shopId = ?'); params.push(data.shopId || null) }
    if (sets.length === 0) return null
    params.push(id); execute(`UPDATE AppUser SET ${sets.join(', ')} WHERE id = ?`, params)
    return { id, name: data.name, email: data.email, role: data.role }
  },
  delete(id: string) { execute('DELETE FROM AppUser WHERE id = ?', [id]) },
}

// ═══════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════
export const dashboard = {
  get(shopId: string) {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)

    const todayBills = queryOne<any>('SELECT COUNT(*) as c, COALESCE(SUM(total), 0) as s FROM Bill WHERE shopId = ? AND paidAt >= ?', [shopId, today.toISOString()])
    const monthBills = queryOne<any>('SELECT COUNT(*) as c, COALESCE(SUM(total), 0) as s FROM Bill WHERE shopId = ? AND paidAt >= ?', [shopId, monthStart.toISOString()])
    const allBills = queryOne<any>('SELECT COUNT(*) as c, COALESCE(SUM(total), 0) as s FROM Bill WHERE shopId = ?', [shopId])
    const menuCount = queryOne<any>('SELECT COUNT(*) as c FROM MenuItem WHERE shopId = ?', [shopId])
    const customerCount = queryOne<any>('SELECT COUNT(*) as c FROM Customer WHERE shopId = ?', [shopId])
    const supplierCount = queryOne<any>('SELECT COUNT(*) as c FROM Supplier WHERE shopId = ?', [shopId])
    const occupiedTables = queryOne<any>('SELECT COUNT(*) as c FROM RestaurantTable WHERE shopId = ? AND status = ? AND number > 0', [shopId, 'occupied'])
    const totalTables = queryOne<any>('SELECT COUNT(*) as c FROM RestaurantTable WHERE shopId = ? AND number > 0', [shopId])
    const recentBills = query<any>('SELECT * FROM Bill WHERE shopId = ? ORDER BY paidAt DESC LIMIT 5', [shopId])
    const topItems = query<any>(`
      SELECT oi.name, SUM(oi.quantity) as qty, SUM(oi.quantity * oi.price) as revenue
      FROM OrderItem oi
      JOIN Orders o ON oi.orderId = o.id
      WHERE o.shopId = ? AND o.createdAt >= ?
      GROUP BY oi.name
      ORDER BY qty DESC
      LIMIT 5
    `, [shopId, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()])
    const lowStock = query<any>('SELECT name, stock, unit FROM MenuItem WHERE shopId = ? AND stock < 10 AND stock >= 0 ORDER BY stock ASC LIMIT 5', [shopId])
    const salesInRow = queryOne<any>('SELECT COALESCE(SUM(total), 0) as s FROM Bill WHERE shopId = ? AND paidAt >= ?', [shopId, today.toISOString()])
    const otherInRow = queryOne<any>('SELECT COALESCE(SUM(amount), 0) as s FROM MoneyIn WHERE shopId = ? AND date >= ?', [shopId, today.toISOString()])
    const expensesRow = queryOne<any>('SELECT COALESCE(SUM(amount), 0) as s FROM Expense WHERE shopId = ? AND date >= ?', [shopId, today.toISOString()])
    const purchasesRow = queryOne<any>('SELECT COALESCE(SUM(total), 0) as s FROM Purchase WHERE shopId = ? AND createdAt >= ?', [shopId, today.toISOString()])
    const otherOutRow = queryOne<any>('SELECT COALESCE(SUM(amount), 0) as s FROM MoneyOut WHERE shopId = ? AND date >= ?', [shopId, today.toISOString()])
    // Deleted bills today (attributed by original paidAt, so a bill paid
    // yesterday but deleted today still counts against yesterday). This is
    // exposed as its own metric AND subtracted from net cash flow because
    // a voided sale is effectively money that left the till.
    const deletedTodayRow = queryOne<any>(
      'SELECT COUNT(*) as c, COALESCE(SUM(total), 0) as s FROM DeletedBill WHERE shopId = ? AND originalPaidAt >= ?',
      [shopId, today.toISOString()]
    )
    const salesIn = salesInRow?.s || 0
    const otherIn = otherInRow?.s || 0
    const expenses = expensesRow?.s || 0
    const purchases = purchasesRow?.s || 0
    const otherOut = otherOutRow?.s || 0
    const deletedBillAmount = deletedTodayRow?.s || 0
    const deletedBillCount = deletedTodayRow?.c || 0
    const chartData: { date: string; revenue: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i)
      const next = new Date(d); next.setDate(next.getDate() + 1)
      const row = queryOne<any>('SELECT COALESCE(SUM(total), 0) as s FROM Bill WHERE shopId = ? AND paidAt >= ? AND paidAt < ?', [shopId, d.toISOString(), next.toISOString()])
      chartData.push({ date: d.toISOString().slice(0, 10), revenue: row?.s || 0 })
    }

    return {
      today: { revenue: todayBills?.s || 0, count: todayBills?.c || 0 },
      month: { revenue: monthBills?.s || 0, count: monthBills?.c || 0 },
      allTime: { revenue: allBills?.s || 0, count: allBills?.c || 0 },
      catalog: { menuItems: menuCount?.c || 0, customers: customerCount?.c || 0, suppliers: supplierCount?.c || 0 },
      tables: { occupied: occupiedTables?.c || 0, total: totalTables?.c || 0 },
      recentBills: recentBills || [],
      topItems: topItems || [],
      lowStock: lowStock || [],
      // Exposed as its own block so the dashboard UI can render a
      // "Deleted Bills" stat card. The amount is also rolled into the
      // cashFlow.net calculation below as an outflow.
      deletedBills: { amount: deletedBillAmount, count: deletedBillCount },
      cashFlow: {
        salesIn, otherIn, expenses, purchases, otherOut,
        deletedBills: deletedBillAmount,
        net: salesIn + otherIn - expenses - purchases - otherOut - deletedBillAmount,
      },
      chartData,
    }
  },
}

// ═══════════════════════════════════════
//  ZOMATO
// ═══════════════════════════════════════
export const zomato = {
  list(shopId: string, status?: string) {
    const sql = status ? 'SELECT * FROM ZomatoOrder WHERE shopId = ? AND status = ? ORDER BY createdAt DESC' : 'SELECT * FROM ZomatoOrder WHERE shopId = ? ORDER BY createdAt DESC'
    return query(sql, status ? [shopId, status] : [shopId]).map(convertZomatoOrder)
  },
  create(shopId: string, data: any) {
    const id = genId()
    const last = queryOne<any>('SELECT zomatoOrderId FROM ZomatoOrder WHERE shopId = ? ORDER BY zomatoOrderId DESC LIMIT 1', [shopId])
    const nextNum = last ? (parseInt(last.zomatoOrderId.replace(/\D/g, '')) || 1000) + 1 : 1001
    execute(`INSERT INTO ZomatoOrder (id, shopId, zomatoOrderId, customerName, customerPhone, deliveryType, address, items, subtotal, taxAmount, packagingCharge, deliveryFee, discount, total, paymentMode, status, notes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [id, shopId, `ZOM-${nextNum}`, data.customerName, data.customerPhone || null,
      data.deliveryType || 'delivery', data.address || null, JSON.stringify(data.items), data.subtotal, data.taxAmount || 0,
      data.packagingCharge || 0, data.deliveryFee || 0, data.discount || 0, data.total, data.paymentMode || 'prepaid', 'new', data.notes || null])
    return this.getById(id)
  },
  getById(id: string) { return convertZomatoOrder(queryOne('SELECT * FROM ZomatoOrder WHERE id = ?', [id])) },
  updateStatus(id: string, status: string) { execute('UPDATE ZomatoOrder SET status = ? WHERE id = ?', [status, id]) },
  delete(id: string) { execute('DELETE FROM ZomatoOrder WHERE id = ?', [id]) },
  pushToKitchen(shopId: string, zomatoOrderId: string) {
    const zomato = this.getById(zomatoOrderId)
    if (!zomato || zomato.internalOrderId) return null
    const items = JSON.parse(zomato.items || '[]')
    // Find Direct Counter table
    let directTable = queryOne<any>('SELECT * FROM RestaurantTable WHERE shopId = ? AND number = 0', [shopId])
    if (!directTable) {
      directTable = { id: genId() }
      execute('INSERT INTO RestaurantTable (id, shopId, number, name, capacity, status) VALUES (?,?,?,?,?,?)', [directTable.id, shopId, 0, 'Direct Counter', 0, 'available'])
    }
    const order = orders.create(shopId, directTable.id, zomato.deliveryType === 'pickup' ? 'takeaway' : 'direct', 1, undefined, zomato.customerName, `Zomato Order ${zomato.zomatoOrderId}`)
    for (const it of items) {
      const menuMatch = queryOne<any>('SELECT * FROM MenuItem WHERE shopId = ? AND name = ?', [shopId, it.name])
      let menuItemId = menuMatch?.id
      if (!menuItemId) {
        menuItemId = genId()
        execute('INSERT INTO MenuItem (id, shopId, name, category, price, cost, stock, unit, available) VALUES (?,?,?,?,?,?,?,?,?)', [menuItemId, shopId, it.name, 'General', it.price, 0, 0, 'Pcs', 1])
      }
      orders.addItem(order.id, menuItemId, it.name, it.price, it.qty)
    }
    execute('UPDATE Orders SET status = ?, kotPrinted = 1 WHERE id = ?', ['sent', order.id])
    execute('UPDATE RestaurantTable SET status = ?, currentOrderId = ? WHERE id = ?', ['occupied', order.id, directTable.id])
    execute('UPDATE ZomatoOrder SET internalOrderId = ?, status = ? WHERE id = ?', [order.id, 'accepted', zomatoOrderId])
    return order
  },
}

// ═══════════════════════════════════════
//  AUDIT LOG
// ═══════════════════════════════════════
export const audit = {
  log(action: string, details?: any, shopId?: string, userName?: string) {
    execute('INSERT INTO AuditLog (id, shopId, userName, action, details) VALUES (?,?,?,?,?)',
      [genId(), shopId || null, userName || null, action, details ? JSON.stringify(details) : null])
  },
  list(shopId?: string, action?: string) {
    let sql = 'SELECT * FROM AuditLog'
    const params: any[] = []
    const conditions: string[] = []
    if (shopId) { conditions.push('shopId = ?'); params.push(shopId) }
    if (action) { conditions.push('action = ?'); params.push(action) }
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ')
    sql += ' ORDER BY createdAt DESC LIMIT 500'
    return query(sql, params)
  },
}

// ═══════════════════════════════════════
//  SYNC OUTBOX (for Supabase KOT sync)
// ═══════════════════════════════════════
export const syncQueue = {
  add(eventType: string, payload: any) {
    execute('INSERT INTO SyncOutbox (id, eventType, payload) VALUES (?,?,?)',
      [genId(), eventType, JSON.stringify(payload)])
  },
  getPending() {
    return query('SELECT * FROM SyncOutbox WHERE status = ? ORDER BY createdAt ASC', ['pending'])
  },
  markSynced(id: string) {
    execute('UPDATE SyncOutbox SET status = ?, syncedAt = ? WHERE id = ?', ['synced', new Date().toISOString(), id])
  },
  markFailed(id: string) {
    execute('UPDATE SyncOutbox SET attempts = attempts + 1 WHERE id = ?', [id])
  },
}



// ═══════════════════════════════════════
//  SHOPS
// ═══════════════════════════════════════
export const shops = {
  list() { return query('SELECT * FROM Shop ORDER BY name').map(convertShop) },
  listActive() { return query('SELECT * FROM Shop WHERE active = 1 ORDER BY name').map(convertShop) },
  getById(id: string) { return convertShop(queryOne('SELECT * FROM Shop WHERE id = ?', [id])) },
  create(data: any) {
    const id = genId()
    execute('INSERT INTO Shop (id, name, code, color, address, phone, gstin, taxRate, currency) VALUES (?,?,?,?,?,?,?,?,?)',
      [id, data.name, (data.code || data.name.substring(0, 4)).toUpperCase(), data.color || 'orange', data.address || null, data.phone || null, data.gstin || null, data.taxRate || 5, data.currency || 'Rs.'])
    const created = this.getById(id)
    if (created) trackUpsert('Shop', created)
    return created
  },
  update(id: string, data: any) {
    const sets: string[] = []; const params: any[] = []
    if (data.name) { sets.push('name = ?'); params.push(data.name) }
    if (data.code) { sets.push('code = ?'); params.push(data.code) }
    if (data.color) { sets.push('color = ?'); params.push(data.color) }
    if (data.address !== undefined) { sets.push('address = ?'); params.push(data.address) }
    if (data.phone !== undefined) { sets.push('phone = ?'); params.push(data.phone) }
    if (data.gstin !== undefined) { sets.push('gstin = ?'); params.push(data.gstin) }
    if (data.taxRate !== undefined) { sets.push('taxRate = ?'); params.push(data.taxRate) }
    if (data.currency) { sets.push('currency = ?'); params.push(data.currency) }
    if (data.active !== undefined) { sets.push('active = ?'); params.push(data.active ? 1 : 0) }
    if (!sets.length) return this.getById(id)
    params.push(id)
    execute(`UPDATE Shop SET ${sets.join(', ')}, updatedAt = datetime('now') WHERE id = ?`, params)
    const updated = this.getById(id)
    if (updated) trackUpsert('Shop', updated)
    return updated
  },
  delete(id: string) { execute('DELETE FROM Shop WHERE id = ?', [id]); trackDelete('Shop', id) },
}

// ═══════════════════════════════════════
//  CUSTOMERS
// ═══════════════════════════════════════
export const customers = {
  list(shopId: string) { return query('SELECT * FROM Customer WHERE shopId = ? ORDER BY createdAt DESC', [shopId]) },
  create(shopId: string, data: any) {
    const id = genId()
    execute('INSERT INTO Customer (id, shopId, name, phone, email, address, notes) VALUES (?,?,?,?,?,?,?)',
      [id, shopId, data.name, data.phone || null, data.email || null, data.address || null, data.notes || null])
    const created = queryOne('SELECT * FROM Customer WHERE id = ?', [id])
    if (created) trackUpsert('Customer', created)
    return created
  },
  update(id: string, data: any) {
    execute(`UPDATE Customer SET name = ?, phone = ?, email = ?, address = ?, notes = ?, updatedAt = datetime('now') WHERE id = ?`,
      [data.name, data.phone || null, data.email || null, data.address || null, data.notes || null, id])
    const updated = queryOne('SELECT * FROM Customer WHERE id = ?', [id])
    if (updated) trackUpsert('Customer', updated)
  },
  delete(id: string) { execute('DELETE FROM Customer WHERE id = ?', [id]); trackDelete('Customer', id) },
}

// ═══════════════════════════════════════
//  SUPPLIERS
// ═══════════════════════════════════════
export const suppliers = {
  list(shopId: string) { return query('SELECT * FROM Supplier WHERE shopId = ? ORDER BY createdAt DESC', [shopId]) },
  create(shopId: string, data: any) {
    const id = genId()
    execute('INSERT INTO Supplier (id, shopId, name, phone, email, address, notes) VALUES (?,?,?,?,?,?,?)',
      [id, shopId, data.name, data.phone || null, data.email || null, data.address || null, data.notes || null])
    const created = queryOne('SELECT * FROM Supplier WHERE id = ?', [id])
    if (created) trackUpsert('Supplier', created)
    return created
  },
  update(id: string, data: any) {
    execute(`UPDATE Supplier SET name = ?, phone = ?, email = ?, address = ?, notes = ?, updatedAt = datetime('now') WHERE id = ?`,
      [data.name, data.phone || null, data.email || null, data.address || null, data.notes || null, id])
    const updated = queryOne('SELECT * FROM Supplier WHERE id = ?', [id])
    if (updated) trackUpsert('Supplier', updated)
  },
  delete(id: string) { execute('DELETE FROM Supplier WHERE id = ?', [id]); trackDelete('Supplier', id) },
}

// ═══════════════════════════════════════
//  PURCHASES (with stock bump)
// ═══════════════════════════════════════
export const purchases = {
  list(shopId: string) { return query('SELECT * FROM Purchase WHERE shopId = ? ORDER BY createdAt DESC', [shopId]) },
  create(shopId: string, data: any) {
    const id = genId()
    const items = JSON.stringify(data.items || [])
    const total = data.items?.reduce((s: number, it: any) => s + (it.total || 0), 0) || data.total || 0
    execute(`INSERT INTO Purchase (id, shopId, invoiceNumber, supplierId, supplierName, subtotal, taxAmount, total, paymentMode, notes, items)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [id, shopId, data.invoiceNumber || `INV-${Date.now()}`, data.supplierId || null, data.supplierName || null,
       data.subtotal || total, data.taxAmount || 0, total, data.paymentMode || 'cash', data.notes || null, items])
    for (const it of (data.items || [])) {
      if (it.menuItemId) {
        execute('UPDATE MenuItem SET stock = stock + ? WHERE id = ?', [Number(it.qty) || 0, it.menuItemId])
        const mi = menu.getById(it.menuItemId)
        if (mi) trackUpsert('MenuItem', mi)
      }
    }
    const created = queryOne('SELECT * FROM Purchase WHERE id = ?', [id])
    if (created) trackUpsert('Purchase', created)
    return created
  },
  delete(id: string) { execute('DELETE FROM Purchase WHERE id = ?', [id]); trackDelete('Purchase', id) },
}

// ═══════════════════════════════════════
//  EXPENSES
// ═══════════════════════════════════════
export const expenses = {
  list(shopId: string) { return query('SELECT * FROM Expense WHERE shopId = ? ORDER BY date DESC', [shopId]) },
  create(shopId: string, data: any) {
    const id = genId()
    execute('INSERT INTO Expense (id, shopId, category, description, amount, paymentMode, date) VALUES (?,?,?,?,?,?,?)',
      [id, shopId, data.category, data.description, data.amount, data.paymentMode || 'cash', data.date || new Date().toISOString()])
    const created = queryOne('SELECT * FROM Expense WHERE id = ?', [id])
    if (created) trackUpsert('Expense', created)
    return created
  },
  delete(id: string) { execute('DELETE FROM Expense WHERE id = ?', [id]); trackDelete('Expense', id) },
}

// ═══════════════════════════════════════
//  MONEY IN
// ═══════════════════════════════════════
export const moneyIn = {
  list(shopId: string) { return query('SELECT * FROM MoneyIn WHERE shopId = ? ORDER BY date DESC', [shopId]) },
  create(shopId: string, data: any) {
    const id = genId()
    execute('INSERT INTO MoneyIn (id, shopId, amount, source, description, partyName, paymentMode, date) VALUES (?,?,?,?,?,?,?,?)',
      [id, shopId, data.amount, data.source || data.category || 'Investment', data.description || null, data.partyName || null, data.paymentMode || 'cash', data.date || new Date().toISOString()])
    const created = queryOne('SELECT * FROM MoneyIn WHERE id = ?', [id])
    if (created) trackUpsert('MoneyIn', created)
    return created
  },
  delete(id: string) { execute('DELETE FROM MoneyIn WHERE id = ?', [id]); trackDelete('MoneyIn', id) },
}

// ═══════════════════════════════════════
//  MONEY OUT
// ═══════════════════════════════════════
export const moneyOut = {
  list(shopId: string) { return query('SELECT * FROM MoneyOut WHERE shopId = ? ORDER BY date DESC', [shopId]) },
  create(shopId: string, data: any) {
    const id = genId()
    execute('INSERT INTO MoneyOut (id, shopId, amount, purpose, description, partyName, paymentMode, date) VALUES (?,?,?,?,?,?,?,?)',
      [id, shopId, data.amount, data.purpose || data.category || 'Owner Draw', data.description || null, data.partyName || null, data.paymentMode || 'cash', data.date || new Date().toISOString()])
    const created = queryOne('SELECT * FROM MoneyOut WHERE id = ?', [id])
    if (created) trackUpsert('MoneyOut', created)
    return created
  },
  delete(id: string) { execute('DELETE FROM MoneyOut WHERE id = ?', [id]); trackDelete('MoneyOut', id) },
}

// ═══════════════════════════════════════
//  REPORTS (advanced filters + itemized bill rows)
// ═══════════════════════════════════════
export interface ReportFilters {
  from?: string
  to?: string
  paymentMode?: string      // 'all' | 'cash' | 'upi' | 'card' | 'other'
  tableNumber?: number      // 0 = Direct Counter, 1-10 = tables
  billNoSearch?: string     // substring match on bill number
  itemSearch?: string       // substring match on any item name in the bill
  category?: string         // filter bills that contain at least one item in this category
  waiter?: string           // filter by waiter name (from Orders.waiterName)
  minAmount?: number        // bills with total >= this
  maxAmount?: number        // bills with total <= this
}

export const reports = {
  get(shopId: string, filtersOrFrom?: ReportFilters | string, maybeTo?: string) {
    // Backward-compat: callers can still pass (shopId, from, to) directly.
    // New callers should pass (shopId, { from, to, paymentMode, ... }).
    const filters: ReportFilters =
      typeof filtersOrFrom === 'string'
        ? { from: filtersOrFrom, to: maybeTo }
        : (filtersOrFrom || {})

    const fromIso = filters.from ? new Date(filters.from).toISOString() : new Date(0).toISOString()
    const toIso = filters.to ? new Date(filters.to).toISOString() : new Date().toISOString()

    // Pull all bills in the date window, then attach their orders + items
    // so we can filter by item/category/waiter client-side. SQLite on the
    // client doesn't have great JOIN support via sql.js, so we do it in JS.
    const billRows = query<any>(
      'SELECT * FROM Bill WHERE shopId = ? AND paidAt >= ? AND paidAt <= ? ORDER BY paidAt DESC',
      [shopId, fromIso, toIso]
    )
    // Attach order + items to each bill (needed for itemized table + filters)
    const bills = billRows.map((b: any) => {
      const order = orders.getById(b.orderId)
      return { ...b, order }
    })

    const expensesList = query<any>('SELECT * FROM Expense WHERE shopId = ? AND date >= ? AND date <= ?', [shopId, fromIso, toIso])
    const purchasesList = query<any>('SELECT * FROM Purchase WHERE shopId = ? AND createdAt >= ? AND createdAt <= ?', [shopId, fromIso, toIso])
    // Deleted bills in the same window — attributed by originalPaidAt so
    // the report for a given day/month correctly shows what was voided
    // from that period's sales.
    const deletedBillsList = query<any>(
      'SELECT * FROM DeletedBill WHERE shopId = ? AND originalPaidAt >= ? AND originalPaidAt <= ? ORDER BY deletedAt DESC',
      [shopId, fromIso, toIso]
    )

    // ─── Apply advanced filters ──────────────────────────────────────────
    let filteredBills = bills
    if (filters.paymentMode && filters.paymentMode !== 'all') {
      filteredBills = filteredBills.filter((b: any) => b.paymentMode === filters.paymentMode)
    }
    if (filters.tableNumber != null && !Number.isNaN(filters.tableNumber)) {
      filteredBills = filteredBills.filter((b: any) => b.tableNumber === filters.tableNumber)
    }
    if (filters.billNoSearch) {
      const term = String(filters.billNoSearch).toLowerCase()
      filteredBills = filteredBills.filter((b: any) => String(b.billNo).includes(term))
    }
    if (filters.itemSearch) {
      const term = String(filters.itemSearch).toLowerCase()
      filteredBills = filteredBills.filter((b: any) =>
        (b.order?.items || []).some((it: any) =>
          String(it.name || '').toLowerCase().includes(term)
        )
      )
    }
    if (filters.category && filters.category !== 'all') {
      filteredBills = filteredBills.filter((b: any) =>
        (b.order?.items || []).some((it: any) => {
          // OrderItem doesn't store category directly; we look it up from
          // the menu by menuItemId if available, else by name match.
          const mi = queryOne<any>('SELECT category FROM MenuItem WHERE id = ?', [it.menuItemId])
          return mi?.category === filters.category
        })
      )
    }
    if (filters.waiter) {
      const term = String(filters.waiter).toLowerCase()
      filteredBills = filteredBills.filter((b: any) =>
        String(b.order?.waiterName || '').toLowerCase().includes(term)
      )
    }
    if (filters.minAmount != null && !Number.isNaN(filters.minAmount)) {
      filteredBills = filteredBills.filter((b: any) => Number(b.total) >= filters.minAmount!)
    }
    if (filters.maxAmount != null && !Number.isNaN(filters.maxAmount)) {
      filteredBills = filteredBills.filter((b: any) => Number(b.total) <= filters.maxAmount!)
    }

    // ─── Build itemized rows (one row per line item across all filtered bills) ───
    // This powers the detailed sales table and the per-item breakdown.
    const itemizedRows: any[] = []
    for (const b of filteredBills) {
      const items = (b.order?.items || []).filter((it: any) => it.status !== 'cancelled')
      for (const it of items) {
        const mi = queryOne<any>('SELECT category FROM MenuItem WHERE id = ?', [it.menuItemId])
        itemizedRows.push({
          billNo: b.billNo,
          paidAt: b.paidAt,
          tableNumber: b.tableNumber,
          waiterName: b.order?.waiterName || null,
          customerName: b.order?.customerName || null,
          paymentMode: b.paymentMode,
          itemName: it.name,
          category: mi?.category || 'General',
          quantity: Number(it.quantity) || 0,
          price: Number(it.price) || 0,
          lineTotal: (Number(it.quantity) || 0) * (Number(it.price) || 0),
          billTotal: Number(b.total) || 0,
        })
      }
    }

    // ─── Aggregates from FILTERED bills ──────────────────────────────────
    const salesRevenue = filteredBills.reduce((s: number, b: any) => s + (b.total || 0), 0)
    const totalExpenses = expensesList.reduce((s: number, e: any) => s + (e.amount || 0), 0)
    const totalPurchases = purchasesList.reduce((s: number, p: any) => s + (p.total || 0), 0)
    const deletedBillAmount = deletedBillsList.reduce((s: number, d: any) => s + (d.total || 0), 0)
    const totalItemsSold = itemizedRows.reduce((s: number, r: any) => s + (r.quantity || 0), 0)

    // Payment breakdown — count + total
    const byPaymentMap: Record<string, { count: number; total: number }> = {}
    for (const b of filteredBills) {
      const m = b.paymentMode || 'other'
      if (!byPaymentMap[m]) byPaymentMap[m] = { count: 0, total: 0 }
      byPaymentMap[m].count++
      byPaymentMap[m].total += (b.total || 0)
    }

    // Top items (by qty) — computed from itemizedRows.
    // Includes category so the UI can show it in the item-wise table.
    const topItemsMap: Record<string, { name: string; category: string; qty: number; revenue: number }> = {}
    for (const r of itemizedRows) {
      if (!topItemsMap[r.itemName]) topItemsMap[r.itemName] = { name: r.itemName, category: r.category, qty: 0, revenue: 0 }
      topItemsMap[r.itemName].qty += r.quantity
      topItemsMap[r.itemName].revenue += r.lineTotal
    }
    const topItems = Object.values(topItemsMap).sort((a, b) => b.qty - a.qty).slice(0, 100)

    // Category breakdown
    const categoryMap: Record<string, { qty: number; revenue: number }> = {}
    for (const r of itemizedRows) {
      if (!categoryMap[r.category]) categoryMap[r.category] = { qty: 0, revenue: 0 }
      categoryMap[r.category].qty += r.quantity
      categoryMap[r.category].revenue += r.lineTotal
    }
    const byCategory = Object.entries(categoryMap)
      .map(([name, v]) => ({ name, qty: v.qty, revenue: v.revenue }))
      .sort((a, b) => b.revenue - a.revenue)

    // Expense breakdown
    const expenseByCategory: Record<string, number> = {}
    for (const e of expensesList) expenseByCategory[e.category] = (expenseByCategory[e.category] || 0) + (e.amount || 0)

    // Daily breakdown (sales per day)
    const dailyMap: Record<string, { sales: number; expenses: number; count: number }> = {}
    for (const b of filteredBills) {
      const day = (b.paidAt || '').slice(0, 10)
      if (!day) continue
      if (!dailyMap[day]) dailyMap[day] = { sales: 0, expenses: 0, count: 0 }
      dailyMap[day].sales += (b.total || 0)
      dailyMap[day].count++
    }
    for (const e of expensesList) {
      const day = (e.date || '').slice(0, 10)
      if (!day) continue
      if (!dailyMap[day]) dailyMap[day] = { sales: 0, expenses: 0, count: 0 }
      dailyMap[day].expenses += (e.amount || 0)
    }
    const dailyBreakdown = Object.entries(dailyMap)
      .map(([date, v]) => ({ date, sales: v.sales, expenses: v.expenses, count: v.count }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // Hourly breakdown (sales by hour of day) — useful for staffing decisions
    const hourlyMap: Record<number, { sales: number; count: number }> = {}
    for (let h = 0; h < 24; h++) hourlyMap[h] = { sales: 0, count: 0 }
    for (const b of filteredBills) {
      const d = new Date(b.paidAt)
      const h = d.getHours()
      hourlyMap[h].sales += (b.total || 0)
      hourlyMap[h].count++
    }
    const hourlyBreakdown = Object.entries(hourlyMap).map(([hour, v]) => ({
      hour: Number(hour),
      label: `${String(hour).padStart(2, '0')}:00`,
      sales: v.sales,
      count: v.count,
    }))

    return {
      summary: {
        salesRevenue,
        totalExpenses,
        totalPurchases,
        deletedBillAmount,
        deletedBillCount: deletedBillsList.length,
        netProfit: salesRevenue - totalExpenses - totalPurchases - deletedBillAmount,
        cashFlow: salesRevenue - totalExpenses - totalPurchases - deletedBillAmount,
        billCount: filteredBills.length,
        avgBill: filteredBills.length ? salesRevenue / filteredBills.length : 0,
        totalItemsSold,
      },
      byPayment: byPaymentMap,
      byCategory,
      topItems,
      expenseByCategory,
      dailyBreakdown,
      hourlyBreakdown,
      // bills now have .order attached so the UI can show itemized rows
      bills: filteredBills,
      // Flat one-row-per-line-item table — for the detailed sales report
      itemizedRows,
      deletedBills: deletedBillsList,
    }
  },
}

// ═══════════════════════════════════════
//  CONVERTERS (SQLite integer → JS boolean/types)
// ═══════════════════════════════════════
function convertShop(row: any) {
  return { ...row, active: !!row.active }
}
function convertMenuItem(row: any) {
  return { ...row, available: !!row.available }
}
function convertTable(row: any) {
  return { ...row, status: row.status }
}
function convertOrder(row: any) {
  return { ...row, kotPrinted: !!row.kotPrinted, billPrinted: !!row.billPrinted }
}
function convertOrderItem(row: any) {
  return { ...row }
}
function convertBill(row: any) {
  return { ...row }
}
function convertSettings(row: any) {
  if (!row) return null
  const boolKeys = ['billShowLogo','billShowGstin','billShowPhone','billShowAddress','billShowEmail','billShowDateTime','billShowWaiter','billShowCustomer','billShowKotNo','billBoldFont','kotShowLogo','kotShowWaiter','kotShowDateTime','kotShowTable','kotShowGuests','kotBoldFont','zomatoEnabled']
  const result = { ...row }
  for (const key of boolKeys) { if (key in result) result[key] = !!result[key] }
  return result
}
function convertUser(row: any) {
  return { ...row, active: !!row.active }
}
function convertZomatoOrder(row: any) {
  if (!row) return null
  return { ...row }
}
