'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

function sanitizeNext(value: string | null, fallback: string): string {
  if (!value) return fallback
  // Solo rutas internas: una barra inicial, sin protocol-relative ni backslash.
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback
  const firstSlash = value.indexOf('/', 1)
  const segment = firstSlash > 0 ? value.slice(0, firstSlash) : value
  if (segment.includes(':')) return fallback
  return value
}

/**
 * Página neutral (no protegida) que recibe los enlaces de invitación/confirmación
 * cuyo flujo implícito devuelve la sesión en el hash (#access_token). Establece la
 * sesión en el navegador y recién entonces reenvía al destino (next), de modo que
 * el middleware ya vea la cookie de sesión al entrar a una ruta protegida.
 */
export default function ConfirmContent() {
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    const next = sanitizeNext(searchParams.get('next'), '/dashboard')

    const establishSessionFromHash = async (): Promise<boolean> => {
      if (typeof window === 'undefined') return false
      const hash = window.location.hash?.startsWith('#') ? window.location.hash.slice(1) : ''
      if (!hash) return false

      const params = new URLSearchParams(hash)
      const access_token = params.get('access_token')
      const refresh_token = params.get('refresh_token')
      if (!access_token || !refresh_token) return false

      const { error } = await supabase.auth.setSession({ access_token, refresh_token })
      if (error) {
        console.error('[auth/confirm] setSession from hash failed:', error.message)
        return false
      }
      return true
    }

    const run = async () => {
      try {
        let { data: { session } } = await supabase.auth.getSession()

        if (!session) {
          await establishSessionFromHash()
          ;({ data: { session } } = await supabase.auth.getSession())
        }

        if (!session) {
          // No se pudo establecer sesión → al login (sin ?error= para no romper
          // el parseo del hash si quedara algo pendiente).
          window.location.replace('/login')
          return
        }

        // Sesión lista: navegación dura para que el middleware lea la cookie.
        window.location.replace(next)
      } catch (err) {
        console.error('[auth/confirm] unexpected error:', err)
        window.location.replace('/login')
      }
    }

    run()
  }, [searchParams, supabase])

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 dark:from-slate-950 dark:via-blue-950/20 dark:to-indigo-950/30">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
        <p className="text-sm text-slate-600 dark:text-slate-400">Confirmando tu acceso...</p>
      </div>
    </div>
  )
}
