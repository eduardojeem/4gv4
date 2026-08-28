'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Building2, Menu, Store, X, User, LayoutDashboard, Sparkles, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { usePlatformBranding } from '@/hooks/use-platform-branding'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { AuthModal } from '@/components/public/AuthModal'

const navLinks = [
  { label: 'Características', href: '/saas#caracteristicas' },
  { label: 'Negocios', href: '/saas/negocios' },
  { label: 'Planes', href: '/saas/planes' },
]

interface SaaSPublicNavProps {
  variant?: 'default' | 'dark'
}

export function SaaSPublicNav({ variant = 'default' }: SaaSPublicNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const pathname = usePathname()
  const { user } = useAuth()
  const isDark = variant === 'dark'
  const { branding } = usePlatformBranding()

  function isActive(href: string) {
    if (href.includes('#')) return pathname === '/saas'
    return pathname === href || pathname.startsWith(href + '/')
  }

  // Clases dinámicas según el tamaño del logo configurado
  const heightClasses = {
    sm: 'h-8 sm:h-9 max-w-[160px]',
    md: 'h-10 sm:h-12 max-w-[220px]',
    lg: 'h-12 sm:h-14 max-w-[270px]',
    xl: 'h-14 sm:h-16 max-w-[320px]',
  }
  const currentHeight = heightClasses[branding.logoHeight || 'md']
  const darkGlowClass =
    branding.logoGlowDark !== false
      ? 'drop-shadow-[0_3px_18px_rgba(6,182,212,0.4)]'
      : 'drop-shadow-xs'

  return (
    <>
      <header
        className={`sticky top-0 z-50 border-b backdrop-blur-2xl transition-colors duration-200 ${
          isDark
            ? 'border-slate-800/80 bg-slate-950/90 shadow-[0_4px_30px_rgba(0,0,0,0.5)]'
            : 'border-slate-200/80 bg-white/90 shadow-[0_4px_24px_rgba(0,0,0,0.04)] dark:border-slate-800/80 dark:bg-slate-950/90 dark:shadow-[0_4px_30px_rgba(0,0,0,0.5)]'
        }`}
      >
        <div className="mx-auto flex h-16 sm:h-18 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          
          {/* Logo & Brand Identity Container */}
          <Link
            href="/saas"
            className="group flex items-center gap-3.5 shrink-0 transition-transform duration-200 active:scale-[0.98]"
          >
            {branding.logoUrl || branding.logoDarkUrl ? (
              <div className="flex items-center transition-all duration-300 group-hover:scale-[1.03]">
                {branding.logoDarkUrl && branding.logoUrl ? (
                  <>
                    <img
                      src={branding.logoUrl}
                      alt={branding.platformName}
                      className={`${currentHeight} w-auto object-contain drop-shadow-xs ${
                        isDark ? 'hidden' : 'dark:hidden'
                      }`}
                    />
                    <img
                      src={branding.logoDarkUrl}
                      alt={branding.platformName}
                      className={`${currentHeight} w-auto object-contain ${darkGlowClass} ${
                        isDark ? 'block' : 'hidden dark:block'
                      }`}
                    />
                  </>
                ) : (
                  <img
                    src={branding.logoUrl || branding.logoDarkUrl}
                    alt={branding.platformName}
                    className={`${currentHeight} w-auto object-contain ${
                      isDark ? darkGlowClass : 'drop-shadow-xs'
                    }`}
                  />
                )}
              </div>
            ) : (
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-2xl shadow-lg transition-transform group-hover:scale-105 ${
                  isDark
                    ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-cyan-950/50'
                    : 'bg-gradient-to-br from-slate-900 to-slate-950 text-white shadow-slate-950/20 dark:from-cyan-500 dark:to-blue-600 dark:shadow-cyan-950/50'
                }`}
              >
                <Building2 className="h-5 w-5" />
              </div>
            )}

            {/* Platform Name and Tagline (only shown if not explicitly hidden) */}
            {!branding.hideNavBrandText && (
              <div className="hidden min-[420px]:block">
                <div
                  className={`text-sm sm:text-base font-extrabold leading-none tracking-tight transition-colors ${
                    isDark
                      ? 'text-white group-hover:text-cyan-300'
                      : 'text-slate-950 group-hover:text-cyan-700 dark:text-slate-50 dark:group-hover:text-cyan-300'
                  }`}
                >
                  {branding.platformName}
                </div>
                {!branding.hideNavTagline && (
                  <div
                    className={`mt-1 text-[11px] font-medium leading-tight ${
                      isDark ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {branding.platformTagline}
                  </div>
                )}
              </div>
            )}
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden items-center gap-1.5 md:flex rounded-full border border-slate-200/80 bg-slate-100/70 p-1 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60">
            {navLinks.map((link) => {
              const active = isActive(link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-200 ${
                    active
                      ? isDark
                        ? 'bg-cyan-500 text-slate-950 shadow-xs'
                        : 'bg-white text-slate-950 shadow-xs dark:bg-cyan-500 dark:text-slate-950'
                      : isDark
                        ? 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        : 'text-slate-600 hover:bg-white/80 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2.5">
            <ThemeToggle />

            {/* Marketplace Button */}
            <Button
              asChild
              variant="outline"
              size="sm"
              className={`hidden gap-2 sm:inline-flex rounded-xl font-semibold text-xs h-9 ${
                isDark
                  ? 'border-slate-800 bg-slate-900/80 text-slate-200 hover:border-slate-700 hover:bg-slate-800 hover:text-white'
                  : 'border-slate-200/90 bg-slate-50 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-200'
              }`}
            >
              <Link href={branding.secondaryCtaHref}>
                <Store className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                {branding.secondaryCtaLabel}
              </Link>
            </Button>

            {user ? (
              <Button
                asChild
                size="sm"
                className="hidden gap-2 md:inline-flex bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold shadow-md shadow-cyan-600/20 rounded-xl h-9 px-4 text-xs"
              >
                <Link href="/dashboard">
                  <LayoutDashboard className="h-4 w-4" />
                  Ir al Panel
                </Link>
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={() => setAuthOpen(true)}
                className="group hidden gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 pl-2 pr-4 text-slate-950 font-bold shadow-md shadow-cyan-500/25 transition-all duration-200 active:scale-[0.97] md:inline-flex h-9 text-xs"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-950/15 transition-transform duration-200 group-hover:scale-110">
                  <User className="h-3.5 w-3.5 text-slate-950" />
                </span>
                Mi cuenta
              </Button>
            )}

            {/* Mobile Menu Toggle Button */}
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-colors md:hidden ${
                isDark
                  ? 'border-slate-800 text-slate-300 hover:bg-slate-900 hover:text-white'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900'
              }`}
              aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {mobileOpen && (
          <div
            className={`border-t px-4 py-4 md:hidden shadow-xl backdrop-blur-2xl ${
              isDark
                ? 'border-slate-800 bg-slate-950/95'
                : 'border-slate-200 bg-white/95 dark:border-slate-800 dark:bg-slate-950/95'
            }`}
          >
            <nav className="flex flex-col gap-1.5">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                    isActive(link.href)
                      ? isDark
                        ? 'bg-slate-800 text-cyan-400'
                        : 'bg-cyan-50 text-cyan-900 dark:bg-slate-800 dark:text-cyan-400'
                      : isDark
                        ? 'text-slate-300 hover:bg-slate-900 hover:text-white'
                        : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div
              className={`mt-4 flex flex-col gap-2.5 border-t pt-4 ${
                isDark ? 'border-slate-800' : 'border-slate-100 dark:border-slate-800'
              }`}
            >
              <Button
                asChild
                variant="outline"
                size="sm"
                className={`w-full gap-2 rounded-xl h-10 font-semibold ${
                  isDark
                    ? 'border-slate-800 bg-slate-900/80 text-slate-200 hover:bg-slate-800 hover:text-white'
                    : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/80'
                }`}
              >
                <Link href={branding.secondaryCtaHref} onClick={() => setMobileOpen(false)}>
                  <Store className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                  {branding.secondaryCtaLabel}
                </Link>
              </Button>

              {user ? (
                <Button
                  asChild
                  size="sm"
                  className="w-full gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold h-10 shadow-md"
                >
                  <Link href="/dashboard" onClick={() => setMobileOpen(false)}>
                    <LayoutDashboard className="h-4 w-4" />
                    Ir al Panel
                  </Link>
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  className="w-full gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold h-10 shadow-md active:scale-[0.99]"
                  onClick={() => {
                    setMobileOpen(false)
                    setAuthOpen(true)
                  }}
                >
                  <User className="h-4 w-4" />
                  Mi cuenta
                </Button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Auth modal */}
      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        loginHref="/login"
        registerHref="/register"
      />
    </>
  )
}
