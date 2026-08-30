'use client'

import { useMemo, useState } from 'react'
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
  Flame,
  Percent,
  Layers,
  ArrowDownNarrowWide,
  ArrowUpNarrowWide,
  Clock,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
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
import { useCartDrawer } from '@/contexts/cart-drawer-context'
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
import { PromotionalCarousel } from '@/components/public/inicio/PromotionalCarousel'

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
  created_at: string | null
}

interface OffersPageClientProps {
  initialSettings: WebsiteSettings
  initialOffers: OfferProduct[]
}

type SortKey = 'discount' | 'price_asc' | 'price_desc' | 'newest'
type DiscountFilterTier = 'all' | '30' | '20' | 'featured' | 'stock'

const PAGE_SIZE_OPTIONS = [12, 16, 24, 48]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatPrice(price: number): string {
  return formatCurrency(price)
}

function calcDiscount(sale: number, offer: number): number {
  if (sale <= 0 || offer >= sale) return 0
  return Math.round(((sale - offer) / sale) * 100)
}

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
        tag: discount > 0 ? `-${discount}% OFF` : 'Oferta activa',
        ctaHref: `/productos/${offer.id}`,
        image: offer.image || (Array.isArray(offer.images) && offer.images.length > 0 ? offer.images[0] : null),
        brand: offer.brand,
        inStock: offer.in_stock,
        offerPrice: offer.offer_price,
        salePrice: offer.sale_price,
      }
    })
}

