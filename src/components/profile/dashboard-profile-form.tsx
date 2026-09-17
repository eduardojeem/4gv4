'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AvatarUpload } from '@/components/profile/avatar-upload'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { UserProfile } from '@/app/dashboard/profile/page'
import {
  MapPin,
  Briefcase,
  Building2,
  Globe,
  User,
  Mail,
  Phone,
  MessageCircle,
  ExternalLink,
  FileText
} from 'lucide-react'

export interface DashboardProfileFormProps {
  profile: UserProfile
  setProfile: React.Dispatch<React.SetStateAction<UserProfile>>
  errors: Record<string, string>
  userId: string | null
  roleLabel: string
  onAvatarChange?: (url: string) => void
}

export function DashboardProfileForm({
  profile,
  setProfile,
  errors,
  userId,
  roleLabel,
  onAvatarChange
}: DashboardProfileFormProps) {
  const bioLength = profile.bio?.length || 0

  return (
    <div className="space-y-6">
      {/* Informacion Personal */}
      <Card className="border-border/60 shadow-sm transition-shadow hover:shadow-md">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <User className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl">Informacion personal</CardTitle>
              <CardDescription>Datos visibles y avatar de tu perfil en la plataforma.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <div className="flex flex-col items-center sm:items-start flex-shrink-0">
              <AvatarUpload
                currentAvatarUrl={profile.avatarUrl}
                userName={profile.name}
                userId={userId}
                userEmail={profile.email}
                onAvatarChange={(url) => {
                  setProfile((p) => ({ ...p, avatarUrl: url }))
                  onAvatarChange?.(url)
                }}
                size="lg"
              />
              <span className="mt-2 text-xs text-muted-foreground text-center">
                JPG, PNG o WebP (max 5MB)
              </span>
            </div>

            <div className="grid flex-1 gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="profile-name" className="text-sm font-semibold flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  Nombre completo <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="profile-name"
                  value={profile.name}
                  onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Tu nombre y apellido"
                  className={cn(errors.name && 'border-destructive focus-visible:ring-destructive')}
                />
                {errors.name && <p className="text-xs text-destructive font-medium">{errors.name}</p>}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  Rol actual en la plataforma
                </Label>
                <div className="relative">
                  <Input
                    value={roleLabel}
                    disabled
                    readOnly
                    className="font-medium bg-muted/40 cursor-not-allowed border-dashed"
                  />
                  <Badge variant="secondary" className="absolute right-2 top-2.5 text-[11px] font-normal">
                    Solo lectura
                  </Badge>
                </div>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="profile-bio" className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    Biografia personal o profesional
                  </Label>
                  <span className={cn(
                    "text-xs font-mono transition-colors",
                    bioLength > 450 ? "text-amber-600 font-bold" : "text-muted-foreground"
                  )}>
                    {bioLength}/500 caracteres
                  </span>
                </div>
                <Textarea
                  id="profile-bio"
                  value={profile.bio || ''}
                  onChange={(e) => {
                    const next = e.target.value.slice(0, 500)
                    setProfile((p) => ({ ...p, bio: next }))
                  }}
                  placeholder="Cuenta brevemente tu experiencia, rol dentro de la empresa o intereses profesionales..."
                  rows={3}
                  maxLength={500}
                  className={cn("resize-none transition-colors", errors.bio && 'border-destructive')}
                />
                {errors.bio && <p className="text-xs text-destructive font-medium">{errors.bio}</p>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contacto Profesional y Redes */}
      <Card className="border-border/60 shadow-sm transition-shadow hover:shadow-md">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl">Contacto Profesional y Redes</CardTitle>
              <CardDescription>Informacion de contacto directo, area operativa y presencia digital.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="profile-email" className="text-sm font-semibold flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              Correo electronico
            </Label>
            <Input
              id="profile-email"
              value={profile.email}
              disabled
              readOnly
              className={cn("bg-muted/40 cursor-not-allowed", errors.email && 'border-destructive')}
            />
            <p className="text-[11px] text-muted-foreground">Para cambiar el email contacta al administrador de seguridad.</p>
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>

          {/* Telefono / WhatsApp */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="profile-phone" className="text-sm font-semibold flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                Telefono / WhatsApp
              </Label>
              <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30 gap-1 px-1.5 py-0.5">
                <MessageCircle className="h-3 w-3" />
                WhatsApp
              </Badge>
            </div>
            <Input
              id="profile-phone"
              value={profile.phone || ''}
              onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
              placeholder="+595 981 123456"
              className={cn(errors.phone && 'border-destructive focus-visible:ring-destructive')}
            />
            <p className="text-[11px] text-muted-foreground">Incluye codigo de pais (+595) para comunicacion directa.</p>
            {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
          </div>

          {/* Departamento */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              Departamento o Area
            </Label>
            <Input
              value={profile.department || ''}
              onChange={(e) => setProfile((p) => ({ ...p, department: e.target.value }))}
              placeholder="Ej. Ventas, Soporte Tecnico, Logistica"
              className={cn(errors.department && 'border-destructive')}
            />
            {errors.department && <p className="text-xs text-destructive">{errors.department}</p>}
          </div>

          {/* Cargo */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              Cargo / Puesto
            </Label>
            <Input
              value={profile.jobTitle || ''}
              onChange={(e) => setProfile((p) => ({ ...p, jobTitle: e.target.value }))}
              placeholder="Ej. Gerente de Sucursal, Tecnico Senior"
              className={cn(errors.jobTitle && 'border-destructive')}
            />
            {errors.jobTitle && <p className="text-xs text-destructive">{errors.jobTitle}</p>}
          </div>

          {/* Ubicacion */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              Ubicacion / Ciudad
            </Label>
            <Input
              value={profile.location || ''}
              onChange={(e) => setProfile((p) => ({ ...p, location: e.target.value }))}
              placeholder="Ej. Asuncion, Paraguay"
              className={cn(errors.location && 'border-destructive')}
            />
            {errors.location && <p className="text-xs text-destructive">{errors.location}</p>}
          </div>

          {/* Sitio web o Portfolio */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                Sitio web o Portfolio
              </Label>
              {profile.website && (profile.website.startsWith('http://') || profile.website.startsWith('https://')) && (
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                >
                  Abrir <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <Input
              value={profile.website || ''}
              onChange={(e) => setProfile((p) => ({ ...p, website: e.target.value }))}
              placeholder="https://tudominio.com"
              className={cn(errors.website && 'border-destructive')}
            />
            {errors.website && <p className="text-xs text-destructive">{errors.website}</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
