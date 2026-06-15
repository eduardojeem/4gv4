'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  Tag, Package, ArrowRight, Zap, ShoppingCart,
  Search, Sparkles, TrendingDown, Star,
  CheckCircle, X, SlidersHorizontal
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { usePublicTenantPrefix } from '@/lib/public/tenant-client'
import { getTenantSlugFromPathname, withOrgQuery } from '@/lib/saas/tenant'
import { cn } from '@/lib/utils'
import type { OffersSectionSettings, WebsiteSettings } from '@/types/website-settings'
import { usePublicCart } from '@/hooks/use-public-cart'
import type { PublicProduct } from '@/types/public'
import { toast } from 'sonner'
import useSWR from 'swr'

// ─── Types ────────────────────────────────────────────────────────────────────

interface OfferProduct {
  id: string
  name: string
  brand: string | null
  description: string | null
  sale_price: number
  offer_price: number
  has_offer: boolean
  in_stock: boolean
  stock_quantity: number
  featured: boolean
  image: string | null
  images: string[] | null
  category?: { id: string; name: string }
}

interface OffersPageClientProps {
  initialSettings: WebsiteSettings
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(price: number): string {
  return new Intl.NumberFormat('es-PY', {
    style: 'currency',
    currency: 'PYG',
    maximumFractionDigits: 0,
  }).format(price)
}

function calcDiscount(sale: number, offer: number): number {
  if (sale <= 0 || offer >= sale) return 0
  return Math.round(((sale - offer) / sale) * 100)
}

const OFFER_ACCENTS: Record<OffersSectionSettings['accentColor'], {
  hero: string
  text: string
  solid: string
  soft: string
  border: string
  bottom: string
}> = {
  brand: { hero: 'bg-gradient-to-br from-primary via-primary/90 to-primary/70', text: 'text-primary', solid: 'bg-primary text-primary-foreground hover:bg-primary/90', soft: 'bg-primary/10 text-primary hover:bg-primary/15', border: 'border-primary/30 text-primary hover:bg-primary/10', bottom: 'bg-gradient-to-r from-primary/10 to-primary/5' },
  rose: { hero: 'bg-gradient-to-br from-rose-950 via-rose-900 to-orange-900', text: 'text-rose-600 dark:text-rose-400', solid: 'bg-rose-600 text-white hover:bg-rose-700', soft: 'bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-950 dark:text-rose-300', border: 'border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/40', bottom: 'bg-gradient-to-r from-rose-50 to-orange-50 dark:from-rose-950/20 dark:to-orange-950/20' },
  amber: { hero: 'bg-gradient-to-br from-amber-950 via-amber-900 to-orange-900', text: 'text-amber-600 dark:text-amber-400', solid: 'bg-amber-600 text-white hover:bg-amber-700', soft: 'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-300', border: 'border-amber-200 text-amber-800 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/40', bottom: 'bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20' },
  orange: { hero: 'bg-gradient-to-br from-orange-950 via-orange-900 to-amber-900', text: 'text-orange-600 dark:text-orange-400', solid: 'bg-orange-600 text-white hover:bg-orange-700', soft: 'bg-orange-100 text-orange-800 hover:bg-orange-200 dark:bg-orange-950 dark:text-orange-300', border: 'border-orange-200 text-orange-800 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-300 dark:hover:bg-orange-950/40', bottom: 'bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20' },
  emerald: { hero: 'bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-900', text: 'text-emerald-600 dark:text-emerald-400', solid: 'bg-emerald-600 text-white hover:bg-emerald-700', soft: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-300', border: 'border-emerald-200 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/40', bottom: 'bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20' },
  blue: { hero: 'bg-gradient-to-br from-blue-950 via-blue-900 to-indigo-900', text: 'text-blue-600 dark:text-blue-400', solid: 'bg-blue-600 text-white hover:bg-blue-700', soft: 'bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-950 dark:text-blue-300', border: 'border-blue-200 text-blue-800 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950/40', bottom: 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20' },
  sky: { hero: 'bg-gradient-to-br from-sky-950 via-sky-900 to-cyan-900', text: 'text-sky-600 dark:text-sky-400', solid: 'bg-sky-600 text-white hover:bg-sky-700', soft: 'bg-sky-100 text-sky-800 hover:bg-sky-200 dark:bg-sky-950 dark:text-sky-300', border: 'border-sky-200 text-sky-800 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/40', bottom: 'bg-gradient-to-r from-sky-50 to-cyan-50 dark:from-sky-950/20 dark:to-cyan-950/20' },
  violet: { hero: 'bg-gradient-to-br from-violet-950 via-violet-900 to-purple-900', text: 'text-violet-600 dark:text-violet-400', solid: 'bg-violet-600 text-white hover:bg-violet-700', soft: 'bg-violet-100 text-violet-800 hover:bg-violet-200 dark:bg-violet-950 dark:text-violet-300', border: 'border-violet-200 text-violet-800 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-950/40', bottom: 'bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20' },
  fuchsia: { hero: 'bg-gradient-to-br from-fuchsia-950 via-fuchsia-900 to-pink-900', text: 'text-fuchsia-600 dark:text-fuchsia-400', solid: 'bg-fuchsia-600 text-white hover:bg-fuchsia-700', soft: 'bg-fuchsia-100 text-fuchsia-800 hover:bg-fuchsia-200 dark:bg-fuchsia-950 dark:text-fuchsia-300', border: 'border-fuchsia-200 text-fuchsia-800 hover:bg-fuchsia-50 dark:border-fuchsia-800 dark:text-fuchsia-300 dark:hover:bg-fuchsia-950/40', bottom: 'bg-gradient-to-r from-fuchsia-50 to-pink-50 dark:from-fuchsia-950/20 dark:to-pink-950/20' },
  red: { hero: 'bg-gradient-to-br from-red-950 via-red-900 to-rose-900', text: 'text-red-600 dark:text-red-400', solid: 'bg-red-600 text-white hover:bg-red-700', soft: 'bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-950 dark:text-red-300', border: 'border-red-200 text-red-800 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40', bottom: 'bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/20 dark:to-rose-950/20' },
  teal: { hero: 'bg-gradient-to-br from-teal-950 via-teal-900 to-cyan-900', text: 'text-teal-600 dark:text-teal-400', solid: 'bg-teal-600 text-white hover:bg-teal-700', soft: 'bg-teal-100 text-teal-800 hover:bg-teal-200 dark:bg-teal-950 dark:text-teal-300', border: 'border-teal-200 text-teal-800 hover:bg-teal-50 dark:border-teal-800 dark:text-teal-300 dark:hover:bg-teal-950/40', bottom: 'bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-950/20 dark:to-cyan-950/20' },
}

// ─── Fetcher ──────────────────────────────────────────────────────────────────

async function fetchOffers(url: string): Promise<OfferProduct[]> {
  const res = await fetch(url)
  const body = await res.json().catch(() => null)
  const products = body?.data?.products

  if (!res.ok || !Array.isArray(products)) {
    throw new Error('No se pudieron cargar las ofertas')
  }

  return products
    .filter((p) => Boolean(p.has_offer) && Number(p.offer_price) > 0 && Number(p.offer_price) < Number(p.sale_price))
    .sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)))
    .map((p) => ({
      id: String(p.id),
      name: String(p.name ?? ''),
      brand: p.brand ? String(p.brand) : null,
      description: p.description ? String(p.description) : null,
      sale_price: Number(p.sale_price ?? 0),
      offer_price: Number(p.offer_price ?? 0),
      has_offer: Boolean(p.has_offer),
      in_stock: typeof p.in_stock === 'boolean' ? p.in_stock : Number(p.stock_quantity ?? p.in_stock) > 0,
      stock_quantity: Number(p.stock_quantity ?? 0),
      featured: Boolean(p.featured),
      image: p.image ? String(p.image) : (Array.isArray(p.images) && p.images.length > 0 ? String(p.images[0]) : null),
      images: Array.isArray(p.images) ? p.images.map(String) : null,
      category: p.category && typeof p.category === 'object'
        ? { id: String((p.category as Record<string, unknown>).id), name: String((p.category as Record<string, unknown>).name) }
        : undefined,
    }))
}

