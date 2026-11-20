'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Search, ShoppingBag, Menu, X, ArrowLeft, Store, Heart, Phone, Sparkles } from 'lucide-react'
import { useStorefrontCompanyInfo } from '@/components/public/storefront-style-context'
import { PublicCartButton } from '@/components/public/cart/PublicCartButton'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import type { WebsiteSettings } from '@/types/website-settings'

interface ModaFemeninaHeaderProps {
  settings: WebsiteSettings
  catalogEnabled?: boolean
}

export function ModaFemeninaHeader({ settings, catalogEnabled = true }: ModaFemeninaHeaderProps) {
  const pathname = usePathname()
  const company = useStorefrontCompanyInfo(settings.company_info)
  const slug = getTenantSlugFromPathname(pathname)
  const prefix = slug ? `/${slug}` : ''

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const brandName = company.name?.trim() || 'Modeza.'
  const displayName = brandName.endsWith('.') ? brandName : `${brandName}.`

  const navLinks = [
    { label: 'Inicio', href: `${prefix}/inicio`, active: pathname === `${prefix}/inicio` || pathname === `${prefix}` },
    { label: 'Catálogo', href: `${prefix}/productos`, active: pathname.startsWith(`${prefix}/productos`) },
    { label: 'Colecciones', href: `${prefix}/inicio#colecciones`, active: false },
    { label: 'Nosotros', href: `${prefix}/inicio#nosotros`, active: false },
    { label: 'Lookbook', href: `${prefix}/inicio#lookbook`, active: false },
    { label: 'Contacto', href: `${prefix}/inicio#contacto`, active: false },
  ]

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    window.location.href = `${prefix}/productos?q=${encodeURIComponent(searchQuery.trim())}`
  }

  return (
    <header className="sticky top-0 z-40 w-full bg-[#FAF7F2]/90 dark:bg-[#181513]/90 backdrop-blur-md border-b border-[#736B63]/10 transition-colors">
      {/* Barra superior de anuncios y retorno al marketplace */}
      <div className="bg-[#1A1A1A] text-stone-200 text-xs py-1.5 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-1.5 text-stone-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <Store className="w-3.5 h-3.5 text-[#E06B3A]" />
            <span>Marketplace</span>
          </Link>
          <div className="hidden sm:flex items-center gap-2 text-stone-400">
            <Sparkles className="w-3 h-3 text-[#E06B3A]" />
            <span>Nueva Colección 2026 · Envíos a todo el país</span>
          </div>
          <div className="flex items-center gap-3">
            {company.phone && (
              <a
                href={`tel:${company.phone}`}
                className="hidden md:flex items-center gap-1 text-stone-300 hover:text-white transition-colors"
              >
                <Phone className="w-3 h-3 text-[#E06B3A]" />
                <span>{company.phone}</span>
              </a>
            )}
            <ThemeToggle className="scale-75 text-stone-300" />
          </div>
        </div>
      </div>

      {/* Barra principal de navegación */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18 sm:h-20">
          {/* Logo / Nombre de la marca */}
          <Link href={`${prefix}/inicio`} className="flex items-center gap-2 group">
            {company.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={company.logoUrl}
                alt={company.name || 'Logo'}
                className="h-9 w-auto object-contain rounded-md"
              />
            ) : null}
            <span className="font-editorial text-2xl sm:text-3xl font-bold tracking-tight text-[#1A1A1A] dark:text-[#F7F3EE] group-hover:text-[#E06B3A] transition-colors">
              {displayName}
            </span>
          </Link>

          {/* Enlaces centrales de escritorio */}
          <nav className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className={`relative text-sm font-medium transition-colors hover:text-[#E06B3A] ${
                  link.active
                    ? 'text-[#1A1A1A] dark:text-[#F7F3EE] font-semibold'
                    : 'text-[#736B63] dark:text-[#A89F95]'
                }`}
              >
                {link.label}
                {link.active && (
                  <span className="absolute -bottom-1.5 left-0 right-0 h-0.5 bg-[#E06B3A] rounded-full" />
                )}
              </Link>
            ))}
          </nav>

          {/* Acciones del lado derecho */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Buscador */}
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className="p-2 rounded-full text-[#1A1A1A] dark:text-[#F7F3EE] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              aria-label="Buscar productos"
            >
              <Search className="w-5 h-5" />
            </button>

            {/* Carrito con badge */}
            {catalogEnabled && (
              <PublicCartButton className="border-0 bg-transparent hover:bg-black/5 dark:hover:bg-white/5 text-[#1A1A1A] dark:text-[#F7F3EE] p-2" />
            )}

            {/* Botón CTA "Comprar Ahora" / "Shop Now" */}
            <Link
              href={`${prefix}/productos`}
              className="hidden sm:inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-[#1A1A1A] text-white hover:bg-[#E06B3A] text-xs uppercase tracking-wider font-semibold transition-all shadow-sm"
            >
              Comprar Ahora
            </Link>

            {/* Botón menú móvil */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-full text-[#1A1A1A] dark:text-[#F7F3EE] hover:bg-black/5 dark:hover:bg-white/5"
              aria-label="Menú principal"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Buscador desplegable */}
        {searchOpen && (
          <form onSubmit={handleSearchSubmit} className="pb-4 pt-1 flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar vestidos, blusas, pantalones, calzados..."
                autoFocus
                className="w-full pl-10 pr-4 py-2.5 rounded-full border border-[#736B63]/20 bg-white dark:bg-[#221E1B] text-sm focus:outline-none focus:border-[#E06B3A]"
              />
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-[#736B63]" />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-full bg-[#E06B3A] text-white text-xs font-semibold hover:bg-[#C95627] transition-colors"
            >
              Buscar
            </button>
          </form>
        )}
      </div>

      {/* Menú deslizante para móviles */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-[#736B63]/10 bg-[#FAF7F2] dark:bg-[#181513] px-6 py-6 space-y-4 shadow-xl">
          <nav className="flex flex-col space-y-3">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`text-base font-medium py-1.5 transition-colors ${
                  link.active
                    ? 'text-[#E06B3A] font-bold'
                    : 'text-[#1A1A1A] dark:text-[#F7F3EE]'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="pt-4 border-t border-[#736B63]/10 flex flex-col gap-3">
            <Link
              href={`${prefix}/productos`}
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-3 rounded-full bg-[#1A1A1A] text-white font-semibold text-sm hover:bg-[#E06B3A] transition-colors"
            >
              Ver Catálogo Completo
            </Link>
            <Link
              href="/marketplace"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-2.5 rounded-full border border-[#736B63]/20 text-[#736B63] dark:text-[#A89F95] font-medium text-xs hover:border-[#E06B3A]"
            >
              🏪 Volver al Marketplace
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
