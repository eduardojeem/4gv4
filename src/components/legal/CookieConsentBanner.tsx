'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Cookie } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  COOKIE_CONSENT_EVENT,
  OPEN_COOKIE_PREFERENCES_EVENT,
  getCookieConsent,
  setCookieConsent,
  type CookieConsent,
} from '@/lib/consent/cookie-consent'
import { LEGAL_DOCUMENT_META } from '@/lib/legal/shared'

/** Zonas internas (personal y SuperAdmin): la analítica pública no corre ahí. */
const INTERNAL_PREFIXES = ['/dashboard', '/superadmin', '/admin', '/setup', '/debug']

function subscribeToConsent(onChange: () => void) {
  window.addEventListener(COOKIE_CONSENT_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(COOKIE_CONSENT_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

// En el servidor no se conoce la elección: no se renderiza el aviso ahí.
const SERVER_SNAPSHOT = 'unknown' as const

export function CookieConsentBanner() {
  const pathname = usePathname() ?? '/'
  const consent = useSyncExternalStore(subscribeToConsent, getCookieConsent, () => SERVER_SNAPSHOT)
  const [reopened, setReopened] = useState(false)

  useEffect(() => {
    const reopen = () => setReopened(true)
    window.addEventListener(OPEN_COOKIE_PREFERENCES_EVENT, reopen)
    return () => window.removeEventListener(OPEN_COOKIE_PREFERENCES_EVENT, reopen)
  }, [])

  const open = reopened || consent === null
  if (!open || INTERNAL_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return null
  }

  const choose = (consent: CookieConsent) => {
    setCookieConsent(consent)
    setReopened(false)
  }

  return (
    <div
      role="region"
      aria-label="Aviso de cookies"
      className="fixed inset-x-3 bottom-20 z-50 mx-auto max-w-2xl rounded-2xl border bg-background/95 p-4 shadow-xl backdrop-blur sm:inset-x-4 sm:bottom-4 sm:p-5 dark:border-slate-800 lg:bottom-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 gap-3">
          <Cookie className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            Usamos cookies y almacenamiento del navegador para que el sitio funcione (sesión, carrito) y, si lo aceptás, para medir visitas de forma anónima.{' '}
            <Link href={LEGAL_DOCUMENT_META.privacy.path} className="font-medium text-primary underline-offset-4 hover:underline">
              Más información
            </Link>
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => choose('essential')} className="flex-1 sm:flex-none">
            Solo esenciales
          </Button>
          <Button size="sm" onClick={() => choose('all')} className="flex-1 sm:flex-none">
            Aceptar
          </Button>
        </div>
      </div>
    </div>
  )
}
