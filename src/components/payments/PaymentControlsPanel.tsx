'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, CreditCard, Loader2, RefreshCw, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import type { ControlScope, PaymentControl, PaymentControlSnapshot } from '@/lib/payments/control-contract'

type Props = { scope: ControlScope; endpoint: string; title: string; description: string }
type Result = { key: string; snapshot: PaymentControlSnapshot }
function status(method: PaymentControl) {
  if (isPending(method)) return 'Integración pendiente'
  if (method.id === 'manual_cash') return 'Registro manual · sin interruptor'
  if (!method.configured) return method.enabled ? 'Habilitado · falta configurar' : 'Deshabilitado · falta configurar'
  return method.available ? 'Habilitado' : method.enabled ? 'Requiere otro medio' : 'Deshabilitado'
}
function isPending(method: PaymentControl) { return method.implementation === 'pending' || (!method.implementation && !method.editable && !method.configured) }
function operationStatus(method: PaymentControl) {
  if (isPending(method)) return 'No implementado'
  if (!method.configured) return 'Implementado · falta configurar'
  if (method.id === 'manual_cash') return 'Registro manual implementado'
  if (method.id === 'promo') return 'Canje de códigos implementado'
  if (method.id === 'credit') return 'Financiación implementada'
  if (method.id === 'store_credit') return 'Uso de saldo implementado'
  if (method.history?.confirmed === true) return 'Configurado · con cobros registrados'
  if (method.history?.confirmed === false) return 'Configurado · sin cobro confirmado'
  return 'Configurado · historial sin verificar'
}

