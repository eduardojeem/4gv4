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
import { logAuthEventClient } from '@/lib/auth-event-client'
import { getSessionIdFromAccessToken } from '@/lib/session-id'
import { cn } from '@/lib/utils'
import { z } from 'zod'

const passwordSchema = z.object({
  password: z.string()
    .min(8, 'Mínimo 8 caracteres')
    .regex(/[A-Z]/, 'Debe incluir una letra mayúscula')
    .regex(/[a-z]/, 'Debe incluir una letra minúscula')
    .regex(/[0-9]/, 'Debe incluir al menos un número')
    .regex(/[^A-Za-z0-9]/, 'Debe incluir un carácter especial (@, $, !, %, etc.)'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
})

const COOLDOWN_MS = 60000 // 1 minuto

type UserActivityRow = {
  action?: string
  created_at?: string
}

export interface ChangePasswordDialogProps {
  className?: string
}

export function ChangePasswordDialog({ className }: ChangePasswordDialogProps = {}) {
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

      const activity: UserActivityRow[] = Array.isArray(data) ? (data as UserActivityRow[]) : []
      const lastPasswordChange = activity
        .filter((item) => item.action === 'password_change')
        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0]

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
      toast.error(`Debes esperar ${seconds} segundos antes de cambiar la contraseña nuevamente`)
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

      await logAuthEventClient({
        userId: null,
        action: 'password_change',
        success: true,
        ipAddress: null,
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : null,
        details: { source: 'dashboard_profile' }
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
          toast.warning('Contraseña actualizada, pero no se pudieron cerrar otras sesiones')
        }
      }

      toast.success('Contraseña actualizada correctamente')
      setOpen(false)
      setFormData({ password: '', confirmPassword: '' })
      setCooldownRemaining(COOLDOWN_MS)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al actualizar contraseña'
      toast.error(message)
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
    if (s <= 75) return 'bg-amber-500'
    return 'bg-emerald-500'
  }

  const passwordChecks = [
    { label: 'Mínimo 8 caracteres', ok: formData.password.length >= 8 },
    { label: 'Una mayúscula', ok: /[A-Z]/.test(formData.password) },
    { label: 'Una minúscula', ok: /[a-z]/.test(formData.password) },
    { label: 'Un número', ok: /[0-9]/.test(formData.password) },
    { label: 'Un carácter especial', ok: /[^A-Za-z0-9]/.test(formData.password) },
  ]

  const isOnCooldown = cooldownRemaining > 0

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className={cn("gap-2", className)}
          disabled={isOnCooldown}
        >
          <Key className="h-4 w-4" />
          {isOnCooldown ? (
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Espera {Math.ceil(cooldownRemaining / 1000)}s
            </span>
          ) : (
            'Cambiar contraseña'
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Cambiar contraseña</DialogTitle>
          <DialogDescription>
            Asegúrate de utilizar una contraseña segura y exclusiva para esta cuenta.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">Nueva contraseña</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className={errors.password ? 'border-destructive pr-10' : 'pr-10'}
                placeholder="Ingresa la nueva clave"
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
              <div className="space-y-2 pt-1">
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn("h-full transition-all duration-300", getStrengthColor(strength))}
                    style={{ width: `${strength}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Seguridad de contraseña</span>
                  <span className="font-semibold font-mono">{strength}%</span>
                </div>
                <div className="grid gap-1 pt-1">
                  {passwordChecks.map((rule) => (
                    <div key={rule.label} className="flex items-center gap-1.5 text-[11px]">
                      {rule.ok ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <X className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                      )}
                      <span className={rule.ok ? 'text-emerald-700 dark:text-emerald-400 font-medium' : 'text-muted-foreground'}>
                        {rule.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {errors.password && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <X className="h-3 w-3" /> {errors.password}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmar contraseña</Label>
            <Input
              id="confirm-password"
              type={showPassword ? 'text' : 'password'}
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              className={errors.confirmPassword ? 'border-destructive' : ''}
              placeholder="Vuelve a escribir la contraseña"
            />
            {errors.confirmPassword && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <X className="h-3 w-3" /> {errors.confirmPassword}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 p-3">
            <div className="space-y-0.5 pr-2">
              <p className="text-sm font-medium">Cerrar otras sesiones</p>
              <p className="text-xs text-muted-foreground">
                Recomendado para invalidar accesos en equipos antiguos.
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

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || strength < 60}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Actualizar contraseña
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
