'use client'

import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Loader2, ShieldAlert } from 'lucide-react'

interface AdminGuardProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

/**
 * AdminGuard - Protege rutas administrativas.
 *
 * Redirige a /login si no hay sesion.
 * Si el usuario existe pero no es admin, mantiene la URL actual
 * y muestra un estado estable de acceso denegado.
 */
export function AdminGuard({ children, fallback }: AdminGuardProps) {
  const { user, isAdmin, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace('/login')
    }
  }, [user, loading, router])

  if (loading) {
    return fallback || (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    )
  }

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

  if (!isAdmin) {
    return fallback || (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <ShieldAlert className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Acceso Denegado
          </h2>
          <p className="text-muted-foreground">
            No tienes permisos para acceder a esta seccion.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
