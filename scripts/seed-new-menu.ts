import { db } from '../src/lib/db'

const NEW_MENU = [
  // Sandwich
  { name: 'Maha Jumbo Sandwich', category: 'Sandwich', price: 150 },
  { name: 'Cheese Chutney Sandwich', category: 'Sandwich', price: 90 },
  // Pizza (9 Inch)
  { name: 'Ultimate Cheese Burst Pizza', category: 'Pizza', price: 250 },
  { name: 'Royal Paneer Tandoori Pizza', category: 'Pizza', price: 200 },
  { name: 'Classic Veg Delight Pizza', category: 'Pizza', price: 180 },
  { name: 'Cheesy Corn Burst Pizza', category: 'Pizza', price: 180 },
  // Maggie
  { name: 'Thuso Special Loaded Maggie', category: 'Maggie', price: 180 },
  { name: 'Tandoori Paneer Maggie', category: 'Maggie', price: 150 },
  { name: 'Double Masala Cheese Maggie', category: 'Maggie', price: 100 },
  // Momos
  { name: 'Cheese Corn Momos', category: 'Momos', price: 90 },
  { name: 'Paneer Momos', category: 'Momos', price: 80 },
  { name: 'Veg Momos', category: 'Momos', price: 70 },
  // Burgers
  { name: 'Double Tikki Cheese Royale Burger', category: 'Burgers', price: 130 },
  { name: 'Classic Veg Cheese Burger', category: 'Burgers', price: 90 },
  // Chips & Fries
  { name: 'Cheese Ling Chips', category: 'Chips & Fries', price: 100 },
  { name: 'Peri Peri Fries', category: 'Chips & Fries', price: 90 },
  { name: 'Salted Fries', category: 'Chips & Fries', price: 90 },
  // Drinks
  { name: 'Cold Coffee', category: 'Drinks', price: 80 },
  { name: 'Classic Mojito', category: 'Drinks', price: 80 },
  // Juices
  { name: 'Watermelon Juice', category: 'Juices', price: 70 },
  { name: 'Papaya Juice', category: 'Juices', price: 70 },
  { name: 'Muskmelon Juice', category: 'Juices', price: 80 },
  { name: 'Pink Guava Juice', category: 'Juices', price: 80 },
  { name: 'Chikoo Juice', category: 'Juices', price: 80 },
  { name: 'Pineapple Juice', category: 'Juices', price: 90 },
  { name: 'Alphonso Mango Juice', category: 'Juices', price: 90 },
  { name: 'Custard Apple Juice', category: 'Juices', price: 90 },
  // Shakes
  { name: 'Oreo Shake', category: 'Shakes', price: 100 },
  { name: 'KitKat Shake', category: 'Shakes', price: 100 },
  { name: 'Watermelon Shake', category: 'Shakes', price: 100 },
  { name: 'Papaya Shake', category: 'Shakes', price: 100 },
  { name: 'Muskmelon Shake', category: 'Shakes', price: 110 },
  { name: 'Pink Guava Shake', category: 'Shakes', price: 110 },
  { name: 'Chikoo Shake', category: 'Shakes', price: 110 },
  { name: 'Pineapple Shake', category: 'Shakes', price: 120 },
  { name: 'Alphonso Mango Shake', category: 'Shakes', price: 120 },
  { name: 'Custard Apple Shake', category: 'Shakes', price: 120 },
]

async function main() {
  console.log('Replacing menu items...\n')

  const shops = await db.shop.findMany()
  for (const shop of shops) {
    // Delete dependent records first (FK constraints)
    // 1. Find all orders for this shop
    const orders = await db.order.findMany({ where: { shopId: shop.id }, select: { id: true } })
    const orderIds = orders.map((o) => o.id)

    if (orderIds.length > 0) {
      // 2. Delete order items
      await db.orderItem.deleteMany({ where: { orderId: { in: orderIds } } })
      // 3. Delete bills
      await db.bill.deleteMany({ where: { orderId: { in: orderIds } } })
      // 4. Delete orders
      await db.order.deleteMany({ where: { shopId: shop.id } })
    }

    // 5. Now safe to delete menu items
    const deleted = await db.menuItem.deleteMany({ where: { shopId: shop.id } })
    console.log(`[${shop.name}] Deleted ${deleted.count} old items + ${orderIds.length} orders`)

    // Insert new items
    for (const item of NEW_MENU) {
      await db.menuItem.create({
        data: {
          shopId: shop.id,
          name: item.name,
          category: item.category,
          price: item.price,
          cost: Math.round(item.price * 0.4),
          stock: 100,
          unit: 'Pcs',
          available: true,
        },
      })
    }
    console.log(`[${shop.name}] Added ${NEW_MENU.length} new items`)
  }

  console.log(`\nDone! ${NEW_MENU.length} items per shop across ${shops.length} shops.`)
  console.log('Categories: Sandwich, Pizza, Maggie, Momos, Burgers, Chips & Fries, Drinks, Juices, Shakes')
  await db.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
