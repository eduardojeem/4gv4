'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Ban, Building2, Globe2, Loader2, Save, Settings } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Notice, PageHeader } from '@/components/superadmin/ui/page-header'
import { SUPPORTED_CURRENCIES } from '@/lib/currency'

export type PlatformDefaults = {
  companyName: string
  companyEmail: string
  companyPhone: string
  companyRuc: string
  companyAddress: string
  currency: string
  taxRate: number
  timeZone: string
}

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
    organizationsWithSettings: number
    currencies: Array<[string, number]>
    timezones: Array<[string, number]>
  }
  updatedAt: string | null
  updatedByEmail: string | null
  loadErrors: string[]
}

const TIMEZONES = [
  'America/Asuncion', 'America/Argentina/Buenos_Aires', 'America/Sao_Paulo', 'America/Montevideo',
  'America/Santiago', 'America/La_Paz', 'America/Lima', 'America/Bogota', 'America/Mexico_City', 'Europe/Madrid', 'UTC',
]

/**
 * Opciones que existen en la base pero que ninguna parte de la app aplica
 * (auditado el 2026-09-27). Se muestran deshabilitadas para no dar una falsa
 * sensación de control; `reason` dice qué haría falta para que funcionen.
 */
const NOT_IMPLEMENTED: Array<{ key: keyof PlatformSettingsData['storedFlags']; label: string; reason: string; kind: 'bool' | 'number'; unit?: string }> = [
  { key: 'maintenanceMode', label: 'Modo mantenimiento de la plataforma', kind: 'bool', reason: 'El sitio no lo consulta. El mantenimiento que sí funciona es el de cada tienda (Sitio web → Mantenimiento).' },
  { key: 'allowRegistration', label: 'Registro público de empresas', kind: 'bool', reason: 'El alta en /register no lo revisa: el registro siempre está abierto.' },
  { key: 'requireEmailVerification', label: 'Verificación de email obligatoria', kind: 'bool', reason: 'Se controla en Supabase → Authentication → Providers → Email (Confirm email).' },
  { key: 'requireTwoFactor', label: '2FA obligatorio', kind: 'bool', reason: 'Requiere activar MFA en Supabase Auth y pedir el segundo factor al iniciar sesión.' },
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

export function SettingsCenter({ data }: { data: PlatformSettingsData }) {
  const router = useRouter()
  const [values, setValues] = useState<PlatformDefaults>(data.defaults)
  const [pending, startTransition] = useTransition()

  const changed = useMemo(
    () => (Object.keys(values) as Array<keyof PlatformDefaults>).filter((k) => values[k] !== data.defaults[k]),
    [values, data.defaults],
  )

  const set = <K extends keyof PlatformDefaults>(key: K, value: PlatformDefaults[K]) => setValues((v) => ({ ...v, [key]: value }))

  const save = () =>
    startTransition(async () => {
      const settings = Object.fromEntries(changed.map((k) => [k, values[k]]))
      const response = await fetch('/api/admin/system/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      })
      const payload = await response.json().catch(() => null) as { success?: boolean; error?: string } | null
      if (!response.ok || !payload?.success) {
        toast.error(payload?.error ?? 'No se pudo guardar')
        return
      }
      toast.success('Configuración guardada')
      router.refresh()
    })

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Settings}
        title="Configuración de la plataforma"
        description="Valores por defecto que usan las tiendas cuando no configuraron los suyos. Cada tienda puede cambiarlos en su propio panel."
        actions={
          <Button onClick={save} disabled={pending || changed.length === 0}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar {changed.length ? `(${changed.length})` : ''}
          </Button>
        }
      />

      {data.loadErrors.length > 0 && <Notice tone="error">{data.loadErrors.join(' · ')}</Notice>}
      <p className="text-xs text-slate-500">
        Última modificación: {formatDate(data.updatedAt)}{data.updatedByEmail ? ` por ${data.updatedByEmail}` : ''}. Cada cambio queda en la auditoría.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4" /> Datos de la empresa por defecto</CardTitle>
            <CardDescription>Se usan en recibos y comprobantes de las tiendas que todavía no cargaron sus datos.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
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
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Globe2 className="h-4 w-4" /> Regional</CardTitle>
            <CardDescription>Moneda, IVA y zona horaria para tiendas sin configuración propia.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Moneda</Label>
                <Select value={values.currency} onValueChange={(v) => set('currency', v)}>
                  <SelectTrigger aria-label="Moneda"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_CURRENCIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.code} · {c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="settings-tax">IVA (%)</Label>
                <Input id="settings-tax" type="number" min={0} max={100} step={0.5} value={values.taxRate} onChange={(e) => set('taxRate', Number(e.target.value))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Zona horaria</Label>
              <Select value={values.timeZone} onValueChange={(v) => set('timeZone', v)}>
                <SelectTrigger aria-label="Zona horaria"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[...new Set([values.timeZone, ...TIMEZONES])].map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">
              <p className="font-medium">Uso actual en {data.usage.organizationsWithSettings} tiendas con configuración propia</p>
              <p>Monedas: {data.usage.currencies.map(([c, n]) => `${c} (${n})`).join(', ') || '—'}</p>
              <p>Zonas horarias: {data.usage.timezones.map(([t, n]) => `${t} (${n})`).join(', ') || '—'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Ban className="h-4 w-4" /> Opciones sin implementar</CardTitle>
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
    </div>
  )
}
