'use client'

/**
 * OfflineSync — orchestrates bidirectional sync between local SQLite
 * and Supabase so the app never loses data, even when offline.
 *
 * Lifecycle:
 *   1. App opens → initDB() loads local SQLite.
 *   2. bootstrapSync() runs in background:
 *        a) Pulls all remote rows changed since the last sync from Supabase
 *           and upserts them into local SQLite.
 *        b) Drains the local SyncOutbox → pushes pending upserts/deletes
 *           to Supabase.
 *   3. SyncManager (already running) keeps draining the outbox every 10 s
 *      so any subsequent writes also propagate.
 *
 * Every mutating call in client-data.ts (create/update/delete) goes through
 * trackUpsert / trackDelete below, which:
 *   - immediately tries pushRow() (best-effort, no-op if offline)
 *   - ALWAYS appends a record to SyncOutbox so it can be retried
 *   - on success, marks the outbox row as 'synced'
 *
 * If the device is offline, the row stays 'pending' in the outbox; the
 * next time the device goes online, drainOutbox() picks it up and pushes.
 */

import { query, queryOne, execute, genId } from './client-db'
import { pullChanges, pushRow, pushDelete, getLastSync, setLastSync } from './supabase-sync'

// Tables that participate in data-row sync (KOT events use a separate flow).
const SYNCED_TABLES = [
  'Bill', 'Orders', 'OrderItem', 'Expense', 'MoneyIn', 'MoneyOut',
  'Purchase', 'Customer', 'Supplier', 'MenuItem', 'RestaurantTable', 'Shop',
]

// Columns per table — must match the columns Supabase returns.
// Used so we don't try to write columns that don't exist locally.
const LOCAL_COLUMNS: Record<string, string[]> = {
  Bill: ['id', 'shopId', 'billNo', 'orderId', 'tableNumber', 'subtotal', 'taxRate', 'taxAmount', 'discount', 'serviceCharge', 'total', 'paymentMode', 'paymentStatus', 'paidAt', 'createdAt'],
  Orders: ['id', 'shopId', 'tableId', 'status', 'type', 'guests', 'waiterName', 'customerName', 'notes', 'kotPrinted', 'billPrinted', 'createdAt', 'updatedAt'],
  OrderItem: ['id', 'orderId', 'menuItemId', 'name', 'price', 'quantity', 'status', 'notes', 'createdAt', 'updatedAt'],
  Expense: ['id', 'shopId', 'category', 'description', 'amount', 'paymentMode', 'date', 'createdAt'],
  MoneyIn: ['id', 'shopId', 'amount', 'source', 'description', 'partyName', 'paymentMode', 'date', 'createdAt'],
  MoneyOut: ['id', 'shopId', 'amount', 'purpose', 'description', 'partyName', 'paymentMode', 'date', 'createdAt'],
  Purchase: ['id', 'shopId', 'invoiceNumber', 'supplierId', 'supplierName', 'subtotal', 'taxAmount', 'total', 'paymentMode', 'notes', 'items', 'createdAt'],
  Customer: ['id', 'shopId', 'name', 'phone', 'email', 'address', 'notes', 'createdAt', 'updatedAt'],
  Supplier: ['id', 'shopId', 'name', 'phone', 'email', 'address', 'notes', 'createdAt', 'updatedAt'],
  MenuItem: ['id', 'shopId', 'name', 'category', 'price', 'cost', 'stock', 'unit', 'image', 'available', 'createdAt', 'updatedAt'],
  RestaurantTable: ['id', 'shopId', 'number', 'name', 'capacity', 'status', 'currentOrderId', 'createdAt', 'updatedAt'],
  Shop: ['id', 'name', 'code', 'address', 'phone', 'gstin', 'taxRate', 'serviceRate', 'currency', 'color', 'active', 'createdAt', 'updatedAt'],
}

// Boolean-flag columns that come back from Supabase as true/false but
// must be stored in SQLite as 1/0.
const BOOL_COLS: Record<string, string[]> = {
  Shop: ['active'],
  MenuItem: ['available'],
  Orders: ['kotPrinted', 'billPrinted'],
}

// ─── Track a local write → enqueue in SyncOutbox + best-effort push ───
export function trackUpsert(table: string, row: any): void {
  if (!SYNCED_TABLES.includes(table)) return
  if (!row || !row.id) return
  try {
    execute(
      'INSERT INTO SyncOutbox (id, eventType, payload, status) VALUES (?,?,?,?)',
      [genId(), `data_upsert:${table}`, JSON.stringify({ table, row }), 'pending']
    )
  } catch (e) {
    console.warn('[offline-sync] trackUpsert enqueue failed:', e)
  }
  // Best-effort push right now; if offline, the SyncManager will retry.
  pushRow(table, row).catch(() => {})
}

