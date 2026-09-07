'use client'

import {
  Building2,
  CreditCard,
  Sparkles,
  ShieldCheck,
  GalleryHorizontalEnd,
  Tag,
  Briefcase,
  Footprints,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const GROUPS = [
  {
    title: 'Configuración',
    items: [
      { id: 'company', label: 'Empresa y publicación', short: 'Empresa', icon: Building2 },
      { id: 'checkout', label: 'Pagos y entregas', short: 'Checkout', icon: CreditCard },
    ],
  },
  {
    title: 'Diseño de la tienda',
    items: [
      { id: 'hero', label: 'Portada', short: 'Portada', icon: Sparkles },
      { id: 'trust_bar', label: 'Beneficios', short: 'Beneficios', icon: ShieldCheck },
      { id: 'carousel', label: 'Banners promocionales', short: 'Banners', icon: GalleryHorizontalEnd },
      { id: 'offers', label: 'Ofertas', short: 'Ofertas', icon: Tag },
    ],
  },
  {
    title: 'Servicios y atención',
    items: [
      { id: 'services', label: 'Catálogo de servicios', short: 'Servicios', icon: Briefcase },
      { id: 'process', label: 'Cómo atendemos', short: 'Proceso', icon: Footprints },
    ],
  },
]

export function WebsiteNavigation({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <nav aria-label="Secciones del sitio web" className="min-w-0 rounded-2xl border bg-card p-3 shadow-2xs lg:sticky lg:top-4">
      {/* Selector móvil nativo (accesible) + carrusel rápido de chips */}
      <div className="lg:hidden space-y-2.5">
        <div className="flex items-center justify-between">
          <label htmlFor="website-section" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Editar sección
          </label>
          <span className="text-[11px] text-muted-foreground">8 secciones</span>
        </div>

        <select
          id="website-section"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {GROUPS.map((group) => (
            <optgroup key={group.title} label={group.title}>
              {group.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        {/* Chips horizontales de acceso rápido en móvil */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 no-scrollbar">
          {GROUPS.flatMap((g) => g.items).map((item) => {
            const Icon = item.icon
            const isSelected = value === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChange(item.id)}
                className={cn(
                  'flex items-center gap-1.5 shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-all border',
                  isSelected
                    ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                    : 'border-border/70 bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.short}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Navegación de escritorio (lg:block) */}
      <div className="hidden space-y-5 lg:block">
        {GROUPS.map((group) => (
          <div key={group.title}>
            <p className="mb-1.5 px-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {group.title}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon
                const isSelected = value === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-current={isSelected ? 'page' : undefined}
                    onClick={() => onChange(item.id)}
                    className={cn(
                      'flex items-center gap-2.5 min-h-11 w-full rounded-xl px-3 py-2 text-left text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      isSelected
                        ? 'bg-primary/10 font-bold text-primary shadow-2xs border border-primary/20'
                        : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                    )}
                  >
                    <Icon className={cn('h-4 w-4 shrink-0', isSelected ? 'text-primary' : 'text-muted-foreground')} />
                    <span className="truncate">{item.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </nav>
  )
}
