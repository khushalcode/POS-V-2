import { db } from '../src/lib/db'

async function main() {
  console.log('Ensuring virtual Direct Counter table exists for all shops...')

  const shops = await db.shop.findMany({ select: { id: true, name: true } })

  for (const shop of shops) {
    // Direct Counter virtual table — number 0, hidden from main grid
    const existing = await db.restaurantTable.findUnique({
      where: { shopId_number: { shopId: shop.id, number: 0 } },
    })

    if (!existing) {
      await db.restaurantTable.create({
        data: {
          shopId: shop.id,
          number: 0,
          name: 'Direct Counter',
          capacity: 0,
          status: 'available',
        },
      })
      console.log(`[${shop.name}] Created Direct Counter virtual table (number 0)`)
    } else {
      console.log(`[${shop.name}] Direct Counter table already exists`)
    }
  }

  console.log('Done.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await db.$disconnect() })
