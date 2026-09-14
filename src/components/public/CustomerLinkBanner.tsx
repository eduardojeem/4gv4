'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Sparkles, UserPlus, X, Loader2, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
import { toast } from 'sonner'

interface CustomerLinkBannerProps {
  storeName?: string
}

/**
 * Banner que aparece cuando un usuario está logueado pero NO está
 * registrado como cliente de la empresa actual. Ofrece hacerse cliente con un click.
 * Se oculta si ya es cliente, si no está logueado, o si lo cerró manualmente.
 */
export function CustomerLinkBanner({ storeName }: CustomerLinkBannerProps = {}) {
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

  const displayName = storeName?.trim() || 'esta empresa'

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
        toast.success(`¡Listo! Ya sos cliente de ${displayName}. Accedé a beneficios y ofertas exclusivas.`)
      } else {
        toast.error(data.error || 'No se pudo vincular la cuenta')
      }
    } catch {
      toast.error('Error de conexión con el servidor')
    } finally {
      setLinking(false)
    }
  }, [tenantSlug, displayName])

  if (status !== 'show' || dismissed) return null

  return (
    <div className="border-b border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-background text-foreground transition-all duration-300">
      <div className="container flex items-center justify-between gap-3 py-2 sm:py-2.5">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary border border-primary/25 shadow-2xs">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold leading-tight text-foreground truncate sm:text-sm">
              <span className="hidden sm:inline">¿Querés ser cliente de {displayName}?</span>
              <span className="sm:hidden">Sumate a {displayName}</span>
            </p>
            <p className="hidden text-[11px] text-muted-foreground sm:block leading-tight mt-0.5">
              Accedé a promociones exclusivas, seguimiento de tus compras y reparaciones.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            onClick={handleLink}
            disabled={linking}
            className="h-8 gap-1.5 rounded-full bg-primary text-primary-foreground px-3.5 text-xs font-bold shadow-xs hover:bg-primary/90 transition-all active:scale-95"
            title={`Hacerme cliente de ${displayName}`}
          >
            {linking ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <UserPlus className="h-3.5 w-3.5" />
            )}
            <span>Ser cliente</span>
          </Button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors"
            aria-label="Cerrar aviso"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
