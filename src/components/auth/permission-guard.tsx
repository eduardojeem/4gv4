'use client'

import React, { ReactNode } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { usePermissions, PermissionRequirement, ROUTE_PERMISSIONS } from '@/hooks/use-permissions'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Lock, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { AccessDenied } from '@/components/auth/AccessDenied'

interface PermissionGuardProps {
  children: ReactNode
  requirements: PermissionRequirement
  fallback?: ReactNode
  showFallback?: boolean
  redirectTo?: string
  className?: string
}

interface ConditionalRenderProps {
  children: ReactNode
  requirements: PermissionRequirement
  fallback?: ReactNode
}

interface RouteGuardProps {
  children: ReactNode
  route: string
  fallback?: ReactNode
  redirectTo?: string
}

// Componente principal de protección por permisos
export function PermissionGuard({
  children,
  requirements,
  fallback,
  showFallback = true,
  redirectTo,
  className
}: PermissionGuardProps) {
  const { isAuthorized } = usePermissions()
  const router = useRouter()

  const authorized = isAuthorized(requirements)

  // Si está autorizado, mostrar contenido
  if (authorized) {
    return <div className={className}>{children}</div>
  }

  // Si hay redirección configurada
  if (redirectTo) {
    router.push(redirectTo)
    return null
  }

  // Si hay fallback personalizado
  if (fallback) {
    return <div className={className}>{fallback}</div>
  }

  // Si no debe mostrar fallback, no renderizar nada
  if (!showFallback) {
    return null
  }

  // Fallback por defecto
  return (
    <div className={className}>
      <Alert variant="destructive">
        <Lock className="h-4 w-4" />
        <AlertDescription>
          No tienes permisos suficientes para acceder a este contenido.
        </AlertDescription>
      </Alert>
    </div>
  )
}

// Componente para renderizado condicional simple
export function ConditionalRender({ children, requirements, fallback }: ConditionalRenderProps) {
  const { isAuthorized } = usePermissions()

  if (isAuthorized(requirements)) {
    return <>{children}</>
  }

  return fallback ? <>{fallback}</> : null
}

// Componente para protección de rutas específicas
export function RouteGuard({ children, route, fallback, redirectTo }: RouteGuardProps) {
  const { canAccessRoute } = usePermissions()
  const router = useRouter()

  const canAccess = canAccessRoute(route)

  if (canAccess) {
    return <>{children}</>
  }

  if (redirectTo) {
    router.push(redirectTo)
    return null
  }

  if (fallback) {
    return <>{fallback}</>
  }

  return <AccessDenied />
}

// HOC para proteger componentes
export function withPermissionGuard<P extends object>(
  Component: React.ComponentType<P>,
  requirements: PermissionRequirement,
  fallback?: ReactNode
) {
  return function ProtectedComponent(props: P) {
    return (
      <PermissionGuard requirements={requirements} fallback={fallback}>
        <Component {...props} />
      </PermissionGuard>
    )
  }
}

// Hook para usar en componentes funcionales
export function usePermissionGuard(requirements: PermissionRequirement) {
  const { isAuthorized } = usePermissions()

  return {
    isAuthorized: isAuthorized(requirements),
    PermissionGuard: ({ children, ...props }: Omit<PermissionGuardProps, 'requirements'>) => (
      <PermissionGuard requirements={requirements} {...props}>
        {children}
      </PermissionGuard>
    )
  }
}

// Componente para mostrar información de permisos (útil para debugging)
export function PermissionDebugger({ requirements }: { requirements: PermissionRequirement }) {
  // Componente deshabilitado - no mostrar información sensible
  return null
}