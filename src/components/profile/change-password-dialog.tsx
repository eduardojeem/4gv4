'use client'

import { useState } from 'react'
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
import { toast } from 'sonner'
import { Key, Loader2, Eye, EyeOff, Check, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { z } from 'zod'

const passwordSchema = z.object({
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
})

export function ChangePasswordDialog() {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    
    try {
      const result = passwordSchema.safeParse(formData)
      if (!result.success) {
        const formattedErrors: Record<string, string> = {}
        result.error.issues.forEach((issue) => {
          formattedErrors[issue.path[0]] = issue.message
        })
        setErrors(formattedErrors)
        return
      }

      setIsLoading(true)
      const { error } = await supabase.auth.updateUser({
        password: formData.password
      })

      if (error) throw error

      toast.success('Contraseña actualizada correctamente')
      setOpen(false)
      setFormData({ password: '', confirmPassword: '' })
    } catch (error: any) {
      toast.error(error.message || 'Error al actualizar contraseña')
    } finally {
      setIsLoading(false)
    }
  }

  const checkStrength = (pass: string) => {
    let strength = 0
    if (pass.length >= 8) strength += 25
    if (/[A-Z]/.test(pass)) strength += 25
    if (/[0-9]/.test(pass)) strength += 25
    if (/[^A-Za-z0-9]/.test(pass)) strength += 25
    return strength
  }

  const strength = checkStrength(formData.password)
  const getStrengthColor = (s: number) => {
    if (s <= 25) return 'bg-red-500'
    if (s <= 50) return 'bg-orange-500'
    if (s <= 75) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full justify-start gap-2">
          <Key className="h-4 w-4" />
          Cambiar contraseña
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Cambiar Contraseña</DialogTitle>
          <DialogDescription>
            Asegúrate de usar una contraseña segura y única.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">Nueva Contraseña</Label>
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
              <div className="space-y-1">
                <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-300 ${getStrengthColor(strength)}`} 
                    style={{ width: `${strength}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground text-right">
                  Fortaleza: {strength}%
                </p>
              </div>
            )}
            {errors.password && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <X className="h-3 w-3" /> {errors.password}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmar Contraseña</Label>
            <Input
              id="confirm-password"
              type="password"
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Actualizar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
