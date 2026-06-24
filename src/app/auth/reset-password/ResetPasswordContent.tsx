'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Eye, EyeOff, ArrowRight, Shield, CheckCircle2, Lock, Building2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { validatePassword } from '@/lib/auth/password-validation'
import { usePlatformBranding } from '@/hooks/use-platform-branding'

export default function ResetPasswordContent() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [validatingToken, setValidatingToken] = useState(true)
  
  const router = useRouter()
  const supabase = createClient()
  const { branding } = usePlatformBranding()

  useEffect(() => {
    const establishSessionFromHash = async (): Promise<boolean> => {
      if (typeof window === 'undefined') return false
      const hash = window.location.hash?.startsWith('#')
        ? window.location.hash.slice(1)
        : ''
      if (!hash) return false

      const params = new URLSearchParams(hash)
      const access_token = params.get('access_token')
      const refresh_token = params.get('refresh_token')
      if (!access_token || !refresh_token) return false

      const { error } = await supabase.auth.setSession({ access_token, refresh_token })
      if (error) {
        console.error('setSession from hash failed:', error.message)
        return false
      }

      window.history.replaceState(null, '', window.location.pathname + window.location.search)
      return true
    }

    const validateSession = async () => {
      try {
        let { data: { session } } = await supabase.auth.getSession()

        if (!session) {
          const ok = await establishSessionFromHash()
          if (ok) {
            ({ data: { session } } = await supabase.auth.getSession())
          }
        }

        if (!session) {
          toast.error('El enlace de recuperación es inválido o ha expirado')
          setTimeout(() => router.push('/login'), 2000)
          return
        }

        setValidatingToken(false)
      } catch (err) {
        console.error('Error validating session:', err)
        toast.error('Error al validar el enlace')
        setTimeout(() => router.push('/login'), 2000)
      }
    }

    validateSession()
  }, [router, supabase.auth])

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      setLoading(false)
      return
    }

    const passwordError = validatePassword(password)
    if (passwordError) {
      setError(passwordError)
      setLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        setError(error.message || 'Error al actualizar la contraseña')
      } else {
        setSuccess(true)
        toast.success('Contraseña actualizada exitosamente')
        setTimeout(() => router.push('/dashboard'), 2000)
      }
    } catch (err) {
      setError('Ocurrió un error inesperado. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const reqs = [
    { label: '8+ caracteres', met: password.length >= 8 },
    { label: 'Mayúscula', met: /[A-Z]/.test(password) },
    { label: 'Minúscula', met: /[a-z]/.test(password) },
    { label: 'Número', met: /[0-9]/.test(password) }
  ]
  const strength = reqs.filter(r => r.met).length

  if (validatingToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="flex flex-col items-center gap-4"
        >
          <div className="relative">
            <div className="absolute inset-0 blur-xl bg-blue-500/30 rounded-full" />
            <Loader2 className="h-10 w-10 animate-spin text-blue-500 relative z-10" />
          </div>
          <p className="text-sm font-medium text-slate-400 tracking-wide">Autenticando sesión...</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#030712] relative overflow-hidden selection:bg-blue-500/30 font-sans">
      {/* Dynamic Ambient Background */}
      <div className="absolute inset-0 w-full h-full pointer-events-none">
        <motion.div 
          animate={{ x: [0, 40, 0], y: [0, -40, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[140px] mix-blend-screen" 
        />
        <motion.div 
          animate={{ x: [0, -30, 0], y: [0, 30, 0], scale: [1, 1.2, 1] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] bg-violet-600/15 rounded-full blur-[120px] mix-blend-screen" 
        />
        <motion.div 
          animate={{ x: [0, 20, 0], y: [0, -20, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute bottom-[-20%] left-[20%] w-[40%] h-[40%] bg-indigo-600/15 rounded-full blur-[120px] mix-blend-screen" 
        />
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-[0.03]" />
      </div>

      <AnimatePresence mode="wait">
        {!success ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
            className="w-full max-w-md relative z-10 px-4"
          >
            {/* Main Card */}
            <div className="backdrop-blur-2xl bg-white/[0.03] border border-white/[0.08] shadow-2xl rounded-[32px] overflow-hidden relative group">
              {/* Card top highlight */}
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-blue-400/50 to-transparent opacity-50" />
              
              <div className="p-8 sm:p-10 space-y-8">
                {/* Header */}
                <div className="space-y-4 text-center">
                  <motion.div 
                    initial={{ scale: 0, rotate: -15 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", damping: 12, delay: 0.2 }}
                    className="flex items-center justify-center mx-auto"
                  >
                    {branding.logoUrl ? (
                      <div className="flex h-16 items-center">
                        <img src={branding.logoUrl} alt={branding.platformName} className="h-16 w-auto max-w-[200px] object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]" />
                      </div>
                    ) : (
                      <div className="w-16 h-16 bg-gradient-to-tr from-blue-600/20 to-violet-600/20 rounded-2xl flex items-center justify-center border border-white/10 shadow-[0_0_40px_rgba(37,99,235,0.15)] relative">
                        <div className="absolute inset-0 rounded-2xl border border-white/5 bg-gradient-to-tr from-white/5 to-transparent" />
                        <Building2 className="h-7 w-7 text-blue-300 relative z-10" />
                      </div>
                    )}
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="space-y-1.5"
                  >
                    <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
                      Nueva contraseña
                    </h2>
                    <p className="text-sm text-slate-400">
                      Asegura tu cuenta de {branding.platformName}
                    </p>
                  </motion.div>
                </div>

                <form onSubmit={handleResetPassword} className="space-y-6">
                  {/* Password Input */}
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 }}
                    className="space-y-2.5"
                  >
                    <Label className="text-xs font-medium text-slate-300 ml-1">Tu nueva contraseña</Label>
                    <div className="relative group/input">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="h-12 bg-black/20 border-white/10 text-white placeholder:text-slate-600 focus:bg-white/5 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all duration-300 rounded-xl pr-11 shadow-inner shadow-black/20"
                        disabled={loading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors p-1"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>

                    {/* Animated Strength Meter */}
                    <div className="pt-3">
                      <div className="flex gap-1.5 h-1 w-full bg-black/40 rounded-full overflow-hidden p-0.5">
                        {[1, 2, 3, 4].map((level) => (
                          <div 
                            key={level} 
                            className={cn(
                              "h-full flex-1 rounded-full transition-all duration-500",
                              password.length === 0 ? "bg-transparent" :
                              level <= strength ? 
                                (strength <= 2 ? "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]" : 
                                strength === 3 ? "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.8)]" : 
                                "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]")
                              : "bg-transparent"
                            )}
                          />
                        ))}
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-y-2 gap-x-4">
                        {reqs.map((req, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <div className={cn(
                              "w-1 h-1 rounded-full transition-colors duration-300",
                              req.met ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" : "bg-slate-700"
                            )} />
                            <span className={cn(
                              "text-[11px] transition-colors duration-300",
                              req.met ? "text-slate-200 font-medium" : "text-slate-500"
                            )}>{req.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>

                  {/* Confirm Password Input */}
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                    className="space-y-2.5"
                  >
                    <Label className="text-xs font-medium text-slate-300 ml-1">Repite la contraseña</Label>
                    <div className="relative group/input">
                      <Input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="h-12 bg-black/20 border-white/10 text-white placeholder:text-slate-600 focus:bg-white/5 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all duration-300 rounded-xl pr-11 shadow-inner shadow-black/20"
                        disabled={loading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors p-1"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </motion.div>

                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, y: -10 }}
                        animate={{ opacity: 1, height: 'auto', y: 0 }}
                        exit={{ opacity: 0, height: 0, y: -10 }}
                        className="overflow-hidden"
                      >
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 mt-2">
                          <Shield className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                          <p className="text-xs text-red-200/90 leading-relaxed font-medium">{error}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="pt-4"
                  >
                    <Button
                      type="submit"
                      disabled={loading || strength < 3 || password !== confirmPassword}
                      className="w-full h-12 bg-white text-black hover:bg-slate-200 transition-all duration-300 rounded-xl font-semibold text-sm relative overflow-hidden group shadow-[0_0_30px_rgba(255,255,255,0.15)] hover:shadow-[0_0_40px_rgba(255,255,255,0.25)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
                    >
                      <span className="relative z-10 flex items-center justify-center gap-2">
                        {loading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin text-slate-600" />
                            Guardando...
                          </>
                        ) : (
                          <>
                            Guardar contraseña
                            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                          </>
                        )}
                      </span>
                    </Button>
                  </motion.div>
                </form>
              </div>

              {/* Card Footer */}
              <div className="px-8 py-5 border-t border-white/[0.05] bg-black/20 text-center backdrop-blur-md">
                <Link 
                  href="/login"
                  className="text-xs font-medium text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1.5 group"
                >
                  <ArrowRight className="h-3 w-3 rotate-180 group-hover:-translate-x-1 transition-transform opacity-70" />
                  Volver al inicio de sesión
                </Link>
              </div>
            </div>

            {/* Bottom badges */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="mt-8 flex justify-center gap-8 text-[11px] text-slate-500 font-medium"
            >
              <div className="flex items-center gap-2">
                <Shield className="h-3.5 w-3.5 text-blue-400/50" />
                <span>Cifrado Extremo</span>
              </div>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm relative z-10 px-4"
          >
            <div className="backdrop-blur-2xl bg-white/[0.03] border border-white/[0.08] shadow-2xl rounded-[32px] p-10 text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent opacity-50" />
              <div className="absolute inset-0 bg-emerald-500/5 blur-3xl rounded-full pointer-events-none" />
              
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 15, delay: 0.1 }}
                className="w-20 h-20 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-emerald-500/20 relative z-10"
              >
                <CheckCircle2 className="h-10 w-10 text-emerald-400" />
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="relative z-10"
              >
                <h2 className="text-2xl font-semibold text-white mb-3 tracking-tight">¡Contraseña lista!</h2>
                <p className="text-sm text-slate-400 leading-relaxed mb-8">
                  Tu contraseña ha sido actualizada con éxito. Preparando tu entorno de trabajo...
                </p>
                <div className="flex justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-emerald-400/50" />
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
