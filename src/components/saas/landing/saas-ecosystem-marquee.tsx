'use client'

import {
  ArrowLeftRight,
  BarChart3,
  Boxes,
  Building2,
  ContactRound,
  Tags,
  Store,
  ShoppingCart,
  Wrench,
} from 'lucide-react'

type PartnerItem = {
  name: string
  category: string
  icon: React.ComponentType<{ className?: string }>
  badge: string
  color: string
}

export const ecosystemItems: PartnerItem[] = [
  {
    name: 'Ventas y Caja',
    category: 'Turnos, tickets y arqueos',
    icon: ShoppingCart,
    badge: 'Ventas',
    color: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
  },
  {
    name: 'Inventario',
    category: 'Productos, servicios y existencias',
    icon: Boxes,
    badge: 'Stock',
    color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
  },
  {
    name: 'Reparaciones',
    category: 'Órdenes, repuestos y seguimiento',
    icon: Wrench,
    badge: 'Taller',
    color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
  },
  {
    name: 'Clientes',
    category: 'Historial y seguimiento comercial',
    icon: ContactRound,
    badge: 'CRM',
    color: 'text-green-500 bg-green-500/10 border-green-500/20',
  },
  {
    name: 'Sucursales',
    category: 'Stock y operación por local',
    icon: Building2,
    badge: 'Multiempresa',
    color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
  },
  {
    name: 'Movimientos de Stock',
    category: 'Control entre sucursales y depósitos',
    icon: ArrowLeftRight,
    badge: 'Inventario',
    color: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/20',
  },
  {
    name: 'Catálogo Público',
    category: 'Productos y pedidos online',
    icon: Store,
    badge: 'Ecommerce',
    color: 'text-violet-500 bg-violet-500/10 border-violet-500/20',
  },
  {
    name: 'Promociones',
    category: 'Descuentos, cupones y campañas',
    icon: Tags,
    badge: 'Ventas',
    color: 'text-fuchsia-500 bg-fuchsia-500/10 border-fuchsia-500/20',
  },
  {
    name: 'Reportes',
    category: 'Ventas, inventario y rendimiento',
    icon: BarChart3,
    badge: 'Reportes',
    color: 'text-sky-500 bg-sky-500/10 border-sky-500/20',
  },
]

export function SaaSEcosystemMarquee() {
  // Duplicar para loop continuo
  const marqueeItems = [...ecosystemItems, ...ecosystemItems]

  return (
    <section className="relative border-b border-slate-200/80 bg-slate-50/60 py-10 overflow-hidden dark:border-slate-800/80 dark:bg-slate-950/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mb-5 text-center">
        <p
          suppressHydrationWarning
          className="text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400"
        >
          Lo que podés hacer con la plataforma
        </p>
      </div>

      {/* Marquee Container with lateral fade */}
      <div className="relative overflow-hidden group">
        {/* Left and right fade gradients */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-slate-50 to-transparent dark:from-slate-950" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-slate-50 to-transparent dark:from-slate-950" />

        {/* Marquee Track */}
        <div className="flex w-max gap-4 py-2 animate-marquee-left hover:[animation-play-state:paused]">
          {marqueeItems.map((item, idx) => {
            const Icon = item.icon
            return (
              <div
                key={`${item.name}-${idx}`}
                className="flex items-center gap-3 rounded-2xl border border-slate-200/90 bg-white/90 px-4 py-3 shadow-xs backdrop-blur-sm transition-all duration-200 hover:border-cyan-500/50 hover:shadow-md hover:scale-[1.02] dark:border-slate-800 dark:bg-slate-900/80"
              >
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${item.color}`}>
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {item.name}
                    </span>
                    <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[9px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      {item.badge}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {item.category}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
