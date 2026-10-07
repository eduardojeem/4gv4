import type { CSSProperties, ReactNode } from 'react'
import { isValidBrandHexColor } from '@/lib/website/brand-color'
import { usesPortraitMedia, type StorefrontStyle } from '@/lib/website/storefront-style'
import { cn } from '@/lib/utils'

/**
 * Pinta a sus hijos con el color de marca elegido, igual que la tienda
 * pública: `bg-primary` y compañía toman ese color adentro.
 */
export function BrandColorScope({
  brandColor,
  customBrandColor,
  className,
  children,
}: {
  brandColor?: string
  customBrandColor?: string
  className?: string
  children: ReactNode
}) {
  const custom = brandColor === 'custom' && isValidBrandHexColor(customBrandColor)
  return (
    <div
      className={className}
      data-color-scheme={custom ? undefined : brandColor && brandColor !== 'custom' ? brandColor : 'blue'}
      data-custom-brand={custom ? '' : undefined}
      style={custom ? ({ '--brand-primary': customBrandColor } as CSSProperties) : undefined}
    >
      {children}
    </div>
  )
}

function Bar({ className }: { className?: string }) {
  return <span className={cn('block h-1 rounded-full bg-foreground/25', className)} />
}

function NavRow({ dark = false, square = false }: { dark?: boolean; square?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between px-1.5 py-1', dark && 'bg-slate-950')}>
      <div className="flex items-center gap-1">
        <span className={cn('h-2.5 w-2.5 bg-primary', square ? 'rounded-none' : 'rounded-full')} />
        <Bar className={cn('w-7', dark && 'bg-white/50')} />
      </div>
      <div className="flex gap-1">
        <Bar className={cn('w-3', dark && 'bg-white/30')} />
        <Bar className={cn('w-3', dark && 'bg-white/30')} />
      </div>
    </div>
  )
}

