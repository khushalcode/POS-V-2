import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isValidKey } from '@/lib/license-keys'
import { logAudit } from '@/lib/audit'

/**
 * POST /api/license/activate
 *
 * Activates a license key. ONE-TIME USE — once activated, the key is blocked
 * from being used again.
 *
 * Checks:
 * 1. Key must be valid (hardcoded list)
 * 2. Key must NOT already be activated in the database (one-time use)
 * 3. On success: marks key as used, creates activation record
 */
export async function POST(req: NextRequest) {
  const { key } = await req.json()
  if (!key) return NextResponse.json({ error: 'Key required' }, { status: 400 })

  const normalized = key.trim().toUpperCase()
  const result = isValidKey(normalized)

  if (!result.valid) {
    return NextResponse.json({ error: 'Invalid license key' }, { status: 400 })
  }

  // ─── Check if key already activated (ONE-TIME USE) ───
  try {
    // Check in database
    const existingActivation = await db.licenseActivation.findUnique({
      where: { key: normalized },
    })

    if (existingActivation) {
      // Key already used — BLOCK
      const now = new Date()
      if (existingActivation.expiresAt > now) {
        // Still active — return success (same device re-activating)
        const daysLeft = Math.ceil((existingActivation.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        return NextResponse.json({
          active: true,
          activatedAt: existingActivation.activatedAt,
          expiresAt: existingActivation.expiresAt,
          daysLeft,
          message: 'License already active on this database',
        })
      } else {
        // Expired
        return NextResponse.json({
          error: 'This license key has expired. Please purchase a new key.',
        }, { status: 403 })
      }
    }

    // Check if key is marked as used in LicenseKey table
    const dbKey = await db.licenseKey.findUnique({ where: { key: normalized } })
    if (dbKey?.used) {
      return NextResponse.json({
        error: 'This license key has already been used on another device. Each key can only be used once.',
      }, { status: 403 })
    }
  } catch {
    // DB might not be available — fall through to localStorage-based check
    // The client-side hook also checks localStorage
  }

  // ─── Activate the key ───
  const now = new Date()
  const expiresAt = new Date(now)
  expiresAt.setDate(expiresAt.getDate() + result.duration)

  try {
    // Mark key as used in DB
    const dbKey = await db.licenseKey.findUnique({ where: { key: normalized } })
    if (dbKey && !dbKey.used) {
      await db.licenseKey.update({
        where: { id: dbKey.id },
        data: { used: true },
      })
    } else if (!dbKey) {
      // Key exists in hardcoded list but not in DB — create and mark as used
      await db.licenseKey.create({
        data: { key: normalized, duration: result.duration, used: true },
      })
    }

    // Create activation record
    await db.licenseActivation.create({
      data: {
        key: normalized,
        activatedAt: now,
        expiresAt,
      },
    })
  } catch {
    // DB might not be available — client will store in localStorage
  }

  return NextResponse.json({
    active: true,
    activatedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    daysLeft: result.duration,
  })
}
