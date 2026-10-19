'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { bankTransferSettingsSchema, type BankTransferRequest, type BankTransferSettings, type BankTransferStatus } from '@/lib/saas/bank-transfer-contract'

type RequestRow = BankTransferRequest & { organization_name?: string }
const STATUS_LABELS: Record<BankTransferStatus, string> = {
  awaiting_receipt: 'Esperando comprobante', pending_review: 'Pendiente de revisión', approved: 'Aprobada', rejected: 'Rechazada',
}
const EMPTY_SETTINGS: BankTransferSettings = { enabled: false, bankName: '', accountHolder: '', accountNumber: '', accountAlias: '', currency: 'PYG', instructions: '' }
const money = (amount: number) => new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', maximumFractionDigits: 0 }).format(amount)
const date = (value?: string | null) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('es-PY', { timeZone: 'America/Asuncion' }) : '—'
const message = (error: unknown) => error instanceof Error ? error.message : 'No se pudo completar la operación.'

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', ...init })
  const data = await response.json().catch(() => null)
  if (!response.ok || !data) throw new Error(data?.error || 'No se pudo consultar el servidor. Reintentá.')
  return data as T
}

export function SubscriptionTransfers() {
  const [status, setStatus] = useState<BankTransferStatus>('pending_review')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<RequestRow[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [selected, setSelected] = useState<RequestRow | null>(null)
  const [settings, setSettings] = useState<BankTransferSettings>(EMPTY_SETTINGS)
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [settingsReady, setSettingsReady] = useState(false)
  const [settingsError, setSettingsError] = useState<string | null>(null)
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsAttempt, setSettingsAttempt] = useState(0)
  const [verified, setVerified] = useState(false)
  const [bankReference, setBankReference] = useState('')
  const [reason, setReason] = useState('')
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [reviewResult, setReviewResult] = useState<string | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const reviewLock = useRef(false)
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null)
  const [receiptLoading, setReceiptLoading] = useState(false)
  const [receiptError, setReceiptError] = useState<string | null>(null)
  const receiptAbort = useRef<AbortController | null>(null)
  const detailRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setListError(null)
    requestJson<{ requests: RequestRow[]; hasMore: boolean }>(`/api/superadmin/subscription-transfers?status=${status}&page=${page}`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) { setRows(data.requests); setHasMore(data.hasMore) } })
      .catch(error => { if (!controller.signal.aborted) setListError(message(error)) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [status, page, refresh])

  useEffect(() => {
    const controller = new AbortController()
    setSettingsLoading(true); setSettingsError(null)
    requestJson<{ settings: BankTransferSettings }>('/api/superadmin/subscription-transfer-settings', { signal: controller.signal })
      .then(data => {
        if (controller.signal.aborted) return
        const s = data.settings
        setSettings({ enabled: s.enabled, bankName: s.bankName, accountHolder: s.accountHolder, accountNumber: s.accountNumber, accountAlias: s.accountAlias, currency: 'PYG', instructions: s.instructions })
        setSettingsReady(true)
      })
      .catch(error => { if (!controller.signal.aborted) setSettingsError(message(error)) })
      .finally(() => { if (!controller.signal.aborted) setSettingsLoading(false) })
    return () => controller.abort()
  }, [settingsAttempt])

  useEffect(() => () => { receiptAbort.current?.abort() }, [])

  const selectRequest = (row: RequestRow) => {
    receiptAbort.current?.abort()
    setSelected(row); setVerified(false); setBankReference(''); setReason('')
    setReviewError(null); setReviewResult(null); setReceiptUrl(null); setReceiptError(null); setReceiptLoading(false)
    requestAnimationFrame(() => detailRef.current?.focus())
  }

  const loadReceipt = useCallback(async () => {
    if (!selected || receiptLoading) return
    receiptAbort.current?.abort()
    const controller = new AbortController(); receiptAbort.current = controller
    setReceiptLoading(true); setReceiptError(null); setReceiptUrl(null)
    try {
      const data = await requestJson<{ url: string }>(`/api/superadmin/subscription-transfers/${selected.id}/receipt`, { signal: controller.signal })
      const url = new URL(data.url)
      if (!['https:', 'http:'].includes(url.protocol)) throw new Error('El enlace al comprobante no es válido.')
      if (!controller.signal.aborted) setReceiptUrl(url.href)
    } catch (error) { if (!controller.signal.aborted) setReceiptError(message(error)) }
    finally { if (!controller.signal.aborted) setReceiptLoading(false) }
  }, [selected, receiptLoading])

  const review = async (decision: 'approve' | 'reject') => {
    if (!selected || reviewLock.current) return
    if (selected.status !== 'pending_review' && !(decision === 'reject' && selected.status === 'awaiting_receipt')) return
    if (decision === 'approve' && (!verified || !bankReference.trim())) return
    if (decision === 'reject' && !reason.trim()) return
    const prompt = decision === 'approve'
      ? `¿Confirmás la acreditación de ${money(selected.amount)} con referencia bancaria ${bankReference.trim()}? Se activará el período de suscripción.`
      : '¿Rechazar esta solicitud? El rechazo es definitivo; el cliente deberá crear otra solicitud.'
    if (!window.confirm(prompt)) return
    reviewLock.current = true; setReviewing(true); setReviewError(null); setReviewResult(null)
    try {
      const body = decision === 'approve' ? { decision, bankOperationReference: bankReference.trim() } : { decision, reason: reason.trim() }
      const result = await requestJson<{ request: BankTransferRequest; applied: boolean }>(`/api/superadmin/subscription-transfers/${selected.id}/review`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      setSelected({ ...selected, ...result.request })
      setReviewResult(decision === 'reject' ? 'Solicitud rechazada.' : result.applied ? 'Transferencia aprobada y período activado.' : 'La solicitud ya estaba resuelta. No se volvió a aplicar el período.')
      setRefresh(value => value + 1)
    } catch (error) { setReviewError(message(error)) }
    finally { reviewLock.current = false; setReviewing(false) }
  }

  const saveSettings = async (event: React.FormEvent) => {
    event.preventDefault()
    if (savingSettings || settingsLoading || !settingsReady) return
    setSettingsError(null); setSettingsSaved(false)
    const parsed = bankTransferSettingsSchema.safeParse(settings)
    if (!parsed.success) { setSettingsError(parsed.error.issues[0]?.message || 'Revisá los datos bancarios.'); return }
    setSavingSettings(true)
    try {
      await requestJson('/api/superadmin/subscription-transfer-settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed.data) })
      setSettingsSaved(true)
    } catch (error) { setSettingsError(message(error)) }
    finally { setSavingSettings(false) }
  }

  return <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
    <header><h1 className="text-2xl font-bold">Transferencias de suscripción</h1><p className="mt-2 text-sm text-muted-foreground">Verificá la acreditación en la cuenta bancaria antes de aprobar. Un comprobante por sí solo no acredita el pago.</p></header>
    <section aria-label="Solicitudes de transferencia" className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1"><Label htmlFor="transfer-status">Estado de solicitud</Label><select id="transfer-status" value={status} disabled={reviewing} onChange={event => { setStatus(event.target.value as BankTransferStatus); setPage(1); setSelected(null) }} className="min-h-10 rounded-md border bg-background px-3 text-sm">{Object.entries(STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
        <Button variant="outline" onClick={() => setRefresh(value => value + 1)} disabled={loading || reviewing}>Actualizar solicitudes</Button>
        <span className="text-sm text-muted-foreground">Página {page} · hasta 25 solicitudes</span>
      </div>
      {listError && <div role="alert" className="rounded-lg border border-destructive p-3 text-sm text-destructive">{listError} <Button variant="outline" onClick={() => setRefresh(value => value + 1)}>Reintentar solicitudes</Button></div>}
      {loading ? <p role="status">Cargando solicitudes…</p> : !listError && (rows.length ? <div className="grid gap-3 md:grid-cols-2">{rows.map(row => <article key={row.id} className="space-y-2 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{row.reference}</h2><span className="text-xs text-muted-foreground">{STATUS_LABELS[row.status]}</span></div>
        <p>{row.organization_name || row.organization_id}</p><p className="text-sm">{row.plan_name} · {money(row.amount)}</p><p className="text-xs text-muted-foreground">Solicitada: {date(row.created_at)}</p>
        <Button variant="outline" disabled={reviewing} onClick={() => selectRequest(row)} aria-label={`Ver detalle ${row.reference}`}>Ver detalle</Button>
      </article>)}</div> : <p className="rounded-lg border p-5 text-sm text-muted-foreground">No hay solicitudes en este estado.</p>)}
      <div className="flex items-center justify-between gap-3"><Button variant="outline" disabled={page === 1 || loading || reviewing} onClick={() => { setPage(value => value - 1); setSelected(null) }}>Anterior</Button><Button variant="outline" disabled={!hasMore || loading || reviewing || Boolean(listError)} onClick={() => { setPage(value => value + 1); setSelected(null) }}>Siguiente</Button></div>
    </section>

    {selected && <section ref={detailRef} tabIndex={-1} aria-label={`Detalle ${selected.reference}`} className="space-y-4 rounded-xl border bg-card p-5 outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">Detalle {selected.reference}</h2><Button variant="outline" disabled={reviewing} onClick={() => { receiptAbort.current?.abort(); setSelected(null) }}>Cerrar detalle</Button></div>
      <p>{selected.organization_name || selected.organization_id} · {selected.plan_name} · <strong>{money(selected.amount)}</strong></p>
      <p className="text-sm">Estado: {STATUS_LABELS[selected.status]} · Revisada: {date(selected.reviewed_at)}</p>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">{([['Banco', selected.bank_snapshot.bankName], ['Titular', selected.bank_snapshot.accountHolder], ['Cuenta', selected.bank_snapshot.accountNumber], ['Alias', selected.bank_snapshot.accountAlias], ['Referencia declarada por el cliente', selected.operation_reference || '—']] as const).map(([label, value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="break-words font-medium">{value || '—'}</dd></div>)}</dl>
      {selected.bank_snapshot.instructions && <p className="whitespace-pre-wrap text-sm">Instrucciones de la cuenta al solicitar: {selected.bank_snapshot.instructions}</p>}
      {selected.bank_operation_reference && <p className="text-sm">Referencia bancaria verificada: {selected.bank_operation_reference}</p>}
      {selected.period_ends_at && <p className="text-sm">Período vigente hasta: {date(selected.period_ends_at)}</p>}
      {selected.rejection_reason && <p className="text-sm">Motivo del rechazo: {selected.rejection_reason}</p>}
      {selected.status !== 'awaiting_receipt' && <div className="space-y-2"><Button variant="outline" disabled={receiptLoading || reviewing} onClick={() => void loadReceipt()}>{receiptLoading ? 'Consultando comprobante…' : 'Consultar comprobante privado'}</Button>{receiptUrl && <p><a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium underline">Abrir comprobante privado</a><span className="ml-2 text-xs text-muted-foreground">Enlace temporal. Si vence, consultalo nuevamente.</span></p>}{receiptError && <p role="alert" className="text-sm text-destructive">{receiptError}</p>}</div>}
      {reviewError && <p role="alert" className="text-sm text-destructive">{reviewError}</p>}{reviewResult && <p role="status" className="text-sm font-medium">{reviewResult}</p>}
      {(selected.status === 'pending_review' || selected.status === 'awaiting_receipt') && <div className="space-y-4 border-t pt-4">
        {selected.status === 'pending_review' && <>
        <div className="grid gap-2"><Label htmlFor="bank-reference">Referencia bancaria verificada</Label><Input id="bank-reference" maxLength={160} value={bankReference} disabled={reviewing} onChange={event => setBankReference(event.target.value)} autoComplete="off" /></div>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={verified} disabled={reviewing} onChange={event => setVerified(event.target.checked)} className="mt-1" /><span>Verifiqué la acreditación de este monto en la cuenta bancaria de la plataforma.</span></label>
        <Button disabled={reviewing || !verified || !bankReference.trim()} onClick={() => void review('approve')}>{reviewing ? 'Procesando…' : 'Aprobar y activar período'}</Button>
        </>}
        <div className="grid gap-2"><Label htmlFor="reject-reason">Motivo del rechazo</Label><textarea id="reject-reason" maxLength={2000} value={reason} disabled={reviewing} onChange={event => setReason(event.target.value)} className="min-h-24 rounded-md border bg-background p-3 text-sm" /><p className="text-xs text-muted-foreground">El rechazo es definitivo. El cliente deberá crear una nueva solicitud para volver a presentar el pago.</p><Button variant="destructive" disabled={reviewing || !reason.trim()} onClick={() => void review('reject')}>Rechazar solicitud</Button></div>
      </div>}
    </section>}

    <section className="space-y-4 rounded-xl border bg-card p-5"><h2 className="text-lg font-semibold">Cuenta receptora de transferencias</h2><p className="text-sm text-muted-foreground">Se muestra a los clientes al crear una solicitud. Cambiar estos datos no modifica las solicitudes anteriores.</p>
      {settingsLoading ? <p role="status">Cargando datos bancarios…</p> : settingsReady ? <form onSubmit={saveSettings} className="space-y-4">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.enabled} disabled={savingSettings} onChange={event => { setSettingsSaved(false); setSettings(value => ({ ...value, enabled: event.target.checked })) }} />Habilitar transferencias bancarias</label>
        <div className="grid gap-4 sm:grid-cols-2">{([{ key: 'bankName', label: 'Banco', max: 160 }, { key: 'accountHolder', label: 'Titular de la cuenta', max: 200 }, { key: 'accountNumber', label: 'Número de cuenta', max: 120 }, { key: 'accountAlias', label: 'Alias de cuenta', max: 120 }] as const).map(field => <div key={field.key} className="grid gap-2"><Label htmlFor={`setting-${field.key}`}>{field.label}</Label><Input id={`setting-${field.key}`} value={settings[field.key]} maxLength={field.max} disabled={savingSettings} onChange={event => { setSettingsSaved(false); setSettings(value => ({ ...value, [field.key]: event.target.value })) }} /></div>)}</div>
        <p className="text-sm">Moneda: <strong>Guaraní paraguayo (PYG)</strong></p>
        <div className="grid gap-2"><Label htmlFor="transfer-instructions">Instrucciones para el cliente</Label><textarea id="transfer-instructions" maxLength={3000} value={settings.instructions} disabled={savingSettings} onChange={event => { setSettingsSaved(false); setSettings(value => ({ ...value, instructions: event.target.value })) }} className="min-h-24 rounded-md border bg-background p-3 text-sm" /></div>
        <Button type="submit" disabled={savingSettings}>{savingSettings ? 'Guardando…' : 'Guardar datos bancarios'}</Button>
      </form> : <p className="text-sm text-muted-foreground">Los datos bancarios no están disponibles. Volvé a cargarlos antes de editar.</p>}
      {settingsError && <div role="alert" className="space-y-2 text-sm text-destructive"><p>{settingsError}</p><Button variant="outline" disabled={settingsLoading || savingSettings} onClick={() => setSettingsAttempt(value => value + 1)}>Volver a cargar datos bancarios</Button></div>}
      {settingsSaved && <p role="status" className="text-sm">Datos bancarios guardados.</p>}
    </section>
  </div>
}
