'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Play, Pause, Sparkles } from 'lucide-react'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
import { cn } from '@/lib/utils'
import { getBrandLogoOrFallback } from '@/lib/website/brand-catalog'
import type { BrandsSectionSettings } from '@/types/website-settings'

interface BrandDisplayItem {
  id: string
  name: string
  imageUrl?: string
  href?: string
  svgLogo: React.ReactNode
}

export function buildBrandTickerItems<T>(items: T[]): T[] {
  return items.length === 0 ? [] : [...items, ...items]
}

function StoreBrandCard({
  brand,
  tenantPrefix,
  tabIndex,
}: {
  brand: BrandDisplayItem
  tenantPrefix: string
  tabIndex?: number
}) {
  const [imageError, setImageError] = useState(false)
  const href = brand.href || `${tenantPrefix}/productos?marca=${encodeURIComponent(brand.name)}`
  const hasCustomImage = Boolean(brand.imageUrl && !imageError)

  return (
    <Link
      href={href}
      tabIndex={tabIndex}
      aria-hidden={tabIndex === -1 ? true : undefined}
      className="group shrink-0 transition-transform duration-300 focus-visible:outline-none"
      aria-label={`Ver colección ${brand.name}`}
    >
      <div className="flex h-14 w-28 sm:h-16 sm:w-36 items-center justify-center rounded-xl border border-border/70 bg-card px-4 py-2 shadow-xs transition-all duration-300 opacity-85 hover:opacity-100 hover:scale-105 hover:border-primary/50 hover:shadow-md text-foreground">
        <div className="flex items-center justify-center max-h-8 max-w-full">
          {hasCustomImage ? (
            // Las marcas permiten URLs administrables y dominios no conocidos en build.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={brand.imageUrl!}
              alt={brand.name}
              className="max-h-7 max-w-[85px] sm:max-w-[100px] object-contain transition-transform duration-300 group-hover:scale-105"
              onError={() => setImageError(true)}
            />
          ) : (
            brand.svgLogo
          )}
        </div>
      </div>
    </Link>
  )
}

