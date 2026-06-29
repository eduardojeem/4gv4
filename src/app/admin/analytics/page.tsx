import { Suspense } from 'react'
import AnalyticsDashboard from '@/components/admin/reports/analytics-dashboard'
import { PlanGate } from '@/components/admin/PlanGate'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Info } from 'lucide-react'

export default function AnalyticsPage() {
    return (
        <div className="space-y-6">
            {/* Guía de funcionamiento de analítica */}
            <Card className="bg-gradient-to-br from-blue-500/5 to-purple-500/5 border border-blue-100/50 dark:border-blue-950/20 backdrop-blur-md">
                <details className="group">
                    <summary className="list-none cursor-pointer [&::-webkit-details-marker]:hidden flex items-center justify-between p-5 pb-3">
                        <div className="text-md font-bold flex items-center gap-2 text-blue-700 dark:text-blue-400">
                            <Info className="h-4.5 w-4.5" /> ¿Cómo funciona la Analítica Avanzada?
                        </div>
                        <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 select-none">
                            <span className="group-open:hidden flex items-center gap-1">Mostrar guía ↓</span>
                            <span className="hidden group-open:flex items-center gap-1">Ocultar guía ↑</span>
                        </div>
                    </summary>
                    <CardContent className="pt-0 pb-5 text-xs">
                        <div className="grid gap-4 sm:grid-cols-3">
                            <div className="space-y-1.5 p-3.5 rounded-xl bg-background/60 border border-border/40 backdrop-blur-sm">
                                <h4 className="font-semibold text-foreground flex items-center gap-1.5">
                                    <Badge variant="secondary" className="h-4.5 w-4.5 p-0 flex items-center justify-center rounded-full text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">1</Badge>
                                    Métricas en Tiempo Real
                                </h4>
                                <p className="text-muted-foreground leading-relaxed">
                                    Monitorea la facturación diaria, el margen de ganancia real y el ticket promedio consolidado de todas tus sucursales de forma instantánea.
                                </p>
                            </div>
                            <div className="space-y-1.5 p-3.5 rounded-xl bg-background/60 border border-border/40 backdrop-blur-sm">
                                <h4 className="font-semibold text-foreground flex items-center gap-2">
                                    <Badge variant="secondary" className="h-4.5 w-4.5 p-0 flex items-center justify-center rounded-full text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">2</Badge>
                                    Tendencias e Históricos
                                </h4>
                                <p className="text-muted-foreground leading-relaxed">
                                    Analiza el rendimiento del negocio mediante comparativas mensuales. Detecta estacionalidad en ventas y la velocidad de rotación de tu inventario.
                                </p>
                            </div>
                            <div className="space-y-1.5 p-3.5 rounded-xl bg-background/60 border border-border/40 backdrop-blur-sm">
                                <h4 className="font-semibold text-foreground flex items-center gap-2">
                                    <Badge variant="secondary" className="h-4.5 w-4.5 p-0 flex items-center justify-center rounded-full text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">3</Badge>
                                    Rankings de Desempeño
                                </h4>
                                <p className="text-muted-foreground leading-relaxed">
                                    Identifica rápidamente cuáles son tus sucursales más rentables, los técnicos con mayor tasa de éxito de reparación y los repuestos más solicitados.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </details>
            </Card>

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
