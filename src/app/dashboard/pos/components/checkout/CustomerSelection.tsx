/**
 * Componente para selección y gestión de clientes
 * Extraído del CheckoutModal para mejor modularización
 */

import React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  Star, 
  Mail, 
  Phone, 
  MapPin, 
  AlertCircle,
  Sparkles,
  Loader2
} from 'lucide-react'
import { usePOSCustomer } from '../../contexts/POSCustomerContext'
import { useCreditSystem } from '@/hooks/use-credit-system'
import { CustomerQuickCreateDialog } from '@/components/dashboard/repairs/CustomerQuickCreateDialog'

interface CreditSummary {
  totalCredit: number
  availableCredit: number
  usedCredit: number
  overdueAmount: number
  pendingSales: number
  creditUtilization: number
}

interface CustomerRepairSummary {
  id: string
  status: string
  device_brand?: string | null
  device_model?: string | null
}

interface CustomerSelectionProps {
  // Crédito
  creditSummary?: CreditSummary
  showCreditHistory: boolean
  setShowCreditHistory: (show: boolean) => void
  
  formatCurrency: (amount: number) => string
  // Reparaciones del cliente
  customerRepairs?: CustomerRepairSummary[]
  selectedRepairIds?: string[]
  supabaseStatusToLabel?: Record<string, string>
  paymentStatus?: 'idle' | 'processing' | 'success' | 'failed'
}

