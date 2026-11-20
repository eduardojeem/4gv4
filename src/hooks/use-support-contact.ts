'use client'

import { useEffect, useState } from 'react'
import { DEFAULT_SUPPORT_EMAIL, type SupportContact } from '@/lib/platform/support-contact'

const FALLBACK: SupportContact = { email: DEFAULT_SUPPORT_EMAIL, whatsapp: '', whatsappUrl: null, hours: '' }

// Un solo pedido por carga de página aunque el contacto se muestre en varios lugares.
let pending: Promise<SupportContact | null> | null = null

function isSupportContact(value: unknown): value is SupportContact {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.email === 'string' && typeof record.whatsapp === 'string' && typeof record.hours === 'string'
}

function loadSupportContact() {
  pending ??= fetch('/api/public/platform-branding', { cache: 'no-store' })
    .then(async (response) => {
      const payload = await response.json().catch(() => null) as { support?: unknown } | null
      return response.ok && isSupportContact(payload?.support) ? payload.support : null
    })
    .catch(() => null)
    .then((contact) => {
      // Si falló, el próximo componente que lo pida vuelve a intentar.
      if (!contact) pending = null
      return contact
    })
  return pending
}

/** Contacto de soporte de la plataforma (lo configura el superadmin en Marca SaaS). */
export function useSupportContact() {
  const [contact, setContact] = useState<SupportContact>(FALLBACK)

  useEffect(() => {
    let cancelled = false
    void loadSupportContact().then((loaded) => {
      if (!cancelled && loaded) setContact(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return contact
}

/** Solo para pruebas: olvida el pedido compartido. */
export function resetSupportContactCacheForTests() {
  pending = null
}
