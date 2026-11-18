import { BrandColorScope } from '@/components/admin/website/StorefrontTemplateThumbnail'
import { getBrandTheme } from '@/lib/constants/brand-theme'
import {
  STOREFRONT_EYEBROW_CLASS,
  STOREFRONT_HEADING_CLASS,
  STOREFRONT_RADIUS_CLASS,
  headerOptionFor,
  usesPortraitMedia,
  type StorefrontStyle,
} from '@/lib/website/storefront-style'
import { getPremiumHeroForVertical } from '@/lib/website/premium-hero'
import type { CompanyInfo } from '@/types/website-settings'
import { cn } from '@/lib/utils'

const HEADER_CLASSES = {
  solid: { bar: 'bg-background text-foreground', topBar: 'bg-primary/10 text-foreground/80', logo: 'bg-primary text-primary-foreground', muted: 'text-muted-foreground', active: 'bg-accent text-foreground', cta: 'bg-primary text-primary-foreground' },
  accent: { bar: 'bg-primary text-primary-foreground', topBar: 'bg-black/15 text-primary-foreground/90', logo: 'bg-white text-primary', muted: 'text-primary-foreground/75', active: 'bg-white text-primary', cta: 'bg-white text-primary' },
  dark: { bar: 'bg-slate-950 text-white', topBar: 'bg-slate-900 text-slate-400', logo: 'bg-primary text-primary-foreground', muted: 'text-slate-400', active: 'bg-white/10 text-white', cta: 'bg-primary text-primary-foreground' },
} as const

/**
 * Maqueta en vivo del borrador: cambia al instante con cada clic, sin cargar la
 * tienda real. Refleja fielmente el rubro, la plantilla, el dispositivo y los colores seleccionados.
 */
