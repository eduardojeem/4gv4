import type { Metadata } from 'next'
import Link from 'next/link'
import { Building2, ChevronRight, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getMarketplaceOrganizations } from '@/lib/public/marketplace'
import { EmpresasClient } from '@/components/public/EmpresasClient'
import { TopRatedCarousel } from '@/components/public/TopRatedCarousel'

export const metadata: Metadata = {
  title: 'Tiendas y Empresas | Marketplace MiPOS',
  description: 'Directorio comercial de tiendas y empresas con catálogo público activo.',
}

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams: Promise<{ q?: string; rubro?: string; ciudad?: string; city?: string }>
}

export default async function MarketplaceOrganizationsPage({ searchParams }: PageProps) {
  const { q, rubro, ciudad, city } = await searchParams
  const organizations = await getMarketplaceOrganizations(120)

  return (
    <div className="min-h-screen">
      {/* ── Header Hero Moderno ── */}
      <section className="relative overflow-hidden border-b border-border/80 bg-gradient-to-b from-primary/[0.04] via-card to-background py-10 sm:py-12">
        <div className="pointer-events-none absolute -left-12 -top-12 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute right-4 top-0 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link href="/marketplace" className="flex items-center gap-1 hover:text-foreground transition-colors font-medium">
              <Store className="h-3.5 w-3.5" />
              Marketplace
            </Link>
            <ChevronRight className="h-3 w-3 opacity-60" />
            <span className="font-semibold text-foreground bg-muted px-2 py-0.5 rounded-md">
              Empresas y Tiendas
            </span>
          </nav>

          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
                  Directorio de Empresas
                </h1>
                <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                  {organizations.length} tienda{organizations.length !== 1 ? 's' : ''} verificadas con catálogo público · Filtrá por ciudad y rubro comercial
                </p>
              </div>
            </div>

            <Button asChild size="sm" className="w-fit shrink-0 gap-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs">
              <Link href="/register">Publicar mi empresa</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Directorio con Filtro por Rubros y Ciudades ── */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-10">
        <TopRatedCarousel organizations={organizations} />
        <EmpresasClient
          organizations={organizations}
          initialQuery={q ?? ''}
          initialRubro={rubro ?? 'all'}
          initialCity={ciudad ?? city ?? 'all'}
        />
      </section>
    </div>
  )
}
