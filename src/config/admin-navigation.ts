import {
    LayoutDashboard,
    Users,
    Settings,
    Shield,
    Package,
    FileText,
    BarChart3,
    Globe,
    Monitor,
    Building2,
    CreditCard,
    type LucideIcon
} from 'lucide-react'

/**
 * Configuración de navegación del panel de administración
 * Centraliza todos los items de navegación con sus permisos y categorías
 */

export interface NavItem {
    key: string
    label: string
    icon: LucideIcon
    href?: string
    permissions?: string[]
    description?: string
    /** If true, only super_admin users can see and access this item */
    superAdminOnly?: boolean
}

export interface NavCategory {
    id: string
    label: string
    items: NavItem[]
    permissions?: string[] // Permisos requeridos para ver la categoría completa
}

/**
 * Categorías de navegación del admin panel
 * Agrupadas lógicamente por funcionalidad
 */
export const adminNavCategories: NavCategory[] = [
    {
        id: 'analytics',
        label: 'Análisis',
        items: [
            {
                key: 'overview',
                label: 'Resumen',
                icon: LayoutDashboard,
                href: '/admin',
                description: 'Vista general del sistema',
                permissions: [] // Accesible para todos los admins
            },
            {
                key: 'analytics',
                label: 'Analytics',
                icon: BarChart3,
                href: '/admin/analytics',
                description: 'Análisis avanzado de datos',
                permissions: ['analytics.read']
            }
        ]
    },
    {
        id: 'operations',
        label: 'Operaciones',
        items: [
            {
                key: 'cash-monitor',
                label: 'Monitor de Cajas',
                icon: Monitor,
                href: '/admin/cash-monitor',
                description: 'Control y monitoreo de cajas en tiempo real',
                permissions: [] // Visible para todos los admins
            },
            {
                key: 'inventory',
                label: 'Inventario',
                icon: Package,
                href: '/admin/inventory',
                description: 'Gestión de productos y stock',
                permissions: ['inventory.read']
            },
            {
                key: 'reports',
                label: 'Reportes',
                icon: FileText,
                href: '/admin/reports',
                description: 'Sistema de reportes',
                permissions: ['reports.read']
            }
        ]
    },
    {
        id: 'administration',
        label: 'Administración',
        items: [
            {
                key: 'users',
                label: 'Usuarios',
                icon: Users,
                href: '/admin/users',
                description: 'Gestión de usuarios y roles',
                permissions: ['users.read']
            },
            {
                key: 'branches',
                label: 'Sucursales',
                icon: Building2,
                href: '/admin/branches',
                description: 'Gestión multi sucursal y cobertura operativa',
                permissions: ['settings.read']
            },
            {
                key: 'subscriptions',
                label: 'Suscripcion',
                icon: CreditCard,
                href: '/admin/subscriptions',
                description: 'Plan, pagos, limites y facturacion',
                permissions: ['billing.manage']
            },
            {
                key: 'website',
                label: 'Sitio Web',
                icon: Globe,
                href: '/admin/website',
                description: 'Configuración del sitio web público',
                permissions: ['settings.read']
            },
            {
                key: 'security',
                label: 'Seguridad',
                icon: Shield,
                href: '/admin/security',
                description: 'Logs de seguridad y auditoría',
                permissions: ['settings.read']
            },
            {
                key: 'settings',
                label: 'Configuración',
                icon: Settings,
                href: '/admin/settings',
                description: 'Configuración del sistema',
                permissions: ['settings.read']
            }
        ]
    }
]

/**
 * Lista plana de todos los items de navegación (para compatibilidad)
 */
export const adminNavItems: NavItem[] = adminNavCategories.flatMap(
    category => category.items
)

/**
 * Obtiene un item de navegación por su key
 */
export function getNavItemByKey(key: string): NavItem | undefined {
    return adminNavItems.find(item => item.key === key)
}

/**
 * Obtiene la categoría de un item por su key
 */
export function getCategoryByItemKey(key: string): NavCategory | undefined {
    return adminNavCategories.find(category =>
        category.items.some(item => item.key === key)
    )
}

/**
 * Filtra items de navegación por permisos del usuario
 */
export function filterNavItemsByPermissions(
    items: NavItem[],
    hasPermission: (permission: string) => boolean,
    isAdmin: boolean,
    isSuperAdmin: boolean = false
): NavItem[] {
    return items.filter(item => {
        // Super-admin-only items: only visible to super_admin
        if (item.superAdminOnly && !isSuperAdmin) {
            return false
        }

        // Si es admin, permitir acceso al resto (ya pasó AdminGuard)
        if (isAdmin) {
            return true
        }

        // Si no hay permisos específicos, solo admins pueden ver
        if (!item.permissions || item.permissions.length === 0) {
            return false
        }

        // Si hay permisos específicos, verificar que el usuario los tenga
        return item.permissions.some(permission => hasPermission(permission))
    })
}

/**
 * Filtra categorías por permisos del usuario
 * Una categoría es visible si al menos uno de sus items es accesible
 */
export function filterCategoriesByPermissions(
    categories: NavCategory[],
    hasPermission: (permission: string) => boolean,
    isAdmin: boolean,
    isSuperAdmin: boolean = false
): NavCategory[] {
    return categories
        .map(category => ({
            ...category,
            items: filterNavItemsByPermissions(category.items, hasPermission, isAdmin, isSuperAdmin)
        }))
        .filter(category => category.items.length > 0)
}
