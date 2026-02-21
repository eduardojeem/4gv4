'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Eye, EyeOff, ArrowRight, Cpu, Shield } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { config } from '@/lib/config'

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const router = useRouter()
  const supabase = createClient()
  const reduceMotion = useReducedMotion()

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) return 'La contrasena debe tener al menos 8 caracteres'
    if (!/[A-Z]/.test(pwd)) return 'La contrasena debe contener al menos una mayuscula'
    if (!/[a-z]/.test(pwd)) return 'La contrasena debe contener al menos una minuscula'
    if (!/[0-9]/.test(pwd)) return 'La contrasena debe contener al menos un numero'
    return null
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

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            role: 'cliente',
          },
        },
      })

      if (authError) {
        setError(authError.message)
        setLoading(false)
        return
      }

      if (authData.user) {
        toast.success('Cuenta creada correctamente. Revisa tu correo para verificarla.')
        setTimeout(() => {
          router.push('/login')
          router.refresh()
        }, 900)
      }
    } catch (err) {
      console.error('Unexpected error:', err)
      setError('Error inesperado. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const pwd = formData.password
  const pwdChecks = [
    { ok: pwd.length >= 8, label: 'Minimo 8 caracteres' },
    { ok: /[A-Z]/.test(pwd), label: 'Una letra mayuscula' },
    { ok: /[a-z]/.test(pwd), label: 'Una letra minuscula' },
    { ok: /[0-9]/.test(pwd), label: 'Un numero' },
  ]

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(6,182,212,0.16),transparent_40%),radial-gradient(circle_at_85%_85%,rgba(59,130,246,0.14),transparent_40%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(14,165,233,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(14,165,233,0.06)_1px,transparent_1px)] bg-[size:42px_42px] opacity-40" />

      <main className="relative z-10 flex min-h-screen items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="w-full max-w-md"
        >
          <Card className="border-slate-800/80 bg-slate-900/80 shadow-2xl backdrop-blur-xl">
            <CardHeader className="space-y-4 pb-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-900/30">
                  <Cpu className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-200">{config.company.name}</p>
                </div>
              </div>
              <div>
                <CardTitle className="text-2xl font-bold text-white">Crear cuenta</CardTitle>
                <CardDescription className="mt-1 text-slate-400">Registro de clientes</CardDescription>
              </div>
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
                      Registrarme
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
