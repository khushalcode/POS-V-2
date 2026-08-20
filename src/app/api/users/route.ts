import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getShopId } from '@/lib/shop-context'

// GET /api/users — list users
// For super admin (no shopId header), return all users with their shop info
// For shop-scoped users, return only that shop's users
export async function GET(req: NextRequest) {
  const shopId = getShopId(req)

  let users
  if (shopId) {
    // Shop-scoped: only this shop's users + super admins (shopId = null)
    users = await db.appUser.findMany({
      where: { OR: [{ shopId }, { shopId: null }] },
      orderBy: [{ shopId: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true, name: true, email: true, role: true, active: true,
        shopId: true, createdAt: true,
        shop: { select: { id: true, name: true, code: true, color: true } },
      },
    })
  } else {
    // Super admin / no shop context: return all users with shop info
    users = await db.appUser.findMany({
      orderBy: [{ shopId: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true, name: true, email: true, role: true, active: true,
        shopId: true, createdAt: true,
        shop: { select: { id: true, name: true, code: true, color: true } },
      },
    })
  }
  return NextResponse.json({ users })
}

// POST /api/users — create a new user
// Super admin can assign to any shop (pass shopId in body); shop admin only to own shop
export async function POST(req: NextRequest) {
  const shopId = getShopId(req)
  const b = await req.json()
  if (!b.name || !b.email || !b.password) {
    return NextResponse.json({ error: 'name, email, password required' }, { status: 400 })
  }
  // Determine target shop: super admin can specify, shop admin forced to own shop
  const targetShopId = b.shopId || shopId
  if (!targetShopId) {
    return NextResponse.json({ error: 'Shop ID required (set X-Shop-Id header or pass shopId in body)' }, { status: 400 })
  }
  const exists = await db.appUser.findUnique({ where: { email: b.email.toLowerCase().trim() } })
  if (exists) return NextResponse.json({ error: 'Email already exists' }, { status: 400 })

  const u = await db.appUser.create({
    data: {
      name: b.name,
      email: b.email.toLowerCase().trim(),
      password: b.password,
      role: b.role || 'staff',
      shopId: targetShopId,
      active: b.active !== false,
    },
  })
  return NextResponse.json({
    user: { id: u.id, name: u.name, email: u.email, role: u.role, shopId: u.shopId },
  }, { status: 201 })
}

// PUT /api/users — update user (including password reset)
export async function PUT(req: NextRequest) {
  const shopId = getShopId(req)
  const b = await req.json()
  if (!b.id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // Find the user first
  const existing = await db.appUser.findUnique({ where: { id: b.id } })
  if (!existing) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Permission check: shop-scoped admins can only edit users in their shop
  if (shopId && existing.shopId && existing.shopId !== shopId) {
    return NextResponse.json({ error: 'Not authorized to edit this user' }, { status: 403 })
  }

  const u = await db.appUser.update({
    where: { id: b.id },
    data: {
      ...(b.name != null && { name: b.name }),
      ...(b.email != null && { email: b.email.toLowerCase().trim() }),
      ...(b.role != null && { role: b.role }),
      ...(b.active != null && { active: b.active }),
      ...(b.password != null && b.password !== '' && { password: b.password }),
      // Allow re-assigning shop (super admin only — enforced by passing shopId in body)
      ...(b.shopId != null && !shopId && { shopId: b.shopId }),
    },
  })
  return NextResponse.json({
    user: { id: u.id, name: u.name, email: u.email, role: u.role, shopId: u.shopId },
  })
}

export async function DELETE(req: NextRequest) {
  const shopId = getShopId(req)
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const existing = await db.appUser.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  if (shopId && existing.shopId && existing.shopId !== shopId) {
    return NextResponse.json({ error: 'Not authorized to delete this user' }, { status: 403 })
  }

  await db.appUser.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
