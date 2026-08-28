'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Check,
  Minus,
  Sparkles,
  ChevronDown,
  ShieldCheck,
  Zap,
  ArrowRight,
  Building2,
  Wrench,
  Store,
  Users,
  Compass,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { planNotes } from './saas-landing-data'
import { cn } from '@/lib/utils'
import { SaaSBrandAssistant } from './saas-brand-assistant'
import {
  buildPlanFeatureRows,
  buildPlanLimitRows,
  formatPlanLimit,
  selectActivePlans,
  type SubscriptionPlan,
} from './saas-plan-presentation'

export type { SubscriptionPlan } from './saas-plan-presentation'

// Interactive Business Profiles
const BUSINESS_PROFILES = [
  {
    id: 'startup',
    label: 'Emprendedor / 1 Usuario',
    icon: Users,
    recommendedTier: 'free',
    reason: 'Ideal para comenzar sin costo con facturación en caja y catálogo básico.',
  },
  {
    id: 'store_workshop',
    label: 'Tienda o Taller Técnico',
    icon: Wrench,
    recommendedTier: 'basic',
    reason: 'Perfecto para gestionar turnos de caja, inventario y hasta 100 órdenes de reparación al mes.',
  },
  {
    id: 'multibranch_online',
    label: 'Multi-sucursal o Ecommerce',
    icon: Store,
    recommendedTier: 'pro',
    reason: 'Recomendado para conectar hasta 5 sucursales, tienda online y analytics financieros.',
  },
  {
    id: 'enterprise_chain',
    label: 'Cadena Comercial / Distribuidora',
    icon: Building2,
    recommendedTier: 'enterprise',
    reason: 'Todo ilimitado, despacho de delivery, SLA 99.9% y soporte técnico dedicado.',
  },
]

// FAQ Items
const FAQ_ITEMS = [
  {
    q: '¿Puedo cambiar de plan o cancelar en cualquier momento?',
    a: 'Sí, podés subir de plan (upgrade) o cambiar a facturación anual en cualquier momento desde tu panel de administración sin interrumpir tus ventas ni perder datos.',
  },
  {
    q: '¿Qué ocurre si supero el límite de productos o usuarios de mi plan?',
    a: 'El sistema te notificará cuando te acerques al límite. Podrás continuar operando normalmente con tus datos existentes y actualizar tu plan cuando desees agregar más usuarios o productos.',
  },
  {
    q: '¿Cómo funciona el descuento del 20% en el pago anual?',
    a: 'Al elegir el pago anual, obtienes 12 meses de servicio completo por el costo de menos de 10 meses (ahorrás un 20% del total anual con una sola factura).',
  },
  {
    q: '¿El plan FREE tiene límite de tiempo de prueba?',
    a: 'No. El plan FREE es gratis de por vida para hasta 2 usuarios y 100 productos, perfecto para proyectos que recién inician.',
  },
]

