'use client'

import React, { useState, useEffect } from 'react'
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
  Smartphone, 
  DollarSign, 
  Plus, 
  CheckCircle2, 
  Clock, 
  Loader2,
  AlertCircle
} from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { CartItem } from '../types'

interface RepairItemData {
  id: string
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
  created_at: string
}

interface POSRepairChargeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddRepairToCart: (item: CartItem) => void
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
  const supabase = React.useMemo(() => createClient(), [])
  const [searchTerm, setSearchTerm] = useState('')
  const [repairs, setRepairs] = useState<RepairItemData[]>([])
  const [loading, setLoading] = useState(false)

  // Fetch pending / ready repairs on open
  useEffect(() => {
    if (!open) return

    async function loadRepairs() {
      setLoading(true)
      try {
        // 1. Intentar por endpoint API primero (maneja branches, joins y permisos)
        const response = await fetch('/api/repairs?pageSize=50', {
          headers: { 'Content-Type': 'application/json' }
        }).catch(() => null)

        if (response && response.ok) {
          const res = await response.json().catch(() => null)
          if (res && Array.isArray(res.repairs)) {
            const mapped: RepairItemData[] = res.repairs
              .filter((r: any) => r.status !== 'delivered' && r.status !== 'cancelled' && r.status !== 'entregado')
              .map((r: any) => ({
                id: r.id,
                ticket_number: r.ticket_number || r.ticket_id || r.id.substring(0, 6),
                customer_name: r.customer?.name || (r.customer?.first_name ? `${r.customer.first_name} ${r.customer.last_name || ''}`.trim() : r.customer_name) || 'Cliente',
                customer_phone: r.customer?.phone || r.customer_phone || '',
                device_brand: r.device_brand || '',
                device_model: r.device_model || '',
                problem_description: r.problem_description || r.notes || '',
                status: r.status || 'recibido',
                final_cost: r.final_cost,
                estimated_cost: r.estimated_cost,
                paid_amount: r.paid_amount || 0,
                created_at: r.created_at || new Date().toISOString()
              }))
            setRepairs(mapped)
            return
          }
        }

        // 2. Fallback a cliente Supabase
        const { data, error } = await supabase
          .from('repairs')
          .select('id, device_brand, device_model, problem_description, status, final_cost, estimated_cost, paid_amount, created_at, customer_id')
          .not('status', 'in', '("delivered","cancelled","entregado")')
          .order('created_at', { ascending: false })
          .limit(30)

        if (!error && Array.isArray(data)) {
          const mapped: RepairItemData[] = data.map((r: any) => ({
            id: r.id,
            ticket_number: r.id.substring(0, 6).toUpperCase(),
            customer_name: 'Cliente',
            customer_phone: '',
            device_brand: r.device_brand || '',
            device_model: r.device_model || '',
            problem_description: r.problem_description || '',
            status: r.status || 'recibido',
            final_cost: r.final_cost,
            estimated_cost: r.estimated_cost,
            paid_amount: r.paid_amount || 0,
            created_at: r.created_at || new Date().toISOString()
          }))
          setRepairs(mapped)
        }
      } catch (err) {
        console.warn('Info: No se pudieron cargar reparaciones activas:', err)
      } finally {
        setLoading(false)
      }
    }

    loadRepairs()
  }, [open, supabase])

  // Filter repairs by search term
  const filteredRepairs = repairs.filter(r => {
    if (!searchTerm.trim()) return true
    const term = searchTerm.toLowerCase()
    const ticket = String(r.ticket_number || '').toLowerCase()
    const name = (r.customer_name || '').toLowerCase()
    const phone = (r.customer_phone || '').toLowerCase()
    const device = `${r.device_brand || ''} ${r.device_model || ''}`.toLowerCase()
    return ticket.includes(term) || name.includes(term) || phone.includes(term) || device.includes(term)
  })

  const handleSelectRepair = (repair: RepairItemData) => {
    const totalCost = Number(repair.final_cost || repair.estimated_cost || 0)
    const paidAmount = Number(repair.paid_amount || 0)
    const balanceDue = Math.max(0, totalCost - paidAmount)
    const priceToCharge = balanceDue > 0 ? balanceDue : totalCost

    if (balanceDue <= 0 && totalCost > 0) {
      toast.info('Esta reparación ya está 100% pagada', {
        description: `Total: ${formatCurrency(totalCost)} | Abonado: ${formatCurrency(paidAmount)}`
      })
    }

    const deviceName = `${repair.device_brand || ''} ${repair.device_model || 'Equipo'}`.trim()
    const ticketLabel = repair.ticket_number ? `#${repair.ticket_number}` : 'Taller'

    const cartItem: CartItem = {
      id: `repair_${repair.id}`,
      name: `Reparación ${ticketLabel} - ${deviceName}`,
      price: priceToCharge,
      quantity: 1,
      stock: 999,
      subtotal: priceToCharge,
      isService: true,
      sku: `REP-${repair.ticket_number || repair.id.substring(0, 6)}`
    }

    onAddRepairToCart(cartItem)
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
          {loading ? (
            <div className="py-16 text-center text-muted-foreground flex flex-col items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-sm">Buscando reparaciones activas...</span>
            </div>
          ) : filteredRepairs.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Smartphone className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium">No se encontraron reparaciones pendientes</p>
              <p className="text-xs text-muted-foreground mt-1">Prueba buscando con otro término o número de ticket.</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[50vh] pr-2">
              <div className="space-y-2.5">
                {filteredRepairs.map((repair) => {
                  const totalCost = Number(repair.final_cost || repair.estimated_cost || 0)
                  const paidAmount = Number(repair.paid_amount || 0)
                  const balanceDue = Math.max(0, totalCost - paidAmount)
                  const statusMeta = STATUS_LABELS[repair.status] || { label: repair.status, color: 'bg-muted text-foreground' }

                  return (
                    <div
                      key={repair.id}
                      className="p-4 rounded-xl border border-border/70 bg-card hover:border-indigo-500/40 hover:bg-muted/20 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
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
                      </div>

                      <div className="flex items-center sm:flex-col sm:items-end justify-between sm:justify-center gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">Saldo pendiente</div>
                          <div className="text-base font-bold text-indigo-600 dark:text-indigo-400">
                            {formatCurrency(balanceDue > 0 ? balanceDue : totalCost)}
                          </div>
                          {paidAmount > 0 && (
                            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                              Seña abonada: {formatCurrency(paidAmount)}
                            </div>
                          )}
                        </div>

                        <Button
                          size="sm"
                          className="h-8 gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                          onClick={() => handleSelectRepair(repair)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Sumar al Carrito
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
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
