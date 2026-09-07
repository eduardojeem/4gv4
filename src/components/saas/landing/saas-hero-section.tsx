import Link from 'next/link'
import { ArrowRight, Boxes, Check, ShoppingCart, Store, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { type PlatformBranding } from '@/lib/platform/branding'

const modules = [
  { icon: ShoppingCart, title: 'Ventas y caja', detail: 'Cobrá y registrá cada operación.' },
  { icon: Boxes, title: 'Productos e inventario', detail: 'Precios y existencias en un solo lugar.' },
  { icon: Store, title: 'Tu tienda online', detail: 'Publicá tu catálogo cuando estés listo.' },
  { icon: Wrench, title: 'Servicios y reparaciones', detail: 'Activá el taller si tu negocio lo necesita.' },
]

export function SaaSHeroSection({ branding }: { branding: PlatformBranding }) {
  return (
    <section className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-20">
        <div>
          <p className="text-sm font-semibold text-cyan-700 dark:text-cyan-400">{branding.platformName} · Gestión para tu negocio</p>
          <h1 className="mt-5 max-w-xl text-4xl font-bold leading-tight tracking-tight text-slate-950 sm:text-5xl lg:text-6xl dark:text-white">
            Tu negocio, <span className="text-cyan-700 dark:text-cyan-400">más simple.</span><br />Todo conectado.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-slate-600 sm:text-lg dark:text-slate-400">
            Organizá tus ventas, productos y clientes desde un mismo lugar. Elegí las herramientas que necesitás y crecé a tu ritmo.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-12 gap-2 bg-cyan-700 px-6 text-white hover:bg-cyan-800 dark:bg-cyan-400 dark:text-slate-950 dark:hover:bg-cyan-300">
              <Link href={branding.primaryCtaHref}>{branding.primaryCtaLabel || 'Crear mi negocio'}<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 bg-transparent px-6">
              <Link href="#planes">Conocer los planes</Link>
            </Button>
          </div>
          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600 dark:text-slate-400">
            {['Módulos según tu rubro', 'Acceso desde el celular', 'Permisos para tu equipo'].map(item => (
              <li key={item} className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-cyan-700 dark:text-cyan-400" aria-hidden="true" />{item}</li>
            ))}
          </ul>
        </div>
        <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <span className="text-sm font-semibold">Así se organiza tu negocio</span>
            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">Vista ilustrativa</span>
          </div>
          <div className="p-5 sm:p-6">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">Un panel, distintas herramientas</p>
            <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
              {modules.map(({ icon: Icon, title, detail }) => (
                <div key={title} className="flex items-center gap-3 py-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-400"><Icon className="h-5 w-5" aria-hidden="true" /></div>
                  <div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{detail}</p></div>
                </div>
              ))}
            </div>
            <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600 dark:bg-slate-950 dark:text-slate-400">Vos elegís qué módulos usar entre los disponibles en tu plan.</p>
          </div>
        </div>
      </div>
    </section>
  )
}
