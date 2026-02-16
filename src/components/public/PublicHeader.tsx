'use client'

import Link from 'next/link'
import { Package, Wrench, Menu, X, Phone, MessageCircle, User, Shield } from 'lucide-react'
import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { useWebsiteSettings } from '@/hooks/useWebsiteSettings'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'

export function PublicHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const { user, signOut } = useAuth()
  const { settings } = useWebsiteSettings()
  const router = useRouter()

  const companyInfo = settings?.company_info
  const envSupportPhone = (process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || process.env.NEXT_PUBLIC_COMPANY_PHONE || '').toString()
  const envSupportEmail = (process.env.NEXT_PUBLIC_COMPANY_EMAIL || '').toString()
  const phoneDisplay = companyInfo?.phone || envSupportPhone
  const phoneClean = phoneDisplay?.replace(/\D/g, '')
  const emailDisplay = companyInfo?.email || envSupportEmail
  const brandColor = companyInfo?.brandColor || 'blue'
  const headerStyle = companyInfo?.headerStyle || 'glass'
  const showTopBar = companyInfo?.showTopBar !== false

  const headerClasses = useMemo(() => {
    const base = "sticky top-0 z-50 w-full border-b transition-all duration-300 "
    
    switch (headerStyle) {
      case 'solid':
        return base + "bg-background border-border"
      case 'accent':
        const accentMap: Record<string, string> = {
          blue: "bg-blue-600 border-blue-700 text-white",
          green: "bg-green-600 border-green-700 text-white",
          purple: "bg-purple-600 border-purple-700 text-white",
          orange: "bg-orange-600 border-orange-700 text-white",
          red: "bg-red-600 border-red-700 text-white",
          indigo: "bg-indigo-600 border-indigo-700 text-white",
          teal: "bg-teal-600 border-teal-700 text-white",
          rose: "bg-rose-600 border-rose-700 text-white",
          amber: "bg-amber-600 border-amber-700 text-white",
          emerald: "bg-emerald-600 border-emerald-700 text-white",
          cyan: "bg-cyan-600 border-cyan-700 text-white",
          sky: "bg-sky-600 border-sky-700 text-white"
        }
        return base + (accentMap[brandColor] || accentMap.blue)
      case 'dark':
        return base + "bg-zinc-950 border-zinc-800 text-white"
      case 'glass':
      default:
        return base + "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
    }
  }, [headerStyle, brandColor])

  const brandIconClasses = useMemo(() => {
    if (headerStyle === 'accent' || headerStyle === 'dark') {
      return "bg-white/10 text-white"
    }
    const colorMap: Record<string, string> = {
      blue: "bg-blue-600 text-white",
      green: "bg-green-600 text-white",
      purple: "bg-purple-600 text-white",
      orange: "bg-orange-600 text-white",
      red: "bg-red-600 text-white",
      indigo: "bg-indigo-600 text-white",
      teal: "bg-teal-600 text-white",
      rose: "bg-rose-600 text-white",
      amber: "bg-amber-600 text-white",
      emerald: "bg-emerald-600 text-white",
      cyan: "bg-cyan-600 text-white",
      sky: "bg-sky-600 text-white"
    }
    return (colorMap[brandColor] || colorMap.blue)
  }, [brandColor, headerStyle])

  const userInitials = useMemo(() => {
    if (!user?.profile?.name) return 'U'
    return user.profile.name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }, [user])

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 500))
      await signOut()
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('Error logging out:', error)
    } finally {
      setIsLoggingOut(false)
      setLogoutOpen(false)
    }
  }

  return (
    <header className={headerClasses}>
      <div className="container">
        {/* Top bar with contact info */}
        {showTopBar && (
          <div className={`hidden border-b py-2 text-sm md:block ${headerStyle === 'accent' || headerStyle === 'dark' ? 'border-white/10 opacity-90' : ''}`}>
            <div className="flex items-center justify-between">
              <div className={`flex items-center gap-6 ${headerStyle === 'accent' || headerStyle === 'dark' ? 'text-white/80' : 'text-muted-foreground'}`}>
                <a href={phoneClean ? `tel:${phoneClean}` : undefined} className="flex items-center gap-1 hover:text-foreground transition-colors" aria-label="Llamar al local">
                  <Phone className="h-3.5 w-3.5" />
                  <span>{phoneDisplay || '(sin teléfono)'}</span>
                </a>
                <span>
                  {companyInfo?.hours?.weekdays || 'Lun - Vie: 8:00 - 18:00'}
                  {companyInfo?.hours?.saturday ? ` | Sáb: ${companyInfo.hours.saturday}` : ''}
                </span>
              </div>
              <div className={headerStyle === 'accent' || headerStyle === 'dark' ? 'text-white/80' : 'text-muted-foreground'}>
                ¿Necesitas ayuda? Escribinos por WhatsApp
              </div>
            </div>
          </div>
        )}

        {/* Main header */}
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/inicio" className="flex items-center space-x-2">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg shadow-sm ${brandIconClasses}`}>
              <Wrench className="h-6 w-6" />
            </div>
            <div className="hidden sm:block">
              <span className="block text-lg font-bold leading-tight">{companyInfo?.name || '4G Celulares'}</span>
              <span className={`block text-xs ${headerStyle === 'accent' || headerStyle === 'dark' ? 'text-white/70' : 'text-muted-foreground'}`}>
                Reparación y Service
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex md:gap-1">
            <Link
              href="/inicio"
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                headerStyle === 'accent' || headerStyle === 'dark' 
                  ? 'hover:bg-white/10 text-white' 
                  : 'hover:bg-accent hover:text-accent-foreground'
              }`}
            >
              Inicio
            </Link>
            <Link
              href="/productos"
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                headerStyle === 'accent' || headerStyle === 'dark' 
                  ? 'hover:bg-white/10 text-white' 
                  : 'hover:bg-accent hover:text-accent-foreground'
              }`}
            >
              <Package className="h-4 w-4" />
              Productos
            </Link>
            <Link
              href="/mis-reparaciones"
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                headerStyle === 'accent' || headerStyle === 'dark' 
                  ? 'hover:bg-white/10 text-white' 
                  : 'hover:bg-accent hover:text-accent-foreground'
              }`}
            >
              <Wrench className="h-4 w-4" />
              Rastrear Reparación
            </Link>
          </nav>

          {/* CTA Buttons */}
          <div className="hidden items-center gap-2 md:flex">
            <Button asChild variant={headerStyle === 'accent' || headerStyle === 'dark' ? 'secondary' : 'outline'} size="sm" className="hidden lg:flex">
              <a href={phoneClean ? `https://wa.me/${phoneClean}` : (emailDisplay ? `mailto:${emailDisplay}` : '/inicio#contacto')} target={phoneClean ? "_blank" : undefined} rel={phoneClean ? "noopener noreferrer" : undefined} aria-label="Escribir por WhatsApp o Email">
                <MessageCircle className="mr-2 h-4 w-4" />
                Escribinos
              </a>
            </Button>
            <Button asChild variant={headerStyle === 'accent' || headerStyle === 'dark' ? 'secondary' : 'outline'} size="sm" className="hidden xl:flex">
              <Link href="/mis-reparaciones">Rastrear reparación</Link>
            </Button>

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full ring-2 ring-transparent hover:ring-primary/10 transition-all p-0">
                    <Avatar className="h-9 w-9 border border-border shadow-sm">
                      <AvatarImage src={user?.profile?.avatar_url || ""} alt={user?.profile?.name || "Usuario"} />
                      <AvatarFallback className="bg-primary/10 text-primary font-medium text-xs">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64 p-2" align="end" forceMount sideOffset={8}>
                  <DropdownMenuLabel className="font-normal p-2">
                    <div className="flex flex-col space-y-1.5">
                      <p className="text-sm font-semibold leading-none">{user?.profile?.name || 'Usuario'}</p>
                      <p className="text-xs leading-none text-muted-foreground break-all">
                        {user?.email || 'usuario@email.com'}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="my-2" />
                  <DropdownMenuItem asChild>
                    <Link
                      href="/perfil"
                      className="cursor-pointer py-2 px-3 focus:bg-accent focus:text-accent-foreground rounded-md transition-colors flex items-center w-full"
                    >
                      <User className="h-4 w-4 mr-3 text-muted-foreground" />
                      <span className="text-sm font-medium">Mi Perfil</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link
                      href="/mis-reparaciones"
                      className="cursor-pointer py-2 px-3 focus:bg-accent focus:text-accent-foreground rounded-md transition-colors flex items-center w-full"
                    >
                      <Wrench className="h-4 w-4 mr-3 text-muted-foreground" />
                      <span className="text-sm font-medium">Mis Reparaciones</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link
                      href="/perfil/autorizados"
                      className="cursor-pointer py-2 px-3 focus:bg-accent focus:text-accent-foreground rounded-md transition-colors flex items-center w-full"
                    >
                      <Shield className="h-4 w-4 mr-3 text-muted-foreground" />
                      <span className="text-sm font-medium">Personas Autorizadas</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="my-2" />
                  <DropdownMenuItem
                    onClick={() => setLogoutOpen(true)}
                    className="cursor-pointer py-2 px-3 text-red-600 focus:text-red-700 focus:bg-red-50 rounded-md transition-colors flex items-center w-full group"
                  >
                    <LogOut className="h-4 w-4 mr-3 group-hover:text-red-700 transition-colors" />
                    <span className="text-sm font-medium">Cerrar Sesión</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button asChild size="sm" className="rounded-full px-6">
                <Link href="/login">
                  <User className="mr-2 h-4 w-4" />
                  Mi cuenta
                </Link>
              </Button>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="rounded-md p-2 hover:bg-accent md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="border-t bg-background md:hidden">
          <nav className="container flex flex-col gap-1 py-4">
            <Link
              href="/inicio"
              className="rounded-md px-4 py-3 text-sm font-medium transition-colors hover:bg-accent"
              onClick={() => setMobileMenuOpen(false)}
            >
              Inicio
            </Link>
            <Link
              href="/productos"
              className="flex items-center gap-2 rounded-md px-4 py-3 text-sm font-medium transition-colors hover:bg-accent"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Package className="h-4 w-4" />
              Productos
            </Link>
            <Link
              href="/mis-reparaciones"
              className="flex items-center gap-2 rounded-md px-4 py-3 text-sm font-medium transition-colors hover:bg-accent"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Wrench className="h-4 w-4" />
              Rastrear Reparación
            </Link>
            
            <div className="mt-4 flex flex-col gap-2 px-4">
              <Button asChild className="w-full" size="sm">
                <a href="https://wa.me/595123456789" target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Escribinos
                </a>
              </Button>
              <Button asChild variant="outline" className="w-full" size="sm">
                <Link href="/mis-reparaciones">Rastrear reparación</Link>
              </Button>
              {user ? (
                <>
                  <Link
                    href="/perfil"
                    className="flex items-center gap-2 rounded-md px-4 py-3 text-sm font-medium transition-colors hover:bg-accent"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <User className="h-4 w-4" />
                    Mi Perfil
                  </Link>
                  <Link
                    href="/perfil/autorizados"
                    className="flex items-center gap-2 rounded-md px-4 py-3 text-sm font-medium transition-colors hover:bg-accent"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Shield className="h-4 w-4" />
                    Personas Autorizadas
                  </Link>
                  <Link
                    href="/mis-reparaciones"
                    className="flex items-center gap-2 rounded-md px-4 py-3 text-sm font-medium transition-colors hover:bg-accent"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Wrench className="h-4 w-4" />
                    Mis Reparaciones
                  </Link>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                    size="sm"
                    onClick={() => {
                      setMobileMenuOpen(false)
                      setLogoutOpen(true)
                    }}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Cerrar Sesión
                  </Button>
                </>
              ) : (
                <Button asChild className="w-full" size="sm">
                  <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                    <User className="mr-2 h-4 w-4" />
                    Mi cuenta
                  </Link>
                </Button>
              )}
            </div>

            {/* Contact info in mobile */}
            <div className="mt-4 border-t pt-4 px-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Horarios de atención:</p>
              <p className="mt-1">Lun - Vie: 8:00 - 18:00</p>
              <p>Sábados: 9:00 - 13:00</p>
            </div>
          </nav>
        </div>
      )}
      {/* Logout Confirmation Dialog */}
      <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <AlertDialogContent className="max-w-[400px] p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-white dark:bg-zinc-950 p-6 flex flex-col items-center text-center">
            {/* Icon Header */}
            <div className="relative w-20 h-20 mb-6">
              <div className="absolute inset-0 bg-red-500/10 rounded-full animate-pulse" />
              <div className="absolute inset-2 bg-white dark:bg-zinc-900 rounded-full flex items-center justify-center border-4 border-red-50 dark:border-red-900/30 shadow-inner">
                <LogOut className="h-8 w-8 text-red-500 ml-1" />
              </div>
            </div>

            <AlertDialogHeader className="mb-2">
              <AlertDialogTitle className="text-2xl font-bold text-center">
                ¿Cerrar sesión?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-center text-muted-foreground text-base mt-2">
                Hola <span className="font-semibold text-foreground">{user?.profile?.name?.split(' ')[0] || 'Usuario'}</span>, ¿estás seguro que quieres salir?
              </AlertDialogDescription>
            </AlertDialogHeader>

            <AlertDialogFooter className="w-full sm:justify-center gap-3 mt-6 flex-col-reverse sm:flex-row">
              <AlertDialogCancel
                className="w-full sm:w-auto mt-0"
                disabled={isLoggingOut}
              >
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white"
              >
                {isLoggingOut ? (
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Cerrando...</span>
                  </div>
                ) : (
                  'Sí, cerrar sesión'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  )
}

