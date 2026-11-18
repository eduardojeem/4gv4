'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Check,
  Clock,
  Cpu,
  Crown,
  Eye,
  Filter,
  Info,
  Layers,
  Lock,
  RotateCcw,
  Scissors,
  Search,
  Shirt,
  ShoppingBasket,
  Sparkles,
  Store,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StorefrontTemplateThumbnail } from '@/components/admin/website/StorefrontTemplateThumbnail'
import {
  STOREFRONT_STYLE_LABELS,
  resolveStorefrontStyle,
  type StorefrontStyle,
  type StorefrontStylePreference,
  type StorefrontTemplateGroupId,
} from '@/lib/website/storefront-style'
import { buildTemplateCatalog, type TemplateCatalogOption } from '@/lib/website/template-catalog'
import { TEMPLATE_TIER_LABEL } from '@/lib/website/template-plan-access'
import { useStorefrontTemplateAccess } from '@/hooks/use-storefront-template-access'
import type { PublicCommerceMode } from '@/types/website-settings'
import { cn } from '@/lib/utils'

interface StorefrontTemplateSelectorProps {
  value: StorefrontStylePreference
  onChange: (value: StorefrontStylePreference) => void
  onPreview?: (value: StorefrontStylePreference) => void
  businessVertical?: string | null
  /** Plantilla que sugiere el asistente, para marcarla en la grilla. */
  suggestedStyle?: StorefrontStylePreference
  /** Sin la agenda (módulo Servicios) no se ofrece la plantilla «Servicios». */
  servicesAvailable?: boolean
  /** Vende productos: sin productos, un negocio de servicios no ve plantillas de tienda. */
  catalogAvailable?: boolean
  /** Modo comercial resuelto de la tienda. */
  commerceMode?: PublicCommerceMode
}

export const TEMPLATE_GROUP_ICONS: Record<StorefrontTemplateGroupId, typeof Store> = {
  auto: Sparkles,
  general: Store,
  tech: Cpu,
  fashion: Shirt,
  beauty: Scissors,
  food: ShoppingBasket,
}

export const TEMPLATE_FEATURE_PILLS: Record<StorefrontStyle, string[]> = {
  'especial-cosmeticos': ['Carrusel boutique', 'Marcas oficiales', 'Ofertas en Gs.', 'Perfil de local'],
  'especial-para-barbero': ['Mega menú 4 col', 'Modo mayorista', 'Estética oscura', 'Marcas'],
  beauty: ['Categorías circulares', 'Rutina de cuidado', 'Marcas', 'Ofertas'],
  services: ['Turnero online', 'Carta de servicios', 'Equipo y horarios', 'Sin carrito'],
  barber: ['Rituales y navaja', 'Turnero online', 'Barberos', 'Club exclusivo'],
  'informatica-electronica': ['Header técnico', 'Filtro por marcas', 'Ofertas % OFF', 'Buscador rápido'],
  tech: ['Micro-bordes tech', 'Ficha y garantía', 'Gamer & Gadgets', 'Buscador'],
  fashion: ['Fotos 3:4 a sangre', 'Tipografía serif', 'Colecciones', 'Lookbook'],
  sport: ['Badges en ángulo', 'Alto contraste', 'Zapatillas & Drops', 'Fitness'],
  market: ['Precios gigantes', 'Alta densidad', 'Supermercado', 'Compra ágil'],
  'wholesale-pro': ['Precios mayoristas', 'Buscador directo', 'Alta rotación', 'Catálogo B2B'],
  'catalog-basic': ['Sin carrito', 'Carga ultrarrápida', 'Modo vitrina', 'Mostrador'],
  classic: ['Tarjetas 4:3', 'Fácil de usar', 'Universal', 'Multirrubro'],
  modern: ['Bordes redondeados', 'Diseño de autor', 'Minimalista', 'Elegante'],
}

const CHANGE_PLAN_HREF = '/admin/subscriptions/change-plan'

