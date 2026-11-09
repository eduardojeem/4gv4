'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Ban, Building2, ChevronDown, Globe2, Loader2, RefreshCw, Save, Settings } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Notice, PageHeader } from '@/components/superadmin/ui/page-header'
import { SUPPORTED_CURRENCIES } from '@/lib/currency'
import {
  PLATFORM_SETTINGS_CODES,
  SETTINGS_TIMEZONES,
  type PlatformDefaults,
} from '@/lib/superadmin/platform-settings'

export type { PlatformDefaults } from '@/lib/superadmin/platform-settings'

export type PlatformSettingsData = {
  defaults: PlatformDefaults
  storedFlags: {
    maintenanceMode: boolean
    allowRegistration: boolean
    requireEmailVerification: boolean
    requireTwoFactor: boolean
    autoBackup: boolean
    smsNotifications: boolean
    maxLoginAttempts: number
    passwordMinLength: number
    sessionTimeout: number
    retentionDays: number
  }
  usage: {
    /** Todas las tiendas de la plataforma. */
    totalOrganizations: number
    /** Tiendas sin IVA propio: el POS les cobra el IVA global. */
    withoutOwnTaxRate: number
    withoutOwnCurrency: number
    withoutOwnTimezone: number
    currencies: Array<[string, number]>
    timezones: Array<[string, number]>
  }
  updatedAt: string | null
  updatedByEmail: string | null
  loadErrors: string[]
}

/** Borrador del formulario: el IVA queda como texto para poder distinguir «vacío» de 0. */
type Draft = Omit<PlatformDefaults, 'taxRate'> & { taxRate: string }

type FieldKey = keyof PlatformDefaults
const TEXT_KEYS = ['companyName', 'companyRuc', 'companyEmail', 'companyPhone', 'companyAddress'] as const

/**
 * Opciones que existen en la base pero que ninguna parte de la app aplica
 * (auditado el 2026-09-27, revisado el 2026-11-09). Se muestran deshabilitadas
 * para no dar una falsa sensación de control; `reason` dice dónde se controla hoy.
 */
const NOT_IMPLEMENTED: Array<{ key: keyof PlatformSettingsData['storedFlags']; label: string; reason: string; kind: 'bool' | 'number'; unit?: string }> = [
  { key: 'maintenanceMode', label: 'Modo mantenimiento de la plataforma', kind: 'bool', reason: 'El sitio no lo consulta. El mantenimiento que sí funciona es el de cada tienda (Sitio web → Mantenimiento).' },
  { key: 'allowRegistration', label: 'Registro público de empresas', kind: 'bool', reason: 'El alta en /register no lo revisa: el registro siempre está abierto.' },
  { key: 'requireEmailVerification', label: 'Verificación de email obligatoria', kind: 'bool', reason: 'Se controla en Supabase → Authentication → Providers → Email (Confirm email).' },
  { key: 'requireTwoFactor', label: '2FA obligatorio para toda la plataforma', kind: 'bool', reason: 'Este interruptor global no se aplica. La verificación en dos pasos (app autenticadora, TOTP) ya funciona: cada persona la activa en su perfil y cada tienda puede exigírsela a sus administradores desde Seguridad.' },
  { key: 'maxLoginAttempts', label: 'Intentos de login', kind: 'number', reason: 'Los límites de intentos los aplica Supabase Auth (Rate Limits), no este valor.' },
  { key: 'passwordMinLength', label: 'Longitud mínima de contraseña', kind: 'number', unit: 'caracteres', reason: 'Se configura en Supabase → Authentication → Policies.' },
  { key: 'sessionTimeout', label: 'Tiempo de sesión', kind: 'number', unit: 'min', reason: 'La duración de sesión la define Supabase Auth (JWT expiry y refresh).' },
  { key: 'autoBackup', label: 'Backup automático', kind: 'bool', reason: 'Los backups los hace Supabase según el plan contratado (Database → Backups).' },
  { key: 'smsNotifications', label: 'Notificaciones por SMS', kind: 'bool', reason: 'No hay un proveedor de SMS integrado.' },
  { key: 'retentionDays', label: 'Retención de auditoría', kind: 'number', unit: 'días', reason: 'La rotación se hace a mano desde Mantenimiento (mínimo 90 días).' },
]

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('es-PY', { timeZone: 'America/Asuncion', dateStyle: 'medium', timeStyle: 'short' })
}

