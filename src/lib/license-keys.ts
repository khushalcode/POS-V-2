/**
 * License keys — hardcoded so they work on Vercel (ephemeral filesystem)
 * AND on local/Electron (persistent SQLite).
 *
 * These keys are checked FIRST (before DB lookup), so they always work
 * regardless of whether the database has been seeded.
 */
export const VALID_LICENSE_KEYS: Record<string, number> = {
  'SSYNC-PVKN-9U9R-HDCR': 365,
  'SSYNC-L2U4-6QND-DZ2D': 365,
  'SSYNC-QNQG-25HG-LMXK': 365,
  'SSYNC-4GTM-DJ4T-TQ5H': 365,
  'SSYNC-VZ4Y-7XAD-6JJF': 365,
  'SSYNC-3H2E-RUFH-5YEE': 365,
  'SSYNC-EPNX-49ZJ-ZUNP': 365,
  'SSYNC-CQ26-NQ4P-EXHG': 365,
  'SSYNC-NYM5-UHGD-257M': 365,
  'SSYNC-8E6P-CPJ8-SH6Q': 365,
  'SSYNC-CW5J-CJY2-4N35': 365,
  'SSYNC-DV2E-YNQB-UESS': 365,
  'SSYNC-RW8Y-2X3R-QAK5': 365,
  'SSYNC-YX9E-VAFG-A438': 365,
  'SSYNC-YBBG-AWF4-8SJB': 365,
  'SSYNC-JLFC-KR6V-7HE3': 365,
  'SSYNC-L2XC-NJMB-U7EG': 365,
  'SSYNC-H36K-RD2Y-5XGW': 365,
  'SSYNC-JFF9-N789-YGJ2': 365,
  'SSYNC-3PAZ-HBEE-WAYR': 365,
  // Also keep the old demo keys for backward compat
  'SSYNC-DEMO-2025-365': 365,
  'SSYNC-DEMO-2025-030': 30,
  'SSYNC-DEMO-2025-007': 7,
  'SSYNC-FULL-2025-365': 365,
  'SSYNC-TEST-2025-001': 1,
}

/**
 * Check if a key is valid (exists in hardcoded list or DB).
 * Hardcoded list is checked FIRST — works on Vercel without DB.
 */
export function isValidKey(key: string): { valid: boolean; duration: number; reason?: string } {
  const normalized = key.trim().toUpperCase()
  if (VALID_LICENSE_KEYS[normalized]) {
    return { valid: true, duration: VALID_LICENSE_KEYS[normalized] }
  }
  return { valid: false, duration: 0, reason: 'invalid_key' }
}
