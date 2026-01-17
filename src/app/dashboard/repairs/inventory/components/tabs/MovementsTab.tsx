"use client"

import { useEffect } from 'react'
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
import { RefreshCw } from 'lucide-react'
import { useInventory } from '../../context/InventoryContext'

export function MovementsTab() {
  const { movements, loading } = useInventory()

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Movimientos Recientes</CardTitle>
            <CardDescription>Historial de entradas y salidas de inventario</CardDescription>
          </div>
          <Button variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
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
                    {loading ? "Cargando movimientos..." : "No hay movimientos registrados recientes."}
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
                      <Badge 
                        className={
                          mov.movement_type === 'in' 
                            ? 'bg-green-500 hover:bg-green-600 text-white' 
                            : mov.movement_type === 'out' 
                            ? 'bg-red-500 hover:bg-red-600 text-white' 
                            : 'bg-blue-500 hover:bg-blue-600 text-white'
                        }
                      >
                        {mov.movement_type === 'in' ? '↑ Entrada' : mov.movement_type === 'out' ? '↓ Salida' : mov.movement_type}
                      </Badge>
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
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate" title={mov.reason}>
                      {mov.reason || "-"}
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
