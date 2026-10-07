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
    // Compacto: en el celular ocupaba un tercio de la pantalla y tapaba el contenido.
    <div
      role="region"
      aria-label="Aviso de cookies"
      className="fixed inset-x-3 bottom-20 z-50 mx-auto max-w-xl rounded-xl border bg-background/95 px-3 py-2.5 shadow-lg backdrop-blur sm:inset-x-4 sm:bottom-4 sm:px-4 sm:py-3 dark:border-slate-800 lg:bottom-6"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <p className="flex min-w-0 flex-1 items-start gap-2 text-xs leading-snug text-slate-700 dark:text-slate-300">
          <Cookie className="mt-px h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span>
            Usamos cookies para que el sitio funcione y, si aceptás, para medir visitas de forma anónima.{' '}
            <Link href={LEGAL_DOCUMENT_META.privacy.path} className="font-medium text-primary underline-offset-4 hover:underline">
              Más información
            </Link>
          </span>
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => choose('essential')} className="h-8 flex-1 px-3 text-xs sm:flex-none">
            Solo esenciales
          </Button>
          <Button size="sm" onClick={() => choose('all')} className="h-8 flex-1 px-4 text-xs sm:flex-none">
            Aceptar
          </Button>
        </div>
      </div>
    </div>
  )
}
