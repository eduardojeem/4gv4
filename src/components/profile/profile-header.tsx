'use client'

import { AvatarUpload } from '@/components/profile/avatar-upload'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { WhatsAppButton } from '@/components/ui/whatsapp-button'
import { getMarketplaceSupportPhone } from '@/lib/support-contact'
import { cn } from '@/lib/utils'
import { Building2, Calendar, LogOut, Mail, MessageCircle } from 'lucide-react'

const ROLE_CONFIG: Record<string, { label: string; color: string }> = {
  super_admin: { label: 'Super Admin', color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30' },
  admin: { label: 'Empresa / Administrador', color: 'bg-primary/10 text-primary border-primary/20' },
  mayorista: { label: 'Mayorista', color: 'bg-primary/10 text-primary border-primary/20' },
  client_mayorista: { label: 'Mayorista', color: 'bg-primary/10 text-primary border-primary/20' },
  vendedor: { label: 'Vendedor', color: 'bg-success/10 text-success border-success/20' },
  tecnico: { label: 'Tecnico', color: 'bg-info/10 text-info border-info/20' },
  cliente: { label: 'Cliente', color: 'bg-muted text-muted-foreground border-border' },
}

interface ProfileHeaderProps {
  name: string
  email: string
  role: string
  createdAt: string
  avatarUrl?: string
  phone?: string
  userId: string | null
  organizationName?: string | null
  onAvatarChange: (url: string) => void
  onLogout: () => void
}

export function ProfileHeader({
  name, email, role, createdAt, avatarUrl, userId, organizationName, onAvatarChange, onLogout
}: ProfileHeaderProps) {
  const roleInfo = ROLE_CONFIG[role || 'cliente'] || ROLE_CONFIG.cliente
  // Soporte del Marketplace es un canal de la plataforma, no el telefono de
  // la tienda ni el del cliente. Si no esta configurado, la accion se oculta.
  const supportPhone = getMarketplaceSupportPhone(process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP)

  return (
    <section className="border-b border-border bg-card">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-5 sm:flex-row">
          {/* Avatar */}
          <div className="shrink-0">
            <div>
              <AvatarUpload
                currentAvatarUrl={avatarUrl}
                userName={name}
                userId={userId}
                userEmail={email}
                onAvatarChange={onAvatarChange}
                size="md"
                compact
              />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                {name || 'Cargando...'}
              </h1>
              <Badge variant="outline" className={cn('text-[11px] font-medium', roleInfo.color)}>
                {roleInfo.label}
              </Badge>
              {organizationName && (
                <Badge variant="secondary" className="text-[11px] font-semibold gap-1 bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-500/30">
                  <Building2 className="h-3 w-3" />
                  {organizationName}
                </Badge>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground sm:justify-start">
              <span className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 shrink-0" /> {email}
              </span>
              {createdAt && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  Miembro desde {new Date(createdAt).getFullYear()}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 sm:self-start">
            {supportPhone && (
              <WhatsAppButton
                phone={supportPhone}
                message="Hola, quisiera hacer una consulta."
                variant="outline"
                size="sm"
                className="rounded-lg"
              >
                <MessageCircle className="h-4 w-4" />
                <span className="hidden md:inline">Ayuda</span>
              </WhatsAppButton>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onLogout}
              className="text-muted-foreground hover:text-destructive rounded-lg"
              aria-label="Cerrar sesion"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
