'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Minus, Sparkles, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// Types (should match Supabase schema roughly)
type PlanFeature = { label: string; iconName?: string; value: string | boolean }
type SubscriptionPlan = {
  id: string
  tier: string
  name: string
  price: number
  price_note: string | null
  description: string | null
  is_popular: boolean
  limits: any
  highlights: string[]
  features: PlanFeature[]
  color_config: any
}

// Full feature list to ensure consistent rows in the table
const availableFeatures = [
  { key: 'pos', label: 'Punto de Venta (POS)' },
  { key: 'inventory', label: 'Inventario' },
  { key: 'users', label: 'Usuarios' },
  { key: 'branches', label: 'Sucursales' },
  { key: 'repairs', label: 'Reparaciones' },
  { key: 'crm', label: 'Gestión de clientes' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'ecommerce', label: 'Ecommerce / Marketplace' },
  { key: 'analytics', label: 'Analytics avanzado' },
  { key: 'reports', label: 'Reportes exportables' },
  { key: 'api', label: 'API access' },
  { key: 'support', label: 'Soporte' },
]

export function SaaSPlansSection({ initialPlans = [] }: { initialPlans?: SubscriptionPlan[] }) {
  const [yearly, setYearly] = useState(false)
  const [showTable, setShowTable] = useState(false)

  // Descuento matemático del 20% para el toggle
  const getPrice = (price: number) => {
    if (!price || price === 0) return 0
    return yearly ? Math.floor(price * 0.8) : price
  }

  return (
    <section id="planes" className="relative py-24 sm:py-32 overflow-hidden">
      {/* Background aesthetics */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-white to-white dark:from-slate-900 dark:via-slate-950 dark:to-slate-950" />
      <div className="absolute top-0 right-1/2 -z-10 -translate-y-1/2 translate-x-1/3 transform-gpu blur-3xl opacity-20 dark:opacity-30">
        <div className="aspect-[1097/845] w-[68.5625rem] bg-gradient-to-tr from-[#ff4694] to-[#776fff] opacity-20" style={{ clipPath: 'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)' }}></div>
      </div>

      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        
        {/* Header Section */}
        <div className="mx-auto max-w-4xl text-center">
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm font-semibold uppercase tracking-widest text-cyan-600 dark:text-cyan-400"
          >
            Precios y Planes
          </motion.p>
          <motion.h2 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-2 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl dark:text-white"
          >
            Elige el plan ideal para tu negocio
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-400"
          >
            Comienza gratis o prueba cualquier plan sin compromiso. Sin tarjetas de crédito al inicio, cancela cuando quieras.
          </motion.p>
        </div>

        {/* Toggle Mensual/Anual */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-10 flex justify-center"
        >
          <div className="relative flex rounded-full bg-slate-100 p-1 shadow-inner dark:bg-slate-900">
            <button
              onClick={() => setYearly(false)}
              className={cn(
                "relative rounded-full px-6 py-2 text-sm font-medium transition-colors",
                !yearly ? "text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              )}
            >
              {!yearly && (
                <motion.div layoutId="bubble" className="absolute inset-0 -z-10 rounded-full bg-white shadow-sm dark:bg-slate-800" />
              )}
              Mensual
            </button>
            <button
              onClick={() => setYearly(true)}
              className={cn(
                "relative rounded-full px-6 py-2 text-sm font-medium transition-colors",
                yearly ? "text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              )}
            >
              {yearly && (
                <motion.div layoutId="bubble" className="absolute inset-0 -z-10 rounded-full bg-white shadow-sm dark:bg-slate-800" />
              )}
              Anual
              <Badge variant="secondary" className="ml-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-400 border-none">
                -20%
              </Badge>
            </button>
          </div>
        </motion.div>

        {/* Pricing Cards */}
        <div className="isolate mx-auto mt-16 grid max-w-md grid-cols-1 gap-8 lg:mx-0 lg:max-w-none lg:grid-cols-4">
          {initialPlans.map((plan, i) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.1 }}
              className={cn(
                "group relative flex flex-col justify-between rounded-3xl p-8 backdrop-blur-xl transition-all hover:scale-[1.02]",
                plan.is_popular 
                  ? "bg-white shadow-2xl ring-2 ring-violet-500 dark:bg-slate-900 dark:shadow-violet-900/20" 
                  : "bg-white/60 ring-1 ring-slate-200 hover:shadow-lg dark:bg-slate-900/60 dark:ring-slate-800"
              )}
            >
              {plan.is_popular && (
                <div className="absolute -top-4 left-0 right-0 mx-auto w-fit">
                  <span className="flex items-center gap-1 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-3 py-1 text-xs font-semibold tracking-wide text-white shadow-md">
                    <Sparkles className="h-3.5 w-3.5" />
                    MÁS ELEGIDO
                  </span>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between gap-x-4">
                  <h3 className={cn("text-lg font-semibold leading-8", plan.is_popular ? "text-violet-600 dark:text-violet-400" : "text-slate-900 dark:text-white")}>
                    {plan.name}
                  </h3>
                </div>
                
                <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-400 min-h-[48px]">
                  {plan.description}
                </p>

                <div className="mt-6 flex items-baseline gap-x-1">
                  <span className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
                    ${getPrice(plan.price)}
                  </span>
                  <span className="text-sm font-semibold leading-6 text-slate-600 dark:text-slate-400">
                    /{yearly ? 'mes' : 'mes'}
                  </span>
                </div>
                {yearly && plan.price > 0 && (
                  <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                    Facturado anualmente (${Math.floor(plan.price * 0.8 * 12)})
                  </p>
                )}
                {!yearly && plan.price === 0 && (
                  <p className="mt-1 text-xs text-slate-400">
                    {plan.price_note || 'Siempre gratis'}
                  </p>
                )}

                <ul role="list" className="mt-8 space-y-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
                  {plan.highlights.map((highlight) => (
                    <li key={highlight} className="flex gap-x-3">
                      <Check className={cn("h-6 w-5 flex-none", plan.is_popular ? "text-violet-600 dark:text-violet-400" : "text-cyan-600 dark:text-cyan-400")} aria-hidden="true" />
                      {highlight}
                    </li>
                  ))}
                </ul>
              </div>

              <Link
                href={`/register?plan=${plan.tier}`}
                aria-describedby={plan.tier}
                className={cn(
                  "mt-8 block rounded-xl px-3 py-2.5 text-center text-sm font-semibold leading-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 transition-all",
                  plan.is_popular
                    ? "bg-violet-600 text-white hover:bg-violet-500 focus-visible:outline-violet-600 shadow-md"
                    : "text-cyan-600 ring-1 ring-inset ring-cyan-200 hover:ring-cyan-300 hover:bg-cyan-50 dark:text-cyan-400 dark:ring-slate-700 dark:hover:bg-slate-800"
                )}
              >
                Comenzar prueba gratis
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Feature Comparison Table Toggle */}
        <div className="mt-20 text-center">
          <Button 
            variant="ghost" 
            onClick={() => setShowTable(!showTable)}
            className="group font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            Ver todas las características comparadas
            <motion.div
              animate={{ rotate: showTable ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="ml-2 h-4 w-4" />
            </motion.div>
          </Button>
        </div>

        {/* Feature Table */}
        <AnimatePresence>
          {showTable && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
              className="mt-8 overflow-hidden"
            >
              <div className="rounded-3xl border border-slate-200 bg-white/50 backdrop-blur-xl shadow-sm dark:border-slate-800 dark:bg-slate-950/50">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <caption className="sr-only">Comparación detallada de características por plan</caption>
                    <colgroup>
                      <col className="w-1/4" />
                      {initialPlans.map(p => <col key={p.id} className="w-1/5" />)}
                    </colgroup>
                    <thead>
                      <tr>
                        <th className="p-6 text-sm font-semibold text-slate-900 dark:text-white">Características</th>
                        {initialPlans.map((plan) => (
                          <th key={plan.id} className="p-6 text-center">
                            <span className="text-sm font-semibold text-slate-900 dark:text-white">{plan.name}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {availableFeatures.map((feat) => (
                        <tr key={feat.key} className="transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <th scope="row" className="p-6 text-sm font-medium text-slate-600 dark:text-slate-400">
                            {feat.label}
                          </th>
                          {initialPlans.map((plan) => {
                            const featureData = plan.features.find((f) => f.label === feat.label)
                            const val = featureData ? featureData.value : false

                            return (
                              <td key={plan.id} className="p-6 text-center text-sm text-slate-500">
                                {typeof val === 'boolean' ? (
                                  val ? (
                                    <Check className="mx-auto h-5 w-5 text-emerald-500" />
                                  ) : (
                                    <Minus className="mx-auto h-5 w-5 text-slate-300 dark:text-slate-600" />
                                  )
                                ) : (
                                  <span className="text-slate-700 dark:text-slate-300 font-medium">{val}</span>
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

      </div>
    </section>
  )
}
