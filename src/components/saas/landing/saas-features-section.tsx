import { Boxes, ShoppingCart, Store, Wrench } from 'lucide-react'

export const saasHighlights = [
  { title: 'Vendé y cerrá tu caja', description: 'Registrá ventas, emití comprobantes y revisá los movimientos del día.', icon: ShoppingCart },
  { title: 'Mantené tu catálogo al día', description: 'Organizá productos, variantes, precios y existencias para encontrar lo que necesitás.', icon: Boxes },
  { title: 'Atendé tus reparaciones', description: 'Seguí cada equipo desde la recepción hasta la entrega, con costos registrados y seguimiento público para tu cliente.', icon: Wrench },
  { title: 'Mostrá tu negocio online', description: 'Personalizá tu tienda y elegí cómo recibir consultas o pedidos de tus clientes.', icon: Store },
]
const steps = [
  { title: 'Creá tu organización', description: 'Ingresá los datos de tu negocio y elegí tu rubro.' },
  { title: 'Prepará tu catálogo', description: 'Cargá productos o servicios y configurá tu equipo.' },
  { title: 'Empezá a operar', description: 'Registrá tus primeras ventas y consultá su resultado.' },
]

export function SaaSFeaturesSection() {
  return (
    <section id="caracteristicas" className="scroll-mt-24 py-14 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-cyan-700 dark:text-cyan-400">Menos tareas repetidas</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Más claridad para el día a día</h2>
          <p className="mt-4 leading-7 text-slate-600 dark:text-slate-400">Conectá las áreas de tu negocio y encontrá cada cosa en su lugar.</p>
        </div>
        <div className="mt-9 grid gap-x-10 gap-y-7 sm:grid-cols-2">
          {saasHighlights.map(({ title, description, icon: Icon }) => (
            <article key={title} className="flex gap-4 border-t border-slate-200 pt-6 dark:border-slate-800">
              <Icon className="mt-1 h-5 w-5 shrink-0 text-cyan-700 dark:text-cyan-400" aria-hidden="true" />
              <div><h3 className="text-base font-semibold">{title}</h3><p className="mt-2 max-w-md text-sm leading-6 text-slate-600 dark:text-slate-400">{description}</p></div>
            </article>
          ))}
        </div>
        <div id="como-funciona" className="mt-14 scroll-mt-24 rounded-xl bg-slate-50 p-5 sm:p-8 dark:bg-slate-900">
          <h2 className="text-xl font-semibold tracking-tight">Empezar es sencillo</h2>
          <ol className="mt-6 grid gap-6 md:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-300 text-xs font-semibold dark:border-slate-700">{index + 1}</span>
                <div><h3 className="text-sm font-semibold leading-7">{step.title}</h3><p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">{step.description}</p></div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
