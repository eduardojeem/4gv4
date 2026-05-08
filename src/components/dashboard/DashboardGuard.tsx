'use client'

import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Loader2, ShieldAlert } from 'lucide-react'

interface DashboardGuardProps {
  children: React.ReactNode
}

/**
 * DashboardGuard - Protege el dashboard de usuarios con rol 'cliente'.
 *
 * Solo los roles admin, vendedor y tecnico tienen acceso.
 * Redirige a /login si no hay sesión, o a /inicio si el usuario es cliente.
 */
export function DashboardGuard({ children }: DashboardGuardProps) {
  const { user, loading } = useAuth()
  const router = useRouter()

  const role = user?.role
  const isClientRole = role === 'cliente'

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace('/login')
    } else if (isClientRole) {
      router.replace('/inicio')
    }
  }, [user, loading, isClientRole, router])

  // Still loading auth state — show spinner
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    )
  }

  // No user — redirect is happening via useEffect, show spinner while it navigates
  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Redirigiendo...</p>
        </div>
      </div>
    )
  }

  // User exists but has client role — show access denied briefly while redirect happens
  if (isClientRole) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <ShieldAlert className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Acceso Denegado
          </h2>
          <p className="text-muted-foreground">
            No tienes permisos para acceder al panel de administración.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
