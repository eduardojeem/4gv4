'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, LogOut, ShieldCheck, Smartphone } from 'lucide-react'
import type { Factor } from '@supabase/supabase-js'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { TotpCodeInput } from '@/components/auth/totp-code-input'
import { TotpEnrollment } from '@/components/auth/totp-enrollment'
import { createClient } from '@/lib/supabase/client'
import { sanitizeRedirectPath } from '@/lib/auth/password-validation'
import { describeMfaError, isCompleteTotpCode } from '@/lib/auth/mfa'
import { loadMfaState, verifyTotpCode } from '@/lib/auth/mfa-client'
import { logAuthEventClient } from '@/lib/auth-event-client'

type Mode = 'loading' | 'verify' | 'setup'

/**
 * Segundo paso del inicio de sesión. Llegan acá:
 * - quien tiene 2FA activa y acaba de entrar con contraseña o passkey (`aal1`);
 * - con `?setup=1`, un administrador cuya organización exige 2FA y todavía no la activó.
 * El proxy manda acá desde cualquier página privada mientras falte el paso.
 */
export default function MfaContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = sanitizeRedirectPath(searchParams.get('redirect'), '/dashboard')
  const setupRequested = searchParams.get('setup') === '1'

  const [mode, setMode] = useState<Mode>('loading')
  const [factors, setFactors] = useState<Factor[]>([])
  const [factorId, setFactorId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const submittedCode = useRef<string | null>(null)

  const finish = useCallback(async (verified: boolean) => {
    if (verified) {
      const { data: { user } } = await createClient().auth.getUser()
      await logAuthEventClient({
        userId: user?.id,
        action: 'login',
        success: true,
        userAgent: window.navigator.userAgent,
        details: { method: 'totp' },
      })
    }
    // Igual que el login: deja elegida la organización activa antes de entrar al panel.
    await fetch('/api/organizations', { method: 'GET', cache: 'no-store' }).catch(() => undefined)
    // Navegación completa: `router.replace` + `router.refresh` dejaba al refresh
    // pisar la navegación y la página se quedaba acá. Así el servidor además
    // recibe la cookie con la sesión aal2 recién emitida.
    window.location.replace(redirectTo)
  }, [redirectTo])

  useEffect(() => {
    let active = true
    const run = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!active) return
      if (!user) {
        router.replace(`/login?redirect=${encodeURIComponent(redirectTo)}`)
        return
      }
      try {
        const state = await loadMfaState(supabase)
        if (!active) return
        if (state.pending) {
          setFactors(state.totpFactors)
          setFactorId(state.totpFactors[0]?.id ?? null)
          setMode('verify')
        } else if (setupRequested && state.currentLevel !== 'aal2') {
          setMode('setup')
        } else {
          await finish(false)
        }
      } catch (err) {
        if (!active) return
        setError(describeMfaError(err))
        setMode('verify')
      }
    }
    void run()
    return () => {
      active = false
    }
  }, [finish, redirectTo, router, setupRequested])

  const verify = async (value = code) => {
    if (!factorId || !isCompleteTotpCode(value) || verifying) return
    submittedCode.current = value
    setVerifying(true)
    setError(null)
    try {
      await verifyTotpCode(createClient(), factorId, value)
      await finish(true)
    } catch (err) {
      setError(describeMfaError(err))
      setCode('')
      setVerifying(false)
    }
  }

  const changeCode = (next: string) => {
    setCode(next)
    if (error) setError(null)
    // Al completar los 6 dígitos se verifica solo (una vez por código).
    if (isCompleteTotpCode(next) && submittedCode.current !== next) void verify(next)
  }

  const signOut = async () => {
    setSigningOut(true)
    await createClient().auth.signOut().catch(() => undefined)
    window.location.replace('/login')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-500/20">
            {mode === 'setup' ? <ShieldCheck className="h-6 w-6" /> : <Smartphone className="h-6 w-6" />}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {mode === 'setup' ? 'Activá la verificación en dos pasos' : 'Verificación en dos pasos'}
          </h1>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            {mode === 'setup'
              ? 'Tu organización la exige a los administradores. Cargá tu cuenta en una app autenticadora para continuar.'
              : 'Escribí el código de 6 dígitos que muestra tu app autenticadora.'}
          </p>
        </div>

        {mode === 'loading' && (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        )}

        {mode === 'verify' && (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void verify()
            }}
            className="space-y-4"
            noValidate
          >
            {factors.length > 1 && (
              <div className="space-y-1.5">
                <Label htmlFor="mfa-factor" className="text-xs">App autenticadora</Label>
                <select
                  id="mfa-factor"
                  value={factorId ?? ''}
                  onChange={(event) => setFactorId(event.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                >
                  {factors.map((factor) => (
                    <option key={factor.id} value={factor.id}>{factor.friendly_name || 'App autenticadora'}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="mfa-code" className="text-xs">Código</Label>
              <TotpCodeInput
                id="mfa-code"
                value={code}
                onChange={changeCode}
                disabled={verifying || !factorId}
                autoFocus
                className="rounded-xl"
              />
            </div>

            {error && (
              <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300" role="alert">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="h-11 w-full rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 font-semibold text-white"
              disabled={verifying || !factorId || !isCompleteTotpCode(code)}
            >
              {verifying ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verificando…</> : 'Verificar'}
            </Button>

            <p className="text-center text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              ¿Perdiste el teléfono? Pedile al soporte de la plataforma que desactive la verificación en dos pasos de tu cuenta.
            </p>
          </form>
        )}

        {mode === 'setup' && <TotpEnrollment onEnrolled={() => finish(true)} startLabel="Configurar app autenticadora" />}

        {mode !== 'loading' && (
          <div className="mt-6 border-t border-slate-200 pt-4 text-center dark:border-slate-800">
            <Button type="button" variant="ghost" size="sm" onClick={signOut} disabled={signingOut} className="gap-1.5 text-xs">
              {signingOut ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
              Usar otra cuenta
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
