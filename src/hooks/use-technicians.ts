import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { config, isDemoNoDb } from '@/lib/config'

export interface Technician {
    id: string
    full_name: string
    name: string  // Alias for full_name for easier component usage
    email: string
    role: string
    specialty?: string  // Optional specialty field
}

interface DbProfile {
    id: string
    full_name: string
    email: string
    role: string
    specialty?: string
}

const TECHNICIAN_ROLES = ['technician', 'tecnico', 'técnico']

function isMissingSpecialtyColumnError(error: unknown) {
    const msg = (error as any)?.message?.toLowerCase?.() || ''
    return msg.includes('specialty') && (msg.includes('column') || msg.includes('schema cache'))
}

function mapTechnicians(data: DbProfile[]): Technician[] {
    const filtered = (data || []).filter((p: DbProfile) => {
        const normalizedRole = String(p.role || '').trim().toLowerCase()
        return TECHNICIAN_ROLES.includes(normalizedRole)
    })

    return filtered.map((t: DbProfile): Technician => ({
        ...t,
        name: t.full_name,
        specialty: t.specialty || undefined
    }))
}

export function useTechnicians() {
    const [technicians, setTechnicians] = useState<Technician[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const fetchTechnicians = async () => {
            if (!config.supabase.isConfigured || isDemoNoDb()) {
                setTechnicians([
                    { id: 'TECH-001', full_name: 'Técnico Demo 1', name: 'Técnico Demo 1', email: 'tech1@demo.com', role: 'technician', specialty: 'Smartphones' },
                    { id: 'TECH-002', full_name: 'Técnico Demo 2', name: 'Técnico Demo 2', email: 'tech2@demo.com', role: 'technician', specialty: 'Laptops' }
                ])
                setIsLoading(false)
                return
            }

            try {
                const supabase = createClient()
                let data: DbProfile[] | null = null
                let error: unknown = null

                const withSpecialty = await supabase
                    .from('profiles')
                    .select('id, full_name, email, role, specialty')
                    .order('full_name')

                data = withSpecialty.data as DbProfile[] | null
                error = withSpecialty.error

                if (error && isMissingSpecialtyColumnError(error)) {
                    const fallback = await supabase
                        .from('profiles')
                        .select('id, full_name, email, role')
                        .order('full_name')
                    data = fallback.data as DbProfile[] | null
                    error = fallback.error
                }

                if (error) {
                    const msg = (error as any)?.message || String(error)
                    const lower = msg.toLowerCase()
                    const missing = lower.includes("could not find the table 'public.profiles'") || lower.includes('relation "profiles" does not exist')
                    if (missing) {
                        setTechnicians([])
                        setError(null)
                        return
                    }
                    throw error
                }

                setTechnicians(mapTechnicians(data || []))
            } catch (err: unknown) {
                const msg = err && typeof err === 'object' && 'message' in err ? String((err as Error).message) : String(err)
                console.error('Error fetching technicians:', { message: msg })
                setError(msg)
            } finally {
                setIsLoading(false)
            }
        }

        fetchTechnicians()
    }, [])

    const refreshTechnicians = async () => {
        setIsLoading(true)
        // Re-run the fetch logic
        const fetchTechnicians = async () => {
            if (!config.supabase.isConfigured || isDemoNoDb()) {
                setTechnicians([
                    { id: 'TECH-001', full_name: 'Técnico Demo 1', name: 'Técnico Demo 1', email: 'tech1@demo.com', role: 'technician', specialty: 'Smartphones' },
                    { id: 'TECH-002', full_name: 'Técnico Demo 2', name: 'Técnico Demo 2', email: 'tech2@demo.com', role: 'technician', specialty: 'Laptops' }
                ])
                setIsLoading(false)
                return
            }

            try {
                const supabase = createClient()
                let data: DbProfile[] | null = null
                let error: unknown = null

                const withSpecialty = await supabase
                    .from('profiles')
                    .select('id, full_name, email, role, specialty')
                    .order('full_name')

                data = withSpecialty.data as DbProfile[] | null
                error = withSpecialty.error

                if (error && isMissingSpecialtyColumnError(error)) {
                    const fallback = await supabase
                        .from('profiles')
                        .select('id, full_name, email, role')
                        .order('full_name')
                    data = fallback.data as DbProfile[] | null
                    error = fallback.error
                }

                if (error) throw error

                setTechnicians(mapTechnicians(data || []))
            } catch (err: unknown) {
                console.error('Error refreshing technicians:', err)
                const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
                setError(errorMessage)
            } finally {
                setIsLoading(false)
            }
        }
        await fetchTechnicians()
    }

    return { technicians, isLoading, error, refreshTechnicians }
}
