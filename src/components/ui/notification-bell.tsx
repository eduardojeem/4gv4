"use client"

import React, { useEffect, useState } from 'react'
import { BellRing } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useOptimizedNotifications } from '@/hooks/use-optimized-notifications'

export function NotificationBell() {
  const { pendingActionsCount, clearNotifications } = useOptimizedNotifications()
  const unread = pendingActionsCount
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      // Aquí podrías conectar con un WS o polling real.
    }, 15000)
    return () => clearInterval(interval)
  }, [])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" aria-label={`Notificaciones, ${unread} pendientes`}>
          <span className="relative">
            <BellRing className="h-5 w-5" />
            {unread > 0 && (
              <span
                aria-hidden
                className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive"
              />
            )}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Notificaciones</div>
          <Button variant="ghost" size="sm" onClick={clearNotifications}>Limpiar</Button>
        </div>
        <div className="mt-2 max-h-64 overflow-auto space-y-2">
          <div className="text-sm text-muted-foreground">No hay notificaciones disponibles</div>
        </div>
      </PopoverContent>
    </Popover>
  )
}