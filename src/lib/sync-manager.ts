'use client'

import { getSupabase } from './supabase'
import { syncQueue } from './client-data'
import { drainOutbox as drainDataOutbox } from './offline-sync'

/**
 * SyncManager — drains the outbox to Supabase when online.
 *
 * Two kinds of outbox rows:
 *   1. Realtime broadcast events (kot:new, item:status, order:status,
 *      table:released, …) → pushed to the `kot_events` Supabase table so
 *      other devices' Supabase Realtime channel can fan them out.
 *   2. Data-row writes (data_upsert:Bill, data_delete:Customer, …) →
 *      pushed to the matching `sync_*` Supabase table via offline-sync's
 *      pushRow / pushDelete helpers. These keep the database itself in
 *      sync across devices and provide durable storage so data is never
 *      lost even if a device crashes while offline.
 *
 * The manager runs every 10 seconds and also drains immediately when the
 * network comes back online.
 */

let syncInterval: any = null
let isSyncing = false

export function startSyncManager() {
  if (syncInterval) return
  // Check every 10 seconds
  syncInterval = setInterval(drainOutbox, 10_000)
  // Also drain immediately
  drainOutbox()
  // Drain when coming back online
  if (typeof window !== 'undefined') {
    window.addEventListener('online', drainOutbox)
  }
}

export function stopSyncManager() {
  if (syncInterval) { clearInterval(syncInterval); syncInterval = null }
  if (typeof window !== 'undefined') {
    window.removeEventListener('online', drainOutbox)
  }
}

async function drainOutbox() {
  if (isSyncing) return
  if (typeof navigator !== 'undefined' && !navigator.onLine) return

  isSyncing = true
  try {
    // 1. Drain realtime broadcast events → kot_events table.
    const supabase = getSupabase()
    if (supabase) {
      const pending = syncQueue.getPending()
      for (const item of pending) {
        try {
          const payload = JSON.parse(item.payload)
          const { error } = await supabase
            .from('kot_events')
            .insert({
              event_type: item.eventType,
              payload: payload,
              created_at: new Date().toISOString(),
            })
          if (error) {
            syncQueue.markFailed(item.id)
          } else {
            syncQueue.markSynced(item.id)
          }
        } catch {
          syncQueue.markFailed(item.id)
        }
      }
    }

    // 2. Drain data-row writes → sync_* tables (bills, orders, expenses, …).
    //    This is the offline-first durable sync — every create/update/delete
    //    in client-data.ts enqueues a row here so it survives the device
    //    going offline and is pushed to Supabase as soon as we're online.
    try {
      await drainDataOutbox()
    } catch (e) {
      console.warn('[sync-manager] data outbox drain failed:', e)
    }
  } finally {
    isSyncing = false
  }
}
