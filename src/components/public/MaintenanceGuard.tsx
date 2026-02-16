'use client'

import { useWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { MaintenancePage } from './MaintenancePage'
import { Loader2 } from 'lucide-react'

interface MaintenanceGuardProps {
  children: React.ReactNode
}

export function MaintenanceGuard({ children }: MaintenanceGuardProps) {
  const { settings, isLoading, error } = useWebsiteSettings()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground animate-pulse">Cargando configuración...</p>
        </div>
      </div>
    )
  }

  // If there's an error or no settings, we allow children to render 
  // to avoid blocking the site if the API fails, but usually we'd have settings.
  if (error || !settings) {
    return <>{children}</>
  }

  if (settings.maintenance_mode?.enabled) {
    return <MaintenancePage maintenanceMode={settings.maintenance_mode} />
  }

  return <>{children}</>
}
