import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getShopId } from '@/lib/shop-context'

// GET /api/reports — advanced sales report with filters.
//
// Query params:
//   from, to           — date range (ISO strings)
//   type               — 'daily' | 'monthly' | 'range' (legacy, ignored if from/to present)
//   paymentMode        — 'cash' | 'upi' | 'card' | 'other' | 'all'
//   table              — table number (0 = Direct Counter, 1-10)
//   billNo             — substring match on bill number
//   item               — substring match on any item name in the bill
//   category           — filter bills containing at least one item in this category
//   waiter             — filter by waiter name
//   minAmount          — bills with total >= this
//   maxAmount          — bills with total <= this
//
// Returns:
//   summary            — aggregates from FILTERED bills
//   byPayment          — { [mode]: { count, total } }
//   byCategory         — [{ name, qty, revenue }] sorted by revenue desc
//   topItems           — [{ name, category, qty, revenue }] sorted by qty desc, top 100
//   expenseByCategory  — { [category]: amount }
//   dailyBreakdown     — [{ date, sales, expenses, count }]
//   hourlyBreakdown    — [{ hour, label, sales, count }]
//   bills              — filtered bills with order + items attached
//   itemizedRows       — one row per line item (flat table for detailed sales)
//   deletedBills       — voided bills in the same window
export async function GET(req: NextRequest) {
  const shopId = getShopId(req)
  if (!shopId) return NextResponse.json({ error: 'Shop ID required' }, { status: 400 })

  const sp = req.nextUrl.searchParams

  // ─── Parse date range ────────────────────────────────────────────────
  const from = sp.get('from')
  const to = sp.get('to')
  const type = sp.get('type') || 'daily'

  let startDate = new Date()
  startDate.setHours(0, 0, 0, 0)
  if (type === 'monthly') {
    startDate = new Date()
    startDate.setDate(1)
    startDate.setHours(0, 0, 0, 0)
  } else if (type === 'range' && from) {
    startDate = new Date(from)
    startDate.setHours(0, 0, 0, 0)
  }
  if (from) {
    startDate = new Date(from)
    startDate.setHours(0, 0, 0, 0)
  }
  const endDate = to ? new Date(to) : new Date()
  endDate.setHours(23, 59, 59, 999)

  // ─── Parse advanced filters ──────────────────────────────────────────
  const paymentMode = sp.get('paymentMode') && sp.get('paymentMode') !== 'all' ? sp.get('paymentMode')! : null
  const tableNumber = sp.get('table') ? Number(sp.get('table')) : null
  const billNoSearch = sp.get('billNo') || null
  const itemSearch = sp.get('item') || null
  const categoryFilter = sp.get('category') && sp.get('category') !== 'all' ? sp.get('category')! : null
  const waiterSearch = sp.get('waiter') || null
  const minAmount = sp.get('minAmount') ? Number(sp.get('minAmount')) : null
  const maxAmount = sp.get('maxAmount') ? Number(sp.get('maxAmount')) : null

  // ─── Fetch bills (with order + items) ────────────────────────────────
  const [allBills, expensesList, purchasesList, moneyInList, moneyOutList, deletedBills] = await Promise.all([
    db.bill.findMany({
      where: { shopId, paidAt: { gte: startDate, lte: endDate } },
      include: { order: { include: { items: true } } },
      orderBy: { paidAt: 'desc' },
    }),
    db.expense.findMany({ where: { shopId, date: { gte: startDate, lte: endDate } } }),
    db.purchase.findMany({ where: { shopId, createdAt: { gte: startDate, lte: endDate } } }),
    db.moneyIn.findMany({ where: { shopId, date: { gte: startDate, lte: endDate } } }),
    db.moneyOut.findMany({ where: { shopId, date: { gte: startDate, lte: endDate } } }),
    db.deletedBill.findMany({
      where: { shopId, originalPaidAt: { gte: startDate, lte: endDate } },
      orderBy: { deletedAt: 'desc' },
    }),
  ])

  // ─── Apply filters ───────────────────────────────────────────────────
  let filteredBills = allBills
  if (paymentMode) {
    filteredBills = filteredBills.filter((b) => b.paymentMode === paymentMode)
  }
  if (tableNumber != null && !Number.isNaN(tableNumber)) {
    filteredBills = filteredBills.filter((b) => b.tableNumber === tableNumber)
  }
  if (billNoSearch) {
    const term = billNoSearch.toLowerCase()
    filteredBills = filteredBills.filter((b) => String(b.billNo).includes(term))
  }
  if (itemSearch) {
    const term = itemSearch.toLowerCase()
    filteredBills = filteredBills.filter((b) =>
      b.order.items.some((i) => i.name.toLowerCase().includes(term))
    )
  }
  if (categoryFilter) {
    // Look up each item's category from MenuItem
    const menuItemIds = new Set<string>()
    filteredBills.forEach((b) => b.order.items.forEach((i) => menuItemIds.add(i.menuItemId)))
    const menuItems = await db.menuItem.findMany({
      where: { id: { in: Array.from(menuItemIds) } },
      select: { id: true, category: true },
    })
    const catMap = new Map(menuItems.map((m) => [m.id, m.category]))
    filteredBills = filteredBills.filter((b) =>
      b.order.items.some((i) => catMap.get(i.menuItemId) === categoryFilter)
    )
  }
  if (waiterSearch) {
    const term = waiterSearch.toLowerCase()
    filteredBills = filteredBills.filter((b) =>
      (b.order.waiterName || '').toLowerCase().includes(term)
    )
  }
  if (minAmount != null && !Number.isNaN(minAmount)) {
    filteredBills = filteredBills.filter((b) => b.total >= minAmount)
  }
  if (maxAmount != null && !Number.isNaN(maxAmount)) {
    filteredBills = filteredBills.filter((b) => b.total <= maxAmount)
  }

  // ─── Build itemized rows (one row per line item) ─────────────────────
  // Collect all menuItemIds so we can look up categories in one query.
  const allMenuItemIds = new Set<string>()
  filteredBills.forEach((b) =>
    b.order.items
      .filter((i) => i.status !== 'cancelled')
      .forEach((i) => allMenuItemIds.add(i.menuItemId))
  )
  const menuItemsForCats = await db.menuItem.findMany({
    where: { id: { in: Array.from(allMenuItemIds) } },
    select: { id: true, category: true },
  })
  const catLookup = new Map(menuItemsForCats.map((m) => [m.id, m.category]))

  const itemizedRows: any[] = []
  for (const b of filteredBills) {
    const items = b.order.items.filter((i) => i.status !== 'cancelled')
    for (const it of items) {
      itemizedRows.push({
        billNo: b.billNo,
        paidAt: b.paidAt,
        tableNumber: b.tableNumber,
        waiterName: b.order.waiterName || null,
        customerName: b.order.customerName || null,
        paymentMode: b.paymentMode,
        itemName: it.name,
        category: catLookup.get(it.menuItemId) || 'General',
        quantity: it.quantity,
        price: it.price,
        lineTotal: it.quantity * it.price,
        billTotal: b.total,
      })
    }
  }

  // ─── Aggregates from FILTERED bills ──────────────────────────────────
  const salesRevenue = filteredBills.reduce((s, b) => s + b.total, 0)
  const totalExpenses = expensesList.reduce((s, e) => s + e.amount, 0)
  const totalPurchases = purchasesList.reduce((s, p) => s + p.total, 0)
  const totalMoneyIn = moneyInList.reduce((s, m) => s + m.amount, 0)
  const totalMoneyOut = moneyOutList.reduce((s, m) => s + m.amount, 0)
  const deletedBillAmount = deletedBills.reduce((s, d) => s + d.total, 0)
  const totalItemsSold = itemizedRows.reduce((s, r) => s + r.quantity, 0)

  // ─── Payment breakdown ───────────────────────────────────────────────
  const byPayment: Record<string, { count: number; total: number }> = {}
  filteredBills.forEach((b) => {
    const m = b.paymentMode || 'other'
    if (!byPayment[m]) byPayment[m] = { count: 0, total: 0 }
    byPayment[m].count++
    byPayment[m].total += b.total
  })

  // ─── Top items (by qty) — includes category ──────────────────────────
  const topItemsMap = new Map<string, { name: string; category: string; qty: number; revenue: number }>()
  for (const r of itemizedRows) {
    if (!topItemsMap.has(r.itemName)) {
      topItemsMap.set(r.itemName, { name: r.itemName, category: r.category, qty: 0, revenue: 0 })
    }
    const cur = topItemsMap.get(r.itemName)!
    cur.qty += r.quantity
    cur.revenue += r.lineTotal
  }
  const topItems = Array.from(topItemsMap.values()).sort((a, b) => b.qty - a.qty).slice(0, 100)

  // ─── Category breakdown ──────────────────────────────────────────────
  const categoryMap = new Map<string, { qty: number; revenue: number }>()
  for (const r of itemizedRows) {
    if (!categoryMap.has(r.category)) {
      categoryMap.set(r.category, { qty: 0, revenue: 0 })
    }
    const cur = categoryMap.get(r.category)!
    cur.qty += r.quantity
    cur.revenue += r.lineTotal
  }
  const byCategory = Array.from(categoryMap.entries())
    .map(([name, v]) => ({ name, qty: v.qty, revenue: v.revenue }))
    .sort((a, b) => b.revenue - a.revenue)

  // ─── Expense breakdown ───────────────────────────────────────────────
  const expenseByCategory: Record<string, number> = {}
  expensesList.forEach((e) => {
    expenseByCategory[e.category] = (expenseByCategory[e.category] || 0) + e.amount
  })

  // ─── Daily breakdown ─────────────────────────────────────────────────
  const dailyMap = new Map<string, { sales: number; expenses: number; count: number }>()
  filteredBills.forEach((b) => {
    const day = b.paidAt.toISOString().slice(0, 10)
    if (!dailyMap.has(day)) dailyMap.set(day, { sales: 0, expenses: 0, count: 0 })
    const cur = dailyMap.get(day)!
    cur.sales += b.total
    cur.count++
  })
  expensesList.forEach((e) => {
    const day = e.date.toISOString().slice(0, 10)
    if (!dailyMap.has(day)) dailyMap.set(day, { sales: 0, expenses: 0, count: 0 })
    dailyMap.get(day)!.expenses += e.amount
  })
  const dailyBreakdown = Array.from(dailyMap.entries())
    .map(([date, v]) => ({ date, sales: v.sales, expenses: v.expenses, count: v.count }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // ─── Hourly breakdown ────────────────────────────────────────────────
  const hourlyMap = new Map<number, { sales: number; count: number }>()
  for (let h = 0; h < 24; h++) hourlyMap.set(h, { sales: 0, count: 0 })
  filteredBills.forEach((b) => {
    const h = b.paidAt.getHours()
    const cur = hourlyMap.get(h)!
    cur.sales += b.total
    cur.count++
  })
  const hourlyBreakdown = Array.from(hourlyMap.entries()).map(([hour, v]) => ({
    hour,
    label: `${String(hour).padStart(2, '0')}:00`,
    sales: v.sales,
    count: v.count,
  }))

  return NextResponse.json({
    summary: {
      salesRevenue,
      totalExpenses,
      totalPurchases,
      totalMoneyIn,
      totalMoneyOut,
      deletedBillAmount,
      deletedBillCount: deletedBills.length,
      netProfit: salesRevenue - totalExpenses - totalPurchases - deletedBillAmount,
      cashFlow: salesRevenue + totalMoneyIn - totalExpenses - totalPurchases - totalMoneyOut - deletedBillAmount,
      billCount: filteredBills.length,
      avgBill: filteredBills.length > 0 ? salesRevenue / filteredBills.length : 0,
      totalItemsSold,
    },
    byPayment,
    byCategory,
    topItems,
    expenseByCategory,
    dailyBreakdown,
    hourlyBreakdown,
    bills: filteredBills,
    itemizedRows,
    deletedBills,
  })
}
