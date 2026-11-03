'use client'
import { useTenantScope } from '@/hooks/use-tenant-scope'
import { OrdersDashboard } from './OrdersDashboard'

/** A browser may have a different active business than the native app. */
export function NewOrderEntry({ expectedOrganizationId }: { expectedOrganizationId?: string }) {
  const { organizationId, scope } = useTenantScope()
  if (!organizationId) return <p className="p-6">Cargando tu negocio…</p>
  if (expectedOrganizationId && expectedOrganizationId !== organizationId) return <div className="p-6 space-y-3"><h1 className="text-xl font-semibold">Seleccioná el mismo negocio que en la app</h1><p>El navegador tiene otro negocio activo. Cambialo desde el selector superior para continuar con el pedido.</p></div>
  return <OrdersDashboard key={scope} initialCreateOpen />
}
