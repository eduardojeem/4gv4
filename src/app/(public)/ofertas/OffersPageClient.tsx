'use client'

import { useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  ArrowRight,
  ArrowUpDown,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  Flame,
  MessageCircle,
  Package,
  Search,
  ShoppingCart,
  Sparkles,
  Tag,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import useSWR from 'swr'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useStorefrontStyle } from '@/components/public/storefront-style-context'
import {
  OFFER_ACCENTS as CAROUSEL_ACCENTS,
  OffersCarouselDeck,
  type OfferSlide,
} from '@/components/public/offers/OffersCarouselDeck'
import { PromotionalCarousel } from '@/components/public/inicio/PromotionalCarousel'
import { useWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { usePublicCart } from '@/hooks/use-public-cart'
import { formatCurrency } from '@/lib/currency'
import { usePublicTenantPrefix } from '@/lib/public/tenant-client'
import { getTenantSlugFromPathname, withOrgQuery } from '@/lib/saas/tenant'
import { cn } from '@/lib/utils'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import { usesPortraitMedia } from '@/lib/website/storefront-style'
import { getWhatsAppLink } from '@/lib/whatsapp'
import { OfferDetailModal, type OfferDetailProduct } from '@/components/public/offers/OfferDetailModal'
import type { PublicProduct } from '@/types/public'
import type { OffersSectionSettings, PublicCommerceMode, WebsiteSettings } from '@/types/website-settings'

// ─── Types ────────────────────────────────────────────────────────────────────

/** El detalle vive en el modal compartido; la pagina usa la misma forma. */
type OfferProduct = OfferDetailProduct

interface OffersPageClientProps {
  initialSettings: WebsiteSettings
  initialOffers: OfferProduct[]
}

type SortKey = 'discount' | 'price_asc' | 'price_desc' | 'newest'
type OfferTier = 'all' | '30' | '20' | 'featured' | 'stock'
type QuickTier = Exclude<OfferTier, 'all'>

const PAGE_SIZE = 24

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'discount', label: 'Mayor descuento' },
  { value: 'price_asc', label: 'Menor precio' },
  { value: 'price_desc', label: 'Mayor precio' },
  { value: 'newest', label: 'Más recientes' },
]

const TIER_LABELS: Record<QuickTier, string> = {
  '30': '30% o más',
  '20': '20% o más',
  featured: 'Destacadas',
  stock: 'Con stock',
}

/**
 * Colores del acento que elige el dueño. La etiqueta de descuento lleva texto
 * chico, por eso los fondos son lo bastante oscuros para contraste AA.
 */
