import Image from 'next/image'
import Link from 'next/link'
import {
  Building2,
  ExternalLink,
  Heart,
  Home,
  Info,
  MapPin,
  Navigation,
  Package,
  Shirt,
  ShoppingBasket,
  Smartphone,
  Sparkles,
  Star,
  Store,
  Tag,
  Wrench,
  Car,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { resolveProductImageUrl } from '@/lib/images'
import { normalizeCity } from '@/lib/public/city-normalizer'
import type { MarketplaceOrganization } from '@/lib/public/marketplace'

type Props = {
  organization: MarketplaceOrganization
  className?: string
  onOpenDetails?: (organization: MarketplaceOrganization) => void
}

export const RUBRO_LABELS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  tecnologia: { label: 'Tecnología', icon: Smartphone, color: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800/40' },
  indumentaria: { label: 'Indumentaria', icon: Shirt, color: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800/40' },
  alimentos: { label: 'Gastronomía & Alimentos', icon: ShoppingBasket, color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40' },
  ferreteria: { label: 'Ferretería & Obras', icon: Wrench, color: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800/40' },
  belleza: { label: 'Belleza & Cuidado', icon: Sparkles, color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40' },
  hogar: { label: 'Hogar & Muebles', icon: Home, color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40' },
  salud: { label: 'Salud & Farmacia', icon: Heart, color: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800/40' },
  automotor: { label: 'Automotor & Repuestos', icon: Car, color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/40' },
  comercio: { label: 'Comercio General', icon: Store, color: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' },
}

export function OrganizationDirectoryCard({ organization, className, onOpenDetails }: Props) {
  const storeUrl = `/${organization.slug}/inicio`
  const previewProducts = organization.featured_products.slice(0, 3)
  const rubroKey = organization.rubro || 'comercio'
  const rubroMeta = RUBRO_LABELS[rubroKey] ?? RUBRO_LABELS.comercio
  const RubroIcon = rubroMeta.icon
  const normalizedCity = normalizeCity(organization.city)

  return (
    <Link
      href={storeUrl}
      className={cn(
        'group flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-card transition-all duration-200',
        'hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg',
        className
      )}
    >
      {/* Product preview thumbnails + logo overlay */}
      <div className="relative grid h-28 grid-cols-3 overflow-visible bg-muted/40">
        {previewProducts.length > 0 ? (
          previewProducts.map((product, i) => {
            const src = resolveProductImageUrl(product.image)
            return (
              <div key={product.id} className={cn('relative overflow-hidden', i === 0 && previewProducts.length === 1 && 'col-span-3')}>
                {src ? (
                  <Image
                    src={src}
                    alt={product.name}
                    fill
                    className="object-contain p-2 transition-transform duration-300 group-hover:scale-105"
                    sizes="120px"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Package className="h-6 w-6 text-muted-foreground/40" />
                  </div>
                )}
              </div>
            )
          })
        ) : (
          <div className="col-span-3 flex items-center justify-center">
            <Package className="h-8 w-8 text-muted-foreground/40" />
          </div>
        )}

        {/* Logo superpuesto con Identidad de Marca */}
        <div className="absolute -bottom-5 left-3.5 z-10 flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border-2 border-background bg-card p-1 shadow-md">
          {organization.logo_url ? (
            <img
              src={organization.logo_url}
              alt={organization.name}
              className="h-full w-full object-contain"
              loading="lazy"
            />
          ) : (
            <div
              className={cn(
                'flex h-full w-full items-center justify-center rounded-lg font-bold text-xs text-white shadow-2xs bg-gradient-to-br',
                organization.brand_color === 'green' && 'from-emerald-600 to-teal-700',
                organization.brand_color === 'purple' && 'from-purple-600 to-pink-700',
                organization.brand_color === 'orange' && 'from-orange-600 to-amber-700',
                organization.brand_color === 'red' && 'from-rose-600 to-red-800',
                organization.brand_color === 'indigo' && 'from-indigo-600 to-blue-800',
                organization.brand_color === 'teal' && 'from-teal-600 to-emerald-700',
                organization.brand_color === 'rose' && 'from-rose-600 to-pink-700',
                (organization.brand_color === 'amber' || organization.brand_color === 'yellow') && 'from-amber-500 to-yellow-600',
                organization.brand_color === 'emerald' && 'from-emerald-600 to-teal-700',
                organization.brand_color === 'cyan' && 'from-cyan-600 to-sky-700',
                organization.brand_color === 'sky' && 'from-sky-500 to-blue-700',
                (!organization.brand_color || organization.brand_color === 'blue') && 'from-blue-600 to-blue-800'
              )}
              style={organization.custom_brand_color ? { backgroundColor: organization.custom_brand_color } : undefined}
            >
              {organization.name.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-1 px-4 pt-7 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-bold text-foreground transition-colors group-hover:text-primary">
              {organization.name}
            </h3>
            <p className="truncate text-xs text-muted-foreground">/{organization.slug}</p>
          </div>

          {/* Badge de Rubro */}
          <span className={cn(
            'shrink-0 flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
            rubroMeta.color
          )}>
            <RubroIcon className="h-3 w-3" />
            <span className="truncate max-w-[80px]">{rubroMeta.label}</span>
          </span>
        </div>

        {/* Ubicación, Dirección y Botón de Mapa */}
        {(normalizedCity || organization.address) && (
          <div className="mt-1.5 flex items-center justify-between gap-1.5 rounded-lg bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground border border-border/50">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <MapPin className="h-3 w-3 text-primary shrink-0" />
              <div className="min-w-0 truncate text-[11px] leading-tight">
                {normalizedCity && (
                  <span className="font-semibold text-foreground mr-1">{normalizedCity.display}</span>
                )}
                {organization.address && (
                  <span className="text-muted-foreground truncate">{organization.address}</span>
                )}
              </div>
            </div>

            {organization.maps_url && (
              <span
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  window.open(organization.maps_url!, '_blank', 'noopener,noreferrer')
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    e.stopPropagation()
                    window.open(organization.maps_url!, '_blank', 'noopener,noreferrer')
                  }
                }}
                title="Ver ubicación en Google Maps"
                className="shrink-0 inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary transition-colors hover:bg-primary hover:text-primary-foreground cursor-pointer shadow-2xs"
              >
                <Navigation className="h-2.5 w-2.5" />
                <span>Mapa</span>
              </span>
            )}
          </div>
        )}

        {/* Estadísticas de la tienda */}
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <p className="flex items-center gap-1 font-medium">
            <Package className="h-3.5 w-3.5 opacity-70" />
            {organization.products_count} producto{organization.products_count !== 1 ? 's' : ''}
          </p>

          {(organization.review_count ?? 0) > 0 && (
            <p className="flex items-center gap-1 text-xs font-semibold text-foreground shrink-0">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              {Number(organization.review_rating_avg ?? 0).toFixed(1)}
              <span className="text-[10px] text-muted-foreground font-normal">({organization.review_count})</span>
            </p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border/60 px-3.5 py-2 bg-muted/10 text-xs font-semibold">
        {onOpenDetails ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onOpenDetails(organization)
            }}
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors py-1 px-1.5 rounded-md hover:bg-muted cursor-pointer text-xs"
          >
            <Info className="h-3.5 w-3.5 text-primary" />
            <span>Ver detalles</span>
          </button>
        ) : (
          <span />
        )}

        <div className="flex items-center gap-1 text-primary group-hover:underline">
          <span>Visitar tienda</span>
          <ExternalLink className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </div>
      </div>
    </Link>
  )
}
