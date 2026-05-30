'use client'

import { useAuth } from '@/contexts/auth-context'
import { ShieldAlert } from 'lucide-react'

interface SuperAdminGuardProps {
  children: React.ReactNode
}

/**
 * Restringe el acceso a una sección solo para super_admin.
 * AdminGuard ya garantiza que hay sesión activa y rol admin/super_admin.
 * Este componente agrega la capa extra para super_admin exclusivo.
 */
export function SuperAdminGuard({ children }: SuperAdminGuardProps) {
  const { isSuperAdmin, loading } = useAuth()

  if (loading) return null

  if (!isSuperAdmin) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-center">
          <ShieldAlert className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Acceso Restringido
          </h2>
          <p className="text-muted-foreground">
            Esta sección es exclusiva para super administradores.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
