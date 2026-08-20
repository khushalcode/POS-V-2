'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { getSupabase, shopChannel } from '@/lib/supabase'
import { useSession } from '@/lib/session'
import { syncQueue } from '@/lib/client-data'
import type {
  KOTPayload,
  ItemStatusPayload,
  OrderStatusPayload,
  TablePayload,
} from '@/lib/types'

/**
 * useRestaurantSync — DUAL SYNC
 * -----------------------------
 * Works BOTH ways:
 *
 * 1. OFFLINE (same WiFi, no internet):
 *    Uses Socket.io mini-service on port 3005
 *    Counter PC runs the server → Kitchen tablet on same WiFi connects
 *    100% offline, no internet needed
 *
 * 2. ONLINE (internet available):
 *    Uses Supabase Realtime channels
 *    Works across any network (different WiFi, 4G, etc.)
 *
 * Both run simultaneously — if one fails, the other still works.
 */

type Role = 'counter' | 'kitchen'

interface Handlers {
  onKOTNew?: (p: KOTPayload) => void
  onKOTItemAdded?: (p: KOTPayload) => void
  onItemStatus?: (p: ItemStatusPayload) => void
  onOrderStatus?: (p: OrderStatusPayload) => void
  onTableReleased?: (p: TablePayload) => void
  onTableOccupied?: (p: TablePayload) => void
  onDataRefresh?: (p: unknown) => void
}

export function useRestaurantSync(role: Role, handlers: Handlers) {
  const { currentShop } = useSession()
  const [connected, setConnected] = useState(false)
  const [onlineCount, setOnlineCount] = useState(0)
  const [syncMode, setSyncMode] = useState<'offline' | 'online' | 'both' | 'none'>('none')

  const socketRef = useRef<any>(null)
  const supabaseChannelRef = useRef<any>(null)
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  // ─── 1. SOCKET.IO (Offline — same WiFi) ───
  useEffect(() => {
    let mounted = true

    ;(async () => {
      try {
        const { io } = await import('socket.io-client')
        // Connect via Caddy gateway (works on same device + same WiFi)
        const socket = io('/?XTransformPort=3005', {
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionAttempts: Infinity,
        })

        if (!mounted) { socket.close(); return }
        socketRef.current = socket

        socket.on('connect', () => {
          setConnected(true)
          socket.emit('join', role)
          setSyncMode(prev => prev === 'online' ? 'both' : 'offline')
        })
        socket.on('disconnect', () => {
          setConnected(false)
          setSyncMode(prev => prev === 'online' ? 'online' : 'none')
        })

        socket.on('joined', ({ online }: { online: number }) => setOnlineCount(online))

        socket.on('kot:new', (p: KOTPayload) => handlersRef.current.onKOTNew?.(p))
        socket.on('kot:item-added', (p: KOTPayload) => handlersRef.current.onKOTItemAdded?.(p))
        socket.on('item:status', (p: ItemStatusPayload) => handlersRef.current.onItemStatus?.(p))
        socket.on('order:status', (p: OrderStatusPayload) => handlersRef.current.onOrderStatus?.(p))
        socket.on('table:released', (p: TablePayload) => handlersRef.current.onTableReleased?.(p))
        socket.on('table:occupied', (p: TablePayload) => handlersRef.current.onTableOccupied?.(p))
        socket.on('data:refresh', (p: unknown) => handlersRef.current.onDataRefresh?.(p))
      } catch {
        // Socket.io not available — that's OK, Supabase will handle it
      }
    })()

    return () => {
      mounted = false
      socketRef.current?.close()
      socketRef.current = null
    }
  }, [role])

  // ─── 2. SUPABASE REALTIME (Online — internet) ───
  useEffect(() => {
    if (!currentShop?.id) return
    const supabase = getSupabase()
    if (!supabase) return

    const channelName = shopChannel(currentShop.id)
    const channel = supabase.channel(channelName, {
      config: { presence: { key: `${role}-${Math.random().toString(36).slice(2, 8)}` } },
    })

    const events: Array<{ name: string; handler: (payload: any) => void }> = [
      { name: 'kot:new', handler: (p) => handlersRef.current.onKOTNew?.(p.payload) },
      { name: 'kot:item-added', handler: (p) => handlersRef.current.onKOTItemAdded?.(p.payload) },
      { name: 'item:status', handler: (p) => handlersRef.current.onItemStatus?.(p.payload) },
      { name: 'order:status', handler: (p) => handlersRef.current.onOrderStatus?.(p.payload) },
      { name: 'table:released', handler: (p) => handlersRef.current.onTableReleased?.(p.payload) },
      { name: 'table:occupied', handler: (p) => handlersRef.current.onTableOccupied?.(p.payload) },
      { name: 'data:refresh', handler: (p) => handlersRef.current.onDataRefresh?.(p.payload) },
    ]

    events.forEach(({ name, handler }) => {
      channel.on('broadcast', { event: name }, (msg: any) => handler(msg))
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        setOnlineCount(Object.keys(state).length)
        setSyncMode(prev => prev === 'offline' ? 'both' : 'online')
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ role, online_at: new Date().toISOString() })
        }
      })

    supabaseChannelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      supabaseChannelRef.current = null
    }
  }, [role, currentShop?.id])

  // ─── Send via BOTH channels ───
  const sendKOT = useCallback((p: KOTPayload) => {
    socketRef.current?.emit('kot:new', p)
    supabaseChannelRef.current?.send({ type: 'broadcast', event: 'kot:new', payload: p })
    try { syncQueue.add('kot:new', p) } catch {}
  }, [])
  const sendItemAdded = useCallback((p: KOTPayload) => {
    socketRef.current?.emit('kot:item-added', p)
    supabaseChannelRef.current?.send({ type: 'broadcast', event: 'kot:item-added', payload: p })
    try { syncQueue.add('kot:item-added', p) } catch {}
  }, [])
  const sendItemStatus = useCallback((p: ItemStatusPayload) => {
    socketRef.current?.emit('item:status', p)
    supabaseChannelRef.current?.send({ type: 'broadcast', event: 'item:status', payload: p })
    try { syncQueue.add('item:status', p) } catch {}
  }, [])
  const sendOrderStatus = useCallback((p: OrderStatusPayload) => {
    socketRef.current?.emit('order:status', p)
    supabaseChannelRef.current?.send({ type: 'broadcast', event: 'order:status', payload: p })
    try { syncQueue.add('order:status', p) } catch {}
  }, [])
  const sendTableReleased = useCallback((p: TablePayload) => {
    socketRef.current?.emit('table:released', p)
    supabaseChannelRef.current?.send({ type: 'broadcast', event: 'table:released', payload: p })
    try { syncQueue.add('table:released', p) } catch {}
  }, [])
  const sendTableOccupied = useCallback((p: TablePayload) => {
    socketRef.current?.emit('table:occupied', p)
    supabaseChannelRef.current?.send({ type: 'broadcast', event: 'table:occupied', payload: p })
    try { syncQueue.add('table:occupied', p) } catch {}
  }, [])
  const requestDataRefresh = useCallback((p?: unknown) => {
    socketRef.current?.emit('data:refresh', p || {})
    supabaseChannelRef.current?.send({ type: 'broadcast', event: 'data:refresh', payload: p || {} })
  }, [])

  return {
    connected,
    onlineCount,
    syncMode, // 'offline' | 'online' | 'both' | 'none'
    sendKOT,
    sendItemAdded,
    sendItemStatus,
    sendOrderStatus,
    sendTableReleased,
    sendTableOccupied,
    requestDataRefresh,
  }
}
