import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// PUT /api/menu/[id] — update menu item
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const item = await db.menuItem.update({
    where: { id },
    data: {
      ...(body.name != null && { name: body.name }),
      ...(body.category != null && { category: body.category }),
      ...(body.price != null && { price: Number(body.price) }),
      ...(body.cost != null && { cost: Number(body.cost) }),
      ...(body.stock != null && { stock: Number(body.stock) }),
      ...(body.unit != null && { unit: body.unit }),
      ...(body.image !== undefined && { image: body.image }),
      ...(body.available != null && { available: body.available }),
    },
  })
  return NextResponse.json({ item })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await db.menuItem.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
