'use client'

import { AlertTriangle, Images } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useWebsiteMediaQuota } from '@/hooks/useWebsiteMediaQuota'

interface WebsiteMediaQuotaBannerProps {
  onOpenHistory: () => void
  showOnlyWhenAtLimit?: boolean
}

export function WebsiteMediaQuotaBanner({
  onOpenHistory,
  showOnlyWhenAtLimit = false,
}: WebsiteMediaQuotaBannerProps) {
  const { count, limit, isAtLimit, isNearLimit } = useWebsiteMediaQuota()

  if (isAtLimit) {
    return (
      <div
        role="alert"
        className="rounded-2xl border-2 border-destructive/60 bg-destructive/10 p-4 sm:p-5 text-destructive flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5 shadow-sm animate-in fade-in duration-200"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-destructive text-destructive-foreground font-bold shadow-xs">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-destructive">
                Límite de imágenes alcanzado ({count} de {limit})
              </h4>
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 font-bold">
                Subidas bloqueadas
              </Badge>
            </div>
            <p className="text-xs text-destructive/90 leading-relaxed max-w-xl">
              Tu organización ha alcanzado el límite máximo de {limit} imágenes en el sitio web. Para subir nuevos archivos, eliminá imágenes antiguas desde el Historial para liberar cupo de forma inmediata.
            </p>
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          variant="destructive"
          onClick={onOpenHistory}
          className="shrink-0 gap-2 font-bold h-9 px-4 rounded-xl shadow-xs self-start sm:self-center"
        >
          <Images className="h-4 w-4" />
          <span>Liberar espacio en el Historial</span>
        </Button>
      </div>
    )
  }

  if (isNearLimit && !showOnlyWhenAtLimit) {
    return (
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-amber-800 dark:text-amber-300 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 text-xs">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>
            <strong>Espacio de imágenes reducido:</strong> {count} de {limit} usadas ({limit - count} disponibles).
          </span>
        </div>
        <button
          type="button"
          onClick={onOpenHistory}
          className="font-semibold underline hover:opacity-80 self-start sm:self-auto cursor-pointer"
        >
          Gestionar en Historial
        </button>
      </div>
    )
  }

  return null
}
