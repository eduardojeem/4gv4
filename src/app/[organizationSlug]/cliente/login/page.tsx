'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CreditCard,
  Eye,
  EyeOff,
  Info,
  LayoutDashboard,
  Link2,
  Loader2,
  LockKeyhole,
  ReceiptText,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  User,
  Wrench,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { TurnstileChallenge } from '@/components/security/TurnstileChallenge'
import { isValidEmail } from '@/lib/auth/password-validation'

export default function TenantCustomerLoginPage() {
  const params = useParams<{ organizationSlug: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const organizationSlug = params.organizationSlug
  const supabase = useMemo(() => createClient(), [])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaResetKey, setCaptchaResetKey] = useState(0)
  const [resetLoading, setResetLoading] = useState(false)
  const [linking, setLinking] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [canLinkCustomer, setCanLinkCustomer] = useState(false)
  const [isStaffMember, setIsStaffMember] = useState(false)
  const [error, setError] = useState('')
  const [errorDetail, setErrorDetail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')

  const nextHref = useMemo(() => {
    const requestedNext = searchParams.get('next')
    const tenantRoot = `/${organizationSlug}/`

    if (requestedNext?.startsWith(tenantRoot)) {
      return requestedNext
    }

    return `/${organizationSlug}/mis-reparaciones`
  }, [organizationSlug, searchParams])

  const validateCustomerScope = useCallback(async ({ redirectIfValid = true } = {}) => {
    const scopeResponse = await fetch(`/api/public/customer-scope?slug=${encodeURIComponent(organizationSlug)}`, {
      cache: 'no-store',
    })
    const scopeResult = await scopeResponse.json()

    if (scopeResult.success) {
      if (redirectIfValid) {
        toast.success('¡Bienvenido!')
        router.push(nextHref)
        router.refresh()
      }
      return true
    }

    if ((scopeResult.code === 'not_customer' || scopeResult.code === 'customer_profile_missing') && scopeResult.canLink) {
      setCanLinkCustomer(true)
      setIsStaffMember(false)
      setError(scopeResult.code === 'customer_profile_missing'
        ? 'Tu cuenta existe. Solo falta completar tu perfil de cliente en esta tienda.'
        : 'Encontramos tu cuenta. Solo falta vincularla como cliente de esta tienda para ver tus reparaciones y compras.'
      )
      return false
    }

    if (scopeResult.code === 'staff_member') {
      setCanLinkCustomer(false)
      setIsStaffMember(true)
      setError('Esta cuenta pertenece al equipo interno de la tienda. Podés continuar como cliente para consultar tus compras o reparaciones personales sin alterar tus permisos.')
      return false
    }

    setCanLinkCustomer(false)
    setIsStaffMember(false)
    setError(
      scopeResponse.status === 401
        ? 'La sesión expiró. Iniciá sesión nuevamente.'
        : scopeResult.error || 'Esta cuenta no está registrada como cliente en esta tienda.'
    )
    return false
  }, [nextHref, organizationSlug, router])

  useEffect(() => {
    let active = true

    async function checkExistingSession() {
      try {
        const { data } = await supabase.auth.getUser()

        if (!active) return

        if (!data.user) {
          setCheckingSession(false)
          return
        }

        await validateCustomerScope()
      } catch {
        if (active) {
          setError('No se pudo validar la sesión actual. Por favor, intentá nuevamente.')
        }
      } finally {
        if (active) {
          setCheckingSession(false)
        }
      }
    }

    checkExistingSession()

    return () => {
      active = false
    }
  }, [supabase, validateCustomerScope])

  const validateFields = () => {
    let isValid = true
    const cleanEmail = email.trim()

    if (!cleanEmail) {
      setEmailError('Ingresá tu correo electrónico.')
      isValid = false
    } else if (!isValidEmail(cleanEmail)) {
      setEmailError('Ingresá un formato de correo válido (ej: nombre@correo.com).')
      isValid = false
    } else {
      setEmailError('')
    }

    if (!password) {
      setPasswordError('Ingresá tu contraseña.')
      isValid = false
    } else {
      setPasswordError('')
    }

    return isValid
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setErrorDetail('')

    if (!validateFields()) {
      return
    }

    if (!captchaToken || loading) {
      setError('Por favor, completá la verificación de seguridad para continuar.')
      return
    }

    setCanLinkCustomer(false)
    setIsStaffMember(false)

    try {
      setLoading(true)
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
        options: { captchaToken },
      })

      if (loginError) {
        const msg = loginError.message || ''
        if (/invalid login credentials|invalid_grant/i.test(msg)) {
          setError('El correo o la contraseña no son correctos. Verificá los datos e intentá de nuevo.')
        } else if (/email not confirmed/i.test(msg)) {
          setError('Tu cuenta aún no fue confirmada. Revisá tu casilla de correo o spam.')
        } else if (/rate limit|too many requests/i.test(msg)) {
          setError('Demasiados intentos fallidos. Esperá unos instantes antes de volver a intentar.')
        } else if (/Failed to fetch|Network/i.test(msg)) {
          setError('No se pudo conectar con el servidor. Comprobá tu conexión a internet.')
        } else {
          setError('El correo o la contraseña no coinciden con una cuenta activa.')
        }
        return
      }

      await validateCustomerScope()
    } catch {
      setError('Ocurrió un error inesperado al iniciar sesión. Intentá nuevamente.')
    } finally {
      setLoading(false)
      setCaptchaToken(null)
      setCaptchaResetKey((current) => current + 1)
    }
  }

  async function handleLinkCustomer() {
    setError('')
    setErrorDetail('')
    setLinking(true)

    try {
      const response = await fetch('/api/public/customer-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationSlug }),
      })
      const result = await response.json()

      if (!response.ok || !result.success) {
        if (result.code === 'tenant_customer_index_required') {
          setCanLinkCustomer(false)
          setIsStaffMember(false)
        }
        setError(result.error || 'No se pudo vincular tu cuenta como cliente.')
        setErrorDetail(result.detail || '')
        return
      }

      toast.success('¡Modo cliente activado exitosamente!')
      router.push(nextHref)
      router.refresh()
    } catch {
      setError('Ocurrió un error inesperado al vincular la cuenta. Intentá de nuevo.')
      setErrorDetail('')
    } finally {
      setLinking(false)
    }
  }

  async function handleUseAnotherAccount() {
    await supabase.auth.signOut()
    setCanLinkCustomer(false)
    setIsStaffMember(false)
    setError('')
    setErrorDetail('')
    setEmail('')
    setPassword('')
    setEmailError('')
    setPasswordError('')
    setCheckingSession(false)
    toast.info('Sesión cerrada. Ingresá con tu cuenta de cliente.')
  }

  async function handleResetPassword() {
    const normalizedEmail = email.trim().toLowerCase()
    if (!isValidEmail(normalizedEmail)) {
      setEmailError('Ingresá tu correo arriba para recuperar la contraseña.')
      toast.error('Ingresá un correo electrónico válido para recuperar la contraseña.')
      return
    }
    if (!captchaToken || resetLoading) {
      toast.error('Completá la verificación de seguridad para continuar.')
      return
    }

    try {
      setResetLoading(true)
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
        captchaToken,
      })
      if (resetError) throw resetError
      toast.success('Te enviamos un enlace a tu correo para restablecer la contraseña.')
    } catch {
      toast.error('No se pudo enviar el enlace de recuperación. Intentá de nuevo.')
    } finally {
      setResetLoading(false)
      setCaptchaToken(null)
      setCaptchaResetKey((current) => current + 1)
    }
  }

  return (
    <div className="mx-auto grid min-h-[calc(100vh-8rem)] w-full max-w-5xl items-center gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(380px,440px)] lg:py-12">
      <section className="order-2 px-1 py-4 lg:order-1 lg:px-6" aria-labelledby="customer-access-benefits">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-xs">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </div>
        <p className="mt-5 text-sm font-semibold text-primary">Área privada de clientes</p>
        <h1 id="customer-access-benefits" className="mt-2 max-w-lg pr-12 text-3xl font-bold leading-tight text-foreground sm:pr-0 sm:text-4xl">
          Todo lo relacionado con tus equipos y pagos, en un solo lugar
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
          La información corresponde únicamente a esta tienda y a los registros vinculados con tu cuenta.
        </p>
        <div className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 shadow-xs">
          {[
            { icon: Wrench, title: 'Reparaciones', text: 'Estado técnico en tiempo real y equipos listos.' },
            { icon: ReceiptText, title: 'Pagos y recibos', text: 'Montos abonados, facturas y pendientes.' },
            { icon: CreditCard, title: 'Créditos en cuotas', text: 'Cuotas activas, vencimientos y saldo.' },
            { icon: ShoppingBag, title: 'Pedidos de compra', text: 'Historial de compras, retiro y delivery.' },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex min-h-28 gap-3 bg-card p-4">
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-foreground">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Card className="order-1 w-full rounded-2xl shadow-xl border-border/80 lg:order-2">
        <CardHeader className="space-y-3 pb-4">
          <Link href={`/${organizationSlug}/inicio`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors w-fit">
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver a la tienda
          </Link>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-xs">
                <LockKeyhole className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold">Ingresar como cliente</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Acceso exclusivo para compras y seguimiento
                </CardDescription>
              </div>
            </div>
            <div className="rounded-full bg-muted/70 px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
              Seguro
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {checkingSession && (
            <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-4 text-xs text-muted-foreground animate-pulse">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Verificando tu sesión en esta tienda...
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value)
                  if (emailError) setEmailError('')
                }}
                required
                disabled={loading}
                placeholder="nombre@correo.com"
                className={`h-10 transition-all ${
                  emailError ? 'border-destructive focus-visible:ring-destructive/30' : ''
                }`}
              />
              {emailError && (
                <p className="text-[11px] text-destructive font-medium pl-0.5 animate-in fade-in-50 duration-200">
                  {emailError}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="password" className="text-xs font-semibold">Contraseña</Label>
                <button
                  type="button"
                  onClick={handleResetPassword}
                  disabled={resetLoading || loading || !captchaToken}
                  className="text-xs font-semibold text-primary hover:underline disabled:opacity-50 transition-colors"
                >
                  {resetLoading ? 'Enviando enlace...' : '¿Olvidaste tu contraseña?'}
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value)
                    if (passwordError) setPasswordError('')
                  }}
                  required
                  disabled={loading}
                  autoComplete="current-password"
                  className={`h-10 pr-10 transition-all ${
                    passwordError ? 'border-destructive focus-visible:ring-destructive/30' : ''
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordError && (
                <p className="text-[11px] text-destructive font-medium pl-0.5 animate-in fade-in-50 duration-200">
                  {passwordError}
                </p>
              )}
            </div>

            {error && (
              <div
                className={
                  canLinkCustomer || isStaffMember
                    ? 'space-y-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-xs text-foreground'
                    : 'space-y-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive'
                }
              >
                {canLinkCustomer || isStaffMember ? (
                  <div className="flex gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                      {isStaffMember ? <LayoutDashboard className="h-4 w-4" /> : <Info className="h-4 w-4" />}
                    </div>
                    <div className="space-y-1">
                      <p className="font-bold text-foreground text-sm">{isStaffMember ? 'Cuenta del equipo' : 'Cuenta existente'}</p>
                      <p className="text-muted-foreground leading-relaxed">{error}</p>
                      {errorDetail && (
                        <p className="rounded-lg bg-background/80 p-2 font-mono text-[11px] text-muted-foreground">
                          {errorDetail}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2.5">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    <div className="space-y-1">
                      <p className="leading-relaxed font-medium">{error}</p>
                      {errorDetail && (
                        <p className="rounded-md bg-background/70 p-2 font-mono text-[11px] text-muted-foreground">
                          {errorDetail}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                {canLinkCustomer && (
                  <div className="grid gap-2 sm:grid-cols-2 pt-1">
                    <Button
                      type="button"
                      className="w-full h-9 text-xs font-bold rounded-xl"
                      disabled={linking}
                      onClick={handleLinkCustomer}
                    >
                      {linking ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Link2 className="mr-2 h-3.5 w-3.5" />}
                      Vincularme
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-9 text-xs font-semibold rounded-xl"
                      disabled={linking}
                      onClick={handleUseAnotherAccount}
                    >
                      Usar otra cuenta
                    </Button>
                  </div>
                )}
                {isStaffMember && (
                  <div className="grid gap-2 sm:grid-cols-2 pt-1">
                    <Button
                      type="button"
                      className="w-full h-9 text-xs font-bold rounded-xl"
                      disabled={linking}
                      onClick={handleLinkCustomer}
                    >
                      {linking ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <User className="mr-2 h-3.5 w-3.5" />}
                      Continuar como cliente
                    </Button>
                    <Button
                      asChild
                      variant="outline"
                      className="w-full h-9 text-xs font-semibold rounded-xl"
                    >
                      <Link href="/dashboard">
                        <LayoutDashboard className="mr-2 h-3.5 w-3.5" />
                        Ir al panel interno
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            )}

            {!canLinkCustomer && !isStaffMember && error && (
              <Button
                type="button"
                variant="outline"
                className="w-full h-9 text-xs font-semibold rounded-xl"
                disabled={loading}
                onClick={handleUseAnotherAccount}
              >
                Usar otra cuenta
              </Button>
            )}

            <TurnstileChallenge
              action="tenant_customer_login"
              onTokenChange={setCaptchaToken}
              resetKey={captchaResetKey}
              disabled={loading || checkingSession}
            />

            <Button
              type="submit"
              className="w-full h-11 text-sm font-bold rounded-xl shadow-md transition-all active:scale-[0.99]"
              disabled={loading || checkingSession || !captchaToken}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Iniciando sesión...
                </>
              ) : (
                <>
                  Iniciar sesión
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>

            <p className="text-center text-xs text-muted-foreground pt-1">
              ¿No tenés cuenta?{' '}
              <Link href={`/${organizationSlug}/cliente/registro`} className="font-bold text-primary hover:underline">
                Registrate como cliente
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
