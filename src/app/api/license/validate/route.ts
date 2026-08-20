import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isValidKey } from '@/lib/license-keys'

/**
 * POST /api/license/validate
 * Checks if a key is valid AND not already used.
 */
export async function POST(req: NextRequest) {
  const { key } = await req.json()
  if (!key) return NextResponse.json({ error: 'Key required' }, { status: 400 })

  const normalized = key.trim().toUpperCase()
  const result = isValidKey(normalized)

  if (!result.valid) {
    return NextResponse.json({ valid: false, reason: result.reason })
  }

  // Check if already activated (one-time use)
  try {
    const existingActivation = await db.licenseActivation.findUnique({
      where: { key: normalized },
    })

    if (existingActivation) {
      const now = new Date()
      if (existingActivation.expiresAt > now) {
        // Already active — return as valid (same device)
        const daysLeft = Math.ceil((existingActivation.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        return NextResponse.json({
          valid: true,
          duration: result.duration,
          durationLabel: `${result.duration} days`,
          alreadyActivated: true,
          daysLeft,
        })
      } else {
        return NextResponse.json({
          valid: false,
          reason: 'expired',
        })
      }
    }

    // Check if marked as used
    const dbKey = await db.licenseKey.findUnique({ where: { key: normalized } })
    if (dbKey?.used) {
      return NextResponse.json({
        valid: false,
        reason: 'already_used',
      })
    }
  } catch {
    // DB not available — just check hardcoded list
  }

  return NextResponse.json({
    valid: true,
    duration: result.duration,
    durationLabel: `${result.duration} day${result.duration > 1 ? 's' : ''}`,
  })
}
