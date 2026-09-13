'use client'

import React, { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MarketplaceOrganization } from '@/lib/public/marketplace'

interface MarketplaceOrgMarqueeProps {
  organizations: MarketplaceOrganization[]
  className?: string
}

function CompanyCard({
  org,
  idx,
  imageErrors,
  onImageError,
}: {
  org: MarketplaceOrganization
  idx: number
  imageErrors: Record<string, boolean>
  onImageError: (key: string) => void
}) {
  const hasValidLogo = Boolean(org.logo_url && !imageErrors[`${org.id}-${idx}`])
  const initials = org.name
    ? org.name
        .split(' ')
        .map((w) => w[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'EP'

  return (
    <Link
      href={`/${org.slug}/inicio`}
      className="group relative flex h-20 w-64 shrink-0 items-center gap-3.5 rounded-2xl border border-slate-200/90 bg-white/95 p-3.5 shadow-xs backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900/95 dark:hover:border-cyan-600 dark:hover:shadow-cyan-950/30"
    >
      {/* Logo or Initials Avatar */}
      <div className="relative flex h-13 w-13 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100/80 p-1 transition-transform duration-300 group-hover:scale-105 dark:border-slate-750 dark:from-slate-800 dark:to-slate-850">
        {hasValidLogo ? (
          <Image
            src={org.logo_url!}
            alt={org.name}
            width={48}
            height={48}
            className="h-full w-full object-contain"
            onError={() => onImageError(`${org.id}-${idx}`)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-cyan-500/10 to-blue-500/10 dark:from-cyan-500/20 dark:to-blue-500/20 text-cyan-700 dark:text-cyan-300 font-bold text-xs tracking-wider">
            {initials}
          </div>
        )}
      </div>

      {/* Company Name & Status */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="truncate text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
            {org.name}
          </span>
        </div>

        <div className="mt-1 flex items-center gap-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          <span className="truncate text-[10px] font-medium text-slate-500 dark:text-slate-400">
            {org.city || 'Catálogo activo'}
          </span>
        </div>
      </div>

      {/* External Link subtle icon */}
      <div className="shrink-0 text-slate-300 group-hover:text-cyan-500 dark:text-slate-600 dark:group-hover:text-cyan-400 transition-colors pr-1">
        <ExternalLink className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100 transition-opacity" />
      </div>
    </Link>
  )
}

export function MarketplaceOrgMarquee({ organizations, className }: MarketplaceOrgMarqueeProps) {
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({})

  const handleImageError = (key: string) => {
    setImageErrors((prev) => ({ ...prev, [key]: true }))
  }

  // Base list ensured to have at least 8 items for continuous flow
  const baseList = useMemo(() => {
    if (!organizations || organizations.length === 0) return []
    let list = [...organizations]
    while (list.length < 8) {
      list = [...list, ...organizations]
    }
    return list
  }, [organizations])

  // Steady velocity duration
  const animationDuration = useMemo(() => {
    return `${Math.max(30, baseList.length * 3.5)}s`
  }, [baseList.length])

  if (!organizations || organizations.length === 0) {
    return null
  }

  return (
    <div className={cn('relative w-full overflow-hidden select-none', className)}>
      {/* Lateral gradient fade masks for seamless entry and exit */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 sm:w-28 bg-gradient-to-r from-slate-50 dark:from-slate-950 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 sm:w-28 bg-gradient-to-l from-slate-50 dark:from-slate-950 to-transparent" />

      {/* Continuous Marquee Track moving from right to left */}
      <div
        className="flex w-max items-center gap-4 py-3 animate-marquee-left hover:[animation-play-state:paused] motion-reduce:animate-none"
        style={{ animationDuration }}
      >
        {/* Track 1 */}
        <div className="flex shrink-0 items-center gap-4">
          {baseList.map((org, idx) => (
            <CompanyCard
              key={`track1-${org.id}-${idx}`}
              org={org}
              idx={idx}
              imageErrors={imageErrors}
              onImageError={handleImageError}
            />
          ))}
        </div>

        {/* Track 2 (Exact duplicate for seamless 100% infinite loop) */}
        <div className="flex shrink-0 items-center gap-4" aria-hidden="true">
          {baseList.map((org, idx) => (
            <CompanyCard
              key={`track2-${org.id}-${idx}`}
              org={org}
              idx={idx + baseList.length}
              imageErrors={imageErrors}
              onImageError={handleImageError}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
