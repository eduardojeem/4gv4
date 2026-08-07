'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { config } from '@/lib/config'

export type GlobalNotificationItem = {
  id: string
  title: string
  body: string
  type: 'info' | 'warning' | 'success' | 'danger'
  read: boolean
  timestamp: string
}

const REFRESH_MS = 5 * 60 * 1000

// Notificaciones globales enviadas por el superadmin a la organización.
// Estado de lectura/descarte persistido por usuario en el backend.
export function useGlobalNotifications(enabled: boolean = true) {
  const [items, setItems] = useState<GlobalNotificationItem[]>([])
  // Firma del último resultado: si el poll de 5 min trae exactamente lo
  // mismo (caso normal, nada nuevo), no vuelve a llamar setItems — evita
  // re-renderizar el header (y todo lo que dependa de él) sin motivo.
  const lastSignatureRef = useRef<string>('')

  const fetchItems = useCallback(async () => {
    if (!enabled || !config.supabase.isConfigured) return
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' })
      if (!res.ok) return
      const json = await res.json() as { data?: GlobalNotificationItem[] }
      const nextItems = json.data ?? []
      const signature = nextItems.map(i => `${i.id}:${i.read}`).join(',')
      if (signature === lastSignatureRef.current) return
      lastSignatureRef.current = signature
      setItems(nextItems)
    } catch {
      /* silencioso: no es crítico para el dashboard */
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    fetchItems()
    const interval = setInterval(fetchItems, REFRESH_MS)
    return () => clearInterval(interval)
  }, [enabled, fetchItems])

  const post = useCallback(async (payload: Record<string, unknown>) => {
    try {
      await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } catch {
      /* optimista: el estado local ya se actualizó */
    }
  }, [])

  // Las mutaciones locales también actualizan la firma: si no, el próximo
  // poll comparaba contra una firma vieja (de antes del cambio local) y
  // volvía a llamar setItems con el mismo contenido que ya se tenía.
  const syncSignature = (next: GlobalNotificationItem[]) => {
    lastSignatureRef.current = next.map(i => `${i.id}:${i.read}`).join(',')
    return next
  }

  const markAsRead = useCallback((id: string) => {
    setItems(prev => syncSignature(prev.map(n => (n.id === id ? { ...n, read: true } : n))))
    void post({ id })
  }, [post])

  const markAllAsRead = useCallback(() => {
    setItems(prev => syncSignature(prev.map(n => ({ ...n, read: true }))))
    void post({ all: true })
  }, [post])

  const dismiss = useCallback((id: string) => {
    setItems(prev => syncSignature(prev.filter(n => n.id !== id)))
    void post({ id, dismiss: true })
  }, [post])

  return { items, markAsRead, markAllAsRead, dismiss, refresh: fetchItems }
}
