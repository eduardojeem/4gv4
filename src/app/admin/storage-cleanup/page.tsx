import type { Metadata } from 'next'
import { StorageCleanupPanel } from '@/components/admin/system/storage-cleanup-panel'

export const metadata: Metadata = {
  title: 'Storage Cleanup | Admin',
  description: 'Analiza archivos huerfanos y ejecuta limpieza controlada del storage operativo.',
}

export default function StorageCleanupPage() {
  return <StorageCleanupPanel />
}
