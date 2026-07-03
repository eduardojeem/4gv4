"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { useInventory } from '../../context/InventoryContext'
import { formatMovementType } from '../../lib/movement-format'

export function MovementsTab() {
  const { movements, movementsLoading, loadMovements } = useInventory()

  // Cargar movimientos al montar la pestaña.
  useEffect(() => {
    loadMovements()
  }, [loadMovements])

  return (
    <Card className="bg-background/50 backdrop-blur-xl border border-border/50 shadow-sm overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-orange-500/5 pointer-events-none" />
      <CardHeader className="relative z-10 border-b border-border/30 pb-4">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent flex items-center gap-2">
              <span className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <RefreshCw className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </span>
              Movimientos Recientes
            </CardTitle>
            <CardDescription>Historial de entradas y salidas de inventario</CardDescription>
          </div>
          <Button variant="outline" size="sm" disabled={movementsLoading} onClick={() => loadMovements()}>
            <RefreshCw className={`h-4 w-4 mr-2 ${movementsLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Cantidad</TableHead>
                <TableHead>Stock Final</TableHead>
                <TableHead>Motivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {movementsLoading ? "Cargando movimientos..." : "No hay movimientos registrados recientes."}
                  </TableCell>
                </TableRow>
              ) : (
                movements.map((mov) => (
                  <TableRow key={mov.id} className="hover:bg-muted/50 transition-colors">
                    <TableCell className="text-sm">
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {new Date(mov.created_at).toLocaleDateString()}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(mov.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{mov.product?.name || "Producto Eliminado"}</span>
                        {mov.product?.sku && (
                          <span className="text-xs text-muted-foreground font-mono">
                            {mov.product.sku}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const { label, className } = formatMovementType(mov.movement_type)
                        return <Badge className={className}>{label}</Badge>
                      })()}
                    </TableCell>
                    <TableCell>
                      <span className={`font-bold ${
                        mov.quantity > 0 
                          ? "text-green-600 dark:text-green-400" 
                          : "text-red-600 dark:text-red-400"
                      }`}>
                        {mov.quantity > 0 ? "+" : ""}{mov.quantity}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold text-blue-600 dark:text-blue-400">
                        {mov.new_stock}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate" title={mov.notes || ''}>
                      {mov.notes || "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