export function StoreBrandTicker({
  settings,
  title,
}: {
  settings?: BrandsSectionSettings
  title?: string
}) {
  const pathname = usePathname()
  const tenantSlug = getTenantSlugFromPathname(pathname)
  const tenantPrefix = tenantSlug ? `/${tenantSlug}` : ''

  // Estado para pausar o reanudar el movimiento continuo
  const [isPaused, setIsPaused] = useState(false)

  // Si la sección está deshabilitada por el administrador, no se muestra
  const isEnabled = Boolean(settings?.enabled)

  // Marcas configuradas en el panel que tienen activo el switch "Público"
  const configuredBrands = useMemo<BrandDisplayItem[]>(() => {
    if (!settings?.items || settings.items.length === 0) return []
    return settings.items
      .filter((item) => item.active) // <-- Solamente las marcas que el usuario eligió como PÚBLICAS
      .map((item) => ({
        id: item.id,
        name: item.name,
        imageUrl: item.imageUrl,
        svgLogo: getBrandLogoOrFallback(item.id) || getBrandLogoOrFallback(item.name) || (
          <span className="font-extrabold uppercase tracking-tight text-xs sm:text-sm">
            {item.name}
          </span>
        ),
        href: item.href || `${tenantPrefix}/productos?marca=${encodeURIComponent(item.name)}`,
      }))
  }, [settings, tenantPrefix])

  // Mostrar exclusivamente las marcas que el usuario configuró y activó en el panel
  const displayBrands = useMemo(() => {
    return configuredBrands
  }, [configuredBrands])

  // Asegurar suficientes elementos para un bucle continuo suave (mínimo 6 tarjetas por pista)
  const baseList = useMemo(() => {
    if (displayBrands.length === 0) return []
    let list = [...displayBrands]
    while (list.length < 6) {
      list = [...list, ...displayBrands]
    }
    return list
  }, [displayBrands])

  // Duración dinámica para un movimiento fluido y constante
  const animationDuration = useMemo(() => {
    const seconds = Math.max(22, baseList.length * 3.5)
    return `${seconds}s`
  }, [baseList.length])

  if (!isEnabled || displayBrands.length === 0) {
    return null
  }

  const headingText = title || settings?.title || 'Marcas destacadas'
  const subtitleText = settings?.subtitle || 'Encontrá productos originales con garantía y respaldo de marca'

  return (
    <section className="border-b border-border/80 bg-background py-8 sm:py-10 overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Cabecera con Título, Subtítulo y Controles de Movimiento */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
              <h2 className="text-xs sm:text-sm font-bold uppercase tracking-[0.2em] text-foreground">
                {headingText}
              </h2>
            </div>
            {subtitleText && (
              <p className="mt-1 text-[11px] sm:text-xs text-muted-foreground/80">
                {subtitleText}
              </p>
            )}
          </div>

          {/* Controles de Movimiento y Pausa */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* Indicador de estado de animación */}
            <button
              type="button"
              onClick={() => setIsPaused((p) => !p)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all shadow-2xs cursor-pointer',
                !isPaused
                  ? 'border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'border-border/80 bg-muted/60 text-muted-foreground hover:bg-muted'
              )}
              title={!isPaused ? 'Pausar movimiento automático' : 'Activar movimiento automático'}
              aria-label={!isPaused ? 'Estado de la marquesina: en movimiento' : 'Estado de la marquesina: pausada'}
            >
              <span className="relative flex h-2 w-2">
                {!isPaused && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                )}
                <span
                  className={cn(
                    'relative inline-flex h-2 w-2 rounded-full',
                    !isPaused ? 'bg-emerald-500' : 'bg-muted-foreground/60'
                  )}
                />
              </span>
              <span>{!isPaused ? 'En movimiento' : 'Pausado'}</span>
            </button>

            {/* Botón de Play / Pausa */}
            <button
              type="button"
              onClick={() => setIsPaused((p) => !p)}
              aria-label={!isPaused ? 'Pausar movimiento automático' : 'Reanudar movimiento automático'}
              title={!isPaused ? 'Pausar movimiento' : 'Reanudar movimiento'}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-xl border border-border/80 bg-background shadow-xs transition-all hover:bg-muted cursor-pointer',
                !isPaused ? 'text-primary border-primary/40' : 'text-muted-foreground'
              )}
            >
              {!isPaused ? (
                <Pause className="h-3.5 w-3.5 fill-current" />
              ) : (
                <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
              )}
            </button>
          </div>
        </div>

        {/* Contenedor del Carrusel con Desvanecimiento Lateral y Movimiento Continuo */}
        <div className="relative w-full select-none overflow-hidden py-1">
          {/* Sombras de desvanecimiento lateral en ambos bordes */}
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 sm:w-28 bg-gradient-to-r from-background via-background/80 to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 sm:w-28 bg-gradient-to-l from-background via-background/80 to-transparent" />

          {/* Fila horizontal con animación infinita continua (Dual-Track Marquee con pausa al pasar el cursor) */}
          <div
            className="flex w-max items-center gap-4 py-3 sm:gap-6 animate-marquee-left hover:[animation-play-state:paused] motion-reduce:animate-none"
            style={{
              animationDuration,
              animationPlayState: isPaused ? 'paused' : undefined,
            }}
          >
            {/* Pista 1 */}
            <div className="flex shrink-0 items-center gap-4 sm:gap-6">
              {baseList.map((brand, idx) => (
                <StoreBrandCard
                  key={`track1-${brand.id}-${idx}`}
                  brand={brand}
                  tenantPrefix={tenantPrefix}
                />
              ))}
            </div>

            {/* Pista 2 (Duplicado idéntico para bucle continuo infinito sin saltos) */}
            <div className="flex shrink-0 items-center gap-4 sm:gap-6" aria-hidden="true">
              {baseList.map((brand, idx) => (
                <StoreBrandCard
                  key={`track2-${brand.id}-${idx}`}
                  brand={brand}
                  tenantPrefix={tenantPrefix}
                  tabIndex={-1}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
