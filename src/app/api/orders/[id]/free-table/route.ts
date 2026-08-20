import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

type Ctx = { params: Promise<{ id: string }> }

// POST /api/orders/[id]/free-table
// Frees the table associated with this order (sets table status to available, clears currentOrderId)
// Also marks the order as 'billed' (closed/saved) — used by the Save button
export async function POST(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const order = await db.order.findUnique({ where: { id }, include: { table: true } })
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  await db.$transaction(async (tx) => {
    // Mark order as billed (saved/closed)
    await tx.order.update({
      where: { id },
      data: { status: 'billed' },
    })
    // Free the table
    await tx.restaurantTable.update({
      where: { id: order.tableId },
      data: { status: 'available', currentOrderId: null },
    })
  })

  return NextResponse.json({ ok: true, tableNumber: order.table.number })
}
