import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getShopId } from '@/lib/shop-context'

export async function GET(req: NextRequest) {
  const shopId = getShopId(req)
  if (!shopId) return NextResponse.json({ error: 'Shop ID required' }, { status: 400 })
  const search = req.nextUrl.searchParams.get('search') || ''
  const where: any = { shopId }
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { phone: { contains: search } },
      { email: { contains: search } },
    ]
  }
  const customers = await db.customer.findMany({ where, orderBy: { createdAt: 'desc' } })
  return NextResponse.json({ customers })
}

export async function POST(req: NextRequest) {
  const shopId = getShopId(req)
  if (!shopId) return NextResponse.json({ error: 'Shop ID required' }, { status: 400 })
  const b = await req.json()
  if (!b.name) return NextResponse.json({ error: 'name required' }, { status: 400 })
  const c = await db.customer.create({
    data: {
      shopId,
      name: b.name, phone: b.phone || null, email: b.email || null,
      address: b.address || null, notes: b.notes || null,
    },
  })
  return NextResponse.json({ customer: c }, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const shopId = getShopId(req)
  if (!shopId) return NextResponse.json({ error: 'Shop ID required' }, { status: 400 })
  const b = await req.json()
  if (!b.id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const c = await db.customer.update({
    where: { id: b.id },
    data: {
      ...(b.name != null && { name: b.name }),
      ...(b.phone != null && { phone: b.phone }),
      ...(b.email != null && { email: b.email }),
      ...(b.address != null && { address: b.address }),
      ...(b.notes != null && { notes: b.notes }),
    },
  })
  return NextResponse.json({ customer: c })
}

export async function DELETE(req: NextRequest) {
  const shopId = getShopId(req)
  if (!shopId) return NextResponse.json({ error: 'Shop ID required' }, { status: 400 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await db.customer.deleteMany({ where: { id, shopId } })
  return NextResponse.json({ ok: true })
}
