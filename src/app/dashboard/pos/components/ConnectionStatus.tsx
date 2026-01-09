'use client'

import React, { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { 
  Wifi, WifiOff, Cloud, CloudOff, RefreshCw, 
  CheckCircle, AlertTriangle, Clock
} from 'lucide-react'
import { useCashRegisterContext } from '../contexts/CashRegisterContext'
import { toast } from 'sonner'

export function ConnectionStatus() {
  const { isOnline, lastSyncTime, syncWithServer } = useCashRegisterContext()
  const [isSyncing, setIsSyncing] = useState(false)

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      const success = await syncWithServer()
      if (success) {
        toast.success('Sincronización completada')
      } else {
        toast.error('Error en la sincronización')
      }
    } catch (error) {
      toast.error('Error en la sincronización')
    } finally {
      setIsSyncing(false)
    }
  }

  const getConnectionStatus = () => {
    if (!isOnline) {
      return {
        icon: WifiOff,
        label: 'Sin conexión',
        color: 'bg-red-100 text-red-800 border-red-200',
        description: 'Trabajando en modo offline'
      }
    }

    if (!lastSyncTime) {
      return {
        icon: CloudOff,
        label: 'No sincronizado',
        color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        description: 'Datos locales únicamente'
      }
    }

    const timeSinceSync = Date.now() - lastSyncTime.getTime()
    const minutesSinceSync = Math.floor(timeSinceSync / (1000 * 60))

    if (minutesSinceSync < 5) {
      return {
        icon: CheckCircle,
        label: 'Sincronizado',
        color: 'bg-green-100 text-green-800 border-green-200',
        description: 'Datos actualizados'
      }
    } else if (minutesSinceSync < 30) {
      return {
        icon: Clock,
        label: 'Parcialmente sincronizado',
        color: 'bg-blue-100 text-blue-800 border-blue-200',
        description: `Última sync: hace ${minutesSinceSync} min`
      }
    } else {
      return {
        icon: AlertTriangle,
        label: 'Sincronización pendiente',
        color: 'bg-orange-100 text-orange-800 border-orange-200',
        description: 'Requiere sincronización'
      }
    }
  }

  const status = getConnectionStatus()
  const StatusIcon = status.icon

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {isOnline ? (
                <Wifi className="h-4 w-4 text-green-500" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm font-medium">
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            
            <div className="h-4 w-px bg-border" />
            
            <Badge className={status.color}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {status.label}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            {lastSyncTime && (
              <span className="text-xs text-muted-foreground">
                {lastSyncTime.toLocaleTimeString('es-PY')}
              </span>
            )}
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={!isOnline || isSyncing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
            </Button>
          </div>
        </div>

        <div className="mt-2">
          <p className="text-xs text-muted-foreground">{status.description}</p>
        </div>

        {/* Connection Details */}
        <div className="mt-3 pt-3 border-t">
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-muted-foreground">Estado de red:</span>
              <span className={`ml-2 font-medium ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
                {isOnline ? 'Conectado' : 'Desconectado'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Modo de trabajo:</span>
              <span className="ml-2 font-medium">
                {isOnline ? 'Híbrido' : 'Local'}
              </span>
            </div>
          </div>
        </div>

        {/* Offline Warning */}
        {!isOnline && (
          <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
              <div className="text-xs">
                <p className="font-medium text-yellow-800">Modo Offline Activo</p>
                <p className="text-yellow-700 mt-1">
                  Los datos se guardan localmente y se sincronizarán cuando se restablezca la conexión.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Sync Pending Warning */}
        {isOnline && lastSyncTime && (Date.now() - lastSyncTime.getTime()) > 30 * 60 * 1000 && (
          <div className="mt-3 p-2 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-start gap-2">
              <Cloud className="h-4 w-4 text-orange-600 mt-0.5" />
              <div className="text-xs">
                <p className="font-medium text-orange-800">Sincronización Recomendada</p>
                <p className="text-orange-700 mt-1">
                  Han pasado más de 30 minutos desde la última sincronización.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}