const OFFER_ACCENTS: Record<OffersSectionSettings['accentColor'], { text: string; badge: string }> = {
  brand: { text: 'text-primary', badge: 'bg-primary text-primary-foreground' },
  rose: { text: 'text-rose-600 dark:text-rose-400', badge: 'bg-rose-600 text-white' },
  amber: { text: 'text-amber-700 dark:text-amber-400', badge: 'bg-amber-400 text-amber-950' },
  orange: { text: 'text-orange-700 dark:text-orange-400', badge: 'bg-orange-700 text-white' },
  emerald: { text: 'text-emerald-700 dark:text-emerald-400', badge: 'bg-emerald-700 text-white' },
  blue: { text: 'text-blue-600 dark:text-blue-400', badge: 'bg-blue-600 text-white' },
  sky: { text: 'text-sky-700 dark:text-sky-400', badge: 'bg-sky-700 text-white' },
  violet: { text: 'text-violet-600 dark:text-violet-400', badge: 'bg-violet-600 text-white' },
  fuchsia: { text: 'text-fuchsia-700 dark:text-fuchsia-400', badge: 'bg-fuchsia-700 text-white' },
  red: { text: 'text-red-600 dark:text-red-400', badge: 'bg-red-600 text-white' },
  teal: { text: 'text-teal-700 dark:text-teal-400', badge: 'bg-teal-700 text-white' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatPrice(price: number): string {
  return formatCurrency(price)
}

function calcDiscount(sale: number, offer: number): number {
  if (sale <= 0 || offer >= sale) return 0
  return Math.round(((sale - offer) / sale) * 100)
}

function matchesTier(offer: OfferProduct, tier: OfferTier) {
  if (tier === '30') return calcDiscount(offer.sale_price, offer.offer_price) >= 30
  if (tier === '20') return calcDiscount(offer.sale_price, offer.offer_price) >= 20
  if (tier === 'featured') return offer.featured
  if (tier === 'stock') return offer.in_stock
  return true
}

/**
 * Filtros rapidos que vale la pena ofrecer: los que dejan algo y no dejan todo.
 * Un chip que da cero resultados, o el mismo listado que «Todas» o que el tramo
 * anterior, solo agrega ruido.
 */
export function availableOfferTiers(offers: OfferProduct[]): QuickTier[] {
  const total = offers.length
  const count = (tier: OfferTier) => offers.filter((offer) => matchesTier(offer, tier)).length
  const useful = (n: number) => n > 0 && n < total
  const over30 = count('30')
  const over20 = count('20')
  const tiers: QuickTier[] = []
  if (useful(over30)) tiers.push('30')
  if (useful(over20) && over20 !== over30) tiers.push('20')
  if (useful(count('featured'))) tiers.push('featured')
  if (useful(count('stock'))) tiers.push('stock')
  return tiers
}

/** Numeros de pagina con «…» cuando hay muchas: 1 … 5 6 7 … 12. */
export function paginationItems(current: number, total: number): Array<number | 'gap'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  const items: Array<number | 'gap'> = [1]
  if (start > 2) items.push('gap')
  for (let p = start; p <= end; p++) items.push(p)
  if (end < total - 1) items.push('gap')
  items.push(total)
  return items
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
        product: offer,
      }
    })
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
      // Variantes
      has_variants: Boolean(p.has_variants),
      variant_attribute_config: Array.isArray(p.variant_attribute_config) ? p.variant_attribute_config : undefined,
      variants: Array.isArray(p.variants)
        ? (p.variants as Array<Record<string, unknown>>)
            .filter((v) => Boolean(v.is_active))
            .map((v) => ({
              id: String(v.id),
              product_id: String(v.product_id),
              variant_name: String(v.variant_name ?? ''),
              attributes: (v.attributes && typeof v.attributes === 'object' && !Array.isArray(v.attributes))
                ? (v.attributes as Record<string, string>)
                : {},
              sku: v.sku ? String(v.sku) : null,
              sale_price: Number(v.sale_price ?? 0),
              offer_price: v.offer_price == null ? null : Number(v.offer_price),
              stock_quantity: Number(v.stock_quantity ?? 0),
              is_active: Boolean(v.is_active),
            }))
        : undefined,
    }))
}

// ─── Filter chip ──────────────────────────────────────────────────────────────
function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 shrink-0 items-center rounded-full border px-3.5 text-sm font-medium transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        active
          ? 'border-amber-500 bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm shadow-amber-500/25'
          : 'border-border/70 bg-background text-foreground/75 hover:border-amber-500/40 hover:bg-amber-500/5 hover:text-foreground'
      )}
    >
      {children}
    </button>
  )
}

