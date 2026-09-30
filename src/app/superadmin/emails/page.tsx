import { redirect } from 'next/navigation'

// Emails ahora son las pestañas «Mensajes enviados» y «Email» de Comunicaciones.
export default function SuperAdminEmailsPage() {
  redirect('/superadmin/communications?tab=messages')
}
