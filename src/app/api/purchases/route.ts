import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getShopId } from '@/lib/shop-context'

export async function GET(req: NextRequest) {
  const shopId = getShopId(req)
  if (!shopId) return NextResponse.json({ error: 'Shop ID required' }, { status: 400 })
  const from = req.nextUrl.searchParams.get('from')
  const to = req.nextUrl.searchParams.get('to')
  const where: any = { shopId }
  if (from || to) {
    where.createdAt = { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) }
  }
  const purchases = await db.purchase.findMany({ where, orderBy: { createdAt: 'desc' } })
  return NextResponse.json({ purchases })
}

export async function POST(req: NextRequest) {
  const shopId = getShopId(req)
  if (!shopId) return NextResponse.json({ error: 'Shop ID required' }, { status: 400 })
  const b = await req.json()
  if (!b.items || !Array.isArray(b.items) || b.items.length === 0) {
    return NextResponse.json({ error: 'items[] required' }, { status: 400 })
  }
  const subtotal = b.items.reduce((s: number, i: any) => s + Number(i.total), 0)
  const taxAmount = Number(b.taxAmount || 0)
  const total = subtotal + taxAmount

  const last = await db.purchase.findFirst({ where: { shopId }, orderBy: { invoiceNumber: 'desc' } })
  const invoiceNumber = last
    ? `PUR-${(parseInt(last.invoiceNumber.replace(/\D/g, '')) || 1000) + 1}`
    : 'PUR-1001'

  const purchase = await db.$transaction(async (tx) => {
    const created = await tx.purchase.create({
      data: {
        shopId,
        invoiceNumber,
        supplierId: b.supplierId || null,
        supplierName: b.supplierName || null,
        subtotal,
        taxAmount,
        total,
        paymentMode: b.paymentMode || 'cash',
        notes: b.notes || null,
        items: JSON.stringify(b.items),
      },
    })
    for (const it of b.items) {
      if (it.menuItemId) {
        await tx.menuItem.updateMany({
          where: { id: it.menuItemId, shopId },
          data: { stock: { increment: Number(it.qty) } },
        })
      }
    }
    return created
  })

  return NextResponse.json({ purchase }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const shopId = getShopId(req)
  if (!shopId) return NextResponse.json({ error: 'Shop ID required' }, { status: 400 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await db.purchase.deleteMany({ where: { id, shopId } })
  return NextResponse.json({ ok: true })
}