export function PaymentControlsPanel({ scope, endpoint, title, description }: Props) {
  const { user } = useAuth()
  const scopeKey = `${scope}:${user?.id ?? ''}:${user?.organization?.id ?? ''}`
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [errorMethod, setErrorMethod] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const generation = useRef<{ active: boolean } | null>(null)
  const saveLock = useRef(false)
  const snapshot = result?.key === scopeKey ? result.snapshot : null
  const retry = useCallback(() => setAttempt(value => value + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    const current = { active: true }
    generation.current = current
    saveLock.current = false
    void Promise.resolve().then(async () => {
      if (controller.signal.aborted) return
      setError(null); setErrorMethod(null); setMessage(null); setSaving(null)
      const response = await fetch(`${endpoint}${endpoint.includes('?') ? '&' : '?'}includeHistory=1`, { cache: 'no-store', signal: controller.signal })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'No se pudieron cargar los medios de pago.')
      if (payload.scope !== scope || !Array.isArray(payload.methods)) throw new Error('La configuración recibida no es válida.')
      if (!controller.signal.aborted && current === generation.current) setResult({ key: scopeKey, snapshot: payload })
    }).catch(error => {
      if (!controller.signal.aborted && current === generation.current) setError(error instanceof Error ? error.message : 'No se pudieron consultar los medios.')
    })
    return () => { current.active = false; controller.abort() }
  }, [endpoint, scope, scopeKey, attempt])

  async function toggle(method: PaymentControl, enabled: boolean) {
    if (!snapshot || saveLock.current) return
    saveLock.current = true
    const current = generation.current
    setSaving(method.id); setError(null); setErrorMethod(method.id); setMessage(null)
    try {
      const response = await fetch(endpoint, {
        method: 'PATCH', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', ...(snapshot.organizationId ? { 'X-Organization-ID': snapshot.organizationId } : {}) },
        body: JSON.stringify({ id: method.id, enabled, revision: method.revision !== undefined ? method.revision : snapshot.revision }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'No se pudo guardar el cambio.')
      if (payload.scope !== scope || !Array.isArray(payload.methods)) throw new Error('Actualizá para confirmar el estado del cambio.')
      if (!current?.active || current !== generation.current) return
      setResult({ key: scopeKey, snapshot: payload })
      setErrorMethod(null)
      setMessage(`${method.title}: ${enabled ? 'habilitación guardada' : 'deshabilitado para operaciones nuevas'}.`)
    } catch (error) {
      if (current?.active && current === generation.current) setError(error instanceof Error ? error.message : 'No se pudo guardar.')
    } finally {
      if (current?.active && current === generation.current) { setSaving(null); saveLock.current = false }
    }
  }

  const active = snapshot?.methods.filter(method => method.available).length ?? 0
  const implemented = snapshot?.methods.filter(method => !isPending(method)) ?? []
  const pending = snapshot?.methods.filter(isPending) ?? []
  const groups = [{ title: 'Medios implementados', description: 'Funciones disponibles en el sistema. Revisá su configuración y habilitación antes de cobrar.', methods: implemented }, { title: 'Integraciones por desarrollar', description: 'Todavía no permiten cobrar. Habilitarlas requiere desarrollo y conexión con el proveedor.', methods: pending }]
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl space-y-2">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary"><ShieldCheck className="h-4 w-4" />{scope === 'subscriptions' ? 'Facturación de la plataforma' : 'Facturación del comercio'}</p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Button variant="outline" disabled={Boolean(saving)} onClick={retry}><RefreshCw className="mr-2 h-4 w-4" />Actualizar</Button>
      </header>
      <div className="rounded-2xl border bg-muted/30 p-4 text-sm text-muted-foreground">
        Los cambios se guardan por medio y afectan operaciones nuevas. El historial, las confirmaciones de pagos iniciados y las devoluciones se conservan.
        {scope === 'commerce' && <p className="mt-2">La tienda web también respeta sus restricciones de checkout. Habilitar un medio no agrega módulos, permisos ni una pasarela de cobro automático.</p>}
      </div>
      {error && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/30 p-4 text-sm text-destructive"><AlertCircle className="h-5 w-5 shrink-0" /><span className="flex-1">{error}</span><Button variant="outline" size="sm" disabled={Boolean(saving)} onClick={retry}>Reintentar carga</Button></div>}
      {message && <p role="status" className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-primary" />{message}</p>}
      {!snapshot && !error && <div role="status" className="flex items-center gap-2 py-12 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Cargando medios de pago…</div>}
      {snapshot && <>
        {snapshot.configurationNotice && <p role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">{snapshot.configurationNotice} Los interruptores se habilitarán cuando la protección esté disponible.</p>}
        {snapshot.canEdit === false && <p className="text-sm text-muted-foreground">Podés consultar estos medios. Solo el dueño o un administrador del comercio puede modificarlos.</p>}
        <div className="flex flex-wrap items-center gap-3"><Badge variant="secondary">{active} medios disponibles</Badge><Badge variant="outline">{implemented.length} implementados</Badge><Badge variant="outline">{pending.length} por desarrollar</Badge>{active === 0 && <p className="text-sm text-amber-700 dark:text-amber-300">No hay medios disponibles para iniciar cobros nuevos.</p>}</div>
        {groups.filter(group => group.methods.length).map(group => <section key={group.title} className="space-y-4" aria-label={group.title}>
        <div><h2 className="text-lg font-semibold">{group.title}</h2><p className="text-sm text-muted-foreground">{group.description}</p></div>
        <div className="grid gap-4 md:grid-cols-2">
          {[...group.methods].sort((a, b) => a.title.localeCompare(b.title, 'es')).map(method => <section key={method.id} aria-label={method.title} className="flex flex-col rounded-xl border bg-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3"><span className="rounded-xl bg-primary/10 p-2.5 text-primary"><CreditCard className="h-5 w-5" /></span><div><h3 className="font-semibold">{method.title}</h3><p className="mt-1 text-xs text-muted-foreground">{status(method)}</p></div></div>
              <Badge variant={method.available ? 'default' : 'secondary'} className="shrink-0">{isPending(method) ? 'No implementado' : method.id === 'manual_cash' ? 'Manual' : method.available ? 'Disponible' : 'No disponible'}</Badge>
            </div>
            <p className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground">{method.description}</p>
            <div className="mt-4 border-l-2 border-primary/40 pl-3"><p className="text-xs text-muted-foreground">Verificación de funcionamiento</p><p className="mt-1 text-sm font-semibold">{operationStatus(method)}</p>{!isPending(method) && method.history?.confirmed === true && <p className="mt-1 text-xs text-muted-foreground">Hay evidencia histórica de cobro. No se realizó una transacción nueva para comprobar la pasarela en este momento.</p>}{!isPending(method) && method.configured && method.history?.confirmed === false && <p className="mt-1 text-xs text-muted-foreground">La configuración está detectada; falta verificar un cobro completo para confirmar el circuito.</p>}</div>
            {!isPending(method) && <dl className="mt-4 grid grid-cols-2 gap-3 border-t pt-4 text-xs"><div><dt className="text-muted-foreground">Implementación</dt><dd className="mt-1 font-medium">Implementado</dd></div><div><dt className="text-muted-foreground">Configuración</dt><dd className="mt-1 font-medium">{method.configured ? 'Lista' : 'Pendiente'}</dd></div></dl>}
            {!isPending(method) && <div className="mt-4 rounded-lg bg-muted/40 p-3 text-xs"><p className="font-medium">{method.id === 'promo' ? 'Activación o descuento · no es un cobro' : method.history?.confirmed === true ? 'Con cobros registrados' : method.history?.confirmed === false ? 'Sin cobros en los registros consultados' : 'Cobros: sin verificación disponible'}</p><details className="mt-2 text-muted-foreground"><summary className="w-fit cursor-pointer py-1 font-medium">Ver alcance del historial</summary><p className="mt-2 leading-relaxed">{method.id === 'promo' ? 'Los canjes no prueban recepción de dinero y no se cuentan como pagos.' : method.history?.detail ?? 'El estado habilitado no confirma que se haya recibido un pago.'}</p></details></div>}
            {!!method.nextSteps?.length && <div className="mt-4 text-xs"><p className="font-semibold">{isPending(method) ? 'Qué falta implementar' : 'Próximos pasos'}</p><ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">{method.nextSteps.map(step => <li key={step}>{step}</li>)}</ul></div>}
            {!isPending(method) && method.configured && !method.enabled && method.editable && <p className="mt-3 text-xs text-muted-foreground">Listo para habilitar desde el interruptor.</p>}
            <div className="mt-4 flex flex-wrap gap-1.5">{method.channels.map(channel => <Badge key={channel} variant="outline" className="text-[11px] font-normal">{channel}</Badge>)}</div>
            {method.settingsHref && <Link className="mt-4 w-fit text-sm font-semibold text-primary underline-offset-4 hover:underline" href={method.settingsHref}>Configurar este medio</Link>}
            {method.editable && <div className="mt-5 border-t pt-4">
              <div className="flex min-h-11 items-center justify-between gap-4"><div><p className="text-sm font-medium">{method.enabled ? 'Activado para operaciones nuevas' : 'Desactivado para operaciones nuevas'}</p><p className="mt-1 text-xs text-muted-foreground">{saving === method.id ? 'Guardando el cambio…' : 'El cambio se confirma al guardar en el servidor.'}</p></div>
                <Switch aria-label={`Habilitar ${method.title}`} className="h-6 w-11" checked={method.enabled} disabled={Boolean(saving) || Boolean(snapshot.configurationNotice) || (!method.configured && !method.enabled)} onCheckedChange={enabled => void toggle(method, enabled)} />
              </div>
              {!method.configured && !method.enabled && <p className="mt-2 text-xs text-muted-foreground">Completá la configuración para poder activarlo.</p>}
              {error && errorMethod === method.id && <p className="mt-3 text-sm font-medium text-destructive">No se guardó el cambio: {error}</p>}
            </div>}
          </section>)}
        </div>
        </section>)}
      </>}
    </div>
  )
}