function ProductRow({ style, count = 3 }: { style: StorefrontStyle; count?: number }) {
  const portrait = usesPortraitMedia(style)
  return (
    <div className={cn('grid gap-1', count === 4 ? 'grid-cols-4' : 'grid-cols-3')}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={cn('overflow-hidden border border-border/60 bg-card', style === 'fashion' ? 'rounded-none border-transparent' : style === 'modern' ? 'rounded-lg' : 'rounded')}>
          <div className={cn('w-full bg-muted-foreground/15', portrait ? 'aspect-[3/4]' : 'aspect-[4/3]')} />
          <div className="space-y-0.5 p-0.5">
            <Bar className={cn('w-4/5', style === 'sport' && 'bg-foreground/60')} />
            <span className={cn('block h-1 w-1/2 rounded-full bg-primary', style === 'market' && 'h-1.5 w-3/4 bg-emerald-600')} />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Miniatura decorativa de una plantilla, con el color de marca de quien la
 * mira. Cada una repite la estructura real de su portada, no solo los colores.
 */
export function StorefrontTemplateThumbnail({ style, className }: { style: StorefrontStyle; className?: string }) {
  return (
    <div aria-hidden="true" className={cn('flex select-none flex-col gap-1 overflow-hidden bg-background p-1.5', className)}>
      {style === 'classic' && (
        <>
          <NavRow />
          <div className="flex items-center justify-between rounded-md bg-gradient-to-r from-primary to-primary/70 px-2 py-2">
            <div className="space-y-1">
              <span className="block h-1.5 w-14 rounded-full bg-white/90" />
              <span className="block h-1 w-10 rounded-full bg-white/60" />
            </div>
            <span className="h-3 w-6 rounded bg-white" />
          </div>
          <ProductRow style={style} />
        </>
      )}

      {style === 'fashion' && (
        <>
          <NavRow square />
          <div className="grid grid-cols-5 gap-1">
            <div className="col-span-3 flex flex-col justify-end bg-stone-900 p-1.5">
              <span className="font-serif text-[8px] uppercase tracking-[0.25em] text-stone-100">Colección</span>
              <span className="mt-0.5 block h-0.5 w-6 bg-stone-300" />
            </div>
            <div className="col-span-2 grid gap-1">
              <div className="aspect-[4/3] bg-stone-300 dark:bg-stone-700" />
              <div className="aspect-[4/3] bg-stone-200 dark:bg-stone-800" />
            </div>
          </div>
          <div className="flex gap-1">
            {['Mujer', 'Hombre', 'Niños'].map((label) => (
              <span key={label} className="flex-1 border border-foreground/20 py-0.5 text-center text-[6px] uppercase tracking-widest text-foreground/70">
                {label}
              </span>
            ))}
          </div>
          <ProductRow style={style} />
        </>
      )}

      {style === 'sport' && (
        <>
          <NavRow dark />
          <div className="relative overflow-hidden bg-slate-950 px-2 py-2">
            <span className="absolute -right-2 inset-y-0 w-10 -skew-x-12 bg-primary" />
            <span className="relative block text-[9px] font-black uppercase italic leading-none tracking-tighter text-white">New drop</span>
            <span className="relative mt-1 block h-1 w-8 -skew-x-12 bg-lime-300" />
          </div>
          <div className="flex gap-1">
            {['Run', 'Train', 'Outdoor'].map((label) => (
              <span key={label} className="flex-1 -skew-x-6 bg-foreground py-0.5 text-center text-[6px] font-black uppercase italic text-background">
                {label}
              </span>
            ))}
          </div>
          <ProductRow style={style} />
        </>
      )}

      {style === 'tech' && (
        <>
          <NavRow dark />
          <div className="flex items-center justify-between rounded-md bg-slate-900 px-2 py-2 ring-1 ring-primary/40">
            <span className="font-mono text-[8px] font-bold text-primary">NEW GEN</span>
            <span className="h-5 w-3 rounded-sm border border-primary/60 bg-slate-800" />
          </div>
          <ProductRow style={style} />
        </>
      )}

      {style === 'market' && (
        <>
          <div className="flex items-center gap-1 rounded bg-primary px-1.5 py-1">
            <span className="h-2.5 w-2.5 rounded-full bg-white" />
            <span className="h-2 flex-1 rounded-full bg-white/90" />
          </div>
          <div className="flex items-center justify-between rounded bg-amber-300 px-1.5 py-1">
            <span className="text-[7px] font-black text-amber-950">OFERTAS −30%</span>
            <span className="h-1.5 w-5 rounded-full bg-amber-950/40" />
          </div>
          <div className="flex gap-1">
            {Array.from({ length: 5 }, (_, index) => (
              <span key={index} className="flex flex-1 flex-col items-center gap-0.5">
                <span className="h-3 w-3 rounded-full bg-primary/15 ring-1 ring-primary/30" />
                <Bar className="w-3" />
              </span>
            ))}
          </div>
          <ProductRow style={style} count={4} />
        </>
      )}

      {style === 'modern' && (
        <>
          <NavRow />
          <div className="rounded-xl bg-gradient-to-br from-primary/25 to-primary/5 px-2 py-2">
            <span className="block text-[8px] font-semibold text-foreground">Studio</span>
            <span className="mt-1 block h-2 w-8 rounded-full bg-primary/70" />
          </div>
          <ProductRow style={style} />
        </>
      )}

      {style === 'beauty' && (
        <>
          <NavRow />
          <div className="flex items-center justify-between rounded-xl bg-gradient-to-br from-pink-100 via-rose-50 to-fuchsia-100 px-2 py-2 dark:from-pink-950/40 dark:to-fuchsia-950/30">
            <div className="space-y-1">
              <span className="block font-serif text-[8px] text-foreground">Tu rutina</span>
              <span className="block h-1 w-8 rounded-full bg-pink-400/70" />
            </div>
            <span className="h-6 w-4 rounded-md bg-white shadow-xs ring-1 ring-pink-200" />
          </div>
          <div className="flex justify-between">
            {[0, 1, 2, 3].map((index) => (
              <span key={index} className="h-4 w-4 rounded-full bg-pink-100 ring-1 ring-pink-300 dark:bg-pink-950/40" />
            ))}
          </div>
          <ProductRow style={style} />
        </>
      )}

      {style === 'services' && (
        <>
          <NavRow dark />
          <div className="flex items-center justify-between rounded-lg bg-slate-950 px-2 py-2">
            <div className="space-y-1">
              <span className="block font-serif text-[8px] text-white">Tu mejor versión</span>
              <span className="block h-1 w-10 rounded-full bg-white/40" />
            </div>
            <span className="rounded-full bg-primary px-1.5 py-0.5 text-[6px] font-semibold text-primary-foreground">Reservar</span>
          </div>
          <div className="space-y-1 rounded-lg border border-border/60 bg-card p-1.5">
            {['Corte', 'Color', 'Barba'].map((label) => (
              <div key={label} className="flex items-center justify-between gap-1">
                <span className="text-[6px] text-foreground/80">{label}</span>
                <span className="h-px flex-1 border-b border-dotted border-foreground/25" />
                <span className="h-1 w-4 rounded-full bg-primary" />
              </div>
            ))}
          </div>
          <div className="flex gap-1">
            {[0, 1, 2].map((index) => (
              <span key={index} className="h-3.5 w-3.5 rounded-full bg-muted-foreground/20 ring-1 ring-background" />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
