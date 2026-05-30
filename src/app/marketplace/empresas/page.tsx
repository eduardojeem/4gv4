import type { Metadata } from 'next'
import Link from 'next/link'
import { Building2, ChevronRight, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getMarketplaceOrganizations } from '@/lib/public/marketplace'
import { EmpresasClient } from '@/components/public/EmpresasClient'

export const metadata: Metadata = {
  title: 'Empresas | Marketplace MiPOS',
  description: 'Directorio de empresas con tiendas públicas en el marketplace.',
}

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams: Promise<{ q?: string }>
}

export default async function MarketplaceOrganizationsPage({ searchParams }: PageProps) {
  const { q } = await searchParams
  const organizations = await getMarketplaceOrganizations(120)

  return (
    <main>
      {/* ── Header ── */}
      <section className="relative overflow-hidden border-b border-slate-200 dark:border-slate-800">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(6,182,212,0.07),transparent)]" />
        <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <nav className="mb-5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Link href="/marketplace" className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-300">
              <Store className="h-3 w-3" />
              Marketplace
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="font-medium text-slate-700 dark:text-slate-200">Empresas</span>
          </nav>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-600 text-white">
                  <Building2 className="h-5 w-5" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                  Empresas
                </h1>
              </div>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                {organizations.length} tienda{organizations.length !== 1 ? 's' : ''} con catálogo público activo · hacé click para ir directo a la tienda
              </p>
            </div>
            <Button asChild size="sm" className="shrink-0 gap-2 bg-cyan-600 hover:bg-cyan-700">
              <Link href="/register">Publicar mi empresa</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Directorio ── */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <EmpresasClient organizations={organizations} initialQuery={q ?? ''} />
      </section>
    </main>
  )
}
