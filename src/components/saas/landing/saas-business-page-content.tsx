'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  Clock,
  Package,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Users,
  Wrench,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { businessTypes } from './saas-landing-data'

// ─── Sección "Cómo decidir" ────────────────────────────────────────────────
const decisionSteps = [
  {
    title: 'Elige tu tipo de negocio',
    description: 'Parte desde el flujo real: tienda, taller, cadena o delivery.',
    icon: Building2,
  },
  {
    title: 'Activa los módulos correctos',
    description:
      'POS, inventario, reparaciones, ecommerce, clientes y reportes según necesidad.',
    icon: Package,
  },
  {
    title: 'Opera desde una empresa aislada',
    description:
      'Cada organización mantiene usuarios, productos y pedidos separados.',
    icon: ShieldCheck,
  },
]

// ─── Mini-panel del hero ────────────────────────────────────────────────────
const heroModules = [
  { label: 'Ventas y caja', value: 'POS', icon: ShoppingCart, color: 'text-cyan-400 bg-cyan-950/50' },
  { label: 'Reparaciones',  value: 'Tickets', icon: Wrench,       color: 'text-amber-400 bg-amber-950/50' },
  { label: 'Pedidos online', value: 'Carrito', icon: Truck,        color: 'text-emerald-400 bg-emerald-950/50' },
  { label: 'Reportes',      value: 'Analytics', icon: BarChart3,   color: 'text-violet-400 bg-violet-950/50' },
]

// ─── Valores de confianza ────────────────────────────────────────────────────
const trustValues = [
  { label: 'Onboarding', value: 'Empresa lista en minutos', icon: Clock },
  { label: 'Permisos',   value: 'Roles por organización',   icon: Users },
  { label: 'Datos',      value: 'Aislamiento multiempresa', icon: ShieldCheck },
]

// ─── Helpers de animación ────────────────────────────────────────────────────
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.5, delay },
})

