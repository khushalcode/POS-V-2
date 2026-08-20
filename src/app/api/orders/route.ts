import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getShopId } from '@/lib/shop-context'

// GET /api/orders — list orders for the current shop, optionally filtered
export async function GET(req: NextRequest) {
  const shopId = getShopId(req)
  if (!shopId) return NextResponse.json({ error: 'Shop ID required' }, { status: 400 })

  const status = req.nextUrl.searchParams.get('status')
  const tableId = req.nextUrl.searchParams.get('tableId')
  const orders = await db.order.findMany({
    where: {
      shopId,
      ...(status ? { status } : {}),
      ...(tableId ? { tableId } : {}),
    },
    include: { items: true, table: true, bill: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ orders })
}

// POST /api/orders — create a new open order for a table in the current shop
export async function POST(req: NextRequest) {
  const shopId = getShopId(req)
  if (!shopId) return NextResponse.json({ error: 'Shop ID required' }, { status: 400 })

  const body = await req.json()
  const { tableId, type = 'dine_in', guests = 1, waiterName, notes, customerName } = body
  if (!tableId) {
    return NextResponse.json({ error: 'tableId is required' }, { status: 400 })
  }

  const table = await db.restaurantTable.findFirst({ where: { id: tableId, shopId } })
  if (!table) {
    return NextResponse.json({ error: 'Table not found in this shop' }, { status: 404 })
  }
  if (table.currentOrderId) {
    return NextResponse.json(
      { error: 'Table already has an active order', currentOrderId: table.currentOrderId },
      { status: 409 }
    )
  }

  const order = await db.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        shopId,
        tableId,
        type,
        guests: Number(guests),
        waiterName,
        customerName,
        notes,
        status: 'open',
      },
    })
    await tx.restaurantTable.update({
      where: { id: tableId },
      data: { status: 'occupied', currentOrderId: created.id },
    })
    return created
  })

  const fullOrder = await db.order.findUnique({
    where: { id: order.id },
    include: { items: true, table: true },
  })

  return NextResponse.json({ order: fullOrder }, { status: 201 })
}
