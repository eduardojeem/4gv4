import Link from 'next/link'
import { publicBusinessExamples } from './saas-public-content'

export function SaaSBusinessSection() {
  return (
    <section id="negocios" className="scroll-mt-24 border-y border-slate-200 bg-slate-50 py-12 dark:border-slate-800 dark:bg-slate-900/40 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold tracking-tight">Herramientas para distintos rubros</h2>
        <p className="mt-3 max-w-2xl leading-7 text-slate-600 dark:text-slate-400">Elegí según cómo trabajás: vendés productos, prestás servicios, recibís reservas o combinás varias actividades. Las herramientas y capacidades dependen del plan y de tu configuración.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {publicBusinessExamples.map(item => (
            <article key={item.title} className="flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
              <h3 className="text-base font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{item.description}</p>
              <p className="mt-4 text-xs leading-5 text-slate-500 dark:text-slate-400">{item.tools}</p>
              <Link href={item.href} aria-label={`Ver herramientas para ${item.title}`} className="mt-auto inline-flex min-h-11 items-center pt-3 text-sm font-semibold text-cyan-700 underline-offset-4 hover:underline dark:text-cyan-400">Ver herramientas</Link>
            </article>
          ))}
        </div>
        <Link href="/saas/negocios" className="mt-6 inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4">Conocer más casos de uso</Link>
      </div>
    </section>
  )
}
