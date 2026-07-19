import { useCallback, useEffect, useState } from 'react'
import { config, isDemoNoDb } from '@/lib/config'
import { branchHeaders } from '@/lib/branches/client'
import { useAuth } from '@/contexts/auth-context'
import { useBranch } from '@/contexts/branch-context'
import { normalizeSupabaseError } from '@/utils/supabase-error'

export interface Technician {
    id: string
    full_name: string
    name: string
    email: string
    role: string
    specialty?: string
}

const DEMO_TECHNICIANS: Technician[] = [
    {
        id: 'TECH-001',
        full_name: 'Tecnico Demo 1',
        name: 'Tecnico Demo 1',
        email: 'tech1@demo.com',
        role: 'technician',
        specialty: 'Smartphones'
    },
    {
        id: 'TECH-002',
        full_name: 'Tecnico Demo 2',
        name: 'Tecnico Demo 2',
        email: 'tech2@demo.com',
        role: 'technician',
        specialty: 'Laptops'
    }
]

// La caché vive a nivel de módulo (compartida en el navegador): se clava por
// usuario + sucursal para no arrastrar técnicos de otra cuenta u organización
// al cambiar de contexto.
const techniciansCacheByScope = new Map<string, Technician[]>()
const techniciansRequestByScope = new Map<string, Promise<Technician[]>>()

/**
 * Los técnicos se piden al endpoint del servidor, que los acota a los miembros
 * activos de la organización actual (y a la sucursal seleccionada).
 *
 * Antes se consultaba `profiles` directo desde el cliente sin filtrar por
 * organización: el desplegable de "nueva reparación" listaba técnicos de otras
 * empresas y además traía todas las columnas del perfil.
 */
async function fetchTechniciansFromSource(): Promise<Technician[]> {
    if (!config.supabase.isConfigured || isDemoNoDb()) {
        return DEMO_TECHNICIANS
    }

    const response = await fetch('/api/repairs/technicians-stats', {
        cache: 'no-store',
        headers: branchHeaders(),
    })

    if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null
        throw new Error(payload?.error || 'No se pudieron cargar los tecnicos')
    }

    const payload = await response.json() as {
        technicians?: Array<{ id: string; name: string | null; specialty?: string | null }>
    }

    return (payload.technicians ?? []).map((technician) => ({
        id: technician.id,
        full_name: technician.name || '',
        name: technician.name || '',
        email: '',
        role: 'technician',
        specialty: technician.specialty || undefined,
    }))
}

export function useTechnicians() {
    const { user } = useAuth()
    const { selectedBranchId } = useBranch()
    const scopeKey = `${user?.id || 'anon'}:${selectedBranchId || 'all'}`

    const [technicians, setTechnicians] = useState<Technician[]>(
        () => techniciansCacheByScope.get(scopeKey) || []
    )
    const [isLoading, setIsLoading] = useState(!techniciansCacheByScope.has(scopeKey))
    const [error, setError] = useState<string | null>(null)

    const fetchTechnicians = useCallback(async (forceRefresh = false) => {
        const cached = techniciansCacheByScope.get(scopeKey)
        if (!forceRefresh && cached) {
            setTechnicians(cached)
            setIsLoading(false)
            return cached
        }

        setIsLoading(true)
        setError(null)

        try {
            if (forceRefresh) {
                techniciansCacheByScope.delete(scopeKey)
                techniciansRequestByScope.delete(scopeKey)
            }

            let request = techniciansRequestByScope.get(scopeKey)
            if (!request) {
                request = fetchTechniciansFromSource()
                techniciansRequestByScope.set(scopeKey, request)
            }

            const nextTechnicians = await request
            techniciansCacheByScope.set(scopeKey, nextTechnicians)
            setTechnicians(nextTechnicians)
            return nextTechnicians
        } catch (err: unknown) {
            const error = normalizeSupabaseError(err)
            console.error('Error fetching technicians:', error)
            setError(error.message)
            return techniciansCacheByScope.get(scopeKey) || []
        } finally {
            techniciansRequestByScope.delete(scopeKey)
            setIsLoading(false)
        }
    }, [scopeKey])

    useEffect(() => {
        void fetchTechnicians()
    }, [fetchTechnicians])

    const refreshTechnicians = useCallback(async () => {
        await fetchTechnicians(true)
    }, [fetchTechnicians])

    return { technicians, isLoading, error, refreshTechnicians }
}
