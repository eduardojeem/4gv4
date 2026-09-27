import { permanentRedirect } from 'next/navigation'

export default function LegacyProductReportsPage() {
  permanentRedirect('/admin/reports/products')
}
