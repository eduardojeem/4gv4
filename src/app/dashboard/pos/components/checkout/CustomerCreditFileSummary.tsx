'use client'
import { useEffect, useState } from 'react'
import type { CreditFileSummary } from '@/lib/credits/credit-file-contract'
import { formatCurrency } from '@/lib/currency'
import { Button } from '@/components/ui/button'
const labels = { draft: 'Borrador', pending: 'Pendiente de revisión', approved: 'Aprobado', rejected: 'Rechazado', suspended: 'Suspendido' }
const missingLabels: Record<string,string> = { file: 'Crear ficha', approval: 'Aprobación manual', identity: 'Identificación', references: 'Referencias verificadas', 'document:identity': 'Documento de identidad', 'document:address': 'Comprobante de domicilio', 'document:income': 'Comprobante de ingresos', 'document:other': 'Otro documento verificado' }
export function CreditFilePaymentSummary({ customerId, mixed, method, splits, formatAmount }: { customerId?: string; mixed: boolean; method: string; splits: readonly { method: string }[]; formatAmount: (amount: number) => string }) {
  if (!customerId || !(mixed ? splits.some(payment => payment.method === 'credit') : method === 'credit')) return null
  return <CustomerCreditFileSummary customerId={customerId} formatAmount={formatAmount} />
}
export function CustomerCreditFileSummary({ customerId, formatAmount = formatCurrency }: { customerId: string; formatAmount?: (amount: number) => string }) {
  const [state, setState] = useState<{ customerId: string; summary: CreditFileSummary | null; error: string | null }>({ customerId, summary: null, error: null })
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setState({ customerId, summary: null, error: null })
    void (async () => {
      try {
        const response = await fetch(`/api/customers/${encodeURIComponent(customerId)}/credit-file/summary`, { cache: 'no-store', signal: controller.signal })
        const result = await response.json()
        if (!response.ok || !result.summary) throw new Error(result.error || 'No se pudo cargar el resumen de crédito.')
        if (!controller.signal.aborted) setState({ customerId, summary: result.summary, error: null })
      } catch (cause) {
        if (!controller.signal.aborted) setState({ customerId, summary: null, error: cause instanceof Error ? cause.message : 'No se pudo cargar el resumen.' })
      }
    })()
    return () => controller.abort()
  }, [customerId, revision])
  const summary = state.customerId === customerId ? state.summary : null
  const error = state.customerId === customerId ? state.error : null
  return <section className="min-w-0 space-y-3 rounded-lg border bg-card p-4" aria-label="Resumen de ficha para crédito">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">Ficha para crédito</h3><a className="text-sm underline underline-offset-4" href={`/dashboard/customers?id=${encodeURIComponent(customerId)}`}>Ver cliente</a></div>
    {error ? <><p role="alert" className="text-sm">{error} No se puede confirmar la aprobación desde este resumen.</p><Button type="button" variant="outline" onClick={() => setRevision(value => value + 1)}>Reintentar resumen</Button></> : !summary ? <p role="status" className="text-sm text-muted-foreground">Cargando resumen…</p> : <>
      <p className="text-sm">{summary.status ? labels[summary.status] : 'Sin ficha: no significa aprobado'}</p>
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">{[['Límite', formatAmount(summary.limit)], ['Deuda', formatAmount(summary.outstanding)], ['Disponible', formatAmount(summary.available)], ['Cuotas vencidas', String(summary.overdueCount)]].map(([label,value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="break-words font-semibold">{value}</dd></div>)}</dl>
      {!summary.eligible && <p className="text-sm">{summary.mode === 'required' ? 'Requiere aprobación y requisitos completos para nuevos créditos.' : summary.mode === 'warning' ? 'Advertencia: hay requisitos pendientes.' : 'Informativo: hay revisión pendiente.'} {summary.missing.map(code => missingLabels[code] ?? 'Revisar ficha').join(' · ')}</p>}
      <p className="text-xs text-muted-foreground">El servidor verifica nuevamente el cupo y los requisitos al confirmar. Este resumen no modifica deudas ni bloquea cobros de cuotas.</p>
    </>}
  </section>
}
