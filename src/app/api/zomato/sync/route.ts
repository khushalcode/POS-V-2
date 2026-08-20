import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getShopId } from '@/lib/shop-context'

/**
 * POST /api/zomato/sync
 *
 * If the shop has Zomato Partner API configured (zomatoEnabled + apiKey + restaurantId),
 * this endpoint calls the REAL Zomato API to fetch live orders and saves them.
 *
 * If Zomato is NOT configured, it falls back to simulation (creates sample orders)
 * so the UI can still be tested.
 */
export async function POST(req: NextRequest) {
  const shopId = getShopId(req)
  if (!shopId) return NextResponse.json({ error: 'Shop ID required' }, { status: 400 })

  // Check if real Zomato integration is configured
  const settings = await db.shopSetting.findUnique({ where: { shopId } })

  if (settings?.zomatoEnabled && settings?.zomatoApiKey && settings?.zomatoRestaurantId) {
    // ─── REAL Zomato API call ───
    try {
      const baseUrl = settings.zomatoApiBaseUrl || 'https://www.zomato.com/partners/v1'
      const url = `${baseUrl}/orders?restaurant_id=${settings.zomatoRestaurantId}&status=pending`

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${settings.zomatoApiKey}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      })

      if (!res.ok) {
        const errText = await res.text()
        console.error('[zomato] API error:', res.status, errText)
        return NextResponse.json({
          error: `Zomato API returned ${res.status}`,
          details: errText,
          mode: 'real',
        }, { status: 502 })
      }

      const data = await res.json()
      // Zomato API returns orders in various formats depending on API version.
      // We normalize them into our ZomatoOrder format.
      const rawOrders = data.orders || data.data || data || []
      const created = []

      for (const raw of rawOrders) {
        const zomatoOrderId = raw.order_id || raw.id || raw.orderId
        if (!zomatoOrderId) continue

        // Skip if already exists
        const existing = await db.zomatoOrder.findUnique({
          where: { zomatoOrderId: String(zomatoOrderId) },
        })
        if (existing) continue

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
            zomatoOrderId: String(zomatoOrderId),
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
        created.push(order)
      }

      return NextResponse.json({
        created,
        count: created.length,
        mode: 'real',
        message: `Fetched ${created.length} new order(s) from Zomato API`,
      })
    } catch (e: any) {
      console.error('[zomato] Sync error:', e)
      return NextResponse.json({
        error: 'Failed to connect to Zomato API',
        details: e.message,
        mode: 'real',
      }, { status: 500 })
    }
  }

  // ─── Fallback: Simulation mode ───
  const samples = [
    { customer: 'Aarav Patel', phone: '98200 11223', items: [['Butter Chicken', 1, 320], ['Butter Naan', 3, 50]], type: 'delivery', address: '12 Marine Drive, Mumbai', payment: 'prepaid' },
    { customer: 'Diya Sharma', phone: '99300 44556', items: [['Paneer Butter Masala', 1, 280], ['Jeera Rice', 1, 140], ['Sweet Lassi', 2, 90]], type: 'pickup', address: null, payment: 'cod' },
    { customer: 'Vivaan Reddy', phone: '90100 77889', items: [['Mutton Biryani', 2, 360], ['Chicken 65', 1, 240]], type: 'delivery', address: '45 Brigade Road, Bengaluru', payment: 'prepaid' },
    { customer: 'Ananya Iyer', phone: '98765 43210', items: [['Veg Biryani', 1, 240], ['Gulab Jamun', 2, 80], ['Masala Chai', 1, 40]], type: 'delivery', address: '78 Anna Salai, Chennai', payment: 'prepaid' },
  ]

  const created = []
  for (const s of samples) {
    if (Math.random() < 0.5) continue

    const items = s.items.map(([name, qty, price]) => ({ name, qty, price }))
    const subtotal = items.reduce((sum, i) => sum + (i.price as number) * (i.qty as number), 0)
    const packagingCharge = items.length * 5
    const deliveryFee = s.type === 'delivery' ? 35 : 0
    const taxAmount = Math.round(subtotal * 0.05 * 100) / 100
    const total = subtotal + taxAmount + packagingCharge + deliveryFee

    const last = await db.zomatoOrder.findFirst({ where: { shopId }, orderBy: { zomatoOrderId: 'desc' } })
    const nextNum = last ? (parseInt(last.zomatoOrderId.replace(/\D/g, '')) || 1000) + 1 : 1001

    const order = await db.zomatoOrder.create({
      data: {
        shopId,
        zomatoOrderId: `ZOM-${nextNum}`,
        customerName: s.customer,
        customerPhone: s.phone,
        deliveryType: s.type,
        address: s.address,
        items: JSON.stringify(items),
        subtotal,
        taxAmount,
        packagingCharge,
        deliveryFee,
        discount: 0,
        total,
        paymentMode: s.payment,
        status: 'new',
      },
    })
    created.push(order)
  }

  return NextResponse.json({
    created,
    count: created.length,
    mode: 'simulation',
    message: settings?.zomatoEnabled
      ? 'Zomato enabled but API key/restaurant ID missing — using simulation'
      : 'Zomato not configured — using simulation. Enable in Settings → Zomato API.',
  })
}
