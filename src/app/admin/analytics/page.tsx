import { Suspense } from 'react'
import AnalyticsDashboard from '@/components/admin/reports/analytics-dashboard'

export default function AnalyticsPage() {
    return (
        <div className="space-y-6">
            <Suspense fallback={<div className="p-4">Cargando analytics...</div>}>
                <AnalyticsDashboard />
            </Suspense>
        </div>
    )
}
