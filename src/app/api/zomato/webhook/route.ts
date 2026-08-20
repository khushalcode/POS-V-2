import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * POST /api/zomato/webhook?shopId=xxx
 *
 * This endpoint receives real-time order pushes from Zomato Partner API.
 * Zomato calls this URL whenever a new order is placed, accepted, or status changes.
 *
 * Setup:
 * 1. Go to Zomato Partner Dashboard → Webhooks
 * 2. Set the webhook URL to: https://your-domain.com/api/zomato/webhook?shopId=YOUR_SHOP_ID
 * 3. Set the webhook secret (optional) in Settings → Zomato API → Webhook Secret
 * 4. Zomato will POST order events to this endpoint
 *
 * Event types handled:
 *   - order.created  → create a new ZomatoOrder with status 'new'
 *   - order.accepted → update status to 'accepted'
 *   - order.cancelled → update status to 'cancelled'
 *   - order.dispatched → update status to 'dispatched'
 *   - order.delivered → update status to 'delivered'
 */
export async function POST(req: NextRequest) {
  try {
    const shopId = req.nextUrl.searchParams.get('shopId')
    if (!shopId) {
      return NextResponse.json({ error: 'shopId query parameter required' }, { status: 400 })
    }

    // Verify webhook secret if configured
    const settings = await db.shopSetting.findUnique({ where: { shopId } })
    if (settings?.zomatoWebhookSecret) {
      const providedSecret = req.headers.get('x-zomato-webhook-secret') ||
                             req.headers.get('x-webhook-secret') ||
                             req.nextUrl.searchParams.get('secret')
      if (providedSecret !== settings.zomatoWebhookSecret) {
        return NextResponse.json({ error: 'Invalid webhook secret' }, { status: 401 })
      }
    }

    const body = await req.json()
    const eventType = body.event_type || body.event || body.type || 'order.created'
    const raw = body.order || body.data || body

    const zomatoOrderId = String(raw.order_id || raw.id || raw.orderId || '')
    if (!zomatoOrderId) {
      return NextResponse.json({ error: 'order_id required' }, { status: 400 })
    }

    // Handle different event types
    if (eventType.includes('created') || eventType.includes('new') || eventType.includes('placed')) {
      // Check if already exists
      const existing = await db.zomatoOrder.findUnique({ where: { zomatoOrderId } })
      if (existing) {
        return NextResponse.json({ ok: true, message: 'Order already exists', orderId: existing.id })
      }

      // Normalize items
      const items = (raw.order_items || raw.items || raw.line_items || []).map((it: any) => ({
        name: it.name || it.item_name || 'Unknown',
        qty: it.quantity || it.qty || 1,
        price: it.price || it.unit_price || 0,
      }))

      const subtotal = items.reduce((s: number, i: any) => s + i.price * i.qty, 0)
      const taxAmount = raw.tax_amount || raw.taxes || 0
      const packagingCharge = raw.packaging_charge || raw.packaging || 0
      const deliveryFee = raw.delivery_fee || raw.delivery_charge || 0
      const discount = raw.discount || 0
      const total = raw.total_amount || raw.total || raw.grand_total || (subtotal + taxAmount + packagingCharge + deliveryFee - discount)

      const order = await db.zomatoOrder.create({
        data: {
          shopId,
          zomatoOrderId,
          customerName: raw.customer_name || raw.customer?.name || 'Zomato Customer',
          customerPhone: raw.customer_phone || raw.customer?.phone || null,
          deliveryType: raw.order_type === 'pickup' ? 'pickup' : 'delivery',
          address: raw.delivery_address || raw.customer?.address || null,
          items: JSON.stringify(items),
          subtotal: Number(subtotal),
          taxAmount: Number(taxAmount),
          packagingCharge: Number(packagingCharge),
          deliveryFee: Number(deliveryFee),
          discount: Number(discount),
          total: Number(total),
          paymentMode: raw.payment_method === 'COD' ? 'cod' : 'prepaid',
          status: 'new',
          notes: raw.special_instructions || raw.notes || null,
        },
      })

      console.log(`[zomato-webhook] Created order ${zomatoOrderId} for shop ${shopId}`)
      return NextResponse.json({ ok: true, orderId: order.id, message: 'Order created from webhook' })
    }

    // Status update events
    if (eventType.includes('accept')) {
      await db.zomatoOrder.updateMany({
        where: { zomatoOrderId, shopId },
        data: { status: 'accepted' },
      })
    } else if (eventType.includes('cancel')) {
      await db.zomatoOrder.updateMany({
        where: { zomatoOrderId, shopId },
        data: { status: 'cancelled' },
      })
    } else if (eventType.includes('dispatch') || eventType.includes('pickup')) {
      await db.zomatoOrder.updateMany({
        where: { zomatoOrderId, shopId },
        data: { status: 'dispatched' },
      })
    } else if (eventType.includes('deliver')) {
      await db.zomatoOrder.updateMany({
        where: { zomatoOrderId, shopId },
        data: { status: 'delivered' },
      })
    }

    return NextResponse.json({ ok: true, event: eventType, orderId: zomatoOrderId })
  } catch (e: any) {
    console.error('[zomato-webhook] Error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// GET endpoint to verify webhook is alive (Zomato may ping this)
export async function GET(req: NextRequest) {
  const shopId = req.nextUrl.searchParams.get('shopId')
  return NextResponse.json({
    ok: true,
    message: 'Zomato webhook endpoint is active',
    shopId: shopId || 'not provided',
    timestamp: new Date().toISOString(),
  })
}
