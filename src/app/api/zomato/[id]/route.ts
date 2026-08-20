import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

type Ctx = { params: Promise<{ id: string }> }

// PATCH /api/zomato/[id] — update status
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const b = await req.json()
  const updated = await db.zomatoOrder.update({
    where: { id },
    data: {
      ...(b.status != null && { status: b.status }),
      ...(b.internalOrderId != null && { internalOrderId: b.internalOrderId }),
    },
  })
  return NextResponse.json({ order: updated })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  await db.zomatoOrder.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
