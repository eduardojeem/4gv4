import { brandPaletteStyle, isBrandPalette, type StorefrontBrandPalette } from '@/lib/website/brand-palette'
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
  brandPalette,
  className,
  children,
}: {
  brandColor?: string
  customBrandColor?: string
  brandPalette?: StorefrontBrandPalette | null
  className?: string
  children: ReactNode
}) {
  const custom = brandColor === 'custom' && isValidBrandHexColor(customBrandColor)
  return (
    <div
      className={className}
      data-color-scheme={custom ? undefined : brandColor && brandColor !== 'custom' ? brandColor : 'blue'}
      data-custom-brand={custom ? '' : undefined}
      data-storefront-palette={isBrandPalette(brandPalette) ? '' : undefined}
      style={{ ...(custom ? { '--brand-primary': customBrandColor } : {}), ...brandPaletteStyle(brandPalette) } as CSSProperties}
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
    <div data-storefront-template={style} aria-hidden="true" className={cn('flex select-none flex-col gap-1 overflow-hidden bg-background p-1.5', className)}>
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

      {style === 'wholesale-pro' && (<><NavRow /><div className="rounded border bg-background p-1"><Bar className="w-3/4" /></div><div className="rounded bg-primary/10 p-2"><Bar className="w-1/2" /></div><ProductRow style={style} count={4} /></>)}
      {style === 'informatica-electronica' && (
        <>
          <div className="bg-slate-900 px-1.5 py-1 text-white">
            <div className="flex items-center justify-between">
              <span className="h-2 w-2 rounded-xs bg-primary" />
              <div className="flex gap-1">
                <span className="h-1 w-3 rounded-full bg-white/60" />
                <span className="h-1 w-3 rounded-full bg-emerald-400" />
              </div>
            </div>
            <div className="mt-1 flex items-center justify-between rounded bg-slate-800 px-1 py-0.5">
              <span className="h-1 w-8 rounded-full bg-white/90" />
              <span className="h-1.5 w-3 rounded-xs bg-primary" />
            </div>
          </div>
          <div className="flex items-center justify-between rounded bg-muted/40 px-1.5 py-1 border border-border">
            <span className="text-[6px] font-black text-rose-500">OFERTAS</span>
            <span className="h-1 w-4 rounded-full bg-primary" />
          </div>
          <ProductRow style={style} count={3} />
        </>
      )}
      {style === 'catalog-basic' && (
        <>
          <NavRow />
          <div className="rounded border border-border/70 bg-muted/20 p-1.5 space-y-1">
            <Bar className="w-2/3 h-1 bg-foreground/70" />
            <Bar className="w-1/2 h-0.5 bg-muted-foreground/60" />
          </div>
          <div className="flex gap-1 overflow-hidden py-0.5">
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[6px] font-medium text-primary">Todos</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[6px] text-muted-foreground">Cat. 1</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[6px] text-muted-foreground">Cat. 2</span>
          </div>
          <ProductRow style={style} count={3} />
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
      {style === 'barber' && (
        <>
          <NavRow dark square />
          <div className="flex items-center justify-between rounded-lg bg-zinc-950 px-2 py-2 border border-amber-500/30">
            <div className="space-y-1">
              <span className="block font-serif text-[8px] tracking-wider text-amber-400">CLUB DE CABALLEROS</span>
              <span className="block h-1 w-10 rounded-full bg-amber-400/50" />
            </div>
            <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[6px] font-black text-zinc-950">Turnos</span>
          </div>
          <div className="space-y-1 rounded-lg border border-amber-500/20 bg-zinc-900/90 p-1.5">
            {['Ritual Barba', 'Corte de Autor', 'Toallas Calientes'].map((label) => (
              <div key={label} className="flex items-center justify-between gap-1">
                <span className="text-[6px] text-zinc-300">{label}</span>
                <span className="h-px flex-1 border-b border-dotted border-amber-500/30" />
                <span className="h-1 w-4 rounded-full bg-amber-500" />
              </div>
            ))}
          </div>
          <div className="flex gap-1">
            {[0, 1, 2].map((index) => (
              <span key={index} className="h-3.5 w-3.5 rounded-full bg-amber-500/30 ring-1 ring-amber-500/50" />
            ))}
          </div>
        </>
      )}
      {style === 'especial-para-barbero' && (
        <>
          <div className="overflow-hidden rounded-sm bg-[#0B0B0F]">
            <span className="block h-0.5 w-full bg-primary" />
            <div className="flex items-center justify-between px-1.5 py-1">
              <div className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-primary" />
                <span className="block h-1 w-7 rounded-full bg-white/75" />
              </div>
              <div className="flex gap-1">
                <span className="block h-1.5 w-4 rounded-full bg-primary/80" />
                <span className="block h-1.5 w-2 rounded-full bg-white/30" />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md border border-primary/30 bg-[#111116] px-2 py-1.5">
            <div className="space-y-1">
              <span className="block text-[7px] font-black uppercase tracking-wider text-white">PRO BARBER</span>
              <span className="block h-1 w-9 rounded-full bg-white/40" />
            </div>
            <span className="rounded-full bg-primary px-1.5 py-0.5 text-[6px] font-black uppercase text-primary-foreground">Mayorista</span>
          </div>
          <div className="flex items-center gap-1 rounded-sm bg-[#111116] px-1.5 py-0.5">
            <span className="h-2 w-0.5 rounded-full bg-primary" />
            <span className="text-[6px] font-black uppercase tracking-wider text-white">Catálogo</span>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {[0, 1, 2].map((index) => (
              <div key={index} className="overflow-hidden rounded-md border border-zinc-200 bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-900">
                <div className="aspect-square w-full rounded-xs bg-zinc-100 dark:bg-zinc-800" />
                <div className="mt-0.5 space-y-0.5 px-0.5">
                  <span className="block h-1 w-4/5 rounded-full bg-zinc-800/70 dark:bg-zinc-200/70" />
                  <span className="block h-1 w-1/2 rounded-full bg-emerald-600" />
                  <span className="block h-1.5 w-full rounded-full bg-zinc-900 dark:bg-primary" />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {style === 'especial-cosmeticos' && (
        <>
          <div className="overflow-hidden rounded-sm bg-[#FFFBF8] dark:bg-zinc-900 border-b border-rose-200/60 dark:border-rose-900/30">
            <div className="flex items-center justify-between px-1.5 py-1">
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-rose-400" />
                <span className="block h-1 w-7 rounded-full bg-stone-700 dark:bg-stone-200" />
              </div>
              <div className="flex gap-1">
                <span className="block h-1 w-3 rounded-full bg-rose-400/80" />
                <span className="block h-1.5 w-1.5 rounded-full bg-rose-500" />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-gradient-to-r from-rose-100/80 via-pink-50 to-amber-50/60 dark:from-zinc-900 dark:to-rose-950/40 p-1.5 border border-rose-200/50 dark:border-rose-900/40">
            <div className="space-y-0.5">
              <span className="block font-serif text-[7px] font-semibold text-stone-800 dark:text-stone-100">Boutique Glow</span>
              <span className="block h-0.5 w-8 rounded-full bg-rose-400/70" />
            </div>
            <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[5px] font-medium text-white shadow-2xs">Rutinas</span>
          </div>
          <div className="flex justify-between gap-1 px-0.5">
            {['Sérum', 'Crema', 'Solar'].map((label) => (
              <span key={label} className="rounded-full bg-rose-500/10 px-1.5 py-0.5 text-[5px] font-medium text-rose-700 dark:text-rose-300">
                {label}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-1">
            {[0, 1, 2].map((index) => (
              <div key={index} className="overflow-hidden rounded-xl border border-rose-100 bg-[#FFFDFB] p-0.5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
                <div className="aspect-[3/4] w-full rounded-lg bg-gradient-to-b from-rose-50 to-pink-100/50 dark:from-zinc-800 dark:to-zinc-850" />
                <div className="mt-0.5 space-y-0.5 px-0.5 text-center">
                  <span className="block h-0.5 w-3/4 mx-auto rounded-full bg-stone-700/70 dark:bg-stone-300/70" />
                  <span className="block h-1 w-1/2 mx-auto rounded-full bg-rose-600" />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {style === 'moda-femenina' && (
        <>
          <div className="overflow-hidden rounded-sm bg-[#FAF7F2] dark:bg-zinc-900 border-b border-[#736B63]/15">
            <div className="flex items-center justify-between px-1.5 py-1">
              <div className="flex items-center gap-1">
                <span className="font-serif text-[8px] font-bold text-stone-900 dark:text-stone-100">Modeza.</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="block h-0.5 w-2 rounded-full bg-[#E06B3A]" />
                <span className="block h-1 w-1 rounded-full bg-stone-400" />
                <span className="rounded-full bg-[#1A1A1A] px-1 py-0.2 text-[4px] font-semibold text-white">Shop</span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-[#FAF7F2] dark:bg-zinc-900 p-1.5 border border-[#736B63]/10 relative overflow-hidden">
            <div className="space-y-0.5 z-10">
              <span className="block text-[5px] uppercase tracking-wider text-[#E06B3A] font-bold">2026 Collection</span>
              <span className="block font-serif text-[7px] font-bold text-stone-800 dark:text-stone-100 leading-tight">Timeless</span>
              <span className="block font-serif italic text-[6px] text-[#E06B3A]">Elegance</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#C95627] to-[#E06B3A] shrink-0" />
          </div>
          <div className="flex justify-between gap-1 px-0.5">
            {['Dresses', 'Tops', 'Outerwear'].map((label) => (
              <span key={label} className="rounded-full bg-[#E06B3A]/10 px-1.5 py-0.5 text-[5px] font-medium text-[#E06B3A]">
                {label}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-1">
            {[0, 1, 2].map((index) => (
              <div key={index} className="overflow-hidden rounded-xl border border-stone-200/50 bg-white p-0.5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
                <div className="aspect-[3/4] w-full rounded-lg bg-gradient-to-b from-stone-100 to-amber-50 dark:from-zinc-800 dark:to-zinc-850" />
                <div className="mt-0.5 space-y-0.5 px-0.5 text-center">
                  <span className="block h-0.5 w-3/4 mx-auto rounded-full bg-stone-700/70 dark:bg-stone-300/70" />
                  <span className="block h-1 w-1/2 mx-auto rounded-full bg-[#E06B3A]" />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
