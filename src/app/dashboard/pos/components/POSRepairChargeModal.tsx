'use client'

import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Wrench,
  Search,
  User,
  Smartphone, Plus, Loader2, AlertTriangle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { toast } from 'sonner'
import type { CartItem } from '../types'
import { useBranch } from '@/contexts/branch-context'
import { usePOSRepairSearch } from '../hooks/usePOSRepairSearch'
import { getRepairChargeability } from '../lib/repair-charge'

export interface RepairItemData {
  id: string
  customer_id?: string | null
  ticket_number: string | number
  customer_name?: string | null
  customer_phone?: string | null
  device_brand?: string | null
  device_model?: string | null
  problem_description?: string | null
  status: string
  final_cost?: number | null
  estimated_cost?: number | null
  paid_amount?: number | null
  payment_status?: string | null
  qualityCheck?: { result?: string | null } | Array<{ result?: string | null }> | null
  created_at: string
}

interface POSRepairChargeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Se pasa tambien la reparacion: el carrito la necesita para armar la
   *  linea aunque el equipo no sea del cliente activo del POS. */
  onAddRepairToCart: (item: CartItem, repair: RepairItemData) => void
}

/**
 * Estados en los que el servidor acepta cerrar la reparacion.
 *
 * `process_pos_sale_atomic` rechaza con REPAIR_DELIVERY_INVALID_STATE cualquier
 * equipo que no este listo. Ofrecer el boton igual hacia fallar la venta entera
 * recien al confirmar el pago, con el codigo crudo en pantalla.
 */
const READY_STATUSES = ['listo', 'ready_for_pickup', 'completed']

function isRepairReady(status: string) {
  return READY_STATUSES.includes(String(status ?? '').trim().toLowerCase())
}

