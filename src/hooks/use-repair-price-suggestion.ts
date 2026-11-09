'use client'

import { useEffect, useState } from 'react'
import { branchHeaders } from '@/lib/branches/client'
import type { PriceSuggestion } from '@/lib/repairs/price-suggestion'

/**
 * Precio que el taller ya cobró por el mismo modelo y una falla parecida.
 * Espera a que se deje de escribir y se apaga solo si falta algún dato.
 */
export function useRepairPriceSuggestion(input: {
  brand?: string | null
  model?: string | null
  issue?: string | null
  excludeId?: string | null
  branchId?: string | null
  enabled?: boolean
}): PriceSuggestion | null {
  const { brand, model, issue, excludeId, branchId, enabled = true } = input
  const [suggestion, setSuggestion] = useState<{ key: string; value: PriceSuggestion | null } | null>(null)
  const ready = enabled && Boolean(brand?.trim() && model?.trim() && issue?.trim())
  const key = ready ? [brand, model, issue, excludeId ?? '', branchId ?? ''].join('|') : ''

  useEffect(() => {
    if (!key) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ brand: brand ?? '', model: model ?? '', issue: issue ?? '' })
      if (excludeId) params.set('excludeId', excludeId)
      void fetch(`/api/repairs/price-suggestion?${params}`, { signal: controller.signal, headers: branchHeaders(branchId ?? null) })
        .then((response) => (response.ok ? response.json() : null))
        .then((body: { suggestion?: PriceSuggestion | null } | null) => setSuggestion({ key, value: body?.suggestion ?? null }))
        .catch(() => undefined)
    }, 400)
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [key, brand, model, issue, excludeId, branchId])

  // Lo de una búsqueda anterior no se muestra para otro equipo.
  return suggestion && suggestion.key === key ? suggestion.value : null
}
