'use client'

import { AppImage } from '@/components/ui/app-image'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  getPasswordChecks,
  passwordByteLength,
  PASSWORD_MAX_BYTES,
  sanitizeRedirectPath,
  validatePassword,
} from '@/lib/auth/password-validation'
import {
  describePasswordUpdateError,
  establishRecoverySession,
  RECOVERY_FAILURE_COPY,
  stripRecoveryParams,
  type RecoveryFailure,
} from '@/lib/auth/recovery-link'
import { usePlatformBranding } from '@/hooks/use-platform-branding'
import { buildMfaPath } from '@/lib/auth/mfa'
import { loadMfaState } from '@/lib/auth/mfa-client'

type ViewState =
  | { step: 'checking' }
  | { step: 'error'; reason: RecoveryFailure }
  | { step: 'form' }
  | { step: 'success' }

const SUCCESS_REDIRECT_MS = 2500

function passwordStrength(password: string, allChecksMet: boolean): { level: 0 | 1 | 2 | 3; label: string } {
  if (!password) return { level: 0, label: '' }
  if (!allChecksMet) return { level: 1, label: 'Todavía no cumple los requisitos' }
  if (password.length >= 12) return { level: 3, label: 'Muy segura' }
  return { level: 2, label: 'Segura · con 12 caracteres o más es todavía mejor' }
}

