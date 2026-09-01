'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  HelpCircle,
  Loader2,
  LogIn,
  MailCheck,
  Rocket,
  ShoppingBag,
  UserPlus,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { TurnstileChallenge } from '@/components/security/TurnstileChallenge'

type AuthTab = 'login' | 'register'

interface AuthModalProps {
  open: boolean
  onClose: () => void
  loginHref?: string
  registerHref?: string
}

function TabButton({
  active,
  children,
  onClick,
  id,
  controls,
}: {
  active: boolean
  children: ReactNode
  onClick: () => void
  id: string
  controls: string
}) {
  return (
    <button
      type="button"
      role="tab"
      id={id}
      aria-selected={active}
      aria-controls={controls}
      onClick={onClick}
      className={cn(
        'relative flex h-10 flex-1 items-center justify-center gap-2 text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-1',
        active
          ? 'text-cyan-700 dark:text-cyan-300'
          : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
      )}
    >
      {children}
      {active && (
        <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-cyan-600 dark:bg-cyan-400" />
      )}
    </button>
  )
}

function HowItWorks({ tab }: { tab: AuthTab }) {
  const items = tab === 'login'
    ? [
        { icon: LogIn, text: 'Ingresá con el email y la contraseña de tu cuenta.' },
        { icon: ShoppingBag, text: 'Al entrar, podés comprar, revisar pedidos y continuar navegando el marketplace.' },
      ]
    : [
        { icon: UserPlus, text: 'Creá una cuenta gratuita de cliente para usar en el marketplace.' },
        { icon: MailCheck, text: 'Confirmá tu correo y accedé con la misma cuenta en tiendas públicas.' },
      ]

  return (
    <div className="rounded-xl border border-cyan-100 bg-cyan-50/80 p-3.5 text-cyan-950 dark:border-cyan-900/60 dark:bg-cyan-950/25 dark:text-cyan-100 shadow-xs">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-800 dark:text-cyan-300">
        <HelpCircle className="h-3.5 w-3.5" />
        ¿Cómo funciona?
      </div>
      <div className="mt-2 grid gap-1.5">
        {items.map(({ icon: Icon, text }) => (
          <div key={text} className="flex gap-2 text-xs leading-relaxed text-cyan-900/85 dark:text-cyan-100/80">
            <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-600 dark:text-cyan-400" />
            <span>{text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function LoginTab({ onSuccess, onSwitchTab }: { onSuccess: () => void; onSwitchTab: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaResetKey, setCaptchaResetKey] = useState(0)
  const emailRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    window.setTimeout(() => emailRef.current?.focus(), 100)
  }, [])

  const validateFields = () => {
    let isValid = true
    const cleanEmail = email.trim()

    if (!cleanEmail) {
      setEmailError('Ingresá tu correo electrónico.')
      isValid = false
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
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

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')

    if (!validateFields()) {
      return
    }

    if (!captchaToken || loading) {
      setError('Por favor, completá la verificación de seguridad para continuar.')
      return
    }
    setLoading(true)

    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
        options: { captchaToken },
      })

      if (authError) {
        const msg = authError.message || ''
        if (/invalid.*credentials|invalid login/i.test(msg)) {
          setError('El correo o la contraseña no son correctos. Verificá los datos e intentá de nuevo.')
        } else if (/email not confirmed/i.test(msg)) {
          setError('Tu cuenta aún no fue confirmada. Revisá tu casilla de correo o spam.')
        } else if (/rate limit|too many requests/i.test(msg)) {
          setError('Demasiados intentos fallidos. Esperá unos minutos antes de volver a intentar.')
        } else if (/Failed to fetch|Network/i.test(msg)) {
          setError('No se pudo conectar con el servidor. Comprobá tu conexión a internet.')
        } else {
          setError('El correo o la contraseña no coinciden con ninguna cuenta activa.')
        }
        return
      }

      onSuccess()
    } catch {
      setError('Ocurrió un error inesperado al iniciar sesión. Intentá de nuevo.')
    } finally {
      setLoading(false)
      setCaptchaToken(null)
      setCaptchaResetKey((current) => current + 1)
    }
  }

  return (
    <div className="animate-in fade-in-0 duration-150 space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="modal-email" className="text-xs font-semibold">
            Correo electrónico
          </Label>
          <Input
            ref={emailRef}
            id="modal-email"
            type="email"
            placeholder="tu@email.com"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              if (emailError) setEmailError('')
            }}
            required
            disabled={loading}
            autoComplete="email"
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
          <Label htmlFor="modal-password" className="text-xs font-semibold">
            Contraseña
          </Label>
          <div className="relative">
            <Input
              id="modal-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
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
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              tabIndex={-1}
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
          <div className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive leading-relaxed">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <span>{error}</span>
          </div>
        )}

        <TurnstileChallenge
          action="marketplace_login"
          onTokenChange={setCaptchaToken}
          resetKey={captchaResetKey}
          disabled={loading}
        />

        <button
          type="submit"
          disabled={loading || !captchaToken}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 text-sm font-bold text-white transition-all hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 dark:focus-visible:ring-white shadow-md active:scale-[0.99]"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
          Iniciar sesión
        </button>
      </form>

      <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
        ¿No tenés cuenta?{' '}
        <button
          type="button"
          onClick={onSwitchTab}
          className="font-bold text-slate-900 underline-offset-2 hover:underline dark:text-white"
        >
          Crear cuenta
        </button>
      </p>
    </div>
  )
}

