import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getShopId } from '@/lib/shop-context'

// POST /api/zomato/[id]/push — convert Zomato order to internal KOT
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const shopId = getShopId(req as any)
  if (!shopId) return NextResponse.json({ error: 'Shop ID required' }, { status: 400 })

  const zomato = await db.zomatoOrder.findFirst({ where: { id, shopId } })
  if (!zomato) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (zomato.internalOrderId) {
    return NextResponse.json({ error: 'Already pushed to kitchen', internalOrderId: zomato.internalOrderId }, { status: 400 })
  }

  // Find the Direct Counter table for this shop (number 0)
  let directTable = await db.restaurantTable.findFirst({ where: { shopId, number: 0 } })
  if (!directTable) {
    directTable = await db.restaurantTable.create({
      data: { shopId, number: 0, name: 'Direct Counter', capacity: 0, status: 'available' },
    })
  }

  const items = (() => { try { return JSON.parse(zomato.items) as any[] } catch { return [] } })()
  if (items.length === 0) {
    return NextResponse.json({ error: 'No items to push' }, { status: 400 })
  }

  const order = await db.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        shopId,
        tableId: directTable!.id,
        status: 'sent',
        type: zomato.deliveryType === 'pickup' ? 'takeaway' : 'direct',
        guests: 1,
        customerName: zomato.customerName,
        notes: `Zomato Order ${zomato.zomatoOrderId}${zomato.notes ? ' — ' + zomato.notes : ''}`,
        kotPrinted: true,
      },
    })

    for (const it of items) {
      const menuMatch = await tx.menuItem.findFirst({ where: { shopId, name: it.name } })
      // Create a placeholder menu item if no match (so foreign key holds)
      let menuItemId = menuMatch?.id
      if (!menuItemId) {
        const placeholder = await tx.menuItem.create({
          data: {
            shopId,
            name: String(it.name),
            category: 'General',
            price: Number(it.price),
            cost: 0,
            stock: 0,
            unit: 'Pcs',
            available: true,
          },
        })
        menuItemId = placeholder.id
      }
      await tx.orderItem.create({
        data: {
          orderId: created.id,
          menuItemId,
          name: String(it.name),
          price: Number(it.price),
          quantity: Number(it.qty),
          status: 'pending',
        },
      })
    }

    await tx.restaurantTable.update({
      where: { id: directTable!.id },
      data: { status: 'occupied', currentOrderId: created.id },
    })

    await tx.zomatoOrder.update({
      where: { id },
      data: { internalOrderId: created.id, status: 'accepted' },
    })

    return created
  })

  const fullOrder = await db.order.findUnique({
    where: { id: order.id },
    include: { items: true, table: true },
  })

  return NextResponse.json({ order: fullOrder, zomatoOrderId: zomato.zomatoOrderId })
}
