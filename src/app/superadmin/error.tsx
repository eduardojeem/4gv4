'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { logger } from '@/lib/logger'

export default function SuperAdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    logger.error('SuperAdmin render error:', error)
  }, [error])

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl items-center justify-center px-4">
      <div className="w-full rounded-lg border border-red-200 bg-card p-6 text-center dark:border-red-900/50">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-md bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h1 className="mt-4 text-lg font-semibold text-slate-900 dark:text-slate-50">
          No se pudo cargar esta sección
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
          Los datos no fueron reemplazados ni modificados. Reintenta la consulta para continuar.
        </p>
        {error.digest && (
          <p className="mt-2 text-xs text-slate-400">Referencia: {error.digest}</p>
        )}
        <Button className="mt-5 gap-2" onClick={reset}>
          <RefreshCw className="h-4 w-4" />
          Reintentar
        </Button>
      </div>
    </div>
  )
}