export function SaaSBusinessPageContent() {
  return (
    <>
      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-slate-800 bg-slate-950 text-white">
        {/* Gradiente decorativo */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_60%_-10%,rgba(16,185,129,0.12),transparent)]" />

        <div className="relative mx-auto grid min-h-[520px] max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
          {/* Texto */}
          <div>
            <motion.div
              {...fadeUp(0)}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-700/50 bg-emerald-950/40 px-3 py-1 text-xs font-medium text-emerald-300"
            >
              <Building2 className="h-3.5 w-3.5" />
              Soluciones por negocio
            </motion.div>

            <motion.h1
              {...fadeUp(0.1)}
              className="mt-5 max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl"
            >
              Vende, repara, publica y controla varias sucursales desde un solo lugar.
            </motion.h1>

            <motion.p
              {...fadeUp(0.2)}
              className="mt-5 max-w-xl text-base leading-7 text-slate-300"
            >
              La plataforma se adapta al flujo de cada empresa: mostrador, taller técnico,
              catálogo público, pedidos, delivery y reportes. Empieza con el caso
              que se parece a tu operación.
            </motion.p>

            <motion.div {...fadeUp(0.3)} className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="gap-2 bg-white text-slate-950 hover:bg-slate-100">
                <Link href="/register">
                  Crear empresa
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="gap-2 border-white/25 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="/saas/planes">Comparar planes</Link>
              </Button>
            </motion.div>
          </div>

          {/* Mini-panel de módulos */}
          <motion.div
            {...fadeUp(0.25)}
            className="rounded-xl border border-white/15 bg-white/5 p-4 backdrop-blur-sm"
          >
            <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <p className="text-sm font-semibold">Operación diaria</p>
                <p className="mt-0.5 text-xs text-slate-400">Lo importante en una vista</p>
              </div>
              <span className="flex items-center gap-1 rounded-full border border-white/15 px-2.5 py-1 text-xs text-slate-300">
                <ShieldCheck className="h-3 w-3 text-emerald-400" />
                Seguro
              </span>
            </div>

            <div className="grid gap-2.5">
              {heroModules.map((item) => {
                const Icon = item.icon
                return (
                  <div
                    key={item.label}
                    className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3 transition-colors hover:border-white/20 hover:bg-white/10"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${item.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-medium text-slate-200">{item.label}</span>
                    </div>
                    <span className="text-sm font-semibold text-white">{item.value}</span>
                  </div>
                )
              })}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── CASOS DE USO ─────────────────────────────────────────────────── */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Encabezado */}
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <motion.div {...fadeUp(0)} className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
                Casos de uso
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                Encuentra el flujo que más se parece a tu empresa
              </h2>
              <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-400">
                Cada tarjeta muestra módulos sugeridos, resultado operativo y plan recomendado.
              </p>
            </motion.div>

            <motion.div {...fadeUp(0.1)}>
              <Button asChild variant="outline" className="w-fit gap-2">
                <Link href="/marketplace/empresas">
                  Ver empresas publicadas
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </motion.div>
          </div>

          {/* Grid de tarjetas */}
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {businessTypes.map((business, index) => {
              const Icon = business.icon
              return (
                <motion.article
                  key={business.title}
                  {...fadeUp(0.1 * index)}
                  aria-label={`Solución para ${business.title}`}
                  className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 transition-shadow hover:shadow-lg dark:border-slate-800 dark:bg-slate-950"
                >
                  {/* Hover gradient */}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-50/80 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100 dark:from-slate-900/80" />

                  <div className="relative">
                    {/* Header de tarjeta */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-transform duration-300 group-hover:scale-110 ${business.tone}`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-950 dark:text-slate-50">
                            {business.title}
                          </h3>
                          <p className="mt-1.5 text-sm leading-6 text-slate-600 dark:text-slate-400">
                            {business.description}
                          </p>
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300">
                        {business.plan}
                      </span>
                    </div>

                    {/* Encaja / Resultado */}
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-900/70">
                        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                          Encaja cuando
                        </p>
                        <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                          {business.fit}
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-900/70">
                        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                          Resultado
                        </p>
                        <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                          {business.result}
                        </p>
                      </div>
                    </div>

                    {/* Badges de módulos con color del negocio */}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {business.modules.map((mod) => (
                        <span
                          key={mod}
                          className={`rounded-full border px-3 py-1 text-xs font-medium ${business.tone}`}
                        >
                          {mod}
                        </span>
                      ))}
                    </div>
                  </div>
                </motion.article>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── CÓMO DECIDIR ─────────────────────────────────────────────────── */}
      <section className="border-y border-slate-200 bg-slate-50 py-16 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeUp(0)} className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-widest text-slate-400">
              Cómo decidir
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">
              De caso de uso a operación real
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
              Tres pasos para que tu negocio quede operativo desde el día uno.
            </p>
          </motion.div>

          {/* Pasos con connecting line */}
          <div className="relative mt-12">
            {/* Línea vertical de conexión (mobile) / horizontal (desktop implícito via flex) */}
            <div
              className="absolute left-[1.9rem] top-8 bottom-8 w-0.5 bg-slate-200 dark:bg-slate-800 md:hidden"
              aria-hidden="true"
            />

            <div className="space-y-6 md:grid md:grid-cols-3 md:gap-6 md:space-y-0">
              {decisionSteps.map((step, index) => {
                const Icon = step.icon
                return (
                  <motion.div
                    key={step.title}
                    {...fadeUp(0.15 * index)}
                    className="group relative flex gap-4 md:flex-col md:gap-0"
                  >
                    {/* Conector horizontal entre pasos (desktop) */}
                    {index < decisionSteps.length - 1 && (
                      <div
                        className="absolute right-0 top-[1.9rem] hidden h-0.5 w-[calc(100%+1.5rem)] translate-x-6 bg-slate-200 dark:bg-slate-800 md:block"
                        aria-hidden="true"
                      />
                    )}

                    {/* Burbuja de ícono */}
                    <div className="relative z-10 flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 transition-shadow group-hover:shadow-md dark:bg-slate-950 dark:ring-slate-800 md:mb-5">
                      <div className="absolute inset-0 rounded-2xl bg-cyan-500/10 blur-md dark:bg-cyan-400/10" />
                      <Icon className="relative z-10 h-6 w-6 text-cyan-600 dark:text-cyan-400" />
                    </div>

                    {/* Contenido */}
                    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/50 transition-shadow group-hover:shadow-md dark:bg-slate-950 dark:ring-slate-800 md:mt-0 md:flex-1">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        Paso 0{index + 1}
                      </span>
                      <h3 className="mt-3 font-semibold text-slate-900 dark:text-white">
                        {step.title}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                        {step.description}
                      </p>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>

          {/* Valores de confianza */}
          <motion.div
            {...fadeUp(0.3)}
            className="mt-10 grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950 sm:grid-cols-3"
          >
            {trustValues.map((item) => {
              const Icon = item.icon
              return (
                <div key={item.label} className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-50">
                      {item.label}
                    </p>
                    <p className="text-xs text-slate-500">{item.value}</p>
                  </div>
                  <Icon className="ml-auto h-4 w-4 shrink-0 text-slate-400" />
                </div>
              )
            })}
          </motion.div>
        </div>
      </section>
    </>
  )
}
