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
import type { CompanyInfo } from '@/types/website-settings'
import { cn } from '@/lib/utils'

const HEADER_CLASSES = {
  solid: { bar: 'bg-background text-foreground', topBar: 'bg-primary/10 text-foreground/80', logo: 'bg-primary text-primary-foreground', muted: 'text-muted-foreground', active: 'bg-accent text-foreground', cta: 'bg-primary text-primary-foreground' },
  accent: { bar: 'bg-primary text-primary-foreground', topBar: 'bg-black/15 text-primary-foreground/90', logo: 'bg-white text-primary', muted: 'text-primary-foreground/75', active: 'bg-white text-primary', cta: 'bg-white text-primary' },
  dark: { bar: 'bg-slate-950 text-white', topBar: 'bg-slate-900 text-slate-400', logo: 'bg-primary text-primary-foreground', muted: 'text-slate-400', active: 'bg-white/10 text-white', cta: 'bg-primary text-primary-foreground' },
} as const

/**
 * Maqueta liviana del borrador: cambia al instante con cada clic, sin cargar la
 * tienda real. Usa las mismas clases de tipografía y esquinas que la tienda.
 */
export function StorefrontAppearancePreview({ value, style }: { value: CompanyInfo; style: StorefrontStyle }) {
  const header = HEADER_CLASSES[headerOptionFor(value.headerStyle)]
  const theme = getBrandTheme(value.brandColor)
  const radius = STOREFRONT_RADIUS_CLASS[style]
  const portrait = usesPortraitMedia(style)
  const name = value.name?.trim() || 'Tu tienda'

  return (
    <BrandColorScope
      brandColor={value.brandColor || 'blue'}
      customBrandColor={value.customBrandColor}
      className="overflow-hidden rounded-xl border bg-background text-foreground shadow-sm"
    >
      <div aria-hidden="true" className="select-none">
        {value.showTopBar !== false && (
          <div className={cn('flex justify-between gap-2 px-3 py-1 text-[9px]', header.topBar)}>
            <span className="truncate">{value.phone || value.whatsapp || '+595 981 000 000'}</span>
            <span className="truncate">{value.hours?.weekdays || 'Lun a Vie 8:00 - 18:00'}</span>
          </div>
        )}

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
              {value.slogan && <span className={cn('block truncate text-[9px]', header.muted)}>{value.slogan}</span>}
            </span>
          </div>
          <span className={cn('shrink-0 rounded-md px-2 py-1 text-[9px] font-semibold', header.cta)}>Contacto</span>
        </div>

        <div className={cn('bg-gradient-to-br px-4 py-5 text-white', theme.hero, style === 'fashion' && 'from-stone-900 via-stone-900 to-stone-800')}>
          <span className={cn(STOREFRONT_EYEBROW_CLASS[style], 'text-[9px]', style !== 'sport' && style !== 'tech' && style !== 'market' && 'text-white/80')}>
            Bienvenidos
          </span>
          <p className={cn('mt-1.5 text-lg leading-tight', STOREFRONT_HEADING_CLASS[style])}>
            {value.slogan || 'Lo mejor para vos'}
          </p>
          <span className={cn('mt-3 inline-block bg-white px-3 py-1.5 text-[10px] font-bold', radius, theme.ctaBtn)}>Ver productos</span>
        </div>

        <div className="p-3">
          <p className={cn('mb-2 text-xs', STOREFRONT_HEADING_CLASS[style])}>Destacados</p>
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((index) => (
              <div key={index} className="space-y-1">
                <div className={cn('w-full bg-muted', radius, portrait ? 'aspect-[3/4]' : 'aspect-[4/3]')} />
                <div className={cn('h-1.5 w-4/5 rounded-full bg-foreground/25', style === 'sport' && 'bg-foreground/60')} />
                <div className={cn('h-1.5 w-1/2 rounded-full bg-primary', style === 'market' && 'h-2 w-3/4')} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </BrandColorScope>
  )
}
