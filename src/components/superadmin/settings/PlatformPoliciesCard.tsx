'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Loader2, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { PASSWORD_MIN_LENGTH_RANGE, type PlatformPolicies } from '@/lib/platform/policies'
import { PLATFORM_SETTINGS_CODES } from '@/lib/superadmin/platform-settings'
import { TwoFactorExplainer } from '@/components/security/TwoFactorExplainer'

type Props = {
  initial: PlatformPolicies
  /** La fila cambia de revisión al guardar: el formulario de valores por defecto la necesita. */
  onSaved: (updatedAt: string | null) => void
}

const SWITCHES: Array<{ key: 'maintenanceMode' | 'allowRegistration' | 'requireTwoFactor'; label: string; on: string; off: string }> = [
  {
    key: 'maintenanceMode',
    label: 'Modo mantenimiento de la plataforma',
    on: 'Prendido: las tiendas ven una pantalla de mantenimiento en su panel y en sus páginas públicas. Vos seguís entrando al superadmin; la app móvil, los cobros y las tareas automáticas siguen funcionando.',
    off: 'Apagado: todo funciona normal. El mantenimiento de una sola tienda se prende desde su Sitio web.',
  },
  {
    key: 'allowRegistration',
    label: 'Registro público de empresas',
    on: 'Abierto: cualquiera puede crear su tienda desde /register.',
    off: 'Cerrado: el alta se rechaza. Las tiendas existentes no se ven afectadas.',
  },
  {
    key: 'requireTwoFactor',
    label: 'Verificación en dos pasos para administradores de todas las tiendas',
    on: 'Exigida: dueños y administradores de cualquier tienda tienen que activar la app autenticadora para entrar al panel.',
    off: 'Cada tienda decide desde su Seguridad. Al superadmin se le exige siempre.',
  },
]

export function PlatformPoliciesCard({ initial, onSaved }: Props) {
  const [saved, setSaved] = useState(initial)
  const [values, setValues] = useState(initial)
  const [lengthText, setLengthText] = useState(String(initial.passwordMinLength))
  const [saving, setSaving] = useState(false)

  const length = Number(lengthText)
  const lengthError = !Number.isInteger(length) || length < PASSWORD_MIN_LENGTH_RANGE.min || length > PASSWORD_MIN_LENGTH_RANGE.max
    ? `Entre ${PASSWORD_MIN_LENGTH_RANGE.min} y ${PASSWORD_MIN_LENGTH_RANGE.max} caracteres.`
    : null
  const changes: Partial<PlatformPolicies> = {}
  for (const item of SWITCHES) if (values[item.key] !== saved[item.key]) changes[item.key] = values[item.key]
  if (!lengthError && length !== saved.passwordMinLength) changes.passwordMinLength = length
  const dirty = Object.keys(changes).length > 0

  const save = async () => {
    if (!dirty || lengthError || saving) return
    if (changes.maintenanceMode === true && !window.confirm('¿Poner toda la plataforma en mantenimiento? Las tiendas no van a poder usar su panel hasta que lo apagues.')) return
    setSaving(true)
    try {
      const response = await fetch('/api/superadmin/settings/policies', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      })
      const payload = await response.json().catch(() => null) as {
        success?: boolean; error?: string; code?: string; mfaPath?: string
        data?: { policies: PlatformPolicies; updatedAt: string | null }
      } | null
      if (!response.ok || !payload?.success || !payload.data) {
        if (payload?.code === PLATFORM_SETTINGS_CODES.mfaRequired && payload.mfaPath) {
          toast.error(payload.error ?? 'Confirmá tu sesión con la verificación en dos pasos.', {
            action: { label: 'Verificar', onClick: () => { window.location.href = payload.mfaPath! } },
          })
          return
        }
        throw new Error(payload?.error ?? `No se pudo guardar (${response.status}).`)
      }
      setSaved(payload.data.policies)
      setValues(payload.data.policies)
      setLengthText(String(payload.data.policies.passwordMinLength))
      onSaved(payload.data.updatedAt)
      toast.success('Políticas guardadas. Se aplican en menos de un minuto.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudieron guardar las políticas.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="rounded-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4" aria-hidden /> Políticas de la plataforma</CardTitle>
        <CardDescription>Se aplican a todas las tiendas, en menos de un minuto desde que guardás.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        <ul className="divide-y dark:divide-slate-800">
          {SWITCHES.map((item) => (
            <li key={item.key} className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {item.label}
                  {item.key === 'maintenanceMode' && values.maintenanceMode && <Badge variant="destructive" className="rounded-full text-[10px]">Activo</Badge>}
                </p>
                <p className="text-xs text-slate-500">{values[item.key] ? item.on : item.off}</p>
                {item.key === 'requireTwoFactor' && (
                  <div className="mt-2 space-y-2">
                    <p className="text-xs text-slate-500">
                      Tu propia verificación se configura en <Link href="/dashboard/profile" className="font-medium text-primary underline-offset-4 hover:underline">tu perfil</Link>.
                    </p>
                    <TwoFactorExplainer scope="platform" />
                  </div>
                )}
              </div>
              <Switch
                checked={values[item.key]}
                onCheckedChange={(checked) => setValues((current) => ({ ...current, [item.key]: checked }))}
                disabled={saving}
                aria-label={item.label}
              />
            </li>
          ))}
          <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium">Largo mínimo de contraseña al registrarse</p>
              <p className="text-xs text-slate-500">Se exige al crear una empresa. Supabase además aplica su propio mínimo.</p>
              {lengthError && <p className="text-xs text-destructive">{lengthError}</p>}
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                inputMode="numeric"
                min={PASSWORD_MIN_LENGTH_RANGE.min}
                max={PASSWORD_MIN_LENGTH_RANGE.max}
                value={lengthText}
                onChange={(event) => setLengthText(event.target.value)}
                className="h-9 w-20"
                disabled={saving}
                aria-label="Largo mínimo de contraseña"
                aria-invalid={Boolean(lengthError)}
              />
              <span className="text-sm text-slate-500">caracteres</span>
            </div>
          </li>
        </ul>
        <div className="flex justify-end pt-2">
          <Button onClick={() => void save()} disabled={!dirty || Boolean(lengthError) || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar políticas
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
