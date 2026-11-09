'use client'

import useSWR from 'swr'
import type { TemplatePlanAccess } from '@/lib/website/template-catalog'
import type { PlanCode } from '@/lib/saas/plan-features'

export interface StorefrontTemplateAccessResponse extends TemplatePlanAccess {
  planCode: PlanCode
  businessVertical: string
  servicesAvailable: boolean
}

async function fetchAccess(url: string): Promise<StorefrontTemplateAccessResponse> {
  const response = await fetch(url)
  const body = await response.json().catch(() => null)
  if (!response.ok || !body?.success) throw new Error(body?.error || 'No se pudo comprobar tu plan.')
  return body.data as StorefrontTemplateAccessResponse
}

/** Plantillas que trae el plan de la tienda (para bloquear las que no). */
export function useStorefrontTemplateAccess(enabled = true) {
  const { data, error, isLoading } = useSWR(
    enabled ? '/api/admin/website/storefront-templates' : null,
    fetchAccess,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  )
  return { access: data ?? null, error, isLoading }
}