export function trackDelete(table: string, id: string): void {
  if (!SYNCED_TABLES.includes(table)) return
  try {
    execute(
      'INSERT INTO SyncOutbox (id, eventType, payload, status) VALUES (?,?,?,?)',
      [genId(), `data_delete:${table}`, JSON.stringify({ table, id }), 'pending']
    )
  } catch (e) {
    console.warn('[offline-sync] trackDelete enqueue failed:', e)
  }
  pushDelete(table, id).catch(() => {})
}

// ─── Apply remote changes (from pullChanges) into local SQLite ───
export function applyRemoteChanges(changes: Record<string, any[]>): number {
  let applied = 0
  for (const [table, rows] of Object.entries(changes)) {
    const cols = LOCAL_COLUMNS[table]
    if (!cols) continue
    const boolSet = new Set(BOOL_COLS[table] || [])
    for (const row of rows) {
      try {
        // Build column list + value list (only columns that exist locally).
        const presentCols: string[] = []
        const values: any[] = []
        for (const c of cols) {
          if (row[c] !== undefined && row[c] !== null) {
            presentCols.push(c)
            values.push(boolSet.has(c) ? (row[c] ? 1 : 0) : row[c])
          }
        }
        if (presentCols.length === 0) continue
        // SQLite UPSERT (INSERT OR REPLACE)
        const placeholders = presentCols.map(() => '?').join(',')
        const sql = `INSERT OR REPLACE INTO ${table} (${presentCols.join(',')}) VALUES (${placeholders})`
        execute(sql, values)
        applied++
      } catch (e) {
        // Don't let one bad row abort the whole sync.
        console.warn(`[offline-sync] apply ${table} row failed:`, e)
      }
    }
  }
  return applied
}

// ─── Bootstrap: pull everything from Supabase, apply locally, drain outbox ───
export async function bootstrapSync(): Promise<{ pulled: number; pushed: number }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { pulled: 0, pushed: 0 }
  }
  let pulled = 0
  try {
    const lastSync = getLastSync()
    const changes = await pullChanges(lastSync)
    pulled = applyRemoteChanges(changes)
    setLastSync(new Date())
  } catch (e) {
    console.warn('[offline-sync] bootstrap pull failed:', e)
  }
  // After pulling, drain any locally-pending writes to Supabase.
  const pushed = await drainOutbox()
  return { pulled, pushed }
}

// ─── Drain the SyncOutbox: push each pending row to Supabase ───
// Returns the number of successfully-synced rows.
export async function drainOutbox(): Promise<number> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 0
  let synced = 0
  let pending: any[] = []
  try {
    pending = query<any>(
      "SELECT * FROM SyncOutbox WHERE status = 'pending' ORDER BY createdAt ASC LIMIT 200"
    )
  } catch (e) {
    console.warn('[offline-sync] could not read outbox:', e)
    return 0
  }
  for (const item of pending) {
    try {
      const payload = JSON.parse(item.payload || '{}')
      let ok = false
      if (item.eventType?.startsWith('data_upsert:')) {
        await pushRow(payload.table, payload.row)
        ok = true
      } else if (item.eventType?.startsWith('data_delete:')) {
        await pushDelete(payload.table, payload.id)
        ok = true
      }
      // KOT events (kot:*, item:*, order:*, table:*) are handled by the
      // existing SyncManager → kot_events table; skip them here.
      if (ok) {
        execute(
          "UPDATE SyncOutbox SET status = 'synced', syncedAt = ? WHERE id = ?",
          [new Date().toISOString(), item.id]
        )
        synced++
      } else {
        // Increment attempts so we can eventually give up on poison rows.
        execute(
          'UPDATE SyncOutbox SET attempts = attempts + 1 WHERE id = ?',
          [item.id]
        )
      }
    } catch (e) {
      console.warn('[offline-sync] drain row failed:', e)
      try {
        execute('UPDATE SyncOutbox SET attempts = attempts + 1 WHERE id = ?', [item.id])
      } catch {}
    }
  }
  return synced
}

// Re-export so callers can use a single import.
export { pullChanges, pushRow, pushDelete, getLastSync, setLastSync }
