'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { Search, Phone } from 'lucide-react'
import { WhatsAppIcon } from '@/components/public/SocialIcons'
import { AppImage } from '@/components/ui/app-image'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
import { hasStoreWhatsapp } from '@/lib/whatsapp-number'
import { cn } from '@/lib/utils'
import type { WebsiteSettings } from '@/types/website-settings'

export function CatalogBasicHeader({ settings }: { settings: WebsiteSettings | null }) {
  const router = useRouter()
  const pathname = usePathname()
  const slug = getTenantSlugFromPathname(pathname)
  const prefix = slug ? `/${slug}` : ''
  const company = settings?.company_info
  const [query, setQuery] = useState('')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = query.trim()
    const target = trimmed
      ? `${prefix}/productos?query=${encodeURIComponent(trimmed)}`
      : `${prefix}/productos`
    router.push(target)
  }

  const hasWhatsapp = hasStoreWhatsapp(company)
  const rawWhatsapp = company?.whatsapp?.replace(/\D/g, '') || ''
  const rawPhone = company?.phone?.replace(/[^+0-9]/g, '') || ''
  const whatsappUrl = hasWhatsapp && rawWhatsapp ? `https://wa.me/${rawWhatsapp}` : null
  const callUrl = rawPhone ? `tel:${rawPhone}` : null

  return (
    <header
      role="banner"
      aria-label="Encabezado del catálogo"
      data-catalog-basic-header
      className="sticky top-0 z-30 border-b border-border/80 bg-background/95 backdrop-blur-xs text-foreground transition-colors"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:flex-nowrap sm:gap-4 sm:py-3.5">
        {/* Logo y Nombre */}
        <Link
          href={`${prefix}/inicio`}
          className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          aria-label={`Ir al inicio de ${company?.name || 'la tienda'}`}
        >
          {company?.logoUrl ? (
            <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md border border-border/60 bg-muted/20">
              <AppImage
                src={company.logoUrl}
                alt={company?.name || 'Logo del comercio'}
                fill
                sizes="36px"
                className="object-contain"
                priority
              />
            </div>
          ) : (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-black text-primary-foreground">
              {(company?.name || 'M')[0].toUpperCase()}
            </span>
          )}
          <span className="text-base font-bold tracking-tight text-foreground line-clamp-1 max-w-[180px] sm:max-w-xs">
            {company?.name || 'Catálogo Digital'}
          </span>
        </Link>

        {/* Buscador de productos */}
        <form
          role="search"
          onSubmit={handleSearch}
          className="order-3 flex w-full items-center sm:order-2 sm:max-w-md sm:flex-1"
        >
          <div className="relative w-full">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscá productos..."
              aria-label="Buscar productos en el catálogo"
              className={cn(
                'h-9 w-full rounded-lg border border-border/80 bg-muted/40 pl-9 pr-3 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground',
                'transition-colors focus:border-primary focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20'
              )}
            />
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
          </div>
        </form>

        {/* Contacto: WhatsApp o Llamar (sin íconos de compra ni carrito) */}
        <div className="order-2 flex items-center gap-2 sm:order-3">
          {whatsappUrl ? (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white shadow-xs',
                'transition-colors hover:bg-emerald-700 active:scale-[0.98]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2'
              )}
              aria-label="Escribinos por WhatsApp para consultas"
            >
              <WhatsAppIcon className="h-4 w-4 shrink-0" />
              <span className="hidden xs:inline sm:inline">Escribinos por WhatsApp</span>
              <span className="xs:hidden sm:hidden">WhatsApp</span>
            </a>
          ) : callUrl ? (
            <a
              href={callUrl}
              className={cn(
                'inline-flex h-9 items-center gap-1.5 rounded-lg border border-border/80 bg-background px-3 text-xs font-semibold text-foreground shadow-xs',
                'transition-colors hover:bg-muted active:scale-[0.98]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'
              )}
              aria-label={`Llamar a ${company?.name || 'la tienda'}`}
            >
              <Phone className="h-4 w-4 shrink-0 text-primary" />
              <span>Llamar</span>
            </a>
          ) : null}
        </div>
      </div>
    </header>
  )
}