export function SaaSPlansSection({ initialPlans }: { initialPlans?: SubscriptionPlan[] }) {
  const [yearly, setYearly] = useState(false)
  const [showTable, setShowTable] = useState(false)
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const activePlans = selectActivePlans(initialPlans)
  const limitRows = buildPlanLimitRows(activePlans)
  const featureRows = buildPlanFeatureRows(activePlans)

  const getPrice = (price: number, isCustom?: boolean) => {
    if (isCustom) return 'A Medida'
    if (!price || price === 0) return 'Gratis'
    const finalPrice = yearly ? Math.floor(price * 0.8) : price
    return new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', maximumFractionDigits: 0 }).format(finalPrice)
  }

  const getTierKey = (tierName: string) => {
    const t = tierName.toLowerCase()
    if (t.includes('free')) return 'free'
    if (t.includes('basic')) return 'basic'
    if (t.includes('pro')) return 'pro'
    if (t.includes('enterp')) return 'enterprise'
    return 'free'
  }

  const availableProfiles = BUSINESS_PROFILES.filter((profile) =>
    activePlans.some((plan) => getTierKey(plan.tier || plan.name) === profile.recommendedTier),
  )

  return (
    <section id="planes" className="relative py-20 sm:py-28 overflow-hidden bg-slate-50/50 dark:bg-slate-950/60">
      {/* Background aesthetics */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-50/60 via-white to-white dark:from-slate-900/60 dark:via-slate-950 dark:to-slate-950" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Header Section */}
        <div className="mx-auto max-w-3xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 rounded-full border border-cyan-200 dark:border-cyan-800 bg-cyan-50 dark:bg-cyan-950/40 px-3.5 py-1 text-xs font-semibold text-cyan-700 dark:text-cyan-300"
          >
            <Zap className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
            Planes Transparentes y Claros
          </motion.div>

          <motion.h2 
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl dark:text-white"
          >
            Elegí el plan perfecto para tu negocio
          </motion.h2>

          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mx-auto mt-4 max-w-2xl text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed"
          >
            Sin costos ocultos ni contratos forzosos. Todos los planes incluyen control de productos físicos y servicios profesionales.
          </motion.p>
        </div>

        <SaaSBrandAssistant
          title="Te ayudo a comparar"
          description="Revisá los límites y funciones vigentes de cada plan antes de elegir."
          className="mx-auto mt-8 max-w-4xl border-cyan-400/30 bg-slate-950 text-left shadow-sm dark:bg-slate-900"
        />

        {/* Recomendador Interactivo de Plan */}
        {availableProfiles.length > 0 && (
        <div className="mt-6 mx-auto max-w-4xl rounded-3xl border border-slate-200/90 bg-white/90 p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex items-center gap-2 mb-3">
            <Compass className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              ¿Qué plan se adapta mejor a tu tamaño?
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {availableProfiles.map((profile) => {
              const Icon = profile.icon
              const isSelected = selectedProfile === profile.id

              return (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => setSelectedProfile(isSelected ? null : profile.id)}
                  className={cn(
                    "flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all cursor-pointer text-xs font-semibold gap-1.5",
                    isSelected
                      ? "border-cyan-500 bg-cyan-50/80 text-cyan-950 dark:border-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-200 shadow-xs ring-2 ring-cyan-500/20"
                      : "border-slate-200 hover:border-slate-300 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300"
                  )}
                >
                  <Icon className={cn("h-4 w-4", isSelected ? "text-cyan-600" : "text-slate-400")} />
                  <span>{profile.label}</span>
                </button>
              )
            })}
          </div>

          {selectedProfile && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3.5 p-3 rounded-xl bg-cyan-50/90 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-900/60 text-xs text-cyan-950 dark:text-cyan-200 flex items-center justify-between gap-3"
            >
              <div>
                <span className="font-bold">Recomendación para tu negocio: </span>
                <span>{availableProfiles.find((p) => p.id === selectedProfile)?.reason}</span>
              </div>
              <Badge className="bg-cyan-600 text-white shrink-0 font-bold">
                Plan {availableProfiles.find((p) => p.id === selectedProfile)?.recommendedTier?.toUpperCase()}
              </Badge>
            </motion.div>
          )}
        </div>
        )}

        {/* Toggle Mensual / Anual */}
        {activePlans.length > 0 && (
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
        )}

        {/* Pricing Cards Grid */}
        {activePlans.length > 0 ? (
        <div className="isolate mx-auto mt-12 grid max-w-md grid-cols-1 gap-6 sm:max-w-none sm:grid-cols-2 lg:grid-cols-4">
          {activePlans.map((plan, i) => {
            const isPopular = Boolean(plan.is_popular)
            const isEnterprise = plan.custom || plan.tier === 'enterprise'
            const tierKey = getTierKey(plan.tier || plan.name)

            // Resaltar si el usuario seleccionó un perfil en el recomendador
            const isHighlightedByQuiz = selectedProfile && availableProfiles.find(p => p.id === selectedProfile)?.recommendedTier === tierKey

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 * i }}
                className={cn(
                  "group relative flex flex-col justify-between rounded-3xl p-6 sm:p-7 backdrop-blur-xl transition-all duration-200 hover:shadow-xl",
                  isHighlightedByQuiz
                    ? "bg-white dark:bg-slate-900 ring-2 ring-cyan-500 shadow-2xl dark:shadow-cyan-950/40 scale-[1.02]"
                    : isPopular
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
                        {formatPlanLimit(plan.limits.branches)}
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
                        {yearly ? '/mes (anual)' : '/mes'}
                      </span>
                    )}
                  </div>

                  {/* Resumen de Límites Claves */}
                  {plan.limits && (
                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2 text-[11px] font-medium text-slate-600 dark:text-slate-400">
                      <div className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl text-center">
                        <span className="block font-bold text-slate-900 dark:text-slate-200">{formatPlanLimit(plan.limits.users)}</span>
                        <span className="text-[10px] text-muted-foreground">Usuarios</span>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl text-center">
                        <span className="block font-bold text-slate-900 dark:text-slate-200">{formatPlanLimit(plan.limits.products)}</span>
                        <span className="text-[10px] text-muted-foreground">Catálogo</span>
                      </div>
                    </div>
                  )}

                  {/* Lista de Características Destacadas */}
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
                    "mt-7 flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-center text-xs font-bold transition-all shadow-xs cursor-pointer",
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
        ) : (
          <div role="status" className="mx-auto mt-12 max-w-2xl rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">No hay planes disponibles en este momento</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Volvé a consultar más adelante o contactanos para recibir orientación.
            </p>
          </div>
        )}

        {/* Feature Comparison Table Toggle */}
        {activePlans.length > 0 && (
        <div className="mt-14 text-center">
          <Button 
            variant="outline"
            size="sm"
            onClick={() => setShowTable(!showTable)}
            className="rounded-xl px-5 py-2.5 text-xs font-bold border-slate-300 dark:border-slate-700 gap-2 text-slate-700 dark:text-slate-200 shadow-xs cursor-pointer"
          >
            <span>{showTable ? 'Ocultar comparativa detallada' : 'Ver todas las características y módulos comparados'}</span>
            <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", showTable && "rotate-180")} />
          </Button>
        </div>
        )}

        {/* Detailed Feature Comparison Table */}
        <AnimatePresence>
          {showTable && activePlans.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-6 overflow-hidden"
            >
              <div className="rounded-3xl border border-slate-200 bg-white/95 backdrop-blur-xl shadow-lg dark:border-slate-800 dark:bg-slate-900/95 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[720px]">
                    <caption className="sr-only">Comparación detallada de características por plan</caption>
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
                        <th className="p-4 sm:p-5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 w-1/3">
                          Capacidad y Funcionalidades
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
                        <th colSpan={activePlans.length + 1} className="px-4 py-2 text-[11px] uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          1. Límites Operativos
                        </th>
                      </tr>
                      {limitRows.map((limit) => (
                        <tr key={limit.key} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                          <th scope="row" className="p-3.5 sm:p-4 text-xs font-medium text-slate-700 dark:text-slate-300">
                            {limit.label}
                          </th>
                          {activePlans.map((plan) => {
                            const val = limit.values[plan.id] ?? 'No especificado'
                            const isUnlimited = val.toLowerCase().includes('ilimitad')

                            return (
                              <td key={plan.id} className="p-3.5 sm:p-4 text-center">
                                {isUnlimited ? (
                                  <span className="text-emerald-600 dark:text-emerald-400 font-extrabold text-xs">{val}</span>
                                ) : (
                                  <span className="text-slate-700 dark:text-slate-300 font-semibold">{val}</span>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      ))}

                      {/* Módulos Funcionales */}
                      <tr className="bg-slate-100/70 dark:bg-slate-800/50 font-bold border-t border-slate-200 dark:border-slate-800">
                        <th colSpan={activePlans.length + 1} className="px-4 py-2 text-[11px] uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          2. Módulos y Funciones Incluidas
                        </th>
                      </tr>
                      {featureRows.map((feat) => (
                        <tr key={feat.key} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                          <th scope="row" className="p-3.5 sm:p-4 text-xs font-medium text-slate-700 dark:text-slate-300">
                            {feat.label}
                          </th>
                          {activePlans.map((plan) => {
                            const value = feat.values[plan.id] ?? false

                            return (
                              <td key={plan.id} className="p-3.5 sm:p-4 text-center">
                                {value === true ? (
                                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 mx-auto">
                                    <Check className="h-3.5 w-3.5" />
                                  </div>
                                ) : value === false ? (
                                  <Minus className="mx-auto h-4 w-4 text-slate-300 dark:text-slate-600" />
                                ) : (
                                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                    {String(value)}
                                  </span>
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

        {/* Sección de Preguntas Frecuentes (FAQ) */}
        <div className="mt-20 max-w-3xl mx-auto space-y-4">
          <div className="text-center space-y-1 mb-8">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
              Preguntas Frecuentes sobre los Planes
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Respuestas rápidas a las consultas más comunes.
            </p>
          </div>

          <div className="space-y-3">
            {FAQ_ITEMS.map((faq, index) => {
              const isOpen = openFaq === index
              return (
                <div
                  key={index}
                  className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900/60"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    className="flex w-full items-center justify-between text-left text-sm font-bold text-slate-900 dark:text-slate-50 cursor-pointer"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform text-slate-400", isOpen && "rotate-180")} />
                  </button>
                  {isOpen && (
                    <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                      {faq.a}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>

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
