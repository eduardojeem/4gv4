import {
    LayoutDashboard,
    Users,
    Settings,
    Shield,
    Package,
    FileText,
    BarChart3,
    Database,
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
                key: 'database-monitoring',
                label: 'Monitoreo BD',
                icon: Database,
                href: '/admin/database-monitoring',
                description: 'Monitoreo de base de datos y rendimiento',
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
    isAdmin: boolean
): NavItem[] {
    return items.filter(item => {
        // Si es admin y no hay permisos específicos, permitir acceso
        if (isAdmin && (!item.permissions || item.permissions.length === 0)) {
            return true
        }

        // Si hay permisos específicos, verificar que el usuario los tenga
        if (item.permissions && item.permissions.length > 0) {
            return item.permissions.some(permission => hasPermission(permission))
        }

        return isAdmin
    })
}

/**
 * Filtra categorías por permisos del usuario
 * Una categoría es visible si al menos uno de sus items es accesible
 */
export function filterCategoriesByPermissions(
    categories: NavCategory[],
    hasPermission: (permission: string) => boolean,
    isAdmin: boolean
): NavCategory[] {
    return categories
        .map(category => ({
            ...category,
            items: filterNavItemsByPermissions(category.items, hasPermission, isAdmin)
        }))
        .filter(category => category.items.length > 0)
}