const steps = [
  { title: 'Completa tus datos', desc: 'Nombre, email y contrasena' },
  { title: 'Verifica tu correo', desc: 'Un link de confirmacion a tu casilla' },
  { title: 'Listo', desc: 'Empeza a comprar en el marketplace' },
]

function RegisterTab({
  href,
  onNavigate,
  onSwitchTab,
}: {
  href: string
  onNavigate: (href: string) => void
  onSwitchTab: () => void
}) {
  const [loading, setLoading] = useState(false)

  return (
    <div className="animate-in fade-in-0 flex flex-col gap-5 duration-150">
      <div className="space-y-3">
        {steps.map((step, index) => (
          <div key={step.title} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white dark:bg-white dark:text-slate-900">
                {index + 1}
              </span>
              {index < steps.length - 1 && (
                <span className="mt-1 h-full w-px bg-slate-200 dark:bg-slate-700" />
              )}
            </div>
            <div className="pb-3">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{step.title}</p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        Sin tarjeta, sin costo inicial.
      </div>

      <div className="space-y-2.5">
        <button
          type="button"
          onClick={() => {
            setLoading(true)
            onNavigate(href)
          }}
          disabled={loading}
          className="group flex h-11 w-full items-center justify-center gap-2.5 rounded-lg bg-slate-900 text-sm font-semibold text-white transition-all hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 dark:focus-visible:ring-white"
          autoFocus
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          Crear cuenta
          <ArrowRight className="h-3.5 w-3.5 opacity-50 transition-transform group-hover:translate-x-0.5" />
        </button>

        <button
          type="button"
          onClick={() => onNavigate('/saas')}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Rocket className="h-4 w-4" />
          Tenes un negocio? Ver planes
        </button>
      </div>

      <p className="text-center text-xs text-slate-500 dark:text-slate-400">
        Ya tenes cuenta?{' '}
        <button
          type="button"
          onClick={onSwitchTab}
          className="font-semibold text-slate-900 underline-offset-2 hover:underline dark:text-white"
        >
          Inicia sesion
        </button>
      </p>
    </div>
  )
}

const defaultRegisterHref = '/cliente/registro?redirect=/marketplace'

export function AuthModal({
  open,
  onClose,
  registerHref = defaultRegisterHref,
}: AuthModalProps) {
  const [tab, setTab] = useState<AuthTab>('login')
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (open) setTab('login')
  }, [open])

  useEffect(() => {
    if (open) onClose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  const handleNavigate = useCallback((href: string) => {
    onClose()
    window.setTimeout(() => router.push(href), 120)
  }, [onClose, router])

  const handleLoginSuccess = useCallback(() => {
    onClose()
    router.refresh()
  }, [onClose, router])

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent
        className="!block max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[400px] overflow-hidden rounded-xl border border-slate-200 p-0 shadow-xl dark:border-slate-800"
        showCloseButton={false}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div>
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white">
              Acceder al marketplace
            </DialogTitle>
            <p className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">
              Usa tu cuenta para comprar mas rapido y seguir tus pedidos.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex border-b border-slate-100 dark:border-slate-800" role="tablist" aria-label="Opciones de acceso">
          <TabButton
            active={tab === 'login'}
            onClick={() => setTab('login')}
            id="auth-tab-login"
            controls="auth-panel-login"
          >
            <LogIn className="h-4 w-4" />
            Ingresar
          </TabButton>
          <TabButton
            active={tab === 'register'}
            onClick={() => setTab('register')}
            id="auth-tab-register"
            controls="auth-panel-register"
          >
            <UserPlus className="h-4 w-4" />
            Registrarse
          </TabButton>
        </div>

        <div
          className="space-y-4 overflow-y-auto overscroll-contain px-5 py-5"
          style={{ maxHeight: 'calc(100dvh - 13rem)' }}
          role="tabpanel"
          id={`auth-panel-${tab}`}
          aria-labelledby={`auth-tab-${tab}`}
        >
          <HowItWorks tab={tab} />
          {tab === 'login' ? (
            <LoginTab onSuccess={handleLoginSuccess} onSwitchTab={() => setTab('register')} />
          ) : (
            <RegisterTab href={registerHref} onNavigate={handleNavigate} onSwitchTab={() => setTab('login')} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
