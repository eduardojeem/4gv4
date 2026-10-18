'use client'

import { Building2 } from 'lucide-react'
import type { Brand } from '@/hooks/useBrands'
import { cn } from '@/lib/utils'

/** El logo oficial, o la inicial si la marca es propia. */
export function BrandMark({ brand, size = 'md' }: { brand: Pick<Brand, 'name' | 'logo_url'>; size?: 'md' | 'lg' }) {
  const box = size === 'lg' ? 'h-12 w-12 rounded-2xl text-lg' : 'h-10 w-10 rounded-xl text-sm'
  if (brand.logo_url) {
    return (
      <span className={cn('flex shrink-0 items-center justify-center overflow-hidden border bg-white p-1', box)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={brand.logo_url} alt="" className="max-h-full max-w-full object-contain" />
      </span>
    )
  }
  return (
    <span className={cn('flex shrink-0 items-center justify-center bg-primary/10 font-bold text-primary', box)} aria-hidden="true">
      {brand.name.trim().charAt(0).toUpperCase() || <Building2 className="h-4 w-4" />}
    </span>
  )
}

