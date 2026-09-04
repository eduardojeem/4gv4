import Link from 'next/link'
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  CheckCircle2,
  ExternalLink,
  Eye,
  ImageIcon,
  LayoutTemplate,
  MessageSquare,
  Phone,
  Sparkles,
  Star,
  TrendingUp,
} from 'lucide-react'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/superadmin/StatCard'
import { cn } from '@/lib/utils'

export const revalidate = 60

// Detect a "customized" hero by comparing against the live template default,
// not a hardcoded string that silently breaks if the template copy changes.
const DEFAULT_HERO_TITLE = getWebsiteSettingsDefaults().hero_content.title

async function getLandingData() {
  const admin = createAdminSupabase()

  const [{ data: orgsData }, { data: settingsData }, { count: publicCount }] = await Promise.all([
    admin.from('organizations').select('id, name, slug, plan').limit(500),
    admin.from('website_settings').select('organization_id, key, value, updated_at'),
    admin.from('organizations').select('id', { count: 'exact', head: true }).eq('storefront_public', true).eq('marketplace_public', true),
  ])

  const orgs = (orgsData ?? []) as Array<{ id: string; name: string; slug: string; plan: string | null }>
  const settings = (settingsData ?? []) as Array<{ organization_id: string | null; key: string; value: unknown; updated_at: string | null }>

  const byOrg = new Map<string, Map<string, unknown>>()
  const heroUpdatedByOrg = new Map<string, string | null>()
  settings.forEach((s) => {
    if (!s.organization_id) return
    const m = byOrg.get(s.organization_id) ?? new Map()
    m.set(s.key, s.value)
    byOrg.set(s.organization_id, m)
    if (s.key === 'hero_content') heroUpdatedByOrg.set(s.organization_id, s.updated_at)
  })

  let totalServices = 0
  let totalTestimonials = 0
  let withHero = 0
  let withCompany = 0
  let withLogo = 0
  let withMaintenanceActive = 0
  const customizedHeros: Array<{ name: string; slug: string; title: string; subtitle: string; updatedAt: string | null }> = []

  orgs.forEach((o) => {
    const s = byOrg.get(o.id)
    if (!s) return
    const hero = s.get('hero_content') as Record<string, unknown> | undefined
    const company = s.get('company_info') as Record<string, unknown> | undefined
    const services = s.get('services') as unknown[] | undefined
    const testimonials = s.get('testimonials') as unknown[] | undefined
    const maintenance = s.get('maintenance_mode') as Record<string, unknown> | undefined

    if (Array.isArray(services)) totalServices += services.length
    if (Array.isArray(testimonials)) totalTestimonials += testimonials.length
    if (hero?.title) withHero++
    if (company?.phone || company?.email) withCompany++
    if (company?.logoUrl) withLogo++
    if (maintenance?.enabled) withMaintenanceActive++

    if (hero?.title && typeof hero.title === 'string' && hero.title !== DEFAULT_HERO_TITLE) {
      customizedHeros.push({
        name: o.name,
        slug: o.slug,
        title: String(hero.title),
        subtitle: String(hero.subtitle ?? ''),
        updatedAt: heroUpdatedByOrg.get(o.id) ?? null,
      })
    }
  })

  return {
    totalOrgs: orgs.length,
    publicOrgs: publicCount ?? 0,
    withHero,
    withCompany,
    withLogo,
    withMaintenanceActive,
    totalServices,
    totalTestimonials,
    customizedHeros: customizedHeros.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')).slice(0, 10),
  }
}

