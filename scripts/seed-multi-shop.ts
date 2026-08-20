import { db } from '../src/lib/db'

const SAMPLE_MENU = [
  // Starters
  { name: 'Veg Spring Rolls', category: 'Starters', price: 180, cost: 90 },
  { name: 'Chicken 65', category: 'Starters', price: 240, cost: 130 },
  { name: 'Paneer Tikka', category: 'Starters', price: 220, cost: 110 },
  { name: 'Fish Fingers', category: 'Starters', price: 280, cost: 160 },
  { name: 'Crispy Corn', category: 'Starters', price: 160, cost: 70 },
  // Main Course
  { name: 'Butter Chicken', category: 'Main Course', price: 320, cost: 180 },
  { name: 'Paneer Butter Masala', category: 'Main Course', price: 280, cost: 140 },
  { name: 'Mutton Biryani', category: 'Main Course', price: 360, cost: 200 },
  { name: 'Chicken Biryani', category: 'Main Course', price: 290, cost: 160 },
  { name: 'Veg Biryani', category: 'Main Course', price: 240, cost: 110 },
  { name: 'Dal Makhani', category: 'Main Course', price: 220, cost: 90 },
  { name: 'Jeera Rice', category: 'Main Course', price: 140, cost: 50 },
  // Breads
  { name: 'Butter Naan', category: 'Breads', price: 50, cost: 18 },
  { name: 'Garlic Naan', category: 'Breads', price: 70, cost: 25 },
  { name: 'Tandoori Roti', category: 'Breads', price: 30, cost: 10 },
  { name: 'Laccha Paratha', category: 'Breads', price: 60, cost: 22 },
  // Beverages
  { name: 'Masala Chai', category: 'Beverages', price: 40, cost: 12 },
  { name: 'Fresh Lime Soda', category: 'Beverages', price: 80, cost: 25 },
  { name: 'Sweet Lassi', category: 'Beverages', price: 90, cost: 30 },
  { name: 'Cold Coffee', category: 'Beverages', price: 120, cost: 45 },
  { name: 'Mineral Water', category: 'Beverages', price: 30, cost: 15 },
  // Desserts
  { name: 'Gulab Jamun', category: 'Desserts', price: 80, cost: 30 },
  { name: 'Rasmalai', category: 'Desserts', price: 100, cost: 40 },
  { name: 'Ice Cream Scoop', category: 'Desserts', price: 90, cost: 35 },
  { name: 'Brownie with Ice Cream', category: 'Desserts', price: 160, cost: 70 },
]

async function seedShop(opts: {
  name: string
  code: string
  color: string
  address?: string
  phone?: string
  gstin?: string
  taxRate?: number
  tableCount?: number
  admin: { name: string; email: string; password: string }
  staff?: { name: string; email: string; password: string }
  kitchen?: { name: string; email: string; password: string }
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

  await db.shopSetting.create({
    data: {
      shopId: shop.id,
      shopName: opts.name,
      address: opts.address || null,
      phone: opts.phone || null,
      gstin: opts.gstin || null,
      taxRate: opts.taxRate || 5,
      currency: 'Rs.',
    },
  })

  // Tables (skip number 0 — virtual Direct Counter table)
  const tableCount = opts.tableCount || 10
  for (let i = 1; i <= tableCount; i++) {
    await db.restaurantTable.create({
      data: {
        shopId: shop.id,
        number: i,
        name: `Table ${i}`,
        capacity: 4,
      },
    })
  }
  // Virtual Direct Counter table
  await db.restaurantTable.create({
    data: { shopId: shop.id, number: 0, name: 'Direct Counter', capacity: 0 },
  })

  // Menu
  for (const m of SAMPLE_MENU) {
    await db.menuItem.create({ data: { ...m, shopId: shop.id, unit: 'Pcs', stock: 50 } })
  }

  // Users
  await db.appUser.create({
    data: {
      name: opts.admin.name,
      email: opts.admin.email,
      password: opts.admin.password,
      role: 'admin',
      shopId: shop.id,
    },
  })
  if (opts.staff) {
    await db.appUser.create({
      data: { ...opts.staff, role: 'staff', shopId: shop.id },
    })
  }
  if (opts.kitchen) {
    await db.appUser.create({
      data: { ...opts.kitchen, role: 'kitchen', shopId: shop.id },
    })
  }

  console.log(`Seeded ${opts.name} (${opts.code}) — ${tableCount} tables, ${SAMPLE_MENU.length} menu items, 3 users`)
  return shop
}

async function main() {
  console.log('Seeding multi-shop data...')

  // Shop 1: Spice Garden (orange theme)
  await seedShop({
    name: 'Spice Garden',
    code: 'SPICE',
    color: 'orange',
    address: '12 Marine Drive, Mumbai',
    phone: '+91 98200 11223',
    gstin: '27SPICE2024G1Z9',
    taxRate: 5,
    admin: { name: 'Aarav Patel', email: 'admin@spice.com', password: 'admin123' },
    staff: { name: 'Riya Sharma', email: 'staff@spice.com', password: 'staff123' },
    kitchen: { name: 'Chef Vikram', email: 'kitchen@spice.com', password: 'kitchen123' },
  })

  // Shop 2: Belly Bytes (emerald theme)
  await seedShop({
    name: 'Belly Bytes',
    code: 'BELLY',
    color: 'emerald',
    address: '45 Brigade Road, Bengaluru',
    phone: '+91 80400 55667',
    gstin: '29BELLY2024G1Z2',
    taxRate: 5,
    admin: { name: 'Diya Reddy', email: 'admin@belly.com', password: 'admin123' },
    staff: { name: 'Karan Mehta', email: 'staff@belly.com', password: 'staff123' },
    kitchen: { name: 'Chef Anjali', email: 'kitchen@belly.com', password: 'kitchen123' },
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
  console.log('Seeded Super Admin (super@servingsync.com / super123) — access to all shops')

  console.log('Done.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await db.$disconnect() })
