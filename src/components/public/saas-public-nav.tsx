'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowRight, Building2, Menu, Store, X, LogIn, LayoutDashboard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'

const navLinks = [
  { label: 'Marketplace', href: '/marketplace' },
  { label: 'Caracteristicas', href: '/saas#caracteristicas' },
  { label: 'Negocios', href: '/saas/negocios' },
  { label: 'Planes', href: '/saas/planes' },
]

export function SaaSPublicNav() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()
  const { user } = useAuth()

  useEffect(() => {
    setMounted(true)
  }, [])

  function isActive(href: string) {
    if (href.includes('#')) return pathname === '/saas'
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/90 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/saas" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-950 text-white dark:bg-white dark:text-slate-950">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold leading-none text-slate-950 dark:text-slate-50">MiPOS SaaS</div>
            <div className="mt-1 text-xs text-slate-500">POS, inventario y marketplace</div>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive(link.href)
                  ? 'bg-slate-100 text-slate-950 dark:bg-slate-900 dark:text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="hidden gap-2 sm:inline-flex">
            <Link href="/marketplace">
              <Store className="h-4 w-4" />
              Ver tiendas
            </Link>
          </Button>

          {mounted && user ? (
            <Button asChild size="sm" className="hidden gap-2 md:inline-flex bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-md">
              <Link href="/dashboard">
                <LayoutDashboard className="h-4 w-4" />
                Ir al Panel
              </Link>
            </Button>
          ) : (
            <>
              {mounted && (
                <Button asChild variant="ghost" size="sm" className="hidden gap-2 md:inline-flex text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white font-medium">
                  <Link href="/login">
                    <LogIn className="h-4 w-4" />
                    Ingresar
                  </Link>
                </Button>
              )}
              <Button asChild size="sm" className="hidden gap-2 md:inline-flex">
                <Link href="/register">
                  Crear empresa
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </>
          )}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900 md:hidden"
            aria-label={mobileOpen ? 'Cerrar menu' : 'Abrir menu'}
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950 md:hidden">
          <nav className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive(link.href)
                    ? 'bg-slate-100 text-slate-950 dark:bg-slate-900 dark:text-white'
                    : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
            <Button asChild variant="outline" size="sm" className="w-full gap-2">
              <Link href="/marketplace" onClick={() => setMobileOpen(false)}>
                <Store className="h-4 w-4" />
                Ver tiendas
              </Link>
            </Button>

            {mounted && user ? (
              <Button asChild size="sm" className="w-full gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-md">
                <Link href="/dashboard" onClick={() => setMobileOpen(false)}>
                  <LayoutDashboard className="h-4 w-4" />
                  Ir al Panel
                </Link>
              </Button>
            ) : (
              <>
                {mounted && (
                  <Button asChild variant="outline" size="sm" className="w-full gap-2">
                    <Link href="/login" onClick={() => setMobileOpen(false)}>
                      <LogIn className="h-4 w-4" />
                      Ingresar
                    </Link>
                  </Button>
                )}
                <Button asChild size="sm" className="w-full gap-2">
                  <Link href="/register" onClick={() => setMobileOpen(false)}>
                    Crear empresa
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
