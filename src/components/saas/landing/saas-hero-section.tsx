import Link from 'next/link'
import { ArrowRight, Boxes, ExternalLink, ShieldCheck, ShoppingCart, Wrench } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { trustItems } from './saas-landing-data'

const quickModules = [
  { label: 'Vende', value: 'POS y caja', icon: ShoppingCart },
  { label: 'Controla', value: 'Inventario', icon: Boxes },
  { label: 'Atiende', value: 'Reparaciones', icon: Wrench },
]

export function SaaSHeroSection() {
  return (
    <section className="relative overflow-hidden border-b border-slate-200 bg-slate-950 text-white dark:border-slate-800">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_60%_-10%,rgba(6,182,212,0.12),transparent)]" />

      <div className="relative mx-auto grid min-h-[560px] max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
        <div className="max-w-3xl">
          <Badge className="mb-5 border-white/15 bg-white/10 text-white hover:bg-white/10">
            POS, inventario y reparaciones
          </Badge>

          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            Administra tu negocio sin complicarte.
          </h1>

          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            Crea tu empresa, carga productos, vende en caja y atiende reparaciones desde un panel simple, seguro y separado para cada organizacion.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="gap-2 bg-white text-slate-950 hover:bg-slate-100">
              <Link href="/register">
                Empezar ahora
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="gap-2 border-white/25 bg-white/5 text-white hover:bg-white/10 hover:text-white">
              <Link href="/marketplace">
                Ver marketplace
                <ExternalLink className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {trustItems.map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-sm text-slate-300">
                <item.icon className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-white/15 bg-white p-3 text-slate-950 shadow-2xl dark:bg-slate-900 dark:text-slate-50">
          <div className="flex items-center justify-between border-b border-slate-200 px-2 pb-3 dark:border-slate-800">
            <div>
              <div className="text-sm font-semibold">Operacion diaria</div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Lo importante en una vista</div>
            </div>
            <Badge variant="outline" className="gap-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              Seguro
            </Badge>
          </div>

          <div className="grid gap-3 py-3">
            {quickModules.map((item) => (
              <div key={item.value} className="flex items-center gap-4 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-300">
                  <item.icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-medium uppercase text-slate-500">{item.label}</div>
                  <div className="mt-1 font-semibold">{item.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
