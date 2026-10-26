'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { KeyRound, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'

type Policy = { requireAdminMfa: boolean; canChange: boolean }

const ENDPOINT = '/api/admin/security/mfa-policy'

/**
 * «Exigir verificación en dos pasos a los administradores» de la organización
 * activa. Sólo se puede cambiar con una sesión que ya pasó el código: el
 * servidor y la base lo vuelven a verificar.
 */
export function AdminMfaPolicyCard() {
  const [policy, setPolicy] = useState<Policy | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    fetch(ENDPOINT, { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json().catch(() => null)
        if (!active) return
        if (!response.ok) {
          setLoadError(body?.error || 'No se pudo cargar esta opción.')
          return
        }
        setPolicy(body as Policy)
      })
      .catch(() => active && setLoadError('No se pudo cargar esta opción.'))
    return () => {
      active = false
    }
  }, [])

  const toggle = async (requireAdminMfa: boolean) => {
    setSaving(true)
    try {
      const response = await fetch(ENDPOINT, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requireAdminMfa }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(body?.error || 'No se pudo guardar.')
        return
      }
      setPolicy(body as Policy)
      toast.success(
        requireAdminMfa
          ? 'Listo. Los administradores tendrán que usar la verificación en dos pasos.'
          : 'Ya no se exige la verificación en dos pasos a los administradores.'
      )
    } catch {
      toast.error('No se pudo guardar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="rounded-2xl border border-border/80 shadow-xs">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3.5">
          <div className="mt-0.5 rounded-lg bg-purple-500/10 p-2.5 text-purple-600">
            <KeyRound className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">Exigir verificación en dos pasos a los administradores</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              El dueño y los administradores van a necesitar un código de una app autenticadora para entrar al panel.
              Quien todavía no la tenga, la va a tener que activar al iniciar sesión.
            </p>
            {loadError && <p className="text-xs text-destructive">{loadError}</p>}
            {policy && !policy.canChange && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Para cambiar esta opción, primero activá la verificación en dos pasos en{' '}
                <Link href="/dashboard/profile" className="font-medium underline">tu perfil</Link>{' '}
                y volvé a iniciar sesión con el código.
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 sm:shrink-0">
          {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <Switch
            checked={policy?.requireAdminMfa ?? false}
            onCheckedChange={toggle}
            disabled={!policy || !policy.canChange || saving}
            aria-label="Exigir verificación en dos pasos a los administradores"
          />
        </div>
      </CardContent>
    </Card>
  )
}
