'use client'
import { useState } from 'react'
import { useOptionalActiveOrganization } from '@/contexts/ActiveOrganizationContext'
import { usePermissions } from '@/hooks/use-permissions'
import { useCustomerCreditFile } from '@/hooks/use-customer-credit-file'
import { CreditFileInputSchema, evaluateCreditFile, type CreditFileDTO, type CreditFileInput } from '@/lib/credits/credit-file-contract'
import { Button } from '@/components/ui/button'
import { CreditField, CreditSection, selectClass } from './fields'
import { CreditFileReferences } from './CreditFileReferences'
import { CreditFileDocuments } from './CreditFileDocuments'
import { CreditFileDecision } from './CreditFileDecision'
import { CreditFilePolicy } from './CreditFilePolicy'
import { CustomerCreditFileSummary } from '@/app/dashboard/pos/components/checkout/CustomerCreditFileSummary'

const statusLabel = { draft: 'Borrador', pending: 'Pendiente de revisión', approved: 'Aprobado', rejected: 'Rechazado', suspended: 'Suspendido' }
function editable(file: CreditFileDTO | null): CreditFileInput {
  return { version: file?.version ?? 0, identity: file?.identity ?? { type: 'ci', number: '' }, occupation: file?.occupation ?? '', company: file?.company ?? '', position: file?.position ?? '', declaredMonthlyIncome: file?.declaredMonthlyIncome ?? null, informedCustomer: Boolean(file?.informedCustomerAt), references: file?.references.map(({ id, name, relationship, phone, verificationStatus, comment }) => ({ id, name, relationship, phone, verificationStatus, comment })) ?? [] }
}
export function CustomerCreditFile(props: { customerId: string; onCustomerUpdated: () => void; existingRuc?: string }) {
  const organization = useOptionalActiveOrganization()
  const { hasPermission } = usePermissions()
  const role = organization?.organization?.role ?? ''
  if (!['owner','admin','manager'].includes(role) || !hasPermission('crm.customers.read')) return <p className="rounded-lg border p-4 text-sm">Solo propietario, administrador o gerente con acceso a Clientes y Créditos puede consultar esta ficha. El vendedor ve únicamente el resumen operativo en POS.</p>
  return <CreditFileEditor key={`${organization?.organization?.id}:${props.customerId}`} {...props} canManage={hasPermission('crm.customers.manage')} canConfigure={['owner','admin'].includes(role) && hasPermission('settings.manage')} />
}
function CreditFileEditor({ customerId, onCustomerUpdated, existingRuc, canManage, canConfigure }: { customerId: string; onCustomerUpdated: () => void; existingRuc?: string; canManage: boolean; canConfigure: boolean }) {
  const { file, policy, loading, busy, error, reload, action } = useCustomerCreditFile(customerId)
  const [input, setInput] = useState<CreditFileInput>(() => editable(null))
  const [validation, setValidation] = useState('')
  const [notice, setNotice] = useState('')
  const [loadedFile, setLoadedFile] = useState(file)
  const [documentComments, setDocumentComments] = useState<Record<string, string>>({})
  if (file !== loadedFile) {
    setLoadedFile(file)
    setInput(editable(file))
    setValidation('')
  }
  const dirty = JSON.stringify(input) !== JSON.stringify(editable(file))
  const update = (patch: Partial<CreditFileInput>) => { setInput(value => ({ ...value, ...patch })); setNotice('') }
  const save = async () => {
    const parsed = CreditFileInputSchema.safeParse(input)
    if (!parsed.success) { setValidation(parsed.error.issues[0]?.message || 'Revisá los datos.'); return }
    setValidation('')
    if (await action('', 'PUT', parsed.data)) { setNotice('Ficha guardada. Esto no aprueba el crédito.'); onCustomerUpdated() }
  }
  const documentsDirty = file?.documents.some(document => documentComments[document.id] !== undefined && documentComments[document.id] !== document.comment) ?? false
  const reloadExplicit = async () => { if ((!dirty && !documentsDirty) || window.confirm('¿Descartar los cambios sin guardar y recargar la ficha?')) { if (await reload()) setDocumentComments({}) } }
  if (loading && !policy) return <div role="status" className="rounded-lg border p-4">Cargando ficha para crédito…</div>
  return <div className="min-w-0 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Ficha para crédito</h2><Button type="button" variant="outline" disabled={busy} onClick={reloadExplicit}>Recargar ficha</Button></div>
    {(error || validation) && <p role="alert" className="rounded-md border border-destructive/40 p-3 text-sm">{error || validation}</p>}
    {notice && <p role="status" className="rounded-md border p-3 text-sm">{notice}</p>}
    {!policy ? <p className="text-sm text-muted-foreground">La ficha no está disponible. Revisá permisos o migraciones y reintentá.</p> : <>
      <CustomerCreditFileSummary key={`summary:${file?.version ?? 0}:${policy.version}`} customerId={customerId} />
      <CreditSection title="Estado de evaluación"><p>{file ? statusLabel[file.status] : 'Sin ficha: no significa crédito aprobado.'}</p><p className="text-sm text-muted-foreground">Control actual: {policy.mode === 'required' ? 'Exigir' : policy.mode === 'warning' ? 'Advertir' : 'Informativo'}. {evaluateCreditFile(file, policy).eligible ? 'Requisitos completos.' : 'Hay requisitos o aprobación pendientes.'}</p></CreditSection>
      <fieldset disabled={busy || !canManage} className="min-w-0 space-y-4">
        <CreditSection title="Identificación y trabajo">
          <p className="text-sm text-muted-foreground">Estos datos se usan para la evaluación manual del crédito y tienen acceso restringido. Ingresos y trabajo son opcionales.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm">Tipo de identificación<select className={selectClass} value={input.identity.type} onChange={event => update({ identity: { ...input.identity, type: event.target.value as CreditFileInput['identity']['type'] } })}><option value="ci">CI</option><option value="ruc">RUC</option><option value="other">Otro</option></select></label>
            <CreditField label="Número de documento" maxLength={50} value={input.identity.number} onChange={event => update({ identity: { ...input.identity, number: event.target.value } })} />
            <CreditField label="Ocupación" maxLength={200} value={input.occupation} onChange={event => update({ occupation: event.target.value })} />
            <CreditField label="Empresa" maxLength={200} value={input.company} onChange={event => update({ company: event.target.value })} />
            <CreditField label="Cargo" maxLength={120} value={input.position} onChange={event => update({ position: event.target.value })} />
            <CreditField label="Ingreso mensual declarado" type="number" min="0" step="0.01" inputMode="decimal" value={input.declaredMonthlyIncome ?? ''} onChange={event => update({ declaredMonthlyIncome: event.target.value === '' ? null : Number(event.target.value) })} />
          </div>
          {existingRuc && input.identity.number && existingRuc !== input.identity.number && <p className="text-sm">El cliente tiene RUC {existingRuc}. Esta identificación es diferente y no reemplazará sus datos generales.</p>}
          <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={input.informedCustomer} onChange={event => update({ informedCustomer: event.target.checked })} />Informé al cliente sobre la finalidad y el uso restringido de estos datos.</label>
        </CreditSection>
        <CreditFileReferences references={input.references} onChange={references => update({ references })} />
        <Button type="button" className="min-h-11 w-full sm:w-auto" onClick={() => void save()}>Guardar ficha</Button>
        {dirty && <p className="text-sm text-muted-foreground">Guardá los cambios antes de revisar documentos o tomar una decisión.</p>}
        {file && <>
          <CreditFileDocuments customerId={customerId} documents={file.documents} version={file.version} disabled={busy || dirty} action={async (suffix, method, body) => {
            const result = await action(suffix, method, body)
            if (result && ['PATCH', 'DELETE'].includes(method)) {
              const id = suffix.split('/').pop()!
              setDocumentComments(value => { const next = { ...value }; delete next[id]; return next })
            }
            return result
          }} draftComments={documentComments} onCommentChange={(id, comment) => setDocumentComments(value => ({ ...value, [id]: comment }))} />
          <CreditFileDecision file={file} disabled={busy || dirty} onDecide={async (status, reason, limit) => { if (await action('/decision', 'POST', { version: file.version, status, reason, ...(limit !== undefined ? { limit } : {}) })) { setNotice('Decisión registrada. La deuda existente no cambia.'); onCustomerUpdated() } }} />
        </>}
      </fieldset>
      {canConfigure && <CreditFilePolicy key={`policy:${policy.version}`} policy={policy} disabled={busy || dirty} onSave={async value => { if (await action('policy', 'PUT', value)) setNotice('Requisitos de la organización guardados.') }} />}
    </>}
  </div>
}
