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
 * Redirige a /inicio si el usuario es cliente o no esta autenticado.
 */
export function DashboardGuard({ children }: DashboardGuardProps) {
  const { user, loading } = useAuth()
  const router = useRouter()

  const role = user?.role
  const isClientOrNoRole = !role || role === 'cliente'

  useEffect(() => {
    if (!loading && (!user || isClientOrNoRole)) {
      router.replace('/inicio')
    }
  }, [user, loading, isClientOrNoRole, router])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Verificando permisos...</p>
        </div>
      </div>
    )
  }

  if (!user || isClientOrNoRole) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <ShieldAlert className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Acceso Denegado
          </h2>
          <p className="text-muted-foreground">
            No tienes permisos para acceder al panel de administracion.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
