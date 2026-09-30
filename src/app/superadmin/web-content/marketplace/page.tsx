import Link from 'next/link'
import { ArrowLeft, ExternalLink, EyeOff, Package, Store, Tag } from 'lucide-react'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { fetchAllRows } from '@/lib/superadmin/fetch-all-rows'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/superadmin/StatCard'

export const revalidate = 60

/**
 * Qué muestra el marketplace público. Antes la pantalla tenía dos listas que
 * se pisaban (el «top por catálogo» incluía tiendas privadas), la insignia
 * «Privada» usaba otro criterio que el contador de visibles y las categorías
 * se contaban sobre las primeras 1000 filas.
 *
 * Una tienda aparece en el marketplace si su tienda online es pública y además
 * eligió aparecer (`storefront_public` y `marketplace_public`).
 */

type Org = {
  id: string
  name: string
  slug: string
  plan: string | null
  storefront_public: boolean | null
  marketplace_public: boolean | null
}

type StoreRow = Org & { products: number; categories: number; visible: boolean }

function normalizedCategory(value: string) {
  return value.trim().toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** Por qué una tienda con catálogo no aparece. */
function hiddenReason(org: Org) {
  if (org.storefront_public !== true) return 'Tienda online no publicada'
  return 'Eligió no aparecer en el marketplace'
}

async function getMarketplaceData() {
  const admin = createAdminSupabase()
  const client = admin as unknown as {
    from: (table: string) => {
      select: (columns: string) => Promise<{
        data: Array<{ organization_id: string; products: number | string; categories: number | string }> | null
        error: unknown
      }>
    }
  }

  const [{ data: orgsData, error }, { data: counts }, { data: plans }, categories] = await Promise.all([
    admin.from('organizations').select('id, name, slug, plan, storefront_public, marketplace_public').order('name'),
    client.from('org_catalog_counts').select('organization_id, products, categories'),
    admin.from('subscription_plans').select('tier, name'),
    fetchAllRows<{ organization_id: string | null; name: string | null }>((from, to) =>
      admin.from('categories').select('organization_id, name').order('id').range(from, to)).catch(() => null),
  ])

  const countsByOrg = new Map((counts ?? []).map((row) => [row.organization_id, row]))
  const planNames = new Map(((plans ?? []) as Array<{ tier: string; name: string }>).map((plan) => [plan.tier.toUpperCase(), plan.name]))
  const planName = (code: string | null) => {
    const key = ({ STARTER: 'BASIC', PROFESIONAL: 'PRO' } as Record<string, string>)[String(code ?? '').toUpperCase()] ?? String(code ?? 'FREE').toUpperCase()
    return planNames.get(key) ?? key
  }

  const stores: StoreRow[] = ((orgsData ?? []) as Org[]).map((org) => {
    const count = countsByOrg.get(org.id)
    return {
      ...org,
      plan: planName(org.plan),
      products: Number(count?.products) || 0,
      categories: Number(count?.categories) || 0,
      visible: org.storefront_public === true && org.marketplace_public === true,
    }
  })

  const visible = stores.filter((store) => store.visible).sort((a, b) => b.products - a.products)
  const visibleIds = new Set(visible.map((store) => store.id))

  // Categorías de las tiendas visibles, sin distinguir mayúsculas ni tildes.
  const categoryStats = new Map<string, { name: string; stores: Set<string> }>()
  for (const row of categories ?? []) {
    if (!row.name || !row.organization_id || !visibleIds.has(row.organization_id)) continue
    const key = normalizedCategory(row.name)
    const entry = categoryStats.get(key) ?? { name: row.name.trim(), stores: new Set<string>() }
    entry.stores.add(row.organization_id)
    categoryStats.set(key, entry)
  }
  const topCategories = [...categoryStats.values()]
    .map((entry) => ({ name: entry.name, stores: entry.stores.size }))
    .sort((a, b) => b.stores - a.stores || a.name.localeCompare(b.name))
    .slice(0, 12)

  return {
    failed: Boolean(error),
    totalStores: stores.length,
    visible,
    visibleProducts: visible.reduce((sum, store) => sum + store.products, 0),
    distinctCategories: categories ? categoryStats.size : null,
    topCategories,
    // Con catálogo cargado pero fuera del marketplace: las que podrían sumarse.
    hiddenWithCatalog: stores.filter((store) => !store.visible && store.products > 0).sort((a, b) => b.products - a.products),
  }
}

export default async function SuperAdminMarketplaceContentPage() {
  const data = await getMarketplaceData()
  const visiblePercent = data.totalStores > 0 ? Math.round((data.visible.length / data.totalStores) * 100) : 0
  const maxCategory = data.topCategories[0]?.stores ?? 1

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <Button asChild variant="ghost" size="sm" className="-ml-2 h-8 gap-1.5 text-xs text-muted-foreground">
            <Link href="/superadmin/web-content">
              <ArrowLeft className="h-3.5 w-3.5" />
              Contenido web
            </Link>
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Marketplace</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Qué tiendas y productos aparecen en el marketplace público. Una tienda aparece si su tienda online está publicada y eligió estar en el marketplace; lo cambia cada tienda en su configuración o vos desde su ficha.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="gap-2">
          <a href="/marketplace" target="_blank" rel="noreferrer">
            <ExternalLink className="h-3.5 w-3.5" />
            Abrir marketplace
          </a>
        </Button>
      </header>

      {data.failed && (
        <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          No se pudieron leer las tiendas. Lo que ves puede estar incompleto.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tiendas visibles" value={data.visible.length} sub={`${visiblePercent}% de ${data.totalStores} tiendas`} icon={Store} tone={data.visible.length > 0 ? 'success' : 'warning'} />
        <StatCard label="Productos publicados" value={data.visibleProducts.toLocaleString('es-PY')} sub="en las tiendas visibles" icon={Package} tone="info" />
        <StatCard label="Categorías" value={data.distinctCategories ?? '—'} sub="distintas, en las tiendas visibles" icon={Tag} />
        <StatCard label="Con catálogo sin publicar" value={data.hiddenWithCatalog.length} sub="podrían sumarse al marketplace" icon={EyeOff} tone={data.hiddenWithCatalog.length > 0 ? 'warning' : 'default'} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Tiendas en el marketplace</CardTitle>
            <p className="text-sm text-muted-foreground">Ordenadas por productos cargados.</p>
          </CardHeader>
          <CardContent>
            {data.visible.length === 0 ? (
              <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center">
                <EyeOff className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">Ninguna tienda aparece en el marketplace todavía.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {data.visible.map((store, index) => (
                  <li key={store.id} className="flex items-center gap-3 py-3">
                    <span className="w-6 shrink-0 text-center text-xs font-bold tabular-nums text-muted-foreground">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/superadmin/organizations/${store.id}`} className="truncate text-sm font-semibold text-foreground hover:underline">
                          {store.name}
                        </Link>
                        <Badge variant="outline" className="rounded-full text-[10px]">{store.plan}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {store.products.toLocaleString('es-PY')} productos · {store.categories} categorías
                        {store.products === 0 && <span className="ml-1 text-amber-700 dark:text-amber-400">· sin productos, se ve vacía</span>}
                      </p>
                    </div>
                    <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
                      <a href={`/${store.slug}/inicio`} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-3 w-3" />
                        Ver tienda
                      </a>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Categorías más repetidas</CardTitle>
            <p className="text-sm text-muted-foreground">En cuántas tiendas visibles aparece cada una.</p>
          </CardHeader>
          <CardContent>
            {data.topCategories.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {data.distinctCategories === null ? 'No se pudieron leer las categorías.' : 'Sin categorías todavía.'}
              </p>
            ) : (
              <ul className="space-y-2.5">
                {data.topCategories.map((category) => (
                  <li key={category.name}>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate text-foreground">{category.name}</span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {category.stores} {category.stores === 1 ? 'tienda' : 'tiendas'}
                      </span>
                    </div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((category.stores / maxCategory) * 100)}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {data.hiddenWithCatalog.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Tiendas con catálogo que no aparecen</CardTitle>
            <p className="text-sm text-muted-foreground">Tienen productos cargados pero el visitante del marketplace no las ve.</p>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {data.hiddenWithCatalog.map((store) => (
                <li key={store.id}>
                  <Link
                    href={`/superadmin/organizations/${store.id}`}
                    className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/40"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">{store.name}</span>
                      <Badge variant="outline" className="shrink-0 rounded-full text-[10px]">{store.plan}</Badge>
                    </span>
                    <span className="text-xs text-muted-foreground">{store.products.toLocaleString('es-PY')} productos</span>
                    <span className="text-xs font-medium text-amber-700 dark:text-amber-400">{hiddenReason(store)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
