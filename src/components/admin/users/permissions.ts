export const PERMISSION_GROUPS = [
  {
    id: 'sales',
    label: 'Ventas y Caja',
    permissions: [
      { id: 'pos_access', label: 'Acceso a POS' },
      { id: 'process_sale', label: 'Procesar Ventas' },
      { id: 'view_sales', label: 'Ver Historial de Ventas' },
      { id: 'apply_discount', label: 'Aplicar Descuentos' },
      { id: 'cash_close', label: 'Realizar Cierre de Caja' },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventario y Productos',
    permissions: [
      { id: 'view_inventory', label: 'Ver Inventario' },
      { id: 'manage_products', label: 'Crear/Editar Productos' },
      { id: 'adjust_stock', label: 'Ajustar Stock' },
      { id: 'manage_categories', label: 'Gestionar Categorías' },
    ],
  },
  {
    id: 'admin',
    label: 'Administración',
    permissions: [
      { id: 'manage_users', label: 'Gestionar Usuarios' },
      { id: 'view_reports', label: 'Ver Reportes Financieros' },
      { id: 'system_settings', label: 'Configuración del Sistema' },
    ],
  },
]

