'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ExternalLink, ShieldAlert, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'
import { STATUS_META, type CaseStatus } from '@/components/dashboard/after-sales/after-sales-meta'

interface CaseRow {
  id: string
  case_number: string | null
  status: CaseStatus
  generated_repair_id: string | null
  generated_repair?: { ticket_number: string | null } | null
}

/**
 * Estado del reclamo de garantia dentro de la reparacion.
 *
 * Sin esto, reclamar garantia no dejaba ninguna huella visible en la
 * reparacion: el caso existia en Posventa pero desde el taller parecia que no
 * habia pasado nada, y no habia forma de llegar a aprobarlo.
 */
export function RepairWarrantyCase({
  repairId,
  onClaim,
}: {
  repairId: string
  onClaim: () => void
}) {
  const [activeCase, setActiveCase] = useState<CaseRow | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/after-sales?repair_id=${repairId}&limit=5`)
      if (!response.ok) return
      const payload = await response.json().catch(() => null)
      if (!payload?.success) return

      const rows = (payload.data ?? []) as CaseRow[]
      // El caso vigente manda; si todos estan cerrados se muestra el ultimo
      // para dejar constancia de que ya hubo un reclamo.
      setActiveCase(rows.find((row) => row.status === 'open' || row.status === 'approved') ?? rows[0] ?? null)
    } catch {
      // El reclamo es informacion accesoria: si falla, la reparacion se ve igual.
    } finally {
      setLoading(false)
    }
  }, [repairId])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) return null

  if (!activeCase) {
    return (
      <Button variant="outline" size="sm" className="w-full bg-background mt-1" onClick={onClaim}>
        <ShieldAlert className="h-3.5 w-3.5 mr-1.5" />
        Reclamar garantía
      </Button>
    )
  }

  const meta = STATUS_META[activeCase.status] ?? STATUS_META.open
  const isClosed = ['rejected', 'completed', 'cancelled'].includes(activeCase.status)
  const generatedTicket = activeCase.generated_repair?.ticket_number

  return (
    <div className="mt-1 space-y-2 rounded-lg border bg-background p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium">
          Reclamo {activeCase.case_number || activeCase.id.slice(0, 8)}
        </span>
        <Badge variant="outline" className={cn('text-[10px]', meta.className)}>
          {meta.label}
        </Badge>
      </div>

      {generatedTicket && (
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Wrench className="h-3 w-3 shrink-0" />
          Retrabajo <span className="font-medium text-foreground">{generatedTicket}</span>
        </p>
      )}

      <Button asChild variant="outline" size="sm" className="h-7 w-full text-[11px]">
        <Link href="/dashboard/after-sales">
          <ExternalLink className="h-3 w-3 mr-1" />
          {activeCase.status === 'open' ? 'Aprobar en Posventa' : 'Ver en Posventa'}
        </Link>
      </Button>

      {isClosed && (
        <Button variant="ghost" size="sm" className="h-7 w-full text-[11px]" onClick={onClaim}>
          Abrir un reclamo nuevo
        </Button>
      )}
    </div>
  )
}
