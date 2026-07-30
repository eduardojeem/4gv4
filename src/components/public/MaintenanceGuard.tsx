'use client'

import { useWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { MaintenancePage } from './MaintenancePage'
import { Loader2 } from 'lucide-react'
import type { WebsiteSettings } from '@/types/website-settings'

interface MaintenanceGuardProps {
  children: React.ReactNode
  initialSettings?: WebsiteSettings | null
}

export function MaintenanceGuard({ children, initialSettings = null }: MaintenanceGuardProps) {
  const { settings, isLoading } = useWebsiteSettings()
  const effectiveSettings = settings ?? initialSettings

  // Public layouts already load the settings on the server. Keep rendering that
  // snapshot while SWR revalidates instead of replacing the whole storefront.
  if (isLoading && !effectiveSettings) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground animate-pulse">Cargando configuración...</p>
        </div>
      </div>
    )
  }

  // If no settings are available, allow the site to render with its defaults.
  if (!effectiveSettings) {
    return <>{children}</>
  }

  if (effectiveSettings.maintenance_mode?.enabled) {
    return <MaintenancePage maintenanceMode={effectiveSettings.maintenance_mode} />
  }

  return <>{children}</>
}
