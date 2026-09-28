'use client'

import Link from 'next/link'
import { openCookiePreferences } from '@/lib/consent/cookie-consent'
import { LEGAL_DOCUMENT_META } from '@/lib/legal/shared'

/** Enlaces legales de la plataforma: privacidad, términos y preferencias de cookies. */
export function LegalFooterLinks({ className }: { className?: string }) {
  return (
    <nav aria-label="Enlaces legales" className={className}>
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500 dark:text-slate-400">
        <li>
          <Link href={LEGAL_DOCUMENT_META.privacy.path} className="hover:text-foreground hover:underline">
            {LEGAL_DOCUMENT_META.privacy.label}
          </Link>
        </li>
        <li>
          <Link href={LEGAL_DOCUMENT_META.terms.path} className="hover:text-foreground hover:underline">
            {LEGAL_DOCUMENT_META.terms.label}
          </Link>
        </li>
        <li>
          <button type="button" onClick={openCookiePreferences} className="hover:text-foreground hover:underline">
            Preferencias de cookies
          </button>
        </li>
      </ul>
    </nav>
  )
}
