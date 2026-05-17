'use client'

import { Building2, CheckCircle2 } from 'lucide-react'
import { useBranch } from '@/contexts/branch-context'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface BranchSelectorProps {
  compact?: boolean
  className?: string
}

export function BranchSelector({ compact = false, className }: BranchSelectorProps) {
  const { branches, selectedBranchId, selectedBranch, setSelectedBranchId, loading } = useBranch()

  if (loading) {
    return <Skeleton className={cn('h-9 w-[170px] rounded-lg', className)} />
  }

  if (branches.length <= 1) {
    if (!selectedBranch) return null

    return (
      <div
        className={cn(
          'inline-flex items-center gap-2 rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-sm text-foreground shadow-sm',
          compact && 'h-9 px-2.5 py-1.5 text-xs',
          className
        )}
      >
        <Building2 className={cn('h-4 w-4 text-primary', compact && 'h-3.5 w-3.5')} />
        <span className="truncate font-medium">{selectedBranch.name}</span>
      </div>
    )
  }

  return (
    <Select
      value={selectedBranchId ?? undefined}
      onValueChange={(value) => setSelectedBranchId(value || null)}
    >
      <SelectTrigger
        className={cn(
          'h-10 min-w-[190px] rounded-xl border-border/60 bg-background/80 shadow-sm',
          compact && 'h-9 min-w-[168px] rounded-lg text-xs',
          className
        )}
        aria-label="Seleccionar sucursal activa"
      >
        <div className="flex min-w-0 items-center gap-2">
          <Building2 className={cn('h-4 w-4 text-primary', compact && 'h-3.5 w-3.5')} />
          <SelectValue placeholder="Seleccionar sucursal" />
        </div>
      </SelectTrigger>
      <SelectContent align="end">
        {branches.map((branch) => (
          <SelectItem key={branch.id} value={branch.id}>
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate">{branch.name}</span>
              {branch.is_default ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              ) : null}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
