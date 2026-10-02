import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { OUTBOX_EVENT, listOutbox, removeFromOutbox, updateOutbox, type OutboxSale } from '@/lib/pos-offline/outbox'
import { syncOutbox } from '@/lib/pos-offline/sync'

const RETRY_EVERY_MS = 30_000

/**
 * Estado de la conexión y de las ventas guardadas sin internet. Manda la cola
 * sola al volver la conexión, al abrir el POS y cada 30 s mientras quede algo.
 */
export function useOfflineSales({ onSynced }: { onSynced?: () => void } = {}) {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  const [outbox, setOutbox] = useState<OutboxSale[]>([])
  const [syncing, setSyncing] = useState(false)
  const onSyncedRef = useRef(onSynced)
  useEffect(() => { onSyncedRef.current = onSynced })

  const refresh = useCallback(async () => {
    try {
      setOutbox(await listOutbox())
    } catch {
      // Sin IndexedDB no hay cola que mostrar.
    }
  }, [])

  const sync = useCallback(async (manual = false) => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      if (manual) toast.error('Todavía no hay conexión')
      return
    }
    setSyncing(true)
    try {
      const result = await syncOutbox()
      if (result.sent > 0) {
        toast.success(`${result.sent} venta${result.sent === 1 ? '' : 's'} sin conexión enviada${result.sent === 1 ? '' : 's'}`)
        onSyncedRef.current?.()
      }
      if (result.failed > 0) toast.error(`${result.failed} venta${result.failed === 1 ? '' : 's'} sin conexión necesita${result.failed === 1 ? '' : 'n'} revisión`)
      if (manual && result.stopped === 'auth') toast.error('La sesión venció: volvé a iniciar sesión para enviar las ventas guardadas.')
      if (manual && result.stopped === 'offline') toast.error('No se pudo conectar con el servidor')
    } finally {
      setSyncing(false)
      await refresh()
    }
  }, [refresh])

  useEffect(() => {
    // La primera lectura va en un callback: no se cambia estado directo en el efecto.
    const initial = window.setTimeout(() => {
      void refresh().then(() => sync())
    }, 0)
    const goOnline = () => {
      setOnline(true)
      void sync()
    }
    const goOffline = () => setOnline(false)
    const changed = () => { void refresh() }
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    window.addEventListener(OUTBOX_EVENT, changed)
    return () => {
      window.clearTimeout(initial)
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
      window.removeEventListener(OUTBOX_EVENT, changed)
    }
  }, [refresh, sync])

  const pending = outbox.filter((sale) => sale.status === 'pending').length

  useEffect(() => {
    if (!pending || !online) return
    const timer = window.setInterval(() => { void sync() }, RETRY_EVERY_MS)
    return () => window.clearInterval(timer)
  }, [pending, online, sync])

  // Sin conexión, recargar la página puede dejar el POS sin abrir: se avisa antes.
  useEffect(() => {
    if (online) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [online])

  const retry = useCallback(async (id: string) => {
    await updateOutbox(id, { status: 'pending', lastError: undefined })
    await sync(true)
  }, [sync])

  const discard = useCallback(async (id: string) => {
    await removeFromOutbox(id)
    await refresh()
  }, [refresh])

  return { online, outbox, pending, failed: outbox.length - pending, syncing, sync: () => sync(true), retry, discard }
}
