'use client'

import { getSupabase } from './supabase'

function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server'
  const key = 'thuso-device-id'
  let id = localStorage.getItem(key)
  if (!id) {
    id = 'dev_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
    localStorage.setItem(key, id)
  }
  return id
}

const DEVICE_ID = typeof window !== 'undefined' ? getDeviceId() : 'server'

function canSync(): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false
  return !!getSupabase()
}

let schemaOk: boolean | null = null
let lastSchemaCheck: number = 0

async function checkSchema(): Promise<boolean> {
  if (schemaOk === true) return true
  const now = Date.now()
  if (schemaOk === false && now - lastSchemaCheck < 60000) return false
  lastSchemaCheck = now
  const supabase = getSupabase()
  if (!supabase) { schemaOk = false; return false }
  try {
    const { error } = await supabase.from('sync_bills').select('id').limit(1)
    if (error && (error.message.includes('Could not find the table') || error.code === 'PGRST205')) {
      schemaOk = false; return false
    }
    schemaOk = true; return true
  } catch { schemaOk = false; return false }
}

const TABLE_MAP: Record<string, string> = {
  Bill: 'sync_bills', Orders: 'sync_orders', OrderItem: 'sync_order_items',
  Expense: 'sync_expenses', MoneyIn: 'sync_money_in', MoneyOut: 'sync_money_out',
  Purchase: 'sync_purchases', Customer: 'sync_customers', Supplier: 'sync_suppliers',
  MenuItem: 'sync_menu_items', RestaurantTable: 'sync_tables', Shop: 'sync_shops',
}

const TABLE_COLUMNS: Record<string, string[]> = {
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

export async function pushRow(table: string, row: any): Promise<void> {
  if (!canSync()) return
  if (!(await checkSchema())) return
  const supabase = getSupabase()!
  const supaTable = TABLE_MAP[table]
  if (!supaTable) return
  const allowedCols = TABLE_COLUMNS[table]
  if (!allowedCols) return
  try {
    const payload: any = { sync_device_id: DEVICE_ID, sync_updated_at: new Date().toISOString() }
    for (const col of allowedCols) { if (row[col] !== undefined) payload[col] = row[col] }
    for (const key of ['active', 'available', 'kotPrinted', 'billPrinted']) {
      if (key in payload && (payload[key] === 0 || payload[key] === 1)) payload[key] = payload[key] === 1
    }
    await supabase.from(supaTable).upsert(payload, { onConflict: 'id' })
  } catch (e: any) {
    console.warn(`[supabase-sync] push ${supaTable} error:`, e?.message)
  }
}

export async function pushDelete(table: string, id: string): Promise<void> {
  if (!canSync()) return
  if (!(await checkSchema())) return
  const supabase = getSupabase()!
  const supaTable = TABLE_MAP[table]
  if (!supaTable) return
  try {
    await supabase.from(supaTable).delete().eq('id', id)
  } catch (e: any) {
    console.warn(`[supabase-sync] delete ${supaTable} error:`, e?.message)
  }
}

export function getLastSync(): Date {
  if (typeof window === 'undefined') return new Date(0)
  const stored = localStorage.getItem('thuso-last-sync')
  return stored ? new Date(stored) : new Date(0)
}

export function setLastSync(date: Date): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('thuso-last-sync', date.toISOString())
}

export async function pullChanges(lastSync: Date): Promise<Record<string, any[]>> {
  if (!canSync()) return {}
  if (!(await checkSchema())) return {}
  const supabase = getSupabase()!
  const result: Record<string, any[]> = {}
  const lastSyncIso = lastSync.toISOString()
  const isFullSync = lastSync.getFullYear() === 1970
  for (const [localTable, supaTable] of Object.entries(TABLE_MAP)) {
    try {
      let q = supabase.from(supaTable).select('*')
      if (!isFullSync) {
        q = q.gt('sync_updated_at', lastSyncIso).neq('sync_device_id', DEVICE_ID)
      }
      const { data, error } = await q.order('sync_updated_at', { ascending: true }).limit(2000)
      if (error) continue
      if (data && data.length > 0) result[localTable] = data
    } catch { /* ignore */ }
  }
  return result
}
