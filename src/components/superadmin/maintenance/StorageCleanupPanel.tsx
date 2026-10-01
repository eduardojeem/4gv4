'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  AlertTriangle,
  ArchiveRestore,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileImage,
  ImageOff,
  Loader2,
  Search,
  ShieldCheck,
  Trash2,
  Undo2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { StatCard } from '@/components/superadmin/StatCard'
import { Notice } from '@/components/superadmin/ui/page-header'
import {
  purgeImageTrashAction,
  restoreTrashedImagesAction,
  scanStorageAction,
  trashOrphanImagesAction,
} from '@/app/superadmin/maintenance/actions'
import { MIN_AGE_DAYS, TRASH_RETENTION_DAYS } from '@/lib/superadmin/storage-cleanup-rules'
import type { MissingImage, OrphanCandidate, StorageScanResult, TrashEntry } from '@/lib/superadmin/storage-cleanup'
import { cn } from '@/lib/utils'

const DAY = 86_400_000

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(1)} ${units[unit]}`
}

function formatNumber(value: number) {
  return value.toLocaleString('es-PY')
}

function formatDay(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('es-PY', { timeZone: 'America/Asuncion', day: '2-digit', month: 'short', year: 'numeric' })
}

function ageDays(value: string | null, now: number) {
  return value ? Math.floor((now - Date.parse(value)) / DAY) : 0
}

const PROTECTIONS = [
  'Solo se revisa la carpeta products/. Logos, branding y medios del sitio nunca se tocan.',
  'Una imagen está en uso si aparece en productos, variantes, marcas, categorías, tiendas, promociones, contenido o el catálogo global.',
  'El original de una foto en uso (la que subió el negocio antes de optimizarla) también se protege.',
  `Se ignora lo subido en los últimos ${MIN_AGE_DAYS} días: puede ser de un producto que se está cargando.`,
  'Si una tabla no se puede leer, el análisis se cancela. Si demasiadas imágenes figuran sin uso, se frena todo.',
  `Nada se borra directo: va a la papelera, se puede restaurar y recién a los ${TRASH_RETENTION_DAYS} días se puede borrar.`,
]

type View = 'orphans' | 'trash' | 'missing'
type Sort = 'size' | 'age'

function Thumb({ url, label }: { url: string; label: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="group relative block aspect-square overflow-hidden rounded-lg border bg-slate-100 dark:bg-slate-900"
      aria-label={`Abrir ${label} en una pestaña nueva`}
      onClick={(event) => event.stopPropagation()}
    >
      {/* Vista previa directa del bucket público: miniatura sin optimizar a propósito. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
      <span className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100">
        <ExternalLink className="h-3 w-3" />
      </span>
    </a>
  )
}

function useSelection(items: string[]) {
  const [raw, setSelected] = useState<Set<string>>(new Set())
  // Al volver a analizar, lo que ya no está en la lista deja de contar.
  const selected = useMemo(() => new Set(items.filter((path) => raw.has(path))), [items, raw])
  const toggle = (path: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  return { selected, setSelected, toggle }
}

function OrphansView({ scan, onDone, now }: { scan: StorageScanResult; onDone: () => void; now: number }) {
  const [sort, setSort] = useState<Sort>('size')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const items = useMemo(() => {
    const list = [...scan.candidates]
    if (sort === 'age') list.sort((a, b) => Date.parse(a.updatedAt ?? '') - Date.parse(b.updatedAt ?? ''))
    return list
  }, [scan.candidates, sort])
  const paths = useMemo(() => items.map((c) => c.path), [items])
  const { selected, setSelected, toggle } = useSelection(paths)
  const selectedBytes = items.filter((c) => selected.has(c.path)).reduce((sum, c) => sum + c.size, 0)
  const older90 = items.filter((c) => ageDays(c.updatedAt, now) >= 90)

  const moveToTrash = () =>
    startTransition(async () => {
      const result = await trashOrphanImagesAction([...selected])
      setConfirmOpen(false)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success(
        `${result.data.moved} imágenes movidas a la papelera${result.data.skipped ? ` · ${result.data.skipped} omitidas porque ya están en uso` : ''}`,
      )
      setSelected(new Set())
      onDone()
    })

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-10 text-center text-sm text-slate-500">
        <CheckCircle2 className="h-8 w-8 text-emerald-500" />
        No hay imágenes sin uso. Todo lo que está en products/ lo usa algún negocio.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 rounded-lg border bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between dark:bg-slate-900/50">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <label className="flex items-center gap-2">
            <Checkbox
              checked={selected.size === items.length ? true : selected.size > 0 ? 'indeterminate' : false}
              onCheckedChange={(value) => setSelected(value === true ? new Set(paths) : new Set())}
            />
            Todas ({formatNumber(items.length)})
          </label>
          {older90.length > 0 && (
            <Button variant="link" size="sm" className="h-auto px-0" onClick={() => setSelected(new Set(older90.map((c) => c.path)))}>
              Solo las de más de 90 días ({older90.length})
            </Button>
          )}
          <span className="flex items-center gap-1 text-xs text-slate-500">
            Ordenar:
            {(['size', 'age'] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={sort === value}
                onClick={() => setSort(value)}
                className={cn('rounded px-1.5 py-0.5', sort === value ? 'bg-white font-semibold text-foreground shadow-sm dark:bg-slate-800' : 'hover:text-foreground')}
              >
                {value === 'size' ? 'más pesadas' : 'más viejas'}
              </button>
            ))}
          </span>
        </div>
        <Button size="sm" disabled={selected.size === 0 || pending || scan.brake.tripped} onClick={() => setConfirmOpen(true)}>
          <Trash2 className="h-4 w-4" />
          {selected.size ? `Mover ${selected.size} a la papelera (${formatBytes(selectedBytes)})` : 'Mover a la papelera'}
        </Button>
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
        {items.map((file: OrphanCandidate) => {
          const isSelected = selected.has(file.path)
          return (
            <li key={file.path}>
              <div
                role="checkbox"
                aria-checked={isSelected}
                tabIndex={0}
                onClick={() => toggle(file.path)}
                onKeyDown={(event) => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); toggle(file.path) } }}
                className={cn(
                  'cursor-pointer space-y-2 rounded-xl border p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  isSelected ? 'border-amber-400 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40',
                )}
              >
                <div className="relative">
                  <Thumb url={file.publicUrl} label={file.path} />
                  <Checkbox checked={isSelected} className="pointer-events-none absolute left-1.5 top-1.5 bg-white dark:bg-slate-900" aria-hidden tabIndex={-1} />
                </div>
                <div className="text-xs">
                  <p className="font-semibold tabular-nums">{formatBytes(file.size)}</p>
                  <p className="text-slate-500">Hace {formatNumber(ageDays(file.updatedAt, now))} días</p>
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Mover {selected.size} imágenes a la papelera?</AlertDialogTitle>
            <AlertDialogDescription>
              Antes de moverlas se vuelve a verificar cada una: si alguna empezó a usarse, se omite. No se borra nada: durante {TRASH_RETENTION_DAYS} días se pueden restaurar desde la papelera con un clic.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(event) => { event.preventDefault(); moveToTrash() }} disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />} Mover a la papelera
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function TrashView({ scan, onDone, now }: { scan: StorageScanResult; onDone: () => void; now: number }) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [pending, startTransition] = useTransition()
  const paths = useMemo(() => scan.trash.map((t) => t.path), [scan.trash])
  const { selected, setSelected, toggle } = useSelection(paths)
  const purgeable = (entry: TrashEntry) => !entry.inUse && Date.parse(entry.purgeableAt) <= now
  const selectedPurgeable = scan.trash.filter((t) => selected.has(t.path) && purgeable(t))
  const inUse = scan.trash.filter((t) => t.inUse)

  const restore = (list: string[]) =>
    startTransition(async () => {
      const result = await restoreTrashedImagesAction(list)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success(`${result.data.restored} imágenes restauradas${result.data.failed ? ` · ${result.data.failed} no se pudieron restaurar` : ''}`)
      setSelected(new Set())
      onDone()
    })

  const purge = () =>
    startTransition(async () => {
      const result = await purgeImageTrashAction(selectedPurgeable.map((t) => t.path), confirmation)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success(`${result.data.deleted} imágenes borradas definitivamente${result.data.skipped ? ` · ${result.data.skipped} omitidas` : ''}`)
      setConfirmOpen(false)
      setConfirmation('')
      setSelected(new Set())
      onDone()
    })

  if (scan.trash.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-10 text-center text-sm text-slate-500">
        <ArchiveRestore className="h-8 w-8 text-slate-400" />
        La papelera está vacía.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {inUse.length > 0 && (
        <Notice tone="warning">
          <span className="flex flex-wrap items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {inUse.length === 1 ? 'Una imagen de la papelera volvió a usarse' : `${inUse.length} imágenes de la papelera volvieron a usarse`}: hay que restaurarlas para que se vean.
            <Button size="sm" variant="outline" disabled={pending} onClick={() => restore(inUse.map((t) => t.path))}>
              <Undo2 className="h-4 w-4" /> Restaurar ahora
            </Button>
          </span>
        </Notice>
      )}

      <div className="flex flex-col gap-3 rounded-lg border bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between dark:bg-slate-900/50">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={selected.size === paths.length ? true : selected.size > 0 ? 'indeterminate' : false}
            onCheckedChange={(value) => setSelected(value === true ? new Set(paths) : new Set())}
          />
          Todas ({formatNumber(paths.length)} · {formatBytes(scan.trashBytes)})
        </label>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={selected.size === 0 || pending} onClick={() => restore([...selected])}>
            <Undo2 className="h-4 w-4" /> Restaurar {selected.size || ''}
          </Button>
          <Button size="sm" variant="destructive" disabled={selectedPurgeable.length === 0 || pending} onClick={() => setConfirmOpen(true)}>
            <Trash2 className="h-4 w-4" /> Borrar definitivamente {selectedPurgeable.length || ''}
          </Button>
        </div>
      </div>

      <ul className="divide-y rounded-xl border dark:divide-slate-800 dark:border-slate-800">
        {scan.trash.map((entry) => {
          const ready = purgeable(entry)
          const daysLeft = Math.max(0, Math.ceil((Date.parse(entry.purgeableAt) - now) / DAY))
          return (
            <li key={entry.path} className="flex items-center gap-3 p-2.5">
              <Checkbox checked={selected.has(entry.path)} onCheckedChange={() => toggle(entry.path)} aria-label={`Seleccionar ${entry.originalPath}`} />
              <div className="w-14 shrink-0"><Thumb url={entry.publicUrl} label={entry.originalPath} /></div>
              <div className="min-w-0 flex-1 text-xs">
                <p className="truncate font-mono">{entry.originalPath.replace('products/', '')}</p>
                <p className="text-slate-500">{formatBytes(entry.size)} · en la papelera desde el {formatDay(entry.trashedOn)}</p>
              </div>
              {entry.inUse ? (
                <Badge className="shrink-0 bg-amber-500 hover:bg-amber-500">Volvió a usarse</Badge>
              ) : ready ? (
                <Badge variant="outline" className="shrink-0 border-red-300 text-red-700 dark:border-red-900 dark:text-red-300">Se puede borrar</Badge>
              ) : (
                <Badge variant="outline" className="shrink-0 gap-1"><Clock className="h-3 w-3" /> {daysLeft} días</Badge>
              )}
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => restore([entry.path])} aria-label={`Restaurar ${entry.originalPath}`}>
                <Undo2 className="h-4 w-4" />
              </Button>
            </li>
          )
        })}
      </ul>

      <AlertDialog open={confirmOpen} onOpenChange={(value) => { setConfirmOpen(value); if (!value) setConfirmation('') }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar definitivamente {selectedPurgeable.length} imágenes?</AlertDialogTitle>
            <AlertDialogDescription>
              Solo se borran las que llevan más de {TRASH_RETENTION_DAYS} días en la papelera y nadie volvió a usar. No se pueden recuperar. Escribí <b>BORRAR</b> para confirmar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="purge-confirm">Confirmación</Label>
            <Input id="purge-confirm" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" placeholder="BORRAR" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => { event.preventDefault(); purge() }}
              disabled={pending || confirmation.trim().toUpperCase() !== 'BORRAR'}
              className="bg-red-600 hover:bg-red-700"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />} Borrar definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

const TABLE_LABELS: Record<string, string> = {
  products: 'productos',
  product_variants: 'variantes',
  global_products: 'catálogo global',
  brands: 'marcas',
  categories: 'categorías',
  website_settings: 'sitio web',
  promotions_carousel: 'carrusel',
}

/** Fotos que un producto usa pero cuyo archivo no existe: en la tienda se ven rotas. */
function MissingView({ missing }: { missing: MissingImage[] }) {
  if (missing.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-10 text-center text-sm text-slate-500">
        <CheckCircle2 className="h-8 w-8 text-emerald-500" />
        Todas las fotos que usan los negocios existen.
      </div>
    )
  }
  const byStore = new Map<string, { store: MissingImage['stores'][number] | null; items: MissingImage[] }>()
  for (const item of missing) {
    const store = item.stores[0] ?? null
    const key = store?.id ?? 'sin-tienda'
    const group = byStore.get(key) ?? { store, items: [] }
    group.items.push(item)
    byStore.set(key, group)
  }
  return (
    <div className="space-y-3">
      <Notice tone="info">
        Estas fotos las usa algún producto pero el archivo no está en el almacenamiento, así que en la tienda se ven rotas. No las borró esta herramienta (nunca toca una foto en uso): suelen ser productos importados sin subir la imagen. Hay que volver a cargarlas desde el producto.
      </Notice>
      {[...byStore.values()].map(({ store, items }) => (
        <div key={store?.id ?? 'sin-tienda'} className="rounded-xl border">
          <div className="flex items-center justify-between gap-2 border-b bg-slate-50 px-3 py-2 text-sm dark:bg-slate-900/50">
            <span className="font-semibold">{store?.name ?? 'Sin tienda (plataforma)'} <span className="font-normal text-slate-500">· {items.length}</span></span>
            {store?.slug && (
              <Button asChild variant="link" size="sm" className="h-auto px-0">
                <Link href={`/superadmin/organizations/${store.slug}`}>Ver organización →</Link>
              </Button>
            )}
          </div>
          <ul className="divide-y text-xs dark:divide-slate-800">
            {items.map((item) => (
              <li key={item.path} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="truncate font-mono">{item.path.replace('products/', '')}</span>
                <span className="shrink-0 text-slate-500">en {item.tables.map((table) => TABLE_LABELS[table] ?? table).join(', ')}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

/**
 * El análisis vive en el padre: cambiar de pestaña no obliga a releer todas
 * las tablas otra vez.
 */
export function StorageCleanupPanel({
  scan,
  onScan,
}: {
  scan: StorageScanResult | null
  onScan: (scan: StorageScanResult | null) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<View>('orphans')
  const [scanning, startScan] = useTransition()
  const now = scan ? Date.parse(scan.scannedAt) : 0

  const runScan = () =>
    startScan(async () => {
      const result = await scanStorageAction()
      if ('error' in result) {
        setError(result.error)
        onScan(null)
        return
      }
      setError(null)
      onScan(result.data)
    })

  // Abrir la pestaña ya analiza: es solo lectura.
  useEffect(() => {
    if (!scan) runScan()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <Card className="min-w-0 rounded-xl">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base"><FileImage className="h-4 w-4" /> Imágenes de productos sin uso</CardTitle>
            <CardDescription className="max-w-2xl">
              Fotos que quedaron en el almacenamiento cuando un producto se borró o cambió de imagen. Liberan espacio, pero nunca se borran sin pasar por la papelera.
            </CardDescription>
          </div>
          <Button variant="outline" onClick={runScan} disabled={scanning}>
            {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {scan ? 'Volver a analizar' : 'Analizar'}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <Notice tone="error">{error}</Notice>}
          {scanning && !scan && (
            <p className="flex items-center justify-center gap-2 rounded-lg border border-dashed p-10 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Revisando imágenes y dónde se usan…
            </p>
          )}
          {scan && (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard label="Fotos de productos" value={formatNumber(scan.productFiles)} sub={`${formatNumber(scan.totalFiles)} archivos · ${formatBytes(scan.totalBytes)}`} icon={FileImage} />
                <StatCard label="Sin uso" value={formatNumber(scan.candidates.length)} sub={formatBytes(scan.candidateBytes)} icon={Trash2} tone={scan.candidates.length ? 'warning' : 'success'} />
                <StatCard label="Protegidas" value={formatNumber(scan.protectedVariants + scan.skippedRecent)} sub={`${scan.protectedVariants} originales · ${scan.skippedRecent} recientes`} icon={ShieldCheck} tone="info" />
                <StatCard label="En la papelera" value={formatNumber(scan.trash.length)} sub={formatBytes(scan.trashBytes)} icon={ArchiveRestore} tone={scan.trash.some((t) => t.inUse) ? 'danger' : 'default'} />
              </div>

              {scan.missing.length > 0 && view !== 'missing' && (
                <Notice tone="warning">
                  <span className="flex flex-wrap items-center gap-2">
                    <ImageOff className="h-4 w-4" />
                    {scan.missing.length === 1 ? 'Una foto que usa un negocio no existe' : `${scan.missing.length} fotos que usan los negocios no existen`} y se ven rotas en la tienda.
                    <Button size="sm" variant="outline" onClick={() => setView('missing')}>Ver cuáles</Button>
                  </span>
                </Notice>
              )}

              {scan.brake.tripped && (
                <Notice tone="error">
                  Freno de seguridad: el {Math.round(scan.brake.share * 100)}% de las fotos figura sin uso. Eso suele indicar que falta revisar alguna tabla, no que sobren fotos. No se puede mover nada hasta que se revise.
                </Notice>
              )}

              <div role="tablist" aria-label="Imágenes" className="inline-flex rounded-lg border bg-slate-50 p-1 text-sm dark:bg-slate-900/50">
                {([
                  ['orphans', `Sin uso (${scan.candidates.length})`],
                  ['trash', `Papelera (${scan.trash.length})`],
                  ['missing', `Faltan (${scan.missing.length})`],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={view === value}
                    onClick={() => setView(value)}
                    className={cn('rounded-md px-3 py-1.5 transition-colors', view === value ? 'bg-white font-semibold shadow-sm dark:bg-slate-800' : 'text-slate-500 hover:text-foreground')}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {view === 'orphans' && <OrphansView scan={scan} onDone={runScan} now={now} />}
              {view === 'trash' && <TrashView scan={scan} onDone={runScan} now={now} />}
              {view === 'missing' && <MissingView missing={scan.missing} />}

              <p className="text-xs text-slate-500">
                Analizado el {new Date(scan.scannedAt).toLocaleString('es-PY', { timeZone: 'America/Asuncion', dateStyle: 'short', timeStyle: 'short' })} · {formatNumber(scan.referencedPaths)} imágenes en uso encontradas en {scan.sources.length} tablas.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="h-fit rounded-xl">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Cómo se protegen las fotos</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2.5 text-sm text-slate-600 dark:text-slate-300">
            {PROTECTIONS.map((rule) => (
              <li key={rule} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <span>{rule}</span>
              </li>
            ))}
          </ul>
          {scan && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {scan.folders.map((folder) => (
                <Badge key={folder.folder} variant="outline" className="rounded-full text-[11px]">
                  {folder.folder}/ · {formatNumber(folder.files)}{folder.protected ? ' · protegida' : ''}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
