import { PERMISSIONS as ALL } from '@/lib/auth/roles-permissions'

const LABELS: Record<string,string> = {
  products: 'Productos',
  inventory: 'Inventario',
  reports: 'Reportes',
  users: 'Usuarios',
  settings: 'Configuración',
  promotions: 'Promociones',
  pos: 'Punto de Venta',
  prices: 'Precios',
  customers: 'Clientes',
  orders: 'Pedidos',
  credits: 'Créditos',
  repairs: 'Reparaciones',
}

const grouped: Record<string, { id: string; label: string; permissions: { id: string; label: string }[] }> = {}

Object.values(ALL).forEach(p => {
  if (!grouped[p.resource]) {
    grouped[p.resource] = {
      id: p.resource,
      label: LABELS[p.resource] || p.resource,
      permissions: []
    }
  }
  grouped[p.resource].permissions.push({ id: p.id, label: p.name })
})

export const PERMISSION_GROUPS = Object.values(grouped)
