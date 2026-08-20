import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/auto-seed
 *
 * Automatically seeds the database on first launch.
 * If data already exists (e.g. user ran SQL migration in Supabase), does nothing.
 * If database is empty, seeds all data.
 */
export async function GET() {
  try {
    // Check if shops already exist
    const shopCount = await db.shop.count().catch(() => 0)
    if (shopCount > 0) {
      return NextResponse.json({ seeded: false, message: 'Database already has data', shops: shopCount })
    }

    console.log('[auto-seed] Database is empty — seeding...')

    // ─── Seed shops ───
    const shop1 = await db.shop.create({
      data: {
        name: 'Spice Garden', code: 'SPICE', color: 'orange',
        address: '12 Marine Drive, Mumbai', phone: '+91 98200 11223',
        gstin: '27SPICE2024G1Z9', taxRate: 5, currency: 'Rs.',
      },
    })
    const shop2 = await db.shop.create({
      data: {
        name: 'Belly Bytes', code: 'BELLY', color: 'emerald',
        address: '45 Brigade Road, Bengaluru', phone: '+91 80400 55667',
        gstin: '29BELLY2024G1Z2', taxRate: 5, currency: 'Rs.',
      },
    })

    // ─── Seed shop settings ───
    for (const shop of [shop1, shop2]) {
      await db.shopSetting.create({
        data: {
          shopId: shop.id, shopName: shop.name, address: shop.address,
          phone: shop.phone, gstin: shop.gstin, taxRate: shop.taxRate, currency: shop.currency,
          billAccentColor: shop.color === 'orange' ? '#f97316' : '#10b981',
          kotAccentColor: shop.color === 'orange' ? '#f97316' : '#10b981',
        },
      })
      // ─── Seed tables ───
      await db.restaurantTable.create({ data: { shopId: shop.id, number: 0, name: 'Direct Counter', capacity: 0, status: 'available' } })
      for (let i = 1; i <= 10; i++) {
        await db.restaurantTable.create({ data: { shopId: shop.id, number: i, name: `Table ${i}`, capacity: 4, status: 'available' } })
      }
    }

    // ─── Seed menu items ───
    const MENU = [
      { name: 'Maha Jumbo Sandwich', category: 'Sandwich', price: 150 }, { name: 'Cheese Chutney Sandwich', category: 'Sandwich', price: 90 },
      { name: 'Ultimate Cheese Burst Pizza', category: 'Pizza', price: 250 }, { name: 'Royal Paneer Tandoori Pizza', category: 'Pizza', price: 200 },
      { name: 'Classic Veg Delight Pizza', category: 'Pizza', price: 180 }, { name: 'Cheesy Corn Burst Pizza', category: 'Pizza', price: 180 },
      { name: 'Thuso Special Loaded Maggie', category: 'Maggie', price: 180 }, { name: 'Tandoori Paneer Maggie', category: 'Maggie', price: 150 },
      { name: 'Double Masala Cheese Maggie', category: 'Maggie', price: 100 },
      { name: 'Cheese Corn Momos', category: 'Momos', price: 90 }, { name: 'Paneer Momos', category: 'Momos', price: 80 }, { name: 'Veg Momos', category: 'Momos', price: 70 },
      { name: 'Double Tikki Cheese Royale Burger', category: 'Burgers', price: 130 }, { name: 'Classic Veg Cheese Burger', category: 'Burgers', price: 90 },
      { name: 'Cheese Ling Chips', category: 'Chips & Fries', price: 100 }, { name: 'Peri Peri Fries', category: 'Chips & Fries', price: 90 }, { name: 'Salted Fries', category: 'Chips & Fries', price: 90 },
      { name: 'Cold Coffee', category: 'Drinks', price: 80 }, { name: 'Classic Mojito', category: 'Drinks', price: 80 },
      { name: 'Watermelon Juice', category: 'Juices', price: 70 }, { name: 'Papaya Juice', category: 'Juices', price: 70 },
      { name: 'Muskmelon Juice', category: 'Juices', price: 80 }, { name: 'Pink Guava Juice', category: 'Juices', price: 80 },
      { name: 'Chikoo Juice', category: 'Juices', price: 80 }, { name: 'Pineapple Juice', category: 'Juices', price: 90 },
      { name: 'Alphonso Mango Juice', category: 'Juices', price: 90 }, { name: 'Custard Apple Juice', category: 'Juices', price: 90 },
      { name: 'Oreo Shake', category: 'Shakes', price: 100 }, { name: 'KitKat Shake', category: 'Shakes', price: 100 },
      { name: 'Watermelon Shake', category: 'Shakes', price: 100 }, { name: 'Papaya Shake', category: 'Shakes', price: 100 },
      { name: 'Muskmelon Shake', category: 'Shakes', price: 110 }, { name: 'Pink Guava Shake', category: 'Shakes', price: 110 },
      { name: 'Chikoo Shake', category: 'Shakes', price: 110 }, { name: 'Pineapple Shake', category: 'Shakes', price: 120 },
      { name: 'Alphonso Mango Shake', category: 'Shakes', price: 120 }, { name: 'Custard Apple Shake', category: 'Shakes', price: 120 },
    ]
    for (const shop of [shop1, shop2]) {
      for (const item of MENU) {
        await db.menuItem.create({ data: { shopId: shop.id, name: item.name, category: item.category, price: item.price, cost: Math.round(item.price * 0.4), stock: 100, unit: 'Pcs', available: true } })
      }
    }

    // ─── Seed super admin ───
    const existingUser = await db.appUser.findUnique({ where: { email: 'super@thuso.com' } })
    if (!existingUser) {
      await db.appUser.create({ data: { name: 'Super Admin', email: 'super@thuso.com', password: 'admin123', role: 'admin', shopId: null } })
    }

    // ─── Seed license keys ───
    const KEYS = ['SSYNC-PVKN-9U9R-HDCR','SSYNC-L2U4-6QND-DZ2D','SSYNC-QNQG-25HG-LMXK','SSYNC-4GTM-DJ4T-TQ5H','SSYNC-VZ4Y-7XAD-6JJF','SSYNC-3H2E-RUFH-5YEE','SSYNC-EPNX-49ZJ-ZUNP','SSYNC-CQ26-NQ4P-EXHG','SSYNC-NYM5-UHGD-257M','SSYNC-8E6P-CPJ8-SH6Q','SSYNC-CW5J-CJY2-4N35','SSYNC-DV2E-YNQB-UESS','SSYNC-RW8Y-2X3R-QAK5','SSYNC-YX9E-VAFG-A438','SSYNC-YBBG-AWF4-8SJB','SSYNC-JLFC-KR6V-7HE3','SSYNC-L2XC-NJMB-U7EG','SSYNC-H36K-RD2Y-5XGW','SSYNC-JFF9-N789-YGJ2','SSYNC-3PAZ-HBEE-WAYR']
    for (const key of KEYS) {
      const existing = await db.licenseKey.findUnique({ where: { key } }).catch(() => null)
      if (!existing) await db.licenseKey.create({ data: { key, duration: 365 } })
    }

    console.log('[auto-seed] Done!')
    return NextResponse.json({ seeded: true, message: 'Database seeded', shops: 2, menuItems: 37, tables: 11, users: 1, licenseKeys: 20 })
  } catch (error: any) {
    console.error('[auto-seed] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