const toDraft = (defaults: PlatformDefaults): Draft => ({ ...defaults, taxRate: String(defaults.taxRate) })

/** El IVA del borrador, o el motivo por el que no se puede guardar. */
export function parseTaxRate(text: string): { value: number } | { error: string } {
  const trimmed = text.trim().replace(',', '.')
  if (!trimmed) return { error: 'El IVA no puede quedar vacío.' }
  const value = Number(trimmed)
  if (!Number.isFinite(value)) return { error: 'El IVA tiene que ser un número.' }
  if (value < 0 || value > 100) return { error: 'El IVA tiene que estar entre 0 y 100.' }
  return { value }
}

/** Lo que cambió respecto de lo guardado, con los textos ya recortados. */
export function diffDefaults(draft: Draft, saved: PlatformDefaults): { changes: Partial<PlatformDefaults>; taxError: string | null } {
  const changes: Partial<PlatformDefaults> = {}
  for (const key of TEXT_KEYS) {
    const next = draft[key].trim()
    if (next !== saved[key].trim()) changes[key] = next
  }
  if (draft.currency !== saved.currency) changes.currency = draft.currency
  if (draft.timeZone !== saved.timeZone) changes.timeZone = draft.timeZone
  const tax = parseTaxRate(draft.taxRate)
  if ('error' in tax) return { changes, taxError: tax.error }
  if (tax.value !== saved.taxRate) changes.taxRate = tax.value
  return { changes, taxError: null }
}

type SaveProblem = { kind: 'conflict' | 'mfa' | 'error'; message: string; mfaPath?: string }

