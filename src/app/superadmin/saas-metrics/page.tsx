import { BarChart3, Boxes, Gauge, Puzzle } from 'lucide-react'
import { SuperAdminSectionPage } from '@/components/superadmin/superadmin-section-page'

export default function SuperAdminSaaSMetricsPage() {
  return (
    <SuperAdminSectionPage
      title="Metricas SaaS"
      description="Consumo de planes, limites, modulos activos, uso operativo y alertas de capacidad por empresa."
      primaryActionLabel="Ver analiticas"
      primaryActionHref="/superadmin/analytics"
      stats={[
        { label: 'Uso global', value: '0%', helper: 'Pendiente de usage tables', icon: Gauge, tone: 'blue' },
        { label: 'Modulos', value: '7', helper: 'Inventario, POS, repairs y mas', icon: Puzzle, tone: 'violet' },
        { label: 'Productos', value: 'Tenant', helper: 'Limites por plan', icon: Boxes, tone: 'emerald' },
        { label: 'Reportes', value: 'Listo', helper: 'Integrado a analytics', icon: BarChart3, tone: 'amber' },
      ]}
      actions={[
        { title: 'Uso por plan', description: 'Comparar consumo real contra limites definidos en el plan.', status: 'Preparado' },
        { title: 'Modulos activos', description: 'Detectar adopcion de POS, inventario, reparaciones, ecommerce y WhatsApp.', status: 'Preparado' },
        { title: 'Alertas de limite', description: 'Base para avisar cuando un tenant llega al 80% o 100% de su plan.', status: 'Preparado' },
      ]}
      tableTitle="Indicadores de consumo"
      tableDescription="Vista SaaS igual al estilo ZIP para sumar tablas de usage progresivamente."
      tableItems={[
        { title: 'Usuarios activos', description: 'Miembros activos por organizacion contra limite del plan.', status: 'Pendiente', meta: 'organization_members' },
        { title: 'Productos creados', description: 'Cantidad de productos por tenant contra cuota.', status: 'Pendiente', meta: 'products' },
        { title: 'Sucursales', description: 'Branches por empresa para validar upgrades.', status: 'Pendiente', meta: 'branches' },
      ]}
    />
  )
}
