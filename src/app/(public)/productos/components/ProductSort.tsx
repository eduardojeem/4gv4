'use client'

import { useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function ProductSort() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const sort = searchParams.get('sort') || 'name'

  const handleSortChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('sort', value)
    params.set('page', '1')

    startTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false })
    })
  }

  return (
    <Select value={sort} onValueChange={handleSortChange}>
      <SelectTrigger className="w-[150px] h-9 rounded-lg text-sm">
        <SelectValue placeholder="Ordenar" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="name">Nombre A-Z</SelectItem>
        <SelectItem value="price_asc">Menor precio</SelectItem>
        <SelectItem value="price_desc">Mayor precio</SelectItem>
        <SelectItem value="newest">Mas recientes</SelectItem>
      </SelectContent>
    </Select>
  )
}
