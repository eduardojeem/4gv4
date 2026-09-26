'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { EmptyState } from '@/components/ui/empty-state'
import { useProductAlerts } from '@/hooks/useProductAlerts'
import { AlertTriangle, CheckCircle, Loader2, RefreshCw, XCircle } from 'lucide-react'

interface InventoryAlertsPanelProps {
  branchName?: string | null
  onRestock: (productId: string) => void
}

/**
 * Las alertas salen de `product_alerts`, la tabla que un trigger sobre
 * `branch_inventory` mantiene al dia por sucursal.
 *
 * Antes esta pestaña filtraba en memoria el array de productos de la PAGINA
 * ACTUAL: «Productos Agotados (2)» con trescientos agotados en la empresa. Y
 * mientras tanto «Stock por sucursal», a dos clics, ya leia la tabla real: dos
 * sistemas de alertas en la misma pantalla dando numeros distintos.
 */
export function InventoryAlertsPanel({ branchName, onRestock }: InventoryAlertsPanelProps) {
  const { alerts, isLoading, error, refreshAlerts, resolveAlert } = useProductAlerts()

  const { outOfStock, lowStock } = useMemo(() => ({
    outOfStock: alerts.filter((alert) => alert.alert_type === 'out_of_stock'),
    lowStock: alerts.filter((alert) => alert.alert_type === 'low_stock'),
  }), [alerts])

  const alcance = branchName ? `En ${branchName}` : 'En toda la empresa'

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando alertas...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert className="border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/20">
          <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
          <AlertDescription className="flex flex-wrap items-center gap-3 text-rose-800 dark:text-rose-300">
            <span>{error}</span>
            <Button variant="outline" size="sm" className="h-7 rounded-lg text-xs" onClick={() => refreshAlerts()}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {alcance}. Se recalculan solas cuando cambia el stock.
        </p>
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => refreshAlerts()}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Actualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <AlertColumn
          tone="critical"
          icon={XCircle}
          title="Sin stock"
          description="No hay unidades disponibles para vender"
          emptyLabel="Ningún producto sin stock"
          alerts={outOfStock}
          onRestock={onRestock}
          onResolve={resolveAlert}
        />
        <AlertColumn
          tone="warning"
          icon={AlertTriangle}
          title="Stock bajo"
          description="En o por debajo del mínimo configurado"
          emptyLabel="Ningún producto por debajo del mínimo"
          alerts={lowStock}
          onRestock={onRestock}
          onResolve={resolveAlert}
        />
      </div>
    </div>
  )
}

interface AlertColumnProps {
  tone: 'critical' | 'warning'
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  emptyLabel: string
  alerts: ReturnType<typeof useProductAlerts>['alerts']
  onRestock: (productId: string) => void
  onResolve: (alertId: string) => void
}

function AlertColumn({
  tone,
  icon: Icon,
  title,
  description,
  emptyLabel,
  alerts,
  onRestock,
  onResolve,
}: AlertColumnProps) {
  const critical = tone === 'critical'

  return (
    <Card className="overflow-hidden border-border bg-card">
      <CardHeader className="border-b border-border bg-muted/40 py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Icon className={critical ? 'h-4 w-4 shrink-0 text-rose-500' : 'h-4 w-4 shrink-0 text-amber-500'} />
          {title}
          <Badge variant="secondary" className="ml-auto rounded-md tabular-nums">{alerts.length}</Badge>
        </CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="max-h-[420px] space-y-2 overflow-y-auto p-3">
        {alerts.length === 0 ? (
          <EmptyState icon={CheckCircle} title={emptyLabel} description="" className="py-8" />
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {alert.product?.name || alert.message}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                  Stock {alert.product?.stock_quantity ?? 0}
                  {alert.product?.min_stock ? ` · mínimo ${alert.product.min_stock}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg text-xs"
                  onClick={() => onRestock(alert.product_id)}
                >
                  Reponer
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 rounded-lg text-xs text-muted-foreground"
                  onClick={() => onResolve(alert.id)}
                  title="Marcar como vista"
                >
                  Descartar
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

export default InventoryAlertsPanel
