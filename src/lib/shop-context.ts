import { NextRequest } from 'next/server'

/**
 * Extracts the shop ID from request headers (`X-Shop-Id`) or query string.
 * All multi-shop-aware endpoints should use this to scope their queries.
 */
export function getShopId(req?: NextRequest): string | null {
  if (req) {
    const header = req.headers.get('X-Shop-Id')
    if (header) return header
    const query = req.nextUrl.searchParams.get('shopId')
    if (query) return query
  }
  return null
}
