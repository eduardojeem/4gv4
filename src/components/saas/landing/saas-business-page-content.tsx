import Link from 'next/link'
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  Clock,
  Package,
  ShieldCheck,
  ShoppingCart,
  Store,
  Truck,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

type BusinessSolution = {
  title: string
  summary: string
  fit: string
  modules: string[]
  result: string
  plan: string
  icon: LucideIcon
  tone: string
}

const businessSolutions: BusinessSolution[] = [
  {
    title: 'Tiendas de celulares',
    summary: 'Venta rapida, control de stock, accesorios, repuestos, caja diaria y catalogo publico.',
    fit: 'Ideal para mostrador, inventario y ventas recurrentes.',
    modules: ['POS', 'Inventario', 'Catalogo', 'Clientes'],
    result: 'Menos quiebres de stock y ventas mas ordenadas.',
    plan: 'BASIC o PRO',
    icon: Store,
    tone: 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900/60 dark:bg-cyan-950/30 dark:text-cyan-300',
  },
  {
    title: 'Servicios tecnicos',
    summary: 'Recepcion de equipos, diagnostico, tecnico asignado, estados y seguimiento por ticket.',
    fit: 'Ideal para talleres que necesitan trazabilidad.',
    modules: ['Reparaciones', 'WhatsApp', 'Clientes', 'Historial'],
    result: 'Clientes informados y menos consultas manuales.',
    plan: 'PRO',
    icon: Wrench,
    tone: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300',
  },
  {
    title: 'Cadenas y franquicias',
    summary: 'Usuarios, roles, sucursales, permisos, reportes y operaciones separadas por empresa.',
    fit: 'Ideal para equipos con varias cajas o locales.',
    modules: ['Sucursales', 'Roles', 'Analytics', 'Stock'],
    result: 'Control central sin mezclar operaciones locales.',
    plan: 'PRO o ENTERPRISE',
    icon: Building2,
    tone: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-300',
  },
  {
    title: 'Negocios con delivery',
    summary: 'Productos publicados, carrito, pedidos, preparacion y entrega para comercios locales.',
    fit: 'Ideal para vender desde una tienda publica propia.',
    modules: ['Ecommerce', 'Pedidos', 'Delivery', 'Marketplace'],
    result: 'Pedidos centralizados y rastreo para clientes.',
    plan: 'PRO',
    icon: Truck,
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300',
  },
]

const decisionSteps = [
  { title: 'Elige tu tipo de negocio', description: 'Parte desde el flujo real: tienda, taller, cadena o delivery.', icon: Store },
  { title: 'Activa los modulos correctos', description: 'POS, inventario, reparaciones, ecommerce, clientes y reportes segun necesidad.', icon: Package },
  { title: 'Opera desde una empresa aislada', description: 'Cada organizacion mantiene usuarios, productos y pedidos separados.', icon: ShieldCheck },
]

export function SaaSBusinessPageContent() {
  return (
    <>
      <section className="border-b border-slate-200 bg-slate-50 py-16 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
              <Building2 className="h-3.5 w-3.5" />
              Soluciones por negocio
            </div>
            <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-tight text-slate-950 dark:text-slate-50 sm:text-5xl">
              Un sistema SaaS para vender, reparar, publicar y controlar varias sucursales.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-400">
              MiPOS se adapta al flujo de cada empresa: mostrador, taller tecnico, catalogo publico,
              pedidos, delivery y reportes. Empieza con el caso que se parece a tu operacion.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="gap-2">
                <Link href="/register">
                  Crear empresa
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="gap-2">
                <Link href="/saas/planes">Comparar planes</Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            {[
              { label: 'Ventas y caja', value: 'POS', icon: ShoppingCart },
              { label: 'Reparaciones', value: 'Tickets', icon: Wrench },
              { label: 'Pedidos online', value: 'Carrito', icon: Truck },
              { label: 'Reportes', value: 'Analytics', icon: BarChart3 },
            ].map((item) => {
              const Icon = item.icon
              return (
                <div key={item.label} className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-900">
                      <Icon className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                    </div>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{item.label}</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-950 dark:text-slate-50">{item.value}</span>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-normal text-emerald-700 dark:text-emerald-300">Casos de uso</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Encuentra el flujo que mas se parece a tu empresa</h2>
              <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-400">
                Cada tarjeta muestra modulos sugeridos, resultado operativo y plan recomendado.
              </p>
            </div>
            <Button asChild variant="outline" className="w-fit gap-2">
              <Link href="/marketplace/empresas">
                Ver empresas publicadas
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {businessSolutions.map((business) => {
              const Icon = business.icon
              return (
                <article key={business.title} className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border ${business.tone}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-950 dark:text-slate-50">{business.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{business.summary}</p>
                      </div>
                    </div>
                    <span className="w-fit rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-800 dark:text-slate-300">
                      {business.plan}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-900/70">
                      <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Encaja cuando</p>
                      <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{business.fit}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-900/70">
                      <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Resultado</p>
                      <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{business.result}</p>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {business.modules.map((module) => (
                      <span key={module} className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-300">
                        {module}
                      </span>
                    ))}
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50 py-14 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-normal text-slate-500">Como decidir</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">De caso de uso a operacion real</h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {decisionSteps.map((step, index) => {
              const Icon = step.icon
              return (
                <div key={step.title} className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-semibold text-slate-500">Paso {index + 1}</span>
                  </div>
                  <h3 className="mt-4 font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{step.description}</p>
                </div>
              )
            })}
          </div>
          <div className="mt-8 grid gap-3 rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950 sm:grid-cols-3">
            {[
              { label: 'Onboarding', value: 'Empresa lista en minutos', icon: Clock },
              { label: 'Permisos', value: 'Roles por organizacion', icon: Users },
              { label: 'Datos', value: 'Aislamiento multiempresa', icon: ShieldCheck },
            ].map((item) => {
              const Icon = item.icon
              return (
                <div key={item.label} className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-slate-500">{item.value}</p>
                  </div>
                  <Icon className="ml-auto h-4 w-4 text-slate-400" />
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </>
  )
}
