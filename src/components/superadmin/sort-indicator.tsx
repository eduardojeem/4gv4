import { ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react'

export function SortIndicator({
  active,
  direction,
}: {
  active: boolean
  direction: 'asc' | 'desc'
}) {
  if (!active) return <ArrowUpDown aria-hidden="true" className="ml-1 h-3 w-3 opacity-30" />
  return direction === 'asc'
    ? <ChevronUp aria-hidden="true" className="ml-1 h-3 w-3 text-indigo-500" />
    : <ChevronDown aria-hidden="true" className="ml-1 h-3 w-3 text-indigo-500" />
}
