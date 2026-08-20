'use client'

import { useCallback } from 'react'
import { useSession } from '@/lib/session'
import {
  menu, tables, orders, bills, settings, users, dashboard,
  zomato, audit, syncQueue,
  shops, customers, suppliers, purchases, expenses, moneyIn, moneyOut, reports,
  deletedBills, menuCategories,
} from '@/lib/client-data'

/**
 * useShopFetch — COMPATIBILITY SHIM
 *
 * Intercepts fetch('/api/...') calls and routes them to client-side
 * SQLite functions instead. This allows ALL existing components to
 * work WITHOUT any changes — no server needed.
 *
 * The shim parses the URL and HTTP method, calls the appropriate
 * client-data function, and returns a Response-like object.
 */

interface FakeResponse {
  ok: boolean
  status: number
  json: () => Promise<any>
  text: () => Promise<string>
  [k: string]: any
}

function fakeResponse(data: any, status = 200): FakeResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  }
}

function parseBody(body: string | undefined): any {
  if (!body) return {}
  try { return JSON.parse(body) } catch { return {} }
}

export function useShopFetch() {
  const { currentShop } = useSession()
  const shopId = currentShop?.id || ''

  return useCallback(async (url: string, options: RequestInit = {}): Promise<FakeResponse> => {
    const method = options.method || 'GET'
    const body = parseBody(typeof options.body === 'string' ? options.body : undefined)

    // ─── MENU ───
    if (url === '/api/menu' || url === '/api/menu/') {
      if (method === 'GET') return fakeResponse({ items: menu.list(shopId) })
      if (method === 'POST') return fakeResponse({ item: menu.create(shopId, body) }, 201)
    }
    // /api/menu/[id]
    const menuMatch = url.match(/^\/api\/menu\/([^/]+)$/)
    if (menuMatch) {
      const id = menuMatch[1]
      if (method === 'PUT') return fakeResponse({ item: menu.update(id, body) })
      if (method === 'DELETE') { menu.delete(id); return fakeResponse({ ok: true }) }
    }

    // ─── MENU CATEGORIES ──────────────────────────────────────────────
    // Per-shop, user-manageable categories. Backed by the menuCategories
    // export in client-data.ts (which uses the MenuCategory table created
    // in client-db.ts SCHEMA_SQL + migrateSchema).
    if (url === '/api/menu-categories' || url.startsWith('/api/menu-categories?')) {
      if (method === 'GET') {
        try {
          const cats = menuCategories.list(shopId)
          return fakeResponse({ categories: cats })
        } catch (e: any) {
          console.error('[shopFetch] menu-categories GET error:', e)
          return fakeResponse({ error: e?.message || 'Failed to load categories' }, 500)
        }
      }
      if (method === 'POST') {
        try {
          const created = menuCategories.create(shopId, body)
          return fakeResponse({ category: created }, 201)
        } catch (e: any) {
          const msg = e?.message || 'Failed to create category'
          const status = msg.includes('already exists') ? 409 : 400
          return fakeResponse({ error: msg }, status)
        }
      }
    }
    // /api/menu-categories/[id]
    const menuCatMatch = url.match(/^\/api\/menu-categories\/([^/]+)$/)
    if (menuCatMatch) {
      const id = menuCatMatch[1]
      if (method === 'PUT') {
        try {
          const updated = menuCategories.update(id, body)
          return fakeResponse({ category: updated })
        } catch (e: any) {
          const msg = e?.message || 'Failed to update category'
          const status = msg.includes('not found') ? 404 : msg.includes('already has') ? 409 : 400
          return fakeResponse({ error: msg }, status)
        }
      }
      if (method === 'DELETE') {
        try {
          const result = menuCategories.delete(id)
          return fakeResponse({ ok: true, ...result })
        } catch (e: any) {
          const msg = e?.message || 'Failed to delete category'
          const status = msg.includes('not found') ? 404 : 400
          return fakeResponse({ error: msg }, status)
        }
      }
    }

    // ─── TABLES ───
    if (url === '/api/tables' && method === 'GET') return fakeResponse({ tables: tables.list(shopId) })
    if (url === '/api/tables' && method === 'POST') return fakeResponse({ table: { id: 'new' } }, 201)
    if (url === '/api/tables/seed' && method === 'POST') {
      tables.seed(shopId)
      return fakeResponse({ seeded: true, tables: tables.list(shopId) })
    }

    // ─── ORDERS ───
    if (url.startsWith('/api/orders?')) {
      const status = new URLSearchParams(url.split('?')[1]).get('status')
      return fakeResponse({ orders: orders.list(shopId, status || undefined) })
    }
    if (url === '/api/orders' && method === 'POST') {
      return fakeResponse({ order: orders.create(shopId, body.tableId, body.type, body.guests, body.waiterName, body.customerName, body.notes) }, 201)
    }
    // /api/orders/[id]
    const orderMatch = url.match(/^\/api\/orders\/([^/]+)$/)
    if (orderMatch) {
      const id = orderMatch[1]
      if (method === 'GET') return fakeResponse({ order: orders.getById(id) })
      if (method === 'DELETE') { orders.delete(id); return fakeResponse({ ok: true }) }
    }
    // /api/orders/[id]/items
    const itemsMatch = url.match(/^\/api\/orders\/([^/]+)\/items$/)
    if (itemsMatch && method === 'POST') {
      const orderId = itemsMatch[1]
      for (const it of body.items || []) {
        const menuItem = menu.list(shopId).find((m: any) => m.id === it.menuItemId)
        if (menuItem) orders.addItem(orderId, it.menuItemId, menuItem.name, menuItem.price, it.quantity, it.notes)
      }
      return fakeResponse({ order: orders.getById(orderId) }, 201)
    }
    // /api/orders/[id]/items/[itemId]
    const itemMatch = url.match(/^\/api\/orders\/([^/]+)\/items\/([^/]+)$/)
    if (itemMatch) {
      const [, orderId, itemId] = itemMatch
      if (method === 'PATCH') return fakeResponse({ item: orders.updateItem(itemId, body), order: orders.getById(orderId) })
      if (method === 'DELETE') { orders.deleteItem(itemId); return fakeResponse({ ok: true }) }
    }
    // /api/orders/[id]/send
    const sendMatch = url.match(/^\/api\/orders\/([^/]+)\/send$/)
    if (sendMatch && method === 'POST') {
      const id = sendMatch[1]
      return fakeResponse({ order: orders.sendKOT(id) })
    }
    // /api/orders/[id]/status
    const statusMatch = url.match(/^\/api\/orders\/([^/]+)\/status$/)
    if (statusMatch && method === 'PATCH') {
      return fakeResponse({ order: orders.updateStatus(statusMatch[1], body.status) })
    }
    // /api/orders/[id]/free-table
    const freeMatch = url.match(/^\/api\/orders\/([^/]+)\/free-table$/)
    if (freeMatch && method === 'POST') {
      orders.freeTable(freeMatch[1])
      return fakeResponse({ ok: true })
    }

    // ─── BILLS ───
    if (url.startsWith('/api/bills?') || (url === '/api/bills' && method === 'GET')) {
      const params = new URLSearchParams(url.split('?')[1] || '')
      const billsList = bills.list(shopId, { from: params.get('from') || undefined, to: params.get('to') || undefined, table: params.get('table') ? Number(params.get('table')) : undefined, q: params.get('q') || undefined })
      // ─── Compute summary from the filtered bills list ───
      // Previously this was hardcoded to { totalRevenue: 0, totalBills: 0 },
      // which meant the History / Dashboard stat cards always showed ₹0 even
      // when bills existed with correct totals.
      const totalRevenue = billsList.reduce((s: number, b: any) => s + (Number(b.total) || 0), 0)
      const totalBills = billsList.length
      const byPayment: Record<string, number> = {}
      for (const b of billsList) {
        const mode = b.paymentMode || 'other'
        byPayment[mode] = (byPayment[mode] || 0) + (Number(b.total) || 0)
      }
      return fakeResponse({
        bills: billsList,
        summary: { totalRevenue, totalBills, byPayment },
      })
    }
    if (url === '/api/bills' && method === 'POST') {
      const order = orders.getById(body.orderId)
      if (!order) return fakeResponse({ error: 'Order not found' }, 404)
      const bill = bills.create(shopId, body.orderId, order.table?.number || 0, body.subtotal || 0, body.taxRate || 0, body.taxAmount || 0, body.discount || 0, body.serviceCharge || 0, body.total || 0, body.paymentMode || 'cash')
      return fakeResponse({ bill }, 201)
    }
    if (url === '/api/bills/next-no' && method === 'GET') {
      return fakeResponse({ nextNo: bills.nextNo(shopId) })
    }
    // GET /api/bills/deleted — list all voided bills for the current shop.
    // MUST be matched BEFORE the /api/bills/[id] route below, otherwise
    // "deleted" would be treated as a bill id.
    if ((url === '/api/bills/deleted' || url.startsWith('/api/bills/deleted?')) && method === 'GET') {
      const params = new URLSearchParams(url.split('?')[1] || '')
      const list = deletedBills.list(shopId, {
        from: params.get('from') || undefined,
        to: params.get('to') || undefined,
      })
      const totals = deletedBills.totals(shopId, {
        from: params.get('from') || undefined,
        to: params.get('to') || undefined,
      })
      return fakeResponse({ items: list, totals })
    }
    const billMatch = url.match(/^\/api\/bills\/([^/]+)$/)
    if (billMatch && method === 'GET') return fakeResponse({ bill: bills.getById(billMatch[1]) })
    // DELETE /api/bills/[id] — void a bill. Body: { reason, deletedBy, deletedById }.
    // The bills.delete() helper captures a snapshot into DeletedBill, reverses
    // the auto-added MoneyIn, frees the table, writes an audit log entry, and
    // finally removes the Bill row.
    if (billMatch && method === 'DELETE') {
      const ok = bills.delete(billMatch[1], {
        reason: body.reason,
        deletedBy: body.deletedBy,
        deletedById: body.deletedById,
      })
      if (!ok) return fakeResponse({ error: 'Bill not found' }, 404)
      return fakeResponse({ ok: true })
    }

    // ─── SETTINGS ───
    if (url === '/api/settings' && method === 'GET') return fakeResponse({ settings: settings.get(shopId) })
    if (url === '/api/settings' && method === 'PUT') return fakeResponse({ settings: settings.update(shopId, body) })

    // ─── DASHBOARD ───
    if (url === '/api/dashboard' && method === 'GET') return fakeResponse(dashboard.get(shopId))

    // ─── USERS ───
    if (url === '/api/users' && method === 'GET') return fakeResponse({ users: users.list() })
    if (url === '/api/users' && method === 'POST') return fakeResponse({ user: users.create(body) }, 201)
    if (url === '/api/users' && method === 'PUT') return fakeResponse({ user: users.update(body.id, body) })
    const userDelMatch = url.match(/^\/api\/users\?id=(.+)$/)
    if (userDelMatch && method === 'DELETE') { users.delete(userDelMatch[1]); return fakeResponse({ ok: true }) }

    // ─── ZOMATO ───
    if (url.startsWith('/api/zomato?') || (url === '/api/zomato' && method === 'GET')) {
      const status = new URLSearchParams(url.split('?')[1] || '').get('status')
      return fakeResponse({ orders: zomato.list(shopId, status || undefined) })
    }
    if (url === '/api/zomato' && method === 'POST') return fakeResponse({ order: zomato.create(shopId, body) }, 201)
    if (url === '/api/zomato/sync' && method === 'POST') return fakeResponse({ created: [], count: 0, mode: 'simulation' })
    const zomatoMatch = url.match(/^\/api\/zomato\/([^/]+)$/)
    if (zomatoMatch) {
      const id = zomatoMatch[1]
      if (method === 'PATCH') { zomato.updateStatus(id, body.status); return fakeResponse({ order: zomato.getById(id) }) }
      if (method === 'DELETE') { zomato.delete(id); return fakeResponse({ ok: true }) }
    }
    const zomatoPushMatch = url.match(/^\/api\/zomato\/([^/]+)\/push$/)
    if (zomatoPushMatch && method === 'POST') {
      const order = zomato.pushToKitchen(shopId, zomatoPushMatch[1])
      return fakeResponse({ order, zomatoOrderId: zomato.getById(zomatoPushMatch[1])?.zomatoOrderId })
    }

    // ─── AUDIT ───
    if ((url === '/api/audit' || url.startsWith('/api/audit?')) && method === 'GET') {
      const params = new URLSearchParams(url.split('?')[1] || '')
      return fakeResponse({ logs: audit.list(shopId, params.get('action') || undefined) })
    }
    if (url === '/api/audit' && method === 'POST') {
      audit.log(body.action, body.details, shopId, body.userName)
      return fakeResponse({ ok: true })
    }

    // ─── AUTO-SEED ───
    if (url === '/api/auto-seed') return fakeResponse({ seeded: false, message: 'Database already initialized' })

    // ─── CUSTOMERS ───
    if ((url === '/api/customers' || url.startsWith('/api/customers?')) && method === 'GET') return fakeResponse({ customers: customers.list(shopId) })
    if (url === '/api/customers' && method === 'POST') return fakeResponse({ customer: customers.create(shopId, body) }, 201)
    const custMatch = url.match(/^\/api\/customers\/([^/?]+)$/)
    if (custMatch) {
      if (method === 'PUT') { customers.update(custMatch[1], body); return fakeResponse({ ok: true }) }
      if (method === 'DELETE') { customers.delete(custMatch[1]); return fakeResponse({ ok: true }) }
    }
    const custDelMatch = url.match(/^\/api\/customers\?id=(.+)$/)
    if (custDelMatch && method === 'DELETE') { customers.delete(custDelMatch[1]); return fakeResponse({ ok: true }) }

    // ─── SUPPLIERS ───
    if ((url === '/api/suppliers' || url.startsWith('/api/suppliers?')) && method === 'GET') return fakeResponse({ suppliers: suppliers.list(shopId) })
    if (url === '/api/suppliers' && method === 'POST') return fakeResponse({ supplier: suppliers.create(shopId, body) }, 201)
    const suppMatch = url.match(/^\/api\/suppliers\/([^/?]+)$/)
    if (suppMatch) {
      if (method === 'PUT') { suppliers.update(suppMatch[1], body); return fakeResponse({ ok: true }) }
      if (method === 'DELETE') { suppliers.delete(suppMatch[1]); return fakeResponse({ ok: true }) }
    }
    const suppDelMatch = url.match(/^\/api\/suppliers\?id=(.+)$/)
    if (suppDelMatch && method === 'DELETE') { suppliers.delete(suppDelMatch[1]); return fakeResponse({ ok: true }) }

    // ─── PURCHASES ───
    if (url === '/api/purchases' && method === 'GET') return fakeResponse({ purchases: purchases.list(shopId) })
    if (url === '/api/purchases' && method === 'POST') return fakeResponse({ purchase: purchases.create(shopId, body) }, 201)
    const purchMatch = url.match(/^\/api\/purchases\?id=(.+)$/)
    if (purchMatch && method === 'DELETE') { purchases.delete(purchMatch[1]); return fakeResponse({ ok: true }) }

    // ─── EXPENSES ───
    if (url === '/api/expenses' && method === 'GET') return fakeResponse({ expenses: expenses.list(shopId) })
    if (url === '/api/expenses' && method === 'POST') return fakeResponse({ expense: expenses.create(shopId, body) }, 201)
    const expMatch = url.match(/^\/api\/expenses\?id=(.+)$/)
    if (expMatch && method === 'DELETE') { expenses.delete(expMatch[1]); return fakeResponse({ ok: true }) }

    // ─── MONEY IN ───
    if (url === '/api/moneyin' && method === 'GET') return fakeResponse({ items: moneyIn.list(shopId) })
    if (url === '/api/moneyin' && method === 'POST') return fakeResponse({ item: moneyIn.create(shopId, body) }, 201)
    const miMatch = url.match(/^\/api\/moneyin\?id=(.+)$/)
    if (miMatch && method === 'DELETE') { moneyIn.delete(miMatch[1]); return fakeResponse({ ok: true }) }

    // ─── MONEY OUT ───
    if (url === '/api/moneyout' && method === 'GET') return fakeResponse({ items: moneyOut.list(shopId) })
    if (url === '/api/moneyout' && method === 'POST') return fakeResponse({ item: moneyOut.create(shopId, body) }, 201)
    const moMatch = url.match(/^\/api\/moneyout\?id=(.+)$/)
    if (moMatch && method === 'DELETE') { moneyOut.delete(moMatch[1]); return fakeResponse({ ok: true }) }

    // ─── REPORTS ───
    if (url.startsWith('/api/reports')) {
      const params = new URLSearchParams(url.split('?')[1] || '')
      // Build a filters object from query params. Supports the advanced
      // filter set: from, to, paymentMode, table, billNo, item, category,
      // waiter, minAmount, maxAmount. Old callers passing just from/to
      // still work because reports.get() accepts (shopId, from, to) too.
      const filters: any = {}
      if (params.get('from')) filters.from = params.get('from')!
      if (params.get('to')) filters.to = params.get('to')!
      if (params.get('paymentMode') && params.get('paymentMode') !== 'all') filters.paymentMode = params.get('paymentMode')!
      if (params.get('table')) filters.tableNumber = Number(params.get('table'))
      if (params.get('billNo')) filters.billNoSearch = params.get('billNo')
      if (params.get('item')) filters.itemSearch = params.get('item')
      if (params.get('category') && params.get('category') !== 'all') filters.category = params.get('category')!
      if (params.get('waiter')) filters.waiter = params.get('waiter')
      if (params.get('minAmount')) filters.minAmount = Number(params.get('minAmount'))
      if (params.get('maxAmount')) filters.maxAmount = Number(params.get('maxAmount'))
      return fakeResponse(reports.get(shopId, filters))
    }

    // ─── SHOPS ───
    if (url === '/api/shops' && method === 'GET') return fakeResponse({ shops: shops.list() })
    if (url === '/api/shops' && method === 'POST') return fakeResponse({ shop: shops.create(body) }, 201)
    const shopMatch = url.match(/^\/api\/shops\/([^/]+)$/)
    if (shopMatch) {
      if (method === 'PUT') return fakeResponse({ shop: shops.update(shopMatch[1], body) })
      if (method === 'DELETE') { shops.delete(shopMatch[1]); return fakeResponse({ ok: true }) }
    }

    if (url.startsWith('/api/stats')) return fakeResponse({ totalRevenue: 0, totalBills: 0 })
    if (url.startsWith('/api/backup')) {
      if (method === 'GET') {
        // Gather ALL local data for backup. Data is collected across every
        // shop in the system so a single backup file fully restores state.
        const allShops = shops.list()
        const perShop = (selector: (sid: string) => any[]) =>
          allShops.flatMap((s: any) => selector(s.id))
        const backup = {
          version: 2,
          exportedAt: new Date().toISOString(),
          shops: allShops,
          menuItems: perShop((sid) => menu.list(sid)),
          tables: perShop((sid) => tables.list(sid)),
          orders: perShop((sid) => orders.list(sid)),
          bills: perShop((sid) => bills.list(sid)),
          customers: perShop((sid) => customers.list(sid)),
          suppliers: perShop((sid) => suppliers.list(sid)),
          purchases: perShop((sid) => purchases.list(sid)),
          expenses: perShop((sid) => expenses.list(sid)),
          moneyIn: perShop((sid) => moneyIn.list(sid)),
          moneyOut: perShop((sid) => moneyOut.list(sid)),
          settings: allShops.map((s: any) => settings.get(s.id)).filter(Boolean),
          users: users.list(),
        }
        return fakeResponse(backup)
      }
      // POST = restore — handled separately, fall through.
      return fakeResponse({ ok: true })
    }

    console.warn('[shopFetch] Unknown URL:', url, method)
    return fakeResponse({ error: 'Not found' }, 404)
  }, [shopId])
}
