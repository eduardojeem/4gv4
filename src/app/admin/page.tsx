'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NotificationBell } from '@/components/ui/notification-bell'
import { GlobalSearch } from '@/components/ui/global-search'
import { SalesChart } from '@/components/dashboard/sales-chart'
import { RepairsChart } from '@/components/dashboard/repairs-chart'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { LayoutDashboard, Users, Package, Shield, Search, Move, Globe } from 'lucide-react'

type QuickLink = {
  title: string
  description: string
  href: string
  color: string
  icon: React.ComponentType<{ className?: string }>
}

export default function AdminHome() {
  const defaultLinks: QuickLink[] = useMemo(() => ([
    { title: 'Dashboard Completo', description: 'Vista completa del panel', icon: LayoutDashboard, href: '/admin', color: 'text-blue-500' },
    { title: 'Usuarios', description: 'Gestión de usuarios y permisos', icon: Users, href: '/admin/users', color: 'text-green-500' },
    { title: 'Sitio Web', description: 'Configuración del sitio público', icon: Globe, href: '/admin/website', color: 'text-cyan-500' },
    { title: 'Inventario', description: 'Control de productos y stock', icon: Package, href: '/admin/inventory', color: 'text-purple-500' },
    { title: 'Seguridad', description: 'Logs de auditoría y seguridad', icon: Shield, href: '/admin/security', color: 'text-red-500' },
  ]), [])

  const [quickLinks, setQuickLinks] = useState<QuickLink[]>(defaultLinks)
  const [searchOpen, setSearchOpen] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('admin-quick-links')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length) setQuickLinks(parsed)
      }
    } catch { }
  }, [])

  const saveLinks = (links: QuickLink[]) => {
    setQuickLinks(links)
    try { localStorage.setItem('admin-quick-links', JSON.stringify(links)) } catch { }
  }

  const onDragStart = (index: number) => setDragIndex(index)
  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => e.preventDefault()
  const onDrop = (index: number) => {
    if (dragIndex === null || dragIndex === index) return
    const next = [...quickLinks]
    const [moved] = next.splice(dragIndex, 1)
    next.splice(index, 0, moved)
    saveLinks(next)
    setDragIndex(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Panel de Administración</h1>
          <p className="text-muted-foreground mt-2">Gestiona el sistema de forma eficiente</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setSearchOpen(true)} aria-label="Buscar">
            <Search className="h-4 w-4 mr-2" /> Buscar
          </Button>
          <ThemeToggle />
          <NotificationBell />
        </div>
      </div>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} onSearch={() => []} />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {quickLinks.map((link, idx) => {
          const Icon = link.icon
          return (
            <div
              key={link.href}
              draggable
              onDragStart={() => onDragStart(idx)}
              onDragOver={onDragOver}
              onDrop={() => onDrop(idx)}
              className="cursor-move"
              title="Arrastrar para reordenar"
            >
              <Link href={link.href}>
                <Card className="hover:shadow-lg transition-shadow h-full">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Icon className={`h-5 w-5 ${link.color}`} />
                      <CardTitle className="text-lg">{link.title}</CardTitle>
                      <Move className="ml-auto h-4 w-4 text-muted-foreground" />
                    </div>
                    <CardDescription>{link.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            </div>
          )
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle>Métricas de Ventas</CardTitle>
            <CardDescription>Tendencias de la última semana</CardDescription>
          </CardHeader>
          <CardContent>
            <SalesChart />
          </CardContent>
        </Card>

        <Card className="border-emerald-200">
          <CardHeader>
            <CardTitle>Estado de Reparaciones</CardTitle>
            <CardDescription>Distribución por etapa</CardDescription>
          </CardHeader>
          <CardContent>
            <RepairsChart />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Acceso Rápido</CardTitle>
          <CardDescription>Consejos para mejorar tu flujo</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Input placeholder="Atajo: Ctrl+K abre búsqueda global" readOnly className="max-w-sm" />
            <Button variant="outline" asChild>
              <Link href="/admin">Abrir Panel Avanzado</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
