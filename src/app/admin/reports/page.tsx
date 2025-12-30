import { Suspense } from 'react'
import ReportsSystem from '@/components/admin/reports/reports-system'

export default function ReportsPage() {
    return (
        <div className="space-y-6">
            <Suspense fallback={<div className="p-4">Cargando sistema de reportes...</div>}>
                <ReportsSystem />
            </Suspense>
        </div>
    )
}
