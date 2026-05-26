import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { config, isDemoNoDb } from '@/lib/config'
import { normalizeSupabaseError } from '@/utils/supabase-error'

export interface Technician {
    id: string
    full_name: string
    name: string
    email: string
    role: string
    specialty?: string
}

interface DbProfile {
    id: string
    full_name: string
    email: string
    role: string
    specialty?: string
}

const TECHNICIAN_ROLES = new Set(['technician', 'tecnico'])
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

function isMissingProfilesTableError(error: unknown) {
    const msg = (error as { message?: string })?.message?.toLowerCase?.() || ''
    return msg.includes("could not find the table 'public.profiles'") || msg.includes('relation "profiles" does not exist')
}

function normalizeRole(role: string) {
    return role
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
}

function mapTechnicians(data: DbProfile[]): Technician[] {
    return (data || [])
        .filter((profile) => TECHNICIAN_ROLES.has(normalizeRole(String(profile.role || ''))))
        .map((technician) => ({
            ...technician,
            name: technician.full_name,
            specialty: technician.specialty || undefined
        }))
}

let techniciansCache: Technician[] | null = null
let techniciansRequest: Promise<Technician[]> | null = null

async function fetchTechniciansFromSource(): Promise<Technician[]> {
    if (!config.supabase.isConfigured || isDemoNoDb()) {
        return DEMO_TECHNICIANS
    }

    const supabase = createClient()

    let data: DbProfile[] | null = null
    let queryError: unknown = null

    const profilesResult = await supabase
        .from('profiles')
        .select('*')
        .order('full_name')

    data = profilesResult.data as DbProfile[] | null
    queryError = profilesResult.error

    if (queryError) {
        if (isMissingProfilesTableError(queryError)) {
            return []
        }

        throw queryError
    }

    return mapTechnicians(data || [])
}

export function useTechnicians() {
    const [technicians, setTechnicians] = useState<Technician[]>(() => techniciansCache || [])
    const [isLoading, setIsLoading] = useState(techniciansCache === null)
    const [error, setError] = useState<string | null>(null)

    const fetchTechnicians = useCallback(async (forceRefresh = false) => {
        if (!forceRefresh && techniciansCache !== null) {
            setTechnicians(techniciansCache)
            setIsLoading(false)
            return techniciansCache
        }

        setIsLoading(true)
        setError(null)

        try {
            if (forceRefresh) {
                techniciansCache = null
                techniciansRequest = null
            }

            if (!techniciansRequest) {
                techniciansRequest = fetchTechniciansFromSource()
            }

            const nextTechnicians = await techniciansRequest
            techniciansCache = nextTechnicians
            setTechnicians(nextTechnicians)
            return nextTechnicians
        } catch (err: unknown) {
            const error = normalizeSupabaseError(err)
            console.error('Error fetching technicians:', error)
            setError(error.message)
            return techniciansCache || []
        } finally {
            techniciansRequest = null
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        void fetchTechnicians()
    }, [fetchTechnicians])

    const refreshTechnicians = useCallback(async () => {
        await fetchTechnicians(true)
    }, [fetchTechnicians])

    return { technicians, isLoading, error, refreshTechnicians }
}
