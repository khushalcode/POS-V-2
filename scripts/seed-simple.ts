import { db } from '../src/lib/db'

const SAMPLE_MENU = [
  { name: 'Veg Spring Rolls', category: 'Starters', price: 180, cost: 90 },
  { name: 'Chicken 65', category: 'Starters', price: 240, cost: 130 },
  { name: 'Paneer Tikka', category: 'Starters', price: 220, cost: 110 },
  { name: 'Fish Fingers', category: 'Starters', price: 280, cost: 160 },
  { name: 'Crispy Corn', category: 'Starters', price: 160, cost: 70 },
  { name: 'Butter Chicken', category: 'Main Course', price: 320, cost: 180 },
  { name: 'Paneer Butter Masala', category: 'Main Course', price: 280, cost: 140 },
  { name: 'Mutton Biryani', category: 'Main Course', price: 360, cost: 200 },
  { name: 'Chicken Biryani', category: 'Main Course', price: 290, cost: 160 },
  { name: 'Veg Biryani', category: 'Main Course', price: 240, cost: 110 },
  { name: 'Dal Makhani', category: 'Main Course', price: 220, cost: 90 },
  { name: 'Jeera Rice', category: 'Main Course', price: 140, cost: 50 },
  { name: 'Butter Naan', category: 'Breads', price: 50, cost: 18 },
  { name: 'Garlic Naan', category: 'Breads', price: 70, cost: 25 },
  { name: 'Tandoori Roti', category: 'Breads', price: 30, cost: 10 },
  { name: 'Laccha Paratha', category: 'Breads', price: 60, cost: 22 },
  { name: 'Masala Chai', category: 'Beverages', price: 40, cost: 12 },
  { name: 'Fresh Lime Soda', category: 'Beverages', price: 80, cost: 25 },
  { name: 'Sweet Lassi', category: 'Beverages', price: 90, cost: 30 },
  { name: 'Cold Coffee', category: 'Beverages', price: 120, cost: 45 },
  { name: 'Mineral Water', category: 'Beverages', price: 30, cost: 15 },
  { name: 'Gulab Jamun', category: 'Desserts', price: 80, cost: 30 },
  { name: 'Rasmalai', category: 'Desserts', price: 100, cost: 40 },
  { name: 'Ice Cream Scoop', category: 'Desserts', price: 90, cost: 35 },
  { name: 'Brownie with Ice Cream', category: 'Desserts', price: 160, cost: 70 },
]

async function seedShop(opts: {
  name: string
  code: string
  color: string
  billAccentColor: string
  address?: string
  phone?: string
  gstin?: string
  taxRate?: number
  admin: { name: string; email: string; password: string }
  staff: { name: string; email: string; password: string }[]
}) {
  const shop = await db.shop.create({
    data: {
      name: opts.name,
      code: opts.code,
      color: opts.color,
      address: opts.address || null,
      phone: opts.phone || null,
      gstin: opts.gstin || null,
      taxRate: opts.taxRate || 5,
      currency: 'Rs.',
    },
  })

  // Create settings with per-shop bill accent color
  await db.shopSetting.create({
    data: {
      shopId: shop.id,
      shopName: opts.name,
      address: opts.address || null,
      phone: opts.phone || null,
      gstin: opts.gstin || null,
      taxRate: opts.taxRate || 5,
      currency: 'Rs.',
      billAccentColor: opts.billAccentColor,
      kotAccentColor: opts.billAccentColor,
    },
  })

  // Tables (skip number 0 — virtual Direct Counter table)
  for (let i = 1; i <= 10; i++) {
    await db.restaurantTable.create({
      data: { shopId: shop.id, number: i, name: `Table ${i}`, capacity: 4 },
    })
  }
  await db.restaurantTable.create({
    data: { shopId: shop.id, number: 0, name: 'Direct Counter', capacity: 0 },
  })

  // Menu
  for (const m of SAMPLE_MENU) {
    await db.menuItem.create({ data: { ...m, shopId: shop.id, unit: 'Pcs', stock: 50 } })
  }

  // Admin user
  await db.appUser.create({
    data: {
      name: opts.admin.name,
      email: opts.admin.email,
      password: opts.admin.password,
      role: 'admin',
      shopId: shop.id,
    },
  })

  // Staff users
  for (const s of opts.staff) {
    await db.appUser.create({
      data: { ...s, role: 'staff', shopId: shop.id },
    })
  }

  console.log(`Seeded ${opts.name} (${opts.code}) — bill color: ${opts.billAccentColor}, ${opts.staff.length + 1} users`)
  return shop
}

async function main() {
  console.log('Seeding simplified single-shop data...')

  // ─── Single-shop setup ──────────────────────────────────────────────
  // This POS is configured for ONE shop only. The shop-picker screen is
  // skipped automatically because session.tsx auto-selects when the user
  // has exactly one shop.
  await seedShop({
    name: 'Spice Garden',
    code: 'SPICE',
    color: 'orange',
    billAccentColor: '#f97316',
    address: '12 Marine Drive, Mumbai',
    phone: '+91 98200 11223',
    gstin: '27SPICE2024G1Z9',
    taxRate: 5,
    admin: { name: 'Aarav Patel', email: 'admin@spice.com', password: 'admin123' },
    staff: [
      { name: 'Riya Sharma', email: 'riya@spice.com', password: 'staff123' },
      { name: 'Karan Mehta', email: 'karan@spice.com', password: 'staff123' },
    ],
  })

  // Super admin (access to all shops)
  await db.appUser.create({
    data: {
      name: 'Super Admin',
      email: 'super@servingsync.com',
      password: 'super123',
      role: 'admin',
      shopId: null,
    },
  })
  console.log('Seeded Super Admin (super@servingsync.com / super123)')
  console.log('Done. Single shop. 2 roles only: admin + staff. No kitchen role.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await db.$disconnect() })
