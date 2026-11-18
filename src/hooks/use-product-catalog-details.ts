'use client'
import { useCallback, useEffect, useState } from 'react'
import { useTenantScope } from './use-tenant-scope'
import { ProductDetailsSchema, type ProductDetails } from '@/lib/products/catalog-contract'

export function useProductCatalogDetails(productId?: string) {
  const { scope, currentScope } = useTenantScope()
  const key = `${scope}:${productId ?? 'new'}`
  const [retry, setRetry] = useState(0)
  const [state, setState] = useState<{ key: string; available: boolean; details: ProductDetails; variantKeys?: string[]; error?: string } | null>(null)
  const reload = useCallback(() => setRetry(n => n + 1), [])
  useEffect(() => {
    const abort = new AbortController()
    let active = true
    void (async () => {
      try {
        const response = await fetch(`/api/products/catalog-details${productId ? '?id=' + encodeURIComponent(productId) : ''}`, { cache: 'no-store', signal: abort.signal })
        const body = await response.json()
        if (!response.ok || typeof body.available !== 'boolean') throw new Error(body.error || 'No se pudieron consultar las características.')
        const details = ProductDetailsSchema.parse(body.details)
        if (active && currentScope.current === scope) setState({ key, available: body.available, details, variantKeys: Array.isArray(body.variantKeys) ? body.variantKeys.filter((key: unknown) => typeof key === 'string') : [] })
      } catch (error) { if (active && currentScope.current === scope) setState({ key, available: false, details: {}, error: error instanceof Error ? error.message : 'No se pudieron consultar las características.' }) }
    })()
    const changed = (event: Event) => { if ((event as CustomEvent).detail?.productId === productId) reload() }
    window.addEventListener('catalog-details:changed', changed)
    return () => { active = false; abort.abort(); window.removeEventListener('catalog-details:changed', changed) }
  }, [productId, key, scope, currentScope, retry, reload])
  return { loading: state?.key !== key, available: state?.key === key && state.available, details: state?.key === key ? state.details : {}, variantKeys: state?.key === key ? state.variantKeys ?? [] : [], error: state?.key === key ? state.error : undefined, reload }
}
