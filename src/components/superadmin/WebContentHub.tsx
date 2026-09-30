import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Globe,
  LayoutTemplate,
  Megaphone,
  Scale,
  Sparkles,
  Store,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LandingSummary } from '@/lib/superadmin/landing-readiness'
import { EMPTY_LANDING_FILTERS, serializeLandingFilters } from '@/lib/superadmin/landing-filters'
import { LEGAL_DOCUMENT_META, type LegalDocumentType } from '@/lib/legal/shared'

/**
 * Resumen de «Contenido web». Antes esta pantalla repetía, con otro criterio,
 * la tabla de tiendas de «Landings»: una tienda podía estar «completa» acá e
 * «incompleta» allá. Ahora cuenta con los mismos datos que cada sección y
 * lleva a ella; el detalle vive en un solo lugar.
 */

export type WebContentHubData = {
  /** `null` si no se pudieron leer las tiendas. */
  landings: LandingSummary | null
  brand: {
    platformName: string
    hasLogo: boolean
    hasFavicon: boolean
    isDefaultName: boolean
    hasSeoDescription: boolean
  }
  announcements: { total: number; live: number; scheduled: number }
  /** `null` si la tabla de documentos legales no existe todavía. */
  legal: Array<{
    type: LegalDocumentType
    publishedVersion: number | null
    hasDraft: boolean
    responsibleGaps: string[]
  }> | null
  marketplace: { visibleStores: number; totalStores: number; products: number | null } | null
}

type Pending = { text: string; href: string }

function landingHref(status: 'incomplete' | 'maintenance') {
  const query = new URLSearchParams(serializeLandingFilters({ ...EMPTY_LANDING_FILTERS, statuses: [status] })).toString()
  return `/superadmin/web-content/landing${query ? `?${query}` : ''}`
}

function pendingItems(data: WebContentHubData): Pending[] {
  const items: Pending[] = []
  const brandHref = '/superadmin/web-content/brand'
  const legalHref = '/superadmin/web-content/legal'

  if (!data.brand.hasLogo) items.push({ text: 'La plataforma no tiene logo: se muestra solo el nombre.', href: brandHref })
  if (data.brand.isDefaultName) items.push({ text: 'El nombre de la plataforma sigue siendo el de fábrica («Plataforma»).', href: brandHref })
  if (!data.brand.hasFavicon) items.push({ text: 'Falta el ícono de la pestaña del navegador (favicon).', href: brandHref })

  if (data.legal === null) {
    items.push({ text: 'La tabla de documentos legales no existe: falta correr su SQL.', href: legalHref })
  } else {
    for (const document of data.legal) {
      const label = LEGAL_DOCUMENT_META[document.type].label
      if (document.publishedVersion === null) {
        items.push({ text: `${label}: no hay versión publicada, se muestra el texto base.`, href: legalHref })
      } else if (document.responsibleGaps.length > 0) {
        items.push({ text: `${label}: el texto publicado no identifica al responsable (falta ${document.responsibleGaps.join(', ')}).`, href: legalHref })
      }
    }
  }

  const landings = data.landings
  if (landings && landings.byStatus.incomplete > 0) {
    const count = landings.byStatus.incomplete
    items.push({
      text: `${count === 1 ? '1 tienda publicada no tiene' : `${count} tiendas publicadas no tienen`} lo imprescindible para vender.`,
      href: landingHref('incomplete'),
    })
  }
  return items
}

