'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  Heart, 
  Package, 
  Trash2, 
  ArrowRight, 
  Store, 
  Sparkles, 
  ShoppingBag, 
  CloudCheck, 
  Laptop, 
  Tag, 
  PackageX, 
  EyeOff, 
  RefreshCw 
} from 'lucide-react'
import { toast } from 'sonner'
import Image from 'next/image'
import { useAuth } from '@/contexts/auth-context'
import { 
  Dialog, 
  DialogContent, 
  DialogTitle, 
  DialogDescription, 
  DialogTrigger,
  DialogHeader,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { favoriteKey, type Favorite } from '@/lib/public/favorites-schema'
import { initializeFavorites, refreshGuestFavorites, toggleFavorite, useFavorites } from '@/lib/public/favorites-store'
import { resolveProductImageUrl } from '@/lib/images'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
import { cn } from '@/lib/utils'

interface ProductMeta {
  image?: string | null
  images?: string[]
  price?: number | null
  offerPrice?: number | null
  hasOffer?: boolean
  inStock?: boolean
  isActive?: boolean
}

function formatCurrency(amount?: number | null) {
  if (typeof amount !== 'number' || isNaN(amount)) return null
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(amount)
}

function FavoriteModalThumbnail({ src, alt }: { src?: string | null; alt: string }) {
  const [err, setErr] = useState(false)
  const imageSrc = src ? resolveProductImageUrl(src) : null

  useEffect(() => {
    setErr(false)
  }, [src])

  if (!imageSrc || err || imageSrc === '/placeholder-product.svg') {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted/40 text-muted-foreground/40">
        <Package className="h-5 w-5" />
      </div>
    )
  }

  return (
    <Image
      key={imageSrc}
      src={imageSrc}
      alt={alt}
      fill
      sizes="64px"
      className="object-contain p-1.5 transition-transform duration-300 group-hover:scale-105"
      onError={() => setErr(true)}
      unoptimized
    />
  )
}

export function FavoriteButton({ item, className }: { item: Favorite; className?: string }) {
  const state = useFavorites()
  const saved = state.items.some(row => favoriteKey(row) === favoriteKey(item))
  return (
    <button
      type="button"
      aria-label={`${saved ? 'Quitar de' : 'Agregar a'} favoritos: ${item.name}`}
      aria-pressed={saved}
      disabled={state.busy || !!state.error}
      onClick={event => {
        event.preventDefault()
        event.stopPropagation()
        void toggleFavorite(item).catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : 'No se pudo guardar el cambio. Reintentá.'
          toast.error(msg)
        })
      }}
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-background/90 backdrop-blur-xs text-primary shadow-xs transition-all hover:bg-muted hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
        className
      )}
    >
      <Heart 
        aria-hidden="true" 
        className={cn(
          'h-4 w-4 transition-colors', 
          saved ? 'fill-rose-500 text-rose-500' : 'text-muted-foreground hover:text-foreground'
        )} 
      />
    </button>
  )
}

