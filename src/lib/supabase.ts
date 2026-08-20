'use client'

import { createClient, SupabaseClient } from '@supabase/supabase-js'

/**
 * Supabase client for real-time cross-device sync.
 *
 * The user wants counter and kitchen on DIFFERENT devices to sync in real-time.
 * Supabase Realtime channels work across any network (internet), unlike
 * socket.io which only works on localhost / same WiFi.
 *
 * We use Supabase ONLY for realtime event broadcasting (not data storage).
 * Each device keeps its own local SQLite database; Supabase channels carry
 * the "hey, a new KOT was created" / "item status changed" events between
 * devices.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ''

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient | null {
  if (typeof window === 'undefined') return null
  if (!SUPABASE_URL || !SUPABASE_KEY) return null
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      realtime: {
        params: { eventsPerSecond: 10 },
      },
    })
  }
  return client
}

/**
 * Channel name is scoped per shop so events from Spice Garden
 * don't leak to Belly Bytes devices.
 */
export function shopChannel(shopId: string): string {
  return `shop-${shopId}`
}
