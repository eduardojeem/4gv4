import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase/client'

interface SearchResult {
    title: string
    subtitle?: string
    href: string
    type: 'producto' | 'cliente' | 'reparacion' | 'proveedor' | 'reporte'
}

interface SearchFilters {
    type?: 'productos' | 'clientes' | 'reparaciones' | 'todos'
    status?: string
    from?: string
    to?: string
}

/**
 * Hook para búsqueda global en el dashboard
 * Busca en productos, clientes, reparaciones, proveedores
 */
export function useDashboardSearch() {
    const router = useRouter()

    const search = useCallback(async (input: { query: string; filters: SearchFilters }): Promise<SearchResult[]> => {
        const { query, filters } = input
        const results: SearchResult[] = []

        if (!query || query.length < 2) {
            return results
        }

        const supabase = createSupabaseClient()
        const filterType = filters.type || 'todos'

        try {
            // Búsqueda en productos
            if (filterType === 'todos' || filterType === 'productos') {
                const { data: products } = await supabase
                    .from('products')
                    .select('id, name, sku, sale_price')
                    .or(`name.ilike.%${query}%,sku.ilike.%${query}%`)
                    .limit(5)

                products?.forEach(p => {
                    results.push({
                        title: p.name,
                        subtitle: `SKU: ${p.sku} · $${p.sale_price}`,
                        href: `/dashboard/products/${p.id}`,
                        type: 'producto'
                    })
                })
            }

            // Búsqueda en clientes
            if (filterType === 'todos' || filterType === 'clientes') {
                const { data: customers } = await supabase
                    .from('customers')
                    .select('id, first_name, last_name, email, phone')
                    .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
                    .limit(5)

                customers?.forEach(c => {
                    const name = `${c.first_name || ''} ${c.last_name || ''}`.trim()
                    results.push({
                        title: name || 'Sin nombre',
                        subtitle: `${c.email || ''} · ${c.phone || ''}`,
                        href: `/dashboard/customers/${c.id}`,
                        type: 'cliente'
                    })
                })
            }

            // Búsqueda en reparaciones
            if (filterType === 'todos' || filterType === 'reparaciones') {
                const { data: repairs } = await supabase
                    .from('repairs')
                    .select(`
                        id, 
                        device_model, 
                        status, 
                        customer:customers(first_name, last_name)
                    `)
                    .ilike('device_model', `%${query}%`)
                    .limit(5)

                repairs?.forEach((r: any) => {
                    const customerName = r.customer ? `${r.customer.first_name || ''} ${r.customer.last_name || ''}`.trim() : 'Desconocido'
                    results.push({
                        title: `Reparación - ${r.device_model || 'Dispositivo'}`,
                        subtitle: `Cliente: ${customerName} · Estado: ${r.status}`,
                        href: `/dashboard/repairs?id=${r.id}`,
                        type: 'reparacion'
                    })
                })
            }
        } catch (error) {
            console.error('Error en búsqueda global:', error)
        }

        return results
    }, [])

    const navigateToResult = useCallback((href: string) => {
        router.push(href)
    }, [router])

    return {
        search,
        navigateToResult
    }
}