// ─── Offer card ───────────────────────────────────────────────────────────────
function OfferCard({
  offer,
  tenantPrefix,
  accent,
  priority,
  commerceMode,
  contactPhone,
  portrait,
  onOpenDetail,
}: {
  offer: OfferProduct
  tenantPrefix: string
  accent: (typeof OFFER_ACCENTS)[OffersSectionSettings['accentColor']]
  priority?: boolean
  commerceMode: PublicCommerceMode
  contactPhone: string
  portrait: boolean
  onOpenDetail?: (offer: OfferProduct) => void
}) {
  const { addProduct } = usePublicCart()
  const [addedToCart, setAddedToCart] = useState(false)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const discount = calcDiscount(offer.sale_price, offer.offer_price)
  const savings = Math.max(0, offer.sale_price - offer.offer_price)
  const href = `${tenantPrefix}/productos/${offer.id}`
  // En Moda y Deportivo la foto va vertical y a sangre; sin foto, el icono entero.
  const coverImage = portrait && Boolean(offer.image)

  const openDetail = () => {
    if (onOpenDetail) {
      onOpenDetail(offer)
    } else {
      setDetailModalOpen(true)
    }
  }

  const whatsappHref =
    commerceMode === 'whatsapp' && contactPhone
      ? getWhatsAppLink({
          phone: contactPhone,
          message: `Hola, quiero consultar por la oferta de ${offer.name} (${formatPrice(offer.offer_price)}).`,
        })
      : null

  const handleCart = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!offer.in_stock) return
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
  }

  return (
    <>
      <article
        className={cn(
          'group relative flex flex-col overflow-hidden rounded-2xl border transition-all duration-300',
          'bg-card p-2.5 sm:p-3',
          'border-amber-500/25 dark:border-amber-400/20 shadow-xs',
          'hover:-translate-y-1 hover:border-amber-500/55 hover:shadow-lg hover:shadow-amber-500/10 dark:hover:border-amber-400/45 dark:hover:shadow-amber-500/5',
          !offer.in_stock && 'opacity-60 grayscale-[25%]'
        )}
      >
        {/* Imagen del producto — clic abre el modal de detalle */}
        <div className="relative">
          <button
            type="button"
            onClick={openDetail}
            aria-label={`Ver detalle de ${offer.name}`}
            className={cn(
              'relative block w-full overflow-hidden rounded-xl bg-muted/40 cursor-pointer',
              coverImage ? 'aspect-[3/4]' : 'aspect-square'
            )}
          >
            {offer.image ? (
              <Image
                src={offer.image}
                alt={offer.name}
                fill
                unoptimized
                priority={priority}
                sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
                className={cn(
                  'motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-[1.04]',
                  coverImage ? 'object-cover' : 'object-contain p-3',
                  !offer.in_stock && 'opacity-60 grayscale'
                )}
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center">
                <Package className="h-10 w-10 text-muted-foreground/40" />
              </span>
            )}

            {/* Badges superiores sobre imagen */}
            <div className="absolute left-2.5 top-2.5 z-10 flex flex-col gap-1 pointer-events-none">
              {discount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-rose-500 to-amber-500 px-2.5 py-0.5 text-xs font-extrabold text-white shadow-sm tabular-nums">
                  <Flame className="h-3 w-3 fill-white animate-pulse" />
                  -{discount}%
                </span>
              )}
              {offer.featured && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                  <Sparkles className="h-2.5 w-2.5 fill-white" />
                  Top
                </span>
              )}
            </div>

            {!offer.in_stock && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[1px] z-10">
                <span className="rounded-full bg-destructive/90 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-destructive-foreground shadow-xs">
                  Agotado
                </span>
              </div>
            )}

            {/* Hover overlay hint */}
            <span className="absolute inset-0 flex items-end justify-center pb-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-20">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1.5 text-[11px] font-semibold text-foreground shadow backdrop-blur-sm border border-border/60">
                <Eye className="h-3 w-3" />
                Ver detalle
              </span>
            </span>
          </button>
        </div>

        {/* Información y precios */}
        <div className="mt-2.5 flex flex-1 flex-col">
          {offer.brand && (
            <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {offer.brand}
            </p>
          )}

          <h3 className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug text-foreground">
            <Link
              href={href}
              className="rounded-sm hover:underline hover:underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {offer.name}
            </Link>
          </h3>

          <div className="mt-2 flex flex-wrap items-baseline gap-x-2">
            <span className="text-base font-bold tabular-nums text-foreground sm:text-lg">
              {formatPrice(offer.offer_price)}
            </span>
            {offer.sale_price > offer.offer_price && (
              <del className="text-xs tabular-nums text-muted-foreground font-medium">
                {formatPrice(offer.sale_price)}
              </del>
            )}
          </div>

          <p className={cn('mt-0.5 text-xs font-semibold', offer.in_stock ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground')}>
            {offer.in_stock ? `Ahorrás ${formatPrice(savings)}` : 'Sin stock'}
            {discount > 0 && <span className="sr-only"> · {discount}% de descuento</span>}
          </p>

          <div className="mt-auto pt-3 flex items-center gap-1.5">
            {commerceMode === 'cart' ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCart}
                disabled={!offer.in_stock}
                aria-label={`Agregar ${offer.name} al carrito`}
                className="h-9 flex-1 gap-2 rounded-xl border-amber-500/30 hover:border-amber-500/60 hover:bg-amber-500/5 font-semibold text-xs"
              >
                {addedToCart ? (
                  <CheckCircle aria-hidden="true" className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <ShoppingCart aria-hidden="true" className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                )}
                {addedToCart ? 'Agregado' : 'Agregar'}
              </Button>
            ) : whatsappHref ? (
              <Button asChild variant="outline" size="sm" className="h-9 flex-1 gap-2 rounded-xl border-emerald-500/30 hover:border-emerald-500 hover:bg-emerald-500/5 font-semibold text-xs">
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Consultar por ${offer.name} en WhatsApp`}
                >
                  <MessageCircle aria-hidden="true" className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Consultar
                </a>
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={openDetail}
                className="h-9 flex-1 rounded-xl font-semibold text-xs"
                aria-label={`Ver detalle de ${offer.name}`}
              >
                Ver detalle
              </Button>
            )}

            {/* Ver detalle completo — enlace a la página del producto */}
            <Button asChild variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-xl text-muted-foreground hover:text-foreground" title="Ver página completa del producto">
              <Link href={href} aria-label={`Ver página completa de ${offer.name}`}>
                <Eye className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </article>

      {/* Modal individual en caso de no usar handler compartido */}
      {!onOpenDetail && (
        <OfferDetailModal
          offer={offer}
          isOpen={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
          tenantPrefix={tenantPrefix}
          commerceMode={commerceMode}
          contactPhone={contactPhone}
        />
      )}
    </>
  )
}

// ─── Main Offers Component ────────────────────────────────────────────────────
export function OffersPageClient({ initialSettings, initialOffers }: OffersPageClientProps) {
  const { settings: liveSettings } = useWebsiteSettings()
  const { tenantPrefix } = usePublicTenantPrefix()
  const pathname = usePathname()
  const tenantSlug = getTenantSlugFromPathname(pathname)
  const portrait = usesPortraitMedia(useStorefrontStyle())
  const settings = liveSettings ?? initialSettings
  const offersSettings = settings.offers_section
  const commerceMode = settings.checkout.commerceMode ?? 'cart'
  const contactPhone =
    settings.company_info.whatsapp?.trim() ||
    settings.company_info.phone?.trim() ||
    ''
  const accent = OFFER_ACCENTS[offersSettings.accentColor] ?? OFFER_ACCENTS.rose
  const resultsRef = useRef<HTMLDivElement>(null)

  const { data: allOffers = initialOffers, error: offersError, isLoading, mutate: retryOffers } = useSWR<OfferProduct[]>(
    withOrgQuery('/api/public/products?per_page=100&sort=newest&has_offer=true', tenantSlug),
    fetchOffers,
    { fallbackData: initialOffers, revalidateOnFocus: false, dedupingInterval: 60_000 }
  )

  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedTier, setSelectedTier] = useState<OfferTier>('all')
  const [sortBy, setSortBy] = useState<SortKey>('discount')
  const [page, setPage] = useState(1)

  const categories = useMemo(() => Array.from(
    new Map(
      allOffers
        .filter((offer) => offer.category)
        .map((offer) => [offer.category!.id, offer.category!])
    ).values()
  ), [allOffers])

  const quickTiers = useMemo(() => availableOfferTiers(allOffers), [allOffers])

  const filteredOffers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return allOffers
      .filter((offer) => {
        const matchesSearch = !normalizedSearch
          || offer.name.toLowerCase().includes(normalizedSearch)
          || (offer.brand?.toLowerCase().includes(normalizedSearch) ?? false)
        const matchesCategory = !selectedCategory || offer.category?.id === selectedCategory
        return matchesSearch && matchesCategory && matchesTier(offer, selectedTier)
      })
      .sort((a, b) => {
        // Agotados siempre al final, cualquiera sea el criterio de orden
        const stockDiff = (a.in_stock ? 0 : 1) - (b.in_stock ? 0 : 1)
        if (stockDiff !== 0) return stockDiff

        if (sortBy === 'discount') {
          return calcDiscount(b.sale_price, b.offer_price) - calcDiscount(a.sale_price, a.offer_price)
        }
        if (sortBy === 'price_asc') return a.offer_price - b.offer_price
        if (sortBy === 'price_desc') return b.offer_price - a.offer_price
        return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
      })
  }, [allOffers, search, selectedCategory, selectedTier, sortBy])

  const totalPages = Math.max(1, Math.ceil(filteredOffers.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageStart = (safePage - 1) * PAGE_SIZE
  const paginatedOffers = filteredOffers.slice(pageStart, pageStart + PAGE_SIZE)

  const maxSavings = allOffers.reduce((maximum, offer) => Math.max(maximum, offer.sale_price - offer.offer_price), 0)
  const maxDiscountPercent = allOffers.reduce(
    (maximum, offer) => Math.max(maximum, calcDiscount(offer.sale_price, offer.offer_price)),
    0,
  )

  const carouselSettings = offersSettings.carousel ?? getWebsiteSettingsDefaults().offers_section.carousel
  const carouselAccent = CAROUSEL_ACCENTS[offersSettings.accentColor] ?? CAROUSEL_ACCENTS.rose
  const carouselSlides = toOfferSlides(allOffers, carouselSettings.maxItems)

  const hasActiveFilters = Boolean(search || selectedCategory || selectedTier !== 'all')
  const showInitialSkeleton = isLoading && initialOffers.length === 0
  const resultSummary = [
    filteredOffers.length === 1 ? '1 oferta' : `${filteredOffers.length} ofertas`,
    hasActiveFilters && filteredOffers.length !== allOffers.length ? ` de ${allOffers.length}` : '',
    totalPages > 1 ? ` · página ${safePage} de ${totalPages}` : '',
  ].join('')

  const updateFilters = (apply: () => void) => {
    apply()
    setPage(1)
  }

  const resetAllFilters = () => {
    setSearch('')
    setSelectedCategory(null)
    setSelectedTier('all')
    setPage(1)
  }

  const goToPage = (next: number) => {
    setPage(Math.min(Math.max(1, next), totalPages))
    const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    resultsRef.current?.scrollIntoView?.({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
  }

  // ── Section Disabled ────────────────────────────────────────────────────────
  if (!offersSettings.enabled) {
    return (
      <div className="container mx-auto flex min-h-[60vh] items-center justify-center px-4 py-16 text-center">
        <div className="max-w-sm">
          <Tag aria-hidden="true" className="mx-auto h-8 w-8 text-muted-foreground" />
          <h1 className="mt-4 text-xl font-semibold text-foreground">Ofertas no disponibles</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Esta tienda no tiene activa su sección de ofertas en este momento.
          </p>
          <Button asChild className="mt-6 gap-2">
            <Link href={`${tenantPrefix}/productos`}>
              Ver todos los productos
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ── Banners de campaña configurados en Sitio Web ── */}
      <PromotionalCarousel settings={settings.offers_carousel} />

      {/* ── Encabezado ── */}
      <section className="border-b border-border/70">
        <div className="container mx-auto flex flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10 lg:flex-row lg:items-end lg:justify-between lg:px-8">
          <div className="max-w-2xl">
            <p className={cn('text-sm font-medium', accent.text)}>{offersSettings.eyebrow || 'Ofertas'}</p>
            <h1 className="mt-1.5 text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {offersSettings.title || 'Precios especiales'}
            </h1>
            {offersSettings.subtitle && (
              <p className="mt-2 text-pretty text-sm text-muted-foreground sm:text-base">{offersSettings.subtitle}</p>
            )}
          </div>

          {allOffers.length > 0 && (
            <dl className="grid shrink-0 grid-cols-3 divide-x divide-border/70 rounded-xl border border-border/70 text-center">
              <div className="px-4 py-3 sm:px-5">
                <dt className="text-xs text-muted-foreground">En oferta</dt>
                <dd className="mt-0.5 text-base font-semibold tabular-nums text-foreground sm:text-lg">{allOffers.length}</dd>
              </div>
              <div className="px-4 py-3 sm:px-5">
                <dt className="text-xs text-muted-foreground">Descuento</dt>
                <dd className={cn('mt-0.5 text-base font-semibold tabular-nums sm:text-lg', accent.text)}>
                  hasta -{maxDiscountPercent}%
                </dd>
              </div>
              <div className="px-4 py-3 sm:px-5">
                <dt className="text-xs text-muted-foreground">Ahorro</dt>
                <dd className="mt-0.5 text-base font-semibold tabular-nums text-foreground sm:text-lg">
                  hasta {formatPrice(maxSavings)}
                </dd>
              </div>
            </dl>
          )}
        </div>
      </section>

      {/* ── Destacados ── */}
      {carouselSettings.enabled && carouselSlides.length > 0 && (
        <section className={cn('border-b border-border/70 bg-muted/30 py-8 sm:py-10', carouselAccent.section)}>
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-5">
              <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {carouselSettings.title || 'Destacados de la semana'}
              </h2>
              {carouselSettings.subtitle && (
                <p className="mt-1 text-sm text-muted-foreground">{carouselSettings.subtitle}</p>
              )}
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

      {/* ── Listado ── */}
      <div ref={resultsRef} className="container mx-auto scroll-mt-32 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        {allOffers.length > 0 && (
          <>
            {/* ── Panel de filtros ── */}
            <div className="rounded-2xl border border-amber-500/20 bg-card/80 p-3.5 shadow-sm backdrop-blur-sm sm:p-4">
              {/* Fila superior: búsqueda + orden */}
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                {/* Buscador */}
                <div className="relative flex-1 sm:max-w-sm">
                  <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-500/70" />
                  <Input
                    aria-label="Buscar en ofertas"
                    placeholder="Buscar por producto o marca…"
                    enterKeyHint="search"
                    value={search}
                    onChange={(e) => updateFilters(() => setSearch(e.target.value))}
                    className="h-10 rounded-xl border-amber-500/25 pl-9 pr-9 focus-visible:border-amber-500/60 focus-visible:ring-amber-500/20"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => updateFilters(() => setSearch(''))}
                      aria-label="Limpiar búsqueda"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <X aria-hidden="true" className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Ordenar */}
                <div className="flex items-center gap-2 sm:ml-auto">
                  <ArrowUpDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="shrink-0 text-xs font-medium text-foreground/70">Ordenar</span>
                    <select
                      value={sortBy}
                      onChange={(e) => updateFilters(() => setSortBy(e.target.value as SortKey))}
                      className="h-9 min-w-0 flex-1 cursor-pointer rounded-xl border border-amber-500/25 bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 sm:flex-none"
                    >
                      {SORT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              {/* Chips de filtro */}
              {(quickTiers.length > 0 || categories.length > 1) && (
                <div role="group" aria-label="Filtros" className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap">
                  <FilterChip
                    active={selectedTier === 'all' && !selectedCategory}
                    onClick={() => updateFilters(() => {
                      setSelectedTier('all')
                      setSelectedCategory(null)
                    })}
                  >
                    ✦ Todas
                  </FilterChip>
                  {quickTiers.map((tier) => (
                    <FilterChip
                      key={tier}
                      active={selectedTier === tier}
                      onClick={() => updateFilters(() => setSelectedTier(selectedTier === tier ? 'all' : tier))}
                    >
                      {TIER_LABELS[tier]}
                    </FilterChip>
                  ))}
                  {quickTiers.length > 0 && categories.length > 1 && (
                    <span aria-hidden="true" className="mx-1 w-px shrink-0 self-stretch bg-border" />
                  )}
                  {categories.length > 1 && categories.map((category) => (
                    <FilterChip
                      key={category.id}
                      active={selectedCategory === category.id}
                      onClick={() => updateFilters(() => setSelectedCategory(selectedCategory === category.id ? null : category.id))}
                    >
                      {category.name}
                    </FilterChip>
                  ))}
                </div>
              )}
            </div>

            {/* Barra de resultados */}
            <div className="mt-4 flex min-h-8 items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground" aria-live="polite">{resultSummary}</p>
              {hasActiveFilters && (
                <Button type="button" variant="ghost" size="sm" onClick={resetAllFilters} className="h-8 gap-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 dark:text-amber-400 dark:hover:text-amber-300">
                  <X aria-hidden="true" className="h-3.5 w-3.5" />
                  Limpiar filtros
                </Button>
              )}
            </div>
          </>
        )}

        {offersError && (
          <div
            role="alert"
            className="mt-4 flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100"
          >
            <p>No pudimos actualizar las ofertas. Te mostramos las últimas que cargamos.</p>
            <Button type="button" variant="outline" size="sm" onClick={() => retryOffers()} className="shrink-0">
              Reintentar
            </Button>
          </div>
        )}

        {showInitialSkeleton && (
          <div aria-busy="true" aria-label="Cargando ofertas" className="mt-4 grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, item) => (
              <div key={item} className="space-y-3">
                <div className="aspect-square animate-pulse rounded-xl bg-muted" />
                <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                <div className="h-5 w-1/2 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        )}

        {!showInitialSkeleton && filteredOffers.length === 0 && (
          <div role="status" className="mx-auto mt-6 flex max-w-md flex-col items-center rounded-xl border border-dashed border-border px-6 py-12 text-center">
            <Tag aria-hidden="true" className="h-8 w-8 text-muted-foreground" />
            <h2 className="mt-3 text-base font-semibold text-foreground">
              {hasActiveFilters ? 'Ninguna oferta coincide' : 'No hay ofertas activas'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {hasActiveFilters
                ? 'Probá con otra búsqueda o quitá algún filtro.'
                : 'Volvé pronto o mirá el catálogo completo.'}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {hasActiveFilters && (
                <Button type="button" variant="outline" onClick={resetAllFilters}>
                  Limpiar filtros
                </Button>
              )}
              <Button asChild className="gap-2">
                <Link href={`${tenantPrefix}/productos`}>
                  Ver catálogo
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        )}

        {paginatedOffers.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 xl:grid-cols-4">
            {paginatedOffers.map((offer, i) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                tenantPrefix={tenantPrefix}
                accent={accent}
                priority={i < 4}
                commerceMode={commerceMode}
                contactPhone={contactPhone}
                portrait={portrait}
              />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <nav aria-label="Páginas de ofertas" className="mt-12 flex items-center justify-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => goToPage(safePage - 1)}
              disabled={safePage === 1}
              aria-label="Página anterior"
              className="h-9 gap-1 px-2.5"
            >
              <ChevronLeft aria-hidden="true" className="h-4 w-4" />
              <span className="hidden sm:inline">Anterior</span>
            </Button>

            {paginationItems(safePage, totalPages).map((item, index) =>
              item === 'gap' ? (
                <span key={`gap-${index}`} aria-hidden="true" className="px-1.5 text-sm text-muted-foreground">
                  …
                </span>
              ) : (
                <Button
                  key={item}
                  type="button"
                  variant={item === safePage ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => goToPage(item)}
                  aria-label={`Página ${item}`}
                  aria-current={item === safePage ? 'page' : undefined}
                  className="h-9 min-w-9 px-2 tabular-nums"
                >
                  {item}
                </Button>
              )
            )}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => goToPage(safePage + 1)}
              disabled={safePage === totalPages}
              aria-label="Página siguiente"
              className="h-9 gap-1 px-2.5"
            >
              <span className="hidden sm:inline">Siguiente</span>
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </Button>
          </nav>
        )}
      </div>

      {/* ── Cierre ── */}
      {allOffers.length > 0 && (
        <section className="border-t border-border/70 bg-muted/30">
          <div className="container mx-auto flex flex-col gap-4 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <div>
              <h2 className="text-lg font-semibold text-foreground">¿No encontraste lo que buscabas?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                En el catálogo están todos los productos de {settings.company_info.name || 'la tienda'}.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild className="gap-2">
                <Link href={`${tenantPrefix}/productos`}>
                  Ver catálogo completo
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              </Button>
              {contactPhone && (
                <Button asChild variant="outline" className="gap-2">
                  <a
                    href={getWhatsAppLink({
                      phone: contactPhone,
                      message: 'Hola, estoy viendo las ofertas y quiero consultar por otros productos.',
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle aria-hidden="true" className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    Consultar por WhatsApp
                  </a>
                </Button>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
