import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { config, isDemoNoDb } from '@/lib/config'

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

const TECHNICIAN_ROLES = ['technician', 'tecnico', 'técnico']
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

function isMissingSpecialtyColumnError(error: unknown) {
    const msg = (error as { message?: string })?.message?.toLowerCase?.() || ''
    return msg.includes('specialty') && (msg.includes('column') || msg.includes('schema cache'))
}

function isMissingProfilesTableError(error: unknown) {
    const msg = (error as { message?: string })?.message?.toLowerCase?.() || ''
    return msg.includes("could not find the table 'public.profiles'") || msg.includes('relation "profiles" does not exist')
}

function mapTechnicians(data: DbProfile[]): Technician[] {
    return (data || [])
        .filter((profile) => {
            const normalizedRole = String(profile.role || '').trim().toLowerCase()
            return TECHNICIAN_ROLES.includes(normalizedRole)
        })
        .map((technician) => ({
            ...technician,
            name: technician.full_name,
            specialty: technician.specialty || undefined
        }))
}

export function useTechnicians() {
    const [technicians, setTechnicians] = useState<Technician[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchTechnicians = useCallback(async () => {
        setIsLoading(true)
        setError(null)

        try {
            if (!config.supabase.isConfigured || isDemoNoDb()) {
                setTechnicians(DEMO_TECHNICIANS)
                return
            }

            const supabase = createClient()

            let data: DbProfile[] | null = null
            let queryError: unknown = null

            const withSpecialty = await supabase
                .from('profiles')
                .select('id, full_name, email, role, specialty')
                .order('full_name')

            data = withSpecialty.data as DbProfile[] | null
            queryError = withSpecialty.error

            if (queryError && isMissingSpecialtyColumnError(queryError)) {
                const fallback = await supabase
                    .from('profiles')
                    .select('id, full_name, email, role')
                    .order('full_name')

                data = fallback.data as DbProfile[] | null
                queryError = fallback.error
            }

            if (queryError) {
                if (isMissingProfilesTableError(queryError)) {
                    setTechnicians([])
                    return
                }

                throw queryError
            }

            setTechnicians(mapTechnicians(data || []))
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err)
            console.error('Error fetching technicians:', { message })
            setError(message)
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        void fetchTechnicians()
    }, [fetchTechnicians])

    const refreshTechnicians = useCallback(async () => {
        await fetchTechnicians()
    }, [fetchTechnicians])

    return { technicians, isLoading, error, refreshTechnicians }
}
