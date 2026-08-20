import { db } from '../src/lib/db'

const SAMPLE_MENU = [
  // Starters
  { name: 'Veg Spring Rolls', category: 'Starters', price: 180 },
  { name: 'Chicken 65', category: 'Starters', price: 240 },
  { name: 'Paneer Tikka', category: 'Starters', price: 220 },
  { name: 'Fish Fingers', category: 'Starters', price: 280 },
  { name: 'Crispy Corn', category: 'Starters', price: 160 },
  // Main Course
  { name: 'Butter Chicken', category: 'Main Course', price: 320 },
  { name: 'Paneer Butter Masala', category: 'Main Course', price: 280 },
  { name: 'Mutton Biryani', category: 'Main Course', price: 360 },
  { name: 'Chicken Biryani', category: 'Main Course', price: 290 },
  { name: 'Veg Biryani', category: 'Main Course', price: 240 },
  { name: 'Dal Makhani', category: 'Main Course', price: 220 },
  { name: 'Jeera Rice', category: 'Main Course', price: 140 },
  // Breads
  { name: 'Butter Naan', category: 'Breads', price: 50 },
  { name: 'Garlic Naan', category: 'Breads', price: 70 },
  { name: 'Tandoori Roti', category: 'Breads', price: 30 },
  { name: 'Laccha Paratha', category: 'Breads', price: 60 },
  // Beverages
  { name: 'Masala Chai', category: 'Beverages', price: 40 },
  { name: 'Fresh Lime Soda', category: 'Beverages', price: 80 },
  { name: 'Sweet Lassi', category: 'Beverages', price: 90 },
  { name: 'Cold Coffee', category: 'Beverages', price: 120 },
  { name: 'Mineral Water', category: 'Beverages', price: 30 },
  // Desserts
  { name: 'Gulab Jamun', category: 'Desserts', price: 80 },
  { name: 'Rasmalai', category: 'Desserts', price: 100 },
  { name: 'Ice Cream Scoop', category: 'Desserts', price: 90 },
  { name: 'Brownie with Ice Cream', category: 'Desserts', price: 160 },
]

async function main() {
  console.log('Seeding...')

  // Legacy single-shop seed: use the first existing shop, or create a default one
  let shop = await db.shop.findFirst()
  if (!shop) {
    shop = await db.shop.create({
      data: { name: 'Default Shop', code: 'DEFAULT' },
    })
    console.log(`Created default shop: ${shop.name}`)
  }

  const tableCount = await db.restaurantTable.count({ where: { shopId: shop.id } })
  if (tableCount === 0) {
    for (let i = 1; i <= 10; i++) {
      await db.restaurantTable.create({
        data: { shopId: shop.id, number: i, name: `Table ${i}`, capacity: 4 },
      })
    }
    console.log('Seeded 10 tables')
  } else {
    console.log(`Tables already exist: ${tableCount}`)
  }

  const menuCount = await db.menuItem.count({ where: { shopId: shop.id } })
  if (menuCount === 0) {
    for (const m of SAMPLE_MENU) {
      await db.menuItem.create({ data: { ...m, shopId: shop.id } })
    }
    console.log(`Seeded ${SAMPLE_MENU.length} menu items`)
  } else {
    console.log(`Menu items already exist: ${menuCount}`)
  }

  console.log('Done.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
