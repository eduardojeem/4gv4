import Link from 'next/link'
import { ArrowRight, CheckCircle2, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { businessTypes } from './saas-landing-data'

export function SaaSBusinessSection() {
  return (
    <section id="negocios" className="border-y border-slate-200 bg-slate-50/70 py-20 dark:border-slate-800 dark:bg-slate-900/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <Building2 className="h-3.5 w-3.5" />
              Soluciones por Industria
            </div>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
              Diseñado para el flujo real de tu negocio
            </h2>
            <p className="mt-3 text-base text-slate-600 dark:text-slate-400">
              El sistema se adapta a la operativa diaria: tiendas de mostrador, talleres técnicos, comercio electrónico y cadenas con múltiples depósitos.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button asChild variant="outline" className="gap-2 rounded-xl text-xs font-semibold h-10 border-slate-300 dark:border-slate-700">
              <Link href="/saas/negocios">
                Ver todos los casos
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Business Types Cards */}
        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {businessTypes.map((business) => {
            const Icon = business.icon
            return (
              <div 
                key={business.title} 
                className="group relative flex flex-col justify-between rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg dark:border-slate-800 dark:bg-slate-950"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${business.iconBg}`}>
                      <Icon className={`h-5 w-5 ${business.color}`} />
                    </div>
                  </div>

                  <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-slate-50">
                    {business.title}
                  </h3>

                  <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed min-h-[48px]">
                    {business.description}
                  </p>

                  {/* Included Module Chips */}
                  <div className="mt-4 flex flex-wrap gap-1.5 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                    {business.modules.map((mod) => (
                      <span 
                        key={mod} 
                        className="inline-flex items-center rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      >
                        {mod}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  <span>{business.result}</span>
                </div>
              </div>
            )
          })}
        </div>

      </div>
    </section>
  )
}
