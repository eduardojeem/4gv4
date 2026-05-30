'use client'

import { useAuth } from '@/contexts/auth-context'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Loader2, ShieldAlert } from 'lucide-react'

interface DashboardGuardProps {
  children: React.ReactNode
}

/**
 * DashboardGuard - Protege el dashboard de usuarios sin acceso.
 *
 * Redirige a /login si no hay sesion.
 * Si el usuario existe pero no tiene permisos, mantiene la URL actual
 * y muestra un estado estable de acceso denegado.
 */
export function DashboardGuard({ children }: DashboardGuardProps) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [checkingOnboarding, setCheckingOnboarding] = useState(false)

  const isInactiveUser = user?.status === 'inactive' || user?.status === 'suspended'
  const isAccessDenied = Boolean(user && isInactiveUser)
  const canRequireOnboarding = Boolean(
    user &&
    !isInactiveUser &&
    user.role !== 'cliente' &&
    user.role !== 'super_admin' &&
    !pathname.startsWith('/dashboard/onboarding')
  )

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace('/login')
    } else if (user.role === 'cliente') {
      router.replace('/default/inicio')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (loading || !canRequireOnboarding) {
      setCheckingOnboarding(false)
      return
    }

    const controller = new AbortController()

    async function checkOnboardingStatus() {
      try {
        setCheckingOnboarding(true)
        const response = await fetch('/api/onboarding/status', {
          cache: 'no-store',
          signal: controller.signal,
        })

        if (!response.ok) return

        const payload = await response.json() as { needsOnboarding?: boolean }

        if (payload.needsOnboarding) {
          router.replace('/dashboard/onboarding')
        }
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Error checking onboarding status:', error)
        }
      } finally {
        if (!controller.signal.aborted) {
          setCheckingOnboarding(false)
        }
      }
    }

    checkOnboardingStatus()

    return () => {
      controller.abort()
    }
  }, [canRequireOnboarding, loading, router])

  if (loading || checkingOnboarding) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">
            {checkingOnboarding ? 'Validando configuracion inicial...' : 'Cargando...'}
          </p>
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

  if (isAccessDenied) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <ShieldAlert className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Acceso Denegado
          </h2>
          <p className="text-muted-foreground">
            No tienes permisos para acceder a esta seccion del dashboard.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
