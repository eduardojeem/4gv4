'use client'

import { useMemo } from 'react'
import { WhatsAppIcon } from '@/components/public/SocialIcons'
import { useWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { getWhatsAppLink } from '@/lib/whatsapp'

export function FloatingWhatsAppButton({ fallbackPhone = '' }: { fallbackPhone?: string }) {
  const { settings } = useWebsiteSettings()
  const companyInfo = settings?.company_info

  const rawPhone = companyInfo?.whatsapp || companyInfo?.phone || fallbackPhone
  const cleanPhone = useMemo(() => (rawPhone || '').replace(/\D/g, ''), [rawPhone])

  const whatsappHref = useMemo(() => {
    if (!cleanPhone) return null
    return getWhatsAppLink({
      phone: cleanPhone,
      message: `¡Hola ${companyInfo?.name || ''}! Quisiera hacer una consulta sobre sus productos.`,
    })
  }, [cleanPhone, companyInfo?.name])

  if (!whatsappHref) return null

  return (
    <aside
      aria-label="Contacto rápido"
      // En el teléfono la barra inferior mide 64px: con `bottom-6` el botón le
      // tapaba la pestaña «Inicio». Sube por encima de ella y vuelve abajo
      // cuando la barra desaparece (lg).
      className="fixed bottom-24 left-4 z-50 pointer-events-auto lg:bottom-6 lg:left-6"
    >
      <a
        aria-label="Contactar por WhatsApp"
        href={whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        className="group relative flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-[#128C7E] text-white shadow-lg shadow-emerald-900/20 transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#075E54] hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#128C7E] focus-visible:ring-offset-2 active:scale-95 motion-reduce:transform-none"
      >
        <span className="sr-only">Chat en WhatsApp</span>
        <WhatsAppIcon className="h-7 w-7 transition-transform duration-300 group-hover:scale-105 motion-reduce:transform-none" />

        {/* Tooltip visible al hover */}
        <span className="pointer-events-none absolute left-full ml-3 hidden whitespace-nowrap rounded-lg bg-foreground px-3 py-1.5 text-xs font-semibold text-background opacity-0 shadow-lg transition-all duration-200 group-hover:opacity-100 sm:inline-block">
          ¿Dudas? Chateá con nosotros
        </span>
      </a>
    </aside>
  )
}
