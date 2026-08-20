import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/license/status
 * Checks if there's a valid activation in the DB.
 * On Vercel (where DB resets), this may return not_activated —
 * the client-side useLicenseCheck hook also checks localStorage as fallback.
 */
export async function GET() {
  try {
    const activation = await db.licenseActivation.findFirst()
    if (!activation) {
      return NextResponse.json({ active: false, reason: 'not_activated' })
    }
    const now = new Date()
    if (activation.expiresAt < now) {
      return NextResponse.json({
        active: false,
        reason: 'expired',
        activatedAt: activation.activatedAt,
        expiresAt: activation.expiresAt,
      })
    }
    return NextResponse.json({
      active: true,
      activatedAt: activation.activatedAt,
      expiresAt: activation.expiresAt,
      daysLeft: Math.ceil((activation.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
    })
  } catch {
    // DB not available (Vercel cold start) — return not_activated
    // Client-side hook will check localStorage
    return NextResponse.json({ active: false, reason: 'not_activated' })
  }
}
