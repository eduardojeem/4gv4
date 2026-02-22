'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { AlertCircle, Loader2, MapPin, Save, Shield } from 'lucide-react'

interface ProfileFormProps {
  name: string
  phone: string
  email: string
  location: string
  errors: Record<string, string>
  isDirty: boolean
  loading: boolean
  onNameChange: (value: string) => void
  onPhoneChange: (value: string) => void
  onLocationChange: (value: string) => void
  onSubmit: (e: React.FormEvent) => void
}

export function ProfileForm({
  name, phone, email, location, errors, isDirty, loading,
  onNameChange, onPhoneChange, onLocationChange, onSubmit
}: ProfileFormProps) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-6 py-4">
        <h2 className="text-base font-semibold text-foreground">Informacion Personal</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">Actualiza tus datos de contacto y ubicacion</p>
      </div>

      <form onSubmit={onSubmit} className="p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name" className="text-sm font-medium text-foreground">
              Nombre Completo
            </Label>
            <Input
              id="name"
              value={name}
              onChange={e => onNameChange(e.target.value)}
              placeholder="Tu nombre"
              className={cn('h-11', errors.name && 'border-destructive focus-visible:ring-destructive')}
            />
            {errors.name && (
              <p className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="h-3 w-3" />{errors.name}
              </p>
            )}
          </div>

          {/* Phone */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone" className="text-sm font-medium text-foreground">
              Telefono / WhatsApp
            </Label>
            <Input
              id="phone"
              value={phone}
              onChange={e => onPhoneChange(e.target.value)}
              placeholder="+595 9xx xxx xxx"
              className="h-11"
            />
          </div>

          {/* Email (readonly) */}
          <div className="flex flex-col gap-1.5">
            <Label className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <Shield className="h-3.5 w-3.5" /> Correo electronico
            </Label>
            <Input value={email} disabled className="h-11 opacity-60" />
            <p className="text-xs text-muted-foreground">El correo no se puede modificar</p>
          </div>

          {/* Location */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="location" className="text-sm font-medium text-foreground">
              Ubicacion
            </Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="location"
                value={location}
                onChange={e => onLocationChange(e.target.value)}
                placeholder="Ciudad, barrio..."
                className="h-11 pl-10"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex flex-col items-center justify-between gap-3 border-t border-border pt-5 sm:flex-row">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className={cn(
              'h-2 w-2 rounded-full transition-colors',
              isDirty ? 'bg-warning' : 'bg-success'
            )} />
            {isDirty ? 'Cambios sin guardar' : 'Todo actualizado'}
          </div>
          <Button
            type="submit"
            disabled={loading || !isDirty}
            className="h-10 px-6"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Guardar cambios
          </Button>
        </div>
      </form>
    </div>
  )
}
