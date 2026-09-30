import { redirect } from 'next/navigation'

// La limpieza de archivos ahora es una pestaña de Mantenimiento.
export default function StorageCleanupPage() {
  redirect('/superadmin/maintenance?tab=storage')
}