/**
 * Grilla enriquecida con todas las plantillas, agrupadas por rubro.
 * Incluye hero de plantilla activa, buscador en tiempo real, pastillas de funciones clave,
 * y acceso a vista previa rápida sin alterar el borrador.
 */
export function StorefrontTemplateSelector({
  value,
  onChange,
  onPreview,
  businessVertical,
  suggestedStyle,
  servicesAvailable,
  catalogAvailable,
  commerceMode,
}: StorefrontTemplateSelectorProps) {
  // La plantilla con la que abrió la pantalla se puede conservar aunque el plan ya no la incluya.
  const [savedValue] = useState(value)
  const [selectedFilter, setSelectedFilter] = useState<'all' | StorefrontTemplateGroupId>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const { access } = useStorefrontTemplateAccess()

  const groups = useMemo(
    () =>
      buildTemplateCatalog({
        businessVertical,
        context: { servicesAvailable, catalogAvailable, commerceMode },
        savedValue,
        suggestedStyle,
        access,
      }),
    [businessVertical, servicesAvailable, catalogAvailable, commerceMode, savedValue, suggestedStyle, access]
  )

  const activeResolvedStyle = useMemo(
    () => resolveStorefrontStyle(value, businessVertical, { servicesAvailable, catalogAvailable, commerceMode }),
    [value, businessVertical, servicesAvailable, catalogAvailable, commerceMode]
  )

  const activeOption = useMemo(() => {
    for (const group of groups) {
      const found = group.options.find((opt) => opt.value === value)
      if (found) return found
    }
    return null
  }, [groups, value])

  const total = groups.reduce((sum, group) => sum + group.options.length, 0)
  const comingSoonCount = groups.reduce(
    (sum, group) => sum + group.options.filter((option) => option.status === 'coming_soon').length,
    0
  )
  const availableTotal = total - comingSoonCount
  const included = groups.reduce(
    (sum, group) =>
      sum + group.options.filter((option) => option.status !== 'locked_plan' && option.status !== 'coming_soon').length,
    0
  )
  const lockedCount = groups.reduce(
    (sum, group) => sum + group.options.filter((option) => option.status === 'locked_plan').length,
    0
  )

  const filteredGroups = useMemo(() => {
    const baseGroups = selectedFilter === 'all' ? groups : groups.filter((group) => group.id === selectedFilter)
    if (!searchQuery.trim()) return baseGroups

    const q = searchQuery.trim().toLowerCase()
    return baseGroups
      .map((group) => {
        const filteredOptions = group.options.filter((opt) => {
          const nameMatch = opt.label.toLowerCase().includes(q)
          const descMatch = opt.description.toLowerCase().includes(q)
          const subMatch = opt.subtitle.toLowerCase().includes(q)
          const groupMatch = group.title.toLowerCase().includes(q) || group.label.toLowerCase().includes(q)
          const featureMatch = (TEMPLATE_FEATURE_PILLS[opt.resolvedStyle] || []).some((feat) =>
            feat.toLowerCase().includes(q)
          )
          return nameMatch || descMatch || subMatch || groupMatch || featureMatch
        })
        return { ...group, options: filteredOptions }
      })
      .filter((group) => group.options.length > 0)
  }, [groups, selectedFilter, searchQuery])

  const matchingCount = useMemo(() => {
    return filteredGroups.reduce((acc, g) => acc + g.options.length, 0)
  }, [filteredGroups])

  return (
    <div role="group" aria-labelledby="storefrontStyleLabel" className="space-y-6">
      {/* ── Banner de suscripción / plan ── */}
      {access && (
        <div className="flex flex-col gap-2 rounded-xl border border-border/70 bg-muted/30 px-3.5 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between shadow-2xs">
          <p className="flex items-center gap-1.5 text-muted-foreground">
            <Crown aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span>
              Tu plan <strong className="text-foreground">{access.planName}</strong> incluye{' '}
              <strong className="text-foreground">
                {included} de {availableTotal}
              </strong>{' '}
              plantillas
              {comingSoonCount > 0 ? ` · ${comingSoonCount} próximamente` : ''}.
            </span>
          </p>
          {lockedCount > 0 && (
            <Link href={CHANGE_PLAN_HREF} className="font-semibold text-primary hover:underline">
              Ver planes para desbloquear {lockedCount === 1 ? 'la otra' : `las otras ${lockedCount}`}
            </Link>
          )}
        </div>
      )}

      {/* ── Hero de Plantilla Activa ── */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-background to-muted/40 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 min-w-0">
            <div className="relative h-20 w-32 sm:h-24 sm:w-40 shrink-0 overflow-hidden rounded-xl border border-border shadow-xs bg-muted/40">
              <StorefrontTemplateThumbnail style={activeResolvedStyle} className="h-full w-full object-cover" />
              <span className="absolute bottom-1 right-1 flex items-center gap-1 rounded bg-black/80 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur-xs">
                <Check className="h-2.5 w-2.5 text-primary" />
                En uso
              </span>
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-primary-foreground shadow-xs">
                  <Sparkles className="h-3 w-3" />
                  Plantilla activa
                </span>
                <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                  {activeOption?.subtitle || STOREFRONT_STYLE_LABELS[activeResolvedStyle]}
                </span>
                {value === 'auto' && (
                  <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    Automática según tu rubro
                  </span>
                )}
              </div>
              <h4 className="text-base font-black tracking-tight text-foreground sm:text-lg">
                {activeOption?.label || STOREFRONT_STYLE_LABELS[activeResolvedStyle]}
              </h4>
              <p className="line-clamp-2 max-w-xl text-xs text-muted-foreground">
                {activeOption?.description || 'Diseño visual activo actualmente en el inicio de tu tienda pública.'}
              </p>
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {(TEMPLATE_FEATURE_PILLS[activeResolvedStyle] || []).map((feat) => (
                  <span
                    key={feat}
                    className="rounded-md border border-border/80 bg-background/80 px-2 py-0.5 text-[10px] font-semibold text-foreground/80 shadow-2xs"
                  >
                    {feat}
                  </span>
                ))}
              </div>
            </div>
          </div>
          {onPreview && (
            <div className="shrink-0 pt-2 sm:pt-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onPreview(value)}
                className="w-full sm:w-auto h-9 gap-1.5 font-bold shadow-xs border-primary/30 hover:bg-primary hover:text-primary-foreground transition-all"
              >
                <Eye className="h-4 w-4" />
                Ver vista previa
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ── Buscador y Filtros interactivos ── */}
      <div className="space-y-3">
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar plantilla por nombre, rubro o función (ej: carrusel, turnos, tech, moda, marcas)..."
            className="h-10 rounded-xl border-border/80 bg-card pl-9 pr-9 text-sm shadow-2xs focus-visible:ring-primary"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Limpiar búsqueda"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* ── Filtro por rubro ── */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-3">
          <span className="mr-1 flex items-center gap-1 text-xs font-black uppercase tracking-wider text-muted-foreground">
            <Filter aria-hidden="true" className="h-3.5 w-3.5 text-primary" />
            Rubro:
          </span>
          <FilterButton
            active={selectedFilter === 'all'}
            onClick={() => setSelectedFilter('all')}
            icon={Layers}
            label="Todas"
            count={total}
            ariaLabel="Ver todas las plantillas"
          />
          {groups.map((group) => (
            <FilterButton
              key={group.id}
              active={selectedFilter === group.id}
              onClick={() => setSelectedFilter(group.id)}
              icon={TEMPLATE_GROUP_ICONS[group.id] ?? Store}
              label={group.label}
              count={group.options.length}
              ariaLabel={`Filtrar por rubro: ${group.label}`}
              marked={group.options.some((option) => option.value === value)}
            />
          ))}
        </div>

        {searchQuery.trim() && (
          <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
            <span>
              Mostrando <strong className="text-foreground">{matchingCount}</strong>{' '}
              {matchingCount === 1 ? 'plantilla' : 'plantillas'} para &ldquo;{searchQuery}&rdquo;
            </span>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="font-semibold text-primary hover:underline"
            >
              Limpiar búsqueda
            </button>
          </div>
        )}
      </div>

      {/* ── Grilla de plantillas por grupo ── */}
      {filteredGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-muted/20 p-8 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Search className="h-6 w-6" />
          </div>
          <h4 className="text-sm font-bold text-foreground">No se encontraron plantillas</h4>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            No hay ninguna plantilla que coincida con &ldquo;{searchQuery}&rdquo;
            {selectedFilter !== 'all' ? ' en este rubro' : ''}. Probá con otro término o limpiá la búsqueda.
          </p>
          <div className="mt-4 flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery('')
                setSelectedFilter('all')
              }}
              className="gap-1.5 text-xs font-bold"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restablecer filtros
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {filteredGroups.map((group) => {
            const Icon = TEMPLATE_GROUP_ICONS[group.id] ?? Store
            return (
              <section key={group.id} aria-labelledby={`template-group-${group.id}`} className="space-y-3.5">
                <div className="flex flex-col justify-between gap-1.5 border-b border-border/60 pb-2 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                      <Icon aria-hidden="true" className="h-4 w-4" />
                    </span>
                    <h3
                      id={`template-group-${group.id}`}
                      className="flex items-center gap-2 text-sm font-black tracking-tight text-foreground"
                    >
                      {group.title}
                      <span className="rounded-full border border-primary/20 bg-primary/10 px-2 text-[10px] font-bold text-primary">
                        {group.badge}
                      </span>
                    </h3>
                  </div>
                  <p className="max-w-md text-xs font-medium text-muted-foreground sm:text-right">{group.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                  {group.options.map((option) => (
                    <TemplateCard
                      key={option.value}
                      option={option}
                      selected={value === option.value}
                      current={savedValue === option.value}
                      onSelect={() => onChange(option.value)}
                      onPreview={onPreview}
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

function FilterButton({
  active,
  onClick,
  icon: Icon,
  label,
  count,
  ariaLabel,
  marked = false,
}: {
  active: boolean
  onClick: () => void
  icon: typeof Store
  label: string
  count: number
  ariaLabel: string
  marked?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'relative inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'border border-border/80 bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      <span>{label}</span>
      <span className="rounded-full bg-black/10 px-1.5 text-[10px] dark:bg-white/10">{count}</span>
      {marked && !active && (
        <span className="h-1.5 w-1.5 rounded-full bg-primary" title="Tu plantilla está en este rubro" />
      )}
    </button>
  )
}

function TemplateCard({
  option,
  selected,
  current,
  onSelect,
  onPreview,
}: {
  option: TemplateCatalogOption
  selected: boolean
  current: boolean
  onSelect: () => void
  onPreview?: (value: StorefrontStylePreference) => void
}) {
  const blocked = option.status !== 'available'
  const features = TEMPLATE_FEATURE_PILLS[option.resolvedStyle] || []

  return (
    <div className="group relative flex flex-col">
      <button
        type="button"
        aria-pressed={selected}
        disabled={blocked}
        onClick={onSelect}
        title={option.reason ?? option.description}
        aria-describedby={blocked ? `template-reason-${option.value}` : undefined}
        className={cn(
          'relative flex flex-1 flex-col overflow-hidden rounded-xl border bg-card text-left transition-all w-full',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          selected ? 'border-primary ring-2 ring-primary shadow-sm' : 'border-border/80',
          !blocked && !selected && 'hover:border-primary/50 hover:shadow-md',
          blocked && 'cursor-not-allowed'
        )}
      >
        <span aria-hidden="true" className={cn('relative block w-full', blocked && 'opacity-50 grayscale-[40%]')}>
          <StorefrontTemplateThumbnail style={option.resolvedStyle} className="h-28 border-b bg-muted/30" />
        </span>

        {option.status === 'locked_plan' && (
          <span
            aria-hidden="true"
            className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-foreground/90 px-2 py-0.5 text-[10px] font-bold text-background shadow-sm"
          >
            <Lock aria-hidden="true" className="h-2.5 w-2.5" />
            {option.upgradePlanName ?? 'Otro plan'}
          </span>
        )}
        {option.status === 'coming_soon' && (
          <span
            aria-hidden="true"
            className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-amber-500/95 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm"
          >
            <Clock aria-hidden="true" className="h-2.5 w-2.5" />
            Próximamente
          </span>
        )}
        {(option.isSuggested || option.isRecommended) && option.status === 'available' && (
          <span
            aria-hidden="true"
            className="absolute left-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full bg-background/95 px-1.5 py-0.5 text-[10px] font-semibold text-primary shadow-sm"
          >
            <Sparkles aria-hidden="true" className="h-2.5 w-2.5" />
            {option.isRecommended ? 'Recomendada' : 'Sugerida'}
          </span>
        )}

        <span className="flex flex-1 flex-col gap-1 p-2.5">
          <span className="flex items-center justify-between gap-1">
            <span
              className={cn(
                'text-sm font-bold tracking-tight',
                blocked ? 'text-muted-foreground' : 'text-foreground'
              )}
            >
              {option.label}
            </span>
            {selected && (
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xs">
                <Check aria-hidden="true" className="h-2.5 w-2.5" />
              </span>
            )}
          </span>
          {' '}<span className="text-xs leading-snug text-muted-foreground line-clamp-1">{option.subtitle}</span>{' '}
          {(option.isSuggested || option.isRecommended) && option.status === 'available' && (
            <span className="sr-only">{option.isRecommended ? 'Recomendada' : 'Sugerida'} </span>
          )}

          {/* Pastillas de características clave */}
          {features.length > 0 && (
            <span className="mt-1 flex flex-wrap items-center gap-1">
              {features.slice(0, 2).map((feat) => (
                <span
                  key={feat}
                  className="rounded-md border border-border/70 bg-muted/40 px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground transition-colors group-hover:border-primary/30 group-hover:bg-primary/5 group-hover:text-primary"
                >
                  {feat}
                </span>
              ))}
            </span>
          )}

          <span className="mt-auto pt-2 flex flex-wrap items-center gap-1">
            {option.value !== 'auto' && (
              <span
                className={cn(
                  'rounded px-1.5 py-0.5 text-[10px] font-semibold',
                  option.tier === 'premium'
                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {TEMPLATE_TIER_LABEL[option.tier]}
              </span>
            )}
            {option.enabledPlans && option.enabledPlans.length > 0 && option.status !== 'coming_soon' && (
              <span className="rounded border border-border/70 bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {option.enabledPlans.length === 1 ? 'Plan' : 'Planes'}: {option.enabledPlans.join(', ')}
              </span>
            )}
            {current && (
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">Actual</span>
            )}
          </span>
          {blocked && option.reason && (
            <span
              id={`template-reason-${option.value}`}
              className="mt-1 flex items-start gap-1 text-[11px] leading-snug text-muted-foreground"
            >
              <Info aria-hidden="true" className="mt-px h-3 w-3 shrink-0" />
              {option.reason}
            </span>
          )}
        </span>
      </button>

      {/* Botón flotante de vista previa rápida */}
      {onPreview && (
        <button
          type="button"
          aria-label={`Vista previa rápida de ${option.label}`}
          title={`Vista previa rápida de ${option.label}`}
          onClick={(e) => {
            e.stopPropagation()
            onPreview(option.value)
          }}
          className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-lg border border-border/80 bg-background/90 text-foreground/80 shadow-xs backdrop-blur-xs transition-all hover:scale-105 hover:border-primary hover:bg-primary hover:text-primary-foreground active:scale-95"
        >
          <Eye aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
