'use client'

import { useMemo, useState } from 'react'
import { Building2, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { OrganizationDirectoryCard } from '@/components/public/OrganizationDirectoryCard'
import type { MarketplaceOrganization } from '@/lib/public/marketplace'

type Props = {
  organizations: MarketplaceOrganization[]
  initialQuery?: string
}

export function EmpresasClient({ organizations, initialQuery = '' }: Props) {
  const [query, setQuery] = useState(initialQuery)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return organizations
    return organizations.filter(
      (org) => org.name.toLowerCase().includes(q) || org.slug.toLowerCase().includes(q)
    )
  }, [organizations, query])

  return (
    <div>
      {/* Search bar */}
      <div className="mb-6 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar empresa..."
            className="h-10 pl-9 pr-9"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <p className="shrink-0 text-sm text-slate-500 dark:text-slate-400">
          {filtered.length}{filtered.length !== organizations.length ? ` de ${organizations.length}` : ''} empresa{organizations.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((org) => (
            <OrganizationDirectoryCard key={org.id} organization={org} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 py-16 text-center dark:border-slate-700">
          <Building2 className="mb-3 h-8 w-8 text-slate-300 dark:text-slate-600" />
          <p className="font-medium text-slate-700 dark:text-slate-300">Sin resultados para &quot;{query}&quot;</p>
          <button
            onClick={() => setQuery('')}
            className="mt-3 text-sm font-medium text-cyan-700 hover:underline dark:text-cyan-400"
          >
            Ver todas las empresas
          </button>
        </div>
      )}
    </div>
  )
}
