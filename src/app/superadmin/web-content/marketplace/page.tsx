import Link from 'next/link'
import {
  ArrowLeft,
  Building2,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  Package,
  Search,
  Store,
  Tag,
  TrendingUp,
} from 'lucide-react'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/superadmin/StatCard'
import { cn } from '@/lib/utils'

export const revalidate = 60

/**
 * Per-org product counts via the aggregated `org_catalog_counts` view (Postgres
 * does the counting). Returns null if the view isn't present yet, so the caller
 * can fall back to row-counting and nothing breaks before the migration runs.
 */
async function getProductCountsFromView(
  admin: ReturnType<typeof createAdminSupabase>
): Promise<Map<string, number> | null> {
  // The view isn't in the generated DB types, so access it through a narrow shape.
  const client = admin as unknown as {
    from: (table: string) => {
      select: (columns: string) => Promise<{
        data: Array<{ organization_id: string; products: number | string }> | null
        error: unknown
      }>
    }
  }

  const { data, error } = await client
    .from('org_catalog_counts')
    .select('organization_id, products')

  if (error || !data) return null

  return new Map(data.map((row) => [row.organization_id, Number(row.products) || 0]))
}

async function getMarketplaceData() {
  const admin = createAdminSupabase()

  // Prefer the aggregated view; only scan product rows if it isn't available.
  const productCountsByOrg = await getProductCountsFromView(admin)

  const [{ data: orgsData }, { data: categoryCounts }, productFallback] = await Promise.all([
    admin.from('organizations').select('id, name, slug, plan, marketplace_public, created_at').limit(500),
    admin.from('categories').select('organization_id, name'),
    productCountsByOrg ? Promise.resolve({ data: null }) : admin.from('products').select('organization_id'),
  ])

  const orgs = (orgsData ?? []) as Array<{
    id: string; name: string; slug: string; plan: string | null
    marketplace_public: boolean | null; created_at: string | null
  }>

  // Products per org: from the view, or from the fallback row scan.
  const productsByOrg = productCountsByOrg ?? new Map<string, number>()
  if (!productCountsByOrg) {
    ;((productFallback?.data ?? []) as Array<{ organization_id: string | null }>).forEach((p) => {
      if (p.organization_id) productsByOrg.set(p.organization_id, (productsByOrg.get(p.organization_id) ?? 0) + 1)
    })
  }

  // Count categories per org + global names (categories are far fewer than products)
  const categoriesByOrg = new Map<string, number>()
  const categoryNames = new Map<string, number>()
  ;(categoryCounts ?? []).forEach((c: { organization_id: string | null; name: string | null }) => {
    if (c.organization_id) categoriesByOrg.set(c.organization_id, (categoriesByOrg.get(c.organization_id) ?? 0) + 1)
    if (c.name) categoryNames.set(c.name, (categoryNames.get(c.name) ?? 0) + 1)
  })

  // Top categories globally
  const topCategories = Array.from(categoryNames.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }))

  // Org enrichment
  const orgsRich = orgs.map((o) => ({
    ...o,
    products: productsByOrg.get(o.id) ?? 0,
    categories: categoriesByOrg.get(o.id) ?? 0,
  })).sort((a, b) => b.products - a.products)

  const publicOrgs = orgsRich.filter((o) => o.marketplace_public !== false)
  // Total products: accurate across ALL orgs from the view (not capped by the
  // 500-org display limit); falls back to summing the scanned rows.
  const totalProducts = productCountsByOrg
    ? Array.from(productCountsByOrg.values()).reduce((sum, n) => sum + n, 0)
    : orgsRich.reduce((sum, o) => sum + o.products, 0)
  const totalCategories = categoryNames.size

  return {
    totalOrgs: orgs.length,
    publicOrgs: publicOrgs.length,
    privateOrgs: orgs.length - publicOrgs.length,
    totalProducts,
    totalCategories,
    topByProducts: orgsRich.slice(0, 8),
    publicOrgsSorted: publicOrgs.sort((a, b) => b.products - a.products).slice(0, 10),
    topCategories,
  }
}

const PLAN_COLORS: Record<string, string> = {
  FREE: 'border-slate-200 bg-slate-50 text-slate-600',
  BASIC: 'border-blue-200 bg-blue-50 text-blue-700',
  PRO: 'border-violet-200 bg-violet-50 text-violet-700',
  ENTERPRISE: 'border-amber-200 bg-amber-50 text-amber-700',
}

