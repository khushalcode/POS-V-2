import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/stats — today's dashboard stats
export async function GET() {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date()
  endOfDay.setHours(23, 59, 59, 999)

  const todayBills = await db.bill.findMany({
    where: { paidAt: { gte: startOfDay, lte: endOfDay } },
    include: { order: { include: { items: true } } },
  })

  const totalRevenue = todayBills.reduce((s, b) => s + b.total, 0)
  const totalBills = todayBills.length
  const totalOrders = todayBills.length
  const avgBill = totalBills > 0 ? totalRevenue / totalBills : 0

  // Top selling items
  const itemMap = new Map<string, { name: string; qty: number; revenue: number }>()
  todayBills.forEach((b) => {
    b.order.items.forEach((i) => {
      if (i.status === 'cancelled') return
      const cur = itemMap.get(i.name) || { name: i.name, qty: 0, revenue: 0 }
      cur.qty += i.quantity
      cur.revenue += i.price * i.quantity
      itemMap.set(i.name, cur)
    })
  })
  const topItems = Array.from(itemMap.values()).sort((a, b) => b.qty - a.qty).slice(0, 5)

  // By payment mode
  const byPayment: Record<string, number> = {}
  todayBills.forEach((b) => {
    byPayment[b.paymentMode] = (byPayment[b.paymentMode] || 0) + b.total
  })

  // Tables status snapshot
  const tables = await db.restaurantTable.findMany()
  const occupied = tables.filter((t) => t.status === 'occupied').length

  return NextResponse.json({
    period: { from: startOfDay, to: endOfDay },
    totalRevenue,
    totalBills,
    totalOrders,
    avgBill,
    occupiedTables: occupied,
    totalTables: tables.length,
    topItems,
    byPayment,
  })
}
