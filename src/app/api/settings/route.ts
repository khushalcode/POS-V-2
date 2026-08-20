import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getShopId } from '@/lib/shop-context'

// GET — return shop-scoped settings (auto-create from Shop if missing)
export async function GET(req: NextRequest) {
  const shopId = getShopId(req)
  if (!shopId) return NextResponse.json({ error: 'Shop ID required' }, { status: 400 })

  let settings = await db.shopSetting.findUnique({ where: { shopId } })
  if (!settings) {
    const shop = await db.shop.findUnique({ where: { id: shopId } })
    settings = await db.shopSetting.create({
      data: {
        shopId,
        shopName: shop?.name || 'Restaurant',
        address: shop?.address || null,
        phone: shop?.phone || null,
        gstin: shop?.gstin || null,
        taxRate: shop?.taxRate || 5,
        currency: shop?.currency || 'Rs.',
      },
    })
  }
  return NextResponse.json({ settings })
}

// PUT — update shop-scoped settings (including bill/KOT style)
export async function PUT(req: NextRequest) {
  const shopId = getShopId(req)
  if (!shopId) return NextResponse.json({ error: 'Shop ID required' }, { status: 400 })

  const b = await req.json()
  let settings = await db.shopSetting.findUnique({ where: { shopId } })
  if (!settings) {
    settings = await db.shopSetting.create({ data: { shopId } })
  }
  const updated = await db.shopSetting.update({
    where: { shopId },
    data: {
      // Basic
      ...(b.shopName != null && { shopName: b.shopName }),
      ...(b.address != null && { address: b.address }),
      ...(b.phone != null && { phone: b.phone }),
      ...(b.email != null && { email: b.email }),
      ...(b.gstin != null && { gstin: b.gstin }),
      ...(b.taxRate != null && { taxRate: Number(b.taxRate) }),
      ...(b.serviceRate != null && { serviceRate: Number(b.serviceRate) }),
      ...(b.currency != null && { currency: b.currency }),
      ...(b.invoicePrefix != null && { invoicePrefix: b.invoicePrefix }),
      ...(b.kotPrefix != null && { kotPrefix: b.kotPrefix }),
      ...(b.footerNote != null && { footerNote: b.footerNote }),
      // Bill style
      ...(b.billShowLogo != null && { billShowLogo: b.billShowLogo }),
      ...(b.billShowGstin != null && { billShowGstin: b.billShowGstin }),
      ...(b.billShowPhone != null && { billShowPhone: b.billShowPhone }),
      ...(b.billShowAddress != null && { billShowAddress: b.billShowAddress }),
      ...(b.billShowEmail != null && { billShowEmail: b.billShowEmail }),
      ...(b.billShowDateTime != null && { billShowDateTime: b.billShowDateTime }),
      ...(b.billShowWaiter != null && { billShowWaiter: b.billShowWaiter }),
      ...(b.billShowCustomer != null && { billShowCustomer: b.billShowCustomer }),
      ...(b.billShowKotNo != null && { billShowKotNo: b.billShowKotNo }),
      ...(b.billFontSize != null && { billFontSize: Number(b.billFontSize) }),
      ...(b.billHeaderAlign != null && { billHeaderAlign: b.billHeaderAlign }),
      ...(b.billExtraNote != null && { billExtraNote: b.billExtraNote || null }),
      ...(b.billAccentColor != null && { billAccentColor: b.billAccentColor }),
      ...(b.billBoldFont != null && { billBoldFont: b.billBoldFont }),
      // KOT style
      ...(b.kotShowLogo != null && { kotShowLogo: b.kotShowLogo }),
      ...(b.kotShowWaiter != null && { kotShowWaiter: b.kotShowWaiter }),
      ...(b.kotShowDateTime != null && { kotShowDateTime: b.kotShowDateTime }),
      ...(b.kotShowTable != null && { kotShowTable: b.kotShowTable }),
      ...(b.kotShowGuests != null && { kotShowGuests: b.kotShowGuests }),
      ...(b.kotFontSize != null && { kotFontSize: Number(b.kotFontSize) }),
      ...(b.kotHeaderAlign != null && { kotHeaderAlign: b.kotHeaderAlign }),
      ...(b.kotAccentColor != null && { kotAccentColor: b.kotAccentColor }),
      ...(b.kotExtraNote != null && { kotExtraNote: b.kotExtraNote || null }),
      ...(b.kotBoldFont != null && { kotBoldFont: b.kotBoldFont }),
      // Zomato API
      ...(b.zomatoEnabled != null && { zomatoEnabled: b.zomatoEnabled }),
      ...(b.zomatoApiKey !== undefined && { zomatoApiKey: b.zomatoApiKey || null }),
      ...(b.zomatoRestaurantId !== undefined && { zomatoRestaurantId: b.zomatoRestaurantId || null }),
      ...(b.zomatoApiBaseUrl !== undefined && { zomatoApiBaseUrl: b.zomatoApiBaseUrl || null }),
      ...(b.zomatoWebhookSecret !== undefined && { zomatoWebhookSecret: b.zomatoWebhookSecret || null }),
    },
  })
  return NextResponse.json({ settings: updated })
}
