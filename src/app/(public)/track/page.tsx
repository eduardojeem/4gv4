import type { Metadata } from 'next'
import { TrackPageContent } from './TrackPageContent'

export const metadata: Metadata = {
  title: 'Seguimiento de pedido',
  description: 'Consulta pública del estado de pedidos por empresa.',
}

export default async function TrackPage() {
  return <TrackPageContent />
}
