'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { createClient } from '@/lib/supabase/client'
import { useTenantScope } from '@/hooks/use-tenant-scope'

export interface CatalogRecord {
  id: string
  name: string
  is_active?: boolean | null
  [key: string]: unknown
}
export interface CatalogData { categories: CatalogRecord[]; brands: CatalogRecord[]; suppliers: CatalogRecord[] }
const empty = (): CatalogData => ({ categories: [], brands: [], suppliers: [] })

/** Categories API is unpaginated; explicitly page its tenant-filtered RLS source. */
export async function fetchCatalogCategories(organizationId: string, signal?: AbortSignal): Promise<CatalogRecord[]> {
  if (!organizationId) throw new Error('No hay una organización activa')
  const supabase = createClient()
  const rows: CatalogRecord[] = []
  const ids = new Set<string>()
  const pageSize = 100
  for (let page = 0; ; page++) {
    let query = supabase.from('categories')
      .select('id,name,description,parent_id,global_category_id,is_active,created_at,updated_at', { count: 'exact' })
      .eq('organization_id', organizationId)
      .order('id', { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1)
    if (signal) query = query.abortSignal(signal)
    const { data, count, error } = await query
    if (signal?.aborted) throw new DOMException('Consulta cancelada', 'AbortError')
    if (error) throw new Error('No se pudieron cargar todas las categorías. Vuelve a actualizar.')
    if (typeof count !== 'number' || !data) throw new Error('No se pudo verificar la cobertura de categorías')
    for (const row of data) {
      if (ids.has(row.id)) throw new Error('El catálogo cambió durante la carga; vuelve a actualizar')
      ids.add(row.id)
      rows.push(row)
    }
    if (rows.length === count) return rows
    if (!data.length || rows.length > count) throw new Error('Catálogo incompleto; vuelve a actualizar')
  }
}

/** Read the same tenant-protected APIs as the maintained catalog screens. */
export async function fetchCatalogCollection(kind: 'brands' | 'suppliers', signal?: AbortSignal): Promise<CatalogRecord[]> {
  const rows: CatalogRecord[] = []
  const ids = new Set<string>()
  let expected: number | null = null
  let page = kind === 'suppliers' ? 0 : 1
  while (true) {
    const response = await fetch(`/api/${kind}?page=${page}&limit=100&pageSize=100`, { cache: 'no-store', signal })
    const result = await response.json()
    if (!response.ok || !result.success || !Array.isArray(result.data)) throw new Error(result.error || `No se pudieron cargar ${kind}`)
    if (!Number.isInteger(result.count) || result.count < 0 || expected !== null && result.count !== expected) throw new Error('No se pudo verificar el catálogo completo; vuelve a actualizar')
    expected = result.count
    for (const row of result.data) {
      if (!row.id || ids.has(row.id)) throw new Error('El catálogo cambió durante la carga; vuelve a actualizar')
      ids.add(row.id)
      rows.push(row)
    }
    if (rows.length === expected) break
    if (!result.data.length || rows.length > expected!) throw new Error('Catálogo incompleto; vuelve a actualizar')
    page += 1
  }
  return rows
}

export function useCatalogSync() {
  const { user, loading } = useAuth()
  const { scope: tenantScope, currentScope, organizationId } = useTenantScope()
  const scope = user?.id && organizationId ? tenantScope : null
  const [snapshot, setSnapshot] = useState<{ scope: string; data: CatalogData } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    queueMicrotask(() => {
      if (controller.signal.aborted) return
      setSnapshot(null)
      setError(null)
      setIsLoading(Boolean(scope) || loading)
    })
    if (loading || !scope) return () => controller.abort()
    Promise.all([fetchCatalogCategories(organizationId!, controller.signal), fetchCatalogCollection('brands', controller.signal), fetchCatalogCollection('suppliers', controller.signal)])
      .then(([categories, brands, suppliers]) => {
        if (!controller.signal.aborted && currentScope.current === scope) setSnapshot({ scope, data: { categories, brands, suppliers } })
      })
      .catch(err => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Error al cargar el catálogo') })
      .finally(() => { if (!controller.signal.aborted) setIsLoading(false) })
    return () => controller.abort()
  }, [scope, loading, revision, currentScope, organizationId])
  const catalogData = snapshot?.scope === scope ? snapshot.data : empty()
  const ready = Boolean(scope && snapshot?.scope === scope && !error && !isLoading)
  const refresh = useCallback(() => setRevision(value => value + 1), [])
  const exportData = () => {
    if (!ready || currentScope.current !== scope) throw new Error('El catálogo todavía no está disponible')
    const url = URL.createObjectURL(new Blob([JSON.stringify({ ...catalogData, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `catalogo-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }
  return { ...catalogData, catalogData, ready, isLoading: loading || isLoading, error, refresh, exportData }
}
