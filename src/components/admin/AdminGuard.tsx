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
 * AdminGuard - Protege rutas administrativas
 * 
 * Verifica que el usuario esté autenticado y tenga rol de admin.
 * Redirige a /dashboard si no tiene permisos.
 * 
 * @example
 * <AdminGuard>
 *   <AdminPanel />
 * </AdminGuard>
 */
export function AdminGuard({ children, fallback }: AdminGuardProps) {
  const { user, isAdmin, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      // Redirigir a dashboard si no es admin
      router.push('/dashboard')
    }
  }, [user, isAdmin, loading, router])

  // Mostrar loading mientras se verifica
  if (loading) {
    return fallback || (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Verificando permisos...</p>
        </div>
      </div>
    )
  }

  // No mostrar nada si no es admin (se está redirigiendo)
  if (!user || !isAdmin) {
    return fallback || (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <ShieldAlert className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Acceso Denegado
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            No tienes permisos para acceder a esta sección.
          </p>
        </div>
      </div>
    )
  }

  // Usuario es admin, mostrar contenido
  return <>{children}</>
}