export default function ResetPasswordContent() {
  const [view, setView] = useState<ViewState>({ step: 'checking' })
  const [email, setEmail] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const [confirmTouched, setConfirmTouched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // «Cambio de contraseña seguro» de Supabase: con una sesión de más de 24 h
  // pide un código de 6 dígitos que llega por correo.
  const [needsCode, setNeedsCode] = useState(false)
  const [code, setCode] = useState('')
  const [sendingCode, setSendingCode] = useState(false)
  const linkHrefRef = useRef<string>('')

  const router = useRouter()
  const searchParams = useSearchParams()
  const next = sanitizeRedirectPath(searchParams.get('next'))
  const loginHref = `/login?redirect=${encodeURIComponent(next)}`
  const newLinkHref = `/login?recuperar=1&redirect=${encodeURIComponent(next)}`
  // Un solo cliente por montaje: si cambiara, el efecto volvería a validar el
  // enlace y pisaría el estado del formulario.
  const [supabase] = useState(() => createClient())
  const { branding } = usePlatformBranding()
  const reduceMotion = useReducedMotion()

  const passwordId = useId()
  const confirmId = useId()
  const checksId = useId()
  const confirmHintId = useId()
  const codeId = useId()

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      linkHrefRef.current = window.location.href
      try {
        const result = await establishRecoverySession(supabase.auth, window.location.href, () => window.location.href)
        if (cancelled) return

        if ('reason' in result) {
          console.warn('[reset-password] enlace de recuperación no válido', { reason: result.reason })
          setView({ step: 'error', reason: result.reason })
          return
        }

        // El enlace ya se usó: que no quede en la barra ni en el historial.
        window.history.replaceState(window.history.state, '', stripRecoveryParams(window.location.href))
        setEmail(result.email)

        // Con 2FA activa, Supabase sólo deja cambiar la contraseña después del código.
        if ((await loadMfaState(supabase).catch(() => null))?.pending) {
          router.replace(buildMfaPath(`/auth/reset-password?next=${encodeURIComponent(next)}`))
          return
        }

        setView({ step: 'form' })
      } catch (err) {
        console.error('[reset-password] error validando el enlace', err)
        if (!cancelled) setView({ step: 'error', reason: 'unknown' })
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [router, supabase, next])

  const checks = useMemo(() => getPasswordChecks(password), [password])
  const tooLong = passwordByteLength(password) > PASSWORD_MAX_BYTES
  const allChecksMet = checks.every((c) => c.ok) && !tooLong
  const strength = passwordStrength(password, allChecksMet)
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword
  const showMismatch = confirmTouched && confirmPassword.length > 0 && !passwordsMatch
  const codeComplete = /^\d{6}$/.test(code)
  const canSubmit = allChecksMet && passwordsMatch && !loading && !sendingCode && (!needsCode || codeComplete)

  const sendCode = async (): Promise<boolean> => {
    setSendingCode(true)
    try {
      const { error: reauthError } = await supabase.auth.reauthenticate()
      if (reauthError) {
        setError(describePasswordUpdateError(reauthError).message)
        return false
      }
      toast.success(email ? `Te enviamos un código a ${email}` : 'Te enviamos un código por correo')
      return true
    } catch (err) {
      setError(describePasswordUpdateError(err as Error).message)
      return false
    } finally {
      setSendingCode(false)
    }
  }

  const handleCapsLock = (event: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLock(event.getModifierState?.('CapsLock') ?? false)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setConfirmTouched(true)

    const problem = validatePassword(password)
    if (problem) {
      setError(problem)
      return
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    if (needsCode && !codeComplete) {
      setError('Escribí el código de 6 dígitos que te llegó por correo.')
      return
    }

    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser(
        needsCode ? { password, nonce: code } : { password }
      )
      if (updateError) {
        const described = describePasswordUpdateError(updateError)
        console.warn('[reset-password] updateUser falló', { kind: described.kind, code: updateError.code })
        if (described.kind === 'reauth') {
          setNeedsCode(true)
          setCode('')
          await sendCode()
          return
        }
        if (described.kind === 'session') {
          setView({ step: 'error', reason: 'expired' })
          return
        }
        if (described.kind === 'mfa') {
          router.replace(buildMfaPath(`/auth/reset-password?next=${encodeURIComponent(next)}`))
          return
        }
        setError(described.message)
        return
      }

      // Si alguien más tenía la cuenta abierta, que pierda el acceso.
      await supabase.auth.signOut({ scope: 'others' }).catch(() => undefined)

      setView({ step: 'success' })
      toast.success('Contraseña actualizada')
      setTimeout(() => router.push(next), SUCCESS_REDIRECT_MS)
    } catch (err) {
      setError(describePasswordUpdateError(err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(linkHrefRef.current)
      toast.success('Enlace copiado. Pegalo en el navegador donde lo pediste.')
    } catch {
      toast.error('No se pudo copiar. Mantené presionado el enlace del correo y elegí «Copiar».')
    }
  }

  const motionProps = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -8 },
        transition: { duration: 0.3, ease: [0.23, 1, 0.32, 1] as const },
      }

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center bg-slate-50 px-4 py-10 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-blue-50 to-transparent dark:from-blue-500/[0.06]"
      />

      <div className="relative z-10 w-full max-w-[420px]">
        <div className="mb-6 flex justify-center">
          {branding.logoUrl ? (
            <AppImage
              src={branding.logoUrl}
              alt={branding.platformName}
              className="h-10 w-auto max-w-[180px] object-contain"
            />
          ) : (
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
                <Building2 className="h-4 w-4" />
              </span>
              {branding.platformName}
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <AnimatePresence mode="wait">
            {view.step === 'checking' && (
              <motion.div
                key="checking"
                {...motionProps}
                className="flex flex-col items-center gap-3 px-8 py-14 text-center"
                role="status"
                aria-live="polite"
              >
                <Loader2 className="h-7 w-7 animate-spin text-blue-600 dark:text-blue-400" />
                <p className="text-sm font-medium">Validando tu enlace…</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Esto tarda sólo un momento.</p>
              </motion.div>
            )}

            {view.step === 'error' && (
              <motion.div key="error" {...motionProps} className="space-y-6 p-6 sm:p-8" role="alert">
                <div className="space-y-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <h1 className="text-xl font-bold tracking-tight">{RECOVERY_FAILURE_COPY[view.reason].title}</h1>
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {RECOVERY_FAILURE_COPY[view.reason].description}
                  </p>
                  {RECOVERY_FAILURE_COPY[view.reason].hint && (
                    <p className="rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                      {RECOVERY_FAILURE_COPY[view.reason].hint}
                    </p>
                  )}
                </div>

                <div className="space-y-2.5">
                  <Button asChild className="h-11 w-full rounded-xl bg-blue-600 font-semibold text-white hover:bg-blue-700">
                    <Link href={newLinkHref}>
                      <Mail className="mr-2 h-4 w-4" />
                      Pedir un enlace nuevo
                    </Link>
                  </Button>
                  {view.reason === 'other-browser' && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={copyLink}
                      className="h-11 w-full rounded-xl border-slate-200 dark:border-slate-700"
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Copiar este enlace
                    </Button>
                  )}
                </div>
              </motion.div>
            )}

            {view.step === 'form' && (
              <motion.div key="form" {...motionProps} className="space-y-6 p-6 sm:p-8">
                <div className="space-y-2">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <h1 className="text-xl font-bold tracking-tight">Creá tu nueva contraseña</h1>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {email ? (
                      <>
                        Para la cuenta <span className="font-medium text-slate-900 dark:text-white">{email}</span>
                      </>
                    ) : (
                      <>Elegí una contraseña que no uses en otros sitios.</>
                    )}
                  </p>
                </div>

                <form onSubmit={handleSubmit} noValidate className="space-y-5">
                  {/* Para que el gestor de contraseñas guarde la clave en la cuenta correcta. */}
                  {email && (
                    <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
                  )}

                  <div className="space-y-2">
                    <Label htmlFor={passwordId} className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      Nueva contraseña
                    </Label>
                    <div className="relative">
                      <Input
                        id={passwordId}
                        name="new-password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        autoFocus
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value)
                          if (error) setError('')
                        }}
                        onKeyUp={handleCapsLock}
                        onKeyDown={handleCapsLock}
                        aria-describedby={checksId}
                        aria-invalid={password.length > 0 && !allChecksMet}
                        disabled={loading}
                        className="h-11 rounded-xl border-slate-200 bg-white pr-11 dark:border-slate-700 dark:bg-slate-950"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}
                        aria-pressed={showPassword}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition-colors hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:hover:text-slate-200"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>

                    {capsLock && (
                      <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400">Bloq Mayús está activado.</p>
                    )}

                    <div className="space-y-2 pt-1" id={checksId}>
                      <div className="flex gap-1" aria-hidden>
                        {[1, 2, 3].map((segment) => (
                          <div
                            key={segment}
                            className={cn(
                              'h-1 flex-1 rounded-full bg-slate-200 transition-colors dark:bg-slate-800',
                              segment <= strength.level &&
                                (strength.level === 1
                                  ? 'bg-red-500 dark:bg-red-500'
                                  : strength.level === 2
                                    ? 'bg-emerald-500 dark:bg-emerald-500'
                                    : 'bg-emerald-600 dark:bg-emerald-400')
                            )}
                          />
                        ))}
                      </div>
                      {strength.label && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400" aria-live="polite">
                          {strength.label}
                        </p>
                      )}
                      <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                        {checks.map((check) => (
                          <li
                            key={check.label}
                            className={cn(
                              'flex items-center gap-1.5 text-[11px] transition-colors',
                              check.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'
                            )}
                          >
                            {check.ok ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : (
                              <span className="mx-1 h-1.5 w-1.5 rounded-full bg-current opacity-50" />
                            )}
                            <span>{check.label}</span>
                            <span className="sr-only">{check.ok ? '(cumplido)' : '(pendiente)'}</span>
                          </li>
                        ))}
                      </ul>
                      {tooLong && (
                        <p className="text-[11px] font-medium text-red-600 dark:text-red-400">
                          Máximo {PASSWORD_MAX_BYTES} caracteres.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={confirmId} className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      Repetí la contraseña
                    </Label>
                    <div className="relative">
                      <Input
                        id={confirmId}
                        name="confirm-password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value)
                          if (error) setError('')
                        }}
                        onBlur={() => setConfirmTouched(true)}
                        onKeyUp={handleCapsLock}
                        aria-describedby={confirmHintId}
                        aria-invalid={showMismatch}
                        disabled={loading}
                        className={cn(
                          'h-11 rounded-xl border-slate-200 bg-white pr-10 dark:border-slate-700 dark:bg-slate-950',
                          showMismatch && 'border-red-400 focus-visible:ring-red-400/30 dark:border-red-500/60',
                          passwordsMatch && 'border-emerald-400 dark:border-emerald-500/60'
                        )}
                      />
                      {confirmPassword.length > 0 && (
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                          {passwordsMatch ? (
                            <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          ) : showMismatch ? (
                            <X className="h-4 w-4 text-red-500" />
                          ) : null}
                        </span>
                      )}
                    </div>
                    <p id={confirmHintId} className="min-h-[16px] text-[11px]" aria-live="polite">
                      {showMismatch && (
                        <span className="font-medium text-red-600 dark:text-red-400">Las contraseñas no coinciden.</span>
                      )}
                      {passwordsMatch && <span className="text-emerald-700 dark:text-emerald-400">Las contraseñas coinciden.</span>}
                    </p>
                  </div>

                  {needsCode && (
                    <div className="space-y-2 rounded-xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-500/30 dark:bg-blue-500/10">
                      <Label htmlFor={codeId} className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                        Código de verificación
                      </Label>
                      <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                        Por seguridad, Supabase pide confirmar el cambio. Te enviamos un código de 6 dígitos
                        {email ? <> a <span className="font-medium">{email}</span></> : ' por correo'}.
                      </p>
                      <Input
                        id={codeId}
                        name="one-time-code"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="\d{6}"
                        maxLength={6}
                        autoFocus
                        value={code}
                        onChange={(e) => {
                          setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                          if (error) setError('')
                        }}
                        disabled={loading}
                        placeholder="123456"
                        className="h-11 rounded-xl border-slate-200 bg-white text-center font-mono text-lg tracking-[0.4em] dark:border-slate-700 dark:bg-slate-950"
                      />
                      <button
                        type="button"
                        onClick={() => void sendCode()}
                        disabled={sendingCode || loading}
                        className="text-[11px] font-medium text-blue-700 underline-offset-2 hover:underline disabled:opacity-50 dark:text-blue-300"
                      >
                        {sendingCode ? 'Enviando…' : 'Reenviar código'}
                      </button>
                    </div>
                  )}

                  {error && (
                    <div
                      role="alert"
                      className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium leading-relaxed text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
                    >
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={!canSubmit}
                    className="h-11 w-full rounded-xl bg-blue-600 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Guardando…
                      </>
                    ) : (
                      <>
                        Guardar contraseña
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              </motion.div>
            )}

            {view.step === 'success' && (
              <motion.div
                key="success"
                {...motionProps}
                className="space-y-5 p-8 text-center"
                role="status"
                aria-live="polite"
              >
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <div className="space-y-1.5">
                  <h1 className="text-xl font-bold tracking-tight">¡Listo, contraseña cambiada!</h1>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Ya podés usarla para entrar. Por seguridad cerramos la sesión en tus otros dispositivos.
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => router.push(next)}
                  className="h-11 w-full rounded-xl bg-blue-600 font-semibold text-white hover:bg-blue-700"
                >
                  Continuar
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {view.step !== 'success' && (
            <div className="border-t border-slate-100 bg-slate-50/60 px-6 py-4 text-center dark:border-slate-800 dark:bg-slate-900/60">
              <Link
                href={loginHref}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Volver al inicio de sesión
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
