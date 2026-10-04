import Link from 'next/link'
import { AlertCircle, AlertTriangle, ArrowRight, Barcode, CheckCircle2, CircleHelp, FolderTree, Smartphone, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { catalogHealth, type CatalogHealth } from '@/lib/catalog/health'

/**
 * Resumen de los catálogos globales: para qué sirve cada uno, quién lo usa,
 * de qué depende y qué falta. Los cuatro se trabajan igual (la plataforma
 * define la lista y las tiendas eligen de ella), pero no pesan lo mismo:
 * Categorías y Marcas son la base; Productos por código y Modelos de equipos
 * se apoyan en ellas y no guardan marcas ni categorías propias.
 */

type Count = number | null

export type CatalogsHubData = {
  categories: { active: Count; roots: Count; tenantTotal: Count; tenantLinked: Count }
  brands: { active: Count; withoutLogo: Count; tenantTotal: Count; tenantLinked: Count }
  products: { active: Count; withoutCategory: Count; withoutImage: Count; candidates: Count; review: Count }
  deviceModels: { active: Count; candidates: Count; review: Count }
}

const n = (value: Count) => (value === null ? '—' : value.toLocaleString('es-PY'))
const gap = (total: Count, done: Count) => (total === null || done === null ? null : Math.max(0, total - done))

type Card = {
  href: string
  icon: React.ElementType
  title: string
  level: string
  purpose: string
  usedBy: string
  dependsOn?: string
  verticals: string
  figures: Array<{ label: string; value: string }>
  pending: Array<{ text: string; href?: string }>
  health: CatalogHealth
}

function buildCards(data: CatalogsHubData): Card[] {
  const unlinkedCategories = gap(data.categories.tenantTotal, data.categories.tenantLinked)
  const unlinkedBrands = gap(data.brands.tenantTotal, data.brands.tenantLinked)

  return [
    {
      href: '/superadmin/categories',
      icon: FolderTree,
      title: 'Categorías',
      level: 'Base',
      purpose: 'La taxonomía con la que el marketplace agrupa y filtra los productos de todas las tiendas.',
      usedBy: 'El marketplace (navegación por categoría), el alta de categorías de cada tienda y el kit de inicio.',
      verticals: 'Todos los rubros',
      figures: [
        { label: 'categorías', value: n(data.categories.active) },
        { label: 'principales', value: n(data.categories.roots) },
        { label: 'de tiendas vinculadas', value: `${n(data.categories.tenantLinked)} de ${n(data.categories.tenantTotal)}` },
      ],
      pending: unlinkedCategories ? [{ text: `${unlinkedCategories} categorías de tiendas sin vincular: no se agrupan en el marketplace` }] : [],
      health: catalogHealth([data.categories.active, data.categories.tenantTotal, data.categories.tenantLinked], { pending: unlinkedCategories }),
    },
    {
      href: '/superadmin/brands',
      icon: Tag,
      title: 'Marcas',
      level: 'Base',
      purpose: 'El nombre y el logo oficial de cada marca, para que una marca se vea igual en todas las tiendas.',
      usedBy: 'El buscador de marcas al cargar productos, los logos del marketplace, Productos por código y Modelos de equipos.',
      verticals: 'Todos los rubros',
      figures: [
        { label: 'marcas', value: n(data.brands.active) },
        { label: 'sin logo', value: n(data.brands.withoutLogo) },
        { label: 'de tiendas vinculadas', value: `${n(data.brands.tenantLinked)} de ${n(data.brands.tenantTotal)}` },
      ],
      pending: [
        ...(data.brands.withoutLogo ? [{ text: `${data.brands.withoutLogo} marcas sin logo oficial: se muestran con la inicial` }] : []),
        ...(unlinkedBrands ? [{ text: `${unlinkedBrands} marcas de tiendas sin vincular` }] : []),
      ],
      health: catalogHealth([data.brands.active, data.brands.withoutLogo, data.brands.tenantTotal, data.brands.tenantLinked], { pending: (data.brands.withoutLogo ?? 0) + (unlinkedBrands ?? 0) }),
    },
    {
      href: '/superadmin/global-products',
      icon: Barcode,
      title: 'Productos por código',
      level: 'Usa Categorías y Marcas',
      purpose: 'Una ficha por código de barras del fabricante: al escanear, el formulario de producto se completa solo.',
      usedBy: 'El formulario de producto de las tiendas, al escanear o escribir un código de fabricante.',
      dependsOn: 'No guarda marca ni categoría propias: apunta a las de Categorías y Marcas.',
      verticals: 'Todos los rubros con productos envasados',
      figures: [
        { label: 'productos', value: n(data.products.active) },
        { label: 'sin categoría', value: n(data.products.withoutCategory) },
        { label: 'sin foto', value: n(data.products.withoutImage) },
      ],
      pending: data.products.active === null
        ? [{ text: 'Falta correr su SQL' }]
        : [
            ...(data.products.candidates ? [{ text: `${data.products.candidates} candidatos pendientes de revisión`, href: '/superadmin/global-products?status=candidate' }] : []),
            ...(data.products.review ? [{ text: `${data.products.review} ficha${data.products.review === 1 ? '' : 's'} lista${data.products.review === 1 ? '' : 's'} para publicar`, href: '/superadmin/global-products?status=review' }] : []),
            ...(data.products.withoutCategory ? [{ text: `${data.products.withoutCategory} productos sin categoría: la tienda la elige a mano` }] : []),
          ],
      health: catalogHealth([data.products.active, data.products.withoutCategory, data.products.withoutImage, data.products.candidates, data.products.review], { pending: (data.products.withoutCategory ?? 0) + (data.products.candidates ?? 0) + (data.products.review ?? 0) }),
    },
    {
      href: '/superadmin/device-models',
      icon: Smartphone,
      title: 'Modelos de equipos',
      level: 'Usa Marcas · solo electrónica y talleres',
      purpose: 'Marcas y modelos de celular (iPhone 13, Galaxy A15…) para la compatibilidad de accesorios y repuestos y las reparaciones.',
      usedBy: 'Las sugerencias de marca y modelo de equipo en productos y reparaciones.',
      dependsOn: 'La marca del equipo se elige de Marcas. No es la marca del producto: un vidrio templado de marca «Genérico» puede ser compatible con un «Samsung A15».',
      verticals: 'Electrónica y talleres de reparación',
      figures: [{ label: 'modelos', value: n(data.deviceModels.active) }],
      pending: data.deviceModels.active === null
        ? [{ text: 'Falta correr su SQL' }]
        : [
            ...(data.deviceModels.candidates ? [{ text: `${data.deviceModels.candidates} candidatos pendientes de revisión`, href: '/superadmin/device-models?status=candidate' }] : []),
            ...(data.deviceModels.review ? [{ text: `${data.deviceModels.review} modelo${data.deviceModels.review === 1 ? '' : 's'} listo${data.deviceModels.review === 1 ? '' : 's'} para publicar`, href: '/superadmin/device-models?status=review' }] : []),
            ...(data.deviceModels.active === 0 ? [{ text: 'Vacío: sumá los modelos que ya usan las tiendas' }] : []),
          ],
      health: catalogHealth([data.deviceModels.active, data.deviceModels.candidates, data.deviceModels.review], { pending: (data.deviceModels.active === 0 ? 1 : 0) + (data.deviceModels.candidates ?? 0) + (data.deviceModels.review ?? 0) }),
    },
  ]
}

export function CatalogsHub({ data }: { data: CatalogsHubData }) {
  const cards = buildCards(data)
  const pending = cards.flatMap((card) => card.pending.map((item) => ({ text: item.text, href: item.href ?? card.href, title: card.title })))

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-6">
      <header className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Catálogos globales</p>
        <h1 className="text-2xl font-bold text-foreground">Listas que comparten todas las tiendas</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          La plataforma define cada lista y las tiendas eligen de ella al cargar productos. Así un mismo producto, marca o categoría se llama igual en todas las tiendas y el marketplace los agrupa juntos.
        </p>
      </header>

      {pending.length > 0 && (
        <section aria-labelledby="catalogs-pending" className="rounded-xl border border-amber-200 bg-amber-50/60 p-5 dark:border-amber-900/50 dark:bg-amber-950/20">
          <h2 id="catalogs-pending" className="flex items-center gap-2 text-sm font-bold text-amber-900 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            Para revisar ({pending.length})
          </h2>
          <ul className="mt-3 space-y-2">
            {pending.map((item) => (
              <li key={item.text}>
                <Link href={item.href} className="group flex items-start gap-2 text-sm text-amber-900 hover:underline dark:text-amber-100">
                  <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                  <span className="flex-1"><strong className="font-semibold">{item.title}:</strong> {item.text}</span>
                  <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 opacity-60 group-hover:opacity-100" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Cómo se relacionan" className="rounded-xl border border-border bg-card p-4 text-sm">
        <p className="font-semibold text-foreground">Cómo se relacionan</p>
        <p className="mt-1 text-muted-foreground">
          <strong className="text-foreground">Categorías</strong> y <strong className="text-foreground">Marcas</strong> son la base.{' '}
          <strong className="text-foreground">Productos por código</strong> usa las dos y{' '}
          <strong className="text-foreground">Modelos de equipos</strong> usa Marcas: ninguno repite esos datos, apuntan a ellos.
          Conviene trabajarlos en ese orden.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((card) => {
          const Icon = card.icon
          const status = {
            healthy: { label: 'Al día', icon: CheckCircle2, className: 'text-emerald-700 dark:text-emerald-400' },
            warning: { label: 'Con pendientes', icon: AlertTriangle, className: 'text-amber-700 dark:text-amber-400' },
            error: { label: 'Con errores', icon: AlertCircle, className: 'text-destructive' },
            unknown: { label: 'Sin verificar', icon: CircleHelp, className: 'text-muted-foreground' },
          }[card.health]
          const StatusIcon = status.icon
          return (
            <Link
              key={card.href}
              href={card.href}
              className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground">{card.title}</p>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{card.level}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </div>
              <p className="text-sm text-foreground">{card.purpose}</p>
              <dl className="space-y-1 text-xs text-muted-foreground">
                <div><dt className="inline font-semibold text-foreground">Lo usan: </dt><dd className="inline">{card.usedBy}</dd></div>
                {card.dependsOn && <div><dt className="inline font-semibold text-foreground">Datos: </dt><dd className="inline">{card.dependsOn}</dd></div>}
                <div><dt className="inline font-semibold text-foreground">Rubros: </dt><dd className="inline">{card.verticals}</dd></div>
              </dl>
              <div className="flex flex-wrap gap-2">
                {card.figures.map((figure) => (
                  <span key={figure.label} className="rounded-lg bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground">
                    <strong className="tabular-nums text-foreground">{figure.value}</strong> {figure.label}
                  </span>
                ))}
              </div>
              <p className={cn('mt-auto flex items-center gap-1.5 text-xs font-medium', status.className)}>
                <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
                {status.label}{card.pending.length > 0 ? ` · ${card.pending.length} para revisar` : ''}
              </p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