export function PublicFavorites() {
  const { user } = useAuth()
  const state = useFavorites()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [metadata, setMetadata] = useState<Record<string, ProductMeta>>({})
  const [loadingMeta, setLoadingMeta] = useState(false)
  const [viewScope, setViewScope] = useState<'store' | 'all'>('store')

  const tenantSlug = getTenantSlugFromPathname(pathname)
  const isFavoritesActive = pathname === '/marketplace/favoritos' || (Boolean(tenantSlug) && pathname === `/${tenantSlug}/favoritos`)

  const storeFavorites = useMemo(() => {
    if (!tenantSlug) return []
    return state.items.filter((item) => item.slug === tenantSlug)
  }, [tenantSlug, state.items])

  const storeName = useMemo(() => {
    if (!tenantSlug) return ''
    return storeFavorites[0]?.store || state.items.find((i) => i.slug === tenantSlug)?.store || 'esta tienda'
  }, [tenantSlug, storeFavorites, state.items])

  // Si está en la sección de una tienda/organización, muestra la cantidad únicamente de esa tienda
  const headerCount = tenantSlug ? storeFavorites.length : state.items.length

  useEffect(() => {
    if (open) {
      if (tenantSlug) {
        setViewScope('store')
      } else {
        setViewScope('all')
      }
    }
  }, [open, tenantSlug])

  const currentScope = tenantSlug ? viewScope : 'all'
  const displayedItems = currentScope === 'store' ? storeFavorites : state.items
  const isStoreScope = currentScope === 'store'

  useEffect(() => {
    void initializeFavorites(user?.id ?? null)
  }, [user?.id])

  useEffect(() => {
    window.addEventListener('storage', refreshGuestFavorites)
    return () => window.removeEventListener('storage', refreshGuestFavorites)
  }, [])

  // Fetch metadata when modal opens
  useEffect(() => {
    if (!open || state.items.length === 0) return

    let isMounted = true
    setLoadingMeta(true)

    const productIds = Array.from(new Set(state.items.map(item => item.productId).filter(Boolean)))
    if (productIds.length === 0) {
      setLoadingMeta(false)
      return
    }

    fetch('/api/public/favorites/metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productIds }),
    })
      .then(async (res) => {
        if (!res.ok) return null
        return (await res.json()) as { metadata?: Record<string, ProductMeta> }
      })
      .then((data) => {
        if (isMounted && data?.metadata) {
          setMetadata(data.metadata)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setLoadingMeta(false)
      })

    return () => {
      isMounted = false
    }
  }, [open, state.items])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={`Mis favoritos (${headerCount})`}
          className={cn(
            'group relative inline-flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold transition-all border shadow-2xs cursor-pointer',
            isFavoritesActive
              ? 'bg-rose-500/15 text-rose-600 border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/60 ring-2 ring-rose-500/20'
              : 'border-border/80 bg-background/80 hover:bg-muted text-muted-foreground hover:text-foreground'
          )}
        >
          <Heart
            className={cn(
              'h-4 w-4 transition-transform duration-200 group-hover:scale-110',
              headerCount > 0
                ? 'fill-rose-500 text-rose-500'
                : isFavoritesActive
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-muted-foreground'
            )}
          />
          <span
            className={cn(
              'text-xs font-bold tabular-nums',
              headerCount > 0 || isFavoritesActive
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-muted-foreground'
            )}
          >
            {headerCount}
          </span>
        </button>
      </DialogTrigger>

      <DialogContent className="flex max-h-[90dvh] flex-col p-0 gap-0 sm:max-w-lg sm:rounded-3xl border-border/80 shadow-2xl overflow-hidden">
        {/* Header con diseño premium */}
        <DialogHeader className="p-5 sm:p-6 pb-3 border-b border-border/60 bg-muted/20">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500/20 to-pink-500/10 text-rose-500 ring-1 ring-rose-500/25 shadow-xs">
                <Heart className="h-5 w-5 fill-rose-500/30 text-rose-500" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-lg font-black tracking-tight text-foreground">
                    {tenantSlug && isStoreScope ? `Favoritos en ${storeName}` : 'Mis favoritos'}
                  </DialogTitle>
                  <span className="rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 px-2 py-0.5 text-[11px] font-bold">
                    {displayedItems.length}
                  </span>
                </div>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                  {state.account ? (
                    <>
                      <CloudCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <span>Sincronizados en tu cuenta</span>
                    </>
                  ) : (
                    <>
                      <Laptop className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span>Guardados en este navegador</span>
                    </>
                  )}
                </DialogDescription>
              </div>
            </div>
          </div>

          {/* Segmented Control / Selector de Tienda vs Todos cuando está dentro de una tienda */}
          {tenantSlug && (
            <div className="flex p-1 mt-3 bg-muted/60 rounded-xl border border-border/70">
              <button
                type="button"
                onClick={() => setViewScope('store')}
                className={cn(
                  "flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer",
                  isStoreScope
                    ? "bg-card text-foreground shadow-xs ring-1 ring-border/50"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Store className="h-3.5 w-3.5" />
                <span className="truncate">En esta tienda</span>
                <span className={cn(
                  "ml-1 rounded-full px-1.5 py-0.2 text-[10px] font-bold",
                  isStoreScope ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                )}>
                  {storeFavorites.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setViewScope('all')}
                className={cn(
                  "flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer",
                  !isStoreScope
                    ? "bg-card text-foreground shadow-xs ring-1 ring-border/50"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Heart className="h-3.5 w-3.5" />
                <span className="truncate">Todas las tiendas</span>
                <span className={cn(
                  "ml-1 rounded-full px-1.5 py-0.2 text-[10px] font-bold",
                  !isStoreScope ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                )}>
                  {state.items.length}
                </span>
              </button>
            </div>
          )}
        </DialogHeader>

        {/* Mensajes de error o sincronización */}
        {state.error && (
          <div role="alert" className="mx-5 sm:mx-6 mt-3 flex items-center justify-between rounded-xl bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive">
            <span>{state.error}</span>
            <button
              type="button"
              className="font-bold underline hover:opacity-80 ml-2 shrink-0"
              onClick={() => void initializeFavorites(user?.id ?? null)}
            >
              Reintentar
            </button>
          </div>
        )}

        {state.busy && (
          <div role="status" className="mx-5 sm:mx-6 mt-3 flex items-center gap-2 rounded-xl bg-muted/40 p-2.5 text-xs text-muted-foreground">
            <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
            <span>Sincronizando favoritos con tu cuenta…</span>
          </div>
        )}

        {/* Lista de Favoritos o Estado Vacío */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5">
          {!displayedItems.length && !state.busy && !state.error ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-muted/50 text-muted-foreground/40 ring-1 ring-border/60">
                {tenantSlug && isStoreScope ? (
                  <Store className="h-8 w-8 stroke-[1.5]" />
                ) : (
                  <Heart className="h-8 w-8 stroke-[1.5]" />
                )}
              </div>
              <h4 className="text-base font-bold text-foreground">
                {tenantSlug && isStoreScope 
                  ? `Sin favoritos guardados en ${storeName}`
                  : 'Tu lista de favoritos está vacía'}
              </h4>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground leading-relaxed">
                {tenantSlug && isStoreScope
                  ? `Explorá el catálogo de ${storeName} y tocá el corazón para guardar tus productos preferidos.`
                  : 'Guardá productos que te gusten tocando el corazón mientras explorás las tiendas para encontrarlos fácilmente.'}
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-2 mt-5">
                <Button
                  asChild
                  size="sm"
                  className="h-9 rounded-xl px-4 text-xs font-bold gap-1.5 shadow-xs"
                  onClick={() => setOpen(false)}
                >
                  <Link href={tenantSlug && isStoreScope ? `/${tenantSlug}/productos` : '/marketplace'}>
                    <ShoppingBag className="h-3.5 w-3.5" />
                    <span>{tenantSlug && isStoreScope ? 'Explorar catálogo de la tienda' : 'Explorar Marketplace'}</span>
                  </Link>
                </Button>
                {tenantSlug && isStoreScope && state.items.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-xl px-4 text-xs font-semibold gap-1.5"
                    onClick={() => setViewScope('all')}
                  >
                    <Heart className="h-3.5 w-3.5 text-rose-500" />
                    <span>Ver mis otros favoritos ({state.items.length})</span>
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {displayedItems.map((item) => {
                const meta = metadata[item.productId]
                const image = meta?.image ?? item.image
                const displayPrice = meta?.hasOffer && meta.offerPrice ? meta.offerPrice : (meta?.price ?? item.price)
                const originalPrice = meta?.hasOffer && meta.offerPrice ? meta.price : null
                const isInactive = meta?.isActive === false
                const isOutOfStock = meta ? meta.inStock === false : false
                const productUrl = `/${item.slug}/productos/${item.productId}`

                return (
                  <li
                    key={favoriteKey(item)}
                    className={cn(
                      "group relative flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card p-2.5 sm:p-3 transition-all duration-200 hover:border-primary/40 hover:shadow-xs",
                      isInactive && "opacity-65 grayscale-[20%]",
                      isOutOfStock && !isInactive && "opacity-75"
                    )}
                  >
                    {/* Enlace al producto */}
                    <Link
                      href={productUrl}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 min-w-0 flex-1 group/link"
                    >
                      {/* Miniatura */}
                      <div className="relative h-14 w-14 sm:h-16 sm:w-16 shrink-0 overflow-hidden rounded-xl border border-border/60 bg-muted/20">
                        <FavoriteModalThumbnail src={image} alt={item.name} />
                        {isInactive ? (
                          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-0.5">
                            <span className="text-[9px] font-bold text-white text-center leading-tight">Pausado</span>
                          </div>
                        ) : isOutOfStock ? (
                          <div className="absolute inset-0 bg-amber-950/60 backdrop-blur-2xs flex items-center justify-center p-0.5">
                            <span className="text-[9px] font-bold text-amber-200 text-center leading-tight">Agotado</span>
                          </div>
                        ) : null}
                      </div>

                      {/* Información */}
                      <div className="min-w-0 flex-1 space-y-1">
                        <h4 className="text-xs sm:text-sm font-bold text-foreground leading-snug line-clamp-1 group-hover/link:text-primary transition-colors">
                          {item.name}
                        </h4>

                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <Store className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                          <span className="truncate">{item.store}</span>
                        </div>

                        {/* Precio & Oferta */}
                        {typeof displayPrice === 'number' && displayPrice > 0 ? (
                          <div className="flex items-baseline gap-1.5 pt-0.5">
                            <span className="text-xs sm:text-sm font-black text-foreground">
                              {formatCurrency(displayPrice)}
                            </span>
                            {originalPrice && originalPrice > displayPrice && (
                              <span className="text-[10px] text-muted-foreground line-through">
                                {formatCurrency(originalPrice)}
                              </span>
                            )}
                            {meta?.hasOffer && (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-1 py-0.2 rounded">
                                Oferta
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">Ver precio en tienda</span>
                        )}
                      </div>
                    </Link>

                    {/* Botón Quitar Favorito */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Quitar de favoritos: ${item.name}`}
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          void toggleFavorite(item).catch(() => toast.error('No se pudo quitar el favorito.'))
                        }}
                        className="h-8 w-8 rounded-xl text-muted-foreground/60 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                        title="Quitar de favoritos"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>

                      <Button
                        asChild
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-xl text-muted-foreground hover:text-primary"
                        onClick={() => setOpen(false)}
                        title="Ver en tienda"
                      >
                        <Link href={productUrl}>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Footer con Enlace a la Página Completa */}
        {state.items.length > 0 && (
          <DialogFooter className="p-4 sm:p-5 border-t border-border/60 bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground order-2 sm:order-1">
              {displayedItems.length} {displayedItems.length === 1 ? 'producto mostrado' : 'productos mostrados'}
              {tenantSlug && isStoreScope && state.items.length > storeFavorites.length && ` (${state.items.length} en total)`}
            </span>

            <Button
              asChild
              className={cn(
                'h-10 rounded-xl px-5 text-xs font-bold gap-2 shadow-xs w-full sm:w-auto order-1 sm:order-2',
                isFavoritesActive
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-primary hover:bg-primary/90 text-primary-foreground'
              )}
              onClick={() => setOpen(false)}
            >
              <Link href={tenantSlug && isStoreScope ? `/${tenantSlug}/favoritos` : '/marketplace/favoritos'}>
                <span>
                  {tenantSlug && isStoreScope
                    ? `Ver favoritos de ${storeName}`
                    : isFavoritesActive
                      ? 'Ver página completa de favoritos'
                      : 'Ver todos los favoritos'}
                </span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}


