'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Building2, ClipboardList, FileSearch, RefreshCw, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader, Notice } from '@/components/superadmin/ui/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { bankTransferSettingsSchema, type BankTransferRequest, type BankTransferSettings, type BankTransferStatus } from '@/lib/saas/bank-transfer-contract'

type RequestRow = BankTransferRequest & { organization_name?: string }
const STATUS_LABELS: Record<BankTransferStatus, string> = {
  awaiting_receipt: 'Esperando comprobante', pending_review: 'Pendiente de revisión', approved: 'Aprobada', rejected: 'Rechazada', cancelled: 'Cancelada',
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
  const [savedEnabled, setSavedEnabled] = useState(false)
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
        setSavedEnabled(s.enabled)
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
      setSavedEnabled(parsed.data.enabled)
    } catch (error) { setSettingsError(message(error)) }
    finally { setSavingSettings(false) }
  }

  return <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
    <PageHeader icon={Building2} title="Transferencias de suscripción" description="Revisá los pagos de planes y administrá la cuenta bancaria de la plataforma." />
    <Tabs defaultValue="requests" className="space-y-5">
      <TabsList className="grid h-auto w-full grid-cols-2 justify-start gap-1 rounded-xl p-1 sm:inline-flex sm:w-auto">
        <TabsTrigger value="requests" className="min-h-10 min-w-0 flex-1 gap-1 rounded-lg px-2 text-xs whitespace-normal sm:flex-none sm:gap-2 sm:px-3 sm:text-sm"><ClipboardList className="h-4 w-4"/>Solicitudes</TabsTrigger>
        <TabsTrigger value="bank" className="min-h-10 min-w-0 flex-1 flex-wrap gap-1 rounded-lg px-2 text-xs whitespace-normal sm:flex-none sm:gap-2 sm:px-3 sm:text-sm"><Building2 className="h-4 w-4"/>Cuenta bancaria<Badge variant="secondary" className="text-[10px]">{settingsLoading ? 'Cargando…' : !settingsReady ? 'No disponible' : savedEnabled ? 'Habilitada' : 'Deshabilitada'}</Badge></TabsTrigger>
      </TabsList>
      <TabsContent value="requests" className="space-y-4">
        <Notice tone="info"><span className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0"/>Verificá la acreditación en la cuenta bancaria antes de aprobar. Un comprobante por sí solo no acredita el pago.</span></Notice>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="grid min-w-0 flex-1 gap-1.5 sm:max-w-xs"><Label htmlFor="transfer-status">Estado de solicitud</Label><select id="transfer-status" value={status} disabled={reviewing} onChange={event => { setStatus(event.target.value as BankTransferStatus); setPage(1); setSelected(null) }} className="min-h-10 w-full rounded-lg border bg-background px-3 text-sm">{Object.entries(STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
          <Button variant="outline" className="gap-2 rounded-lg" onClick={() => setRefresh(value => value + 1)} disabled={loading || reviewing}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}/>Actualizar solicitudes</Button>
        </div>
        {listError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{listError}<Button variant="outline" onClick={() => setRefresh(value => value + 1)}>Reintentar solicitudes</Button></div>}
        <div className="grid items-start gap-4 lg:h-[calc(100dvh-19rem)] lg:min-h-[26rem] lg:max-h-[52rem] lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.4fr)]">
          <section aria-label="Solicitudes de transferencia" className={`${selected ? 'hidden lg:flex' : 'flex'} min-h-0 flex-col overflow-hidden rounded-2xl border bg-card lg:h-full`}>
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3"><h2 className="text-sm font-semibold">{STATUS_LABELS[status]}</h2><span className="text-xs text-muted-foreground">Página {page}</span></div>
            <div className="max-h-[36rem] min-h-0 flex-1 overflow-y-auto lg:max-h-none">
              {loading ? <p role="status" className="p-6 text-sm text-muted-foreground">Cargando solicitudes…</p> : !listError && (rows.length ? <div className="divide-y">{rows.map(row => <button type="button" key={row.id} disabled={reviewing} aria-pressed={selected?.id === row.id} aria-label={`Ver detalle ${row.reference}`} onClick={() => selectRequest(row)} className={`w-full space-y-1.5 border-l-2 px-4 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:opacity-60 ${selected?.id === row.id ? 'border-l-primary bg-primary/5' : 'border-l-transparent hover:bg-muted/50'}`}>
                <div className="flex items-start justify-between gap-3"><span className="min-w-0 break-words text-sm font-semibold">{row.organization_name || row.organization_id}</span><span className="shrink-0 text-sm font-semibold tabular-nums">{money(row.amount)}</span></div>
                <p className="text-xs text-muted-foreground">{row.plan_name} · {date(row.created_at)}</p><p className="truncate font-mono text-[11px] text-muted-foreground" title={row.reference}>{row.reference}</p>
              </button>)}</div> : <div className="space-y-2 p-8 text-center"><ClipboardList className="mx-auto h-7 w-7 text-muted-foreground/50"/><p className="text-sm text-muted-foreground">No hay solicitudes en este estado.</p></div>)}
            </div>
            <div className="flex items-center justify-between gap-3 border-t p-3"><Button size="sm" variant="outline" disabled={page === 1 || loading || reviewing} onClick={() => { setPage(value => value - 1); setSelected(null) }}>Anterior</Button><span className="text-xs text-muted-foreground">Hasta 25 por página</span><Button size="sm" variant="outline" disabled={!hasMore || loading || reviewing || Boolean(listError)} onClick={() => { setPage(value => value + 1); setSelected(null) }}>Siguiente</Button></div>
          </section>
          {selected && <section ref={detailRef} tabIndex={-1} aria-label={`Detalle ${selected.reference}`} className="min-w-0 space-y-5 rounded-2xl border bg-card p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5 lg:h-full lg:overflow-y-auto">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">Detalle {selected.reference}</h2><Button variant="outline" disabled={reviewing} onClick={() => { receiptAbort.current?.abort(); setSelected(null) }}><ArrowLeft className="mr-2 h-4 w-4 lg:hidden"/>Cerrar detalle</Button></div>
      <p>{selected.organization_name || selected.organization_id} · {selected.plan_name} · <strong>{money(selected.amount)}</strong></p>
      <p className="text-sm">Estado: {STATUS_LABELS[selected.status]} · Revisada: {date(selected.reviewed_at)}</p>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">{([['Banco', selected.bank_snapshot.bankName], ['Titular', selected.bank_snapshot.accountHolder], ['Cuenta', selected.bank_snapshot.accountNumber], ['Alias', selected.bank_snapshot.accountAlias], ['Referencia declarada por el cliente', selected.operation_reference || '—']] as const).map(([label, value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="break-words font-medium">{value || '—'}</dd></div>)}</dl>
      {selected.bank_snapshot.instructions && <p className="whitespace-pre-wrap text-sm">Instrucciones de la cuenta al solicitar: {selected.bank_snapshot.instructions}</p>}
      {selected.bank_operation_reference && <p className="text-sm">Referencia bancaria verificada: {selected.bank_operation_reference}</p>}
      {selected.period_ends_at && <p className="text-sm">Período vigente hasta: {date(selected.period_ends_at)}</p>}
      {selected.rejection_reason && <p className="text-sm">Motivo del rechazo: {selected.rejection_reason}</p>}
      {selected.status !== 'awaiting_receipt' && <div className="space-y-2"><Button variant="outline" disabled={receiptLoading || reviewing} onClick={() => void loadReceipt()}>{receiptLoading ? 'Consultando comprobante…' : 'Consultar comprobante privado'}</Button>{receiptUrl && <p><a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium underline">Abrir comprobante privado</a><span className="ml-2 text-xs text-muted-foreground">Enlace temporal. Si vence, consultalo nuevamente.</span></p>}{receiptError && <p role="alert" className="text-sm text-destructive">{receiptError}</p>}</div>}
      {reviewError && <p role="alert" className="text-sm text-destructive">{reviewError}</p>}{reviewResult && <p role="status" className="text-sm font-medium">{reviewResult}</p>}
      {(selected.status === 'pending_review' || selected.status === 'awaiting_receipt') && <div className="space-y-5 border-t pt-5">
        {selected.status === 'pending_review' && <>
        <div className="grid gap-2"><Label htmlFor="bank-reference">Referencia bancaria verificada</Label><Input id="bank-reference" maxLength={160} value={bankReference} disabled={reviewing} onChange={event => setBankReference(event.target.value)} autoComplete="off" /></div>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={verified} disabled={reviewing} onChange={event => setVerified(event.target.checked)} className="mt-1" /><span>Verifiqué la acreditación de este monto en la cuenta bancaria de la plataforma.</span></label>
        <Button disabled={reviewing || !verified || !bankReference.trim()} onClick={() => void review('approve')}>{reviewing ? 'Procesando…' : 'Aprobar y activar período'}</Button>
        </>}
        <div className="grid gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-4"><Label htmlFor="reject-reason">Motivo del rechazo</Label><textarea id="reject-reason" maxLength={2000} value={reason} disabled={reviewing} onChange={event => setReason(event.target.value)} className="min-h-24 rounded-md border bg-background p-3 text-sm" /><p className="text-xs text-muted-foreground">El rechazo es definitivo. El cliente deberá crear una nueva solicitud para volver a presentar el pago.</p><Button variant="destructive" disabled={reviewing || !reason.trim()} onClick={() => void review('reject')}>Rechazar solicitud</Button></div>
      </div>}
    </section>}
          {!selected && <div className="hidden h-full min-h-72 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed bg-muted/20 p-8 text-center lg:flex"><FileSearch className="h-9 w-9 text-muted-foreground/40"/><h2 className="text-base font-semibold">Seleccioná una solicitud</h2><p className="max-w-xs text-sm text-muted-foreground">Consultá el comprobante y los datos del pago. Las acciones de revisión aparecerán en este panel.</p></div>}
        </div>
      </TabsContent>
      <TabsContent value="bank" className="space-y-4">
        <section className="mx-auto max-w-3xl space-y-5 rounded-2xl border bg-card p-4 sm:p-6"><div className="flex items-center gap-3"><div className="rounded-xl bg-muted p-2.5"><Building2 className="h-5 w-5 text-muted-foreground"/></div><h2 className="text-lg font-semibold">Cuenta receptora de transferencias</h2></div><p className="text-sm text-muted-foreground">Se muestra a los clientes al crear una solicitud. Cambiar estos datos no modifica las solicitudes anteriores.</p>
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
      </TabsContent>
    </Tabs>
  </div>
}