/** Que le falta al equipo, dicho en el idioma del mostrador. */
function notReadyReason(status: string) {
  const normalized = String(status ?? '').trim().toLowerCase()
  if (normalized === 'recibido' || normalized === 'pending') {
    return 'El equipo está recibido pero todavía no se diagnosticó.'
  }
  if (normalized === 'diagnostico') {
    return 'El equipo está en diagnóstico: falta presupuestar y reparar.'
  }
  if (normalized === 'reparacion' || normalized === 'in_progress') {
    return 'El equipo está en reparación y todavía no se terminó.'
  }
  return 'El equipo todavía no está listo para entregar.'
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  'completed': { label: 'Completada', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' },
  'ready_for_pickup': { label: 'Lista para Retirar', color: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300' },
  'listo': { label: 'Lista para Retirar', color: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300' },
  'in_progress': { label: 'En Reparación', color: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' },
  'reparacion': { label: 'En Reparación', color: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' },
  'diagnostico': { label: 'En Diagnóstico', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300' },
  'pending': { label: 'Recibida', color: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300' },
  'recibido': { label: 'Recibida', color: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300' },
}

export function POSRepairChargeModal({
  open,
  onOpenChange,
  onAddRepairToCart
}: POSRepairChargeModalProps) {
  const { selectedBranchId } = useBranch()
  const [searchTerm, setSearchTerm] = useState('')
  const search = usePOSRepairSearch({ open, branchId: selectedBranchId, search: searchTerm })
  const repairs = search.repairs.map((row) => {
    const customer = row.customer && typeof row.customer === 'object'
      ? row.customer as Record<string, unknown>
      : null
    return {
      ...row,
      ticket_number: row.ticket_number || row.id.slice(0, 6).toUpperCase(),
      customer_name: String(customer?.name || [customer?.first_name, customer?.last_name].filter(Boolean).join(' ') || row.customer_name || 'Cliente'),
      customer_phone: String(customer?.phone || row.customer_phone || ''),
      status: String(row.status || 'recibido'),
      created_at: String(row.created_at || new Date().toISOString()),
    } as RepairItemData
  })

  const handleSelectRepair = (repair: RepairItemData) => {
    const totalCost = Number(repair.final_cost ?? repair.estimated_cost ?? 0)
    const paidAmount = Number(repair.paid_amount || 0)
    const chargeability = getRepairChargeability(repair)
    if (!chargeability.canCharge) {
      toast.info('Esta reparación ya está 100% pagada', {
        description: `Total: ${formatCurrency(totalCost)} | Abonado: ${formatCurrency(paidAmount)}`
      })
      return
    }

    const deviceName = `${repair.device_brand || ''} ${repair.device_model || 'Equipo'}`.trim()
    const ticketLabel = repair.ticket_number ? `#${repair.ticket_number}` : 'Taller'

    const cartItem: CartItem = {
      id: `repair_${repair.id}`,
      name: `Reparación ${ticketLabel} - ${deviceName}`,
      price: chargeability.balanceDue,
      quantity: 1,
      stock: 999,
      subtotal: chargeability.balanceDue,
      isService: true,
      sku: `REP-${repair.ticket_number || repair.id.substring(0, 6)}`
    }

    onAddRepairToCart(cartItem, repair)
    toast.success('Reparación agregada al carrito', {
      description: `${cartItem.name} — ${formatCurrency(cartItem.price)}`
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Cobrar Reparación en POS</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Busca una orden de servicio técnico para sumar su saldo pendiente al ticket de venta
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-4">
          {/* Search box */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por N° Ticket, cliente, teléfono o modelo de equipo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10"
              autoFocus
            />
          </div>

          {/* Results */}
          {search.status === 'loading' && repairs.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground flex flex-col items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-sm">Buscando reparaciones activas...</span>
            </div>
          ) : search.status === 'error' ? (
            <div className="py-12 text-center" role="alert">
              <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-destructive" />
              <p className="text-sm font-medium">No se pudieron cargar las reparaciones</p>
              <p className="mt-1 text-xs text-muted-foreground">{search.error}</p>
              <Button className="mt-4" size="sm" variant="outline" onClick={search.retry}>Reintentar</Button>
            </div>
          ) : repairs.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Smartphone className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium">No se encontraron reparaciones pendientes</p>
              <p className="text-xs text-muted-foreground mt-1">Prueba buscando con otro término o número de ticket.</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[50vh] pr-2">
              <div className="space-y-2.5">
                {repairs.map((repair) => {
                  const paidAmount = Number(repair.paid_amount || 0)
                  const chargeability = getRepairChargeability(repair)
                  const statusMeta = STATUS_LABELS[repair.status] || { label: repair.status, color: 'bg-muted text-foreground' }
                  const ready = isRepairReady(repair.status)

                  return (
                    <div
                      key={repair.id}
                      className={cn(
                        'p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all',
                        ready
                          ? 'border-border/70 bg-card hover:border-indigo-500/40 hover:bg-muted/20'
                          : 'border-border/50 bg-muted/30 opacity-75',
                      )}
                    >
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-foreground">
                            Ticket #{repair.ticket_number}
                          </span>
                          <Badge variant="secondary" className={`text-[10px] ${statusMeta.color}`}>
                            {statusMeta.label}
                          </Badge>
                          <span className="text-xs font-medium text-foreground truncate">
                            {repair.device_brand} {repair.device_model}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {repair.customer_name || 'Sin cliente asignado'}
                          </span>
                          {repair.customer_phone && (
                            <span>Tel: {repair.customer_phone}</span>
                          )}
                        </div>

                        {repair.problem_description && (
                          <p className="text-xs text-muted-foreground/80 line-clamp-1">
                            Falla: {repair.problem_description}
                          </p>
                        )}

                        {!ready && (
                          <p className="flex items-start gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                            {notReadyReason(repair.status)}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center sm:flex-col sm:items-end justify-between sm:justify-center gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">Saldo pendiente</div>
                          <div className="text-base font-bold text-indigo-600 dark:text-indigo-400">
                            {formatCurrency(chargeability.balanceDue)}
                          </div>
                          {paidAmount > 0 && (
                            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                              Seña abonada: {formatCurrency(paidAmount)}
                            </div>
                          )}
                        </div>

                        <Button
                          size="sm"
                          disabled={!chargeability.canCharge}
                          className={cn(
                            'h-8 gap-1.5 text-xs shadow-sm',
                            chargeability.canCharge && 'bg-indigo-600 hover:bg-indigo-700 text-white',
                          )}
                          variant={chargeability.canCharge ? 'default' : 'outline'}
                          title={chargeability.reason}
                          onClick={() => handleSelectRepair(repair)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          {!chargeability.canCharge
                            ? 'Sin saldo pendiente'
                            : ready ? 'Cobrar saldo' : 'Cobrar sin entregar'}
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
              {search.pagination.totalPages > 1 && (
                <div className="mt-3 flex items-center justify-between border-t pt-3">
                  <Button size="sm" variant="outline" onClick={search.previousPage} disabled={search.pagination.page <= 1}>
                    Anterior
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Página {search.pagination.page} de {search.pagination.totalPages}
                  </span>
                  <Button size="sm" variant="outline" onClick={search.nextPage} disabled={search.pagination.page >= search.pagination.totalPages}>
                    Siguiente
                  </Button>
                </div>
              )}
            </ScrollArea>
          )}
        </div>

        <DialogFooter className="px-6 py-3 border-t bg-muted/20">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
