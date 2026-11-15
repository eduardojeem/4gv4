'use client';
import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseClient } from '@/lib/supabase/client';
import { useSubscriptionStatus } from '@/contexts/SubscriptionStatusContext';
import { useTenantScope } from '@/hooks/use-tenant-scope';
import { usePermissions } from '@/hooks/use-permissions';
import { formatCurrency } from '@/lib/currency';
import { getAvailableDashboardSearchTypes, type DashboardSearchType } from '@/lib/navigation/dashboard-navigation';
type SearchResult = {
    title: string;
    subtitle?: string;
    href: string;
    type: 'producto' | 'servicio' | 'turno' | 'cliente' | 'reparacion';
};
type SearchFilters = {
    type?: DashboardSearchType;
    status?: string;
    from?: string;
    to?: string;
};
export function useDashboardSearch() {
    const router = useRouter(), { effectiveModules } = useSubscriptionStatus(), { organizationId, scope, currentScope } = useTenantScope(), { hasPermission } = usePermissions();
    const allowed = useMemo(() => effectiveModules.filter(module => module === 'inventory' ? hasPermission('products.read') : module === 'services' ? (hasPermission('products.read') || hasPermission('pos.read')) : module === 'crm' ? hasPermission('customers.read') : module === 'repairs' ? hasPermission('repairs.read') : true), [effectiveModules, hasPermission]);
    const availableTypes = useMemo(() => getAvailableDashboardSearchTypes(allowed).filter(type => type === 'turnos' ? hasPermission('pos.read') : type === 'servicios' ? hasPermission('products.read') : true), [allowed, hasPermission]);
    const search = useCallback(async ({ query, filters }: {
        query: string;
        filters: SearchFilters;
    }): Promise<SearchResult[]> => {
        const term = query.replace(/[^\p{L}\p{N}\s@+.'-]/gu, ' ').trim().slice(0, 80);
        if (term.length < 2 || !organizationId)
            return [];
        const captured = scope, client = createSupabaseClient(), results: SearchResult[] = [], kind = filters.type ?? 'todos';
        const wants = (type: DashboardSearchType) => availableTypes.includes(type) && (kind === 'todos' || kind === type);
        if (wants('productos') || wants('servicios')) {
            let request = client.from('products').select('id,name,sku,sale_price,unit_measure').eq('organization_id', organizationId).or(`name.ilike.%${term}%,sku.ilike.%${term}%`);
            if (!wants('productos'))
                request = request.eq('unit_measure', 'servicio');
            else if (!wants('servicios'))
                request = request.neq('unit_measure', 'servicio');
            const { data, error } = await request.limit(10);
            if (error)
                throw new Error('No se pudo consultar el catálogo.');
            for (const row of data ?? [])
                results.push({ title: row.name, subtitle: `${row.unit_measure === 'servicio' ? 'Servicio' : 'Producto'} · ${formatCurrency(row.sale_price)}`, href: `/dashboard/products/${row.id}`, type: row.unit_measure === 'servicio' ? 'servicio' : 'producto' });
        }
        if (wants('clientes')) {
            const { data, error } = await client.from('customers').select('id,name,first_name,last_name,email,phone').eq('organization_id', organizationId).or(`name.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`).limit(5);
            if (error)
                throw new Error('No se pudo consultar clientes.');
            for (const row of data ?? [])
                results.push({ title: row.name || [row.first_name, row.last_name].filter(Boolean).join(' ') || 'Cliente sin nombre', subtitle: [row.email, row.phone].filter(Boolean).join(' · '), href: `/dashboard/customers/${row.id}`, type: 'cliente' });
        }
        if (wants('reparaciones')) {
            const { data, error } = await client.from('repairs').select('id,device_model,status').eq('organization_id', organizationId).ilike('device_model', `%${term}%`).limit(5);
            if (error)
                throw new Error('No se pudo consultar reparaciones.');
            for (const row of data ?? [])
                results.push({ title: `Reparación · ${row.device_model || 'Dispositivo'}`, subtitle: row.status, href: `/dashboard/repairs?id=${row.id}`, type: 'reparacion' });
        }
        if (wants('turnos')) {
            const { data, error } = await client.from('appointments').select('id,customer_name,service_name,starts_at').eq('organization_id', organizationId).or(`customer_name.ilike.%${term}%,service_name.ilike.%${term}%`).order('starts_at', { ascending: false }).limit(5);
            if (error)
                throw new Error('No se pudo consultar turnos.');
            for (const row of data ?? [])
                results.push({ title: row.customer_name, subtitle: row.service_name, href: `/dashboard/agenda?appointment=${row.id}`, type: 'turno' });
        }
        return currentScope.current === captured ? results : [];
    }, [organizationId, scope, currentScope, availableTypes]);
    return { search, availableTypes, scopeKey: scope + ':' + availableTypes.join(','), navigateToResult: useCallback((href: string) => router.push(href), [router]) };
}
