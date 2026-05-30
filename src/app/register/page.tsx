'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Eye, EyeOff, ArrowRight, Shield, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { SaaSPublicNav } from '@/components/public/saas-public-nav'
import { validatePassword, getPasswordChecks } from '@/lib/auth/password-validation'
import { slugifyTenantName } from '@/lib/saas/tenant'

const PLAN_LABELS: Record<string, string> = {
  free: 'FREE',
  basic: 'BASIC',
  pro: 'PRO',
  enterprise: 'ENTERPRISE',
}

function RegisterForm() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    companyName: '',
    companySlug: '',
  })
  // Track whether the user has manually edited the slug field
  const [slugTouched, setSlugTouched] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const router = useRouter()
  const searchParams = useSearchParams()
  const reduceMotion = useReducedMotion()

  const planParam = searchParams.get('plan')?.toLowerCase() ?? ''
  const selectedPlanLabel = PLAN_LABELS[planParam] ?? ''
  const selectedPlan = selectedPlanLabel ? planParam : 'free'

  const handleInputChange = (field: string, value: string) => {
    if (field === 'companyName' && !slugTouched) {
      // Auto-mirror the company name into the slug preview (but don't fill the field)
      setFormData((prev) => ({ ...prev, companyName: value }))
      return
    }
    if (field === 'companySlug') {
      setSlugTouched(value.trim().length > 0)
    }
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (formData.password !== formData.confirmPassword) {
      setError('Las contrasenas no coinciden')
      setLoading(false)
      return
    }

    const passwordError = validatePassword(formData.password)
    if (passwordError) {
      setError(passwordError)
      setLoading(false)
      return
    }

    if (!formData.fullName.trim()) {
      setError('El nombre completo es requerido')
      setLoading(false)
      return
    }

    if (!formData.companyName.trim()) {
      setError('El nombre de la empresa es requerido')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/auth/register-company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: formData.fullName,
          email: formData.email,
          password: formData.password,
          companyName: formData.companyName,
          // Use the resolved slug (user input or auto-generated from company name)
          companySlug: previewSlug,
          plan: selectedPlan,
        }),
      })

      const result = await response.json()

      if (response.status === 429) {
        setError(result.error || 'Demasiados intentos de registro. Intenta nuevamente en unos minutos.')
        setLoading(false)
        return
      }

      if (!response.ok || !result.success) {
        setError(result.error || 'No se pudo crear la cuenta.')
        setLoading(false)
        return
      }

      toast.success(
        result.data?.requiresEmailConfirmation
          ? 'Empresa creada. Revisa tu correo para verificar la cuenta.'
          : 'Empresa creada correctamente. Ya puedes iniciar sesion.'
      )
      setTimeout(() => {
        const redirectTarget = encodeURIComponent('/dashboard/onboarding')
        const registeredCompany = encodeURIComponent(previewSlug)
        router.push(`/login?registered=1&company=${registeredCompany}&redirect=${redirectTarget}`)
        router.refresh()
      }, 900)
    } catch (err) {
      console.error('Unexpected error:', err)
      setError('Error inesperado. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const pwd = formData.password
  const pwdChecks = getPasswordChecks(pwd)
  // Always resolve slug: prefer what the user typed, fall back to slugified company name
  const previewSlug = slugifyTenantName(formData.companySlug || formData.companyName)

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(6,182,212,0.16),transparent_40%),radial-gradient(circle_at_85%_85%,rgba(59,130,246,0.14),transparent_40%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(14,165,233,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(14,165,233,0.06)_1px,transparent_1px)] bg-[size:42px_42px] opacity-40" />

      <SaaSPublicNav />

      <main className="relative z-10 flex min-h-[calc(100vh-4rem)] items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="w-full max-w-md"
        >
          <Card className="border-slate-800/80 bg-slate-900/80 shadow-2xl backdrop-blur-xl">
            <CardHeader className="space-y-4 pb-5">
              <div>
                <CardTitle className="text-2xl font-bold text-white">Crear empresa</CardTitle>
                <CardDescription className="mt-1 text-slate-400">Registro SaaS para nuevos negocios</CardDescription>
              </div>
              {selectedPlanLabel && (
                <div className="flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-300">
                  <Sparkles className="h-4 w-4 shrink-0" />
                  <span>
                    Plan seleccionado: <strong>{selectedPlanLabel}</strong>
                    <span className="ml-1 text-xs text-cyan-400/70">· Empiezas con 14 días de prueba gratis</span>
                  </span>
                </div>
              )}
            </CardHeader>

            <CardContent className="space-y-6">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-slate-200">
                    Nombre completo
                  </Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Juan Perez"
                    value={formData.fullName}
                    onChange={(e) => handleInputChange('fullName', e.target.value)}
                    required
                    autoFocus
                    disabled={loading}
                    className="h-11 border-slate-700 bg-slate-950/60 text-white placeholder:text-slate-500 focus-visible:ring-cyan-500/60"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-200">
                    Correo electronico
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="nombre@empresa.com"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    required
                    autoComplete="email"
                    disabled={loading}
                    className="h-11 border-slate-700 bg-slate-950/60 text-white placeholder:text-slate-500 focus-visible:ring-cyan-500/60"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="companyName" className="text-slate-200">
                    Nombre de la empresa
                  </Label>
                  <Input
                    id="companyName"
                    type="text"
                    placeholder="Mi empresa"
                    value={formData.companyName}
                    onChange={(e) => handleInputChange('companyName', e.target.value)}
                    required
                    disabled={loading}
                    className="h-11 border-slate-700 bg-slate-950/60 text-white placeholder:text-slate-500 focus-visible:ring-cyan-500/60"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="companySlug" className="text-slate-200">
                    Subdominio <span className="text-slate-500 font-normal">(opcional)</span>
                  </Label>
                  <Input
                    id="companySlug"
                    type="text"
                    placeholder={previewSlug || 'mi-empresa'}
                    value={formData.companySlug}
                    onChange={(e) => handleInputChange('companySlug', e.target.value)}
                    disabled={loading}
                    className="h-11 border-slate-700 bg-slate-950/60 text-white placeholder:text-slate-500 focus-visible:ring-cyan-500/60"
                  />
                  {previewSlug ? (
                    <p className="flex items-center gap-1.5 text-xs text-slate-400">
                      <span className="text-slate-500">URL:</span>
                      <span className="font-mono text-cyan-400">{previewSlug}</span>
                      <span className="text-slate-500">.tu-dominio.com</span>
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500">Se genera automaticamente desde el nombre de la empresa.</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-200">
                    Contrasena
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      required
                      autoComplete="new-password"
                      disabled={loading}
                      className="h-11 border-slate-700 bg-slate-950/60 pr-11 text-white placeholder:text-slate-500 focus-visible:ring-cyan-500/60"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition-colors hover:text-cyan-400"
                      aria-label={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-slate-200">
                    Confirmar contrasena
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={formData.confirmPassword}
                      onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                      required
                      autoComplete="new-password"
                      disabled={loading}
                      className="h-11 border-slate-700 bg-slate-950/60 pr-11 text-white placeholder:text-slate-500 focus-visible:ring-cyan-500/60"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition-colors hover:text-cyan-400"
                      aria-label={showConfirmPassword ? 'Ocultar confirmacion de contrasena' : 'Mostrar confirmacion de contrasena'}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                  <p className="mb-2 text-xs font-semibold text-slate-300">Requisitos de contrasena</p>
                  <ul className="space-y-1 text-xs">
                    {pwdChecks.map((item) => (
                      <li key={item.label} className={item.ok ? 'text-emerald-400' : 'text-slate-500'}>
                        {item.label}
                      </li>
                    ))}
                  </ul>
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={reduceMotion ? false : { opacity: 0, y: -8 }}
                      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                      exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                      className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"
                      role="alert"
                      aria-live="assertive"
                    >
                      <Shield className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{error}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <Button
                  type="submit"
                  className="h-11 w-full bg-gradient-to-r from-cyan-600 to-blue-600 font-semibold text-white hover:from-cyan-500 hover:to-blue-500"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creando cuenta...
                    </>
                  ) : (
                    <>
                      Crear mi empresa
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              <div className="pt-1 text-center">
                <p className="text-sm text-slate-400">
                  Ya tienes cuenta?{' '}
                  <Link href="/login" className="font-semibold text-cyan-400 hover:text-cyan-300 hover:underline">
                    Iniciar sesion
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  )
}
