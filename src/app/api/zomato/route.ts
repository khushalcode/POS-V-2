import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getShopId } from '@/lib/shop-context'

// GET /api/zomato?status=
export async function GET(req: NextRequest) {
  const shopId = getShopId(req)
  if (!shopId) return NextResponse.json({ error: 'Shop ID required' }, { status: 400 })

  const status = req.nextUrl.searchParams.get('status')
  const orders = await db.zomatoOrder.findMany({
    where: {
      shopId,
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ orders })
}

// POST /api/zomato — manually create a Zomato order for the current shop
export async function POST(req: NextRequest) {
  const shopId = getShopId(req)
  if (!shopId) return NextResponse.json({ error: 'Shop ID required' }, { status: 400 })

  const b = await req.json()
  if (!b.customerName || !b.items?.length) {
    return NextResponse.json({ error: 'customerName and items[] required' }, { status: 400 })
  }
  const subtotal = b.items.reduce((s: number, i: any) => s + i.price * i.qty, 0)
  const taxAmount = Number(b.taxAmount || 0)
  const packagingCharge = Number(b.packagingCharge || 0)
  const deliveryFee = Number(b.deliveryFee || 0)
  const discount = Number(b.discount || 0)
  const total = subtotal + taxAmount + packagingCharge + deliveryFee - discount

  const last = await db.zomatoOrder.findFirst({ where: { shopId }, orderBy: { zomatoOrderId: 'desc' } })
  const nextNum = last ? (parseInt(last.zomatoOrderId.replace(/\D/g, '')) || 1000) + 1 : 1001
  const zomatoOrderId = `ZOM-${nextNum}`

  const order = await db.zomatoOrder.create({
    data: {
      shopId,
      zomatoOrderId,
      customerName: b.customerName,
      customerPhone: b.customerPhone || null,
      deliveryType: b.deliveryType || 'delivery',
      address: b.address || null,
      items: JSON.stringify(b.items),
      subtotal,
      taxAmount,
      packagingCharge,
      deliveryFee,
      discount,
      total,
      paymentMode: b.paymentMode || 'prepaid',
      status: 'new',
      notes: b.notes || null,
    },
  })
  return NextResponse.json({ order }, { status: 201 })
}
