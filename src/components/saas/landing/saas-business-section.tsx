import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { businessTypes } from './saas-landing-data'

export function SaaSBusinessSection() {
  return (
    <section id="negocios" className="border-y border-slate-200 bg-slate-50 py-14 dark:border-slate-800 dark:bg-slate-900/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-normal text-emerald-700 dark:text-emerald-300">Negocios</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Para tiendas, servicios tecnicos y negocios con varias sucursales
            </h2>
            <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-400">
              El sistema se adapta al flujo real del negocio: ventas, stock, reparaciones y catalogo publico.
            </p>
          </div>
          <Button asChild variant="outline" className="w-fit gap-2">
            <Link href="/marketplace/empresas">
              Ver empresas
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {businessTypes.map((business) => (
            <div key={business.title} className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${business.iconBg}`}>
                <business.icon className={`h-5 w-5 ${business.color}`} />
              </div>
              <h3 className="mt-4 font-semibold text-slate-900 dark:text-slate-50">{business.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{business.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
