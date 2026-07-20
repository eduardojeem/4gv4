'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { ShieldCheck, UserPlus, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
import { toast } from 'sonner'

/**
 * Banner que aparece cuando un usuario está logueado pero NO está
 * vinculado como cliente de la tienda actual. Ofrece vincularse con un click.
 * Se oculta si ya es cliente, si no está logueado, o si lo cerró manualmente.
 */
export function CustomerLinkBanner() {
  const { user } = useAuth()
  const pathname = usePathname()
  const tenantSlug = getTenantSlugFromPathname(pathname)

  const [status, setStatus] = useState<'loading' | 'show' | 'hidden' | 'linked'>('loading')
  const [linking, setLinking] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!user || !tenantSlug) {
      setStatus('hidden')
      return
    }

    // Verificar si ya es cliente de esta org
    const checkScope = async () => {
      try {
        const res = await fetch(`/api/public/customer-scope?slug=${encodeURIComponent(tenantSlug)}`)
        const data = await res.json()

        if (data?.success && data?.customerMode) {
          // Ya es cliente
          setStatus('hidden')
        } else if (data?.code === 'not_customer' || data?.code === 'customer_profile_missing') {
          // No es cliente → mostrar banner
          setStatus('show')
        } else {
          setStatus('hidden')
        }
      } catch {
        setStatus('hidden')
      }
    }

    checkScope()
  }, [user, tenantSlug])

  const handleLink = useCallback(async () => {
    if (!tenantSlug) return
    setLinking(true)

    try {
      const res = await fetch('/api/public/customer-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationSlug: tenantSlug }),
      })

      const data = await res.json()

      if (res.ok && data.success) {
        setStatus('linked')
        toast.success('¡Listo! Ya sos cliente de esta tienda. Podés ver tus reparaciones y acceder a beneficios.')
      } else {
        toast.error(data.error || 'No se pudo vincular')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setLinking(false)
    }
  }, [tenantSlug])

  if (status !== 'show' || dismissed) return null

  return (
    <div className="border-b border-cyan-100 bg-gradient-to-r from-cyan-50 to-sky-50 dark:border-cyan-900 dark:from-cyan-950/30 dark:to-sky-950/30">
      <div className="container flex items-center justify-between gap-3 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-100 dark:bg-cyan-900/50">
            <UserPlus className="h-3.5 w-3.5 text-cyan-700 dark:text-cyan-300" />
          </div>
          <p className="text-xs font-medium text-cyan-800 dark:text-cyan-200 sm:text-sm">
            <span className="hidden sm:inline">¿Querés ver tus reparaciones y acceder a ofertas exclusivas? </span>
            <span className="sm:hidden">Vinculá tu cuenta a esta tienda </span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleLink}
            disabled={linking}
            className="h-7 gap-1.5 rounded-full bg-cyan-700 px-3 text-xs hover:bg-cyan-800 dark:bg-cyan-600 dark:hover:bg-cyan-500"
          >
            {linking ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
            Vincularme
          </Button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="flex h-6 w-6 items-center justify-center rounded-full text-cyan-500 hover:bg-cyan-100 hover:text-cyan-700 dark:hover:bg-cyan-900"
            aria-label="Cerrar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
