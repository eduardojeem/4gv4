import { redirect } from 'next/navigation'

// Notificaciones ahora es la pestaña «Avisos a tiendas» de Comunicaciones.
export default function SuperAdminNotificationsPage() {
  redirect('/superadmin/communications?tab=announcements')
}
