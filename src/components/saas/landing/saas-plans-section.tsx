'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Minus, Sparkles, ChevronDown, ShieldCheck, Zap, CreditCard, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { defaultSyncPlans, planNotes, supportItems } from './saas-landing-data'
import { cn } from '@/lib/utils'

// Types (should match Supabase schema or fallback)
type PlanFeature = { label: string; iconName?: string; value: string | boolean }
export type SubscriptionPlan = {
  id: string
  tier: string
  name: string
  price: number
  price_note?: string | null
  description?: string | null
  is_popular?: boolean
  custom?: boolean
  limits?: {
    users?: string
    products?: string
    branches?: string
    repairs?: string
    storage?: string
  }
  highlights?: string[]
  features?: PlanFeature[]
  color_config?: any
}

// System limits definition
const SYSTEM_LIMITS = [
  { key: 'users', label: 'Usuarios y cajeros concurrentes' },
  { key: 'products', label: 'Límite de productos y servicios' },
  { key: 'branches', label: 'Sucursales permitidas' },
  { key: 'repairs', label: 'Órdenes de reparación por mes' },
  { key: 'storage', label: 'Almacenamiento en la nube' },
]

// System features definition
const SYSTEM_FEATURES = [
  { key: 'pos', label: 'Punto de Venta (POS) y caja' },
  { key: 'inventory', label: 'Inventario físico de productos' },
  { key: 'services', label: 'Gestión de servicios profesionales' },
  { key: 'repairs', label: 'Módulo de Reparaciones & Taller' },
  { key: 'crm', label: 'CRM / Clientes y cuentas' },
  { key: 'branches', label: 'Sucursales múltiples' },
  { key: 'ecommerce', label: 'Ecommerce & Catálogo público' },
  { key: 'analytics', label: 'Analytics y métricas de rentabilidad' },
  { key: 'promotions', label: 'Promociones, cupones y descuentos' },
  { key: 'reports', label: 'Reportes exportables (CSV / PDF)' },
  { key: 'security', label: 'Auditoría y control de permisos' },
  { key: 'delivery', label: 'Módulo de Delivery y despachos' },
  { key: 'support', label: 'Soporte prioritario y onboarding' },
]

