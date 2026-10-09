import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { publicSolutions } from './saas-public-content'
import { SaaSBusinessSection } from './saas-business-section'

export function SaaSSolutionsPageContent() {
  return (
    <>
      <section className="border-b border-slate-200 bg-slate-50 py-12 dark:border-slate-800 dark:bg-slate-950 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold text-cyan-700 dark:text-cyan-400">Herramientas para tu forma de trabajar</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight sm:text-5xl">Encontrá la solución para tu día a día</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-400">Desde vender en un mercado hasta organizar turnos en una barbería. Conocé qué podés hacer, cómo se usa y qué necesitás habilitar.</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button asChild className="min-h-12"><Link href="/register">Crear mi negocio</Link></Button>
            <Button asChild variant="outline" className="min-h-12"><Link href="/saas/planes">Comparar planes y precios</Link></Button>
          </div>
          <nav aria-label="Buscar soluciones por tarea" className="mt-8 flex flex-wrap gap-2">
            {publicSolutions.map(item => <Link key={item.id} href={`#${item.id}`} className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-cyan-700 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800">{item.title}</Link>)}
          </nav>
        </div>
      </section>
      <section aria-label="Funciones y ejemplos" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <p className="mb-8 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-400">No todos los negocios necesitan todas las herramientas. La disponibilidad depende del plan, los módulos activos, los permisos y la configuración de tu organización.</p>
        <div className="grid gap-6 lg:grid-cols-2">
          {publicSolutions.map(item => (
            <article id={item.id} key={item.id} className="min-w-0 scroll-mt-24 rounded-xl border border-slate-200 p-5 dark:border-slate-800 sm:p-7">
              <h2 className="text-xl font-semibold">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{item.problem}</p>
              <p className="mt-4 leading-7">{item.description}</p>
              <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm leading-6 dark:bg-slate-900"><span className="font-semibold">Por ejemplo: </span>{item.example}</p>
              <details className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-800">
                <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">Cómo se usa</summary>
                <ol className="list-decimal space-y-2 pl-5 text-sm leading-6">{item.steps.map(step => <li key={step}>{step}</li>)}</ol>
              </details>
              <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-400"><span className="font-semibold">Qué necesitás: </span>{item.requirement}</p>
            </article>
          ))}
        </div>
      </section>
      <SaaSBusinessSection />
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-semibold">Antes de empezar</h2>
        <div className="mt-5 max-w-3xl divide-y divide-slate-200 dark:divide-slate-800">
          <details className="py-3"><summary className="min-h-11 cursor-pointer py-2 font-medium">¿Tengo que usar todas las herramientas?</summary><p className="pb-3 text-sm leading-6 text-slate-600 dark:text-slate-400">No. Elegí las herramientas disponibles en tu plan que correspondan a tu rubro. Un comercio puede trabajar con ventas e inventario, y un negocio de servicios con catálogo y agenda.</p></details>
          <details className="py-3"><summary className="min-h-11 cursor-pointer py-2 font-medium">¿Las reservas online se activan automáticamente?</summary><p className="pb-3 text-sm leading-6 text-slate-600 dark:text-slate-400">No. Primero configurá servicios, duración, profesionales y horarios. Después habilitá las reservas online y los servicios que querés ofrecer.</p></details>
          <details className="py-3"><summary className="min-h-11 cursor-pointer py-2 font-medium">¿Cómo sé qué incluye mi plan?</summary><p className="pb-3 text-sm leading-6 text-slate-600 dark:text-slate-400">Consultá la <Link className="underline underline-offset-4" href="/saas/planes">comparativa de planes</Link> para ver precios, capacidades, módulos y días de prueba disponibles.</p></details>
        </div>
      </section>
    </>
  )
}
