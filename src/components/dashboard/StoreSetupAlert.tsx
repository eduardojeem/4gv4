'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Store, ArrowRight, CheckCircle2, AlertCircle, X, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/auth-context'
import { useActiveOrganization } from '@/contexts/ActiveOrganizationContext'
import { useAdminWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { cn } from '@/lib/utils'

const DISMISS_STORAGE_KEY = 'dismissed_store_setup_banner_v1'

export function StoreSetupAlert() {
  const { isAdmin, isSuperAdmin } = useAuth()
  const { organization } = useActiveOrganization()
  const { settings, isLoading } = useAdminWebsiteSettings()
  const [isDismissed, setIsDismissed] = useState(() => {
    if (typeof window === 'undefined') return true
    try {
      return sessionStorage.getItem(DISMISS_STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })

  const handleDismiss = () => {
    setIsDismissed(true)
    try {
      sessionStorage.setItem(DISMISS_STORAGE_KEY, 'true')
    } catch {
      // Ignore storage errors
    }
  }

  // Only store owners and admins can configure the public website
  if (!isAdmin && !isSuperAdmin) {
    return null
  }

  // While loading or if dismissed or if no settings, don't show
  if (isLoading || !settings || isDismissed) {
    return null
  }

  const company = settings.company_info
  const checkout = settings.checkout

  const isPublished = Boolean(company?.storefrontPublic)
  const hasCompanyInfo = Boolean(company?.name?.trim() && company?.phone?.trim() && company?.address?.trim())
  const hasCheckout = Boolean(
    checkout &&
    (
      checkout.commerceMode !== 'cart' ||
      (
        (checkout.payment?.cash?.enabled ||
          checkout.payment?.card?.enabled ||
          checkout.payment?.transfer?.enabled ||
          checkout.payment?.digital_wallet?.enabled) &&
        (checkout.delivery?.enabled || checkout.pickup?.enabled)
      )
    )
  )

  // If fully configured and published, no alert needed
  if (isPublished && hasCompanyInfo && hasCheckout) {
    return null
  }

  const checklist = [
    {
      id: 'company',
      label: 'Datos de la empresa',
      completed: hasCompanyInfo,
    },
    {
      id: 'checkout',
      label: 'Métodos de pago y entrega',
      completed: hasCheckout,
    },
    {
      id: 'publish',
      label: 'Publicar tienda online',
      completed: isPublished,
    },
  ]

  const completedCount = checklist.filter((item) => item.completed).length
  const totalCount = checklist.length

  const orgSlug = organization?.slug || company?.slug || ''

  return (
    <div
      role="region"
      aria-label="Aviso de configuración de tienda pública"
      className={cn(
        'relative overflow-hidden rounded-2xl border transition-all shadow-sm',
        'border-amber-300/80 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-4 sm:p-5',
        'dark:border-amber-900/60 dark:from-amber-950/40 dark:via-amber-950/20'
      )}
    >
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Left side: Icon + Content */}
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
            <Store className="h-5 w-5" />
          </div>

          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                {!isPublished
                  ? 'Tu Tienda Pública aún no está publicada'
                  : 'Tu Tienda Pública necesita configuración'}
              </h3>
              <Badge
                variant="outline"
                className={cn(
                  'rounded-full text-[11px] font-bold px-2 py-0.5',
                  !isPublished
                    ? 'border-amber-300 bg-amber-100/80 text-amber-900 dark:border-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
                    : 'border-orange-300 bg-orange-100/80 text-orange-900 dark:border-orange-800 dark:bg-orange-900/50 dark:text-orange-300'
                )}
              >
                {completedCount} de {totalCount} completado
              </Badge>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-3xl leading-relaxed">
              {!isPublished
                ? 'Termina de configurar tu catálogo online para que tus clientes puedan ver tus productos, solicitar presupuestos y rastrear el estado de sus reparaciones.'
                : 'Faltan datos clave para que tus clientes puedan comprar y comunicarse fluidamente con tu negocio.'}
            </p>

            {/* Checklist tags */}
            <div className="pt-2 flex flex-wrap items-center gap-2">
              {checklist.map((item) => (
                <span
                  key={item.id}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium border transition-colors',
                    item.completed
                      ? 'border-emerald-200 bg-emerald-50/80 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'border-amber-200 bg-amber-50/80 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300'
                  )}
                >
                  {item.completed ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  )}
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right side: Actions */}
        <div className="flex flex-wrap items-center gap-2 shrink-0 lg:self-center">
          {orgSlug && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-xs border-amber-300/80 bg-white/80 hover:bg-amber-50 dark:border-amber-800 dark:bg-slate-900 dark:hover:bg-amber-950/40"
            >
              <Link href={`/${orgSlug}/inicio`} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                Vista previa
              </Link>
            </Button>
          )}

          <Button
            asChild
            size="sm"
            className="h-9 gap-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-500 dark:hover:bg-amber-600 dark:text-slate-950 shadow-sm"
          >
            <Link href="/admin/website">
              Terminar de configurar
              <ArrowRight className="h-3.5 w-3.5 ml-0.5" />
            </Link>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleDismiss}
            aria-label="Ocultar aviso por esta sesión"
            title="Ocultar aviso por esta sesión"
            className="h-8 w-8 text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
