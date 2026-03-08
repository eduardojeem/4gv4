'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AvatarUpload } from '@/components/profile/avatar-upload'
import { cn } from '@/lib/utils'
import type { UserProfile } from '@/app/dashboard/profile/page'
import { MapPin, Briefcase, Building2, Globe } from 'lucide-react'

export interface DashboardProfileFormProps {
  profile: UserProfile
  setProfile: React.Dispatch<React.SetStateAction<UserProfile>>
  errors: Record<string, string>
  userId: string | null
  roleLabel: string
}

export function DashboardProfileForm({ profile, setProfile, errors, userId, roleLabel }: DashboardProfileFormProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Informacion personal</CardTitle>
          <CardDescription>Datos visibles en tu cuenta.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-6 sm:flex-row">
            <div className="flex-shrink-0">
              <AvatarUpload
                currentAvatarUrl={profile.avatarUrl}
                userName={profile.name}
                userId={userId}
                userEmail={profile.email}
                onAvatarChange={(url) => setProfile((p) => ({ ...p, avatarUrl: url }))}
                size="lg"
              />
            </div>

            <div className="grid flex-1 gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="profile-name" className="text-sm font-semibold">Nombre completo</Label>
                <Input
                  id="profile-name"
                  value={profile.name}
                  onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Tu nombre"
                  className={cn(errors.name && 'border-red-500')}
                />
                {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Rol actual</Label>
                <Input value={roleLabel} disabled readOnly className="font-medium bg-slate-50 dark:bg-slate-900" />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="profile-bio" className="text-sm font-semibold">Biografia</Label>
                <Textarea
                  id="profile-bio"
                  value={profile.bio || ''}
                  onChange={(e) => {
                    const next = e.target.value.slice(0, 500)
                    setProfile((p) => ({ ...p, bio: next }))
                  }}
                  placeholder="Escribe algo sobre ti"
                  rows={3}
                  maxLength={500}
                  className={cn("resize-none", errors.bio && 'border-red-500')}
                />
                <div className="flex justify-between items-center mt-1">
                  {errors.bio ? <p className="text-sm text-red-500">{errors.bio}</p> : <div />}
                  <p className="text-xs text-slate-500 text-right">{profile.bio?.length || 0}/500 caracteres</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contacto Profesional y Redes</CardTitle>
          <CardDescription>Informacion laboral y enlaces de contacto</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          {/* Contacto Base */}
          <div className="space-y-2">
            <Label htmlFor="profile-email" className="text-sm font-semibold">Email</Label>
            <Input id="profile-email" value={profile.email} disabled className={cn("bg-slate-50 dark:bg-slate-900", errors.email && 'border-red-500')} />
            {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-phone" className="text-sm font-semibold">Telefono</Label>
            <Input
              id="profile-phone"
              value={profile.phone || ''}
              onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
              placeholder="+595..."
              className={cn(errors.phone && 'border-red-500')}
            />
            {errors.phone && <p className="text-sm text-red-500">{errors.phone}</p>}
          </div>

          {/* Trabajo */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4 text-slate-500" />
              Departamento
            </Label>
            <Input
              value={profile.department || ''}
              onChange={(e) => setProfile((p) => ({ ...p, department: e.target.value }))}
              placeholder="Ej. Ventas, IT, Logistica"
              className={cn(errors.department && 'border-red-500')}
            />
            {errors.department && <p className="text-sm text-red-500">{errors.department}</p>}
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-slate-500" />
              Cargo
            </Label>
            <Input
              value={profile.jobTitle || ''}
              onChange={(e) => setProfile((p) => ({ ...p, jobTitle: e.target.value }))}
              placeholder="Ej. Gerente, Tecnico Especializado"
              className={cn(errors.jobTitle && 'border-red-500')}
            />
            {errors.jobTitle && <p className="text-sm text-red-500">{errors.jobTitle}</p>}
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <MapPin className="h-4 w-4 text-slate-500" />
              Ubicacion
            </Label>
            <Input
              value={profile.location || ''}
              onChange={(e) => setProfile((p) => ({ ...p, location: e.target.value }))}
              placeholder="Ciudad, pais"
              className={cn(errors.location && 'border-red-500')}
            />
            {errors.location && <p className="text-sm text-red-500">{errors.location}</p>}
          </div>

          {/* Redes */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <Globe className="h-4 w-4 text-slate-500" />
              Sitio web
            </Label>
            <Input
              value={profile.website || ''}
              onChange={(e) => setProfile((p) => ({ ...p, website: e.target.value }))}
              placeholder="https://..."
              className={cn(errors.website && 'border-red-500')}
            />
            {errors.website && <p className="text-sm text-red-500">{errors.website}</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
