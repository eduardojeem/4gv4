'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import {
  LayoutDashboard,
  Users,
  Package,
  Wrench,
  ShoppingCart,
  BarChart3,
  Settings,
} from 'lucide-react'

type QuickNavItem = {
  title: string
  href: string
  description: string
  icon: React.ElementType
  color: string
}

const items: QuickNavItem[] = [
  { 
    title: 'Clientes', 
    href: '/dashboard/customers', 
    description: 'Gestión de clientes y CRM', 
    icon: Users,
    color: 'from-blue-500 to-blue-600'
  },
  { 
    title: 'Productos', 
    href: '/dashboard/products', 
    description: 'Inventario y catálogo', 
    icon: Package,
    color: 'from-emerald-500 to-emerald-600'
  },
  { 
    title: 'Reparaciones', 
    href: '/dashboard/repairs', 
    description: 'Órdenes de reparación', 
    icon: Wrench,
    color: 'from-amber-500 to-amber-600'
  },
  { 
    title: 'Punto de Venta', 
    href: '/dashboard/pos', 
    description: 'Ventas y tickets', 
    icon: ShoppingCart,
    color: 'from-purple-500 to-purple-600'
  },
  { 
    title: 'Reportes', 
    href: '/dashboard/reports', 
    description: 'Métricas y análisis', 
    icon: BarChart3,
    color: 'from-indigo-500 to-indigo-600'
  },
  { 
    title: 'Configuración', 
    href: '/dashboard/settings', 
    description: 'Preferencias del sistema', 
    icon: Settings,
    color: 'from-slate-500 to-slate-600'
  },
]

export function QuickNav({ className }: { className?: string }) {
  return (
    <section aria-labelledby="quick-nav-title" className={cn('space-y-6', className)}>
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
          <LayoutDashboard className="h-5 w-5 text-white" aria-hidden="true" />
        </div>
        <div>
          <h2 id="quick-nav-title" className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Navegación Rápida
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Accede rápidamente a las secciones principales
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" role="list" aria-label="Accesos rápidos del dashboard">
        {items.map(({ title, href, description, icon: Icon, color }) => (
          <Link key={href} href={href} aria-label={`${title}: ${description}`} className="group block">
            <Card className="relative overflow-hidden border-0 shadow-sm bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm hover:shadow-lg transition-all duration-200 hover:scale-[1.02]">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-3 bg-gradient-to-r ${color} rounded-xl shadow-sm`}>
                    <Icon className="h-5 w-5 text-white" aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {title}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
                      {description}
                    </p>
                  </div>
                </div>
                
                {/* Subtle gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-blue-50/20 dark:to-blue-900/20 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  )
}

export default QuickNav