export default async function SuperAdminLandingContentPage() {
  const data = await getLandingData()
  const heroPercent = data.totalOrgs > 0 ? Math.round((data.withHero / data.totalOrgs) * 100) : 0
  const companyPercent = data.totalOrgs > 0 ? Math.round((data.withCompany / data.totalOrgs) * 100) : 0
  const logoPercent = data.totalOrgs > 0 ? Math.round((data.withLogo / data.totalOrgs) * 100) : 0

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
            <LayoutTemplate className="h-3.5 w-3.5" />
            Landing tenants
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Landings de tenants</h1>
          <p className="max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            Estado del contenido editorial (hero, servicios, testimonios) de las páginas públicas de cada organización.
          </p>
        </div>
      </header>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total tenants" value={data.totalOrgs} sub={`${data.publicOrgs} públicas en marketplace`} icon={Eye} tone="info" />
        <StatCard label="Hero personalizado" value={`${heroPercent}%`} sub={`${data.withHero} de ${data.totalOrgs} tenants`} icon={Sparkles} tone={heroPercent >= 70 ? 'success' : 'warning'} />
        <StatCard label="Servicios cargados" value={data.totalServices} sub="entre todas las organizaciones" icon={CheckCircle2} tone="success" />
        <StatCard label="Testimonios" value={data.totalTestimonials} sub="cargados por tenants" icon={MessageSquare} />
      </div>

      {/* Completion breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Completitud de contenido</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: 'Hero personalizado', icon: Sparkles, percent: heroPercent, count: data.withHero },
            { label: 'Datos de contacto', icon: Phone, percent: companyPercent, count: data.withCompany },
            { label: 'Logo subido', icon: ImageIcon, percent: logoPercent, count: data.withLogo },
          ].map((item) => {
            const Icon = item.icon
            const color = item.percent >= 80 ? 'bg-emerald-500'
              : item.percent >= 50 ? 'bg-amber-500'
              : item.percent >= 20 ? 'bg-orange-500'
              : 'bg-red-500'
            return (
              <div key={item.label}>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-slate-700 dark:text-slate-300">{item.label}</span>
                  </div>
                  <span className="font-mono text-xs tabular-nums">
                    <strong className="text-slate-900 dark:text-slate-50">{item.count}</strong>
                    <span className="text-slate-400"> / {data.totalOrgs} ({item.percent}%)</span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div className={cn('h-full transition-all', color)} style={{ width: `${item.percent}%` }} />
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Maintenance warning */}
      {data.withMaintenanceActive > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 dark:border-orange-900/50 dark:bg-orange-950/20">
          <AlertTriangle className="h-5 w-5 shrink-0 text-orange-600 dark:text-orange-400" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">
              {data.withMaintenanceActive} sitio{data.withMaintenanceActive !== 1 ? 's' : ''} en modo mantenimiento
            </p>
            <p className="text-xs text-orange-700 dark:text-orange-400">
              Visitantes ven mensaje de mantenimiento en lugar del contenido normal.
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0 border-orange-300 text-orange-700 hover:bg-orange-100 dark:border-orange-700 dark:text-orange-300">
            <Link href="/superadmin/web-content">Ver lista</Link>
          </Button>
        </div>
      )}

      {/* Recent custom heroes */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Heros personalizados recientes</CardTitle>
            <Badge variant="outline" className="rounded-full text-xs">
              <Star className="mr-1 h-3 w-3" /> {data.customizedHeros.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {data.customizedHeros.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center">
              <Award className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm text-slate-500">
                Ninguna organización ha personalizado su hero todavía.
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                Todos usan el texto por defecto del template.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.customizedHeros.map((h) => (
                <div key={h.slug} className="flex items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">{h.name}</p>
                      <span className="truncate text-xs text-slate-400">/{h.slug}</span>
                    </div>
                    <p className="mt-1 truncate text-sm text-slate-700 dark:text-slate-300">{h.title}</p>
                    {h.subtitle && (
                      <p className="mt-0.5 truncate text-xs text-slate-500">{h.subtitle}</p>
                    )}
                  </div>
                  <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                    <a href={`/${h.slug}/inicio`} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick links */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/superadmin/web-content" className="flex items-center gap-3 rounded-xl border bg-card p-4 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50">
          <LayoutTemplate className="h-5 w-5 text-slate-400" />
          <div className="flex-1">
            <p className="text-sm font-semibold">Ver todos los sitios</p>
            <p className="text-xs text-slate-400">Estado de configuración por tenant</p>
          </div>
          <ExternalLink className="h-3.5 w-3.5 text-slate-300" />
        </Link>
        <Link href="/superadmin/web-content/marketplace" className="flex items-center gap-3 rounded-xl border bg-card p-4 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50">
          <TrendingUp className="h-5 w-5 text-slate-400" />
          <div className="flex-1">
            <p className="text-sm font-semibold">Marketplace público</p>
            <p className="text-xs text-slate-400">Empresas visibles globalmente</p>
          </div>
          <ExternalLink className="h-3.5 w-3.5 text-slate-300" />
        </Link>
      </div>
    </div>
  )
}
