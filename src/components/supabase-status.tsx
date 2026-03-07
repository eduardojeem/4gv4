/**
 * Componente para mostrar el estado de conexion con Supabase
 */

'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { createClient } from '@/lib/supabase/client'

interface SupabaseStatusProps {
  mode?: 'full' | 'compact' | 'minimal'
  className?: string
}

interface StatusState {
  connected: boolean
  loading: boolean
  error: string | null
  tablesCount: number
}

export function SupabaseStatus({ mode = 'full', className = '' }: SupabaseStatusProps) {
  const [status, setStatus] = useState<StatusState>({
    connected: false,
    loading: true,
    error: null,
    tablesCount: 0
  })

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const supabase = createClient()
        
        // Verificar conexion basica
        const { data, error } = await supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .limit(1)

        if (error) {
          throw error
        }

        // Contar productos
        const { count } = await supabase
          .from('products')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true)

        setStatus({
          connected: true,
          loading: false,
          error: null,
          tablesCount: count || 0
        })
      } catch (err) {
        console.error('Error verificando conexion Supabase:', err)
        setStatus({
          connected: false,
          loading: false,
          error: err instanceof Error ? err.message : 'Error de conexion',
          tablesCount: 0
        })
      }
    }

    checkConnection()
  }, [])

  if (mode === 'compact' || mode === 'minimal') {
    if (status.loading) {
      return (
        <div className={`flex items-center gap-1.5 ${className}`} title="Verificando conexion...">
          <Loader2 className="h-3 w-3 text-muted-foreground animate-spin" />
          {mode === 'compact' && <span className="text-[10px] text-muted-foreground">Conectando...</span>}
        </div>
      )
    }

    if (!status.connected) {
      return (
        <div className={`flex items-center gap-1.5 ${className}`} title={`Error: ${status.error}`}>
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </div>
          {mode === 'compact' && <span className="text-[10px] text-red-500 font-medium">Offline</span>}
        </div>
      )
    }

    return (
      <div className={`flex items-center gap-1.5 ${className}`} title={`Conectado: ${status.tablesCount} productos`}>
        <div className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
        </div>
        {mode === 'compact' && <span className="text-[10px] text-muted-foreground font-medium">Online</span>}
      </div>
    )
  }

  if (status.loading) {
    return (
      <Alert className={`mb-4 border-blue-200 bg-blue-50 ${className}`}>
        <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
        <AlertDescription className="text-blue-800 text-sm">
          Verificando conexion con base de datos...
        </AlertDescription>
      </Alert>
    )
  }

  if (!status.connected) {
    return (
      <Alert className={`mb-4 border-red-200 bg-red-50 ${className}`}>
        <AlertCircle className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-800 text-sm">
          <strong>Error de conexion:</strong> {status.error}
          <br />
          <span className="text-xs mt-1 block">
            Verifique la configuracion de Supabase en .env.local
          </span>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Alert className={`mb-4 border-green-200 bg-green-50 ${className}`}>
      <CheckCircle2 className="h-4 w-4 text-green-600" />
      <AlertDescription className="text-green-800 text-sm">
        <strong>Conectado a Supabase:</strong> {status.tablesCount} productos disponibles
        <br />
        <span className="text-xs mt-1 block">
          Sistema funcionando en modo produccion
        </span>
      </AlertDescription>
    </Alert>
  )
}

