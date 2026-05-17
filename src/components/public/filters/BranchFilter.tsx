'use client'

import { MapPin } from 'lucide-react'
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { cn } from '@/lib/utils'

interface Branch {
  id: string
  name: string
  city: string | null
}

interface BranchFilterProps {
  branches: Branch[]
  selectedBranchId: string
  onSelect: (branchId: string | null) => void
}

export function BranchFilter({ branches, selectedBranchId, onSelect }: BranchFilterProps) {
  if (branches.length <= 1) return null

  return (
    <AccordionItem value="branch" className="border-b-0 last:border-b-0">
      <AccordionTrigger className="px-4 py-3 text-sm font-semibold hover:no-underline">
        <span className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          Sucursal
        </span>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4">
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => onSelect(null)}
            className={cn(
              'w-full text-left rounded-lg px-3 py-2 text-sm transition-colors',
              !selectedBranchId
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            Todas las sucursales
          </button>
          {branches.map((branch) => (
            <button
              key={branch.id}
              type="button"
              onClick={() => onSelect(branch.id)}
              className={cn(
                'w-full text-left rounded-lg px-3 py-2 text-sm transition-colors',
                selectedBranchId === branch.id
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <span className="block">{branch.name}</span>
              {branch.city && (
                <span className="block text-xs text-muted-foreground/70">{branch.city}</span>
              )}
            </button>
          ))}
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}
