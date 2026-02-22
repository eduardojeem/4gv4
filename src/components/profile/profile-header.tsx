'use client'

import { AvatarUpload } from '@/components/profile/avatar-upload'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { WhatsAppButton } from '@/components/ui/whatsapp-button'
import { cn } from '@/lib/utils'
import { Calendar, LogOut, Mail, MessageCircle } from 'lucide-react'
import Link from 'next/link'

const ROLE_CONFIG: Record<string, { label: string; color: string }> = {
  admin: { label: 'Administrador', color: 'bg-primary/10 text-primary border-primary/20' },
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
  onAvatarChange: (url: string) => void
  onLogout: () => void
}

export function ProfileHeader({
  name, email, role, createdAt, avatarUrl, phone, userId, onAvatarChange, onLogout
}: ProfileHeaderProps) {
  const roleInfo = ROLE_CONFIG[role || 'cliente'] || ROLE_CONFIG.cliente

  return (
    <section className="relative overflow-hidden border-b border-border bg-card">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)',
        backgroundSize: '24px 24px',
      }} />

      <div className="relative mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
          {/* Avatar */}
          <div className="shrink-0">
            <div className="rounded-full border-2 border-border bg-card p-1 shadow-sm">
              <AvatarUpload
                currentAvatarUrl={avatarUrl}
                userName={name}
                userId={userId}
                userEmail={email}
                onAvatarChange={onAvatarChange}
                size="lg"
              />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {name || 'Cargando...'}
              </h1>
              <Badge variant="outline" className={cn('text-[11px] font-medium', roleInfo.color)}>
                {roleInfo.label}
              </Badge>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-sm text-muted-foreground sm:justify-start">
              <span className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 shrink-0" /> {email}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                Miembro desde {new Date(createdAt || Date.now()).getFullYear()}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {phone && (
              <WhatsAppButton
                phone={phone}
                message="Hola! Quisiera consultar sobre mi reparacion."
                variant="outline"
                size="sm"
                className="rounded-lg"
              >
                <MessageCircle className="h-4 w-4" />
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
