import { useMemo } from 'react'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { config } from '@/lib/config'

export type ConnectionStatus = 'checking' | 'connected' | 'disconnected'

export function useConnectionStatus() {
    const supabase = useMemo(() => createClient(), [])
    const { data, error, mutate } = useSWR(
        config.supabase.isConfigured ? 'connection-status' : null,
        async () => {
            const result = await supabase.auth.getSession()
            return result.error ? 'disconnected' as const : 'connected' as const
        },
        { revalidateOnFocus: false }
    )
    const status: ConnectionStatus = !config.supabase.isConfigured || error ? 'disconnected' : data ?? 'checking'
    const checkConnection = () => mutate()
    return { status, checkConnection }
}