const OFFER_ACCENTS: Record<OffersSectionSettings['accentColor'], {
  heroGlow: string
  badge: string
  badgeText: string
  text: string
  solid: string
  soft: string
  border: string
  glowCard: string
}> = {
  brand: {
    heroGlow: 'from-primary/20 via-primary/5 to-transparent',
    badge: 'border-primary/40 bg-primary/10 text-primary',
    badgeText: 'text-primary',
    text: 'text-primary',
    solid: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20',
    soft: 'bg-primary/10 text-primary hover:bg-primary/15',
    border: 'border-primary/30 hover:border-primary',
    glowCard: 'hover:shadow-primary/15',
  },
  rose: {
    heroGlow: 'from-rose-500/20 via-rose-500/5 to-transparent dark:from-rose-950/40',
    badge: 'border-rose-500/30 bg-rose-50 text-rose-700 dark:border-rose-800/50 dark:bg-rose-950/40 dark:text-rose-300',
    badgeText: 'text-rose-600 dark:text-rose-400',
    text: 'text-rose-600 dark:text-rose-400',
    solid: 'bg-rose-600 text-white hover:bg-rose-500 shadow-md shadow-rose-600/25',
    soft: 'bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300',
    border: 'border-rose-200 dark:border-rose-900/40 hover:border-rose-500/60',
    glowCard: 'hover:shadow-rose-600/10',
  },
  amber: {
    heroGlow: 'from-amber-500/20 via-amber-500/5 to-transparent dark:from-amber-950/40',
    badge: 'border-amber-500/30 bg-amber-50 text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-300',
    badgeText: 'text-amber-600 dark:text-amber-400',
    text: 'text-amber-600 dark:text-amber-400',
    solid: 'bg-amber-600 text-white hover:bg-amber-500 shadow-md shadow-amber-600/25',
    soft: 'bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-900/40 hover:border-amber-500/60',
    glowCard: 'hover:shadow-amber-600/10',
  },
  orange: {
    heroGlow: 'from-orange-500/20 via-orange-500/5 to-transparent dark:from-orange-950/40',
    badge: 'border-orange-500/30 bg-orange-50 text-orange-800 dark:border-orange-800/50 dark:bg-orange-950/40 dark:text-orange-300',
    badgeText: 'text-orange-600 dark:text-orange-400',
    text: 'text-orange-600 dark:text-orange-400',
    solid: 'bg-orange-600 text-white hover:bg-orange-500 shadow-md shadow-orange-600/25',
    soft: 'bg-orange-50 text-orange-800 hover:bg-orange-100 dark:bg-orange-950/40 dark:text-orange-300',
    border: 'border-orange-200 dark:border-orange-900/40 hover:border-orange-500/60',
    glowCard: 'hover:shadow-orange-600/10',
  },
  emerald: {
    heroGlow: 'from-emerald-500/20 via-emerald-500/5 to-transparent dark:from-emerald-950/40',
    badge: 'border-emerald-500/30 bg-emerald-50 text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-300',
    badgeText: 'text-emerald-600 dark:text-emerald-400',
    text: 'text-emerald-600 dark:text-emerald-400',
    solid: 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-md shadow-emerald-600/25',
    soft: 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-900/40 hover:border-emerald-500/60',
    glowCard: 'hover:shadow-emerald-600/10',
  },
  blue: {
    heroGlow: 'from-blue-500/20 via-blue-500/5 to-transparent dark:from-blue-950/40',
    badge: 'border-blue-500/30 bg-blue-50 text-blue-800 dark:border-blue-800/50 dark:bg-blue-950/40 dark:text-blue-300',
    badgeText: 'text-blue-600 dark:text-blue-400',
    text: 'text-blue-600 dark:text-blue-400',
    solid: 'bg-blue-600 text-white hover:bg-blue-500 shadow-md shadow-blue-600/25',
    soft: 'bg-blue-50 text-blue-800 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-900/40 hover:border-blue-500/60',
    glowCard: 'hover:shadow-blue-600/10',
  },
  sky: {
    heroGlow: 'from-sky-500/20 via-sky-500/5 to-transparent dark:from-sky-950/40',
    badge: 'border-sky-500/30 bg-sky-50 text-sky-800 dark:border-sky-800/50 dark:bg-sky-950/40 dark:text-sky-300',
    badgeText: 'text-sky-600 dark:text-sky-400',
    text: 'text-sky-600 dark:text-sky-400',
    solid: 'bg-sky-600 text-white hover:bg-sky-500 shadow-md shadow-sky-600/25',
    soft: 'bg-sky-50 text-sky-800 hover:bg-sky-100 dark:bg-sky-950/40 dark:text-sky-300',
    border: 'border-sky-200 dark:border-sky-900/40 hover:border-sky-500/60',
    glowCard: 'hover:shadow-sky-600/10',
  },
  violet: {
    heroGlow: 'from-violet-500/20 via-violet-500/5 to-transparent dark:from-violet-950/40',
    badge: 'border-violet-500/30 bg-violet-50 text-violet-800 dark:border-violet-800/50 dark:bg-violet-950/40 dark:text-violet-300',
    badgeText: 'text-violet-600 dark:text-violet-400',
    text: 'text-violet-600 dark:text-violet-400',
    solid: 'bg-violet-600 text-white hover:bg-violet-500 shadow-md shadow-violet-600/25',
    soft: 'bg-violet-50 text-violet-800 hover:bg-violet-100 dark:bg-violet-950/40 dark:text-violet-300',
    border: 'border-violet-200 dark:border-violet-900/40 hover:border-violet-500/60',
    glowCard: 'hover:shadow-violet-600/10',
  },
  fuchsia: {
    heroGlow: 'from-fuchsia-500/20 via-fuchsia-500/5 to-transparent dark:from-fuchsia-950/40',
    badge: 'border-fuchsia-500/30 bg-fuchsia-50 text-fuchsia-800 dark:border-fuchsia-800/50 dark:bg-fuchsia-950/40 dark:text-fuchsia-300',
    badgeText: 'text-fuchsia-600 dark:text-fuchsia-400',
    text: 'text-fuchsia-600 dark:text-fuchsia-400',
    solid: 'bg-fuchsia-600 text-white hover:bg-fuchsia-500 shadow-md shadow-fuchsia-600/25',
    soft: 'bg-fuchsia-50 text-fuchsia-800 hover:bg-fuchsia-100 dark:bg-fuchsia-950/40 dark:text-fuchsia-300',
    border: 'border-fuchsia-200 dark:border-fuchsia-900/40 hover:border-fuchsia-500/60',
    glowCard: 'hover:shadow-fuchsia-600/10',
  },
  red: {
    heroGlow: 'from-red-500/20 via-red-500/5 to-transparent dark:from-red-950/40',
    badge: 'border-red-500/30 bg-red-50 text-red-800 dark:border-red-800/50 dark:bg-red-950/40 dark:text-red-300',
    badgeText: 'text-red-600 dark:text-red-400',
    text: 'text-red-600 dark:text-red-400',
    solid: 'bg-red-600 text-white hover:bg-red-500 shadow-md shadow-red-600/25',
    soft: 'bg-red-50 text-red-800 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300',
    border: 'border-red-200 dark:border-red-900/40 hover:border-red-500/60',
    glowCard: 'hover:shadow-red-600/10',
  },
  teal: {
    heroGlow: 'from-teal-500/20 via-teal-500/5 to-transparent dark:from-teal-950/40',
    badge: 'border-teal-500/30 bg-teal-50 text-teal-800 dark:border-teal-800/50 dark:bg-teal-950/40 dark:text-teal-300',
    badgeText: 'text-teal-600 dark:text-teal-400',
    text: 'text-teal-600 dark:text-teal-400',
    solid: 'bg-teal-600 text-white hover:bg-teal-500 shadow-md shadow-teal-600/25',
    soft: 'bg-teal-50 text-teal-800 hover:bg-teal-100 dark:bg-teal-950/40 dark:text-teal-300',
    border: 'border-teal-200 dark:border-teal-900/40 hover:border-teal-500/60',
    glowCard: 'hover:shadow-teal-600/10',
  },
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
      created_at: p.created_at ? String(p.created_at) : null,
    }))
}

