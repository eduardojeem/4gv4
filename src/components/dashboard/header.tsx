'use client'

import { useEffect, useMemo, useState, memo } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Bell, Search, LogOut, User, Settings, Menu, AlertCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { useAuth } from '@/contexts/auth-context'
import { useDashboardLayout } from '@/contexts/DashboardLayoutContext'
import { useDashboardSearch } from '@/hooks/use-dashboard-search'
import { cn } from '@/lib/utils'

const GlobalSearch = dynamic(() => import('@/components/ui/global-search').then(mod => mod.GlobalSearch), { 
  ssr: false,
  loading: () => null 
})

export const Header = memo(function Header() {
  const [loading, setLoading] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const { toggleSidebar } = useDashboardLayout()
  const { search } = useDashboardSearch()
  const { user, signOut } = useAuth()
  // Prefetch critical routes
  useEffect(() => {
    router.prefetch('/dashboard/profile')
    router.prefetch('/dashboard/settings')
  }, [router])

  // Keyboard shortcut Ctrl+K for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleLogout = async () => {
    setLoading(true)
    try {
      // Small delay for better UX (optional) to show the "Signing out" state
      await new Promise(resolve => setTimeout(resolve, 500))
      await signOut()
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('Error logging out:', error)
    } finally {
      setLoading(false)
    }
  }

  const pathname = usePathname()
  const breadcrumb = useMemo(() => {
    const map: Record<string, string> = {
      '/dashboard': 'Dashboard',
      '/dashboard/customers': 'Clientes',
      '/dashboard/products': 'Productos',
      '/dashboard/suppliers': 'Proveedores',
      '/dashboard/pos': 'Punto de Venta',
      '/dashboard/repairs': 'Reparaciones',
      '/dashboard/technician': 'Panel Técnico',
      '/dashboard/reports': 'Reportes',
      '/admin': 'Administración',
      '/dashboard/settings': 'Configuración',
      '/dashboard/catalog': 'Catálogo',
      '/dashboard/posts': 'Publicaciones',
      '/dashboard/profile': 'Perfil',
    }
    return map[pathname] || 'Sección'
  }, [pathname])

  // Get user initials for avatar fallback
  const userInitials = useMemo(() => {
    if (!user?.profile?.name) return 'U'
    return user.profile.name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }, [user])

  return (
    <header className="border-b border-border px-6 py-3 sticky top-0 z-30 transition-all duration-200 backdrop-blur-sm bg-background/95 supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center justify-between gap-4">
        {/* Mobile hamburger + Breadcrumb */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Hamburger menu for mobile */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            className="lg:hidden p-2"
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Breadcrumb + Title */}
          <div className="min-w-0 flex flex-col">
            <div className="text-xs text-muted-foreground hidden sm:block">Dashboard / {breadcrumb}</div>
            <h2 className="text-lg font-semibold truncate leading-tight">{breadcrumb}</h2>
          </div>
        </div>

        {/* Search */}
        <div className="flex-1 max-w-md hidden md:block">
          <Button
            variant="outline"
            className="w-full justify-start text-muted-foreground font-normal bg-muted/50 hover:bg-muted border-muted-foreground/10"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="mr-2 h-4 w-4" />
            <span>Buscar productos, clientes, reparaciones...</span>
            <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 shadow-sm">
              <span className="text-xs">⌘</span>K
            </kbd>
          </Button>
        </div>

        {/* GlobalSearch Modal */}
        <GlobalSearch
          open={searchOpen}
          onOpenChange={setSearchOpen}
          onSearch={search}
        />

        {/* Right side */}
        <div className="flex items-center space-x-2 sm:space-x-4">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSearchOpen(true)}>
            <Search className="h-5 w-5" />
          </Button>

          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground transition-colors">
            <Bell className="h-5 w-5" />
            <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-bold rounded-full h-2 w-2 ring-2 ring-background animate-pulse" />
          </Button>

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full ring-2 ring-transparent hover:ring-primary/10 transition-all ml-1">
                <Avatar className="h-9 w-9 border border-border">
                  <AvatarImage src={user?.profile?.avatar_url || "/avatars/01.svg"} alt={user?.profile?.name || "Usuario"} />
                  <AvatarFallback className="bg-primary/10 text-primary font-medium">{userInitials}</AvatarFallback>
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
                  {user?.role && (
                    <div className="pt-1">
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-full font-medium border capitalize",
                        user.role === 'admin' ? "bg-purple-50 text-purple-700 border-purple-200" :
                          user.role === 'vendedor' ? "bg-blue-50 text-blue-700 border-blue-200" :
                            "bg-gray-50 text-gray-700 border-gray-200"
                      )}>
                        {user.role}
                      </span>
                    </div>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="my-2" />
              <DropdownMenuItem asChild>
                <Link
                  href="/dashboard/profile"
                  className="cursor-pointer py-2.5 px-3 focus:bg-accent focus:text-accent-foreground rounded-md transition-colors flex items-center w-full"
                >
                  <div className="flex items-center justify-center h-8 w-8 rounded-md bg-primary/10 text-primary mr-3">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">Mi Perfil</span>
                    <span className="text-xs text-muted-foreground">Ver informaicón personal</span>
                  </div>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href="/dashboard/settings"
                  className="cursor-pointer py-2.5 px-3 focus:bg-accent focus:text-accent-foreground rounded-md transition-colors mt-1 flex items-center w-full"
                >
                  <div className="flex items-center justify-center h-8 w-8 rounded-md bg-primary/10 text-primary mr-3">
                    <Settings className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">Configuración</span>
                    <span className="text-xs text-muted-foreground">Preferencias de cuenta</span>
                  </div>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-2" />
              <DropdownMenuItem
                onClick={() => setLogoutOpen(true)}
                disabled={loading}
                className="cursor-pointer py-2.5 px-3 text-red-600 focus:text-red-700 focus:bg-red-50 rounded-md transition-colors mt-1 group"
              >
                <div className="flex items-center justify-center h-8 w-8 rounded-md bg-red-100 text-red-600 group-hover:bg-red-200 group-hover:text-red-700 transition-colors mr-3">
                  <LogOut className="h-4 w-4" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">Cerrar Sesión</span>
                  <span className="text-xs text-red-600/70">Salir del sistema</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Modern Logout Modal */}
      <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <AlertDialogContent className="max-w-[400px] p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-white dark:bg-zinc-950 p-6 flex flex-col items-center text-center">

            {/* Enhanced Icon Header */}
            <div className="relative w-24 h-24 mb-6 group cursor-default">
              {/* Outer animated ring */}
              <div className="absolute inset-0 bg-red-500/10 rounded-full animate-[ping_2s_ease-out_infinite]" />

              {/* Background layers */}
              <div className="absolute inset-0 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-900/10 rounded-full transition-transform duration-500 group-hover:scale-105" />

              {/* Icon container */}
              <div className="absolute inset-2 bg-white dark:bg-zinc-900 rounded-full flex items-center justify-center border-4 border-red-50 dark:border-red-900/30 shadow-inner">
                <LogOut className="h-10 w-10 text-red-500 dark:text-red-400 ml-1 transition-all duration-300 group-hover:translate-x-1 group-hover:text-red-600" />
              </div>

              {/* Status indicator */}
              <div className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full border-[3px] border-white dark:border-zinc-950 shadow-sm" />
            </div>

            <AlertDialogHeader className="mb-2">
              <AlertDialogTitle className="text-2xl font-bold text-center">
                ¿Cerrar sesión?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-center text-muted-foreground text-base mt-2">
                Hola <span className="font-semibold text-foreground">{user?.profile?.name?.split(' ')[0] || 'Usuario'}</span>, ¿estás seguro que quieres salir? Tendrás que iniciar sesión nuevamente para acceder.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <AlertDialogFooter className="w-full sm:justify-center gap-3 mt-6 flex-col-reverse sm:flex-row">
              <AlertDialogCancel
                className="w-full sm:w-auto mt-0 border-gray-200 hover:bg-gray-50 hover:text-gray-900"
                disabled={loading}
              >
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleLogout}
                disabled={loading}
                className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-500/20"
              >
                {loading ? (
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
})
