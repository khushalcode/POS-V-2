/**
 * Generate proper license keys for ServingSync POS.
 * Format: SSYNC-XXXX-XXXX-XXXX (alphanumeric, easy to type)
 * Each key is valid for 365 days.
 */
import { db } from '../src/lib/db'
import { randomBytes } from 'crypto'

function generateKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no confusing chars (0, O, 1, I)
  const segment = (len: number) => Array.from(randomBytes(len), (b) => chars[b % chars.length]).join('')
  return `SSYNC-${segment(4)}-${segment(4)}-${segment(4)}`
}

async function main() {
  console.log('Generating license keys...\n')

  const keys: string[] = []
  const NUM_KEYS = 20

  for (let i = 0; i < NUM_KEYS; i++) {
    let key = generateKey()
    // Ensure uniqueness
    while (keys.includes(key)) {
      key = generateKey()
    }
    keys.push(key)

    // Check if already in DB
    const existing = await db.licenseKey.findUnique({ where: { key } })
    if (!existing) {
      await db.licenseKey.create({
        data: { key, duration: 365 },
      })
    }
  }

  // Print all keys
  console.log('=== SERVINGSYNC POS LICENSE KEYS ===')
  console.log('Each key is valid for 365 days from activation.\n')
  keys.forEach((k, i) => {
    console.log(`${String(i + 1).padStart(2, '0')}. ${k}`)
  })
  console.log(`\nTotal: ${keys.length} keys generated and saved to database.`)

  // Also save to file
  const fs = await import('fs')
  const fileContent = `ServingSync POS — License Keys
Generated: ${new Date().toISOString()}
Valid: 365 days from activation

${keys.map((k, i) => `${String(i + 1).padStart(2, '0')}. ${k}`).join('\n')}

Instructions:
1. Give one key to each restaurant that purchases the software
2. When they install the app, it will ask for a license key
3. Enter the key → app activates for 1 year
4. After 1 year, app stops working — customer needs a new key
`
  fs.writeFileSync('/home/z/my-project/download/license-keys.txt', fileContent)
  console.log('\nKeys also saved to: download/license-keys.txt')

  await db.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
