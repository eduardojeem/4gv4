'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { Loader2 } from 'lucide-react'

/**
 * /dashboard/settings redirige a /admin/settings
 * La configuración del sistema se gestiona únicamente desde el panel admin.
 */
export default function DashboardSettingsRedirect() {
  const router = useRouter()
  const { isAdmin, loading } = useAuth()

  useEffect(() => {
    if (loading) return

    if (isAdmin) {
      router.replace('/admin/settings')
    } else {
      // Non-admin users go to their profile instead
      router.replace('/dashboard/profile')
    }
  }, [isAdmin, loading, router])

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Redirigiendo a configuración...</p>
      </div>
    </div>
  )
}
