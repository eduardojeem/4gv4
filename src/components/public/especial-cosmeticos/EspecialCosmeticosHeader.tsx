'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Heart,
  LogIn,
  LogOut,
  MapPin,
  Menu,
  Phone,
  Search,
  Sparkles,
  User,
  UserPlus,
  X,
} from 'lucide-react'
import { AppImage } from '@/components/ui/app-image'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { AuthModal } from '@/components/public/AuthModal'
import { PublicCartButton } from '@/components/public/cart/PublicCartButton'
import { InstagramIcon, WhatsAppIcon } from '@/components/public/SocialIcons'
import { useStorefrontCompanyInfo } from '@/components/public/storefront-style-context'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { useAuth } from '@/contexts/auth-context'
import { useHydrated } from '@/hooks/use-hydrated'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
import { cn } from '@/lib/utils'
import type { WebsiteSettings } from '@/types/website-settings'
import './especial-cosmeticos.css'

interface EspecialCosmeticosHeaderProps {
  settings?: WebsiteSettings | null
}

export function EspecialCosmeticosHeader({ settings = null }: EspecialCosmeticosHeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const company = useStorefrontCompanyInfo(settings?.company_info)
  const { user, signOut } = useAuth()
  const hydrated = useHydrated()

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  const slug = getTenantSlugFromPathname(pathname)
  const prefix = slug ? `/${slug}` : ''

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const storeName = company?.name?.trim() || 'Glowora'
  const slogan = company?.slogan?.trim() || 'Alta Cosmética & Skincare'
  const logoUrl = company?.logoUrl?.trim() || ''
  const phone = company?.phone?.trim() || ''
  const whatsapp = company?.whatsapp?.trim() || phone
  const whatsappClean = whatsapp.replace(/\D/g, '')

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    router.push(`${prefix}/productos?q=${encodeURIComponent(searchQuery.trim())}`)
    setIsSearchOpen(false)
  }

  const navLinks = [
    { label: 'Inicio', href: `${prefix}/inicio` },
    { label: 'Tienda', href: `${prefix}/inicio#productos` },
    { label: 'Categorías', href: `${prefix}/inicio#categorias` },
    { label: 'Ofertas', href: `${prefix}/inicio#ofertas` },
    { label: 'Nosotros', href: `${prefix}/inicio#nosotros` },
    { label: 'Ubicación', href: `${prefix}/inicio#ubicacion` },
  ]

  return (
    <>
      <header
        className={cn(
          'sticky top-0 z-50 w-full transition-all duration-300',
          scrolled
            ? 'bg-[#FFFDFB]/95 dark:bg-zinc-950/95 shadow-md shadow-rose-950/5 backdrop-blur-md border-b border-rose-150/60 dark:border-rose-900/30 py-2'
            : 'bg-[#FFFDFB] dark:bg-zinc-950 border-b border-rose-100 dark:border-zinc-800 py-3'
        )}
      >
        {/* Barra superior de anuncios */}
        {company?.showTopBar !== false && (
          <div className="border-b border-rose-100/70 bg-[#FFF5F6] py-1.5 text-xs text-rose-900 dark:border-rose-950 dark:bg-rose-950/40 dark:text-rose-200">
            <div className="container mx-auto flex items-center justify-between px-4 sm:px-6">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-rose-500 animate-pulse" />
                <span className="font-medium tracking-wide">
                  Envíos a todo el país · Asesoramiento personalizado de rutina
                </span>
              </div>
              <div className="hidden sm:flex items-center gap-4 text-[11px]">
                {whatsappClean && (
                  <a
                    href={`https://wa.me/${whatsappClean}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 font-medium hover:text-rose-600 transition-colors"
                  >
                    <WhatsAppIcon className="h-3.5 w-3.5 text-emerald-600" />
                    <span>WhatsApp: {whatsapp}</span>
                  </a>
                )}
                {company?.instagram && (
                  <a
                    href={`https://instagram.com/${company.instagram.replace(/^@/, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-rose-600 transition-colors"
                  >
                    <InstagramIcon className="h-3.5 w-3.5 text-rose-500" />
                    <span>@{company.instagram.replace(/^@/, '')}</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Barra principal del encabezado */}
        <div className="container mx-auto flex items-center justify-between gap-4 px-4 sm:px-6">
          {/* Logo boutique con flor de loto */}
          <Link href={`${prefix}/inicio`} className="flex items-center gap-3 group shrink-0">
            {logoUrl ? (
              <div className="relative h-11 w-11 overflow-hidden rounded-full border border-rose-200/80 shadow-xs">
                <AppImage
                  src={logoUrl}
                  alt={storeName}
                  fill
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-tr from-rose-100 via-pink-50 to-amber-100 border border-rose-200/80 shadow-xs group-hover:scale-105 transition-transform duration-300">
                {/* SVG Flor de loto estética */}
                <svg
                  className="h-6 w-6 text-rose-600"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 3c-1.5 3-4 6-4 9a4 4 0 0 0 8 0c0-3-2.5-6-4-9z" />
                  <path d="M8 12c-2.5-1.5-5-1-6 1 1 3 4 4 6 3" />
                  <path d="M16 12c2.5-1.5 5-1 6 1-1 3-4 4-6 3" />
                  <path d="M10 18c-2 2-5 2-7 1 1.5-2 3.5-2.5 6-1.5" />
                  <path d="M14 18c2 2 5 2 7 1-1.5-2-3.5-2.5-6-1.5" />
                  <path d="M12 18v3" />
                </svg>
              </div>
            )}
            <div className="flex flex-col">
              <span className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-50 group-hover:text-rose-600 transition-colors">
                {storeName}
              </span>
              <span className="text-[10px] font-medium tracking-[0.18em] uppercase text-rose-600/90 dark:text-rose-400">
                {slogan}
              </span>
            </div>
          </Link>

          {/* Menú de navegación de escritorio */}
          <nav className="hidden lg:flex items-center gap-7">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-sm font-medium tracking-wide text-stone-700 hover:text-rose-600 dark:text-stone-300 dark:hover:text-rose-400 transition-colors relative py-1 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:scale-x-0 hover:after:scale-x-100 after:bg-rose-500 after:transition-transform"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Acciones del encabezado: Buscador, Favoritos, Carrito, Usuario */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Buscador expandible */}
            {isSearchOpen ? (
              <form onSubmit={handleSearchSubmit} className="relative flex items-center">
                <input
                  type="text"
                  placeholder="Buscar cosméticos, sérums..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                  className="w-48 sm:w-64 rounded-full border border-rose-300 bg-white py-1.5 pl-4 pr-8 text-xs text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-rose-400 dark:bg-zinc-900 dark:text-stone-200"
                />
                <button
                  type="button"
                  onClick={() => setIsSearchOpen(false)}
                  className="absolute right-2.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
                  aria-label="Cerrar búsqueda"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setIsSearchOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-stone-600 hover:bg-rose-50 hover:text-rose-600 dark:text-stone-300 dark:hover:bg-zinc-800 transition-colors"
                aria-label="Buscar productos"
              >
                <Search className="h-4 w-4" />
              </button>
            )}

            {/* Selector de tema */}
            <ThemeToggle />

            {/* Botón Carrito */}
            <PublicCartButton />

            {/* Perfil de Usuario / Inicio de sesión */}
            {hydrated && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-rose-300"
                    aria-label="Menú de usuario"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-rose-100 text-rose-700 text-xs font-semibold">
                        {user.email?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-xl border border-rose-150 p-2 shadow-lg">
                  <DropdownMenuLabel className="font-normal">
                    <p className="text-xs font-semibold text-stone-900 dark:text-stone-100">
                      Mi Cuenta
                    </p>
                    <p className="text-[11px] text-stone-500 truncate">{user.email}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={`${prefix}/perfil`} className="flex items-center gap-2 text-xs">
                      <User className="h-3.5 w-3.5 text-rose-600" />
                      <span>Mis Datos</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`${prefix}/pedidos`} className="flex items-center gap-2 text-xs">
                      <Heart className="h-3.5 w-3.5 text-rose-600" />
                      <span>Mis Pedidos & Favoritos</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => signOut()}
                    className="flex items-center gap-2 text-xs text-rose-600 focus:text-rose-700"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Cerrar Sesión</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50/60 px-3 py-1.5 text-xs font-medium text-rose-800 hover:bg-rose-100 hover:border-rose-300 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200 transition-colors"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Ingresar</span>
              </button>
            )}

            {/* Botón menú móvil */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-stone-700 hover:bg-rose-50 dark:text-stone-300 dark:hover:bg-zinc-800 lg:hidden"
              aria-label="Abrir menú"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Menú desplegable móvil */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-rose-100 bg-[#FFFDFB] px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950 shadow-xl animate-in slide-in-from-top-2 duration-200">
            <nav className="flex flex-col gap-3">
              {navLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-stone-700 hover:bg-rose-50 hover:text-rose-600 dark:text-stone-200 dark:hover:bg-zinc-800"
                >
                  {link.label}
                </Link>
              ))}
              <div className="my-2 border-t border-rose-100 dark:border-zinc-800" />
              {(!hydrated || !user) && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false)
                    setAuthModalOpen(true)
                  }}
                  className="flex items-center justify-center gap-2 rounded-full bg-rose-500 py-2.5 text-sm font-semibold text-white shadow-sm"
                >
                  <LogIn className="h-4 w-4" />
                  <span>Iniciar Sesión / Registrarse</span>
                </button>
              )}
            </nav>
          </div>
        )}
      </header>

      {/* Modal de autenticación */}
      <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </>
  )
}
