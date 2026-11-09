'use client'

import { useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import useSWR from 'swr'
import { ArrowRight, ChevronRight, Flame, Laptop, Layers, PackageSearch, Sparkles, Tag } from 'lucide-react'
import { AppImage } from '@/components/ui/app-image'
import { formatThousands } from '@/lib/currency'
import { resolvePublicVariantPrice } from '@/lib/public/offer-pricing'
import { resolveProductImageUrl, shouldBypassImageOptimization } from '@/lib/images'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
import { usePublicCategories } from '@/hooks/usePublicCategories'
import { useHydrated } from '@/hooks/use-hydrated'
import { WhatsAppIcon } from '@/components/public/SocialIcons'
import { ProductCard } from '@/components/public/ProductCard'
import { PromotionalCarousel } from '@/components/public/inicio/PromotionalCarousel'
import { StoreTrustBar } from '@/components/public/inicio/StoreTrustBar'
import { StoreBrandTicker } from '@/components/public/inicio/StoreBrandTicker'
import { TechRepairsBanner } from '@/components/public/inicio/TechRepairsBanner'
import { OrganizationReviews } from '@/components/public/inicio/OrganizationReviews'
import { BranchLocations, type BranchLocationData } from '@/components/public/inicio/BranchLocations'
import { NEWEST_PRODUCTS_SWR_OPTIONS, fetchPublicProducts, newestProductsKey } from '@/components/public/inicio/newest-products'
import { categoryVisual, type CategoryBranchId } from '@/lib/public/category-taxonomy'
import { hidesPublicPrice } from '@/lib/products/price-visibility'
import { getBrandTheme } from '@/lib/constants/brand-theme'
import { cn } from '@/lib/utils'
import type { PublicProduct } from '@/types/public'
import type { WebsiteSettings } from '@/types/website-settings'
import type { StorefrontCapabilities } from '@/lib/website/storefront-capabilities'

/**
 * Inicio de la plantilla Informática & Electrónica.
 *
 * Todo lo que se muestra sale de datos reales de la tienda: categorías,
 * marcas cargadas en los productos, ofertas con descuento de verdad y los
 * textos que el dueño configuró. Las tarjetas son las mismas `ProductCard` del
 * resto de la tienda, así el carrito respeta stock, variantes, precio
 * mayorista, precio oculto y la forma de venta (carrito o WhatsApp).
 */

const PRODUCTS_PER_SECTION = 8

interface Props {
  settings: WebsiteSettings
  branches?: BranchLocationData[]
  capabilities: StorefrontCapabilities
}

function hasRealOffer(product: PublicProduct) {
  return (
    !hidesPublicPrice(product) &&
    product.has_offer !== false &&
    product.offer_price != null &&
    product.offer_price > 0 &&
    product.offer_price < product.sale_price
  )
}

function productBrand(product: PublicProduct) {
  return (product.brand || product.device_brand || '').trim()
}

function categoryTone(branch: CategoryBranchId) {
  switch (branch) {
    case 'tecnologia':
      return 'border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400'
    case 'hogar':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
    case 'moda':
    case 'belleza':
      return 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400'
    case 'deportes':
    case 'alimentos':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
    default:
      return 'border-primary/30 bg-primary/10 text-primary'
  }
}

function SectionHeading({
  eyebrow,
  icon: Icon,
  title,
  description,
  href,
  linkLabel,
  id,
}: {
  eyebrow: string
  icon: typeof Tag
  title: string
  description?: string
  href?: string
  linkLabel?: string
  id: string
}) {
  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <span className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-primary">
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          {eyebrow}
        </span>
        <h2 id={id} className="text-xl font-black tracking-tight text-foreground sm:text-2xl">
          {title}
        </h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {href && linkLabel && (
        <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-xs font-black text-primary hover:underline">
          {linkLabel}
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      )}
    </div>
  )
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'shrink-0 rounded-full px-4 py-1.5 text-xs font-black uppercase tracking-wider transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'border border-border bg-card text-foreground hover:border-primary/40 hover:bg-primary/10 hover:text-primary'
      )}
    >
      {children}
    </button>
  )
}

/** El mismo precio que muestra la tarjeta (y cobra el checkout): mayorista u oferta según corresponda. */
function displayPrice(product: PublicProduct) {
  return resolvePublicVariantPrice({ isWholesale: product.wholesale_price != null, product, variant: null })
}

/**
 * Foto de producto: misma resolución de URL que `ProductCard` (rutas del
 * storage, hosts no soportados) y, si falla, un ícono en lugar de la imagen rota.
 */
