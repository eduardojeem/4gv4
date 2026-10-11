import { useState } from 'react'
import type { CreditDocumentType, CreditFilePolicy as Policy } from '@/lib/credits/credit-file-contract'
import { Button } from '@/components/ui/button'
import { CreditSection, selectClass } from './fields'
export function CreditFilePolicy({ policy, disabled, onSave }: { policy: Policy; disabled: boolean; onSave: (value: Policy) => Promise<void> }) {
  const [draft, setDraft] = useState(policy)
  const [confirmRequired, setConfirmRequired] = useState(false)
  return <CreditSection title="Requisitos de la organización">
    <p className="text-sm text-muted-foreground">Se aplican a todos los clientes de esta organización. Exigir puede impedir nuevos créditos hasta completar la ficha; no bloquea cobros ni modifica deudas existentes.</p>
    <label className="grid gap-1.5 text-sm">Modo de control<select className={selectClass} value={draft.mode} onChange={event => { setDraft({ ...draft, mode: event.target.value as Policy['mode'] }); setConfirmRequired(false) }}><option value="informational">Informativo</option><option value="warning">Advertir</option><option value="required">Exigir aprobación y requisitos</option></select></label>
    <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={draft.requireIdentity} onChange={event => setDraft({ ...draft, requireIdentity: event.target.checked })} />Exigir número de identificación</label>
    <label className="grid gap-1.5 text-sm">Referencias verificadas requeridas<select className={selectClass} value={draft.minVerifiedReferences} onChange={event => setDraft({ ...draft, minVerifiedReferences: Number(event.target.value) })}>{[0,1,2,3,4,5].map(count => <option key={count} value={count}>{count}</option>)}</select></label>
    <div className="grid gap-2 sm:grid-cols-2">{(['identity','address','income','other'] as CreditDocumentType[]).map((type, i) => <label key={type} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={draft.requiredDocuments.includes(type)} onChange={event => setDraft({ ...draft, requiredDocuments: event.target.checked ? [...draft.requiredDocuments, type] : draft.requiredDocuments.filter(item => item !== type) })} />Documento verificado: {['identidad','domicilio','ingresos','otro'][i]}</label>)}</div>
    {draft.mode === 'required' && policy.mode !== 'required' && <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={confirmRequired} onChange={event => setConfirmRequired(event.target.checked)} />Entiendo que se bloquearán nuevos créditos con fichas incompletas.</label>}
    <Button type="button" variant="outline" disabled={disabled || (draft.mode === 'required' && policy.mode !== 'required' && !confirmRequired)} onClick={() => void onSave(draft)}>Guardar requisitos</Button>
  </CreditSection>
}
