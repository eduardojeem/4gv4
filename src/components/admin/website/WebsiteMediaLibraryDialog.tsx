'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
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
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import {
  Images,
  Upload,
  Trash2,
  Check,
  Copy,
  Loader2,
  AlertTriangle,
  RefreshCw,
  ImageIcon,
  ZoomIn,
  Search,
  Grid2X2,
  Grid3X3,
  Sun,
  Moon,
  ExternalLink,
  X,
  Maximize2,
  ArrowUpDown,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WebsiteMediaItem, WebsiteMediaSection } from '@/types/website-settings'

const MAX_ITEMS = 20

const SECTION_LABELS: Record<WebsiteMediaSection, string> = {
  logo: 'Logo',
  promotions: 'Carrusel / Banner',
  gallery: 'Galería de trabajos',
  team: 'Equipo',
  announcements: 'Aviso',
  brands: 'Marca',
  general: 'General',
}

type SortOption = 'newest' | 'oldest' | 'largest' | 'name'

interface WebsiteMediaLibraryDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: React.ReactNode
  onSelect?: (url: string, item: WebsiteMediaItem) => void
  filterSection?: WebsiteMediaSection
  currentActiveUrl?: string
  title?: string
  description?: string
}

export function WebsiteMediaLibraryDialog({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  trigger,
  onSelect,
  filterSection: initialFilterSection,
  currentActiveUrl,
  title = 'Historial de Logos e Imágenes',
  description = 'Reutilizá imágenes ya subidas con máxima nitidez o eliminalas definitivamente para liberar espacio.',
}: WebsiteMediaLibraryDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : internalOpen

  const handleOpenChange = (val: boolean) => {
    if (!isControlled) setInternalOpen(val)
    controlledOnOpenChange?.(val)
  }

  const [items, setItems] = useState<WebsiteMediaItem[]>([])
  const [count, setCount] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [activeTab, setActiveTab] = useState<string>(initialFilterSection || 'all')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'large' | 'medium'>('large')
  const [canvasBg, setCanvasBg] = useState<'checker' | 'dark' | 'light'>('checker')
  const [sortBy, setSortBy] = useState<SortOption>('newest')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Drag and drop state
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const dragCounter = useRef(0)

  // Lightbox / Vista previa ampliada
  const [previewItem, setPreviewItem] = useState<WebsiteMediaItem | null>(null)
  const [previewZoom, setPreviewZoom] = useState(false)

  // Eliminación
  const [itemToDelete, setItemToDelete] = useState<WebsiteMediaItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const uploadInputRef = useRef<HTMLInputElement>(null)

  const fetchMedia = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/admin/website/media')
      const data = await res.json()
      if (res.ok && data.success) {
        setItems(data.items || [])
        setCount(data.count ?? (data.items?.length || 0))
      } else {
        toast.error(data.error || 'Error al cargar el historial de imágenes')
      }
    } catch {
      toast.error('No se pudo conectar con el servidor para cargar las imágenes')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      fetchMedia()
    }
  }, [isOpen, fetchMedia])

  // Subir archivo reutilizable (para drag & drop e input file)
  const uploadFile = async (file: File) => {
    if (count >= MAX_ITEMS) {
      toast.error(`Límite alcanzado: máximo ${MAX_ITEMS} imágenes por organización`)
      return
    }

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      if (initialFilterSection) {
        formData.append('section', initialFilterSection)
      } else if (activeTab !== 'all') {
        formData.append('section', activeTab)
      }

      const res = await fetch('/api/admin/website/media', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        toast.error(data.error || 'Error al subir la imagen')
        return
      }

      toast.success('Imagen agregada al historial')
      fetchMedia()
      window.dispatchEvent(new CustomEvent('website-media-updated'))
    } catch {
      toast.error('Error al subir el archivo')
    } finally {
      setIsUploading(false)
      if (uploadInputRef.current) uploadInputRef.current.value = ''
    }
  }

  // Manejo de drag and drop
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current += 1
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingOver(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current -= 1
    if (dragCounter.current <= 0) {
      setIsDraggingOver(false)
      dragCounter.current = 0
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(false)
    dragCounter.current = 0

    const file = e.dataTransfer.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Solo se admiten archivos de imagen (PNG, JPG, WebP, SVG, AVIF)')
      return
    }

    await uploadFile(file)
  }

  const handleDirectUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      await uploadFile(file)
    }
  }

  // Eliminar definitivamente
  const handleConfirmDelete = async () => {
    if (!itemToDelete) return
    setIsDeleting(true)
    try {
      const res = await fetch('/api/admin/website/media', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: itemToDelete.id, path: itemToDelete.path }),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        toast.error(data.error || 'No se pudo eliminar la imagen')
        return
      }

      toast.success('Imagen eliminada definitivamente. Espacio liberado en tu cuota.')
      if (previewItem?.id === itemToDelete.id) {
        setPreviewItem(null)
      }
      setItemToDelete(null)
      fetchMedia()
      window.dispatchEvent(new CustomEvent('website-media-updated'))
    } catch {
      toast.error('Error al eliminar la imagen')
    } finally {
      setIsDeleting(false)
    }
  }

  // Copiar URL al portapapeles con feedback instantáneo
  const handleCopyUrl = async (id: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(id)
      toast.success('Enlace copiado al portapapeles')
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      toast.error('No se pudo copiar el enlace')
    }
  }

  const isAtLimit = count >= MAX_ITEMS
  const isNearLimit = count >= 16 && !isAtLimit
  const progressPercent = Math.min(100, Math.round((count / MAX_ITEMS) * 100))

  const isItemActive = useCallback(
    (item?: WebsiteMediaItem | null) => {
      if (!item || !currentActiveUrl) return false
      return item.url === currentActiveUrl || (item.path && currentActiveUrl.includes(item.path))
    },
    [currentActiveUrl]
  )

  const sortedAndFilteredItems = useMemo(() => {
    const filtered = items.filter((item) => {
      if (activeTab !== 'all' && item.section !== activeTab) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchName = item.name.toLowerCase().includes(q)
        const matchSection = item.section ? SECTION_LABELS[item.section].toLowerCase().includes(q) : false
        return matchName || matchSection
      }
      return true
    })

    return filtered.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      }
      if (sortBy === 'oldest') {
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
      }
      if (sortBy === 'largest') {
        return (b.size || 0) - (a.size || 0)
      }
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name)
      }
      return 0
    })
  }, [items, activeTab, searchQuery, sortBy])

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return null
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (iso?: string) => {
    if (!iso) return ''
    try {
      const date = new Date(iso)
      return date.toLocaleDateString('es-PY', { day: '2-digit', month: 'short', year: 'numeric' })
    } catch {
      return ''
    }
  }

  const getImageFormat = (item: WebsiteMediaItem) => {
    const ext = (item.name.split('.').pop() || item.url.split('.').pop() || '').toLowerCase()
    if (ext === 'png') return { label: 'PNG', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' }
    if (ext === 'webp') return { label: 'WEBP', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' }
    if (ext === 'svg') return { label: 'SVG', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' }
    if (ext === 'jpg' || ext === 'jpeg') return { label: 'JPG', color: 'bg-muted text-muted-foreground border-border' }
    if (ext === 'gif') return { label: 'GIF', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' }
    return { label: ext.toUpperCase() || 'IMG', color: 'bg-muted text-muted-foreground border-border' }
  }

  // Clases para el lienzo según modo de fondo
  const canvasBgClass =
    canvasBg === 'dark'
      ? 'bg-neutral-950 text-neutral-100'
      : canvasBg === 'light'
      ? 'bg-white text-neutral-900 border-neutral-200'
      : 'bg-muted/40 [background-image:radial-gradient(rgba(0,0,0,0.12)_1px,transparent_0)] dark:[background-image:radial-gradient(rgba(255,255,255,0.15)_1px,transparent_0)] [background-size:12px_12px]'

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
        <DialogContent
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className="max-w-5xl xl:max-w-6xl w-[96vw] h-[92vh] flex flex-col p-0 gap-0 overflow-hidden sm:rounded-2xl border-border shadow-2xl relative"
        >
          {/* Overlay de Drag and Drop activo */}
          {isDraggingOver && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm border-4 border-dashed border-primary rounded-2xl p-6 text-center animate-in fade-in zoom-in-95 duration-150">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-xl mb-4 animate-bounce">
                <Upload className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-black text-foreground">Soltá la imagen aquí</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Se subirá automáticamente al historial de tu organización.
              </p>
            </div>
          )}

          {/* Header Superior */}
          <DialogHeader className="p-4 sm:p-5 border-b bg-background shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  <Images className="h-5 w-5 text-primary" />
                  <span>{title}</span>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {description}
                </DialogDescription>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={fetchMedia}
                  disabled={isLoading}
                  className="h-8 gap-1.5 text-xs font-semibold"
                  title="Recargar imágenes"
                >
                  <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
                  <span className="hidden sm:inline">Actualizar</span>
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={() => uploadInputRef.current?.click()}
                  disabled={isUploading || isAtLimit}
                  className="h-8 gap-1.5 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
                >
                  {isUploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  <span>Subir imagen</span>
                </Button>

                <input
                  ref={uploadInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif,image/svg+xml"
                  className="hidden"
                  onChange={handleDirectUpload}
                />
              </div>
            </div>

            {/* Quota Bar */}
            <div className="mt-3.5 rounded-xl border bg-muted/40 p-2.5 sm:p-3">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">
                    Cuota de imágenes: {count} de {MAX_ITEMS} guardadas
                  </span>
                  {isAtLimit && (
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0 font-bold">
                      Límite alcanzado
                    </Badge>
                  )}
                  {isNearLimit && (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 border-amber-500 text-amber-600 bg-amber-500/10 font-semibold"
                    >
                      Espacio reducido
                    </Badge>
                  )}
                </div>
                <span className="text-muted-foreground font-mono font-medium">{progressPercent}%</span>
              </div>
              <Progress
                value={progressPercent}
                className={cn(
                  'h-2',
                  isAtLimit
                    ? '[&>div]:bg-destructive'
                    : isNearLimit
                    ? '[&>div]:bg-amber-500'
                    : '[&>div]:bg-primary'
                )}
              />
              {isAtLimit && (
                <p className="mt-1.5 text-[11px] text-destructive flex items-center gap-1.5 font-medium">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    Has alcanzado el límite de {MAX_ITEMS} imágenes. Eliminá definitivamente las que ya no uses para liberar espacio de inmediato.
                  </span>
                </p>
              )}
            </div>

            {/* Controles de Filtros, Búsqueda, Ordenamiento y Visualización */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 mt-3 pt-2 border-t border-border/60">
              {/* Categorías */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className={cn(
                    'rounded-lg px-2.5 py-1 font-semibold transition-all shrink-0 cursor-pointer',
                    activeTab === 'all'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  Todas ({items.length})
                </button>
                {(
                  ['logo', 'promotions', 'announcements', 'brands', 'gallery', 'team', 'general'] as WebsiteMediaSection[]
                ).map((sec) => {
                  const secCount = items.filter((it) => it.section === sec).length
                  if (secCount === 0 && activeTab !== sec) return null
                  return (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setActiveTab(sec)}
                      className={cn(
                        'rounded-lg px-2.5 py-1 font-semibold transition-all shrink-0 cursor-pointer',
                        activeTab === sec
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      )}
                    >
                      {SECTION_LABELS[sec]} ({secCount})
                    </button>
                  )
                })}
              </div>

              {/* Búsqueda, orden y visualización */}
              <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
                {/* Buscador */}
                <div className="relative w-full sm:w-44">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar..."
                    className="h-8 pl-8 pr-2 text-xs bg-muted/30"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* Ordenamiento Inteligente */}
                <div className="flex items-center gap-1 rounded-lg border bg-muted/30 px-2 py-1 text-xs">
                  <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <select
                    aria-label="Ordenar imágenes"
                    title="Ordenar imágenes"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="bg-transparent text-[11px] font-semibold text-foreground border-0 outline-none cursor-pointer"
                  >
                    <option value="newest">Recientes</option>
                    <option value="oldest">Antiguas</option>
                    <option value="largest">Mayor tamaño</option>
                    <option value="name">Nombre</option>
                  </select>
                </div>

                {/* Selector de Fondo para Logos con Transparencia */}
                <div
                  className="hidden sm:flex items-center rounded-lg border bg-muted/30 p-0.5"
                  title="Fondo del visor (ideal para logos transparentes)"
                >
                  <button
                    type="button"
                    onClick={() => setCanvasBg('checker')}
                    className={cn(
                      'p-1.5 rounded-md text-[10px] font-semibold transition-colors',
                      canvasBg === 'checker'
                        ? 'bg-background text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                    title="Fondo patrón transparente"
                  >
                    Malla
                  </button>
                  <button
                    type="button"
                    onClick={() => setCanvasBg('light')}
                    className={cn(
                      'p-1.5 rounded-md text-[10px] font-semibold transition-colors flex items-center gap-1',
                      canvasBg === 'light'
                        ? 'bg-background text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                    title="Fondo blanco"
                  >
                    <Sun className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCanvasBg('dark')}
                    className={cn(
                      'p-1.5 rounded-md text-[10px] font-semibold transition-colors flex items-center gap-1',
                      canvasBg === 'dark'
                        ? 'bg-background text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                    title="Fondo oscuro"
                  >
                    <Moon className="h-3 w-3" />
                  </button>
                </div>

                {/* Selector de Tamaño de Cuadrícula */}
                <div className="flex items-center rounded-lg border bg-muted/30 p-0.5" title="Tamaño de vista de tarjetas">
                  <button
                    type="button"
                    onClick={() => setViewMode('large')}
                    className={cn(
                      'p-1.5 rounded-md text-xs transition-colors',
                      viewMode === 'large'
                        ? 'bg-background text-primary shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                    title="Vista en tarjetas grandes"
                  >
                    <Grid2X2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('medium')}
                    className={cn(
                      'p-1.5 rounded-md text-xs transition-colors',
                      viewMode === 'medium'
                        ? 'bg-background text-primary shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                    title="Vista compacta"
                  >
                    <Grid3X3 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* Galería de Imágenes */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-muted/10 relative">
            {/* Barra rápida de dropzone informativa */}
            {!isAtLimit && (
              <div
                onClick={() => uploadInputRef.current?.click()}
                className="hidden sm:flex items-center justify-center gap-2 rounded-xl border border-dashed border-border/80 bg-background/50 hover:bg-muted/40 hover:border-primary/50 py-2.5 px-4 text-xs text-muted-foreground transition-all cursor-pointer mb-4 shadow-2xs"
              >
                <Upload className="h-4 w-4 text-primary" />
                <span>
                  Arrastrá y soltá una imagen aquí, o <strong className="text-primary hover:underline font-bold">explorá tus archivos</strong>
                </span>
              </div>
            )}

            {isLoading && items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Loader2 className="h-9 w-9 animate-spin mb-3 text-primary" />
                <p className="text-sm font-medium">Cargando biblioteca de imágenes...</p>
              </div>
            ) : sortedAndFilteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border-2 border-dashed p-8 bg-card">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-3">
                  <ImageIcon className="h-7 w-7 text-muted-foreground" />
                </div>
                <h3 className="text-base font-semibold text-foreground">No hay imágenes que coincidan</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-md leading-relaxed">
                  {searchQuery
                    ? `No se encontraron imágenes con "${searchQuery}". Probá borrando la búsqueda.`
                    : items.length === 0
                    ? 'Aún no has subido imágenes para tu sitio web. Las fotos que subas en el logo, carrusel o avisos quedarán guardadas aquí automáticamente.'
                    : 'No hay imágenes bajo esta categoría. Probá seleccionando "Todas".'}
                </p>
                <div className="mt-5 flex items-center gap-2">
                  {(searchQuery || activeTab !== 'all') && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearchQuery('')
                        setActiveTab('all')
                      }}
                      className="text-xs font-semibold"
                    >
                      Restablecer filtros
                    </Button>
                  )}
                  {!isAtLimit && (
                    <Button
                      type="button"
                      size="sm"
                      className="gap-2 text-xs font-bold"
                      onClick={() => uploadInputRef.current?.click()}
                    >
                      <Upload className="h-4 w-4" />
                      Subir nueva imagen
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div
                className={cn(
                  'grid gap-4 sm:gap-5',
                  viewMode === 'large'
                    ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                    : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
                )}
              >
                {sortedAndFilteredItems.map((item) => {
                  const sizeLabel = formatFileSize(item.size)
                  const dateLabel = formatDate(item.createdAt)
                  const formatBadge = getImageFormat(item)
                  const active = isItemActive(item)

                  return (
                    <div
                      key={item.id}
                      className={cn(
                        'group relative flex flex-col rounded-2xl border bg-card overflow-hidden transition-all duration-200 shadow-2xs hover:shadow-md',
                        active ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'hover:border-primary/60'
                      )}
                    >
                      {/* Contenedor de la Imagen con Alta Visibilidad */}
                      <div
                        onClick={() => setPreviewItem(item)}
                        className={cn(
                          'relative w-full overflow-hidden flex items-center justify-center border-b cursor-pointer transition-colors',
                          viewMode === 'large' ? 'h-52 sm:h-56' : 'h-40',
                          canvasBgClass
                        )}
                        title="Hacer clic para ampliar imagen"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.url}
                          alt={item.name}
                          className="max-h-full max-w-full object-contain p-3 transition-transform duration-300 group-hover:scale-105 select-none"
                          loading="lazy"
                        />

                        {/* Badges superiores: Sección y Estado Activo */}
                        <div className="absolute top-2.5 left-2.5 flex flex-wrap items-center gap-1.5">
                          {item.section && (
                            <span className="rounded-lg bg-black/75 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-xs border border-white/10 shadow-xs">
                              {SECTION_LABELS[item.section]}
                            </span>
                          )}
                          {active && (
                            <span className="rounded-lg bg-emerald-500 text-white px-2 py-0.5 text-[10px] font-bold shadow-xs flex items-center gap-1">
                              <Check className="h-2.5 w-2.5" />
                              En uso
                            </span>
                          )}
                        </div>

                        {/* Badge de Formato (PNG/WEBP/SVG/JPG) */}
                        <span
                          className={cn(
                            'absolute top-2.5 right-2.5 rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider border shadow-2xs backdrop-blur-xs',
                            formatBadge.color
                          )}
                        >
                          {formatBadge.label}
                        </span>

                        {/* Botón flotante de lupa / ampliar al hacer hover */}
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[1px]">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold text-neutral-900 shadow-md">
                            <ZoomIn className="h-3.5 w-3.5 text-primary" />
                            <span>Ampliar</span>
                          </span>
                        </div>
                      </div>

                      {/* Metadatos e Información */}
                      <div className="p-3.5 flex-1 flex flex-col justify-between gap-3 bg-card">
                        <div>
                          <p
                            className="text-xs font-bold text-foreground truncate cursor-pointer hover:text-primary transition-colors"
                            title={item.name}
                            onClick={() => setPreviewItem(item)}
                          >
                            {item.name}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-1">
                            {sizeLabel && <span className="font-mono font-medium">{sizeLabel}</span>}
                            {sizeLabel && dateLabel && <span>•</span>}
                            {dateLabel && <span>{dateLabel}</span>}
                          </div>
                        </div>

                        {/* Barra de Acciones */}
                        <div className="flex items-center gap-2 pt-2 border-t border-border/60">
                          {onSelect && (
                            <Button
                              type="button"
                              size="sm"
                              className={cn(
                                'h-8 flex-1 gap-1.5 text-xs font-bold shadow-xs',
                                active
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                  : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                              )}
                              onClick={() => {
                                onSelect(item.url, item)
                                handleOpenChange(false)
                              }}
                            >
                              <Check className="h-3.5 w-3.5" />
                              <span>{active ? 'Seleccionada' : 'Usar imagen'}</span>
                            </Button>
                          )}

                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className={cn(
                              'h-8 w-8 shrink-0 transition-colors',
                              copiedId === item.id
                                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                            )}
                            title="Copiar URL directa"
                            onClick={() => handleCopyUrl(item.id, item.url)}
                          >
                            {copiedId === item.id ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600 animate-in zoom-in" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-primary hover:bg-primary/5"
                            title="Ver en detalle / pantalla completa"
                            onClick={() => setPreviewItem(item)}
                          >
                            <Maximize2 className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            title="Eliminar definitivamente para liberar espacio"
                            onClick={() => setItemToDelete(item)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Lightbox / Modal de Vista Previa Ampliada */}
      {previewItem && (
        <Dialog open={!!previewItem} onOpenChange={(open) => !open && setPreviewItem(null)}>
          <DialogContent
            aria-describedby="lightbox-media-description"
            className="max-w-4xl w-[95vw] max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden sm:rounded-2xl border-border shadow-2xl"
          >
            {/* Header del Lightbox */}
            <div className="flex items-center justify-between p-4 border-b bg-background">
              <div className="flex items-center gap-2.5 min-w-0 pr-4">
                <Badge variant="outline" className="shrink-0 font-semibold">
                  {previewItem.section ? SECTION_LABELS[previewItem.section] : 'Imagen'}
                </Badge>
                {isItemActive(previewItem) && (
                  <Badge className="bg-emerald-500 text-white shrink-0 font-bold text-[10px]">
                    En uso activo
                  </Badge>
                )}
                <DialogTitle className="text-sm font-bold text-foreground truncate" title={previewItem.name}>
                  {previewItem.name}
                </DialogTitle>
                <DialogDescription id="lightbox-media-description" className="sr-only">
                  Vista previa ampliada y opciones de la imagen {previewItem.name}
                </DialogDescription>
              </div>

              {/* Botones de visualización y fondo en lightbox */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center rounded-lg border bg-muted/40 p-0.5">
                  <button
                    type="button"
                    onClick={() => setCanvasBg('checker')}
                    className={cn(
                      'px-2 py-1 rounded text-[11px] font-semibold transition-colors',
                      canvasBg === 'checker' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground'
                    )}
                  >
                    Malla
                  </button>
                  <button
                    type="button"
                    onClick={() => setCanvasBg('light')}
                    className={cn(
                      'p-1.5 rounded text-[11px] font-semibold transition-colors',
                      canvasBg === 'light' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground'
                    )}
                    title="Fondo claro"
                  >
                    <Sun className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCanvasBg('dark')}
                    className={cn(
                      'p-1.5 rounded text-[11px] font-semibold transition-colors',
                      canvasBg === 'dark' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground'
                    )}
                    title="Fondo oscuro"
                  >
                    <Moon className="h-3.5 w-3.5" />
                  </button>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewZoom(!previewZoom)}
                  className="h-8 text-xs font-semibold"
                >
                  {previewZoom ? 'Ajustar a ventana' : 'Tamaño 100%'}
                </Button>
              </div>
            </div>

            {/* Imagen Ampliada */}
            <div
              className={cn(
                'flex-1 min-h-[360px] sm:min-h-[460px] flex items-center justify-center p-6 overflow-auto transition-colors',
                canvasBgClass
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewItem.url}
                alt={previewItem.name}
                className={cn(
                  'rounded-lg shadow-md transition-all select-none',
                  previewZoom ? 'max-w-none' : 'max-h-[60vh] max-w-full object-contain'
                )}
              />
            </div>

            {/* Footer con Metadatos y Acciones */}
            <div className="p-4 border-t bg-background flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
                {previewItem.size && (
                  <span>
                    Peso: <strong className="text-foreground font-mono">{formatFileSize(previewItem.size)}</strong>
                  </span>
                )}
                {previewItem.createdAt && (
                  <span>
                    Fecha: <strong className="text-foreground">{formatDate(previewItem.createdAt)}</strong>
                  </span>
                )}
                <span className="truncate max-w-[240px] font-mono text-[10px]" title={previewItem.path}>
                  {previewItem.path}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    'h-8 gap-1.5 text-xs font-semibold',
                    copiedId === previewItem.id && 'border-emerald-500 text-emerald-600 bg-emerald-500/10'
                  )}
                  onClick={() => handleCopyUrl(previewItem.id, previewItem.url)}
                >
                  {copiedId === previewItem.id ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  <span>{copiedId === previewItem.id ? 'Copiado' : 'Copiar URL'}</span>
                </Button>

                <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-semibold" asChild>
                  <a href={previewItem.url} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Abrir original</span>
                  </a>
                </Button>

                {onSelect && (
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 gap-1.5 text-xs font-bold bg-primary text-primary-foreground"
                    onClick={() => {
                      onSelect(previewItem.url, previewItem)
                      setPreviewItem(null)
                      handleOpenChange(false)
                    }}
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Usar esta imagen</span>
                  </Button>
                )}

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-xs text-destructive hover:bg-destructive/10 font-medium"
                  onClick={() => setItemToDelete(previewItem)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Eliminar</span>
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Confirmation Dialog for Permanent Storage Deletion */}
      <AlertDialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive font-bold">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
              <span>¿Eliminar imagen definitivamente?</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-xs leading-relaxed text-muted-foreground pt-1">
              <p>
                Esta acción eliminará el archivo de forma permanente del almacenamiento en la nube y{' '}
                <strong>liberará 1 espacio</strong> en tu cuota (máximo {MAX_ITEMS} imágenes).
              </p>
              <p className="font-semibold text-foreground">Archivo: {itemToDelete?.name}</p>

              {isItemActive(itemToDelete) ? (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive font-bold">
                  ⚠️ ¡Atención! Esta imagen está actualmente seleccionada como recurso activo en tu tienda. Si la eliminás definitivamente, dejará de verse en la tienda pública.
                </div>
              ) : (
                <p className="text-amber-600 dark:text-amber-400">
                  ⚠️ Si esta imagen está actualmente en uso en tu logo, carrusel o aviso publicado, dejará de verse en la tienda pública.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={(e) => {
                e.preventDefault()
                handleConfirmDelete()
              }}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Eliminando...
                </>
              ) : (
                'Eliminar definitivamente'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
