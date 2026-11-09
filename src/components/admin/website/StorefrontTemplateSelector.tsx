'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { Check, Cpu, Crown, Filter, Info, Layers, Lock, Scissors, Shirt, ShoppingBasket, Sparkles, Store } from 'lucide-react'
import { StorefrontTemplateThumbnail } from '@/components/admin/website/StorefrontTemplateThumbnail'
import { type StorefrontStylePreference, type StorefrontTemplateGroupId } from '@/lib/website/storefront-style'
import { buildTemplateCatalog, type TemplateCatalogOption } from '@/lib/website/template-catalog'
import { TEMPLATE_TIER_LABEL } from '@/lib/website/template-plan-access'
import { useStorefrontTemplateAccess } from '@/hooks/use-storefront-template-access'
import type { PublicCommerceMode } from '@/types/website-settings'
import { cn } from '@/lib/utils'

interface StorefrontTemplateSelectorProps {
  value: StorefrontStylePreference
  onChange: (value: StorefrontStylePreference) => void
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

const CHANGE_PLAN_HREF = '/admin/subscriptions/change-plan'

/**
 * Grilla con todas las plantillas, agrupadas por rubro (primero el de la cuenta).
 * Las que no trae el plan se ven con candado y el plan desde el que están; las
 * que no aplican al negocio, apagadas con el motivo. Las miniaturas toman el
 * color de marca del contenedor (ver BrandColorScope).
 */
export function StorefrontTemplateSelector({
  value,
  onChange,
  businessVertical,
  suggestedStyle,
  servicesAvailable,
  catalogAvailable,
  commerceMode,
}: StorefrontTemplateSelectorProps) {
  // La plantilla con la que abrió la pantalla se puede conservar aunque el plan ya no la incluya.
  const [savedValue] = useState(value)
  const [selectedFilter, setSelectedFilter] = useState<'all' | StorefrontTemplateGroupId>('all')
  const { access } = useStorefrontTemplateAccess()

  const groups = useMemo(
    () => buildTemplateCatalog({
      businessVertical,
      context: { servicesAvailable, catalogAvailable, commerceMode },
      savedValue,
      suggestedStyle,
      access,
    }),
    [businessVertical, servicesAvailable, catalogAvailable, commerceMode, savedValue, suggestedStyle, access]
  )

  const total = groups.reduce((sum, group) => sum + group.options.length, 0)
  const included = groups.reduce((sum, group) => sum + group.options.filter((option) => option.status !== 'locked_plan').length, 0)
  const lockedCount = total - included
  const visibleGroups = selectedFilter === 'all' ? groups : groups.filter((group) => group.id === selectedFilter)

  return (
    <div role="group" aria-labelledby="storefrontStyleLabel" className="space-y-5">
      {access && (
        <div className="flex flex-col gap-2 rounded-xl border border-border/70 bg-muted/30 px-3 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-1.5 text-muted-foreground">
            <Crown aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span>
              Tu plan <strong className="text-foreground">{access.planName}</strong> incluye{' '}
              <strong className="text-foreground">{included} de {total}</strong> plantillas.
            </span>
          </p>
          {lockedCount > 0 && (
            <Link href={CHANGE_PLAN_HREF} className="font-semibold text-primary hover:underline">
              Ver planes para desbloquear {lockedCount === 1 ? 'la otra' : `las otras ${lockedCount}`}
            </Link>
          )}
        </div>
      )}

      {/* ── Filtro por rubro ── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-2">
        <span className="mr-1 flex items-center gap-1 text-xs font-black uppercase tracking-wider text-muted-foreground">
          <Filter aria-hidden="true" className="h-3.5 w-3.5 text-primary" />
          Rubro:
        </span>
        <FilterButton active={selectedFilter === 'all'} onClick={() => setSelectedFilter('all')} icon={Layers} label="Todas" count={total} ariaLabel="Ver todas las plantillas" />
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

      <div className="space-y-8">
        {visibleGroups.map((group) => {
          const Icon = TEMPLATE_GROUP_ICONS[group.id] ?? Store
          return (
            <section key={group.id} aria-labelledby={`template-group-${group.id}`} className="space-y-3.5">
              <div className="flex flex-col justify-between gap-1.5 border-b border-border/60 pb-2 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                    <Icon aria-hidden="true" className="h-4 w-4" />
                  </span>
                  <h3 id={`template-group-${group.id}`} className="flex items-center gap-2 text-sm font-black tracking-tight text-foreground">
                    {group.title}
                    <span className="rounded-full border border-primary/20 bg-primary/10 px-2 text-[10px] font-bold text-primary">{group.badge}</span>
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
                  />
                ))}
              </div>
            </section>
          )
        })}
      </div>
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
        active ? 'bg-primary text-primary-foreground shadow-sm' : 'border border-border/80 bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      <span>{label}</span>
      <span className="rounded-full bg-black/10 px-1.5 text-[10px] dark:bg-white/10">{count}</span>
      {marked && !active && <span className="h-1.5 w-1.5 rounded-full bg-primary" title="Tu plantilla está en este rubro" />}
    </button>
  )
}

function TemplateCard({
  option,
  selected,
  current,
  onSelect,
}: {
  option: TemplateCatalogOption
  selected: boolean
  current: boolean
  onSelect: () => void
}) {
  const blocked = option.status !== 'available'
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={blocked}
      onClick={onSelect}
      title={option.reason ?? option.description}
      aria-describedby={blocked ? `template-reason-${option.value}` : undefined}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-xl border bg-card text-left transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        selected ? 'border-primary ring-1 ring-primary' : 'border-border',
        !blocked && !selected && 'hover:border-foreground/25 hover:shadow-sm',
        blocked && 'cursor-not-allowed'
      )}
    >
      <span aria-hidden="true" className={cn('relative block', blocked && 'opacity-50 grayscale-[40%]')}>
        <StorefrontTemplateThumbnail style={option.resolvedStyle} className="h-28 border-b bg-muted/30" />
      </span>

      {option.status === 'locked_plan' && (
        <span aria-hidden="true" className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-foreground/90 px-2 py-0.5 text-[10px] font-bold text-background shadow-sm">
          <Lock aria-hidden="true" className="h-2.5 w-2.5" />
          {option.upgradePlanName ?? 'Otro plan'}
        </span>
      )}
      {(option.isSuggested || option.isRecommended) && option.status === 'available' && (
        <span aria-hidden="true" className="absolute right-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full bg-background/95 px-1.5 py-0.5 text-[10px] font-semibold text-primary shadow-sm">
          <Sparkles aria-hidden="true" className="h-2.5 w-2.5" />
          {option.isRecommended ? 'Recomendada' : 'Sugerida'}
        </span>
      )}

      <span className="flex flex-1 flex-col gap-0.5 p-2.5">
        <span className="flex items-center justify-between gap-1">
          <span className={cn('text-sm font-semibold', blocked && 'text-muted-foreground')}>{option.label}</span>
          {selected && (
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check aria-hidden="true" className="h-2.5 w-2.5" />
            </span>
          )}
        </span>
        {' '}<span className="text-xs leading-snug text-muted-foreground">{option.subtitle}</span>{' '}
        {(option.isSuggested || option.isRecommended) && option.status === 'available' && (
          <span className="sr-only">{option.isRecommended ? 'Recomendada' : 'Sugerida'} </span>
        )}
        <span className="mt-1 flex flex-wrap items-center gap-1">
          {option.value !== 'auto' && (
            <span className={cn(
              'rounded px-1.5 py-0.5 text-[10px] font-semibold',
              option.tier === 'premium' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'bg-muted text-muted-foreground'
            )}>
              {TEMPLATE_TIER_LABEL[option.tier]}
            </span>
          )}
          {current && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">Actual</span>}
        </span>
        {blocked && option.reason && (
          <span id={`template-reason-${option.value}`} className="mt-1 flex items-start gap-1 text-[11px] leading-snug text-muted-foreground">
            <Info aria-hidden="true" className="mt-px h-3 w-3 shrink-0" />
            {option.reason}
          </span>
        )}
      </span>
    </button>
  )
}
