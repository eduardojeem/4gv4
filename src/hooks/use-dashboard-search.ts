import { useCallback } from 'react'
import { useRouter } from 'next/navigation'

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

    const search = useCallback((input: { query: string; filters: SearchFilters }): SearchResult[] => {
        const { query, filters } = input
        const results: SearchResult[] = []

        if (!query || query.length < 2) {
            return results
        }

        const lowerQuery = query.toLowerCase()
        const filterType = filters.type || 'todos'

        // Mock data - En producción, esto debería consultar Supabase
        // Búsqueda en productos
        if (filterType === 'todos' || filterType === 'productos') {
            const mockProducts = [
                { id: 1, name: 'iPhone 14 Pro', sku: 'IP14P-128', price: 999 },
                { id: 2, name: 'Samsung Galaxy S23', sku: 'SGS23-256', price: 899 },
                { id: 3, name: 'Cargador USB-C', sku: 'CHG-USBC', price: 25 },
                { id: 4, name: 'Funda iPhone', sku: 'CASE-IP14', price: 15 },
                { id: 5, name: 'Protector de pantalla', sku: 'SCREEN-PROT', price: 10 },
            ]

            mockProducts
                .filter(p =>
                    p.name.toLowerCase().includes(lowerQuery) ||
                    p.sku.toLowerCase().includes(lowerQuery)
                )
                .forEach(p => {
                    results.push({
                        title: p.name,
                        subtitle: `SKU: ${p.sku} · $${p.price}`,
                        href: `/dashboard/products?search=${p.sku}`,
                        type: 'producto'
                    })
                })
        }

        // Búsqueda en clientes
        if (filterType === 'todos' || filterType === 'clientes') {
            const mockCustomers = [
                { id: 1, name: 'Juan Pérez', email: 'juan@email.com', phone: '555-0001' },
                { id: 2, name: 'María González', email: 'maria@email.com', phone: '555-0002' },
                { id: 3, name: 'Carlos Rodríguez', email: 'carlos@email.com', phone: '555-0003' },
                { id: 4, name: 'Ana Martínez', email: 'ana@email.com', phone: '555-0004' },
            ]

            mockCustomers
                .filter(c =>
                    c.name.toLowerCase().includes(lowerQuery) ||
                    c.email.toLowerCase().includes(lowerQuery) ||
                    c.phone.includes(lowerQuery)
                )
                .forEach(c => {
                    results.push({
                        title: c.name,
                        subtitle: `${c.email} · ${c.phone}`,
                        href: `/dashboard/customers?search=${c.name}`,
                        type: 'cliente'
                    })
                })
        }

        // Búsqueda en reparaciones
        if (filterType === 'todos' || filterType === 'reparaciones') {
            const mockRepairs = [
                { id: 1, device: 'iPhone 13', client: 'Juan Pérez', status: 'En proceso' },
                { id: 2, device: 'Samsung S22', client: 'María González', status: 'Completado' },
                { id: 3, device: 'iPad Air', client: 'Carlos Rodríguez', status: 'Pendiente' },
            ]

            mockRepairs
                .filter(r =>
                    r.device.toLowerCase().includes(lowerQuery) ||
                    r.client.toLowerCase().includes(lowerQuery) ||
                    `#${r.id}`.includes(lowerQuery)
                )
                .forEach(r => {
                    results.push({
                        title: `Reparación #${r.id} - ${r.device}`,
                        subtitle: `Cliente: ${r.client} · Estado: ${r.status}`,
                        href: `/dashboard/repairs?id=${r.id}`,
                        type: 'reparacion'
                    })
                })
        }

        // Limitar resultados
        return results.slice(0, 10)
    }, [])

    const navigateToResult = useCallback((href: string) => {
        router.push(href)
    }, [router])

    return {
        search,
        navigateToResult
    }
}
