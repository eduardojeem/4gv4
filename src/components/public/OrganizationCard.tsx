import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Building2, Package } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MarketplaceOrganization } from '@/lib/public/marketplace'

const planStyles: Record<string, string> = {
  FREE: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
  BASIC: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900',
  PRO: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-900',
  ENTERPRISE: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900',
}

type Props = {
  organization: MarketplaceOrganization
  className?: string
}

export function OrganizationCard({ organization, className }: Props) {
  const plan = organization.plan ?? 'FREE'
  const planClass = planStyles[plan] ?? planStyles.FREE

  return (
    <Link
      href={`/marketplace/empresas/${organization.slug}`}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-all duration-200',
        'hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-[0_8px_24px_-4px_rgba(6,182,212,0.15)]',
        'dark:border-slate-800 dark:bg-slate-950 dark:hover:border-cyan-700',
        className
      )}
    >
      {/* Header strip */}
      <div className="h-1.5 w-full bg-gradient-to-r from-cyan-500/30 via-cyan-400/50 to-cyan-500/30 transition-all duration-300 group-hover:from-cyan-500 group-hover:via-cyan-400 group-hover:to-cyan-500" />

      <div className="flex flex-1 flex-col p-5">
        {/* Logo + plan */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
            {organization.logo_url ? (
              <Image
                src={organization.logo_url}
                alt={organization.name}
                width={48}
                height={48}
                className="h-full w-full object-cover"
              />
            ) : (
              <Building2 className="h-5 w-5 text-slate-400" />
            )}
          </div>
          <span className={cn('rounded-md border px-2 py-0.5 text-xs font-medium', planClass)}>
            {plan}
          </span>
        </div>

        {/* Name + slug */}
        <div className="mt-4 flex-1">
          <h3 className="truncate font-semibold text-slate-900 dark:text-slate-50">{organization.name}</h3>
          <p className="mt-0.5 truncate text-xs text-slate-400 dark:text-slate-500">marketplace.mipos.app/{organization.slug}</p>
        </div>

        {/* Products count */}
        <div className="mt-4 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
          <Package className="h-3.5 w-3.5 shrink-0" />
          <span>{organization.products_count} productos</span>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 dark:border-slate-800">
        <span className="text-xs font-medium text-cyan-700 dark:text-cyan-400">Ver empresa</span>
        <ArrowRight className="h-4 w-4 text-cyan-600 transition-transform duration-200 group-hover:translate-x-1 dark:text-cyan-400" />
      </div>
    </Link>
  )
}
