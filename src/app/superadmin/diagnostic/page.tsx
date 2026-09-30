import { redirect } from 'next/navigation'

// Diagnóstico se unificó con Salud del sistema (chequeos de integridad incluidos).
export default function SuperAdminDiagnosticPage() {
  redirect('/superadmin/system-health')
}
