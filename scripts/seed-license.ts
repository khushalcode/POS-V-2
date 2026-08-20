import { db } from '../src/lib/db'

const DEMO_KEYS = [
  { key: 'SSYNC-DEMO-2025-365', duration: 365 },
  { key: 'SSYNC-DEMO-2025-030', duration: 30 },
  { key: 'SSYNC-DEMO-2025-007', duration: 7 },
  { key: 'SSYNC-FULL-2025-365', duration: 365 },
  { key: 'SSYNC-TEST-2025-001', duration: 1 },
]

async function main() {
  console.log('Seeding license keys...')
  for (const k of DEMO_KEYS) {
    const exists = await db.licenseKey.findUnique({ where: { key: k.key } })
    if (!exists) {
      await db.licenseKey.create({ data: k })
      console.log(`  ✓ ${k.key} (${k.duration} days)`)
    } else {
      console.log(`  - ${k.key} already exists`)
    }
  }
  console.log('Done.')
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(async () => { await db.$disconnect() })
