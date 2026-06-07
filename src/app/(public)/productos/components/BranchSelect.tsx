'use client'

import { useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { MapPin } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Branch {
  id: string
  name: string
  city: string | null
}

const ALL_BRANCHES = '__all__'

/**
 * Prominent branch selector for the products toolbar. Lets shoppers pick which
 * store location's stock they're browsing. Only rendered when the organization
 * actually has more than one active branch (a single branch needs no choice).
 */
export function BranchSelect({ branches }: { branches: Branch[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  if (branches.length <= 1) return null

  const branchId = searchParams.get('branch_id') || ALL_BRANCHES

  const handleChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === ALL_BRANCHES) {
      params.delete('branch_id')
    } else {
      params.set('branch_id', value)
    }
    params.set('page', '1')
    startTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false })
    })
  }

  return (
    <Select value={branchId} onValueChange={handleChange}>
      <SelectTrigger
        className="h-9 w-[190px] rounded-lg border-primary/40 bg-primary/5 text-sm font-medium text-primary shadow-sm ring-1 ring-primary/10 transition-colors hover:bg-primary/10 focus:ring-2 focus:ring-primary/30 data-[state=open]:bg-primary/10"
        aria-label="Filtrar por sucursal"
      >
        <span className="flex items-center gap-1.5 truncate">
          <MapPin className="h-4 w-4 shrink-0 text-primary" />
          <SelectValue placeholder="Sucursal" />
        </span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_BRANCHES}>Todas las sucursales</SelectItem>
        {branches.map((branch) => (
          <SelectItem key={branch.id} value={branch.id}>
            {branch.name}
            {branch.city ? ` · ${branch.city}` : ''}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
