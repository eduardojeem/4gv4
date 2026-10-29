'use client'

import { useCallback, useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { Loader2, Smartphone, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Factor } from '@supabase/supabase-js'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TotpEnrollment } from '@/components/auth/totp-enrollment'
import { createClient } from '@/lib/supabase/client'
import { describeMfaError } from '@/lib/auth/mfa'
import { loadMfaState } from '@/lib/auth/mfa-client'

function relative(date: string) {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: es })
}

type TwoFactorSectionProps = {
  /** Avisa si quedó activa o no (para el puntaje de seguridad del perfil). */
  onStatusChange?: (enabled: boolean) => void
}

/**
 * Verificación en dos pasos con app autenticadora (TOTP nativo de Supabase):
 * activar con QR, ver las apps cargadas y desactivar. Desactivar una app ya
 * verificada lo permite Supabase sólo con una sesión que pasó el código (aal2).
 */
export function TwoFactorSection({ onStatusChange }: TwoFactorSectionProps) {
  const [factors, setFactors] = useState<Factor[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const state = await loadMfaState(createClient())
      setFactors(state.totpFactors)
      setLoadError(null)
      onStatusChange?.(state.totpFactors.length > 0)
    } catch (err) {
      setLoadError(describeMfaError(err))
    } finally {
      setLoading(false)
    }
  }, [onStatusChange])

  useEffect(() => {
    void load()
  }, [load])

  const handleEnrolled = async () => {
    setAdding(false)
    await load()
  }

  const handleRemove = async (factor: Factor) => {
    const last = factors.length === 1
    const message = last
      ? '¿Desactivar la verificación en dos pasos? Para entrar alcanzará otra vez con la contraseña.'
      : `¿Quitar «${factor.friendly_name || 'App autenticadora'}»? Esa app ya no servirá para entrar.`
    if (!window.confirm(message)) return

    setRemovingId(factor.id)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id })
      if (error) {
        toast.error(describeMfaError(error))
        return
      }
      toast.success(last ? 'Verificación en dos pasos desactivada.' : 'App autenticadora quitada.')
      await load()
    } finally {
      setRemovingId(null)
    }
  }

  const enabled = factors.length > 0

  return (
    <div className="rounded-xl border border-border/60 p-4 bg-card space-y-4">
      <div className="flex items-start gap-3.5">
        <div className="rounded-lg bg-purple-500/10 p-2.5 mt-0.5 text-purple-600">
          <Smartphone className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-sm text-foreground">Verificación en dos pasos (2FA)</p>
            {!loading && (
              <Badge
                variant="outline"
                className={enabled ? 'text-[10px] border-emerald-500/40 text-emerald-600' : 'text-[10px]'}
              >
                {enabled ? 'Activada' : 'Desactivada'}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Además de la contraseña (o la huella), al iniciar sesión se pide un código de 6 dígitos de una app
            autenticadora en tu teléfono. Si alguien consigue tu contraseña, no puede entrar sin el teléfono.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Cargando…</p>
      ) : loadError ? (
        <p className="text-xs text-muted-foreground">{loadError}</p>
      ) : (
        <>
          {enabled && (
            <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
              {factors.map((factor) => (
                <li key={factor.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{factor.friendly_name || 'App autenticadora'}</p>
                    <p className="text-[11px] text-muted-foreground">Activada {relative(factor.created_at)}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemove(factor)}
                    disabled={removingId === factor.id}
                    aria-label={`Quitar ${factor.friendly_name || 'app autenticadora'}`}
                  >
                    {removingId === factor.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    {factors.length === 1 ? 'Desactivar' : 'Quitar'}
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {!enabled || adding ? (
            <TotpEnrollment
              onEnrolled={handleEnrolled}
              onCancel={() => setAdding(false)}
              startLabel={enabled ? 'Configurar otra app' : 'Activar con app autenticadora'}
            />
          ) : (
            <Button size="sm" variant="outline" className="text-xs" onClick={() => setAdding(true)}>
              Agregar otra app autenticadora
            </Button>
          )}
        </>
      )}
    </div>
  )
}
