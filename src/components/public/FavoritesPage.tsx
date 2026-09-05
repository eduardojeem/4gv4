'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  Heart,
  Search,
  Store,
  ArrowRight,
  Share2,
  Filter,
  X,
  LayoutGrid,
  List,
  RefreshCw,
  ShoppingBag,
  ExternalLink,
  Info,
  Check,
  Tag,
  SlidersHorizontal,
  ChevronRight,
  Package,
  Layers,
  Eye,
  AlertCircle,
  AlertTriangle,
  PackageX,
  EyeOff,
  CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useAuth } from '@/contexts/auth-context'
import { FavoriteButton } from './Favorites'
import { initializeFavorites, useFavorites } from '@/lib/public/favorites-store'
import { favoriteKey, type Favorite } from '@/lib/public/favorites-schema'
import { resolveProductImageUrl } from '@/lib/images'
import { formatPrice } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .trim()

type SortOption = 'store_asc' | 'store_desc' | 'name_asc' | 'name_desc' | 'price_asc' | 'price_desc'
type ViewMode = 'grid' | 'list' | 'grouped'

interface ProductMeta {
  image: string | null
  images?: string[]
  description?: string | null
  sku?: string | null
  brand?: string | null
  price: number | null
  hasOffer?: boolean
  offerPrice?: number | null
  inStock?: boolean
  isActive?: boolean
  stockQuantity?: number
}

function FavoriteProductImage({ src, alt }: { src?: string | null; alt: string }) {
  const [err, setErr] = useState(false)
  const imageSrc = src ? resolveProductImageUrl(src) : null

  useEffect(() => {
    setErr(false)
  }, [src])

  if (!imageSrc || err || imageSrc === '/placeholder-product.svg') {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted/40 text-muted-foreground/40 transition-colors">
        <Package className="h-10 w-10 sm:h-12 sm:w-12" />
      </div>
    )
  }

  return (
    <Image
      key={imageSrc}
      src={imageSrc}
      alt={alt}
      fill
      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
      className="object-contain p-3 transition-transform duration-300 group-hover:scale-105"
      onError={() => setErr(true)}
      unoptimized
    />
  )
}

