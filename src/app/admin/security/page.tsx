import { Suspense } from 'react'
import { SecurityPanel } from '@/components/admin/system/security-panel'

export default function SecurityPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<div className="p-4">Cargando panel de seguridad...</div>}>
        <SecurityPanel />
      </Suspense>
    </div>
  )
}