export function CustomerSelection({
  creditSummary,
  setShowCreditHistory,
  formatCurrency,
  customerRepairs = [],
  selectedRepairIds = [],
  supabaseStatusToLabel = {},
  paymentStatus = 'idle'
}: CustomerSelectionProps) {
  
  const {
    selectedCustomer,
    setSelectedCustomer,
    activeCustomer,
    customers,
    setCustomers,
    setCustomersSourceSupabase,
    setLastCustomerRefreshCount,
    customerSearch,
    setCustomerSearch,
    customerTypeFilter,
    setCustomerTypeFilter,
    customerTypes,
    showFrequentOnly,
    setShowFrequentOnly,
    filteredCustomers,
    lastCustomerRefreshCount,
    refreshCustomers,
    newCustomerOpen,
    setNewCustomerOpen
  } = usePOSCustomer()

  const { loadCreditData } = useCreditSystem()
  const [isEnablingCredit, setIsEnablingCredit] = React.useState(false)
  const [showCustomerPicker, setShowCustomerPicker] = React.useState(!activeCustomer)
  const activeCustomerId = activeCustomer?.id
  const activeRepairCount = customerRepairs.filter(repair => repair.status !== 'entregado').length

  React.useEffect(() => {
    setShowCustomerPicker(!activeCustomerId)
  }, [activeCustomerId])

  const handleEnableCustomerCredit = async (limitAmount: number = 1000000) => {
    if (!activeCustomer?.id) return
    setIsEnablingCredit(true)
    try {
      const res = await fetch('/api/customers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: activeCustomer.id,
          credit_limit: limitAmount,
        }),
      })
      const data = await res.json()
      if (data?.success) {
        toast.success(`Línea de crédito activada: ${formatCurrency(limitAmount)}`)
        await Promise.all([
          refreshCustomers(),
          loadCreditData(activeCustomer.id)
        ])
      } else {
        toast.error(data?.error || 'No se pudo habilitar el crédito')
      }
    } catch {
      toast.error('Error de conexión al habilitar el crédito')
    } finally {
      setIsEnablingCredit(false)
    }
  }

  return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Cliente de la venta</h3>
            <p className="text-xs text-muted-foreground">Opcional para ventas rápidas; obligatorio para crédito.</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setNewCustomerOpen(true)}
            className="h-8"
          >
            Nuevo cliente
          </Button>
        </div>

        {activeCustomer && !showCustomerPicker && (
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between"
            onClick={() => setShowCustomerPicker(true)}
          >
            <span className="truncate">Cliente seleccionado: <strong>{activeCustomer.name}</strong></span>
            <span className="ml-3 shrink-0 text-xs text-primary">Cambiar cliente</span>
          </Button>
        )}

        {(!activeCustomer || showCustomerPicker) && (
          <div className="space-y-3 rounded-lg border bg-muted/15 p-3">
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem]">
              <Input
                aria-label="Buscar cliente"
                placeholder="Nombre, teléfono o correo"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
              />
              <Select value={customerTypeFilter} onValueChange={setCustomerTypeFilter}>
                <SelectTrigger aria-label="Filtrar por tipo de cliente">
                  <SelectValue placeholder="Todos los tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  {customerTypes.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant={showFrequentOnly ? 'default' : 'outline'}
                size="sm"
                className="h-8"
                onClick={() => setShowFrequentOnly(!showFrequentOnly)}
              >
                {showFrequentOnly ? 'Solo frecuentes ✓' : 'Solo frecuentes'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={() => refreshCustomers()
                  .then(() => toast.success('Clientes actualizados'))
                  .catch(() => toast.error('No se pudieron actualizar los clientes'))}
              >
                {lastCustomerRefreshCount != null ? `Actualizar (${lastCustomerRefreshCount})` : 'Actualizar lista'}
              </Button>
              <span className="ml-auto text-xs text-muted-foreground">{filteredCustomers.length} encontrados</span>
            </div>
            <Select
              value={selectedCustomer || '__none__'}
              onValueChange={(value) => {
                setSelectedCustomer(value === '__none__' ? '' : value)
                if (value !== '__none__') setShowCustomerPicker(false)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Continuar como consumidor final</SelectItem>
                {filteredCustomers.map(customer => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name}
                    {customer.phone ? ` · ${customer.phone}` : ''}
                    {customer.type ? ` · ${customer.type}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Información del cliente seleccionado */}
        {activeCustomer ? (
          <div className="rounded-xl border bg-card p-4 text-card-foreground">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="flex flex-wrap items-center gap-2 text-base font-bold sm:text-lg">
                    <span className="break-words">{activeCustomer.name}</span>
                    {activeCustomer.type === 'vip' && (
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-900">
                        <Star className="h-3 w-3 mr-1 fill-yellow-600 text-yellow-600" /> VIP
                      </Badge>
                    )}
                    {activeCustomer.type === 'wholesale' && (
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-900">
                        Mayorista
                      </Badge>
                    )}
                  </h4>
                  <div className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                    {activeCustomer.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5" />
                        <span className="break-all">{activeCustomer.email}</span>
                      </div>
                    )}
                    {activeCustomer.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5" />
                        <span>{activeCustomer.phone}</span>
                      </div>
                    )}
                    {(activeCustomer.address || activeCustomer.city) && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5" />
                        <span className="break-words">{[activeCustomer.address, activeCustomer.city].filter(Boolean).join(', ')}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  {activeCustomer.loyalty_points !== undefined && activeCustomer.loyalty_points > 0 && (
                    <div className="flex flex-col items-end bg-primary/5 p-2 rounded-lg mb-2">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Puntos</span>
                      <span className="font-bold text-xl text-primary">{activeCustomer.loyalty_points}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 border-t pt-4">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Resumen comercial</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-md bg-muted/30 p-2.5">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Compras</span>
                  <span className="text-sm font-bold">{activeCustomer.total_purchases || 0}</span>
                </div>
                <div className="rounded-md bg-muted/30 p-2.5">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Reparaciones activas</span>
                  <span className="text-sm font-bold">{activeRepairCount}</span>
                </div>
                <div className="rounded-md bg-muted/30 p-2.5">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Saldo pendiente</span>
                  <span className={`text-sm font-bold ${(activeCustomer.current_balance || 0) > 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                    {formatCurrency(activeCustomer.current_balance || 0)}
                  </span>
                </div>
                <div className="rounded-md bg-muted/30 p-2.5">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Crédito disponible</span>
                  <span className="text-sm font-bold text-emerald-600">
                    {formatCurrency(creditSummary?.availableCredit || 0)}
                  </span>
                </div>
                </div>
              </div>

              {/* Resumen de reparaciones del cliente */}
              <div className="mt-4 pt-3 border-t border-border/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Reparaciones del cliente</span>
                   <div className="flex flex-wrap justify-end gap-1.5">
                     <Badge variant="outline" className="text-[10px]">Activas: {activeRepairCount}</Badge>
                     <Badge variant="outline" className="text-[10px]">Seleccionadas: {selectedRepairIds.length}</Badge>
                  </div>
                </div>

                {/* Indicador de entrega tras venta */}
                {paymentStatus === 'success' && selectedRepairIds.length > 0 && (
                  <div className="flex items-center gap-2 rounded-md border border-green-300 bg-green-50 px-3 py-2 text-green-800 dark:bg-green-900/20">
                    <span className="text-xs font-medium">Entregadas {selectedRepairIds.length} reparaciones vinculadas</span>
                  </div>
                )}

                {/* Lista compacta de reparaciones seleccionadas */}
                {selectedRepairIds.length > 0 && (
                  <div className="space-y-1">
                    {customerRepairs.filter(r => selectedRepairIds.includes(r.id)).map((repair) => (
                       <div key={repair.id} className="flex flex-wrap items-center justify-between gap-2 rounded border bg-background p-2 text-xs">
                         <div className="flex min-w-0 items-center gap-2">
                          <Badge variant="outline" className="capitalize text-[10px]">
                            {supabaseStatusToLabel[repair.status] || repair.status}
                          </Badge>
                           <span className="truncate font-medium">
                            {repair.device_brand || 'Equipo'} {repair.device_model || ''}
                          </span>
                        </div>
                        <div className={`text-[10px] ${repair.status === 'entregado' ? 'text-green-600' : 'text-muted-foreground'}`}>
                          {repair.status === 'entregado' ? 'Entregado' : 'Pendiente'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Información de crédito */}
              {creditSummary && creditSummary.totalCredit > 0 ? (
                <div className="mt-3 pt-3 border-t border-border/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Crédito</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowCreditHistory(true)}
                      className="h-6 px-2 text-xs"
                    >
                      Ver Historial
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-xs text-muted-foreground">Disponible</span>
                      <div className="font-bold text-green-600">
                        {formatCurrency(creditSummary.availableCredit)}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Límite</span>
                      <div className="font-medium text-sm">
                        {formatCurrency(creditSummary.totalCredit)}
                      </div>
                    </div>
                  </div>
                  {creditSummary.overdueAmount > 0 && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">
                      <AlertCircle className="h-3 w-3 inline mr-1" />
                      Vencido: {formatCurrency(creditSummary.overdueAmount)}
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold block">Crédito</span>
                    <span className="text-xs text-muted-foreground">Sin línea activa (₲ 0)</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isEnablingCredit}
                    onClick={() => handleEnableCustomerCredit(1000000)}
                    className="h-7 px-2.5 text-xs text-emerald-700 bg-emerald-50 border-emerald-300 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                  >
                    {isEnablingCredit ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <Sparkles className="h-3 w-3 mr-1" />
                    )}
                    Habilitar ₲ 1.000.000
                  </Button>
                </div>
              )}
              
               {activeCustomer.last_visit && (
                 <div className="mt-3 text-right text-xs text-muted-foreground">
                   Última visita: {new Date(activeCustomer.last_visit).toLocaleDateString()}
                 </div>
               )}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground">
            Podés continuar como consumidor final. Seleccioná un cliente si necesitás crédito, historial o vincular una reparación.
          </div>
        )}

        <CustomerQuickCreateDialog
          open={newCustomerOpen}
          onClose={() => setNewCustomerOpen(false)}
          onCreated={(customerId, customerData) => {
            const createdCustomer = {
              id: customerId,
              name: customerData.name,
              email: customerData.email || '',
              phone: customerData.phone || '',
              type: customerData.customer_type || customerData.segment || 'regular',
              updated_at: customerData.created_at || new Date().toISOString(),
              address: customerData.address || '',
              city: customerData.city || '',
              last_visit: customerData.last_visit || null,
              loyalty_points: customerData.loyalty_points || 0,
              total_purchases: customerData.total_purchases || 0,
              total_repairs: customerData.total_repairs || 0,
              current_balance: customerData.current_balance || 0,
              credit_limit: customerData.credit_limit || 0,
            }

            setCustomers([
              createdCustomer,
              ...customers.filter(customer => customer.id !== customerId),
            ])
            setCustomersSourceSupabase(true)
            setLastCustomerRefreshCount(lastCustomerRefreshCount == null ? 1 : lastCustomerRefreshCount + 1)
            setSelectedCustomer(customerId)
            setNewCustomerOpen(false)

            refreshCustomers().catch(() => {
              toast.info('El cliente fue creado y seleccionado, pero la lista no pudo actualizarse en segundo plano.')
            })
          }}
        />
      </div>
  )
}