export default async function SuperAdminMarketplaceContentPage() {
  const data = await getMarketplaceData()
  const publicPercent = data.totalOrgs > 0 ? Math.round((data.publicOrgs / data.totalOrgs) * 100) : 0

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6">
      {/* Header */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <Button asChild variant="ghost" size="sm" className="-ml-2 h-8 gap-1.5 text-xs text-slate-500">
            <Link href="/superadmin/web-content">
              <ArrowLeft className="h-3.5 w-3.5" />
              Contenido web
            </Link>
          </Button>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
            <Store className="h-3.5 w-3.5" />
            Marketplace público
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Marketplace SaaS</h1>
          <p className="max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            Empresas y catálogo visibles globalmente desde el marketplace público de la plataforma.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="gap-2">
          <a href="/marketplace" target="_blank" rel="noreferrer">
            <ExternalLink className="h-3.5 w-3.5" />
            Abrir marketplace
          </a>
        </Button>
      </header>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Empresas públicas" value={data.publicOrgs} sub={`${publicPercent}% del total · ${data.privateOrgs} privadas`} icon={Eye} tone="success" />
        <StatCard label="Productos" value={data.totalProducts.toLocaleString('es-PY')} sub="entre todos los tenants" icon={Package} tone="info" />
        <StatCard label="Categorías únicas" value={data.totalCategories} sub="taxonomía global" icon={Tag} />
        <StatCard label="Total tenants" value={data.totalOrgs} sub="en la plataforma" icon={Building2} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Top tenants by products */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Top tenants por catálogo</CardTitle>
              <Badge variant="outline" className="rounded-full text-xs">
                <TrendingUp className="mr-1 h-3 w-3" />
                Por # productos
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {data.topByProducts.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">Sin organizaciones aún</p>
            ) : (
              <div className="space-y-2">
                {data.topByProducts.map((o, i) => (
                  <div key={o.id} className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{o.name}</p>
                        {o.plan && (
                          <Badge variant="outline" className={cn('rounded-full text-[10px] h-4 px-1.5', PLAN_COLORS[o.plan] ?? PLAN_COLORS.FREE)}>
                            {o.plan}
                          </Badge>
                        )}
                        {!o.marketplace_public && (
                          <Badge variant="outline" className="rounded-full text-[10px] h-4 px-1.5 border-slate-200 bg-slate-50 text-slate-400">
                            <EyeOff className="h-2.5 w-2.5 mr-0.5" />
                            Privada
                          </Badge>
                        )}
                      </div>
                      <p className="truncate text-xs text-slate-400">/{o.slug}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-50">{o.products}</p>
                      <p className="text-[11px] text-slate-400">{o.categories} cat</p>
                    </div>
                    <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                      <a href={`/${o.slug}/productos`} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top categories */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Categorías más usadas</CardTitle>
          </CardHeader>
          <CardContent>
            {data.topCategories.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">Sin categorías</p>
            ) : (
              <div className="space-y-2">
                {data.topCategories.map((c) => {
                  const maxCount = data.topCategories[0]?.count ?? 1
                  const percent = Math.round((c.count / maxCount) * 100)
                  return (
                    <div key={c.name}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="truncate text-slate-700 dark:text-slate-300">{c.name}</span>
                        <span className="font-mono text-xs tabular-nums text-slate-500">{c.count}</span>
                      </div>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div className="h-full rounded-full bg-violet-500" style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Public orgs list */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Empresas visibles en marketplace</CardTitle>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                {data.publicOrgs} visibles · {data.privateOrgs} privadas
              </p>
            </div>
            <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
              <Link href="/superadmin/organizations">
                Gestionar visibilidad
                <ExternalLink className="h-3 w-3" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {data.publicOrgsSorted.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center">
              <EyeOff className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm text-slate-500">No hay empresas visibles en el marketplace público</p>
              <p className="mt-0.5 text-xs text-slate-400">Habilitá <code className="rounded bg-muted px-1">marketplace_public</code> en cada organización para mostrarlas</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {data.publicOrgsSorted.map((o) => (
                <a
                  key={o.id}
                  href={`/${o.slug}/inicio`}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex flex-col gap-2 rounded-xl border bg-card p-4 transition-all hover:border-violet-300 hover:shadow-sm dark:hover:border-violet-700"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-slate-900 dark:text-slate-100 group-hover:text-violet-600 dark:group-hover:text-violet-400">
                        {o.name}
                      </p>
                      <p className="truncate text-xs text-slate-400">/{o.slug}</p>
                    </div>
                    {o.plan && (
                      <Badge variant="outline" className={cn('rounded-full text-[10px]', PLAN_COLORS[o.plan] ?? PLAN_COLORS.FREE)}>
                        {o.plan}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between border-t pt-2 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Package className="h-3 w-3" />
                      {o.products} prod.
                    </span>
                    <span className="flex items-center gap-1">
                      <Tag className="h-3 w-3" />
                      {o.categories} cat.
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick links */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Link href="/superadmin/web-content" className="flex items-center gap-3 rounded-xl border bg-card p-4 hover:border-slate-300 hover:bg-slate-50">
          <Globe className="h-5 w-5 text-slate-400" />
          <div className="flex-1">
            <p className="text-sm font-semibold">Estado de sitios</p>
            <p className="text-xs text-slate-400">Configuración por tenant</p>
          </div>
          <ExternalLink className="h-3.5 w-3.5 text-slate-300" />
        </Link>
        <Link href="/superadmin/organizations" className="flex items-center gap-3 rounded-xl border bg-card p-4 hover:border-slate-300 hover:bg-slate-50">
          <Building2 className="h-5 w-5 text-slate-400" />
          <div className="flex-1">
            <p className="text-sm font-semibold">Organizaciones</p>
            <p className="text-xs text-slate-400">Directorio completo</p>
          </div>
          <ExternalLink className="h-3.5 w-3.5 text-slate-300" />
        </Link>
        <a href="/marketplace" target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl border bg-card p-4 hover:border-slate-300 hover:bg-slate-50">
          <Search className="h-5 w-5 text-slate-400" />
          <div className="flex-1">
            <p className="text-sm font-semibold">Vista pública</p>
            <p className="text-xs text-slate-400">Marketplace en vivo</p>
          </div>
          <ExternalLink className="h-3.5 w-3.5 text-slate-300" />
        </a>
      </div>
    </div>
  )
}