function ProductPhoto({ product, sizes, className }: { product: PublicProduct; sizes: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  const src = product.image ? resolveProductImageUrl(product.image) : null
  if (!src || failed) {
    return (
      <span className="flex h-full w-full items-center justify-center text-muted-foreground/40">
        <Laptop className="h-1/3 w-1/3" aria-hidden="true" />
      </span>
    )
  }
  return (
    <AppImage
      src={src}
      alt={product.name}
      fill
      sizes={sizes}
      className={cn('object-contain', className)}
      unoptimized={shouldBypassImageOptimization(src)}
      onError={() => setFailed(true)}
    />
  )
}

/**
 * Banner lateral de las vitrinas por marca y por categoría: título, cantidad de
 * modelos y un modelo destacado (el primero con oferta real, si hay).
 */
function FeaturedBanner({
  eyebrow,
  title,
  description,
  countLabel,
  product: initialProduct,
  gallery = [],
  href,
  ctaLabel,
  phoneClean,
  prefix,
  variant = 'primary',
}: {
  eyebrow: string
  title: string
  description: string
  countLabel: string
  product: PublicProduct | null
  href: string
  ctaLabel: string
  phoneClean: string
  prefix: string
  variant?: 'primary' | 'indigo'
  /** Productos de la vitrina: sus miniaturas cambian el modelo destacado. */
  gallery?: PublicProduct[]
}) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const thumbnails = useMemo(() => gallery.filter((item) => Boolean(item.image)).slice(0, 4), [gallery])
  const product = gallery.find((item) => item.id === activeId) ?? initialProduct
  const priceHidden = product ? hidesPublicPrice(product) : false
  return (
    <div
      className={cn(
        'group relative flex flex-col gap-4 overflow-hidden rounded-3xl border-2 p-5 text-card-foreground shadow-xl lg:sticky lg:top-40 lg:col-span-1 lg:self-start',
        variant === 'indigo'
          ? 'border-indigo-300/80 bg-gradient-to-br from-indigo-100/70 via-blue-50/50 to-card shadow-lg shadow-indigo-500/5 dark:border-primary/40 dark:from-slate-950 dark:via-indigo-950/40 dark:to-primary/25'
          : 'border-primary/30 bg-gradient-to-br from-primary/15 via-primary/5 to-card shadow-lg shadow-primary/5 dark:border-primary/40 dark:from-slate-950 dark:via-slate-900 dark:to-primary/25'
      )}
    >
      <div className="pointer-events-none absolute -bottom-12 -right-12 h-52 w-52 rounded-full bg-primary/20 blur-3xl transition-colors group-hover:bg-primary/30 dark:bg-primary/30" />
      <div className="pointer-events-none absolute -left-12 -top-12 h-52 w-52 rounded-full bg-primary/15 blur-3xl dark:bg-primary/20" />

      <div className="relative z-10 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider shadow-xs',
              variant === 'indigo' ? 'bg-gradient-to-r from-indigo-600 to-primary text-white' : 'bg-primary text-primary-foreground'
            )}
          >
            <Sparkles className="h-3 w-3 text-amber-300" aria-hidden="true" />
            {eyebrow}
          </span>
          <span className="rounded-full border border-border bg-card/90 px-2.5 py-0.5 text-[10px] font-bold text-slate-700 shadow-2xs dark:bg-white/10 dark:text-slate-300">
            {countLabel}
          </span>
        </div>
        <h3 className="text-2xl font-black uppercase tracking-tight text-foreground transition-colors group-hover:text-primary sm:text-3xl">
          {title}
        </h3>
        <p className="line-clamp-2 text-[11px] font-medium leading-relaxed text-muted-foreground">{description}</p>
      </div>

      {product ? (
        <div className="relative z-10 flex flex-1 flex-col">
          <Link
            href={`${prefix}/productos/${product.id}`}
            className="group/photo relative mx-auto block aspect-square w-full max-w-xs overflow-hidden lg:max-w-none rounded-2xl border-2 border-primary/30 bg-white shadow-md transition-all hover:border-primary hover:shadow-xl"
          >
            <ProductPhoto
              product={product}
              sizes="(max-width: 1024px) 90vw, 22vw"
              className="p-4 transition-transform duration-500 group-hover/photo:scale-105"
            />
            {hasRealOffer(product) && (
              <span className="absolute left-2.5 top-2.5 rounded-lg bg-rose-600 px-2 py-0.5 text-[10px] font-black text-white shadow-xs">
                OFERTA
              </span>
            )}
            <span
              className={cn(
                'absolute bottom-2.5 right-2.5 rounded-xl px-2.5 py-1 text-xs font-black shadow-md',
                priceHidden ? 'bg-amber-600 text-white' : 'bg-gradient-to-r from-primary to-primary/90 text-primary-foreground'
              )}
            >
              {priceHidden ? 'Precio a consultar' : `${formatThousands(Math.round(displayPrice(product)))} Gs.`}
            </span>
          </Link>
          {thumbnails.length > 1 && (
            <div role="group" aria-label="Elegir modelo destacado" className="mx-auto mt-2.5 grid w-full max-w-xs grid-cols-4 gap-2 lg:max-w-none">
              {thumbnails.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveId(item.id)}
                  aria-pressed={item.id === product.id}
                  aria-label={`Ver ${item.name}`}
                  title={item.name}
                  className={cn(
                    'relative aspect-square overflow-hidden rounded-xl border-2 bg-white transition-all',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    item.id === product.id ? 'border-primary shadow-md' : 'border-border opacity-70 hover:border-primary/50 hover:opacity-100'
                  )}
                >
                  <ProductPhoto product={item} sizes="64px" className="p-1.5" />
                </button>
              ))}
            </div>
          )}
          <span className="mt-2.5 block text-[10px] font-black uppercase tracking-wider text-primary">Modelo destacado</span>
          <Link
            href={`${prefix}/productos/${product.id}`}
            className="block truncate text-xs font-bold text-foreground transition-colors hover:text-primary"
            title={product.name}
          >
            {product.name}
          </Link>
        </div>
      ) : (
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center rounded-2xl border border-border bg-card/60 p-6 text-center">
          <Laptop className="mb-2 h-10 w-10 text-muted-foreground" aria-hidden="true" />
          <span className="text-xs font-medium text-muted-foreground">Explorá los modelos disponibles</span>
        </div>
      )}

      <div className="relative z-10 flex items-center gap-2 border-t border-border pt-3">
        <Link
          href={href}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-black uppercase tracking-wider shadow-lg transition-transform active:scale-95',
            variant === 'indigo'
              ? 'bg-gradient-to-r from-indigo-600 to-primary text-white shadow-indigo-600/30'
              : 'bg-primary text-primary-foreground shadow-primary/30 hover:bg-primary/90'
          )}
        >
          <span className="truncate">{ctaLabel}</span>
          <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        </Link>
        {phoneClean && product && (
          <a
            href={`https://wa.me/${phoneClean}?text=${encodeURIComponent(
              `Hola, quisiera consultar ${priceHidden ? 'el precio de' : 'por'} ${product.name}`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex shrink-0 items-center justify-center rounded-xl bg-[#25D366] p-2.5 text-white shadow-md transition-colors hover:bg-[#20ba5a]"
            aria-label={`Consultar por ${product.name} en WhatsApp`}
          >
            <WhatsAppIcon className="h-4 w-4" />
          </a>
        )}
      </div>
    </div>
  )
}

const SPOTLIGHT_STYLES = [
  {
    card: 'border-indigo-200/90 bg-gradient-to-br from-indigo-100/70 via-blue-50/60 to-card shadow-lg shadow-indigo-500/5 hover:border-indigo-400 dark:border-indigo-500/30 dark:from-slate-950 dark:via-slate-900/95 dark:to-indigo-950/40 dark:shadow-indigo-950/20',
    badge: 'bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 text-white shadow-xs',
    button: 'bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white shadow-md shadow-indigo-600/25',
    accent: 'text-indigo-700 dark:text-indigo-400',
    photo: 'border-indigo-200/90 group-hover:border-indigo-400 dark:border-indigo-500/30',
    glowBottom: 'bg-indigo-400/20 dark:bg-indigo-600/20',
    glowTop: 'bg-blue-400/15 dark:bg-blue-600/15',
  },
  {
    card: 'border-teal-200/90 bg-gradient-to-br from-teal-100/70 via-emerald-50/60 to-card shadow-lg shadow-teal-500/5 hover:border-teal-400 dark:border-emerald-500/30 dark:from-slate-950 dark:via-slate-900/95 dark:to-teal-950/40 dark:shadow-teal-950/20',
    badge: 'bg-gradient-to-r from-teal-600 via-emerald-600 to-emerald-700 text-white shadow-xs',
    button: 'bg-gradient-to-r from-teal-600 via-emerald-600 to-emerald-700 hover:from-teal-700 hover:to-emerald-800 shadow-teal-600/25',
    accent: 'text-teal-700 dark:text-teal-400',
    photo: 'border-teal-200/90 group-hover:border-teal-400 dark:border-emerald-500/30',
    glowBottom: 'bg-teal-400/20 dark:bg-teal-600/20',
    glowTop: 'bg-emerald-400/15 dark:bg-emerald-600/15',
  },
] as const

/** Tarjeta grande de una categoría con la foto de uno de sus productos y miniaturas de otros. */
function CategorySpotlight({
  name,
  count,
  href,
  products,
  index,
  prefix,
}: {
  name: string
  count: number
  href: string
  products: PublicProduct[]
  index: number
  prefix: string
}) {
  const style = SPOTLIGHT_STYLES[index % SPOTLIGHT_STYLES.length]
  const Icon = categoryVisual(name).icon
  const withPhoto = products.filter((product) => Boolean(product.image))
  const main = withPhoto[0] ?? products[0] ?? null
  const extras = withPhoto.filter((product) => product.id !== main?.id).slice(0, 3)

  return (
    <article className={cn('group relative flex flex-col gap-5 overflow-hidden rounded-3xl border-2 p-5 shadow-xl transition-all hover:shadow-2xl sm:flex-row sm:p-6', style.card)}>
      {/* Resplandores ambientales con color suave y agradable */}
      <div className={cn('pointer-events-none absolute -bottom-10 -right-10 h-48 w-48 rounded-full blur-3xl transition-opacity', style.glowBottom)} />
      <div className={cn('pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full blur-3xl transition-opacity', style.glowTop)} />

      <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-between gap-4">
        <div className="space-y-2">
          <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow-xs', style.badge)}>
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            Categoría
          </span>
          <h3 className="text-2xl font-black tracking-tight text-foreground transition-colors group-hover:text-primary">{name}</h3>
          <p className={cn('text-sm font-black', style.accent)}>
            {count} {count === 1 ? 'producto' : 'productos'}
          </p>
        </div>
        {extras.length > 0 && (
          <div className="flex gap-2">
            {extras.map((extra) => (
              <Link
                key={extra.id}
                href={`${prefix}/productos/${extra.id}`}
                className={cn('relative h-16 w-16 overflow-hidden rounded-xl border-2 bg-card/95 shadow-xs transition-transform hover:-translate-y-0.5', style.photo)}
                title={extra.name}
              >
                <ProductPhoto product={extra} sizes="64px" className="p-1.5" />
              </Link>
            ))}
          </div>
        )}
        <Link
          href={href}
          className={cn('inline-flex w-fit items-center gap-2 rounded-2xl px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-lg transition-transform hover:scale-105 active:scale-95', style.button)}
        >
          Explorar {name}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
      {main && (
        <Link
          href={`${prefix}/productos/${main.id}`}
          className={cn('relative z-10 mx-auto aspect-square w-full max-w-xs shrink-0 overflow-hidden rounded-2xl border-2 bg-card/95 shadow-md transition-all group-hover:shadow-2xl sm:w-56 lg:w-60', style.photo)}
          title={main.name}
        >
          <ProductPhoto
            product={main}
            sizes="(max-width: 640px) 80vw, 240px"
            className="p-4 transition-transform duration-500 group-hover:scale-105"
          />
        </Link>
      )}
    </article>
  )
}

const GRID_COLUMNS: Record<number, string> = {
  1: 'grid-cols-1 sm:grid-cols-2',
  2: 'grid-cols-2',
  3: 'grid-cols-2 md:grid-cols-3',
  4: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
}

function ProductGrid({ products, columns = 4 }: { products: PublicProduct[]; columns?: 3 | 4 }) {
  // Con pocos productos no se reservan columnas vacías.
  const used = Math.max(1, Math.min(columns, products.length))
  return (
    <div className={cn('grid gap-3 sm:gap-4', GRID_COLUMNS[used])}>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}

function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-72 animate-pulse rounded-2xl border border-border bg-muted/40" />
      ))}
    </div>
  )
}

export function InformaticaElectronicaHome({ settings, branches = [], capabilities }: Props) {
  const pathname = usePathname()
  const slug = getTenantSlugFromPathname(pathname)
  const prefix = slug ? '/' + slug : ''

  const { categories } = usePublicCategories()
  const hydrated = useHydrated()
  const { data: cachedProducts, isLoading: loadingProducts, error } = useSWR(
    capabilities.hasCatalog ? newestProductsKey(slug) : null,
    fetchPublicProducts,
    NEWEST_PRODUCTS_SWR_OPTIONS
  )
  // Igual que las categorías: los productos pueden venir de la caché de SWR en el
  // navegador; antes de hidratar se dibuja lo mismo que en el servidor (cargando).
  const products = useMemo(() => (hydrated ? cachedProducts ?? [] : []), [hydrated, cachedProducts])
  const isLoading = !hydrated || loadingProducts

  const company = settings.company_info
  const storeName = company?.name?.trim() || 'Nuestra tienda'
  const phoneClean = (company?.phone || '').replace(/\D/g, '')
  const brandTheme = getBrandTheme(company?.brandColor)

  const [selectedBrand, setSelectedBrand] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  // Portada: si el dueño cargó banners, mandan ellos (igual que en las demás plantillas).
  const hasConfiguredSlides =
    settings.promotional_carousel?.enabled !== false &&
    Boolean(settings.promotional_carousel?.slides?.some((slide) => slide.active))
  const heroVisible = settings.hero_content?.enabled !== false

  // Categorías raíz de la tienda; si el conteo existe, solo las que tienen productos.
  const storeCategories = useMemo(() => {
    // Las categorías pueden venir de caché en el navegador: antes de hidratar se
    // dibuja lo mismo que en el servidor (sin categorías) para no romper la hidratación.
    if (!hydrated) return []
    const roots = categories.filter((category) => !category.parent_id)
    const withProducts = roots.filter((category) => (category.productCount ?? 0) > 0)
    return roots.some((category) => typeof category.productCount === 'number') ? withProducts : roots
  }, [categories, hydrated])

  const offers = useMemo(() => products.filter(hasRealOffer).slice(0, PRODUCTS_PER_SECTION), [products])
  const newest = useMemo(() => products.slice(0, PRODUCTS_PER_SECTION), [products])

  // Marcas: solo las cargadas en los productos (sin adivinar por el nombre).
  const brands = useMemo(() => {
    const byKey = new Map<string, { label: string; count: number }>()
    for (const product of products) {
      const label = productBrand(product)
      if (!label) continue
      const key = label.toLowerCase()
      const current = byKey.get(key)
      if (current) current.count += 1
      else byKey.set(key, { label, count: 1 })
    }
    return Array.from(byKey.values()).sort((a, b) => b.count - a.count).map((brand) => brand.label)
  }, [products])

  const activeBrand = selectedBrand && brands.includes(selectedBrand) ? selectedBrand : brands[0] ?? null
  const brandProducts = useMemo(() => {
    if (!activeBrand) return []
    const key = activeBrand.toLowerCase()
    return products.filter((product) => productBrand(product).toLowerCase() === key).slice(0, PRODUCTS_PER_SECTION)
  }, [products, activeBrand])

  // Categorías con productos entre los cargados, para el filtro de destacados.
  const showcaseCategories = useMemo(() => {
    const byId = new Map<string, { id: string; name: string }>()
    for (const product of products) {
      if (product.category?.id && product.category.name) {
        byId.set(product.category.id, { id: product.category.id, name: product.category.name })
      }
    }
    return Array.from(byId.values())
  }, [products])

  const activeCategory =
    showcaseCategories.find((category) => category.id === selectedCategory) ?? showcaseCategories[0] ?? null
  const categoryProducts = useMemo(() => {
    if (!activeCategory) return []
    return products.filter((product) => product.category?.id === activeCategory.id).slice(0, PRODUCTS_PER_SECTION)
  }, [products, activeCategory])

  const brandsTicker =
    settings.brands_section?.enabled && settings.brands_section.showOnHome !== false ? settings.brands_section : null
  const trustBar =
    settings.trust_bar?.enabled !== false && settings.trust_bar?.items?.some((item) => item.active)
      ? settings.trust_bar
      : null
  const brandFeatured = brandProducts.find(hasRealOffer) ?? brandProducts[0] ?? null
  const categoryFeatured = categoryProducts.find(hasRealOffer) ?? categoryProducts[0] ?? null

  // Dúo de categorías con fotos: las dos con más productos entre los cargados.
  const spotlights = useMemo(() => {
    return showcaseCategories
      .map((category) => ({
        ...category,
        products: products.filter((product) => product.category?.id === category.id),
        count: storeCategories.find((item) => item.id === category.id)?.productCount,
      }))
      .sort((a, b) => b.products.length - a.products.length)
      .slice(0, 2)
  }, [showcaseCategories, products, storeCategories])

  const heroCategories = storeCategories.slice(0, offers.length > 0 ? 2 : 3)
  const catalogUnavailable = capabilities.hasCatalog && !isLoading && (Boolean(error) || products.length === 0)

  return (
    <div className="w-full bg-background text-foreground">
      {/* ── 1. Portada ── */}
      {hasConfiguredSlides && settings.promotional_carousel ? (
        <PromotionalCarousel
          settings={{ ...settings.promotional_carousel, enabled: settings.promotional_carousel.enabled ?? true }}
          isPageLead
        />
      ) : heroVisible ? (
        <section className="border-b border-border/70 bg-muted/20 py-5 sm:py-7">
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 sm:px-6 lg:grid-cols-3 lg:px-8">
            <div
              className={cn(
                'relative flex min-h-[260px] flex-col justify-between overflow-hidden rounded-3xl border-2 p-6 shadow-xl transition-all sm:p-10',
                'border-primary/30 bg-gradient-to-br from-primary/15 via-primary/5 to-card text-foreground shadow-primary/5',
                'dark:border-primary/40 dark:from-slate-950 dark:via-slate-900 dark:to-primary/30 dark:text-white dark:shadow-xl',
                heroCategories.length > 0 || offers.length > 0 ? 'lg:col-span-2' : 'lg:col-span-3'
              )}
            >
              <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-primary/20 blur-3xl dark:bg-primary/30" />
              <div className="relative z-10 max-w-xl space-y-3.5">
                <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-xs font-black uppercase tracking-wide text-primary dark:border-primary/50 dark:bg-primary/25 dark:text-white">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500 dark:text-amber-300" aria-hidden="true" />
                  {storeName}
                </span>
                <h1 className="text-2xl font-black leading-tight tracking-tight text-foreground dark:text-white sm:text-4xl">
                  {settings.hero_content?.title?.trim() || `Tecnología e informática en ${storeName}`}
                </h1>
                <p className="text-sm font-medium leading-relaxed text-muted-foreground dark:text-slate-200">
                  {settings.hero_content?.subtitle?.trim() ||
                    company?.slogan?.trim() ||
                    'Encontrá notebooks, celulares, componentes y accesorios en nuestro catálogo.'}
                </p>
              </div>
              <div className="relative z-10 flex flex-wrap items-center gap-3 pt-5">
                {capabilities.hasCatalog && (
                  <Link
                    href={`${prefix}/productos`}
                    className="inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-xs font-black uppercase tracking-wider text-primary-foreground shadow-lg shadow-primary/25 transition-transform hover:scale-105 active:scale-95 hover:bg-primary/90"
                  >
                    Ver catálogo
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                )}
                {offers.length > 0 && (
                  <Link
                    href={`${prefix}/ofertas`}
                    className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card/80 px-5 py-3 text-xs font-black uppercase tracking-wider text-foreground shadow-xs transition-colors hover:bg-muted dark:border-white/25 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                  >
                    <Flame className="h-4 w-4 text-rose-500 dark:text-amber-300" aria-hidden="true" />
                    Ver ofertas
                  </Link>
                )}
                {phoneClean && (
                  <a
                    href={`https://wa.me/${phoneClean}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-2xl bg-[#25D366] px-5 py-3 text-xs font-black text-white shadow-md transition-transform hover:scale-105 active:scale-95 hover:bg-[#20ba5a]"
                  >
                    <WhatsAppIcon className="h-4 w-4 shrink-0" />
                    Consultar por WhatsApp
                  </a>
                )}
              </div>
            </div>

            {(heroCategories.length > 0 || offers.length > 0) && (
              <nav aria-label="Accesos rápidos" className="flex flex-col gap-3 sm:gap-4">
                {offers.length > 0 && (
                  <Link
                    href={`${prefix}/ofertas`}
                    className="group flex flex-1 items-center justify-between gap-3 rounded-2xl border-2 border-rose-500/40 bg-gradient-to-br from-rose-500/20 via-rose-500/10 to-card p-4 shadow-sm transition-all hover:border-rose-500 hover:shadow-xl hover:shadow-rose-500/20 sm:p-5"
                  >
                    <div className="min-w-0 space-y-1">
                      <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-rose-600 to-amber-500 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-xs">
                        <Flame className="h-3 w-3 fill-current text-amber-200" aria-hidden="true" />
                        Ofertas
                      </span>
                      <h3 className="text-base font-black leading-tight text-foreground transition-colors group-hover:text-rose-600">
                        Precios especiales
                      </h3>
                      <p className="text-xs font-medium text-muted-foreground">Ver productos con descuento</p>
                    </div>
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-600 transition-all group-hover:scale-110 group-hover:bg-rose-600 group-hover:text-white dark:text-rose-400">
                      <Flame className="h-6 w-6 fill-current" aria-hidden="true" />
                    </span>
                  </Link>
                )}
                {heroCategories.map((category) => {
                  const visual = categoryVisual(category.name)
                  const Icon = visual.icon
                  return (
                    <Link
                      key={category.id}
                      href={`${prefix}/productos?category_id=${encodeURIComponent(category.id)}`}
                      className="group flex flex-1 items-center justify-between gap-3 rounded-2xl border-2 border-border bg-card p-4 transition-colors hover:border-primary sm:p-5"
                    >
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-black text-foreground group-hover:text-primary">{category.name}</h3>
                        {typeof category.productCount === 'number' && (
                          <p className="text-xs text-muted-foreground">
                            {category.productCount} {category.productCount === 1 ? 'producto' : 'productos'}
                          </p>
                        )}
                      </div>
                      <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border', categoryTone(visual.branch))}>
                        <Icon className="h-6 w-6" aria-hidden="true" />
                      </span>
                    </Link>
                  )
                })}
              </nav>
            )}
          </div>
        </section>
      ) : (
        <h1 className="sr-only">{storeName}</h1>
      )}

      {/* ── 2. Categorías de la tienda ── */}
      {storeCategories.length > 0 && (
        <section aria-labelledby="tech-categories" className="border-b border-border/70 py-6 sm:py-8">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading
              id="tech-categories"
              eyebrow="Departamentos"
              icon={Layers}
              title="Categorías de la tienda"
              href={`${prefix}/productos`}
              linkLabel="Ver catálogo completo"
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(200px,1fr))] sm:gap-4">
              {storeCategories.map((category) => {
                const visual = categoryVisual(category.name)
                const Icon = visual.icon
                return (
                  <Link
                    key={category.id}
                    href={`${prefix}/productos?category_id=${encodeURIComponent(category.id)}`}
                    className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg sm:p-4"
                  >
                    <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 transition-transform group-hover:scale-110 sm:h-12 sm:w-12', categoryTone(visual.branch))}>
                      <Icon className="h-6 w-6" aria-hidden="true" />
                    </span>
                    <span className="flex min-w-0 flex-col">
                    <span className="line-clamp-2 text-sm font-black leading-tight text-foreground group-hover:text-primary">
                      {category.name}
                    </span>
                    {typeof category.productCount === 'number' && (
                      <span className="mt-0.5 text-[11px] font-bold text-muted-foreground">
                        {category.productCount} {category.productCount === 1 ? 'producto' : 'productos'}
                      </span>
                    )}
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {brandsTicker && <StoreBrandTicker settings={brandsTicker} />}

      {capabilities.hasCatalog && (
        <>
          {/* ── 3. Ofertas: solo productos con descuento real ── */}
          {offers.length > 0 && (
            <section aria-labelledby="tech-offers" className="relative overflow-hidden border-b border-border/70 bg-gradient-to-b from-rose-500/10 via-amber-500/5 to-background dark:from-rose-950/15 dark:via-muted/20 dark:to-background py-6 sm:py-8">
              <div className="pointer-events-none absolute right-1/4 top-0 h-96 w-96 rounded-full bg-rose-500/15 blur-3xl" />
              <div className="pointer-events-none absolute bottom-0 left-1/4 h-96 w-96 rounded-full bg-amber-500/15 blur-3xl" />
              <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="rounded-3xl border-2 border-rose-300/70 bg-gradient-to-br from-rose-100/60 via-amber-50/40 to-card p-5 shadow-xl shadow-rose-500/5 dark:border-rose-500/40 dark:from-slate-950 dark:via-slate-900 dark:to-rose-950/35 dark:shadow-rose-950/20 sm:p-7">
                  <div className="mb-5 flex flex-col justify-between gap-4 border-b border-rose-500/25 pb-5 md:flex-row md:items-center">
                    <div className="flex items-center gap-3.5">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-rose-600 via-rose-500 to-amber-500 text-white shadow-xl shadow-rose-500/30">
                        <Flame className="h-7 w-7 fill-current text-amber-200" aria-hidden="true" />
                      </span>
                      <div>
                        <h2 id="tech-offers" className="text-xl font-black tracking-tight text-foreground sm:text-2xl">
                          Productos con descuento
                        </h2>
                        <p className="text-xs font-medium text-muted-foreground sm:text-sm">
                          Precios rebajados sobre el precio de lista.
                        </p>
                      </div>
                    </div>
                    <Link
                      href={`${prefix}/ofertas`}
                      className="inline-flex w-fit items-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-500 px-4 py-2 text-xs font-black text-white shadow-md transition-transform hover:scale-105"
                    >
                      Ver todas las ofertas
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                  <ProductGrid products={offers} />
                </div>
              </div>
            </section>
          )}

          {/* ── 4. Comprá por marca (marcas cargadas en los productos) ── */}
          {brands.length > 1 && activeBrand && (
            <section aria-labelledby="tech-brands" className="border-b border-border/70 py-6 sm:py-8">
              <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <SectionHeading
                  id="tech-brands"
                  eyebrow="Marcas"
                  icon={Tag}
                  title="Comprá por marca"
                />
                <div role="group" aria-label="Filtrar por marca" className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-2">
                  {brands.map((brand) => (
                    <FilterPill key={brand} active={brand === activeBrand} onClick={() => setSelectedBrand(brand)}>
                      {brand}
                    </FilterPill>
                  ))}
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                  <FeaturedBanner
                    key={activeBrand}
                    gallery={brandProducts}
                    eyebrow="Marca"
                    title={activeBrand}
                    description={`Modelos ${activeBrand} disponibles en ${storeName}.`}
                    countLabel={`${brandProducts.length} ${brandProducts.length === 1 ? 'modelo' : 'modelos'}`}
                    product={brandFeatured}
                    href={`${prefix}/productos?q=${encodeURIComponent(activeBrand)}`}
                    ctaLabel={`Ver todo ${activeBrand}`}
                    phoneClean={phoneClean}
                    prefix={prefix}
                  />
                  <div className="lg:col-span-3">
                    <ProductGrid products={brandProducts.slice(0, 6)} columns={3} />
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ── 5. Destacados por categoría ── */}
          {showcaseCategories.length > 1 && activeCategory && (
            <section aria-labelledby="tech-category-showcase" className="border-b border-border/70 bg-muted/20 py-6 sm:py-8">
              <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <SectionHeading
                  id="tech-category-showcase"
                  eyebrow="Por categoría"
                  icon={Layers}
                  title="Destacados por categoría"
                />
                <div role="group" aria-label="Filtrar por categoría" className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-2">
                  {showcaseCategories.map((category) => (
                    <FilterPill
                      key={category.id}
                      active={category.id === activeCategory.id}
                      onClick={() => setSelectedCategory(category.id)}
                    >
                      {category.name}
                    </FilterPill>
                  ))}
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                  <FeaturedBanner
                    key={activeCategory.id}
                    gallery={categoryProducts}
                    variant="indigo"
                    eyebrow="Selección"
                    title={activeCategory.name}
                    description={`Productos de ${activeCategory.name} en ${storeName}.`}
                    countLabel={`${categoryProducts.length} ${categoryProducts.length === 1 ? 'producto' : 'productos'}`}
                    product={categoryFeatured}
                    href={`${prefix}/productos?category_id=${encodeURIComponent(activeCategory.id)}`}
                    ctaLabel={`Explorar ${activeCategory.name}`}
                    phoneClean={phoneClean}
                    prefix={prefix}
                  />
                  <div className="lg:col-span-3">
                    <ProductGrid products={categoryProducts.slice(0, 6)} columns={3} />
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ── 5b. Dúo de categorías con fotos de sus productos ── */}
          {spotlights.length > 1 && (
            <section aria-labelledby="tech-spotlights" className="border-b border-border/70 py-6 sm:py-8">
              <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <h2 id="tech-spotlights" className="sr-only">Categorías destacadas</h2>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {spotlights.map((spotlight, index) => (
                    <CategorySpotlight
                      key={spotlight.id}
                      index={index}
                      name={spotlight.name}
                      count={spotlight.count ?? spotlight.products.length}
                      href={`${prefix}/productos?category_id=${encodeURIComponent(spotlight.id)}`}
                      products={spotlight.products}
                      prefix={prefix}
                    />
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* ── 6. Recién llegados ── */}
          <section aria-labelledby="tech-newest" className="border-b border-border/70 py-6 sm:py-8">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <SectionHeading
                id="tech-newest"
                eyebrow="Novedades"
                icon={Sparkles}
                title="Recién llegados"
                href={`${prefix}/productos`}
                linkLabel="Ver catálogo completo"
              />
              {isLoading ? (
                <ProductGridSkeleton />
              ) : catalogUnavailable ? (
                <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border bg-card p-8 text-center">
                  <PackageSearch className="mb-2 h-10 w-10 text-muted-foreground" aria-hidden="true" />
                  <p className="text-sm font-bold text-foreground">
                    {error ? 'No pudimos cargar los productos.' : 'Todavía no hay productos publicados.'}
                  </p>
                  {phoneClean && (
                    <a
                      href={`https://wa.me/${phoneClean}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 text-xs font-bold text-primary hover:underline"
                    >
                      Consultanos por WhatsApp
                    </a>
                  )}
                </div>
              ) : (
                <ProductGrid products={newest} />
              )}
            </div>
          </section>
        </>
      )}

      {capabilities.hasRepairs && company && <TechRepairsBanner phoneClean={phoneClean} companyInfo={company} />}

      {/* Beneficios: solo los que el dueño configuró en el sitio web. */}
      {trustBar && <StoreTrustBar settings={trustBar} className="py-4 sm:py-5" />}

      {branches.length > 0 && <BranchLocations branches={branches} brand={brandTheme} />}

      <OrganizationReviews hasRepairs={capabilities.hasRepairs} />
    </div>
  )
}
