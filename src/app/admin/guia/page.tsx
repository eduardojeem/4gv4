import type { Metadata } from 'next'
import { GuideView } from '@/components/admin/guide/GuideView'

export const metadata: Metadata = {
  title: 'Guía del sistema',
  description: 'Cómo funciona cada sección del panel, con ejemplos, y los primeros pasos de una cuenta nueva.',
}

export default function AdminGuidePage() {
  return <GuideView />
}
