'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowRight, Building2, Menu, Store, X, LogIn, LayoutDashboard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { usePlatformBranding } from '@/hooks/use-platform-branding'

const navLinks = [
  { label: 'Caracteristicas', href: '/saas#caracteristicas' },
  { label: 'Negocios', href: '/saas/negocios' },
  { label: 'Planes', href: '/saas/planes' },
]

interface SaaSPublicNavProps {
  variant?: 'default' | 'dark'
}

export function SaaSPublicNav({ variant = 'default' }: SaaSPublicNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()
  const { user } = useAuth()
  const isDark = variant === 'dark'
  const { branding } = usePlatformBranding()

  function isActive(href: string) {
    if (href.includes('#')) return pathname === '/saas'
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <header className={`sticky top-0 z-40 border-b backdrop-blur-xl ${
      isDark
        ? 'border-slate-800/80 bg-slate-950/85'
        : 'border-slate-200/70 bg-white/90 dark:border-slate-800 dark:bg-slate-950/90'
    }`}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/saas" className="flex items-center gap-3">
          {branding.logoUrl ? (
            <div className="flex h-10 items-center">
              <img src={branding.logoUrl} alt={branding.platformName} className="h-10 w-auto max-w-[180px] object-contain" />
            </div>
          ) : (
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${
              isDark ? 'bg-blue-600 text-white' : 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
            }`}>
              <Building2 className="h-5 w-5" />
            </div>
          )}
          <div>
            <div className={`text-sm font-semibold leading-none ${isDark ? 'text-white' : 'text-slate-950 dark:text-slate-50'}`}>{branding.platformName}</div>
            <div className={`mt-1 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{branding.platformTagline}</div>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
                href={link.href}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isDark
                  ? isActive(link.href)
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                  : isActive(link.href)
                    ? 'bg-slate-100 text-slate-950 dark:bg-slate-900 dark:text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className={`hidden gap-2 sm:inline-flex ${
            isDark ? 'border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800 hover:text-white' : ''
          }`}>
            <Link href={branding.secondaryCtaHref}>
              <Store className="h-4 w-4" />
              {branding.secondaryCtaLabel}
            </Link>
          </Button>

          {user ? (
            <Button asChild size="sm" className="hidden gap-2 md:inline-flex bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-md">
              <Link href="/dashboard">
                <LayoutDashboard className="h-4 w-4" />
                Ir al Panel
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className={`hidden gap-2 md:inline-flex font-medium ${
                isDark
                  ? 'text-slate-300 hover:bg-slate-900 hover:text-white'
                  : 'text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white'
              }`}>
                <Link href="/login">
                  <LogIn className="h-4 w-4" />
                  Ingresar
                </Link>
              </Button>
              <Button asChild size="sm" className="hidden gap-2 md:inline-flex">
                <Link href={branding.primaryCtaHref}>
                  {branding.primaryCtaLabel}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </>
          )}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className={`flex h-9 w-9 items-center justify-center rounded-md border transition md:hidden ${
              isDark
                ? 'border-slate-700 text-slate-300 hover:bg-slate-900 hover:text-white'
                : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900'
            }`}
            aria-label={mobileOpen ? 'Cerrar menu' : 'Abrir menu'}
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className={`border-t px-4 py-3 md:hidden ${
          isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950'
        }`}>
          <nav className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive(link.href)
                    ? isDark
                      ? 'bg-slate-800 text-white'
                      : 'bg-slate-100 text-slate-950 dark:bg-slate-900 dark:text-white'
                    : isDark
                      ? 'text-slate-300 hover:bg-slate-900 hover:text-white'
                      : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className={`mt-3 flex flex-col gap-2 border-t pt-3 ${isDark ? 'border-slate-800' : 'border-slate-100 dark:border-slate-800'}`}>
            <Button asChild variant="outline" size="sm" className={`w-full gap-2 ${
              isDark ? 'border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800 hover:text-white' : ''
            }`}>
              <Link href={branding.secondaryCtaHref} onClick={() => setMobileOpen(false)}>
                <Store className="h-4 w-4" />
                {branding.secondaryCtaLabel}
              </Link>
            </Button>

            {user ? (
              <Button asChild size="sm" className="w-full gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-md">
                <Link href="/dashboard" onClick={() => setMobileOpen(false)}>
                  <LayoutDashboard className="h-4 w-4" />
                  Ir al Panel
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="outline" size="sm" className={`w-full gap-2 ${
                  isDark ? 'border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800 hover:text-white' : ''
                }`}>
                  <Link href="/login" onClick={() => setMobileOpen(false)}>
                    <LogIn className="h-4 w-4" />
                    Ingresar
                  </Link>
                </Button>
                <Button asChild size="sm" className="w-full gap-2">
                  <Link href={branding.primaryCtaHref} onClick={() => setMobileOpen(false)}>
                    {branding.primaryCtaLabel}
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
