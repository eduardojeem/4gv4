'use client'

import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { AlertTriangle, Loader2 } from 'lucide-react'

import { formatCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'

export type OpenCashSession = {
  id: string
  registerName: string
  openingBalance: number
  openedAt: string
}

/**
 * Selector de sesión de caja abierta para una sucursal. Reemplaza el pedido de
 * pegar un UUID a mano: lista las cajas realmente abiertas ahora mismo y deja
 * elegir por nombre y hora de apertura.
 */
export function CashSessionSelect({
  organizationId,
  branchId,
  value,
  onChange,
  name,
  id,
  onSessionsLoaded,
  refreshKey,
}: {
  organizationId: string
  branchId: string | null | undefined
  value: string
  onChange: (sessionId: string) => void
  name?: string
  id?: string
  /** Se llama con la lista cargada, para que el formulario pueda bloquear el envío si no hay ninguna. */
  onSessionsLoaded?: (sessions: OpenCashSession[]) => void
  /** Cambiar este valor fuerza una recarga aunque organización/sucursal sean las mismas
   *  (ej. el diálogo que lo contiene queda montado y se reabre para otro registro). */
  refreshKey?: string | number | null
}) {
  const [sessions, setSessions] = useState<OpenCashSession[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!branchId) {
      setSessions([])
      onSessionsLoaded?.([])
      return
    }
    let cancelled = false
    setIsLoading(true)
    setError(null)
    fetch(`/api/admin/finances/cash-sessions?organizationId=${organizationId}&branchId=${branchId}`, { cache: 'no-store' })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as { sessions?: OpenCashSession[]; error?: string } | null
        if (cancelled) return
        if (!response.ok) {
          setError(payload?.error ?? 'No se pudieron cargar las cajas abiertas.')
          setSessions([])
          onSessionsLoaded?.([])
          return
        }
        const list = payload?.sessions ?? []
        setSessions(list)
        onSessionsLoaded?.(list)
      })
      .catch(() => {
        if (cancelled) return
        setError('No se pudieron cargar las cajas abiertas.')
        setSessions([])
        onSessionsLoaded?.([])
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, branchId, refreshKey])

  // Si la sesión seleccionada deja de estar disponible (se cerró mientras el
  // diálogo estaba abierto), limpiamos la selección en vez de dejar un valor fantasma.
  useEffect(() => {
    if (value && sessions.length > 0 && !sessions.some((session) => session.id === value)) {
      onChange('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions])

  if (isLoading) {
    return (
      <div className="flex h-9 items-center gap-2 rounded-md border border-input bg-muted/40 px-3 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Buscando cajas abiertas…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <span>{error}</span>
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <span>No hay ninguna caja abierta en esta sucursal. Abrí una caja en el POS antes de continuar.</span>
      </div>
    )
  }

  return (
    <select
      id={id}
      name={name}
      aria-label="Sesión de caja"
      required
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        'h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs',
        'focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring font-medium',
      )}
    >
      <option value="" disabled>
        Selecciona la caja abierta…
      </option>
      {sessions.map((session) => {
        const openedAtLabel = (() => {
          const parsed = parseISO(session.openedAt)
          return Number.isNaN(parsed.getTime()) ? session.openedAt : format(parsed, "dd/MM HH:mm'h'")
        })()
        return (
          <option key={session.id} value={session.id}>
            {session.registerName} · abierta {openedAtLabel} · saldo inicial {formatCurrency(session.openingBalance)}
          </option>
        )
      })}
    </select>
  )
}
