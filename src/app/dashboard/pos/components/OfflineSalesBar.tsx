'use client'

import { useState } from 'react'
import { AlertTriangle, CloudOff, Loader2, RefreshCw, Trash2, Wifi } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatCurrency } from '@/lib/currency'
import type { OutboxSale } from '@/lib/pos-offline/outbox'

/**
 * Aviso del POS cuando no hay internet o quedan ventas guardadas en el equipo.
 * No se muestra nada si hay conexión y la cola está vacía.
 */
export function OfflineSalesBar({
  online,
  outbox,
  pending,
  failed,
  syncing,
  onSync,
  onRetry,
  onDiscard,
}: {
  online: boolean
  outbox: OutboxSale[]
  pending: number
  failed: number
  syncing: boolean
  onSync: () => void
  onRetry: (id: string) => void
  onDiscard: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  if (online && outbox.length === 0) return null

  const tone = !online
    ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100'
    : failed > 0
      ? 'border-red-300 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100'
      : 'border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-100'

  return (
    <>
      <div role="status" className={`flex flex-wrap items-center justify-between gap-2 border-b px-4 py-1.5 text-sm ${tone}`}>
        <span className="flex items-center gap-2">
          {online ? <Wifi className="h-4 w-4" /> : <CloudOff className="h-4 w-4" />}
          {!online
            ? <>Sin conexión: podés seguir vendiendo en efectivo, tarjeta o transferencia. Las ventas se guardan en este equipo{pending ? ` (${pending} pendiente${pending === 1 ? '' : 's'})` : ''}. <b>No recargues la página.</b></>
            : <>{pending > 0 && <>{pending} venta{pending === 1 ? '' : 's'} guardada{pending === 1 ? '' : 's'} sin conexión por enviar. </>}{failed > 0 && <b>{failed} con problema{failed === 1 ? '' : 's'}.</b>}</>}
        </span>
        <span className="flex items-center gap-1.5">
          {outbox.length > 0 && <Button size="sm" variant="ghost" className="h-7" onClick={() => setOpen(true)}>Ver</Button>}
          {online && pending > 0 && (
            <Button size="sm" variant="outline" className="h-7 bg-background" onClick={onSync} disabled={syncing}>
              {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Enviar ahora
            </Button>
          )}
        </span>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Ventas guardadas en este equipo</DialogTitle>
            <DialogDescription>
              Se hicieron sin conexión y se envían solas cuando vuelve internet, en orden. Si el servidor rechaza una (por ejemplo, la caja ya estaba cerrada), queda acá para revisarla.
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-80 divide-y overflow-auto rounded-lg border text-sm">
            {outbox.map((sale) => (
              <li key={sale.id} className="space-y-1 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{formatCurrency(sale.total)} · {sale.itemCount} unidad{sale.itemCount === 1 ? '' : 'es'}</p>
                    <p className="truncate text-xs text-muted-foreground">{sale.summary || 'Venta'} · {new Date(sale.createdAt).toLocaleString('es-PY', { dateStyle: 'short', timeStyle: 'short' })}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${sale.status === 'error' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                    {sale.status === 'error' ? 'Rechazada' : 'Pendiente'}
                  </span>
                </div>
                {sale.lastError && <p className="flex items-start gap-1 text-xs text-red-700 dark:text-red-300"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {sale.lastError}</p>}
                {sale.status === 'error' && (
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" className="h-7" onClick={() => onRetry(sale.id)} disabled={!online || syncing}>
                      <RefreshCw className="h-3.5 w-3.5" /> Reintentar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-red-600"
                      onClick={() => {
                        if (window.confirm('¿Descartar esta venta? No se va a registrar: si la cobraste, cargala de nuevo a mano.')) onDiscard(sale.id)
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Descartar
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  )
}