// ─── Countdown Timer ─────────────────────────────────────────────────────────

// ─── Offer Card ───────────────────────────────────────────────────────────────

function OfferCard({ offer, tenantPrefix, accent, priority }: { offer: OfferProduct; tenantPrefix: string; accent: (typeof OFFER_ACCENTS)[OffersSectionSettings['accentColor']]; priority?: boolean }) {
  const { addProduct } = usePublicCart()
  const [addedToCart, setAddedToCart] = useState(false)
  const discount = calcDiscount(offer.sale_price, offer.offer_price)
  const href = `${tenantPrefix}/productos/${offer.id}`

  const handleCart = (e: React.MouseEvent) => {
    e.preventDefault()
    const product: PublicProduct = {
      ...offer,
      sku: '',
      wholesale_price: null,
      is_active: true,
      unit_measure: 'unidad',
      barcode: null,
    }
    addProduct(product, offer.offer_price, 1)
    toast.success('Agregado al carrito')
    setAddedToCart(true)
    setTimeout(() => setAddedToCart(false), 2000)
  }

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl">
      {/* Image */}
      <Link href={href} className="relative block aspect-[4/3] overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
        {offer.image ? (
          <Image
            src={offer.image}
            alt={offer.name || 'Imagen de producto en oferta'}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            priority={priority}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Package className="h-16 w-16 text-muted-foreground/30" />
          </div>
        )}

        {/* Discount badge */}
        {discount > 0 && (
          <div className={cn('absolute left-3 top-3 flex items-center gap-1 rounded-full px-3 py-1.5 shadow-lg', accent.solid)}>
            <Zap className="h-3.5 w-3.5 text-white" />
            <span className="text-xs font-black text-white">-{discount}%</span>
          </div>
        )}

        {/* Featured badge */}
        {offer.featured && (
          <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-1">
            <Star className="h-3 w-3 fill-white text-white" />
            <span className="text-xs font-bold text-white">Destacado</span>
          </div>
        )}

        {/* Stock badge */}
        {!offer.in_stock && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-[1px]">
            <span className="rounded-full bg-black/80 px-4 py-2 text-sm font-semibold text-white">Sin stock</span>
          </div>
        )}
      </Link>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* Category + Brand */}
        <div className="flex items-center gap-2">
          {offer.category && (
            <Badge variant="secondary" className="text-xs font-medium">
              {offer.category.name}
            </Badge>
          )}
          {offer.brand && (
            <span className="text-xs text-muted-foreground">{offer.brand}</span>
          )}
        </div>

        {/* Name */}
        <Link href={href}>
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
            {offer.name}
          </h3>
        </Link>

        {/* Price block */}
        <div className="mt-auto flex items-end justify-between gap-2">
          <div>
            <p className="text-xs text-muted-foreground line-through">{formatPrice(offer.sale_price)}</p>
            <p className={cn('text-xl font-black', accent.text)}>{formatPrice(offer.offer_price)}</p>
          </div>
          {offer.in_stock && (
            <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="h-3.5 w-3.5" />
              <span className="font-medium">Disponible</span>
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="flex gap-2">
          <Button
            asChild
            size="sm"
            variant="outline"
            className={cn('flex-1 rounded-xl', accent.border)}
          >
            <Link href={href}>Ver detalle</Link>
          </Button>
          <Button
            size="sm"
            onClick={handleCart}
            disabled={!offer.in_stock}
            aria-label={`Agregar ${offer.name} al carrito`}
            className={cn(
              "rounded-xl transition-all",
              addedToCart
                ? "bg-emerald-600 hover:bg-emerald-600 text-white"
                : accent.solid
            )}
          >
            {addedToCart ? <CheckCircle className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </article>
  )
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function OfferSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card animate-pulse">
      <div className="aspect-[4/3] bg-muted" />
      <div className="space-y-3 p-4">
        <div className="h-3 w-1/3 rounded-full bg-muted" />
        <div className="space-y-1.5">
          <div className="h-4 rounded-full bg-muted" />
          <div className="h-4 w-3/4 rounded-full bg-muted" />
        </div>
        <div className="h-6 w-2/5 rounded-full bg-muted" />
        <div className="flex gap-2">
          <div className="h-9 flex-1 rounded-xl bg-muted" />
          <div className="h-9 w-9 rounded-xl bg-muted" />
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function OffersPageClient({ initialSettings }: OffersPageClientProps) {
  const { settings: liveSettings } = useWebsiteSettings()
  const { tenantPrefix } = usePublicTenantPrefix()
  const pathname = usePathname()
  const tenantSlug = getTenantSlugFromPathname(pathname)
  const settings = liveSettings ?? initialSettings
  const offersSettings = settings.offers_section
  const accent = OFFER_ACCENTS[offersSettings.accentColor] ?? OFFER_ACCENTS.rose

  // Fetch offers
  const { data: allOffers = [], isLoading, error } = useSWR<OfferProduct[]>(
    withOrgQuery('/api/public/products?per_page=50&sort=newest&has_offer=true', tenantSlug),
    fetchOffers,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  )

  // Filters
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'discount' | 'price_asc' | 'price_desc' | 'newest'>('discount')

  // Derived categories
  const categories = Array.from(
    new Map(
      allOffers
        .filter(o => o.category)
        .map(o => [o.category!.id, o.category!])
    ).values()
  )

  // Filtered + sorted offers
  const displayedOffers = allOffers
    .filter(o => {
      const matchSearch = !search || o.name.toLowerCase().includes(search.toLowerCase()) || (o.brand?.toLowerCase().includes(search.toLowerCase()) ?? false)
      const matchCat = !selectedCategory || o.category?.id === selectedCategory
      return matchSearch && matchCat
    })
    .sort((a, b) => {
      if (sortBy === 'discount') return calcDiscount(b.sale_price, b.offer_price) - calcDiscount(a.sale_price, a.offer_price)
      if (sortBy === 'price_asc') return a.offer_price - b.offer_price
      if (sortBy === 'price_desc') return b.offer_price - a.offer_price
      return 0
    })

  const totalSavings = displayedOffers.reduce((sum, o) => sum + Math.max(0, o.sale_price - o.offer_price), 0)

  // ── Not enabled ─────────────────────────────────────────────────────────────
  if (!offersSettings.enabled) {
    return (
      <div className="container flex min-h-[60vh] items-center justify-center py-16 text-center">
        <div className="max-w-md rounded-3xl border border-dashed bg-muted/20 px-8 py-16">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">
            <Tag className="h-8 w-8 text-muted-foreground/60" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Ofertas no disponibles</h1>
          <p className="mt-3 text-muted-foreground">Esta tienda no tiene activa su sección de ofertas en este momento.</p>
          <Button asChild className="mt-6">
            <Link href={`${tenantPrefix}/productos`}>Ver todos los productos <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* ── Hero Banner ──────────────────────────────────────────────────────── */}
      <section className={cn('relative overflow-hidden py-16 md:py-24', accent.hero)}>
        {/* Background pattern */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-20 -top-20 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-black/10 blur-3xl" />
          <svg className="absolute inset-0 h-full w-full opacity-5" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="4" cy="4" r="2" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dots)" />
          </svg>
        </div>

        <div className="container relative">
          {/* Eyebrow */}
          <div className="mb-4 flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 backdrop-blur-sm">
              <Sparkles className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-bold uppercase tracking-widest text-white/80">
                {offersSettings.eyebrow || 'Ofertas Especiales'}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <h1 className="text-4xl font-black leading-tight tracking-tight text-white md:text-6xl">
                {offersSettings.title || 'Ofertas Imperdibles'}
              </h1>
              <p className="mt-4 text-lg text-white/75">
                {offersSettings.subtitle || 'Los mejores descuentos seleccionados para vos.'}
              </p>

              {/* Stats */}
              {!isLoading && allOffers.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-4">
                  <div className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 backdrop-blur-sm">
                    <TrendingDown className="h-5 w-5 text-emerald-400" />
                    <span className="text-sm font-semibold text-white">{allOffers.length} productos en oferta</span>
                  </div>
                  {totalSavings > 0 && (
                    <div className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 backdrop-blur-sm">
                      <Tag className="h-5 w-5 text-amber-400" />
                      <span className="text-sm font-semibold text-white">Ahorrá hasta {formatPrice(Math.max(...allOffers.map(o => o.sale_price - o.offer_price)))}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col items-start gap-4 md:items-end">
              <p className="max-w-xs text-sm font-medium text-white/75 md:text-right">
                Los precios mostrados corresponden a ofertas activas del catálogo.
              </p>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-xl border-white/30 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20"
              >
                <Link href={`${tenantPrefix}/productos`}>
                  Ver catálogo completo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Filters & Search ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="container py-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar en ofertas..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 rounded-xl border-border/60 bg-muted/30 focus-visible:ring-primary"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Categories */}
            <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-hide flex-1">
              <button
                onClick={() => setSelectedCategory(null)}
                className={cn(
                  "flex-shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all",
                  !selectedCategory
                    ? accent.solid
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                Todas
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                  className={cn(
                    "flex-shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all",
                    selectedCategory === cat.id
                      ? accent.solid
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Sort */}
            <div className="flex items-center gap-1.5 rounded-xl border bg-muted/30 px-3 py-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as typeof sortBy)}
                className="bg-transparent text-xs font-medium text-foreground outline-none cursor-pointer"
              >
                <option value="discount">Mayor descuento</option>
                <option value="price_asc">Menor precio</option>
                <option value="price_desc">Mayor precio</option>
                <option value="newest">Más nuevo</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ── Products Grid ─────────────────────────────────────────────────────── */}
      <div className="container py-10">
        {/* Results count */}
        {!isLoading && (
          <div className="mb-6 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {displayedOffers.length === 0
                ? 'Sin resultados'
                : <><span className="font-semibold text-foreground">{displayedOffers.length}</span> oferta{displayedOffers.length !== 1 ? 's' : ''} encontrada{displayedOffers.length !== 1 ? 's' : ''}</>
              }
              {selectedCategory && (
                <button onClick={() => setSelectedCategory(null)} className={cn('ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs', accent.soft)}>
                  <X className="h-3 w-3" /> Limpiar filtro
                </button>
              )}
            </p>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <OfferSkeleton key={i} />)}
          </div>
        )}

        {/* Error */}
        {error && !isLoading && (
          <div className="rounded-2xl border border-dashed bg-destructive/5 p-12 text-center">
            <p className="font-semibold text-destructive">No se pudieron cargar las ofertas</p>
            <p className="mt-2 text-sm text-muted-foreground">Intenta nuevamente en unos minutos.</p>
          </div>
        )}

        {/* Empty */}
        {!isLoading && !error && displayedOffers.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/10 py-20 text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted/50">
              <Tag className="h-10 w-10 text-muted-foreground/40" />
            </div>
            <h2 className="text-xl font-bold">
              {search || selectedCategory ? 'Sin coincidencias' : 'Sin ofertas activas'}
            </h2>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              {search || selectedCategory
                ? 'Probá con otros filtros o explorá todo el catálogo.'
                : 'Cuando activemos productos con oferta, aparecerán acá automáticamente.'}
            </p>
            <div className="mt-6 flex gap-3">
              {(search || selectedCategory) && (
                <Button variant="outline" onClick={() => { setSearch(''); setSelectedCategory(null) }} className="rounded-xl">
                  Limpiar filtros
                </Button>
              )}
              <Button asChild className={cn('rounded-xl', accent.solid)}>
                <Link href={`${tenantPrefix}/productos`}>Ver catálogo <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
          </div>
        )}

        {/* Grid */}
        {!isLoading && !error && displayedOffers.length > 0 && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {displayedOffers.map((offer, i) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                tenantPrefix={tenantPrefix}
                accent={accent}
                priority={i < 4}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Bottom CTA ────────────────────────────────────────────────────────── */}
      {!isLoading && displayedOffers.length > 0 && (
        <section className={cn('border-t py-12', accent.bottom)}>
          <div className="container text-center">
            <Sparkles className={cn('mx-auto mb-3 h-8 w-8', accent.text)} />
            <h2 className="text-2xl font-bold">¿No encontraste lo que buscabas?</h2>
            <p className="mt-2 text-muted-foreground">Explorá nuestro catálogo completo de productos.</p>
            <Button asChild size="lg" className={cn('mt-6 rounded-xl', accent.solid)}>
              <Link href={`${tenantPrefix}/productos`}>
                Ver todos los productos
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      )}
    </div>
  )
}
