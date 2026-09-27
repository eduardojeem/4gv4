'use client'

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AvatarUpload } from '@/components/profile/avatar-upload'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
  FileText,
  Check,
  Save,
  RefreshCw,
  Share2,
  Linkedin,
  Github,
  Twitter,
  Instagram
} from 'lucide-react'

export interface DashboardProfileFormProps {
  profile: UserProfile
  setProfile: React.Dispatch<React.SetStateAction<UserProfile>>
  errors: Record<string, string>
  userId: string | null
  roleLabel: string
  onAvatarChange?: (url: string) => void
  onSave?: () => void
  isSaving?: boolean
  isDirty?: boolean
}

export function DashboardProfileForm({
  profile,
  setProfile,
  errors,
  userId,
  roleLabel,
  onAvatarChange,
  onSave,
  isSaving = false,
  isDirty = false
}: DashboardProfileFormProps) {
  const bioLength = profile.bio?.length || 0

  const getSocialUrl = (type: 'linkedin' | 'twitter' | 'github' | 'instagram', value?: string | null) => {
    if (!value) return null
    const clean = value.trim()
    if (!clean) return null
    if (clean.startsWith('http://') || clean.startsWith('https://')) return clean
    const baseUrls: Record<string, string> = {
      linkedin: 'https://linkedin.com/in/',
      twitter: 'https://x.com/',
      github: 'https://github.com/',
      instagram: 'https://instagram.com/'
    }
    const handle = clean.startsWith('@') ? clean.slice(1) : clean
    return `${baseUrls[type]}${handle}`
  }

  const handleInsertParaguayCode = () => {
    if (!profile.phone || !profile.phone.startsWith('+595')) {
      setProfile((p) => ({ ...p, phone: '+595 9' }))
      const input = document.getElementById('profile-phone')
      input?.focus()
    }
  }

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
              <CardTitle className="text-xl">Información personal</CardTitle>
              <CardDescription>Datos visibles y avatar de tu perfil en la plataforma.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <div id="profile-avatar" className="flex flex-col items-center sm:items-start flex-shrink-0">
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
                JPG, PNG o WebP (máx 5MB)
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
                    Biografía personal o profesional
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
        {isDirty && onSave && (
          <CardFooter className="flex justify-end border-t border-border/50 py-3 bg-muted/20">
            <Button size="sm" onClick={onSave} disabled={isSaving} className="gap-1.5 text-xs shadow-sm">
              {isSaving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Guardar cambios
            </Button>
          </CardFooter>
        )}
      </Card>

      {/* Contacto Profesional */}
      <Card className="border-border/60 shadow-sm transition-shadow hover:shadow-md">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl">Contacto Profesional y Ubicación</CardTitle>
              <CardDescription>Información de contacto directo, área operativa y localización.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          {/* Email */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="profile-email" className="text-sm font-semibold flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                Correo electrónico
              </Label>
              <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30 gap-1 px-1.5 py-0.5">
                <Check className="h-3 w-3" />
                Verificado
              </Badge>
            </div>
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
                Teléfono / WhatsApp
              </Label>
              <div className="flex items-center gap-1.5">
                {(!profile.phone || !profile.phone.startsWith('+595')) && (
                  <button
                    type="button"
                    onClick={handleInsertParaguayCode}
                    className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-muted hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40 text-muted-foreground transition-colors"
                    title="Insertar código de Paraguay (+595)"
                  >
                    +595 PY
                  </button>
                )}
                <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30 gap-1 px-1.5 py-0.5">
                  <MessageCircle className="h-3 w-3" />
                  WhatsApp
                </Badge>
              </div>
            </div>
            <Input
              id="profile-phone"
              value={profile.phone || ''}
              onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
              placeholder="+595 981 123456"
              className={cn(errors.phone && 'border-destructive focus-visible:ring-destructive')}
            />
            <p className="text-[11px] text-muted-foreground">Incluye código de país (+595) para comunicación directa.</p>
            {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
          </div>

          {/* Departamento */}
          <div className="space-y-2">
            <Label htmlFor="profile-department" className="text-sm font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              Departamento o Área
            </Label>
            <Input
              id="profile-department"
              value={profile.department || ''}
              onChange={(e) => setProfile((p) => ({ ...p, department: e.target.value }))}
              placeholder="Ej. Ventas, Soporte Técnico, Logística"
              className={cn(errors.department && 'border-destructive')}
            />
            {errors.department && <p className="text-xs text-destructive">{errors.department}</p>}
          </div>

          {/* Cargo */}
          <div className="space-y-2">
            <Label htmlFor="profile-jobTitle" className="text-sm font-semibold flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              Cargo / Puesto
            </Label>
            <Input
              id="profile-jobTitle"
              value={profile.jobTitle || ''}
              onChange={(e) => setProfile((p) => ({ ...p, jobTitle: e.target.value }))}
              placeholder="Ej. Gerente de Sucursal, Técnico Senior"
              className={cn(errors.jobTitle && 'border-destructive')}
            />
            {errors.jobTitle && <p className="text-xs text-destructive">{errors.jobTitle}</p>}
          </div>

          {/* Ubicacion */}
          <div className="space-y-2">
            <Label htmlFor="profile-location" className="text-sm font-semibold flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              Ubicación / Ciudad
            </Label>
            <Input
              id="profile-location"
              value={profile.location || ''}
              onChange={(e) => setProfile((p) => ({ ...p, location: e.target.value }))}
              placeholder="Ej. Asunción, Paraguay"
              className={cn(errors.location && 'border-destructive')}
            />
            {errors.location && <p className="text-xs text-destructive">{errors.location}</p>}
          </div>

          {/* Sitio web o Portfolio */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="profile-website" className="text-sm font-semibold flex items-center gap-2">
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
              id="profile-website"
              value={profile.website || ''}
              onChange={(e) => setProfile((p) => ({ ...p, website: e.target.value }))}
              placeholder="https://tudominio.com"
              className={cn(errors.website && 'border-destructive')}
            />
            {errors.website && <p className="text-xs text-destructive">{errors.website}</p>}
          </div>
        </CardContent>
        {isDirty && onSave && (
          <CardFooter className="flex justify-end border-t border-border/50 py-3 bg-muted/20">
            <Button size="sm" onClick={onSave} disabled={isSaving} className="gap-1.5 text-xs shadow-sm">
              {isSaving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Guardar cambios
            </Button>
          </CardFooter>
        )}
      </Card>

      {/* Redes Sociales y Presencia Digital */}
      <Card className="border-border/60 shadow-sm transition-shadow hover:shadow-md">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
              <Share2 className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl">Redes Sociales y Presencia Digital</CardTitle>
              <CardDescription>Perfiles profesionales para conectar con clientes y compañeros de equipo.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          {/* LinkedIn */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="social-linkedin" className="text-sm font-semibold flex items-center gap-2">
                <Linkedin className="h-4 w-4 text-[#0A66C2]" />
                LinkedIn
              </Label>
              {getSocialUrl('linkedin', profile.socialLinks?.linkedin) && (
                <a
                  href={getSocialUrl('linkedin', profile.socialLinks?.linkedin) || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                >
                  Ver perfil <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <Input
              id="social-linkedin"
              value={profile.socialLinks?.linkedin || ''}
              onChange={(e) => setProfile((p) => ({
                ...p,
                socialLinks: { ...p.socialLinks, linkedin: e.target.value }
              }))}
              placeholder="tu-usuario o URL de LinkedIn"
            />
            <p className="text-[11px] text-muted-foreground">Ej: juan-perez o https://linkedin.com/in/juan-perez</p>
          </div>

          {/* Twitter / X */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="social-twitter" className="text-sm font-semibold flex items-center gap-2">
                <Twitter className="h-4 w-4 text-foreground" />
                Twitter / X
              </Label>
              {getSocialUrl('twitter', profile.socialLinks?.twitter) && (
                <a
                  href={getSocialUrl('twitter', profile.socialLinks?.twitter) || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                >
                  Ver perfil <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <Input
              id="social-twitter"
              value={profile.socialLinks?.twitter || ''}
              onChange={(e) => setProfile((p) => ({
                ...p,
                socialLinks: { ...p.socialLinks, twitter: e.target.value }
              }))}
              placeholder="@usuario o URL"
            />
            <p className="text-[11px] text-muted-foreground">Ej: @juanperez o https://x.com/juanperez</p>
          </div>

          {/* GitHub */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="social-github" className="text-sm font-semibold flex items-center gap-2">
                <Github className="h-4 w-4 text-foreground" />
                GitHub
              </Label>
              {getSocialUrl('github', profile.socialLinks?.github) && (
                <a
                  href={getSocialUrl('github', profile.socialLinks?.github) || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                >
                  Ver perfil <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <Input
              id="social-github"
              value={profile.socialLinks?.github || ''}
              onChange={(e) => setProfile((p) => ({
                ...p,
                socialLinks: { ...p.socialLinks, github: e.target.value }
              }))}
              placeholder="tu-usuario o URL de GitHub"
            />
            <p className="text-[11px] text-muted-foreground">Ej: juanperezdev</p>
          </div>

          {/* Instagram */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="social-instagram" className="text-sm font-semibold flex items-center gap-2">
                <Instagram className="h-4 w-4 text-[#E4405F]" />
                Instagram
              </Label>
              {getSocialUrl('instagram', profile.socialLinks?.instagram) && (
                <a
                  href={getSocialUrl('instagram', profile.socialLinks?.instagram) || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                >
                  Ver perfil <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <Input
              id="social-instagram"
              value={profile.socialLinks?.instagram || ''}
              onChange={(e) => setProfile((p) => ({
                ...p,
                socialLinks: { ...p.socialLinks, instagram: e.target.value }
              }))}
              placeholder="@usuario o URL de Instagram"
            />
            <p className="text-[11px] text-muted-foreground">Ej: @juanperez.py</p>
          </div>
        </CardContent>
        {isDirty && onSave && (
          <CardFooter className="flex justify-end border-t border-border/50 py-3 bg-muted/20">
            <Button size="sm" onClick={onSave} disabled={isSaving} className="gap-1.5 text-xs shadow-sm">
              {isSaving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Guardar cambios
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  )
}
