'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, Home, RefreshCw, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { logger } from '@/lib/logger'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    logger.error('Dashboard render error:', error)
  }, [error])

  return (
    <div className="flex min-h-[70vh] w-full items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-xl rounded-2xl border border-destructive/20 bg-card p-6 sm:p-8 text-center shadow-lg dark:border-destructive/30">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive dark:bg-destructive/20">
          <AlertTriangle className="h-7 w-7" />
        </div>

        <h1 className="mt-5 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          No pudimos cargar esta sección
        </h1>

        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Tus registros e información no se han visto afectados. Puedes reintentar la acción o volver a la vista principal del panel.
        </p>

        {error.digest && (
          <div className="mt-3 inline-block rounded-md bg-muted px-2.5 py-1 text-xs font-mono text-muted-foreground">
            Código de referencia: {error.digest}
          </div>
        )}

        {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 max-h-48 overflow-auto rounded-lg bg-muted/60 p-3 text-left font-mono text-xs">
            <p className="font-semibold text-destructive">{error.name}: {error.message}</p>
            {error.stack && <pre className="mt-1.5 whitespace-pre-wrap text-[11px] text-muted-foreground">{error.stack}</pre>}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={() => reset()} className="gap-2 shadow-xs">
            <RotateCcw className="h-4 w-4" />
            Reintentar sección
          </Button>

          <Button
            variant="outline"
            onClick={() => {
              if (typeof window !== 'undefined') window.location.reload()
            }}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Recargar página
          </Button>

          <Button variant="ghost" asChild className="gap-2">
            <Link href="/dashboard">
              <Home className="h-4 w-4" />
              Ir al Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
