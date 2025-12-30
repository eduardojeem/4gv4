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
                const { data, error } = await supabase
                    .from('profiles')
                    .select('id, full_name, email, role')
                    .order('full_name')

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

                const filtered = (data || []).filter((p: DbProfile) => ['technician', 'admin', 'vendedor'].includes(p.role))
                // Map full_name to name for easier component usage
                const mapped = filtered.map((t: DbProfile): Technician => ({
                    ...t,
                    name: t.full_name,
                    specialty: t.specialty || undefined
                }))
                setTechnicians(mapped)
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
                const { data, error } = await supabase
                    .from('profiles')
                    .select('id, full_name, email, role')
                    .order('full_name')

                if (error) throw error

                const filtered = (data || []).filter((p: DbProfile) => ['technician', 'admin', 'vendedor'].includes(p.role))
                const mapped = filtered.map((t: DbProfile): Technician => ({
                    ...t,
                    name: t.full_name,
                    specialty: t.specialty || undefined
                }))
                setTechnicians(mapped)
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
