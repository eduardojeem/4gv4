'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { logger } from '@/lib/logger'

export default function POSError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    logger.error('POS Error:', error)
  }, [error])

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center gap-4 text-center p-4">
      <div className="rounded-full bg-destructive/10 p-4">
        <AlertTriangle className="h-12 w-12 text-destructive" />
      </div>
      <h2 className="text-2xl font-bold tracking-tight">¡Algo salió mal en el Punto de Venta!</h2>
      <p className="text-muted-foreground max-w-[500px]">
        Ha ocurrido un error inesperado. Por favor, intenta recargar la página.
        Si el problema persiste, contacta a soporte técnico.
      </p>
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-4 p-4 bg-muted rounded text-left overflow-auto max-w-[800px] max-h-[200px] text-xs font-mono">
          <p className="font-bold text-destructive">{error.name}: {error.message}</p>
          <pre className="mt-2">{error.stack}</pre>
        </div>
      )}
      <div className="flex gap-4 mt-4">
        <Button onClick={() => window.location.reload()} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Recargar Página
        </Button>
        <Button onClick={() => reset()}>Intentar de nuevo</Button>
      </div>
    </div>
  )
}
