'use client'
import { useSearchParams } from 'next/navigation'
import { FirstOperationGuide } from './FirstOperationGuide'

export function FirstOperationEntryGuide({ kind }: { kind: 'sale' | 'reservation' | 'repair' }) {
  const params = useSearchParams()
  const key = kind === 'sale' ? 'first-sale' : kind === 'reservation' ? 'first-reservation' : 'first-repair'
  if (params.get('guide') !== key) return null
  return <div className="max-h-[35dvh] shrink-0 overflow-y-auto p-3"><FirstOperationGuide kind={kind} /></div>
}
