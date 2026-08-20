/**
 * Simplify users: remove all users except super admin.
 * Super admin can access all shops and all modes.
 */
import { db } from '../src/lib/db'

async function main() {
  console.log('Simplifying users — keeping only Super Admin...\n')

  // Delete all users except super admin
  const deleted = await db.appUser.deleteMany({
    where: { email: { not: 'super@servingsync.com' } },
  })
  console.log(`Deleted ${deleted.count} user(s)`)

  // Ensure super admin exists
  const superAdmin = await db.appUser.findUnique({
    where: { email: 'super@servingsync.com' },
  })
  if (!superAdmin) {
    await db.appUser.create({
      data: {
        name: 'Super Admin',
        email: 'super@servingsync.com',
        password: 'admin123',
        role: 'admin',
        shopId: null,
      },
    })
    console.log('Created Super Admin')
  } else {
    // Update password to admin123
    await db.appUser.update({
      where: { id: superAdmin.id },
      data: { password: 'admin123' },
    })
    console.log('Super Admin password updated to: admin123')
  }

  const remaining = await db.appUser.findMany()
  console.log(`\nRemaining users: ${remaining.length}`)
  remaining.forEach((u) => {
    console.log(`  - ${u.name} (${u.email}) — role: ${u.role}`)
  })

  await db.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
