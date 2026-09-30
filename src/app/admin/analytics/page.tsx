import { Suspense } from 'react'
import AnalyticsDashboard from '@/components/admin/reports/analytics-dashboard'
import { PlanGate } from '@/components/admin/PlanGate'

export default function AnalyticsPage() {
    return (
        <div className="space-y-6">
            <PlanGate
                module="analytics"
                title="Analytics avanzado"
                description="Métricas, tendencias y rankings de tu negocio."
            >
                <Suspense fallback={<div className="p-4">Cargando analytics...</div>}>
                    <AnalyticsDashboard />
                </Suspense>
            </PlanGate>
        </div>
    )
}
