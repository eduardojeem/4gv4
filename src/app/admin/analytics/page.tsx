import { Suspense } from 'react'
import AnalyticsDashboard from '@/components/admin/reports/analytics-dashboard'
import { PlanGate } from '@/components/admin/PlanGate'

export default function AnalyticsPage() {
    return (
        <div className="space-y-6">
            <PlanGate
                module="analytics"
                requiredPlan="Pro"
                title="Analytics avanzado"
                description="El dashboard de analítica está disponible desde el plan Pro. Subí tu plan para desbloquear métricas, tendencias y rankings."
            >
                <Suspense fallback={<div className="p-4">Cargando analytics...</div>}>
                    <AnalyticsDashboard />
                </Suspense>
            </PlanGate>
        </div>
    )
}
