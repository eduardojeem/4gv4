'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { Key, Loader2, Eye, EyeOff, Check, X, Clock, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getSessionIdFromAccessToken } from '@/lib/session-id'
import { z } from 'zod'

const passwordSchema = z.object({
  password: z.string()
    .min(8, 'Minimo 8 caracteres')
    .regex(/[A-Z]/, 'Debe incluir una mayuscula')
    .regex(/[a-z]/, 'Debe incluir una minuscula')
    .regex(/[0-9]/, 'Debe incluir un numero')
    .regex(/[^A-Za-z0-9]/, 'Debe incluir un caracter especial'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Las contrasenas no coinciden",
  path: ["confirmPassword"],
})

const COOLDOWN_MS = 60000 // 1 minuto

export function ChangePasswordDialog() {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  })
  const [closeOtherSessions, setCloseOtherSessions] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [cooldownRemaining, setCooldownRemaining] = useState(0)
  const supabase = createClient()

  const loadServerCooldown = useCallback(async () => {
    if (!open) return
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase.rpc('get_user_activity', {
        p_user_id: user.id,
        p_limit: 50
      })
      if (error) return

      const activity = Array.isArray(data) ? data : []
      const lastPasswordChange = activity
        .filter((item: any) => item?.action === 'password_change')
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

      if (!lastPasswordChange?.created_at) return

      const elapsed = Date.now() - new Date(lastPasswordChange.created_at).getTime()
      const remaining = COOLDOWN_MS - elapsed
      setCooldownRemaining(remaining > 0 ? remaining : 0)
    } catch {
      // If activity query fails, do not block password update UI.
    }
  }, [open, supabase])

  // Check cooldown from server activity when dialog opens
  useEffect(() => {
    if (open) {
      loadServerCooldown()
    }
  }, [open, loadServerCooldown])

  // Update countdown timer
  useEffect(() => {
    if (cooldownRemaining > 0) {
      const timer = setInterval(() => {
        setCooldownRemaining(prev => Math.max(0, prev - 1000))
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [cooldownRemaining])

  useEffect(() => {
    if (!open) {
      setErrors({})
      setShowPassword(false)
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    // Check rate limit
    if (cooldownRemaining > 0) {
      const seconds = Math.ceil(cooldownRemaining / 1000)
      toast.error(`Debes esperar ${seconds} segundos antes de cambiar la contrasena nuevamente`)
      return
    }

    try {
      const result = passwordSchema.safeParse(formData)
      if (!result.success) {
        const formattedErrors: Record<string, string> = {}
        result.error.issues.forEach((issue) => {
          const key = String(issue.path[0] ?? 'form')
          formattedErrors[key] = issue.message
        })
        setErrors(formattedErrors)
        return
      }

      setIsLoading(true)
      const { error } = await supabase.auth.updateUser({
        password: formData.password
      })

      if (error) throw error

      await supabase.rpc('log_auth_event', {
        p_user_id: null,
        p_action: 'password_change',
        p_success: true,
        p_ip_address: null,
        p_user_agent: typeof window !== 'undefined' ? window.navigator.userAgent : null,
        p_details: { source: 'dashboard_profile' }
      })

      if (closeOtherSessions) {
        try {
          const [{ data: userData }, { data: sessionData }] = await Promise.all([
            supabase.auth.getUser(),
            supabase.auth.getSession()
          ])
          const currentUserId = userData.user?.id
          const currentSessionId = await getSessionIdFromAccessToken(sessionData.session?.access_token)

          if (currentUserId && currentSessionId) {
            await supabase.rpc('close_all_user_sessions_except_current', {
              p_user_id: currentUserId,
              p_current_session_id: currentSessionId
            })
          }
        } catch {
          toast.warning('Contrasena actualizada, pero no se pudieron cerrar otras sesiones')
        }
      }

      toast.success('Contrasena actualizada correctamente')
      setOpen(false)
      setFormData({ password: '', confirmPassword: '' })
      setCooldownRemaining(COOLDOWN_MS)
    } catch (error: any) {
      toast.error(error.message || 'Error al actualizar contrasena')
    } finally {
      setIsLoading(false)
    }
  }

  const checkStrength = (pass: string) => {
    let strength = 0
    if (pass.length >= 8) strength += 20
    if (/[A-Z]/.test(pass)) strength += 20
    if (/[a-z]/.test(pass)) strength += 20
    if (/[0-9]/.test(pass)) strength += 20
    if (/[^A-Za-z0-9]/.test(pass)) strength += 20
    return strength
  }

  const strength = checkStrength(formData.password)
  const getStrengthColor = (s: number) => {
    if (s <= 25) return 'bg-red-500'
    if (s <= 50) return 'bg-orange-500'
    if (s <= 75) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const passwordChecks = [
    { label: 'Minimo 8 caracteres', ok: formData.password.length >= 8 },
    { label: 'Una mayuscula', ok: /[A-Z]/.test(formData.password) },
    { label: 'Una minuscula', ok: /[a-z]/.test(formData.password) },
    { label: 'Un numero', ok: /[0-9]/.test(formData.password) },
    { label: 'Un caracter especial', ok: /[^A-Za-z0-9]/.test(formData.password) },
  ]

  const isOnCooldown = cooldownRemaining > 0

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full justify-start gap-2" disabled={isOnCooldown}>
          <Key className="h-4 w-4" />
          {isOnCooldown ? (
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Espera {Math.ceil(cooldownRemaining / 1000)}s
            </span>
          ) : (
            'Cambiar contrasena'
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Cambiar contrasena</DialogTitle>
          <DialogDescription>
            Asegurate de usar una contrasena segura y unica.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">Nueva contrasena</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className={errors.password ? 'border-red-500 pr-10' : 'pr-10'}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
            {formData.password && (
              <div className="space-y-2">
                <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${getStrengthColor(strength)}`}
                    style={{ width: `${strength}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground text-right">
                  Fortaleza: {strength}%
                </p>
                <div className="grid gap-1">
                  {passwordChecks.map((rule) => (
                    <div key={rule.label} className="flex items-center gap-1.5 text-[11px]">
                      {rule.ok ? (
                        <Check className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <X className="h-3.5 w-3.5 text-slate-400" />
                      )}
                      <span className={rule.ok ? 'text-green-700 dark:text-green-400' : 'text-slate-500 dark:text-slate-400'}>
                        {rule.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {errors.password && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <X className="h-3 w-3" /> {errors.password}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmar contrasena</Label>
            <Input
              id="confirm-password"
              type={showPassword ? 'text' : 'password'}
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              className={errors.confirmPassword ? 'border-red-500' : ''}
            />
            {errors.confirmPassword && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <X className="h-3 w-3" /> {errors.confirmPassword}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Cerrar otras sesiones</p>
              <p className="text-xs text-muted-foreground">
                Recomendado despues de cambiar la contrasena
              </p>
            </div>
            <div className="flex items-center gap-2">
              <LogOut className="h-4 w-4 text-muted-foreground" />
              <Switch
                checked={closeOtherSessions}
                onCheckedChange={setCloseOtherSessions}
                disabled={isLoading}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || strength < 60}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Actualizar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
