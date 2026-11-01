'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { AppImage } from '@/components/ui/app-image'
import { usePathname } from 'next/navigation'
import { Search, Menu, User, ChevronDown, Phone, Mail, X, Layers, ArrowRight } from 'lucide-react'
import { usePublicCategories } from '@/hooks/usePublicCategories'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
import { PublicCartButton } from '@/components/public/cart/PublicCartButton'
import { loginHrefWithReturn } from '@/lib/auth/dashboard-access'
import type { WebsiteSettings } from '@/types/website-settings'

export function WholesaleHeader({ settings }: { settings: WebsiteSettings | null }) {
  const pathname = usePathname()
  const slug = getTenantSlugFromPathname(pathname)
  const prefix = slug ? '/' + slug : ''
  const { categories } = usePublicCategories()
  const company = settings?.company_info
  const catalog = prefix + '/productos'
  const categoryHref = (id: string) => catalog + '?category_id=' + encodeURIComponent(id)
  const accountHref = loginHrefWithReturn(slug ? prefix + '/cliente/login' : '/login', pathname, slug ? 'next' : 'redirect')

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [prevPathname, setPrevPathname] = useState(pathname)

  // Reset mobile drawer when navigating to a new path
  if (prevPathname !== pathname) {
    setPrevPathname(pathname)
    setMobileDrawerOpen(false)
  }

  // Prevent background scroll when mobile drawer is open
  useEffect(() => {
    if (mobileDrawerOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileDrawerOpen])

  return (
    <header className="relative z-30 border-b bg-background text-foreground" data-wholesale-header>
      {/* ── 1. Top utility bar (Desktop) ── */}
      {company?.showTopBar !== false && (company?.phone || company?.email) && (
        <div className="border-b bg-muted/40 px-4 py-1.5 text-xs text-muted-foreground">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
              {company.phone && (
                <a
                  href={'tel:' + company.phone.replace(/[^+0-9]/g, '')}
                  className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
                >
                  <Phone className="h-3 w-3 shrink-0" aria-hidden />
                  <span>{company.phone}</span>
                </a>
              )}
              {company.email && (
                <a
                  href={'mailto:' + company.email}
                  className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
                >
                  <Mail className="h-3 w-3 shrink-0" aria-hidden />
                  <span>{company.email}</span>
                </a>
              )}
            </div>

            <div className="hidden sm:flex items-center gap-4 text-xs font-medium">
              <Link
                href={accountHref}
                className="transition-colors hover:text-foreground focus-visible:underline focus-visible:outline-none"
              >
                Mi cuenta
              </Link>
              {company.phone && (
                <a
                  href={'https://wa.me/' + company.phone.replace(/\D/g, '')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary transition-colors hover:underline"
                >
                  Atención comercial
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 2. Main Header ── */}
      <div className="mx-auto max-w-7xl px-4 py-3 sm:py-3.5">
        <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-3 lg:gap-6">
          {/* Left: Mobile trigger & Logo */}
          <div className="flex items-center gap-3 order-1">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              aria-label="Abrir menú de navegación"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/30 text-foreground transition-colors hover:bg-muted lg:hidden focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>

            <Link
              href={prefix + '/inicio'}
              className="flex shrink-0 items-center truncate text-xl font-bold tracking-tight text-foreground transition-opacity hover:opacity-90 focus-visible:outline-primary"
            >
              {company?.logoUrl ? (
                <AppImage
                  src={company.logoUrl}
                  alt={company.name || 'Tienda'}
                  width={190}
                  height={46}
                  className="max-h-11 max-w-[170px] sm:max-w-[210px] object-contain"
                />
              ) : (
                <span className="truncate">{company?.name || 'Tienda'}</span>
              )}
            </Link>
          </div>

          {/* Center: Dominant search form (Responsive: Row 2 on mobile, Center on desktop) */}
          <form
            action={catalog}
            role="search"
            className="order-3 lg:order-2 w-full lg:w-auto lg:flex-1 lg:max-w-2xl lg:mx-auto group flex min-w-0 items-center overflow-hidden rounded-lg border border-border bg-background shadow-xs transition-all hover:border-foreground/30 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20"
          >
            <label htmlFor="wholesale-search" className="sr-only">
              Buscar por producto, SKU, descripción o marca
            </label>
            <div className="flex items-center pl-3.5 pr-1 text-muted-foreground group-focus-within:text-primary">
              <Search className="h-4 w-4" aria-hidden />
            </div>
            <input
              id="wholesale-search"
              name="query"
              type="search"
              placeholder="Buscar por producto, SKU, descripción o marca"
              className="min-w-0 flex-1 bg-transparent px-2.5 py-2 sm:py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              aria-label="Buscar"
              className="m-1 rounded-md bg-primary px-4 sm:px-5 py-2 text-xs font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring"
            >
              Buscar
            </button>
          </form>

          {/* Right actions: Account & Cart */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-3 order-2 lg:order-3">
            <Link
              href={accountHref}
              className="hidden sm:inline-flex min-h-10 items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-2 text-xs font-semibold text-foreground shadow-2xs transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            >
              <User className="h-4 w-4 text-muted-foreground" aria-hidden />
              <span>Mi cuenta</span>
            </Link>

            <PublicCartButton />
          </div>
        </div>
      </div>

      {/* ── 3. Category Navigation & Mega Menu Bar ── */}
      <nav aria-label="Catálogo mayorista y minorista" className="border-t bg-muted/20">
        <div className="mx-auto flex max-w-7xl items-center gap-1 px-4 py-1.5 text-sm">
          {/* Mega Menu Dropdown */}
          {categories.length > 0 && (
            <details className="group relative">
              <summary className="flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-md bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary/15 focus-visible:ring-2 focus-visible:ring-ring">
                <Menu className="h-3.5 w-3.5" aria-hidden />
                <span>Todas las categorías</span>
                <ChevronDown className="h-3 w-3 transition-transform duration-200 group-open:rotate-180" aria-hidden />
              </summary>

              <div className="absolute left-0 top-full z-50 mt-1 max-h-[70vh] w-[min(92vw,56rem)] overflow-y-auto rounded-xl border border-border/80 bg-background p-6 shadow-2xl backdrop-blur-md">
                <div className="mb-4 flex items-center justify-between border-b pb-3">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary" aria-hidden />
                    <span className="text-sm font-bold tracking-tight text-foreground">Departamentos y Rubros</span>
                  </div>
                  <Link
                    href={catalog}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Ver catálogo completo &rarr;
                  </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {categories.map((category) => (
                    <div key={category.id} className="space-y-2">
                      <Link
                        href={categoryHref(category.id)}
                        className="block rounded-md px-1 py-1 font-bold text-sm text-foreground hover:bg-muted hover:text-primary transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {category.name}
                      </Link>

                      {category.subcategories && category.subcategories.length > 0 && (
                        <div className="space-y-1 pl-1 border-l-2 border-border/40">
                          {category.subcategories.map((child) => (
                            <Link
                              key={child.id}
                              href={categoryHref(child.id)}
                              className="block rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              {child.name}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </details>
          )}

          {/* Quick horizontal categories (Desktop) */}
          <div className="hidden lg:flex items-center gap-1 overflow-hidden">
            {categories.slice(0, 6).map((category) => (
              <Link
                key={category.id}
                href={categoryHref(category.id)}
                className="whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium text-foreground/80 hover:bg-muted hover:text-foreground transition-colors focus-visible:ring-2 focus-visible:ring-ring"
              >
                {category.name}
              </Link>
            ))}
          </div>

          {/* Quick horizontal scroll pills (Mobile / Tablet) */}
          <div className="flex lg:hidden flex-1 items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            {categories.slice(0, 8).map((category) => (
              <Link
                key={category.id}
                href={categoryHref(category.id)}
                className="whitespace-nowrap rounded-full border border-border/60 bg-background px-3 py-1 text-xs font-medium text-foreground/80 hover:border-primary/50 hover:text-foreground transition-colors"
              >
                {category.name}
              </Link>
            ))}
          </div>

          {/* Offers button if enabled */}
          {settings?.offers_section?.enabled && (
            <Link
              href={prefix + '/ofertas'}
              className="ml-auto lg:ml-0 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors focus-visible:ring-2 focus-visible:ring-ring"
            >
              Ofertas
            </Link>
          )}

          {/* All catalog link (Desktop) */}
          <Link
            href={catalog}
            className="hidden sm:inline-flex items-center gap-1 ml-auto whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold text-primary hover:underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span>Todo el catálogo</span>
            <ArrowRight className="h-3 w-3" aria-hidden />
          </Link>
        </div>
      </nav>

      {/* ── 4. Mobile Navigation Drawer ── */}
      {mobileDrawerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menú principal de categorías"
          className="fixed inset-0 z-50 flex lg:hidden"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileDrawerOpen(false)}
          />

          {/* Drawer content */}
          <div className="relative flex w-full max-w-xs flex-col bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b px-4 py-3.5">
              <span className="font-bold text-sm tracking-tight text-foreground">Menú y Departamentos</span>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                aria-label="Cerrar menú"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
              {/* Account shortcut */}
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <Link
                  href={accountHref}
                  onClick={() => setMobileDrawerOpen(false)}
                  className="flex items-center gap-2.5 text-sm font-semibold text-foreground hover:text-primary"
                >
                  <User className="h-4 w-4 text-muted-foreground" aria-hidden />
                  <span>Mi cuenta / Acceso clientes</span>
                </Link>
              </div>

              {/* Direct links */}
              <div className="space-y-1">
                <Link
                  href={prefix + '/inicio'}
                  onClick={() => setMobileDrawerOpen(false)}
                  className="block rounded-md px-2.5 py-2 text-sm font-semibold text-foreground hover:bg-muted"
                >
                  Inicio
                </Link>
                <Link
                  href={catalog}
                  onClick={() => setMobileDrawerOpen(false)}
                  className="block rounded-md px-2.5 py-2 text-sm font-semibold text-primary hover:bg-primary/10"
                >
                  Ver todo el catálogo
                </Link>
                {settings?.offers_section?.enabled && (
                  <Link
                    href={prefix + '/ofertas'}
                    onClick={() => setMobileDrawerOpen(false)}
                    className="block rounded-md px-2.5 py-2 text-sm font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                  >
                    Ofertas y Liquidación
                  </Link>
                )}
              </div>

              {/* Categories list */}
              {categories.length > 0 && (
                <div className="space-y-3 pt-2 border-t">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-2">Categorías</p>
                  <div className="space-y-1">
                    {categories.map((category) => (
                      <div key={category.id} className="space-y-1">
                        <Link
                          href={categoryHref(category.id)}
                          onClick={() => setMobileDrawerOpen(false)}
                          className="block rounded-md px-2.5 py-1.5 text-sm font-medium text-foreground hover:bg-muted hover:text-primary"
                        >
                          {category.name}
                        </Link>
                        {category.subcategories && category.subcategories.length > 0 && (
                          <div className="ml-4 space-y-1 border-l-2 border-border/50 pl-2">
                            {category.subcategories.map((sub) => (
                              <Link
                                key={sub.id}
                                href={categoryHref(sub.id)}
                                onClick={() => setMobileDrawerOpen(false)}
                                className="block rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                              >
                                {sub.name}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Contact info */}
              {(company?.phone || company?.email) && (
                <div className="space-y-2 pt-4 border-t text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground">Contacto de atención</p>
                  {company.phone && (
                    <a href={'tel:' + company.phone.replace(/[^+0-9]/g, '')} className="block hover:text-foreground">
                      {company.phone}
                    </a>
                  )}
                  {company.email && (
                    <a href={'mailto:' + company.email} className="block break-all hover:text-foreground">
                      {company.email}
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
