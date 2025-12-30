"use client"

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { GlobalSearch } from '@/components/ui/global-search'
import { NotificationBell } from '@/components/ui/notification-bell'

import { Menu, MoreVertical, Download, Upload, PlusCircle, RefreshCw, Sun, Moon, ChevronDown, ChevronRight } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useAuth } from '@/contexts/auth-context'
import { useAdminLayout } from '@/contexts/AdminLayoutContext'
import { adminNavCategories, filterCategoriesByPermissions, getNavItemByKey, type NavItem, type NavCategory } from '@/config/admin-navigation'
import { cn } from '@/lib/utils'

interface AdminShellProps {
  active: string
  onNavigate: (key: string) => void
  onSearch?: (input: { query: string; filters: { type?: 'usuarios' | 'seguridad' | 'todos'; status?: 'active' | 'inactive' | 'suspended' | 'todos'; from?: string; to?: string } }) => Array<{ title: string; subtitle?: string; href: string }>
  topRightActions?: React.ReactNode
  onContextAction?: (action: string) => void
  children: React.ReactNode
  compact?: boolean
}

export function AdminShell({ active, onNavigate, onSearch, topRightActions, onContextAction, children, compact = false }: AdminShellProps) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['analytics', 'operations', 'administration'])
  const { hasPermission, isAdmin } = useAuth()
  const { sidebarCollapsed: collapsed, toggleSidebar, darkMode, toggleDarkMode } = useAdminLayout()

  // Filtrar categorías basado en permisos del usuario
  const visibleCategories = useMemo(
    () => filterCategoriesByPermissions(adminNavCategories, hasPermission, isAdmin),
    [hasPermission, isAdmin]
  )

  const currentItem = useMemo(() => getNavItemByKey(active), [active])

  const toggleCategory = useCallback((categoryId: string) => {
    setExpandedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    )
  }, [])

  const handleKeydown = useCallback((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      setSearchOpen(true)
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault()
      toggleSidebar()
    }
  }, [toggleSidebar])

  useEffect(() => {
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [handleKeydown])

  // Búsqueda global con filtros
  const handleSearch = useCallback((input: { query: string; filters: { type?: 'usuarios' | 'seguridad' | 'todos' } }) => {
    const q = input.query.toLowerCase()
    const type = input.filters?.type ?? 'todos'
    const items = visibleCategories.flatMap(cat => cat.items.map(i => ({
      title: i.label,
      subtitle: i.description,
      href: i.href || '#',
      type: cat.id
    })))
    return items
      .filter(r => (type === 'todos' || r.type === type) && (q ? (r.title.toLowerCase().includes(q) || (r.subtitle ?? '').toLowerCase().includes(q)) : true))
      .slice(0, 25)
  }, [visibleCategories])

  return (
    <div className="min-h-[calc(100vh-4rem)] grid grid-cols-1 lg:grid-cols-[240px_1fr]">

      <aside
        aria-label="Menú lateral"
        className={`${collapsed ? 'w-14' : 'w-full lg:w-[240px]'} border-r bg-background ${compact ? 'px-1 py-2' : 'px-2 py-3'} transition-all`}
      >
        <div className={`flex items-center justify-between ${compact ? 'px-1 mb-1' : 'px-2 mb-2'}`}>
          <div className="text-sm font-semibold">Panel</div>
          <Button variant="ghost" size="sm" onClick={toggleSidebar} aria-label="Alternar menú">
            {collapsed ? '→' : '←'}
          </Button>
        </div>
        <nav className={`${compact ? 'space-y-0.5' : 'space-y-2'}`} role="navigation">
          {visibleCategories.map((category) => {
            const isExpanded = expandedCategories.includes(category.id)

            return (
              <div key={category.id} className="space-y-1">
                {/* Category Header */}
                {!collapsed && (
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className={cn(
                      "w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold uppercase tracking-wider",
                      "text-muted-foreground hover:text-foreground transition-colors",
                      "focus:outline-none focus:text-foreground"
                    )}
                    aria-expanded={isExpanded}
                    aria-label={`${isExpanded ? 'Contraer' : 'Expandir'} categoría ${category.label}`}
                  >
                    <span>{category.label}</span>
                    {isExpanded ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                  </button>
                )}

                {/* Category separator when collapsed */}
                {collapsed && (
                  <div className="w-full h-px bg-border my-2" aria-hidden="true" />
                )}

                {/* Category Items */}
                {(collapsed || isExpanded) && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className={cn("space-y-0.5", !collapsed && "pl-1")}>
                    {category.items.map(({ key, label, icon: Icon, description }) => (
                      <motion.button
                        key={key}
                        onClick={() => onNavigate(key)}
                        whileHover={{ scale: 1.02 }}
                        className={cn(
                          "w-full flex items-center rounded-md transition-all duration-200",
                          compact ? 'gap-1 px-2 py-1 text-xs' : 'gap-2 px-3 py-2 text-sm',
                          "hover:bg-accent hover:text-accent-foreground",
                          "focus:bg-accent focus:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
                          active === key
                            ? 'bg-primary text-primary-foreground font-medium shadow-sm'
                            : 'text-foreground'
                        )}
                        aria-current={active === key ? 'page' : undefined}
                        title={collapsed ? `${label}${description ? ': ' + description : ''}` : description}
                      >
                        <Icon className={cn("flex-shrink-0", compact ? "h-3.5 w-3.5" : "h-4 w-4")} aria-hidden />
                        {!collapsed && <span className="truncate">{label}</span>}
                        {!collapsed && active === key && (
                          <div className="ml-auto h-2 w-2 rounded-full bg-primary-foreground" aria-hidden />
                        )}
                      </motion.button>
                    ))}
                  </motion.div>
                )}
              </div>
            )
          })}
        </nav>
      </aside>
      {/* Overlay para móvil cuando el menú lateral está abierto */}
      {!collapsed && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          role="button"
          tabIndex={0}
          aria-label="Cerrar menú lateral"
          onClick={() => toggleSidebar()}
          onKeyDown={(e) => {
            const keys = ['Escape', 'Esc', 'Enter', ' ']
            if (keys.includes(e.key)) toggleSidebar()
          }}
        />
      )}
      <section className="flex flex-col">
        <header className="border-b bg-background">
          <div className={`flex items-center ${compact ? 'gap-1 px-2 py-1' : 'gap-2 px-4 py-2'}`}>
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={toggleSidebar} aria-label={collapsed ? 'Abrir menú lateral' : 'Cerrar menú lateral'}>
              <Menu className="h-5 w-5" />
            </Button>
            <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Admin', href: '/admin' }, { label: currentItem?.label ?? 'Sección' }]} />
            <div className={`ml-auto flex items-center ${compact ? 'gap-1' : 'gap-2'}`}>
              <Input
                className={`${compact ? 'w-40' : 'w-48'}`}
                placeholder="Buscar (Ctrl+K)"
                aria-label="Abrir búsqueda global"
                onFocus={() => setSearchOpen(true)}
                readOnly
              />
              {/* Dark Mode Toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleDarkMode}
                aria-label={darkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                title={darkMode ? 'Modo claro' : 'Modo oscuro'}
              >
                {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>
              {topRightActions}
              {/* Menú contextual según la sección activa y permisos */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Acciones de sección">
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {/* Acción común: refrescar */}
                  <DropdownMenuItem onSelect={() => onContextAction?.('refresh')}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refrescar sección
                  </DropdownMenuItem>
                  {/* Usuarios */}
                  {(active === 'users') && (
                    <>
                      {hasPermission('users.create') && (
                        <DropdownMenuItem onSelect={() => onContextAction?.('create_user')}>
                          <PlusCircle className="h-4 w-4 mr-2" />
                          Crear usuario
                        </DropdownMenuItem>
                      )}
                      {(isAdmin || hasPermission('users.read')) && (
                        <DropdownMenuItem onSelect={() => onContextAction?.('export_users_csv')}>
                          <Download className="h-4 w-4 mr-2" />
                          Exportar usuarios (CSV)
                        </DropdownMenuItem>
                      )}
                      {isAdmin && (
                        <DropdownMenuItem onSelect={() => onContextAction?.('import_users_csv')}>
                          <Upload className="h-4 w-4 mr-2" />
                          Importar usuarios (CSV)
                        </DropdownMenuItem>
                      )}
                    </>
                  )}
                  {/* Seguridad */}
                  {(active === 'security') && (
                    <>
                      {(isAdmin || hasPermission('settings.read')) && (
                        <DropdownMenuItem onSelect={() => onContextAction?.('export_security_logs_csv')}>
                          <Download className="h-4 w-4 mr-2" />
                          Exportar logs seguridad (CSV)
                        </DropdownMenuItem>
                      )}
                    </>
                  )}
                  {/* Inventario */}
                  {(active === 'inventory') && (
                    <>
                      {(hasPermission('inventory.manage')) && (
                        <DropdownMenuItem onSelect={() => onContextAction?.('inventory_quick_add')}>
                          <PlusCircle className="h-4 w-4 mr-2" />
                          Alta rápida de producto
                        </DropdownMenuItem>
                      )}
                    </>
                  )}
                  {/* Reportes */}
                  {(active === 'reports') && (
                    <>
                      {(hasPermission('reports.read')) && (
                        <DropdownMenuItem onSelect={() => onContextAction?.('export_reports_csv')}>
                          <Download className="h-4 w-4 mr-2" />
                          Exportar reportes (CSV)
                        </DropdownMenuItem>
                      )}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <NotificationBell />
            </div>
          </div>
        </header>
        <main id="main-content" className={compact ? 'p-2' : 'p-4'}>
          {children}
        </main>
      </section>
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} onSearch={handleSearch} />
    </div>
  )
}