// ─── Modern Offer Card ────────────────────────────────────────────────────────
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
  const { open: openCart } = useCartDrawer()
  const [addedToCart, setAddedToCart] = useState(false)
  const discount = calcDiscount(offer.sale_price, offer.offer_price)
  const savings = Math.max(0, offer.sale_price - offer.offer_price)
  const href = `${tenantPrefix}/productos/${offer.id}`

  const whatsappHref = contactPhone
    ? getWhatsAppLink({
        phone: contactPhone,
        message: `Hola, quiero consultar por la oferta de ${offer.name} (${formatPrice(offer.offer_price)}).`,
      })
    : null

  const handleCart = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
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
    toast.success('¡Agregado al carrito!')
    setAddedToCart(true)
    setTimeout(() => setAddedToCart(false), 2000)
    openCart()
  }

  return (
    <article className={cn(
      'group relative flex flex-col overflow-hidden rounded-3xl border border-border/80 bg-card p-3 sm:p-4 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-primary/40',
      accent.glowCard
    )}>
      {/* ── Visual Media Area ── */}
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-muted/40 p-3">
        <Link href={href} className="relative block h-full w-full">
          {offer.image ? (
            <Image
              src={offer.image}
              alt={offer.name || 'Producto en oferta'}
              fill
              unoptimized
              className="object-contain transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              priority={priority}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Package className="h-12 w-12 text-muted-foreground/40" />
            </div>
          )}
        </Link>

        {/* Floating Badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5 z-10 pointer-events-none">
          {discount > 0 && (
            <span className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold shadow-sm',
              accent.solid
            )}>
              <Flame className="h-3.5 w-3.5 fill-current animate-pulse" />
              <span>-{discount}%</span>
            </span>
          )}

          {savings > 0 && (
            <span className="inline-flex items-center rounded-full bg-emerald-500/90 backdrop-blur-xs px-2 py-0.5 text-[10px] font-extrabold text-white shadow-xs">
              Ahorrás {formatPrice(savings)}
            </span>
          )}
        </div>

        {/* Featured Star Pill */}
        {offer.featured && (
          <div className="absolute top-2.5 right-2.5 z-10 pointer-events-none">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
              <Star className="h-3 w-3 fill-white" />
              <span>Destacado</span>
            </span>
          </div>
        )}

        {/* Out of Stock Overlay */}
        {!offer.in_stock && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/70 backdrop-blur-[2px]">
            <span className="rounded-full bg-slate-900/90 px-3.5 py-1.5 text-xs font-bold text-white shadow-md">
              Sin stock
            </span>
          </div>
        )}
      </div>

      {/* ── Content & Pricing Area ── */}
      <div className="mt-3 flex flex-1 flex-col justify-between space-y-2">
        {/* Brand & Category tags */}
        <div className="flex items-center justify-between gap-2">
          {offer.brand ? (
            <span className="truncate text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {offer.brand}
            </span>
          ) : (
            <span className="text-[10px] font-semibold text-muted-foreground">Oferta Especial</span>
          )}

          {offer.category && (
            <span className="truncate rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {offer.category.name}
            </span>
          )}
        </div>

        {/* Title */}
        <Link href={href} className="group-hover:text-primary transition-colors">
          <h3 className="line-clamp-2 text-xs sm:text-sm font-bold leading-snug text-foreground" title={offer.name}>
            {offer.name}
          </h3>
        </Link>

        {/* Price Block */}
        <div className="pt-2 border-t border-border/50">
          <div className="flex items-baseline gap-2">
            <p className="text-base sm:text-xl font-extrabold tracking-tight tabular-nums text-foreground">
              {formatPrice(offer.offer_price)}
            </p>
            {offer.sale_price > offer.offer_price && (
              <p className="text-xs font-semibold text-muted-foreground line-through tabular-nums">
                {formatPrice(offer.sale_price)}
              </p>
            )}
          </div>
        </div>

        {/* CTAs: Details + Cart / WhatsApp */}
        <div className="pt-1 flex items-center gap-2">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="flex-1 rounded-xl text-xs font-bold border-border/80 hover:bg-muted"
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
                'h-9 w-9 p-0 shrink-0 rounded-xl transition-all',
                addedToCart
                  ? 'bg-emerald-600 hover:bg-emerald-600 text-white shadow-xs'
                  : accent.solid
              )}
            >
              {addedToCart ? <CheckCircle className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
            </Button>
          )}

          {commerceMode === 'whatsapp' && whatsappHref && (
            <Button
              asChild
              size="sm"
              className="h-9 w-9 p-0 shrink-0 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs"
            >
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

// ─── Main Offers Component ────────────────────────────────────────────────────
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
  const { data: allOffers = initialOffers, error: offersError, isLoading, mutate: retryOffers } = useSWR<OfferProduct[]>(
    withOrgQuery('/api/public/products?per_page=100&sort=newest&has_offer=true', tenantSlug),
    fetchOffers,
    { fallbackData: initialOffers, revalidateOnFocus: false, dedupingInterval: 60_000 }
  )

  // Filters & State
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedTier, setSelectedTier] = useState<DiscountFilterTier>('all')
  const [sortBy, setSortBy] = useState<SortKey>('discount')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(16)

  // Derived categories
  const categories = useMemo(() => Array.from(
    new Map(
      allOffers
        .filter((offer) => offer.category)
        .map((offer) => [offer.category!.id, offer.category!])
    ).values()
  ), [allOffers])

  // Filtered + sorted offers
  const filteredOffers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return allOffers
      .filter((offer) => {
        const matchesSearch = !normalizedSearch
          || offer.name.toLowerCase().includes(normalizedSearch)
          || (offer.brand?.toLowerCase().includes(normalizedSearch) ?? false)

        const matchesCategory = !selectedCategory || offer.category?.id === selectedCategory

        const discount = calcDiscount(offer.sale_price, offer.offer_price)
        let matchesTier = true
        if (selectedTier === '30') matchesTier = discount >= 30
        else if (selectedTier === '20') matchesTier = discount >= 20
        else if (selectedTier === 'featured') matchesTier = Boolean(offer.featured)
        else if (selectedTier === 'stock') matchesTier = Boolean(offer.in_stock)

        return matchesSearch && matchesCategory && matchesTier
      })
      .sort((a, b) => {
        if (sortBy === 'discount') {
          return calcDiscount(b.sale_price, b.offer_price) - calcDiscount(a.sale_price, a.offer_price)
        }
        if (sortBy === 'price_asc') return a.offer_price - b.offer_price
        if (sortBy === 'price_desc') return b.offer_price - a.offer_price
        return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
      })
  }, [allOffers, search, selectedCategory, selectedTier, sortBy])

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredOffers.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pageStart = (safePage - 1) * pageSize
  const paginatedOffers = filteredOffers.slice(pageStart, pageStart + pageSize)

  const maxSavings = allOffers.reduce(
    (maximum, offer) => Math.max(maximum, offer.sale_price - offer.offer_price),
    0,
  )

  const maxDiscountPercent = allOffers.reduce(
    (maximum, offer) => Math.max(maximum, calcDiscount(offer.sale_price, offer.offer_price)),
    0,
  )

  const carouselSettings = offersSettings.carousel ?? getWebsiteSettingsDefaults().offers_section.carousel
  const carouselAccent = CAROUSEL_ACCENTS[offersSettings.accentColor] ?? CAROUSEL_ACCENTS.rose
  const carouselSlides = toOfferSlides(allOffers, carouselSettings.maxItems)

  const hasActiveFilters = Boolean(search || selectedCategory || selectedTier !== 'all')

  const resetAllFilters = () => {
    setSearch('')
    setSelectedCategory(null)
    setSelectedTier('all')
    setPage(1)
  }

  // ── Section Disabled ────────────────────────────────────────────────────────
  if (!offersSettings.enabled) {
    return (
      <div className="container flex min-h-[60vh] items-center justify-center py-16 text-center">
        <div className="max-w-md rounded-3xl border border-dashed border-border p-10 bg-card">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Tag className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Ofertas no disponibles</h1>
          <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Esta tienda no tiene activa su sección de ofertas en este momento.
          </p>
          <Button asChild className="mt-6 rounded-xl font-bold">
            <Link href={`${tenantPrefix}/productos`}>
              Ver todos los productos <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ── Banners Promocionales de Campaña ── */}
      <PromotionalCarousel settings={settings.offers_carousel} />

      {/* ── Hero Banner Renovado (E-Commerce High Energy) ── */}
      <section className={cn(
        'relative overflow-hidden border-b border-border/80 bg-gradient-to-b py-10 sm:py-16',
        accent.heroGlow
      )}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          
          {/* Eyebrow Pill */}
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-3.5 py-1 text-xs font-extrabold text-rose-600 dark:text-rose-400 shadow-xs">
            <Flame className="h-4 w-4 fill-current animate-pulse text-rose-600 dark:text-rose-400" />
            <span>{offersSettings.eyebrow || 'Zona de Ofertas & Descuentos'}</span>
          </div>

          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-foreground leading-[1.15]">
                {offersSettings.title || 'Ofertas Imperdibles por Tiempo Limitado'}
              </h1>
              <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
                {offersSettings.subtitle || 'Aprovechá precios especiales en productos seleccionados con stock inmediato y garantía oficial.'}
              </p>

              {/* Stat Cards */}
              {allOffers.length > 0 && (
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <div className="inline-flex items-center gap-2 rounded-2xl border border-border/80 bg-card px-3.5 py-2 shadow-xs">
                    <TrendingDown className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs font-bold text-foreground">
                      <strong className="text-emerald-600 dark:text-emerald-400">{allOffers.length}</strong> productos en oferta
                    </span>
                  </div>

                  {maxDiscountPercent > 0 && (
                    <div className="inline-flex items-center gap-2 rounded-2xl border border-border/80 bg-card px-3.5 py-2 shadow-xs">
                      <Percent className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                      <span className="text-xs font-bold text-foreground">
                        Hasta <strong className="text-rose-600 dark:text-rose-400">-{maxDiscountPercent}% OFF</strong>
                      </span>
                    </div>
                  )}

                  {maxSavings > 0 && (
                    <div className="inline-flex items-center gap-2 rounded-2xl border border-border/80 bg-card px-3.5 py-2 shadow-xs">
                      <Tag className="h-4 w-4 text-amber-500" />
                      <span className="text-xs font-bold text-foreground">
                        Ahorrá hasta <strong className="text-amber-600 dark:text-amber-400">{formatPrice(maxSavings)}</strong>
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Catálogo completo link */}
            <div className="flex items-center gap-3">
              <Button asChild variant="outline" className="rounded-xl border-border bg-card font-bold shadow-xs gap-2">
                <Link href={`${tenantPrefix}/productos`}>
                  <span>Ver catálogo regular</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

        </div>
      </section>

      {/* ── Carrusel de Destacados Top Deals (Destacados de la semana) ── */}
      {carouselSettings.enabled && carouselSlides.length > 0 && (
        <section className={cn('relative overflow-hidden border-b py-8 sm:py-12 bg-muted/20', carouselAccent.section)}>
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-0.5 text-xs font-extrabold text-amber-600 dark:text-amber-400 shadow-2xs">
                  <Flame className="h-3.5 w-3.5 fill-current animate-pulse text-amber-500" />
                  <span>Selección Especial</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                  {carouselSettings.title || 'Destacados de la semana'}
                </h2>
                {carouselSettings.subtitle && (
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {carouselSettings.subtitle}
                  </p>
                )}
              </div>
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

      {/* ── Toolbar Sticky de Búsqueda y Filtros Rápidos ── */}
      <div className="sticky top-16 z-30 border-b border-border/80 bg-background/95 backdrop-blur-xl shadow-xs">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 space-y-2.5">
          
          {/* Fila 1: Buscador + Tiers Rápidos + Ordenador */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            
            {/* Buscador de ofertas */}
            <div className="relative flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Buscar productos en oferta"
                placeholder="Buscar por producto o marca en oferta..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                className="h-10 rounded-xl border-border/80 bg-card pl-10 pr-9 text-xs sm:text-sm focus-visible:ring-primary shadow-2xs"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('')
                    setPage(1)
                  }}
                  aria-label="Limpiar búsqueda"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Quick Tier Chips & Sort */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              
              {/* Tiers de Descuento */}
              <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/80 shrink-0">
                <button
                  type="button"
                  onClick={() => { setSelectedTier('all'); setPage(1); }}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-bold transition-all',
                    selectedTier === 'all'
                      ? 'bg-background text-foreground shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Todas
                </button>

                <button
                  type="button"
                  onClick={() => { setSelectedTier('30'); setPage(1); }}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all',
                    selectedTier === '30'
                      ? 'bg-rose-500 text-white shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Flame className="h-3 w-3 fill-current" />
                  <span>≥30% OFF</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setSelectedTier('20'); setPage(1); }}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all',
                    selectedTier === '20'
                      ? 'bg-amber-500 text-white shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Zap className="h-3 w-3 fill-current" />
                  <span>≥20% OFF</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setSelectedTier('featured'); setPage(1); }}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all',
                    selectedTier === 'featured'
                      ? 'bg-primary text-primary-foreground shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Star className="h-3 w-3" />
                  <span>Top</span>
                </button>
              </div>

              {/* Ordenador */}
              <div className="flex items-center gap-1.5 rounded-xl border border-border/80 bg-card px-2.5 h-10 shrink-0 shadow-2xs">
                <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <select
                  aria-label="Ordenar ofertas"
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value as SortKey)
                    setPage(1)
                  }}
                  className="bg-transparent text-xs font-bold text-foreground outline-none cursor-pointer pr-1"
                >
                  <option value="discount" className="bg-background text-foreground">Mayor descuento (%)</option>
                  <option value="price_asc" className="bg-background text-foreground">Menor precio</option>
                  <option value="price_desc" className="bg-background text-foreground">Mayor precio</option>
                  <option value="newest" className="bg-background text-foreground">Más recientes</option>
                </select>
              </div>

            </div>

          </div>

          {/* Fila 2: Chips de Categorías */}
          {categories.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
              <span className="text-[11px] font-bold text-muted-foreground shrink-0 uppercase tracking-wider pr-1">
                Rubros:
              </span>

              <button
                type="button"
                onClick={() => { setSelectedCategory(null); setPage(1); }}
                className={cn(
                  'px-3 py-1 rounded-lg font-bold shrink-0 transition-all text-xs',
                  !selectedCategory
                    ? 'bg-primary text-primary-foreground shadow-2xs'
                    : 'bg-muted/70 text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                Todos
              </button>

              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(selectedCategory === cat.id ? null : cat.id)
                    setPage(1)
                  }}
                  className={cn(
                    'px-3 py-1 rounded-lg font-bold shrink-0 transition-all text-xs',
                    selectedCategory === cat.id
                      ? 'bg-primary text-primary-foreground shadow-2xs'
                      : 'bg-muted/70 text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}

        </div>
      </div>

      {/* ── Grilla de Ofertas & Resultados ── */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        
        {/* Error Alert */}
        {offersError && (
          <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs sm:text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100" role="alert">
            <p>No pudimos sincronizar las últimas ofertas en vivo. Podés seguir explorando los productos guardados.</p>
            <Button type="button" variant="outline" size="sm" onClick={() => retryOffers()} className="shrink-0 rounded-xl font-bold">
              Reintentar
            </Button>
          </div>
        )}

        {/* Resumen Superior */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-semibold text-muted-foreground">
              {filteredOffers.length === 0 ? (
                'Sin coincidencias'
              ) : (
                <>
                  Mostrando <strong className="text-foreground">{filteredOffers.length > 0 ? pageStart + 1 : 0} - {Math.min(pageStart + pageSize, filteredOffers.length)}</strong> de{' '}
                  <strong className="text-foreground">{filteredOffers.length}</strong> ofertas
                </>
              )}
            </span>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="inline-flex items-center gap-1 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 px-2 py-1 text-xs font-bold hover:bg-rose-500/20 transition-colors"
              >
                <X className="h-3 w-3" />
                <span>Limpiar filtros</span>
              </button>
            )}
          </div>

          {/* Selector de Tamaño de Página */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-muted-foreground">Ver:</span>
            <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-border/80">
              {PAGE_SIZE_OPTIONS.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => {
                    setPageSize(size)
                    setPage(1)
                  }}
                  className={cn(
                    'px-2 py-0.5 rounded-md text-[11px] font-bold transition-all',
                    pageSize === size
                      ? 'bg-background text-foreground shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Loading Skeletons */}
        {isLoading && initialOffers.length === 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 sm:gap-5" aria-label="Cargando ofertas">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((item) => (
              <div key={item} className="h-80 animate-pulse rounded-3xl border border-border/80 bg-muted/40" />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !offersError && filteredOffers.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card p-12 text-center max-w-md mx-auto">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <Flame className="h-8 w-8 text-rose-500" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-foreground">
              {hasActiveFilters ? 'Sin ofertas con estos filtros' : 'Sin ofertas activas'}
            </h2>
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
              {hasActiveFilters
                ? 'Probá ajustando el porcentaje de descuento o los términos de búsqueda.'
                : 'En este momento no hay productos con precio de liquidación activo.'}
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5 justify-center">
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  onClick={resetAllFilters}
                  className="rounded-xl font-bold text-xs"
                >
                  Limpiar filtros
                </Button>
              )}
              <Button asChild className="rounded-xl font-bold text-xs">
                <Link href={`${tenantPrefix}/productos`}>
                  Ver todos los productos <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        )}

        {/* Products Grid */}
        {paginatedOffers.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 sm:gap-5">
            {paginatedOffers.map((offer, i) => (
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

        {/* ── Paginación de Ofertas ── */}
        {totalPages > 1 && (
          <div className="mt-10 pt-6 border-t border-border/60 flex items-center justify-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={() => {
                setPage(Math.max(1, safePage - 1))
                window.scrollTo({ top: 400, behavior: 'smooth' })
              }}
              disabled={safePage === 1}
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
              <Button
                key={pageNum}
                variant={safePage === pageNum ? 'default' : 'ghost'}
                size="sm"
                onClick={() => {
                  setPage(pageNum)
                  window.scrollTo({ top: 400, behavior: 'smooth' })
                }}
                className={cn(
                  'h-8 min-w-8 px-2 rounded-lg text-xs font-semibold',
                  safePage === pageNum
                    ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {pageNum}
              </Button>
            ))}

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={() => {
                setPage(Math.min(totalPages, safePage + 1))
                window.scrollTo({ top: 400, behavior: 'smooth' })
              }}
              disabled={safePage === totalPages}
              aria-label="Página siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

      </div>

      {/* ── Bottom CTA ── */}
      {filteredOffers.length > 0 && (
        <section className="border-t border-border/80 bg-muted/30 py-14 sm:py-20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-xl">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
              <Sparkles className="h-6 w-6" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
              ¿Buscás otros modelos o novedades?
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Explorá nuestro catálogo completo con cientos de productos, novedades y formas de pago personalizadas.
            </p>
            <Button asChild size="lg" className="mt-6 rounded-xl font-bold shadow-md shadow-primary/20 gap-2">
              <Link href={`${tenantPrefix}/productos`}>
                <span>Explorar todo el catálogo</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      )}
    </div>
  )
}
