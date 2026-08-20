import { db } from '@/lib/db'

/**
 * Log an audit event. Safe to call — never throws (fails silently).
 */
export async function logAudit(opts: {
  shopId?: string | null
  userId?: string | null
  userName?: string | null
  userRole?: string | null
  action: string
  details?: any
  ipAddress?: string | null
}) {
  try {
    await db.auditLog.create({
      data: {
        shopId: opts.shopId || null,
        userId: opts.userId || null,
        userName: opts.userName || null,
        userRole: opts.userRole || null,
        action: opts.action,
        details: opts.details ? JSON.stringify(opts.details) : null,
        ipAddress: opts.ipAddress || null,
      },
    })
  } catch (e) {
    // Audit logging should never break the main operation
    console.error('[audit] Failed to log:', e)
  }
}
