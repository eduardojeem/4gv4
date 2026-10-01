import { redirect } from 'next/navigation'

/**
 * «Configuración tenants» era una copia, solo para leer, de la configuración
 * del sistema (/superadmin/settings) y de los planes (/superadmin/plans): cada
 * «Editar» llevaba allá y contaba filas de `organization_settings` como si
 * fueran organizaciones. La dirección vieja sigue funcionando.
 */
export default function SuperAdminOrganizationSettingsPage() {
  redirect('/superadmin/settings')
}