export function SettingsCenter({ data }: { data: PlatformSettingsData }) {
  const router = useRouter()
  const [saved, setSaved] = useState<PlatformDefaults>(data.defaults)
  const [revision, setRevision] = useState<string | null>(data.updatedAt)
  const [values, setValues] = useState<Draft>(() => toDraft(data.defaults))
  const [problem, setProblem] = useState<SaveProblem | null>(null)
  const [confirmTaxOpen, setConfirmTaxOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [reloading, startReload] = useTransition()

  // Al recargar (router.refresh) llegan datos nuevos: se toman como base y como
  // revisión, sin tocar el borrador que la persona estaba escribiendo.
  const [syncedRevision, setSyncedRevision] = useState(data.updatedAt)
  if (syncedRevision !== data.updatedAt) {
    setSyncedRevision(data.updatedAt)
    setSaved(data.defaults)
    setRevision(data.updatedAt)
  }

  const { changes, taxError } = useMemo(() => diffDefaults(values, saved), [values, saved])
  const changed = Object.keys(changes) as FieldKey[]
  const dirty = changed.length > 0 || taxError !== null
  const canSave = !pending && changed.length > 0 && taxError === null

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setValues((v) => ({ ...v, [key]: value }))

  const submit = (confirmTaxRateChange: boolean) =>
    startTransition(async () => {
      setProblem(null)
      let response: Response
      try {
        response = await fetch('/api/superadmin/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            settings: changes,
            revision,
            ...(changes.taxRate !== undefined ? { confirmTaxRateChange } : {}),
          }),
        })
      } catch {
        setProblem({ kind: 'error', message: 'No se pudo conectar con el servidor. Revisá tu conexión y probá de nuevo.' })
        return
      }
      const payload = await response.json().catch(() => null) as {
        success?: boolean
        error?: string
        code?: string
        mfaPath?: string
        data?: { defaults: PlatformDefaults; updatedAt: string | null }
      } | null

      if (!response.ok || !payload?.success || !payload.data) {
        const message = payload?.error ?? `No se pudo guardar (${response.status}).`
        if (payload?.code === PLATFORM_SETTINGS_CODES.taxRateConfirmation) {
          setConfirmTaxOpen(true)
          return
        }
        if (payload?.code === PLATFORM_SETTINGS_CODES.conflict) setProblem({ kind: 'conflict', message })
        else if (payload?.code === PLATFORM_SETTINGS_CODES.mfaRequired) setProblem({ kind: 'mfa', message, mfaPath: payload.mfaPath })
        else setProblem({ kind: 'error', message })
        toast.error(message)
        return
      }

      setSaved(payload.data.defaults)
      setRevision(payload.data.updatedAt)
      setSyncedRevision(payload.data.updatedAt)
      setValues(toDraft(payload.data.defaults))
      toast.success('Configuración guardada')
      router.refresh()
    })

  const save = () => {
    if (!canSave) return
    if (changes.taxRate !== undefined) {
      setConfirmTaxOpen(true)
      return
    }
    submit(false)
  }

  const reload = () => startReload(() => {
    setProblem(null)
    router.refresh()
  })

  const saveLabel = `Guardar${changed.length ? ` (${changed.length})` : ''}`
  const saveButton = (className?: string) => (
    <Button onClick={save} disabled={!canSave} className={className} aria-busy={pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
      {pending ? 'Guardando…' : saveLabel}
    </Button>
  )

  const usage = data.usage
  const newTax = changes.taxRate

  return (
    <div className={`space-y-6 ${dirty ? 'pb-24 sm:pb-0' : ''}`}>
      <PageHeader
        icon={Settings}
        title="Configuración de la plataforma"
        description="Valores por defecto para las tiendas que no configuraron los suyos. El que de verdad se usa es el IVA; cada tienda puede cambiar todo esto en su propio panel."
        actions={saveButton('hidden sm:inline-flex')}
      />

      {data.loadErrors.length > 0 && <Notice tone="error">No se pudo cargar todo: {data.loadErrors.join(' · ')}</Notice>}

      {problem && (
        <Notice tone="error">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>{problem.message}</span>
            {problem.kind === 'conflict' && (
              <Button size="sm" variant="outline" onClick={reload} disabled={reloading}>
                {reloading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
                Recargar
              </Button>
            )}
            {problem.kind === 'mfa' && problem.mfaPath && (
              <Button size="sm" variant="outline" asChild>
                <Link href={problem.mfaPath}>Verificar en dos pasos</Link>
              </Button>
            )}
          </div>
        </Notice>
      )}

      <p className="text-xs text-slate-500">
        Última modificación: {formatDate(revision)}{data.updatedByEmail ? ` por ${data.updatedByEmail}` : ''}. Cada cambio queda en la auditoría.
      </p>

      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Globe2 className="h-4 w-4" aria-hidden /> Regional</CardTitle>
          <CardDescription>
            El <strong>IVA</strong> es el único valor por defecto que se usa hoy: el POS lo cobra en las tiendas sin IVA propio
            ({usage.withoutOwnTaxRate} de {usage.totalOrganizations}). La moneda y la zona horaria solo aplican a tiendas sin
            configuración propia: {usage.withoutOwnCurrency} sin moneda y {usage.withoutOwnTimezone} sin zona horaria.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="settings-tax">IVA (%)</Label>
              <Input
                id="settings-tax"
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step={0.5}
                value={values.taxRate}
                onChange={(e) => set('taxRate', e.target.value)}
                aria-invalid={taxError ? true : undefined}
                aria-describedby={taxError ? 'settings-tax-error' : 'settings-tax-help'}
              />
              {taxError
                ? <p id="settings-tax-error" className="text-xs text-red-600 dark:text-red-400">{taxError}</p>
                : <p id="settings-tax-help" className="text-xs text-slate-500">Entre 0 y 100. Antes de guardar se pide confirmación.</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="settings-currency">Moneda</Label>
              <Select value={values.currency} onValueChange={(v) => set('currency', v)}>
                <SelectTrigger id="settings-currency"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUPPORTED_CURRENCIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.code} · {c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="settings-timezone">Zona horaria</Label>
              <Select value={values.timeZone} onValueChange={(v) => set('timeZone', v)}>
                <SelectTrigger id="settings-timezone"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[...new Set([values.timeZone, ...SETTINGS_TIMEZONES])].map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">
            <p className="font-medium">Tiendas con moneda o zona horaria propia</p>
            <p>Monedas: {usage.currencies.map(([c, n]) => `${c} (${n})`).join(', ') || '—'}</p>
            <p>Zonas horarias: {usage.timezones.map(([t, n]) => `${t} (${n})`).join(', ') || '—'}</p>
          </div>
        </CardContent>
      </Card>

      <Collapsible>
        <Card className="rounded-xl">
          <CardHeader>
            <CollapsibleTrigger asChild>
              <button type="button" className="group flex w-full items-center justify-between gap-2 text-left">
                <span>
                  <CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4" aria-hidden /> Sin efecto actualmente</CardTitle>
                  <CardDescription className="mt-1.5">Datos de la empresa por defecto: se guardan, pero hoy no se usan en ninguna parte.</CardDescription>
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" aria-hidden />
              </button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-3">
              <p className="text-xs text-slate-500">
                Las tiendas nunca heredan estos datos: si una tienda no cargó su nombre, RUC o contacto, en sus recibos aparecen vacíos,
                no los de la plataforma. Cambiarlos no modifica nada visible.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {([
                  ['companyName', 'Nombre', 'text'],
                  ['companyRuc', 'RUC', 'text'],
                  ['companyEmail', 'Email', 'email'],
                  ['companyPhone', 'Teléfono', 'tel'],
                ] as const).map(([key, label, type]) => (
                  <div key={key} className="space-y-1.5">
                    <Label htmlFor={`settings-${key}`}>{label}</Label>
                    <Input id={`settings-${key}`} type={type} value={values[key]} onChange={(e) => set(key, e.target.value)} />
                  </div>
                ))}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="settings-companyAddress">Dirección</Label>
                  <Input id="settings-companyAddress" value={values.companyAddress} onChange={(e) => set('companyAddress', e.target.value)} />
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Ban className="h-4 w-4" aria-hidden /> Opciones sin implementar</CardTitle>
          <CardDescription>
            Estas opciones están guardadas pero ninguna parte de la plataforma las aplica: cambiarlas no tendría efecto. Se muestran deshabilitadas con el valor guardado y dónde se controla hoy cada cosa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y dark:divide-slate-800">
            {NOT_IMPLEMENTED.map((item) => {
              const value = data.storedFlags[item.key]
              return (
                <li key={item.key} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                      {item.label}
                      <Badge variant="outline" className="rounded-full border-slate-300 text-[10px] uppercase tracking-wide">No implementado</Badge>
                    </p>
                    <p className="text-xs text-slate-500">{item.reason}</p>
                  </div>
                  <div className="shrink-0 opacity-60">
                    {item.kind === 'bool'
                      ? <Switch checked={Boolean(value)} disabled aria-label={`${item.label} (no implementado)`} />
                      : <span className="font-mono text-sm">{String(value)}{item.unit ? ` ${item.unit}` : ''}</span>}
                  </div>
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>

      <p className="text-sm text-slate-500">
        Las variables de entorno (claves de Supabase, pagos, email) se revisan en{' '}
        <Link href="/superadmin/system-health" className="font-medium text-primary underline-offset-4 hover:underline">Salud del sistema</Link>.
      </p>

      {dirty && (
        <div
          role="region"
          aria-label="Cambios sin guardar"
          className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t bg-background/95 px-4 py-3 shadow-lg backdrop-blur sm:hidden"
        >
          <span className="text-sm text-muted-foreground">{taxError ?? 'Tenés cambios sin guardar'}</span>
          {saveButton()}
        </div>
      )}

      <AlertDialog open={confirmTaxOpen} onOpenChange={setConfirmTaxOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cambiar el IVA global{newTax !== undefined ? ` a ${newTax}%` : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              Lo usan {usage.withoutOwnTaxRate} de {usage.totalOrganizations} tiendas (las que no tienen IVA propio). Desde que guardes, el POS de
              esas tiendas cobra el IVA nuevo en las ventas siguientes. Las ventas ya hechas no cambian.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => submit(true)}>Sí, cambiar el IVA</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