function FavoriteDetailModal({
  item,
  meta,
  open,
  onClose,
}: {
  item: Favorite | null
  meta?: ProductMeta
  open: boolean
  onClose: () => void
}) {
  const [activeImageIdx, setActiveImageIdx] = useState(0)
  const [imgError, setImgError] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setActiveImageIdx(0)
    setImgError(false)
    setCopied(false)
  }, [item?.productId, open])

  if (!item) return null

  const productUrl = `/${item.slug}/productos/${item.productId}`
  const storeUrl = `/${item.slug}/inicio`

  const isInactive = meta?.isActive === false
  const isOutOfStock = meta ? meta.inStock === false : false

  const candidateImages = Array.from(
    new Set([
      ...(meta?.images && meta.images.length > 0 ? meta.images : []),
      ...(meta?.image ? [meta.image] : []),
      ...(item.image ? [item.image] : []),
    ])
  ).filter(Boolean)

  const activeImage = candidateImages[activeImageIdx] ?? candidateImages[0] ?? null
  const imageSrc = activeImage ? resolveProductImageUrl(activeImage) : null

  const displayPrice =
    meta?.hasOffer && typeof meta.offerPrice === 'number'
      ? meta.offerPrice
      : (typeof meta?.price === 'number' ? meta.price : item.price)

  const originalPrice =
    meta?.hasOffer && typeof meta.offerPrice === 'number' && typeof meta?.price === 'number'
      ? meta.price
      : null

  const discountPct =
    originalPrice && displayPrice && originalPrice > displayPrice
      ? Math.round(((originalPrice - displayPrice) / originalPrice) * 100)
      : null

  const handleShare = async () => {
    const fullUrl = `${window.location.origin}${productUrl}`
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(fullUrl)
        setCopied(true)
        toast.success('Enlace del producto copiado al portapapeles')
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      toast.error('No se pudo copiar el enlace')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-3xl overflow-hidden p-0 gap-0 sm:rounded-3xl border-border/80 shadow-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>{item.name}</DialogTitle>
          <DialogDescription>
            Detalle del producto favorito guardado en {item.store}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-12 max-h-[85vh] overflow-y-auto">
          {/* ── Columna Izquierda: Galería e Imagen ── */}
          <div className="md:col-span-6 bg-muted/20 p-5 sm:p-6 flex flex-col justify-between border-b md:border-b-0 md:border-r border-border/60">
            <div className="space-y-4">
              {/* Contenedor Imagen Principal con efecto translúcido si está sin stock o inactivo */}
              <div
                className={cn(
                  'relative aspect-square w-full overflow-hidden rounded-2xl border border-border/60 bg-background shadow-xs transition-all duration-300',
                  (isInactive || isOutOfStock) && 'opacity-70 grayscale-[25%] backdrop-blur-xs'
                )}
              >
                {imageSrc && !imgError && imageSrc !== '/placeholder-product.svg' ? (
                  <Image
                    key={imageSrc}
                    src={imageSrc}
                    alt={item.name}
                    fill
                    sizes="(max-width: 768px) 100vw, 400px"
                    className="object-contain p-4"
                    onError={() => setImgError(true)}
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
                    <Package className="h-16 w-16" />
                  </div>
                )}

                {/* Overlays / Badges en la esquina de la imagen */}
                <div className="absolute left-3 top-3 z-10 flex flex-col gap-1.5">
                  {isInactive ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/90 text-white px-2.5 py-1 text-xs font-bold backdrop-blur-md shadow-xs border border-white/10">
                      <EyeOff className="h-3.5 w-3.5 text-rose-400" />
                      No disponible
                    </span>
                  ) : isOutOfStock ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-600/95 text-white px-2.5 py-1 text-xs font-bold backdrop-blur-md shadow-xs">
                      <PackageX className="h-3.5 w-3.5" />
                      Sin stock
                    </span>
                  ) : meta?.hasOffer ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-2.5 py-1 text-xs font-bold text-white shadow-xs">
                      <Tag className="h-3 w-3" />
                      {discountPct ? `-${discountPct}% OFF` : 'Oferta'}
                    </span>
                  ) : null}
                </div>

                {/* Botón Favorito en esquina superior derecha */}
                <div className="absolute right-3 top-3 z-10">
                  <FavoriteButton item={{ ...item, image: imageSrc, price: displayPrice }} />
                </div>
              </div>

              {/* Thumbnails si hay más de 1 imagen */}
              {candidateImages.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {candidateImages.map((img, idx) => {
                    const resolved = resolveProductImageUrl(img)
                    const isActiveThumb = idx === activeImageIdx
                    return (
                      <button
                        key={`${img}-${idx}`}
                        type="button"
                        onClick={() => {
                          setActiveImageIdx(idx)
                          setImgError(false)
                        }}
                        className={cn(
                          'relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 transition-all',
                          isActiveThumb
                            ? 'border-primary shadow-xs ring-2 ring-primary/20 scale-105'
                            : 'border-border/60 opacity-60 hover:opacity-100 hover:border-border'
                        )}
                        aria-label={`Ver imagen ${idx + 1}`}
                      >
                        <Image
                          src={resolved}
                          alt={`${item.name} miniatura ${idx + 1}`}
                          fill
                          sizes="56px"
                          className="object-contain p-1"
                          unoptimized
                        />
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Pill de Tienda Vendedora */}
            <div className="pt-4 mt-auto border-t border-border/50">
              <Link
                href={storeUrl}
                onClick={onClose}
                className="group flex items-center justify-between gap-2 p-2.5 rounded-xl bg-background/80 hover:bg-background border border-border/70 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Store className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground leading-none">Vendido por</p>
                    <p className="text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate">
                      {item.store}
                    </p>
                  </div>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground shrink-0" />
              </Link>
            </div>
          </div>

          {/* ── Columna Derecha: Información y Estado ── */}
          <div className="md:col-span-6 p-5 sm:p-6 flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              {/* Banner de Estado Específico (Sin stock / Inactivo / Disponible) */}
              {isInactive ? (
                <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 dark:bg-rose-950/30 p-3.5 text-xs text-rose-800 dark:text-rose-300 space-y-1">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
                    <span>Publicación no disponible</span>
                  </div>
                  <p className="text-[11px] opacity-90 leading-relaxed">
                    La tienda ha pausado o desactivado temporalmente este producto. Podés mantenerlo en tus favoritos para cuando vuelva a estar visible.
                  </p>
                </div>
              ) : isOutOfStock ? (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 dark:bg-amber-950/30 p-3.5 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>Sin stock disponible</span>
                  </div>
                  <p className="text-[11px] opacity-90 leading-relaxed">
                    Este producto está agotado temporalmente en la tienda. No te preocupes: podés conservarlo en tu lista para consultar cuando renueven stock.
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>En stock y disponible para compra</span>
                </div>
              )}

              {/* Título y Marca */}
              <div className="space-y-1">
                {meta?.brand && (
                  <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {meta.brand}
                  </span>
                )}
                <h2 className="text-lg sm:text-xl font-black text-foreground leading-snug">
                  {item.name}
                </h2>
                {meta?.sku && (
                  <p className="text-[11px] text-muted-foreground">
                    SKU: <span className="font-mono">{meta.sku}</span>
                  </p>
                )}
              </div>

              {/* Precios y Ofertas */}
              <div className="pt-2">
                {typeof displayPrice === 'number' && displayPrice > 0 ? (
                  <div className="space-y-1">
                    <div className="flex items-baseline gap-2.5">
                      <span className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                        {formatPrice(displayPrice)}
                      </span>
                      {originalPrice && originalPrice > displayPrice && (
                        <span className="text-sm text-muted-foreground line-through">
                          {formatPrice(originalPrice)}
                        </span>
                      )}
                    </div>
                    {discountPct && (
                      <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                        ¡Ahorrás {discountPct}% con esta oferta!
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">Precio a consultar en tienda</span>
                )}
              </div>

              {/* Descripción */}
              {meta?.description && (
                <div className="space-y-1 pt-2 border-t border-border/50">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Descripción
                  </p>
                  <p className="text-xs text-foreground/80 leading-relaxed line-clamp-4">
                    {meta.description}
                  </p>
                </div>
              )}
            </div>

            {/* ── Botones de Acción ── */}
            <div className="pt-4 border-t border-border/60 space-y-2.5">
              <div className="flex items-center gap-2">
                {/* Botón Compartir */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleShare}
                  className="h-11 rounded-xl px-3 text-xs font-semibold gap-1.5 border-border/80"
                  title="Copiar enlace de este producto"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 text-emerald-500" />
                      <span className="text-emerald-600 font-bold">Copiado</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="h-4 w-4" />
                      <span>Compartir</span>
                    </>
                  )}
                </Button>

                {/* Botón Ir a la Tienda */}
                <Button
                  asChild
                  className={cn(
                    'h-11 flex-1 rounded-xl font-bold text-xs sm:text-sm gap-2 shadow-xs transition-all',
                    isInactive || isOutOfStock
                      ? 'bg-muted hover:bg-muted/80 text-foreground border border-border/80'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90'
                  )}
                >
                  <Link href={productUrl} onClick={onClose}>
                    <span>{isInactive || isOutOfStock ? 'Ver ficha en tienda' : 'Ver en tienda para comprar'}</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function FavoritesPage({
  scopedStoreSlug,
  scopedStoreName,
}: {
  scopedStoreSlug?: string
  scopedStoreName?: string
} = {}) {
  const state = useFavorites()
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [store, setStore] = useState(scopedStoreSlug || '')
  const [sortBy, setSortBy] = useState<SortOption>('store_asc')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<Favorite | null>(null)
  const [productMetadata, setProductMetadata] = useState<Record<string, ProductMeta>>({})

  // Cargar metadatos en vivo (imágenes, precios actualizados, ofertas) para todos los favoritos
  useEffect(() => {
    if (!state.items.length) return
    const ids = state.items.map((item) => item.productId).filter(Boolean)
    if (!ids.length) return

    const controller = new AbortController()
    fetch('/api/public/favorites/metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productIds: ids }),
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.metadata) {
          setProductMetadata((prev) => ({ ...prev, ...data.metadata }))
        }
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') {
          // Ignorar silenciosamente
        }
      })

    return () => controller.abort()
  }, [state.items])

  // Lista única de tiendas con cantidad de productos guardados
  const stores = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>()
    state.items.forEach((item) => {
      const existing = map.get(item.slug)
      if (existing) {
        existing.count += 1
      } else {
        map.set(item.slug, { name: item.store, count: 1 })
      }
    })
    return [...map.entries()]
      .map(([slug, data]) => ({ slug, name: data.name, count: data.count }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [state.items])

  const effectiveStoreName = useMemo(() => {
    if (!scopedStoreSlug) return ''
    return scopedStoreName || stores.find((s) => s.slug === scopedStoreSlug)?.name || state.items.find((i) => i.slug === scopedStoreSlug)?.store || scopedStoreSlug
  }, [scopedStoreSlug, scopedStoreName, stores, state.items])

  const storeScopedCount = useMemo(() => {
    if (!scopedStoreSlug) return state.items.length
    return state.items.filter((i) => i.slug === scopedStoreSlug).length
  }, [scopedStoreSlug, state.items])

  // Filtrado y ordenamiento de productos favoritos
  const filtered = useMemo(() => {
    const q = normalizeText(query)
    const result = state.items.filter((item) => {
      const matchStore = !store || item.slug === store
      const matchQuery = !q || normalizeText(`${item.name} ${item.store}`).includes(q)
      return matchStore && matchQuery
    })

    return result.sort((a, b) => {
      const metaA = productMetadata[a.productId]
      const metaB = productMetadata[b.productId]
      const priceA = metaA?.hasOffer && metaA.offerPrice ? metaA.offerPrice : (metaA?.price ?? a.price ?? 0)
      const priceB = metaB?.hasOffer && metaB.offerPrice ? metaB.offerPrice : (metaB?.price ?? b.price ?? 0)

      if (sortBy === 'store_asc') {
        const storeCompare = a.store.localeCompare(b.store)
        return storeCompare !== 0 ? storeCompare : a.name.localeCompare(b.name)
      }
      if (sortBy === 'store_desc') {
        const storeCompare = b.store.localeCompare(a.store)
        return storeCompare !== 0 ? storeCompare : a.name.localeCompare(b.name)
      }
      if (sortBy === 'name_asc') return a.name.localeCompare(b.name)
      if (sortBy === 'name_desc') return b.name.localeCompare(a.name)
      if (sortBy === 'price_asc') return priceA - priceB
      if (sortBy === 'price_desc') return priceB - priceA
      return 0
    })
  }, [state.items, store, query, sortBy, productMetadata])

  // Agrupación de favoritos por organización
  const groupedByOrg = useMemo(() => {
    const map = new Map<string, { slug: string; storeName: string; items: Favorite[] }>()
    filtered.forEach((item) => {
      const existing = map.get(item.slug)
      if (existing) {
        existing.items.push(item)
      } else {
        map.set(item.slug, { slug: item.slug, storeName: item.store, items: [item] })
      }
    })
    return [...map.values()]
  }, [filtered])

  const hasActiveFilters = Boolean(query || (store && store !== (scopedStoreSlug || '')) || sortBy !== 'store_asc')

  const resetFilters = () => {
    setQuery('')
    setStore(scopedStoreSlug || '')
    setSortBy('store_asc')
  }

  const handleShareList = async () => {
    if (typeof window === 'undefined') return
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({
          title: scopedStoreSlug ? `Mis favoritos en ${effectiveStoreName}` : 'Mis productos favoritos en el Marketplace',
          text: `Mirá mi lista de productos favoritos (${filtered.length} guardados):`,
          url,
        })
      } catch {
        // Compartir cancelado por el usuario
      }
    } else {
      await navigator.clipboard.writeText(url)
      toast.success('Enlace copiado al portapapeles')
    }
  }

  const handleShareProduct = async (item: { name: string; slug: string; productId: string }) => {
    if (typeof window === 'undefined') return
    const url = `${window.location.origin}/${item.slug}/productos/${item.productId}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(item.productId)
      toast.success(`Enlace de "${item.name}" copiado`)
      setTimeout(() => setCopiedId(null), 2500)
    } catch {
      toast.error('No se pudo copiar el enlace')
    }
  }

  return (
    <div className="min-h-[80vh] bg-background">
      {/* ── Breadcrumb & Header Hero ── */}
      <div className="border-b border-border/60 bg-muted/20">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <nav className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground" aria-label="Breadcrumb">
            {scopedStoreSlug ? (
              <>
                <Link href={`/${scopedStoreSlug}/inicio`} className="hover:text-foreground transition-colors font-medium">
                  {effectiveStoreName || 'Inicio'}
                </Link>
                <ChevronRight className="h-3 w-3" />
                <Link href={`/${scopedStoreSlug}/productos`} className="hover:text-foreground transition-colors">
                  Productos
                </Link>
                <ChevronRight className="h-3 w-3" />
                <span className="font-semibold text-foreground">Favoritos</span>
              </>
            ) : (
              <>
                <Link href="/" className="hover:text-foreground transition-colors">
                  Inicio
                </Link>
                <ChevronRight className="h-3 w-3" />
                <Link href="/marketplace" className="hover:text-foreground transition-colors">
                  Marketplace
                </Link>
                <ChevronRight className="h-3 w-3" />
                <span className="font-semibold text-foreground">Favoritos</span>
              </>
            )}
          </nav>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-xs ring-1 ring-primary/20">
                  <Heart className="h-6 w-6 fill-primary/20 text-primary animate-pulse" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-2.5">
                    {scopedStoreSlug ? `Mis favoritos en ${effectiveStoreName}` : 'Mis favoritos'}
                    {scopedStoreSlug ? (
                      <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-bold text-primary">
                        {storeScopedCount}
                      </span>
                    ) : state.items.length > 0 ? (
                      <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-bold text-primary">
                        {state.items.length}
                      </span>
                    ) : null}
                  </h1>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    {scopedStoreSlug ? (
                      <span>
                        Productos guardados de {effectiveStoreName}.{' '}
                        {state.items.length > storeScopedCount && (
                          <Link href="/marketplace/favoritos" className="text-primary hover:underline font-semibold ml-1">
                            Ver favoritos de todas las tiendas ({state.items.length}) →
                          </Link>
                        )}
                      </span>
                    ) : state.account ? (
                      'Tus productos guardados, sincronizados con tu cuenta.'
                    ) : (
                      'Guardados en este navegador. Iniciá sesión desde el encabezado para sincronizarlos.'
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
              {scopedStoreSlug && state.items.length > storeScopedCount && (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1.5 rounded-xl border-border/80 bg-card text-xs font-semibold shadow-xs hover:bg-accent"
                >
                  <Link href="/marketplace/favoritos">
                    <Store className="h-3.5 w-3.5 text-primary" />
                    <span>Todas las tiendas</span>
                  </Link>
                </Button>
              )}

              {filtered.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleShareList}
                  className="h-9 gap-1.5 rounded-xl border-border/80 bg-card text-xs font-semibold shadow-xs hover:bg-accent"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  <span>Compartir lista</span>
                </Button>
              )}

              <Button
                asChild
                size="sm"
                className="h-9 gap-1.5 rounded-xl text-xs font-bold shadow-xs"
              >
                <Link href={scopedStoreSlug ? `/${scopedStoreSlug}/productos` : '/marketplace/productos'}>
                  <ShoppingBag className="h-3.5 w-3.5" />
                  <span>{scopedStoreSlug ? 'Ver catálogo de la tienda' : 'Explorar catálogo'}</span>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Container ── */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 space-y-6">
        {/* Banner de error / sincronización */}
        {state.error && (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
          >
            <span>{state.error}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void initializeFavorites(user?.id ?? null)}
              className="h-8 border-destructive/40 text-xs font-bold hover:bg-destructive hover:text-white"
            >
              <RefreshCw className="mr-1.5 h-3 w-3" />
              Reintentar
            </Button>
          </div>
        )}

        {state.busy && (
          <div className="flex items-center gap-2 rounded-2xl border border-border/80 bg-card p-4 text-sm text-muted-foreground animate-pulse shadow-xs">
            <RefreshCw className="h-4 w-4 animate-spin text-primary" />
            <p role="status">Sincronizando favoritos…</p>
          </div>
        )}

        {/* ── Barra de Búsqueda, Filtros y Vista ── */}
        <div className="rounded-2xl border border-border/80 bg-card p-3 sm:p-4 shadow-sm space-y-3">
          <div className="grid gap-3 sm:grid-cols-12 items-center">
            {/* Buscador */}
            <div className="sm:col-span-5 lg:col-span-4 relative">
              <label htmlFor="favorites-search" className="sr-only">
                Buscar favoritos
              </label>
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                id="favorites-search"
                type="search"
                aria-label="Buscar favoritos"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por producto o tienda…"
                className="h-11 w-full rounded-xl border border-border/80 bg-background pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-full hover:bg-accent transition-colors"
                  aria-label="Borrar búsqueda"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Selector de Tienda / Organización */}
            <div className="sm:col-span-4 lg:col-span-3">
              <label htmlFor="store-filter" className="sr-only">
                Filtrar por tienda
              </label>
              <div className="relative">
                <Store className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <select
                  id="store-filter"
                  aria-label="Filtrar por tienda"
                  value={store}
                  onChange={(e) => setStore(e.target.value)}
                  className="h-11 w-full appearance-none rounded-xl border border-border/80 bg-background pl-9 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all cursor-pointer truncate"
                >
                  <option value="">Todas las organizaciones ({state.items.length})</option>
                  {stores.map((s) => (
                    <option key={s.slug} value={s.slug}>
                      {s.name} ({s.count})
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground text-xs">
                  ▼
                </div>
              </div>
            </div>

            {/* Selector de Ordenamiento */}
            <div className="sm:col-span-3 lg:col-span-3">
              <label htmlFor="sort-filter" className="sr-only">
                Ordenar por
              </label>
              <div className="relative">
                <SlidersHorizontal className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <select
                  id="sort-filter"
                  aria-label="Ordenar por"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="h-11 w-full appearance-none rounded-xl border border-border/80 bg-background pl-9 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all cursor-pointer truncate font-medium"
                >
                  <option value="store_asc">Organización: A → Z</option>
                  <option value="store_desc">Organización: Z → A</option>
                  <option value="name_asc">Nombre: A → Z</option>
                  <option value="name_desc">Nombre: Z → A</option>
                  <option value="price_asc">Menor precio</option>
                  <option value="price_desc">Mayor precio</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground text-xs">
                  ▼
                </div>
              </div>
            </div>

            {/* Botón Limpiar & Alternador de Vista (Cuadrícula / Lista / Por Tienda) */}
            <div className="sm:col-span-12 lg:col-span-2 flex items-center justify-between lg:justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                disabled={!query && !store && sortBy === 'store_asc'}
                className="h-10 text-xs font-semibold text-muted-foreground hover:text-foreground gap-1.5 px-2.5 disabled:opacity-40"
              >
                <X className="h-3.5 w-3.5" />
                <span>Limpiar filtros</span>
              </Button>

              {/* View toggle */}
              <div className="flex items-center rounded-xl border border-border/80 bg-muted/40 p-1 gap-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-all',
                    viewMode === 'grid' && 'bg-card text-foreground shadow-xs'
                  )}
                  title="Vista en cuadrícula"
                  aria-label="Vista en cuadrícula"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('grouped')}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-all',
                    viewMode === 'grouped' && 'bg-card text-foreground shadow-xs'
                  )}
                  title="Agrupar por organización"
                  aria-label="Agrupar por organización"
                >
                  <Layers className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-all',
                    viewMode === 'list' && 'bg-card text-foreground shadow-xs'
                  )}
                  title="Vista en lista"
                  aria-label="Vista en lista"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Contador de Resultados y Avisos ── */}
        {!state.error && state.items.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-muted-foreground px-1">
            <p role="status">
              Mostrando <span className="font-bold text-foreground">{filtered.length}</span> de{' '}
              <span className="font-bold text-foreground">{state.items.length}</span> favoritos guardados
              {viewMode === 'grouped' && ` en ${groupedByOrg.length} organizaciones`}
            </p>
            <span className="flex items-center gap-1.5 text-muted-foreground/80">
              <Info className="h-3.5 w-3.5 shrink-0" />
              Precios y stock actualizados en la tienda de cada vendedor.
            </span>
          </div>
        )}

        {/* ── Estado Vacío (Sin Favoritos o Sin Coincidencias) ── */}
        {!state.busy && !filtered.length && (
          <div className="rounded-3xl border border-dashed border-border bg-card p-10 sm:p-14 text-center shadow-xs">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-primary ring-1 ring-primary/20 mb-4">
              {state.items.length > 0 ? (
                <Filter className="h-8 w-8 text-primary" />
              ) : (
                <Heart className="h-8 w-8 text-primary fill-primary/15" />
              )}
            </div>

            <h3 className="text-lg font-bold text-foreground mb-1">
              {filtered.length === 0 && state.items.length > 0 && scopedStoreSlug && store === scopedStoreSlug ? (
                `Todavía no guardaste productos de ${effectiveStoreName}`
              ) : state.items.length > 0 ? (
                'No hay favoritos que coincidan con estos filtros.'
              ) : (
                scopedStoreSlug ? `Todavía no guardaste productos de ${effectiveStoreName}` : 'Todavía no guardaste productos como favoritos.'
              )}
            </h3>

            <p className="max-w-md mx-auto text-xs sm:text-sm text-muted-foreground mb-6">
              {filtered.length === 0 && state.items.length > 0 && scopedStoreSlug && store === scopedStoreSlug ? (
                `Explorá los productos de ${effectiveStoreName} y tocá el icono de corazón en cualquier producto para tenerlo a mano.`
              ) : state.items.length > 0 ? (
                'Probá cambiando los términos de búsqueda o seleccionando otra tienda para ver tus productos guardados.'
              ) : (
                scopedStoreSlug 
                  ? `Explorá el catálogo de ${effectiveStoreName} y guardá tus productos preferidos.`
                  : 'Explorá el catálogo del Marketplace y tocá el icono de corazón en cualquier producto para guardarlo aquí y consultarlo cuando quieras.'
              )}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3">
              {scopedStoreSlug ? (
                <>
                  <Button asChild className="h-11 rounded-xl px-6 font-bold shadow-xs">
                    <Link href={`/${scopedStoreSlug}/productos`}>
                      <ShoppingBag className="mr-2 h-4 w-4" />
                      Explorar productos de {effectiveStoreName}
                    </Link>
                  </Button>
                  {state.items.length > 0 && (
                    <Button asChild variant="outline" className="h-11 rounded-xl px-6 font-semibold shadow-xs">
                      <Link href="/marketplace/favoritos">
                        <Store className="mr-2 h-4 w-4 text-primary" />
                        Ver todos mis favoritos ({state.items.length})
                      </Link>
                    </Button>
                  )}
                </>
              ) : state.items.length > 0 ? (
                <Button onClick={resetFilters} className="h-10 rounded-xl px-5 font-bold shadow-xs">
                  Restablecer filtros
                </Button>
              ) : (
                <>
                  <Button asChild className="h-11 rounded-xl px-6 font-bold shadow-xs">
                    <Link href="/marketplace/productos">
                      <ShoppingBag className="mr-2 h-4 w-4" />
                      Explorar productos
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="h-11 rounded-xl px-6 font-semibold shadow-xs">
                    <Link href="/marketplace">
                      Ir al Marketplace
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── 1. Modo Agrupado por Organización ── */}
        {filtered.length > 0 && viewMode === 'grouped' && (
          <div className="space-y-6">
            {groupedByOrg.map((group) => {
              const storeUrl = `/${group.slug}/inicio`
              return (
                <section
                  key={group.slug}
                  className="rounded-3xl border border-border/80 bg-card p-5 sm:p-6 space-y-5 shadow-xs"
                >
                  {/* Encabezado de la Organización */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
                    <Link
                      href={storeUrl}
                      className="group flex items-center gap-3 transition-opacity hover:opacity-90 min-w-0"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 border border-cyan-200/80 text-cyan-700 shadow-2xs dark:bg-cyan-950/40 dark:border-cyan-800/50 dark:text-cyan-300">
                        <Store className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h2 className="text-base sm:text-lg font-bold text-foreground group-hover:text-primary transition-colors truncate">
                            {group.storeName}
                          </h2>
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary shrink-0">
                            {group.items.length} {group.items.length === 1 ? 'producto' : 'productos'}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">Tienda oficial en el marketplace</p>
                      </div>
                    </Link>

                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-xl text-xs font-semibold gap-1.5 border-border/80 bg-background"
                    >
                      <Link href={storeUrl}>
                        <span>Visitar tienda</span>
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                      </Link>
                    </Button>
                  </div>

                  {/* Productos de esta organización */}
                  <ul className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {group.items.map((item) => {
                      const productUrl = `/${item.slug}/productos/${item.productId}`
                      const meta = productMetadata[item.productId]
                      const image = meta?.image ?? item.image
                      const displayPrice = meta?.hasOffer && meta.offerPrice ? meta.offerPrice : (meta?.price ?? item.price)
                      const originalPrice = meta?.hasOffer && meta.offerPrice ? meta.price : null
                      const isInactive = meta?.isActive === false
                      const isOutOfStock = meta ? meta.inStock === false : false

                      return (
                        <li
                          key={favoriteKey(item)}
                          className={cn(
                            "group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-background shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-md",
                            isInactive && "opacity-65 grayscale-[15%] backdrop-blur-xs",
                            isOutOfStock && !isInactive && "opacity-75 backdrop-blur-xs"
                          )}
                        >
                          {/* Contenedor de Imagen */}
                          <div
                            onClick={() => setSelectedItem(item)}
                            className="relative aspect-square w-full overflow-hidden bg-muted/20 border-b border-border/40 cursor-pointer"
                          >
                            <FavoriteProductImage src={image} alt={item.name} />

                            {/* Badges de estado en esquina superior izquierda */}
                            <div className="absolute left-2 top-2 z-10 flex flex-col gap-1 max-w-[calc(100%-3.5rem)]">
                              {isInactive ? (
                                <span className="inline-flex w-fit items-center gap-1 rounded-full bg-slate-900/90 text-white px-2 py-0.5 text-[10px] font-bold backdrop-blur-md shadow-xs border border-white/10">
                                  <EyeOff className="h-3 w-3 text-rose-400" />
                                  No disponible
                                </span>
                              ) : isOutOfStock ? (
                                <span className="inline-flex w-fit items-center gap-1 rounded-full bg-amber-600/95 text-white px-2 py-0.5 text-[10px] font-bold shadow-2xs backdrop-blur-md">
                                  <PackageX className="h-3 w-3" />
                                  Sin stock
                                </span>
                              ) : meta?.hasOffer ? (
                                <span className="inline-flex w-fit items-center gap-1 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                                  <Tag className="h-2.5 w-2.5" />
                                  Oferta
                                </span>
                              ) : null}
                            </div>

                            {/* Botón Favorito en esquina superior derecha */}
                            <div className="absolute right-2 top-2 z-10" onClick={(e) => e.stopPropagation()}>
                              <FavoriteButton item={{ ...item, image, price: displayPrice }} />
                            </div>
                          </div>

                          {/* Info del Producto */}
                          <div className="p-4 flex flex-col flex-1 justify-between gap-3">
                            <div className="space-y-1.5">
                              <Link
                                href={productUrl}
                                className="block text-left group/link w-full"
                              >
                                <h3 className="text-sm font-bold text-foreground leading-snug line-clamp-2 group-hover/link:text-primary transition-colors">
                                  {item.name}
                                </h3>
                              </Link>
                              {typeof displayPrice === 'number' && displayPrice > 0 && (
                                <div className="flex items-baseline gap-2">
                                  <p className="text-base font-extrabold text-foreground">
                                    {formatPrice(displayPrice)}
                                  </p>
                                  {originalPrice && originalPrice > displayPrice && (
                                    <p className="text-xs text-muted-foreground line-through">
                                      {formatPrice(originalPrice)}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Acciones */}
                            <div className="pt-2 border-t border-border/50 flex items-center justify-between gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setSelectedItem(item)}
                                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                                title="Ver detalle del producto"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>

                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleShareProduct(item)}
                                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                                title="Copiar enlace"
                              >
                                {copiedId === item.productId ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                                ) : (
                                  <Share2 className="h-3.5 w-3.5" />
                                )}
                              </Button>

                              <Button
                                asChild
                                size="sm"
                                className="h-8 rounded-lg px-3 text-xs font-bold gap-1 shadow-xs flex-1 justify-center"
                              >
                                <Link href={productUrl}>
                                  <span>Ver en tienda</span>
                                  <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                                </Link>
                              </Button>
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )
            })}
          </div>
        )}

        {/* ── 2. Modo Cuadrícula (Grid Mode) ── */}
        {filtered.length > 0 && viewMode === 'grid' && (
          <ul className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((item) => {
              const productUrl = `/${item.slug}/productos/${item.productId}`
              const storeUrl = `/${item.slug}/inicio`
              const meta = productMetadata[item.productId]
              const image = meta?.image ?? item.image
              const displayPrice = meta?.hasOffer && meta.offerPrice ? meta.offerPrice : (meta?.price ?? item.price)
              const originalPrice = meta?.hasOffer && meta.offerPrice ? meta.price : null
              const isInactive = meta?.isActive === false
              const isOutOfStock = meta ? meta.inStock === false : false

              return (
                <li
                  key={favoriteKey(item)}
                  className={cn(
                    "group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-border/80 bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg",
                    isInactive && "opacity-65 grayscale-[15%] backdrop-blur-xs",
                    isOutOfStock && !isInactive && "opacity-75 backdrop-blur-xs"
                  )}
                >
                  {/* Contenedor de Imagen con Overlays */}
                  <div
                    onClick={() => setSelectedItem(item)}
                    className="relative aspect-square w-full overflow-hidden bg-muted/20 border-b border-border/60 cursor-pointer"
                  >
                    <FavoriteProductImage src={image} alt={item.name} />

                    {/* Pill de la tienda y badges en esquina superior izquierda */}
                    <div className="absolute left-2.5 top-2.5 z-10 flex flex-col gap-1.5 max-w-[calc(100%-4rem)]" onClick={(e) => e.stopPropagation()}>
                      <Link
                        href={storeUrl}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background/90 px-2.5 py-1 text-[11px] font-bold text-foreground backdrop-blur-md transition-all hover:bg-background shadow-xs truncate"
                        title={item.store}
                      >
                        <Store className="h-3 w-3 shrink-0 text-primary" />
                        <span className="truncate">{item.store}</span>
                      </Link>
                      {isInactive ? (
                        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-slate-900/90 text-white px-2 py-0.5 text-[10px] font-bold backdrop-blur-md shadow-xs border border-white/10">
                          <EyeOff className="h-3 w-3 text-rose-400" />
                          No disponible
                        </span>
                      ) : isOutOfStock ? (
                        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-amber-600/95 text-white px-2 py-0.5 text-[10px] font-bold shadow-2xs backdrop-blur-md">
                          <PackageX className="h-3 w-3" />
                          Sin stock
                        </span>
                      ) : meta?.hasOffer ? (
                        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                          <Tag className="h-2.5 w-2.5" />
                          Oferta
                        </span>
                      ) : null}
                    </div>

                    {/* Botón Favorito en esquina superior derecha */}
                    <div className="absolute right-2.5 top-2.5 z-10" onClick={(e) => e.stopPropagation()}>
                      <FavoriteButton item={{ ...item, image, price: displayPrice }} />
                    </div>
                  </div>

                  {/* Contenido del Producto */}
                  <div className="p-4 sm:p-5 flex flex-col flex-1 justify-between gap-3">
                    <div className="space-y-2">
                      <Link
                        href={productUrl}
                        className="block text-left group/link w-full"
                      >
                        <h2 className="text-sm sm:text-base font-extrabold text-foreground leading-snug line-clamp-2 group-hover/link:text-primary transition-colors">
                          {item.name}
                        </h2>
                      </Link>

                      {typeof displayPrice === 'number' && displayPrice > 0 && (
                        <div className="flex items-baseline gap-2">
                          <p className="text-lg font-black text-foreground tracking-tight">
                            {formatPrice(displayPrice)}
                          </p>
                          {originalPrice && originalPrice > displayPrice && (
                            <p className="text-xs text-muted-foreground line-through">
                              {formatPrice(originalPrice)}
                            </p>
                          )}
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground line-clamp-1">
                        Vendido por <span className="font-semibold text-foreground/80">{item.store}</span>
                      </p>
                    </div>

                    {/* Footer de la Tarjeta con Botones de Acción */}
                    <div className="pt-3 border-t border-border/60 flex items-center justify-between gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedItem(item)}
                        className="h-9 rounded-xl px-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground gap-1 border-border/80"
                        title="Ver detalle del producto"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span className="text-[11px] hidden sm:inline">Detalle</span>
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleShareProduct(item)}
                        className="h-9 rounded-xl px-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground gap-1 border-border/80"
                        title="Compartir enlace de este producto"
                      >
                        {copiedId === item.productId ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-500" />
                            <span className="text-[11px] text-emerald-600 font-bold">Copiado</span>
                          </>
                        ) : (
                          <>
                            <Share2 className="h-3.5 w-3.5" />
                            <span className="text-[11px] hidden sm:inline">Compartir</span>
                          </>
                        )}
                      </Button>

                      <Button
                        asChild
                        size="sm"
                        className="h-9 rounded-xl px-3.5 text-xs font-bold gap-1.5 shadow-xs flex-1 justify-center"
                      >
                        <Link href={productUrl}>
                          <span>Ver en tienda</span>
                          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {/* ── 3. Modo Lista (List Mode) ── */}
        {filtered.length > 0 && viewMode === 'list' && (
          <ul className="flex flex-col space-y-3">
            {filtered.map((item) => {
              const productUrl = `/${item.slug}/productos/${item.productId}`
              const storeUrl = `/${item.slug}/inicio`
              const meta = productMetadata[item.productId]
              const image = meta?.image ?? item.image
              const displayPrice = meta?.hasOffer && meta.offerPrice ? meta.offerPrice : (meta?.price ?? item.price)
              const originalPrice = meta?.hasOffer && meta.offerPrice ? meta.price : null
              const isInactive = meta?.isActive === false
              const isOutOfStock = meta ? meta.inStock === false : false

              return (
                <li
                  key={favoriteKey(item)}
                  className={cn(
                    "group relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-border/80 bg-card p-3.5 sm:p-4 shadow-sm transition-all duration-200 hover:border-primary/40 hover:shadow-md",
                    isInactive && "opacity-65 grayscale-[15%] backdrop-blur-xs",
                    isOutOfStock && !isInactive && "opacity-75 backdrop-blur-xs"
                  )}
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    {/* Thumbnail con Imagen */}
                    <div
                      onClick={() => setSelectedItem(item)}
                      className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-border/60 bg-muted/20 cursor-pointer"
                    >
                      <FavoriteProductImage src={image} alt={item.name} />
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={storeUrl}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-primary transition-colors"
                        >
                          <Store className="h-3 w-3" />
                          <span>{item.store}</span>
                        </Link>
                        {isInactive ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/90 text-white px-2 py-0.5 text-[10px] font-bold border border-white/10">
                            <EyeOff className="h-3 w-3 text-rose-400" />
                            No disponible
                          </span>
                        ) : isOutOfStock ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold">
                            <PackageX className="h-3 w-3" />
                            Sin stock
                          </span>
                        ) : meta?.hasOffer ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30 px-2 py-0.5 text-[10px] font-bold">
                            <Tag className="h-2.5 w-2.5" />
                            Oferta
                          </span>
                        ) : null}
                      </div>

                      <Link
                        href={productUrl}
                        className="block text-left group/title truncate w-full"
                      >
                        <h2 className="truncate text-sm font-bold text-foreground group-hover/title:text-primary transition-colors">
                          {item.name}
                        </h2>
                      </Link>
                      {typeof displayPrice === 'number' && displayPrice > 0 && (
                        <div className="flex items-baseline gap-2">
                          <p className="text-sm font-black text-foreground">
                            {formatPrice(displayPrice)}
                          </p>
                          {originalPrice && originalPrice > displayPrice && (
                            <p className="text-xs text-muted-foreground line-through">
                              {formatPrice(originalPrice)}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelectedItem(item)}
                      className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground"
                      title="Ver detalle del producto"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleShareProduct(item)}
                      className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground"
                      title="Copiar enlace"
                    >
                      {copiedId === item.productId ? (
                        <Check className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Share2 className="h-4 w-4" />
                      )}
                    </Button>

                    <Button
                      asChild
                      size="sm"
                      className="h-9 rounded-xl px-4 text-xs font-bold gap-1.5 shadow-xs"
                    >
                      <Link href={productUrl}>
                        <span>Ver en tienda</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>

                    <FavoriteButton item={{ ...item, image, price: displayPrice }} />
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {/* ── Modal de Detalle de Producto Favorito ── */}
        <FavoriteDetailModal
          item={selectedItem}
          meta={selectedItem ? productMetadata[selectedItem.productId] : undefined}
          open={Boolean(selectedItem)}
          onClose={() => setSelectedItem(null)}
        />
      </main>
    </div>
  )
}
