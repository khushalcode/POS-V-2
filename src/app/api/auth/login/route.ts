import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'

// POST /api/auth/login — validate credentials, return user + accessible shops
export async function POST(req: NextRequest) {
  const { email, password } = await req.json()
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
  }

  const user = await db.appUser.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: { shop: true },
  })

  if (!user || !user.active) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }
  if (user.password !== password) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  // Determine accessible shops
  let shops: any[] = []
  if (user.shopId) {
    shops = [user.shop]
  } else {
    // Super admin — access all shops
    shops = await db.shop.findMany({ where: { active: true }, orderBy: { name: 'asc' } })
  }

  // Audit log
  await logAudit({
    shopId: user.shopId,
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    action: 'login',
    details: { email: user.email },
    ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
  })

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      shopId: user.shopId,
    },
    shops: shops.map((s) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      color: s.color,
      address: s.address,
      phone: s.phone,
      gstin: s.gstin,
      taxRate: s.taxRate,
      currency: s.currency,
    })),
  })
}
