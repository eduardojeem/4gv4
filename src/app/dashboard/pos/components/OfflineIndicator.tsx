'use client'

import { Wifi, WifiOff, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface OfflineIndicatorProps {
  isOnline: boolean
  pendingSales?: number
  onSync?: () => void
  isSyncing?: boolean
}

export function OfflineIndicator({
  isOnline,
  pendingSales = 0,
  onSync,
  isSyncing = false
}: OfflineIndicatorProps) {
  if (isOnline && pendingSales === 0) return null

  return (
    <div
      className={cn(
        'fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg transition-all',
        isOnline
          ? 'bg-yellow-500 text-yellow-950'
          : 'bg-red-500 text-white'
      )}
      role="status"
      aria-live="polite"
    >
      {isOnline ? (
        <Wifi className="h-4 w-4" aria-hidden="true" />
      ) : (
        <WifiOff className="h-4 w-4" aria-hidden="true" />
      )}
      
      <span className="text-sm font-medium">
        {isOnline
          ? `${pendingSales} venta${pendingSales !== 1 ? 's' : ''} pendiente${pendingSales !== 1 ? 's' : ''}`
          : 'Modo Offline'}
      </span>

      {isOnline && pendingSales > 0 && onSync && (
        <button
          onClick={onSync}
          disabled={isSyncing}
          className="ml-2 p-1 hover:bg-yellow-600 rounded transition-colors disabled:opacity-50"
          aria-label="Sincronizar ventas pendientes"
        >
          <RefreshCw
            className={cn('h-4 w-4', isSyncing && 'animate-spin')}
            aria-hidden="true"
          />
        </button>
      )}
    </div>
  )
}
