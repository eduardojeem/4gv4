import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { config } from '@/lib/config'

export type ConnectionStatus = 'checking' | 'connected' | 'disconnected'

export function useConnectionStatus() {
    const [status, setStatus] = useState<ConnectionStatus>('checking')
    const supabase = createClient()

    const checkConnection = async () => {
        if (!config.supabase.isConfigured) {
            setStatus('disconnected')
            return
        }

        try {
            // Use getSession for a reliable connection check that doesn't depend on RLS
            const { error } = await supabase.auth.getSession()
            if (error) {
                console.warn('Supabase connection check failed:', error)
                setStatus('disconnected')
            } else {
                setStatus('connected')
            }
        } catch (err) {
            console.error('Supabase connection check error:', err)
            setStatus('disconnected')
        }
    }

    useEffect(() => {
        checkConnection()
    }, [])

    return { status, checkConnection }
}
