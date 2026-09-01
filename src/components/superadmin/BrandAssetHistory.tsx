'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { AlertTriangle, Check, ImageOff, Loader2, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'

export type BrandAssetField = 'logoUrl' | 'logoDarkUrl' | 'faviconUrl'

type BrandAsset = {
  name: string
  path: string
  url: string
  assetType: 'logo_light' | 'logo_dark' | 'favicon' | 'other'
  sizeBytes: number | null
  createdAt: string | null
  inUse: boolean
}

const TYPE_LABEL: Record<BrandAsset['assetType'], string> = {
  logo_light: 'Modo claro',
  logo_dark: 'Modo oscuro',
  favicon: 'Icono',
  other: 'Otro',
}

/** El campo del formulario al que corresponde cada tipo subido. */
const TYPE_FIELD: Record<BrandAsset['assetType'], BrandAssetField> = {
  logo_light: 'logoUrl',
  logo_dark: 'logoDarkUrl',
  favicon: 'faviconUrl',
  other: 'logoUrl',
}

function formatSize(bytes: number | null) {
  if (bytes === null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(value: string | null) {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime())
    ? '—'
    : parsed.toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/**
 * Historial de assets de marca subidos.
 *
 * Antes cada subida dejaba el archivo anterior huerfano en el bucket, sin forma
 * de verlo ni de borrarlo. Aca se listan todos, se puede volver a usar uno
 * anterior sin resubirlo, y se puede liberar espacio borrando los que no se usan.
 */
export function BrandAssetHistory({
  onUse,
  refreshToken,
}: {
  /** Asigna un asset existente al campo que le corresponde por su tipo. */
  onUse: (field: BrandAssetField, url: string) => void
  /** Cambia tras cada subida, para volver a pedir la lista. */
  refreshToken?: number
}) {
  const [assets, setAssets] = useState<BrandAsset[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<BrandAsset | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/superadmin/platform-branding/assets', { cache: 'no-store' })
      const payload = (await response.json().catch(() => null)) as
        | { success?: boolean; assets?: BrandAsset[]; error?: string }
        | null

      if (!response.ok || !payload?.success) {
        setError(payload?.error ?? 'No se pudo cargar el historial.')
        return
      }
      setError(null)
      setAssets(payload.assets ?? [])
    } catch {
      setError('No se pudo cargar el historial.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, refreshToken])

  async function confirmDelete() {
    if (!deleting || isDeleting) return
    setIsDeleting(true)
    try {
      const response = await fetch('/api/superadmin/platform-branding/assets', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: deleting.path }),
      })
      const payload = (await response.json().catch(() => null)) as { error?: string } | null

      if (!response.ok) {
        toast.error('No se pudo eliminar', { description: payload?.error })
        return
      }
      toast.success('Asset eliminado')
      setDeleting(null)
      await load()
    } finally {
      setIsDeleting(false)
    }
  }

  const unusedCount = assets.filter((asset) => !asset.inUse).length

  return (
    <section className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Historial de archivos subidos</h3>
            {assets.length > 0 && (
              <Badge variant="secondary" className="text-xs font-semibold">
                {assets.length}
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Reutilizá un logo anterior sin volver a subirlo, o liberá espacio eliminando los que no usás.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={isLoading} className="gap-1.5">
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          Actualizar
        </Button>
      </div>

      {unusedCount > 0 && (
        <p className="mb-3 flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {unusedCount} {unusedCount === 1 ? 'archivo ocupa espacio sin estar en uso' : 'archivos ocupan espacio sin estar en uso'}.
        </p>
      )}

      {error ? (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          {error}
        </p>
      ) : isLoading && assets.length === 0 ? (
        <div className="flex items-center justify-center gap-2 p-8 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando historial…
        </div>
      ) : assets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 p-8 text-center">
          <ImageOff className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-2 text-sm font-medium">Todavía no subiste ningún archivo</p>
          <p className="mt-1 text-xs text-muted-foreground">Los logos e iconos que subas van a aparecer acá.</p>
        </div>
      ) : (
        <ul role="list" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((asset) => (
            <li
              key={asset.path}
              className={cn(
                'rounded-xl border p-3 transition-colors',
                asset.inUse ? 'border-primary/40 bg-primary/5' : 'border-border/70 bg-background hover:border-border',
              )}
            >
              {/* Fondo a cuadros: sin esto, un logo blanco sobre fondo blanco
                  se ve como una tarjeta vacia. */}
              <div
                className="relative flex h-24 items-center justify-center overflow-hidden rounded-lg border border-border/50"
                style={{
                  backgroundImage:
                    'linear-gradient(45deg,#e2e8f0 25%,transparent 25%),linear-gradient(-45deg,#e2e8f0 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e2e8f0 75%),linear-gradient(-45deg,transparent 75%,#e2e8f0 75%)',
                  backgroundSize: '12px 12px',
                  backgroundPosition: '0 0,0 6px,6px -6px,-6px 0',
                  backgroundColor: '#f8fafc',
                }}
              >
                <Image
                  src={asset.url}
                  alt={asset.name}
                  fill
                  unoptimized
                  sizes="220px"
                  className="object-contain p-2"
                />
              </div>

              <div className="mt-2.5 flex items-center gap-1.5">
                <Badge variant="outline" className="text-[10px] font-semibold">
                  {TYPE_LABEL[asset.assetType]}
                </Badge>
                {asset.inUse && (
                  <Badge className="gap-1 bg-primary/10 text-[10px] font-semibold text-primary hover:bg-primary/10">
                    <Check className="h-3 w-3" />
                    En uso
                  </Badge>
                )}
              </div>

              <p className="mt-1.5 text-[11px] text-muted-foreground tabular-nums">
                {formatSize(asset.sizeBytes)} · {formatDate(asset.createdAt)}
              </p>

              <div className="mt-2.5 flex gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 flex-1 text-xs"
                  disabled={asset.inUse}
                  onClick={() => onUse(TYPE_FIELD[asset.assetType], asset.url)}
                >
                  {asset.inUse ? 'Asignado' : 'Usar'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={asset.inUse}
                  title={asset.inUse ? 'Asigná otro archivo antes de eliminar este' : 'Eliminar'}
                  onClick={() => setDeleting(asset)}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">Eliminar</span>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este archivo?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borra del almacenamiento y no se puede recuperar. Si alguna pantalla todavía apunta a
              esta dirección, va a quedar sin imagen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void confirmDelete()
              }}
              disabled={isDeleting}
            >
              {isDeleting ? 'Eliminando…' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
