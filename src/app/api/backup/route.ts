import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/backup — export full database as JSON
export async function GET() {
  const [
    menuItems,
    tables,
    orders,
    orderItems,
    bills,
    customers,
    suppliers,
    purchases,
    expenses,
    moneyIn,
    moneyOut,
    users,
    settings,
  ] = await Promise.all([
    db.menuItem.findMany(),
    db.restaurantTable.findMany(),
    db.order.findMany(),
    db.orderItem.findMany(),
    db.bill.findMany(),
    db.customer.findMany(),
    db.supplier.findMany(),
    db.purchase.findMany(),
    db.expense.findMany(),
    db.moneyIn.findMany(),
    db.moneyOut.findMany(),
    db.appUser.findMany(),
    db.shopSetting.findMany(),
  ])

  const dump = {
    version: 1,
    exportedAt: new Date().toISOString(),
    menuItems,
    tables,
    orders,
    orderItems,
    bills,
    customers,
    suppliers,
    purchases,
    expenses,
    moneyIn,
    moneyOut,
    users: users.map((u) => ({ ...u, password: '***' })), // never expose passwords
    settings,
  }

  return NextResponse.json(dump)
}

// POST /api/backup — restore from JSON (REPLACE mode — wipes existing data first)
export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!body || !body.version) {
    return NextResponse.json({ error: 'Invalid backup file' }, { status: 400 })
  }

  try {
    await db.$transaction(async (tx) => {
      // Wipe in correct FK order
      await tx.bill.deleteMany()
      await tx.orderItem.deleteMany()
      await tx.order.deleteMany()
      await tx.restaurantTable.deleteMany()
      await tx.menuItem.deleteMany()
      await tx.customer.deleteMany()
      await tx.supplier.deleteMany()
      await tx.purchase.deleteMany()
      await tx.expense.deleteMany()
      await tx.moneyIn.deleteMany()
      await tx.moneyOut.deleteMany()
      await tx.appUser.deleteMany()
      await tx.shopSetting.deleteMany()

      // Restore
      if (body.menuItems?.length) await tx.menuItem.createMany({ data: body.menuItems })
      if (body.tables?.length) await tx.restaurantTable.createMany({ data: body.tables })
      if (body.orders?.length) await tx.order.createMany({ data: body.orders })
      if (body.orderItems?.length) await tx.orderItem.createMany({ data: body.orderItems })
      if (body.bills?.length) await tx.bill.createMany({ data: body.bills })
      if (body.customers?.length) await tx.customer.createMany({ data: body.customers })
      if (body.suppliers?.length) await tx.supplier.createMany({ data: body.suppliers })
      if (body.purchases?.length) await tx.purchase.createMany({ data: body.purchases })
      if (body.expenses?.length) await tx.expense.createMany({ data: body.expenses })
      if (body.moneyIn?.length) await tx.moneyIn.createMany({ data: body.moneyIn })
      if (body.moneyOut?.length) await tx.moneyOut.createMany({ data: body.moneyOut })
      if (body.settings?.length) await tx.shopSetting.createMany({ data: body.settings })
      // Note: users excluded for security (passwords are masked in export)
    })

    return NextResponse.json({ ok: true, message: 'Backup restored successfully' })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