function SectionCard({
  href,
  icon: Icon,
  title,
  description,
  status,
  ok,
  children,
}: {
  href: string
  icon: React.ElementType
  title: string
  description: string
  status: string
  ok: boolean
  children?: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </div>
      {children}
      <p className={cn('flex items-center gap-1.5 text-xs font-medium', ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400')}>
        {ok ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />}
        {status}
      </p>
    </Link>
  )
}

function Figure({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-lg bg-muted/50 px-3 py-2">
      <p className="text-lg font-bold tabular-nums text-foreground">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  )
}

export function WebContentHub({ data }: { data: WebContentHubData }) {
  const pending = pendingItems(data)
  const { brand, announcements, legal, landings, marketplace } = data

  const brandGaps = [!brand.hasLogo && 'logo', !brand.hasFavicon && 'favicon', brand.isDefaultName && 'nombre', !brand.hasSeoDescription && 'descripción para Google']
    .filter(Boolean) as string[]
  const legalPublished = legal?.filter((document) => document.publishedVersion !== null).length ?? 0
  const legalReview = legal?.filter((document) => document.publishedVersion === null || document.responsibleGaps.length > 0).length ?? 0

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-8">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          <Globe className="h-3.5 w-3.5" aria-hidden="true" />
          Contenido web
        </div>
        <h1 className="text-2xl font-bold text-foreground">Lo que ve un visitante</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          La marca, el aviso y los textos legales de la plataforma, que editás vos, y las páginas de las tiendas, que arma cada tienda y acá se revisan.
        </p>
      </header>

      {pending.length > 0 && (
        <section aria-labelledby="web-pending" className="rounded-xl border border-amber-200 bg-amber-50/60 p-5 dark:border-amber-900/50 dark:bg-amber-950/20">
          <h2 id="web-pending" className="flex items-center gap-2 text-sm font-bold text-amber-900 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            Para revisar ({pending.length})
          </h2>
          <ul className="mt-3 space-y-2">
            {pending.map((item) => (
              <li key={item.text}>
                <Link href={item.href} className="group flex items-start gap-2 text-sm text-amber-900 hover:underline dark:text-amber-100">
                  <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                  <span className="flex-1">{item.text}</span>
                  <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 opacity-60 group-hover:opacity-100" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="web-platform" className="space-y-3">
        <div>
          <h2 id="web-platform" className="text-base font-bold text-foreground">De la plataforma</h2>
          <p className="text-xs text-muted-foreground">Lo editás acá y se ve en la landing, el marketplace, el registro y el login.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <SectionCard
            href="/superadmin/web-content/brand"
            icon={Sparkles}
            title="Marca SaaS"
            description={`Logo, nombre (${brand.platformName}), botones y textos para Google`}
            ok={brandGaps.length === 0}
            status={brandGaps.length === 0 ? 'Completa' : `Falta: ${brandGaps.join(', ')}`}
          />
          <SectionCard
            href="/superadmin/web-content/anuncio"
            icon={Megaphone}
            title="Aviso del marketplace"
            description="Cartel que aparece al entrar al marketplace, con fechas"
            ok
            status={
              announcements.live > 0
                ? `${announcements.live} ${announcements.live === 1 ? 'aviso activo' : 'avisos activos'}${announcements.scheduled ? ` · ${announcements.scheduled} programado${announcements.scheduled === 1 ? '' : 's'}` : ''}`
                : announcements.total > 0
                  ? `Ninguno activo · ${announcements.total} guardado${announcements.total === 1 ? '' : 's'}`
                  : 'Sin avisos'
            }
          />
          <SectionCard
            href="/superadmin/web-content/legal"
            icon={Scale}
            title="Documentos legales"
            description="Términos y política de privacidad, con versiones"
            ok={legal !== null && legalReview === 0}
            status={
              legal === null
                ? 'Falta crear la tabla'
                : legalReview === 0
                  ? `${legalPublished} publicados`
                  : `${legalReview} para revisar`
            }
          />
        </div>
      </section>

      <section aria-labelledby="web-stores" className="space-y-3">
        <div>
          <h2 id="web-stores" className="text-base font-bold text-foreground">De las tiendas</h2>
          <p className="text-xs text-muted-foreground">Cada tienda arma su página; acá ves cuáles están listas y cuáles aparecen en el marketplace.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <SectionCard
            href="/superadmin/web-content/landing"
            icon={LayoutTemplate}
            title="Landings de tiendas"
            description="Qué ve el visitante en la página de cada tienda y qué le falta para vender"
            ok={landings !== null && landings.byStatus.incomplete === 0}
            status={
              landings === null
                ? 'No se pudieron leer las tiendas'
                : landings.byStatus.incomplete === 0
                  ? 'Todas las publicadas tienen lo imprescindible'
                  : `${landings.byStatus.incomplete} publicadas con algo pendiente`
            }
          >
            {landings && (
              <div className="grid grid-cols-4 gap-2">
                <Figure value={landings.byStatus.ready} label="Listas" />
                <Figure value={landings.byStatus.incomplete} label="Incompletas" />
                <Figure value={landings.byStatus.hidden} label="Sin publicar" />
                <Figure value={landings.byStatus.maintenance} label="Mantenimiento" />
              </div>
            )}
          </SectionCard>
          <SectionCard
            href="/superadmin/web-content/marketplace"
            icon={Store}
            title="Marketplace"
            description="Tiendas y productos visibles en el marketplace público"
            ok={marketplace !== null && marketplace.visibleStores > 0}
            status={
              marketplace === null
                ? 'No se pudieron leer las tiendas'
                : marketplace.visibleStores > 0
                  ? `${marketplace.visibleStores} de ${marketplace.totalStores} tiendas visibles`
                  : 'Ninguna tienda visible'
            }
          >
            {marketplace && (
              <div className="grid grid-cols-2 gap-2">
                <Figure value={marketplace.visibleStores} label="Tiendas visibles" />
                <Figure value={marketplace.products === null ? '—' : marketplace.products.toLocaleString('es-PY')} label="Productos publicados" />
              </div>
            )}
          </SectionCard>
        </div>
      </section>

      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        Ver en vivo:
        <a href="/saas" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground hover:underline">Landing <ExternalLink className="h-3 w-3" /></a>
        <a href="/marketplace" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground hover:underline">Marketplace <ExternalLink className="h-3 w-3" /></a>
        <a href="/saas/terminos" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground hover:underline">Términos <ExternalLink className="h-3 w-3" /></a>
        <a href="/saas/privacidad" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground hover:underline">Privacidad <ExternalLink className="h-3 w-3" /></a>
      </p>
    </div>
  )
}
