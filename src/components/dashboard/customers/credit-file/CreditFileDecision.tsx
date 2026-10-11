import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { CreditFileDTO } from '@/lib/credits/credit-file-contract'
import { CreditField, CreditSection } from './fields'
export function CreditFileDecision({ file, disabled, onDecide }: { file: CreditFileDTO; disabled: boolean; onDecide: (status: string, reason: string, limit?: number) => Promise<void> }) {
  const [reason, setReason] = useState('')
  const [limit, setLimit] = useState('')
  return <CreditSection title="3. Evaluación manual">
    <p className="text-sm text-muted-foreground">Guardar no aprueba. Aprobar actualiza el límite autorizado sin borrar deuda ni pagos. Los ingresos no generan una evaluación automática.</p>
    <CreditField label="Motivo de la decisión" maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} />
    <CreditField label="Límite autorizado propuesto" type="number" inputMode="decimal" min="0" max="9999999999.99" step="0.01" value={limit} onChange={event => setLimit(event.target.value)} />
    <div className="flex flex-wrap gap-2">
      <Button type="button" disabled={disabled || !reason.trim()} variant="outline" onClick={() => void onDecide('pending', reason)}>Solicitar revisión</Button>
      <Button type="button" disabled={disabled || !reason.trim() || !limit || !Number.isFinite(Number(limit)) || Number(limit) < 0 || Number(limit) > 9999999999.99} onClick={() => void onDecide('approved', reason, Number(limit))}>Aprobar crédito</Button>
      <Button type="button" disabled={disabled || !reason.trim()} variant="outline" onClick={() => void onDecide('rejected', reason)}>Rechazar</Button>
      <Button type="button" disabled={disabled || !reason.trim()} variant="outline" onClick={() => void onDecide('suspended', reason)}>Suspender</Button>
    </div>
    {file.lastDecision && <p className="break-words text-sm">Última decisión: {file.lastDecision.reason} · {new Date(file.lastDecision.at).toLocaleString('es-PY')}</p>}
  </CreditSection>
}
