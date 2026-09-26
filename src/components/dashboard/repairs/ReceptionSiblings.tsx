'use client'

import { useEffect, useState } from 'react'
import { Boxes, ArrowUpRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

/**
 * Los demás equipos que el cliente dejó en la misma visita.
 *
 * El formulario ya permitía cargar varios equipos y creaba una orden por cada
 * uno, pero después quedaban sueltas: nada decía que habían llegado juntas. Con
 * `reception_id` se puede volver a atarlas, que es lo que necesita quien atiende
 * cuando el cliente pregunta «¿y los otros dos?».
 *
 * No se muestra nada cuando el equipo vino solo, que es la mayoría de los casos.
 */

type Hermana = {
  id: string
  ticket_number: string | null
  device_brand: string | null
  device_model: string | null
  status: string | null
}

type Props = {
  receptionId?: string | null
  /** La orden que se está viendo: no se lista a sí misma. */
  currentRepairId: string
  onOpenRepair?: (repairId: string) => void
  className?: string
}

export function ReceptionSiblings({ receptionId, currentRepairId, onOpenRepair, className }: Props) {
  const [hermanas, setHermanas] = useState<Hermana[]>([])
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    if (!receptionId) {
      setHermanas([])
      return
    }

    let vigente = true
    setCargando(true)

    void (async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('repairs')
          .select('id, ticket_number, device_brand, device_model, status')
          .eq('reception_id', receptionId)
          .order('created_at', { ascending: true })

        if (!vigente) return
        setHermanas((data ?? []).filter((r) => r.id !== currentRepairId) as Hermana[])
      } catch {
        // Sin conexión se sigue sin el bloque: es contexto, no un dato de la orden.
        if (vigente) setHermanas([])
      } finally {
        if (vigente) setCargando(false)
      }
    })()

    return () => { vigente = false }
  }, [receptionId, currentRepairId])

  if (!receptionId || cargando || hermanas.length === 0) return null

  return (
    <div
      className={cn(
        'rounded-xl border border-indigo-200/70 bg-indigo-50/50 p-3 dark:border-indigo-900/50 dark:bg-indigo-950/20',
        className
      )}
    >
      <div className="flex items-center gap-2">
        <Boxes className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
        <p className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
          Entró con {hermanas.length} equipo{hermanas.length === 1 ? '' : 's'} más en la misma recepción
        </p>
      </div>

      <ul className="mt-2 space-y-1">
        {hermanas.map((hermana) => {
          const equipo = [hermana.device_brand, hermana.device_model].filter(Boolean).join(' ') || 'Equipo sin detallar'
          const ticket = hermana.ticket_number || hermana.id.slice(0, 8).toUpperCase()

          return (
            <li key={hermana.id}>
              <button
                type="button"
                onClick={() => onOpenRepair?.(hermana.id)}
                disabled={!onOpenRepair}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-[11px] transition-colors',
                  onOpenRepair
                    ? 'hover:bg-indigo-100/70 dark:hover:bg-indigo-900/40'
                    : 'cursor-default'
                )}
              >
                <span className="font-mono font-bold text-indigo-700 dark:text-indigo-300">{ticket}</span>
                <span className="min-w-0 flex-1 truncate text-indigo-900/80 dark:text-indigo-200/80">{equipo}</span>
                {hermana.status && (
                  <span className="shrink-0 rounded-full bg-white/70 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                    {hermana.status}
                  </span>
                )}
                {onOpenRepair && <ArrowUpRight className="h-3 w-3 shrink-0 text-indigo-500" />}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
