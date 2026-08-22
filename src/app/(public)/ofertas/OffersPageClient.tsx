'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  Tag,
  Package,
  ArrowRight,
  Zap,
  ShoppingCart,
  MessageCircle,
  Search,
  Sparkles,
  TrendingDown,
  Star,
  CheckCircle,
  X,
  SlidersHorizontal,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { usePublicTenantPrefix } from '@/lib/public/tenant-client'
import { getTenantSlugFromPathname, withOrgQuery } from '@/lib/saas/tenant'
import { cn } from '@/lib/utils'
import type { OffersSectionSettings, PublicCommerceMode, WebsiteSettings } from '@/types/website-settings'
import { usePublicCart } from '@/hooks/use-public-cart'
import type { PublicProduct } from '@/types/public'
import { toast } from 'sonner'
import useSWR from 'swr'

import { formatCurrency } from '@/lib/currency'
import { getWhatsAppLink } from '@/lib/whatsapp'
import {
  OFFER_ACCENTS as CAROUSEL_ACCENTS,
  OffersCarouselDeck,
  type OfferSlide,
} from '@/components/public/offers/OffersCarouselDeck'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'

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
  initialOffers: OfferProduct[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatPrice(price: number): string {
  return formatCurrency(price)
}

function calcDiscount(sale: number, offer: number): number {
  if (sale <= 0 || offer >= sale) return 0
  return Math.round(((sale - offer) / sale) * 100)
}

/**
 * Convierte las ofertas de la página al formato del carrusel compartido,
 * priorizando las de mayor descuento (es una banda de destacados).
 */
function toOfferSlides(offers: OfferProduct[], limit: number): OfferSlide[] {
  return [...offers]
    .sort((a, b) => calcDiscount(b.sale_price, b.offer_price) - calcDiscount(a.sale_price, a.offer_price))
    .slice(0, Math.max(1, limit))
    .map((offer) => {
      const discount = calcDiscount(offer.sale_price, offer.offer_price)
      return {
        id: offer.id,
        title: offer.name,
        description: offer.description || 'Disponible para entrega inmediata y retiro en tienda.',
        priceLabel: formatPrice(offer.offer_price),
        originalPriceLabel: offer.sale_price > offer.offer_price ? formatPrice(offer.sale_price) : undefined,
        tag: discount > 0 ? `-${discount}%` : 'Oferta activa',
        ctaHref: `/productos/${offer.id}`,
        image: offer.image || (Array.isArray(offer.images) && offer.images.length > 0 ? offer.images[0] : null),
        brand: offer.brand,
        inStock: offer.in_stock,
      }
    })
}

const OFFER_ACCENTS: Record<OffersSectionSettings['accentColor'], {
  hero: string
  text: string
  solid: string
  soft: string
  border: string
  bottom: string
}> = {
  brand: { hero: 'bg-gradient-to-br from-primary via-primary/95 to-primary/80', text: 'text-primary', solid: 'bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary', soft: 'bg-primary/10 text-primary hover:bg-primary/15', border: 'border-primary/30 text-primary hover:bg-primary/10', bottom: 'bg-gradient-to-r from-primary/10 to-primary/5' },
  rose: { hero: 'bg-gradient-to-br from-rose-950 via-rose-900 to-orange-950', text: 'text-rose-600 dark:text-rose-450', solid: 'bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-500', soft: 'bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-400', border: 'border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-800/40 dark:text-rose-400 dark:hover:bg-rose-950/20', bottom: 'bg-gradient-to-r from-rose-50/50 to-orange-50/50 dark:from-rose-950/10 dark:to-orange-950/10' },
  amber: { hero: 'bg-gradient-to-br from-amber-950 via-amber-900 to-orange-950', text: 'text-amber-600 dark:text-amber-450', solid: 'bg-amber-600 text-white hover:bg-amber-700 focus-visible:ring-amber-500', soft: 'bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-400', border: 'border-amber-200 text-amber-800 hover:bg-amber-50 dark:border-amber-800/40 dark:text-amber-400 dark:hover:bg-amber-950/20', bottom: 'bg-gradient-to-r from-amber-50/50 to-orange-50/50 dark:from-amber-950/10 dark:to-orange-950/10' },
  orange: { hero: 'bg-gradient-to-br from-orange-950 via-orange-900 to-amber-950', text: 'text-orange-600 dark:text-orange-450', solid: 'bg-orange-600 text-white hover:bg-orange-700 focus-visible:ring-orange-500', soft: 'bg-orange-50 text-orange-800 hover:bg-orange-100 dark:bg-orange-950/30 dark:text-orange-400', border: 'border-orange-200 text-orange-800 hover:bg-orange-50 dark:border-orange-800/40 dark:text-orange-400 dark:hover:bg-orange-950/20', bottom: 'bg-gradient-to-r from-orange-50/50 to-amber-50/50 dark:from-orange-950/10 dark:to-amber-950/10' },
  emerald: { hero: 'bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-950', text: 'text-emerald-600 dark:text-emerald-450', solid: 'bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-500', soft: 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400', border: 'border-emerald-200 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800/40 dark:text-emerald-400 dark:hover:bg-emerald-950/20', bottom: 'bg-gradient-to-r from-emerald-50/50 to-teal-50/50 dark:from-emerald-950/10 dark:to-teal-950/10' },
  blue: { hero: 'bg-gradient-to-br from-blue-950 via-blue-900 to-indigo-950', text: 'text-blue-600 dark:text-blue-450', solid: 'bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500', soft: 'bg-blue-50 text-blue-800 hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-400', border: 'border-blue-200 text-blue-800 hover:bg-blue-50 dark:border-blue-800/40 dark:text-blue-400 dark:hover:bg-blue-950/20', bottom: 'bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-950/10 dark:to-indigo-950/10' },
  sky: { hero: 'bg-gradient-to-br from-sky-950 via-sky-900 to-cyan-950', text: 'text-sky-600 dark:text-sky-450', solid: 'bg-sky-600 text-white hover:bg-sky-700 focus-visible:ring-sky-500', soft: 'bg-sky-50 text-sky-800 hover:bg-sky-100 dark:bg-sky-950/30 dark:text-sky-400', border: 'border-sky-200 text-sky-800 hover:bg-sky-50 dark:border-sky-800/40 dark:text-sky-450 dark:hover:bg-sky-950/20', bottom: 'bg-gradient-to-r from-sky-50/50 to-cyan-50/50 dark:from-sky-950/10 dark:to-cyan-950/10' },
  violet: { hero: 'bg-gradient-to-br from-violet-950 via-violet-900 to-purple-950', text: 'text-violet-600 dark:text-violet-450', solid: 'bg-violet-600 text-white hover:bg-violet-700 focus-visible:ring-violet-500', soft: 'bg-violet-50 text-violet-850 hover:bg-violet-100 dark:bg-violet-950/30 dark:text-violet-400', border: 'border-violet-200 text-violet-850 hover:bg-violet-50 dark:border-violet-800/40 dark:text-violet-400 dark:hover:bg-violet-950/20', bottom: 'bg-gradient-to-r from-violet-50/50 to-purple-50/50 dark:from-violet-950/10 dark:to-purple-950/10' },
  fuchsia: { hero: 'bg-gradient-to-br from-fuchsia-950 via-fuchsia-900 to-pink-950', text: 'text-fuchsia-600 dark:text-fuchsia-450', solid: 'bg-fuchsia-600 text-white hover:bg-fuchsia-700 focus-visible:ring-fuchsia-500', soft: 'bg-fuchsia-50 text-fuchsia-850 hover:bg-fuchsia-100 dark:bg-fuchsia-950/30 dark:text-fuchsia-400', border: 'border-fuchsia-200 text-fuchsia-850 hover:bg-fuchsia-50 dark:border-fuchsia-800/40 dark:text-fuchsia-400 dark:hover:bg-fuchsia-950/20', bottom: 'bg-gradient-to-r from-fuchsia-50/50 to-pink-50/50 dark:from-fuchsia-950/10 dark:to-pink-950/10' },
  red: { hero: 'bg-gradient-to-br from-red-950 via-red-900 to-rose-950', text: 'text-red-600 dark:text-red-450', solid: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500', soft: 'bg-red-50 text-red-800 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400', border: 'border-red-200 text-red-800 hover:bg-red-50 dark:border-red-800/40 dark:text-red-400 dark:hover:bg-red-950/20', bottom: 'bg-gradient-to-r from-red-50/50 to-rose-50/50 dark:from-red-950/10 dark:to-rose-950/10' },
  teal: { hero: 'bg-gradient-to-br from-teal-950 via-teal-900 to-cyan-950', text: 'text-teal-600 dark:text-teal-450', solid: 'bg-teal-600 text-white hover:bg-teal-700 focus-visible:ring-teal-500', soft: 'bg-teal-50 text-teal-850 hover:bg-teal-100 dark:bg-teal-950/30 dark:text-teal-400', border: 'border-teal-200 text-teal-850 hover:bg-teal-50 dark:border-teal-800/40 dark:text-teal-400 dark:hover:bg-teal-950/20', bottom: 'bg-gradient-to-r from-teal-50/50 to-cyan-50/50 dark:from-teal-950/10 dark:to-cyan-950/10' },
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

// ─── Offer Card ───────────────────────────────────────────────────────────────
function OfferCard({
  offer,
  tenantPrefix,
  accent,
  priority,
  commerceMode,
  contactPhone,
}: {
  offer: OfferProduct
  tenantPrefix: string
  accent: (typeof OFFER_ACCENTS)[OffersSectionSettings['accentColor']]
  priority?: boolean
  commerceMode: PublicCommerceMode
  contactPhone: string
}) {
  const { addProduct } = usePublicCart()
  const [addedToCart, setAddedToCart] = useState(false)
  const discount = calcDiscount(offer.sale_price, offer.offer_price)
  const href = `${tenantPrefix}/productos/${offer.id}`
  const whatsappHref = contactPhone
    ? getWhatsAppLink({
        phone: contactPhone,
        message: `Hola, quiero consultar por ${offer.name} (${formatPrice(offer.offer_price)}).`,
      })
    : null

  const handleCart = (e: React.MouseEvent) => {
    e.preventDefault()
    if (commerceMode !== 'cart') return
    const product: PublicProduct = {
      ...offer,
      sku: '',
      wholesale_price: null,
      is_active: true,
      unit_measure: 'unidad',
      barcode: null,
    }
    const result = addProduct(product, offer.offer_price, 1)
    if (result.limited) {
      toast.info(`Ya agregaste el máximo disponible (${result.quantity}).`)
      return
    }
    toast.success('Agregado al carrito')
    setAddedToCart(true)
    setTimeout(() => setAddedToCart(false), 2000)
  }

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-3xl border border-slate-200/50 bg-white/70 dark:border-slate-800/40 dark:bg-slate-950/60 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-cyan-500/30 hover:shadow-xl hover:shadow-cyan-500/5">
      {/* Image */}
      <Link
        href={href}
        className="relative block aspect-[4/3] overflow-hidden bg-gradient-to-br from-slate-50/50 to-slate-100/50 dark:from-slate-900/40 dark:to-slate-850/30"
      >
        {offer.image ? (
          <Image
            src={offer.image}
            alt={offer.name || 'Imagen de producto en oferta'}
            fill
            className="object-contain p-4 transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            priority={priority}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Package className="h-14 w-14 text-slate-350 dark:text-slate-650" />
          </div>
        )}

        {/* Discount badge */}
        {discount > 0 && (
          <div className={cn('absolute left-3.5 top-3.5 flex items-center gap-1 rounded-full px-3 py-1 shadow-lg shadow-rose-600/10', accent.solid)}>
            <Zap className="h-3.5 w-3.5 text-white" />
            <span className="text-xs font-black text-white">-{discount}%</span>
          </div>
        )}

        {/* Featured badge */}
        {offer.featured && (
          <div className="absolute right-3.5 top-3.5 flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-1 shadow-md shadow-amber-500/15">
            <Star className="h-3 w-3 fill-white text-white" />
            <span className="text-[10px] font-bold text-white">Destacado</span>
          </div>
        )}

        {/* Stock badge */}
        {!offer.in_stock && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[1.5px] dark:bg-slate-950/40">
            <span className="rounded-full bg-slate-900/90 px-3.5 py-1.5 text-xs font-bold text-white">Sin stock</span>
          </div>
        )}
      </Link>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* Category + Brand */}
        <div className="flex items-center gap-2">
          {offer.category && (
            <Badge variant="secondary" className="rounded-full bg-slate-100/80 text-[10px] font-bold dark:bg-slate-900 dark:text-slate-450 border-0">
              {offer.category.name}
            </Badge>
          )}
          {offer.brand && (
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{offer.brand}</span>
          )}
        </div>

        {/* Name */}
        <Link href={href} className="flex-1">
          <h3 className="line-clamp-2 text-sm font-bold leading-snug text-slate-800 dark:text-slate-100 transition-colors group-hover:text-cyan-600 dark:group-hover:text-cyan-400">
            {offer.name}
          </h3>
        </Link>

        {/* Price block */}
        <div className="mt-auto flex items-end justify-between gap-2 pt-1 border-t border-slate-200/20 dark:border-slate-800/20">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 line-through dark:text-slate-500">{formatPrice(offer.sale_price)}</p>
            <p className={cn('text-lg font-black tracking-tight leading-none mt-0.5', accent.text)}>{formatPrice(offer.offer_price)}</p>
          </div>
          {offer.in_stock && (
            <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="h-3.5 w-3.5" />
              <span className="font-bold">Disponible</span>
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="flex gap-2 mt-1">
          <Button
            asChild
            size="sm"
            variant="outline"
            className={cn('flex-1 rounded-xl text-xs font-bold border-slate-200/80 bg-white/50 dark:border-slate-800 dark:bg-slate-900/40', accent.border)}
          >
            <Link href={href}>Ver detalle</Link>
          </Button>
          {commerceMode === 'cart' && (
            <Button
              size="sm"
              onClick={handleCart}
              disabled={!offer.in_stock}
              aria-label={`Agregar ${offer.name} al carrito`}
              className={cn(
                "rounded-xl transition-all shadow-sm focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-95",
                addedToCart
                  ? "bg-emerald-600 hover:bg-emerald-600 text-white shadow-emerald-600/10 focus-visible:ring-emerald-500"
                  : accent.solid
              )}
            >
              {addedToCart ? <CheckCircle className="h-4.5 w-4.5" /> : <ShoppingCart className="h-4.5 w-4.5" />}
            </Button>
          )}
          {commerceMode === 'whatsapp' && whatsappHref && (
            <Button asChild size="sm" className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-700">
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Consultar por ${offer.name} en WhatsApp`}
              >
                <MessageCircle className="h-4 w-4" />
              </a>
            </Button>
          )}
        </div>
      </div>
    </article>
  )
}

// ─── Skeleton ────────────────────────────────────────────────────────────────
// ─── Main Component ───────────────────────────────────────────────────────────
export function OffersPageClient({ initialSettings, initialOffers }: OffersPageClientProps) {
  const { settings: liveSettings } = useWebsiteSettings()
  const { tenantPrefix } = usePublicTenantPrefix()
  const pathname = usePathname()
  const tenantSlug = getTenantSlugFromPathname(pathname)
  const settings = liveSettings ?? initialSettings
  const offersSettings = settings.offers_section
  const commerceMode = settings.checkout.commerceMode ?? 'cart'
  const contactPhone =
    settings.company_info.whatsapp?.trim() ||
    settings.company_info.phone?.trim() ||
    ''
  const accent = OFFER_ACCENTS[offersSettings.accentColor] ?? OFFER_ACCENTS.rose

  // Fetch offers
  const { data: allOffers = initialOffers } = useSWR<OfferProduct[]>(
    withOrgQuery('/api/public/products?per_page=50&sort=newest&has_offer=true', tenantSlug),
    fetchOffers,
    { fallbackData: initialOffers, revalidateOnFocus: false, dedupingInterval: 60_000 }
  )

  // Filters
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'discount' | 'price_asc' | 'price_desc' | 'newest'>('discount')

  // Derived categories
  const categories = Array.from(
    new Map(
      allOffers
        .filter((o) => o.category)
        .map((o) => [o.category!.id, o.category!])
    ).values()
  )

  // Filtered + sorted offers
  const displayedOffers = allOffers
    .filter((o) => {
      const matchSearch =
        !search ||
        o.name.toLowerCase().includes(search.toLowerCase()) ||
        (o.brand?.toLowerCase().includes(search.toLowerCase()) ?? false)
      const matchCat = !selectedCategory || o.category?.id === selectedCategory
      return matchSearch && matchCat
    })
    .sort((a, b) => {
      if (sortBy === 'discount')
        return calcDiscount(b.sale_price, b.offer_price) - calcDiscount(a.sale_price, a.offer_price)
      if (sortBy === 'price_asc') return a.offer_price - b.offer_price
      if (sortBy === 'price_desc') return b.offer_price - a.offer_price
      return 0
    })

  const totalSavings = displayedOffers.reduce(
    (sum, o) => sum + Math.max(0, o.sale_price - o.offer_price),
    0
  )

  // Carrusel de destacados: se alimenta de allOffers (no de displayedOffers)
  // para que los filtros de la grilla no vacíen la banda superior.
  // El `??` no es decorativo: unos settings servidos por una versión anterior no
  // traen la clave `carousel`, y sin respaldo la página entera se caería acá.
  const carouselSettings = offersSettings.carousel ?? getWebsiteSettingsDefaults().offers_section.carousel
  const carouselAccent = CAROUSEL_ACCENTS[offersSettings.accentColor] ?? CAROUSEL_ACCENTS.rose
  const carouselSlides = toOfferSlides(allOffers, carouselSettings.maxItems)

  // ── Not enabled ─────────────────────────────────────────────────────────────
  if (!offersSettings.enabled) {
    return (
      <div className="container flex min-h-[60vh] items-center justify-center py-16 text-center">
        <div className="max-w-md rounded-3xl border border-dashed border-slate-200/80 bg-slate-50/20 px-8 py-16 dark:border-slate-800 dark:bg-slate-900/10">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-900">
            <Tag className="h-8 w-8 text-slate-400 dark:text-slate-500" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-850 dark:text-slate-150">Ofertas no disponibles</h1>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            Esta tienda no tiene activa su sección de ofertas en este momento.
          </p>
          <Button asChild className="mt-6 rounded-xl">
            <Link href={`${tenantPrefix}/productos`}>
              Ver todos los productos <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
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
          <div className="absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-black/15 blur-3xl" />
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
              <span className="text-xs font-bold uppercase tracking-widest text-white/90">
                {offersSettings.eyebrow || 'Ofertas Especiales'}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <h1 className="text-4xl font-black leading-tight tracking-tight text-white md:text-6xl">
                {offersSettings.title || 'Ofertas Imperdibles'}
              </h1>
              <p className="mt-4 text-lg text-white/80">
                {offersSettings.subtitle || 'Los mejores descuentos seleccionados para vos.'}
              </p>

              {/* Stats */}
              {allOffers.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-4">
                  <div className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 backdrop-blur-sm">
                    <TrendingDown className="h-5 w-5 text-emerald-400" />
                    <span className="text-sm font-semibold text-white">
                      {allOffers.length} productos en oferta
                    </span>
                  </div>
                  {totalSavings > 0 && (
                    <div className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 backdrop-blur-sm">
                      <Tag className="h-5 w-5 text-amber-400" />
                      <span className="text-sm font-semibold text-white">
                        Ahorrá hasta{' '}
                        {formatPrice(
                          Math.max(...allOffers.map((o) => o.sale_price - o.offer_price))
                        )}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col items-start gap-4 md:items-end">
              <p className="max-w-xs text-sm font-medium text-white/80 md:text-right">
                Los precios mostrados corresponden a ofertas activas del catálogo.
              </p>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-2xl border-white/30 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 active:scale-98"
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

      {/* ── Carrusel de destacados ───────────────────────────────────────────── */}
      {/* Mismo diseño que el carrusel del inicio público: comparten OffersCarouselDeck. */}
      {carouselSettings.enabled && carouselSlides.length > 0 && (
        <section className={cn('border-y py-14 md:py-20', carouselAccent.section)}>
          <div className="container">
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className={cn('flex items-center gap-2 text-sm font-bold uppercase tracking-[0.16em]', carouselAccent.eyebrow)}>
                  <Tag className="h-4 w-4" />
                  {offersSettings.eyebrow || 'Ofertas especiales'}
                </p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                  {carouselSettings.title}
                </h2>
                {carouselSettings.subtitle && (
                  <p className="mt-3 max-w-2xl text-muted-foreground">{carouselSettings.subtitle}</p>
                )}
              </div>
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link href={`${tenantPrefix}/productos`}>
                  Ver catálogo completo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>

            <OffersCarouselDeck
              offers={carouselSlides}
              accent={carouselAccent}
              fallbackBrand={settings.company_info.name || 'Tienda'}
              tenantPrefix={tenantPrefix}
              autoplay={carouselSettings.autoplay}
              intervalSeconds={carouselSettings.intervalSeconds}
              ariaLabel="Carrusel de ofertas destacadas"
            />
          </div>
        </section>
      )}

      {/* ── Filters & Search (Premium Glassmorphism) ─────────────────────────── */}
      <div className="sticky top-0 z-20 border-b border-slate-250/20 bg-background/80 backdrop-blur-md dark:border-slate-800/40 shadow-sm">
        <div className="container py-3.5">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <Input
                placeholder="Buscar en ofertas..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-9 rounded-xl border-slate-200/80 bg-white/80 dark:border-slate-800 dark:bg-slate-900/60 focus-visible:ring-cyan-500"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Categories */}
            <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-hide flex-1">
              <button
                onClick={() => setSelectedCategory(null)}
                className={cn(
                  'flex-shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition-all duration-200',
                  !selectedCategory
                    ? accent.solid
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800'
                )}
              >
                Todas
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                  className={cn(
                    'flex-shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition-all duration-200',
                    selectedCategory === cat.id
                      ? accent.solid
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800'
                  )}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2 rounded-xl border border-slate-200/60 bg-white/80 px-3 py-1.5 dark:border-slate-800 dark:bg-slate-900/60 shadow-sm">
              <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer pr-1"
              >
                <option value="discount" className="dark:bg-slate-900">Mayor descuento</option>
                <option value="price_asc" className="dark:bg-slate-900">Menor precio</option>
                <option value="price_desc" className="dark:bg-slate-900">Mayor precio</option>
                <option value="newest" className="dark:bg-slate-900">Más nuevo</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ── Products Grid ─────────────────────────────────────────────────────── */}
      <div className="container py-10">
        {/* Results count */}
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {displayedOffers.length === 0 ? (
              'Sin resultados'
            ) : (
              <>
                <span className="font-extrabold text-slate-800 dark:text-slate-200 tabular-nums">
                  {displayedOffers.length}
                </span>{' '}
                oferta{displayedOffers.length !== 1 ? 's' : ''} encontrada{displayedOffers.length !== 1 ? 's' : ''}
              </>
            )}
            {selectedCategory && (
              <button
                onClick={() => setSelectedCategory(null)}
                className={cn(
                  'ml-2.5 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold transition-all',
                  accent.soft
                )}
              >
                <X className="h-3 w-3" /> Limpiar filtro
              </button>
            )}
          </p>
        </div>

        {/* Empty state */}
        {displayedOffers.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50/10 py-20 text-center dark:border-slate-800">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-900">
              <Tag className="h-10 w-10 text-slate-400 dark:text-slate-500" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-250">
              {search || selectedCategory ? 'Sin coincidencias' : 'Sin ofertas activas'}
            </h2>
            <p className="mt-2 max-w-sm text-sm text-slate-500 dark:text-slate-400">
              {search || selectedCategory
                ? 'Probá con otros filtros o explorá todo el catálogo.'
                : 'Cuando activemos productos con oferta, aparecerán acá automáticamente.'}
            </p>
            <div className="mt-6 flex gap-3">
              {(search || selectedCategory) && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch('')
                    setSelectedCategory(null)
                  }}
                  className="rounded-xl font-bold"
                >
                  Limpiar filtros
                </Button>
              )}
              <Button asChild className={cn('rounded-xl font-bold', accent.solid)}>
                <Link href={`${tenantPrefix}/productos`}>
                  Ver catálogo <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        )}

        {/* Grid */}
        {displayedOffers.length > 0 && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {displayedOffers.map((offer, i) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                tenantPrefix={tenantPrefix}
                accent={accent}
                priority={i < 4}
                commerceMode={commerceMode}
                contactPhone={contactPhone}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Bottom CTA ────────────────────────────────────────────────────────── */}
      {displayedOffers.length > 0 && (
        <section className={cn('border-t border-slate-200/10 py-16', accent.bottom)}>
          <div className="container text-center max-w-lg">
            <Sparkles className={cn('mx-auto mb-3.5 h-8 w-8', accent.text)} />
            <h2 className="text-2xl font-extrabold text-slate-850 dark:text-slate-100">¿No encontraste lo que buscabas?</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Explorá nuestro catálogo completo de productos.
            </p>
            <Button asChild size="lg" className={cn('mt-6 rounded-2xl font-bold shadow-lg shadow-cyan-500/5 hover:-translate-y-0.5 transition-transform duration-200', accent.solid)}>
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
