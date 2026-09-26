import { permanentRedirect } from 'next/navigation'

export default function LegacyReportsPage() {
  permanentRedirect('/admin/reports')
}