export function StorefrontAppearancePreview({
  value,
  style,
  businessVertical,
  heroEnabled = false,
  device = 'desktop',
  className,
}: {
  value: Partial<CompanyInfo>
  style: StorefrontStyle
  businessVertical?: string | null
  heroEnabled?: boolean
  device?: 'desktop' | 'mobile'
  className?: string
}) {
  const header = HEADER_CLASSES[headerOptionFor(value.headerStyle)]
  const theme = getBrandTheme(value.brandColor)
  const radius = STOREFRONT_RADIUS_CLASS[style]
  const portrait = usesPortraitMedia(style)
  const name = value.name?.trim() || 'Tu tienda'
  const verticalDef = getPremiumHeroForVertical(businessVertical)
  const isMobile = device === 'mobile'
  const products = isMobile ? verticalDef.previewProducts.slice(0, 2) : verticalDef.previewProducts

  return (
    <BrandColorScope
      brandColor={value.brandColor || 'blue'}
      customBrandColor={value.customBrandColor}
      className={cn(
        'overflow-hidden rounded-xl border bg-background text-foreground shadow-sm transition-all duration-300',
        isMobile ? 'max-w-[320px] mx-auto' : 'w-full',
        className
      )}
    >
      <div aria-hidden="true" className="select-none">
        {/* Barra superior de contacto */}
        {value.showTopBar !== false && (
          <div className={cn('flex justify-between gap-2 px-3 py-1 text-[9px]', header.topBar)}>
            <span className="truncate">{value.phone || value.whatsapp || '+595 981 000 000'}</span>
            <span className="truncate">{value.hours?.weekdays || 'Lun a Vie 8:00 - 18:00'}</span>
          </div>
        )}

        {/* Encabezado */}
        <div className={cn('flex items-center justify-between gap-2 border-b px-3 py-2', header.bar)}>
          <div className="flex min-w-0 items-center gap-2">
            {value.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={value.logoUrl} alt="" className="h-6 w-6 shrink-0 rounded object-contain" />
            ) : (
              <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold', header.logo)}>
                {name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[11px] font-bold">{name}</span>
              {value.slogan ? (
                <span className={cn('block truncate text-[9px]', header.muted)}>{value.slogan}</span>
              ) : (
                <span className={cn('block truncate text-[9px] opacity-75', header.muted)}>{verticalDef.verticalLabel}</span>
              )}
            </span>
          </div>
          <span className={cn('shrink-0 rounded-md px-2 py-1 text-[9px] font-semibold', header.cta)}>
            {style === 'catalog-basic' ? 'Consultar' : 'Contacto'}
          </span>
        </div>

        {/* Portada Premium (si está activa) */}
        {heroEnabled ? (
          <div className={cn(
            'bg-gradient-to-br px-4 py-5 text-white',
            theme.hero,
            style === 'fashion' && 'from-stone-900 via-stone-900 to-stone-800',
            style === 'especial-para-barbero' && 'from-[#0B0B0F] via-[#111116] to-[#1A1412] border-b border-primary/30',
            style === 'especial-cosmeticos' && 'from-rose-500 via-pink-400 to-amber-200 border-b border-rose-300'
          )}>
            <span className={cn(STOREFRONT_EYEBROW_CLASS[style], 'text-[9px]', style !== 'sport' && style !== 'tech' && style !== 'market' && 'text-white/80')}>
              {verticalDef.hero.badge || 'Bienvenidos'}
            </span>
            <p className={cn('mt-1.5 text-base sm:text-lg leading-tight font-bold', STOREFRONT_HEADING_CLASS[style])}>
              {value.slogan || verticalDef.hero.title}
            </p>
            <p className="mt-1 text-[10px] text-white/85 line-clamp-2 leading-relaxed">
              {verticalDef.hero.subtitle}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <span className={cn('inline-block bg-white px-3 py-1 text-[10px] font-bold shadow-xs', radius, theme.ctaBtn, style === 'especial-para-barbero' && 'rounded-full bg-primary text-primary-foreground')}>
                {verticalDef.hero.ctaPrimaryText || 'Ver productos'}
              </span>
              {style !== 'catalog-basic' && (
                <span className={cn('inline-block border border-white/40 px-2 py-1 text-[9px] font-medium text-white/90', style === 'especial-para-barbero' ? 'rounded-full' : 'rounded')}>
                  {verticalDef.hero.ctaSecondaryText || 'WhatsApp'}
                </span>
              )}
            </div>
          </div>
        ) : (
          /* Portada Desactivada: Catálogo limpio directo con chips temáticos del rubro */
          <div className={cn('border-b px-3 py-2 space-y-1.5', style === 'especial-para-barbero' ? 'bg-[#111116] text-white border-primary/25' : 'bg-muted/20')}>
            <div className="flex items-center justify-between">
              <span className={cn('text-[10px] font-bold uppercase tracking-wider', style === 'especial-para-barbero' ? 'text-primary' : 'text-muted-foreground')}>
                Rubro: {verticalDef.icon} {verticalDef.verticalLabel}
              </span>
              <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                Carga rápida
              </span>
            </div>
            {/* Chips de categorías del rubro */}
            <div className="flex items-center gap-1 overflow-hidden">
              {verticalDef.previewChips.slice(0, isMobile ? 3 : 4).map((chip, idx) => (
                <span
                  key={chip}
                  className={cn(
                    'whitespace-nowrap px-2 py-0.5 text-[9px] font-medium',
                    style === 'especial-para-barbero' ? 'rounded-full' : 'rounded-md',
                    idx === 0
                      ? 'bg-primary text-primary-foreground font-bold'
                      : style === 'especial-para-barbero'
                      ? 'bg-white/10 border border-white/15 text-zinc-200'
                      : 'bg-background border border-border/70 text-foreground/80'
                  )}
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Grilla de productos adaptada al rubro */}
        <div className="p-3">
          <div className={cn('mb-2 flex items-center justify-between', style === 'especial-para-barbero' && 'rounded-md bg-[#111116] px-2 py-1 text-white')}>
            <p className={cn('text-xs font-bold', style === 'especial-para-barbero' ? 'text-white' : 'text-foreground', STOREFRONT_HEADING_CLASS[style])}>
              {style === 'services' ? 'Servicios del local' : 'Productos destacados'}
            </p>
            <span className={cn('text-[9px]', style === 'especial-para-barbero' ? 'text-primary font-semibold' : 'text-muted-foreground')}>
              {style === 'wholesale-pro' ? 'Precios por mayor' : style === 'especial-para-barbero' ? 'Minorista & Mayorista' : style === 'especial-cosmeticos' ? 'Rutinas & Ofertas' : style === 'catalog-basic' ? 'Vitrina digital' : 'Disponibles'}
            </span>
          </div>

          <div className={cn('grid gap-2', isMobile ? 'grid-cols-2' : 'grid-cols-3')}>
            {products.map((prod, index) => (
              <div key={index} className={cn('space-y-1.5 border p-1.5 shadow-2xs', style === 'especial-para-barbero' ? 'rounded-xl border-zinc-200/90 bg-white dark:border-zinc-800 dark:bg-zinc-900' : 'rounded-lg border-border/50 bg-card')}>
                <div className={cn('relative w-full bg-muted/70 flex items-center justify-center text-muted-foreground/50', radius, portrait ? 'aspect-[3/4]' : style === 'especial-para-barbero' ? 'aspect-square bg-zinc-50 dark:bg-zinc-950' : 'aspect-[4/3]')}>
                  <span className="text-base select-none">{verticalDef.icon}</span>
                  {prod.badge && (
                    <span className="absolute top-1 left-1 rounded bg-black/60 px-1 py-0.2 text-[8px] font-bold text-white uppercase">
                      {prod.badge}
                    </span>
                  )}
                </div>
                <div className={cn('space-y-0.5', style === 'especial-para-barbero' && 'text-center')}>
                  <p className={cn('text-[10px] font-bold text-foreground truncate leading-tight', style === 'especial-para-barbero' && 'uppercase')}>
                    {prod.name}
                  </p>
                  <p className={cn('text-[9px] font-semibold', style === 'especial-para-barbero' ? 'font-black text-emerald-600 dark:text-emerald-400' : 'text-primary')}>
                    {prod.price}
                  </p>
                </div>
                {style !== 'catalog-basic' ? (
                  <div className={cn('w-full py-0.5 text-center text-[8px] font-bold', style === 'especial-para-barbero' ? 'rounded-full bg-zinc-900 text-white dark:bg-primary dark:text-primary-foreground' : 'rounded bg-primary/10 text-primary')}>
                    {style === 'services' ? 'Reservar' : 'Agregar'}
                  </div>
                ) : (
                  <div className="w-full rounded bg-muted py-0.5 text-center text-[8px] font-medium text-muted-foreground">
                    Ver detalle
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </BrandColorScope>
  )
}