export function SaaSPlansSection({ initialPlans = [] }: { initialPlans?: SubscriptionPlan[] }) {
  const [yearly, setYearly] = useState(false)
  const [showTable, setShowTable] = useState(false)

  // Use provided plans from DB if available, otherwise use synchronized platform defaults
  const activePlans: SubscriptionPlan[] = initialPlans && initialPlans.length > 0
    ? initialPlans
    : defaultSyncPlans.map(p => ({
        id: p.id || `plan-${p.tier}`,
        tier: p.tier || p.name.toLowerCase(),
        name: p.name,
        price: p.price,
        price_note: p.custom ? 'A medida' : p.price === 0 ? 'Siempre gratis' : '/mes',
        description: p.description,
        is_popular: p.is_popular || false,
        custom: p.custom || false,
        limits: p.limits,
        highlights: p.highlights,
        features: SYSTEM_FEATURES.map(f => ({
          label: f.label,
          value: p.modules?.includes(f.key) || (p.name === 'ENTERPRISE')
        }))
      }))

  // Descuento del 20% para el pago anual
  const getPrice = (price: number, isCustom?: boolean) => {
    if (isCustom) return 'A Medida'
    if (!price || price === 0) return 'Gratis'
    const finalPrice = yearly ? Math.floor(price * 0.8) : price
    return new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', maximumFractionDigits: 0 }).format(finalPrice)
  }

  const formatLimit = (val?: string) => {
    if (!val) return <Minus className="mx-auto h-4 w-4 text-slate-300 dark:text-slate-600" />
    if (val.toLowerCase().includes('ilimitad') || val === '∞') {
      return <span className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">Ilimitado</span>
    }
    return <span className="text-slate-700 dark:text-slate-200 font-medium text-xs sm:text-sm">{val}</span>
  }

  return (
    <section id="planes" className="relative py-20 sm:py-28 overflow-hidden bg-slate-50/50 dark:bg-slate-950/60">
      {/* Background aesthetics */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50/60 via-white to-white dark:from-slate-900/60 dark:via-slate-950 dark:to-slate-950" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Header Section */}
        <div className="mx-auto max-w-3xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 rounded-full border border-cyan-200 dark:border-cyan-800 bg-cyan-50 dark:bg-cyan-950/40 px-3.5 py-1 text-xs font-semibold text-cyan-700 dark:text-cyan-300"
          >
            <Zap className="h-3.5 w-3.5" />
            Planes Transparentes y Escalables
          </motion.div>

          <motion.h2 
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl dark:text-white"
          >
            Elegí el plan perfecto para tu negocio
          </motion.h2>

          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mx-auto mt-4 max-w-2xl text-base sm:text-lg text-slate-600 dark:text-slate-400"
          >
            Comenzá gratis o probá cualquier plan con soporte para productos físicos y servicios. Sin contratos forzosos, cambiá de plan cuando quieras.
          </motion.p>
        </div>

        {/* Toggle Mensual / Anual */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="mt-8 flex justify-center"
        >
          <div className="relative flex items-center rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setYearly(false)}
              className={cn(
                "relative rounded-xl px-5 py-2 text-xs sm:text-sm font-semibold transition-all cursor-pointer",
                !yearly ? "text-slate-950 dark:text-white" : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              )}
            >
              {!yearly && (
                <motion.div layoutId="plan-billing-bubble" className="absolute inset-0 -z-10 rounded-xl bg-slate-100 dark:bg-slate-800 shadow-xs" />
              )}
              Pago Mensual
            </button>
            <button
              type="button"
              onClick={() => setYearly(true)}
              className={cn(
                "relative flex items-center gap-1.5 rounded-xl px-5 py-2 text-xs sm:text-sm font-semibold transition-all cursor-pointer",
                yearly ? "text-slate-950 dark:text-white" : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              )}
            >
              {yearly && (
                <motion.div layoutId="plan-billing-bubble" className="absolute inset-0 -z-10 rounded-xl bg-slate-100 dark:bg-slate-800 shadow-xs" />
              )}
              <span>Pago Anual</span>
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 text-[10px] font-bold px-1.5 py-0">
                -20% OFF
              </Badge>
            </button>
          </div>
        </motion.div>

        {/* Pricing Cards Grid */}
        <div className="isolate mx-auto mt-12 grid max-w-md grid-cols-1 gap-6 sm:max-w-none sm:grid-cols-2 lg:grid-cols-4">
          {activePlans.map((plan, i) => {
            const isPopular = plan.is_popular || plan.tier === 'basic'
            const isEnterprise = plan.custom || plan.tier === 'enterprise'

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 * i }}
                className={cn(
                  "group relative flex flex-col justify-between rounded-3xl p-6 sm:p-7 backdrop-blur-xl transition-all duration-200 hover:shadow-xl",
                  isPopular 
                    ? "bg-white dark:bg-slate-900 ring-2 ring-violet-500 shadow-xl dark:shadow-violet-950/30" 
                    : "bg-white/80 dark:bg-slate-900/70 border border-slate-200/90 dark:border-slate-800/80 shadow-sm"
                )}
              >
                {isPopular && (
                  <div className="absolute -top-3.5 left-0 right-0 mx-auto w-fit">
                    <span className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-3.5 py-1 text-[11px] font-bold tracking-wide text-white shadow-md">
                      <Sparkles className="h-3 w-3" />
                      MÁS ELEGIDO
                    </span>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between gap-x-2">
                    <h3 className={cn("text-lg font-bold", isPopular ? "text-violet-600 dark:text-violet-400" : "text-slate-900 dark:text-white")}>
                      {plan.name}
                    </h3>
                    {plan.limits?.branches && (
                      <Badge variant="outline" className="text-[10px] font-semibold border-slate-200 dark:border-slate-700">
                        {plan.limits.branches}
                      </Badge>
                    )}
                  </div>
                  
                  <p className="mt-2.5 text-xs text-slate-600 dark:text-slate-400 min-h-[36px] leading-relaxed">
                    {plan.description}
                  </p>

                  <div className="mt-5 flex items-baseline gap-x-1.5">
                    <span className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                      {getPrice(plan.price, isEnterprise)}
                    </span>
                    {!isEnterprise && plan.price > 0 && (
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        {yearly ? '/mes (facturado anual)' : '/mes'}
                      </span>
                    )}
                  </div>

                  {/* Limits summary chips */}
                  {plan.limits && (
                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2 text-[11px] font-medium text-slate-600 dark:text-slate-400">
                      <div className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl text-center">
                        <span className="block font-bold text-slate-900 dark:text-slate-200">{plan.limits.users}</span>
                        <span className="text-[10px] text-muted-foreground">Usuarios</span>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl text-center">
                        <span className="block font-bold text-slate-900 dark:text-slate-200">{plan.limits.products}</span>
                        <span className="text-[10px] text-muted-foreground">Catálogo</span>
                      </div>
                    </div>
                  )}

                  {/* Highlights list */}
                  <ul role="list" className="mt-5 space-y-2.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    {(plan.highlights || []).map((highlight) => (
                      <li key={highlight} className="flex items-start gap-2.5">
                        <Check className={cn("h-4 w-4 shrink-0 mt-0.5", isPopular ? "text-violet-600 dark:text-violet-400" : "text-cyan-600 dark:text-cyan-400")} />
                        <span>{highlight}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Link
                  href={isEnterprise ? '/saas#contacto' : `/register?plan=${plan.tier}`}
                  className={cn(
                    "mt-7 flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-center text-xs font-bold transition-all shadow-xs",
                    isPopular
                      ? "bg-violet-600 text-white hover:bg-violet-700 shadow-md shadow-violet-500/20"
                      : "bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
                  )}
                >
                  <span>{plan.custom ? 'Contactar a Ventas' : 'Comenzar Ahora'}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </motion.div>
            )
          })}
        </div>

        {/* Feature Comparison Table Toggle */}
        <div className="mt-14 text-center">
          <Button 
            variant="outline"
            size="sm"
            onClick={() => setShowTable(!showTable)}
            className="rounded-xl px-4 py-2 text-xs font-bold border-slate-300 dark:border-slate-700 gap-2 text-slate-700 dark:text-slate-200 shadow-xs"
          >
            <span>{showTable ? 'Ocultar comparativa detallada' : 'Ver todas las características comparadas'}</span>
            <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", showTable && "rotate-180")} />
          </Button>
        </div>

        {/* Detailed Feature Comparison Table */}
        <AnimatePresence>
          {showTable && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-6 overflow-hidden"
            >
              <div className="rounded-3xl border border-slate-200 bg-white/90 backdrop-blur-xl shadow-lg dark:border-slate-800 dark:bg-slate-900/90 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <caption className="sr-only">Comparación detallada de características por plan</caption>
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
                        <th className="p-4 sm:p-5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          Características & Módulos
                        </th>
                        {activePlans.map((plan) => (
                          <th key={plan.id} className="p-4 sm:p-5 text-center">
                            <span className="text-sm font-bold text-slate-900 dark:text-white block">{plan.name}</span>
                            <span className="text-[11px] font-medium text-muted-foreground">{getPrice(plan.price, plan.custom)}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                      
                      {/* Límites de Plan */}
                      <tr className="bg-slate-100/70 dark:bg-slate-800/50 font-bold">
                        <th colSpan={activePlans.length + 1} className="px-4 py-2 text-[11px] uppercase tracking-wider text-slate-600 dark:text-slate-400">
                          Límites de Capacidad
                        </th>
                      </tr>
                      {SYSTEM_LIMITS.map((limit) => (
                        <tr key={limit.key} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                          <th scope="row" className="p-3.5 sm:p-4 text-xs font-medium text-slate-700 dark:text-slate-300">
                            {limit.label}
                          </th>
                          {activePlans.map((plan) => (
                            <td key={plan.id} className="p-3.5 sm:p-4 text-center">
                              {formatLimit(plan.limits?.[limit.key as keyof typeof plan.limits])}
                            </td>
                          ))}
                        </tr>
                      ))}

                      {/* Módulos Funcionales */}
                      <tr className="bg-slate-100/70 dark:bg-slate-800/50 font-bold border-t border-slate-200 dark:border-slate-800">
                        <th colSpan={activePlans.length + 1} className="px-4 py-2 text-[11px] uppercase tracking-wider text-slate-600 dark:text-slate-400">
                          Módulos del Sistema
                        </th>
                      </tr>
                      {SYSTEM_FEATURES.map((feat) => (
                        <tr key={feat.key} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                          <th scope="row" className="p-3.5 sm:p-4 text-xs font-medium text-slate-700 dark:text-slate-300">
                            {feat.label}
                          </th>
                          {activePlans.map((plan) => {
                            const featureData = plan.features?.find((f) => f.label === feat.label)
                            const isEnterprise = plan.tier === 'enterprise' || plan.name === 'ENTERPRISE'
                            const isIncluded = isEnterprise || (featureData ? Boolean(featureData.value) : false)

                            return (
                              <td key={plan.id} className="p-3.5 sm:p-4 text-center">
                                {isIncluded ? (
                                  <Check className="mx-auto h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                ) : (
                                  <Minus className="mx-auto h-4 w-4 text-slate-300 dark:text-slate-600" />
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Plan Notes & Trust Badges */}
        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {planNotes.map((note) => (
            <div key={note.title} className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{note.title}</span>
              </div>
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {note.description}
              </p>
            </div>
          ))}
        </div>

      </div>
    </section>
  )
}
