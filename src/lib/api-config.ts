/**
 * API configuration
 *
 * When running locally: API_URL is empty → fetches use relative paths (/api/...)
 * When running as APK (Capacitor): set NEXT_PUBLIC_API_URL to your Vercel URL
 * All fetch calls automatically use this as the base URL
 *
 * Example for APK:
 *   NEXT_PUBLIC_API_URL=https://your-app.vercel.app
 *   → fetch('/api/auth/login') becomes fetch('https://your-app.vercel.app/api/auth/login')
 */

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''

/**
 * Builds a full URL from a path.
 * - Locally: '/api/auth/login' → '/api/auth/login'
 * - APK mode: '/api/auth/login' → 'https://your-app.vercel.app/api/auth/login'
 */
export function apiUrl(path: string): string {
  if (!API_BASE) return path
  return `${API_BASE}${path}`
}
