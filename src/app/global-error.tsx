'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
}: {
  error: Error
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html>
      <body className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="max-w-md text-center p-6 border rounded-lg bg-card shadow-sm">
          <h2 className="text-xl font-semibold mb-2">Ha ocurrido un error</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Algo salió mal al renderizar la aplicación.
          </p>
          <div className="text-left text-xs bg-muted/40 p-3 rounded mb-4 overflow-auto max-h-64">
            <div className="font-mono break-words">
              <div className="font-semibold mb-1">{error?.message || 'Error inesperado'}</div>
              {error?.stack && (
                <pre className="whitespace-pre-wrap">{error.stack}</pre>
              )}
            </div>
          </div>
          <button
            onClick={() => {
              // In global-error, Next.js does not provide a reset function.
              // Force a full reload to retry rendering.
              if (typeof window !== 'undefined') {
                window.location.reload()
              }
            }}
            className="inline-flex items-center px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  )
}