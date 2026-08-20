import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

type Ctx = { params: Promise<{ id: string }> }

// GET /api/orders/[id]
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const order = await db.order.findUnique({
    where: { id },
    include: { items: true, table: true, bill: true },
  })
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ order })
}

// DELETE /api/orders/[id] — only if open and has no items sent
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const order = await db.order.findUnique({ where: { id }, include: { items: true } })
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (order.status !== 'open') {
    return NextResponse.json({ error: 'Cannot delete a sent order' }, { status: 400 })
  }

  await db.$transaction(async (tx) => {
    await tx.orderItem.deleteMany({ where: { orderId: id } })
    await tx.order.delete({ where: { id } })
    await tx.restaurantTable.updateMany({
      where: { currentOrderId: id },
      data: { status: 'available', currentOrderId: null },
    })
  })

  return NextResponse.json({ ok: true })
}
