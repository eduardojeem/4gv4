'use client'

import React, { memo } from 'react'
import Link from 'next/link'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Wrench,
  AlertCircle,
  DollarSign,
  Calendar,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { CustomerCreditHistory } from '@/components/pos/CustomerCreditHistory'
import { useCreditSystem } from '@/hooks/use-credit-system'
import { CartItem, PaymentSplit } from '../types'
import { Badge } from '@/components/ui/badge'
import { PaymentMethods } from './checkout/PaymentMethods'
import { CustomerSelection } from './checkout/CustomerSelection'
import { SaleSummary } from './checkout/SaleSummary'

// Define props interface
export interface CheckoutModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  
  // Payment Status
  paymentStatus: 'idle' | 'processing' | 'success' | 'failed'
  paymentError: string
  
  // Customer State
  selectedCustomer: string
  setSelectedCustomer: (val: string) => void
  activeCustomer?: any
  customerSearch: string
  setCustomerSearch: (val: string) => void
  customerTypeFilter: string
  setCustomerTypeFilter: (val: string) => void
  customerTypes: string[]
  showFrequentOnly: boolean
  setShowFrequentOnly: (val: boolean) => void
  filteredCustomers: any[]
  setCustomers: (rows: any[]) => void
  setCustomersSourceSupabase: (val: boolean) => void
  customersSourceSupabase: boolean
  lastCustomerRefreshCount: number | null
  setLastCustomerRefreshCount: (val: number) => void
  
  // New Customer State
  newCustomerOpen: boolean
  setNewCustomerOpen: (val: boolean) => void
  newFirstName: string
  setNewFirstName: (val: string) => void
  newLastName: string
  setNewLastName: (val: string) => void
  newPhone: string
  setNewPhone: (val: string) => void
  newEmail: string
  setNewEmail: (val: string) => void
  newType: string
  setNewType: (val: string) => void
  newCustomerSaving: boolean
  createNewCustomer: () => void
  
  // Repair Linking
  selectedRepairIds: string[]
  setSelectedRepairIds: (val: string[]) => void
  customerRepairs: any[]
  markRepairDelivered: boolean
  setMarkRepairDelivered: (val: boolean) => void
  finalCostFromSale: boolean
  setFinalCostFromSale: (val: boolean) => void
  selectedRepairs: any[]
  supabaseStatusToLabel: Record<string, string>
  
  // Payment State
  isMixedPayment: boolean
  setIsMixedPayment: (val: boolean) => void
  paymentMethod: string
  setPaymentMethod: (val: string) => void
  cashReceived: number
  setCashReceived: (val: number) => void
  cardNumber: string
  setCardNumber: (val: string) => void
  transferReference: string
  setTransferReference: (val: string) => void
  splitAmount: number
  setSplitAmount: (val: number) => void
  paymentSplit: PaymentSplit[]
  addPaymentSplit: (method: string, amount: number, reference?: string) => void
  removePaymentSplit: (id: string) => void
  getTotalPaid: () => number
  getRemainingAmount: () => number
  
  // Cart & Calculations
  cart: CartItem[]
  cartCalculations: {
    subtotal: number
    subtotalAfterAllDiscounts: number
    generalDiscount: number
    wholesaleDiscount: number
    wholesaleDiscountRate: number
    tax: number
    total: number
    change: number
    remaining: number
    discount?: number
    repairCost?: number
    repairSubtotal?: number
    repairTax?: number
  }
  discount: number
  setDiscount: (val: number) => void
  notes: string
  setNotes: (val: string) => void
  isWholesale: boolean
  WHOLESALE_DISCOUNT_RATE: number
  
  // Actions
  processSale: () => void
  processMixedPayment: () => void
  formatCurrency: (amount: number) => string
  
  // Register State
  isRegisterOpen: boolean
  onOpenRegister?: () => void

  // Cleanup/Cancel actions
  onCancel: () => void
}

export const CheckoutModal = memo<CheckoutModalProps>(({
  isOpen,
  onOpenChange,
  paymentStatus,
  paymentError,
  selectedCustomer,
  setSelectedCustomer,
  activeCustomer,
  customerSearch,
  setCustomerSearch,
  customerTypeFilter,
  setCustomerTypeFilter,
  customerTypes,
  showFrequentOnly,
  setShowFrequentOnly,
  filteredCustomers,
  setCustomers,
  setCustomersSourceSupabase,
  customersSourceSupabase,
  lastCustomerRefreshCount,
  setLastCustomerRefreshCount,
  newCustomerOpen,
  setNewCustomerOpen,
  newFirstName,
  setNewFirstName,
  newLastName,
  setNewLastName,
  newPhone,
  setNewPhone,
  newEmail,
  setNewEmail,
  newType,
  setNewType,
  newCustomerSaving,
  createNewCustomer,
  selectedRepairIds,
  setSelectedRepairIds,
  customerRepairs,
  markRepairDelivered,
  setMarkRepairDelivered,
  finalCostFromSale,
  setFinalCostFromSale,
  selectedRepairs,
  supabaseStatusToLabel,
  isMixedPayment,
  setIsMixedPayment,
  paymentMethod,
  setPaymentMethod,
  cashReceived,
  setCashReceived,
  cardNumber,
  setCardNumber,
  transferReference,
  setTransferReference,
  splitAmount,
  setSplitAmount,
  paymentSplit,
  addPaymentSplit,
  removePaymentSplit,
  getTotalPaid,
  getRemainingAmount,
  cart,
  cartCalculations,
  discount,
  setDiscount,
  notes,
  setNotes,
  isWholesale,
  WHOLESALE_DISCOUNT_RATE,
  processSale,
  processMixedPayment,
  formatCurrency,
  isRegisterOpen,
  onOpenRegister,
  onCancel
}) => {
  // Sistema de créditos
  const { canSellOnCredit, createCreditSale, getCreditSummary } = useCreditSystem()
  const [showCreditHistory, setShowCreditHistory] = React.useState(false)
  
  // Verificar si el cliente puede comprar a crédito
  const canUseCredit = activeCustomer && canSellOnCredit(activeCustomer, cartCalculations.total)
  const creditSummary = activeCustomer ? getCreditSummary(activeCustomer) : null

  // Procesar venta a crédito
  const processCreditSale = React.useCallback(async () => {
    if (!activeCustomer) return
    
    const saleData = {
      amount: cartCalculations.total,
      items: cart.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price
      })),
      repairIds: selectedRepairIds.length > 0 ? selectedRepairIds : undefined
    }
    
    const success = await createCreditSale(activeCustomer, saleData)
    if (success) {
      // Limpiar carrito y cerrar modal
      onCancel()
    }
  }, [activeCustomer, cartCalculations.total, cart, selectedRepairIds, createCreditSale, onCancel])

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-3xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Procesar Pago</DialogTitle>
        </DialogHeader>
        
        {!isRegisterOpen && (
          <div className="mb-4 flex items-center justify-between gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-destructive">
             <div className="flex items-center gap-2">
               <AlertCircle className="h-4 w-4" />
               <span className="text-sm font-medium">La caja está cerrada. Debe abrirla antes de procesar ventas.</span>
             </div>
             {onOpenRegister && (
               <Button 
                 variant="destructive" 
                 size="sm" 
                 className="h-7 px-3 text-xs"
                 onClick={onOpenRegister}
               >
                 Abrir Caja
               </Button>
             )}
          </div>
        )}

        {/* Indicadores de estado del pago */}
        {paymentStatus !== 'idle' && (
          <div aria-live="polite" className="mb-4">
            {paymentStatus === 'processing' && (
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm">Procesando pago… Esto puede tardar unos segundos.</span>
              </div>
            )}
            {paymentStatus === 'success' && (
              <div className="flex items-center gap-2 rounded-md border border-green-300 bg-green-50 px-3 py-2 dark:bg-green-900/20">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">Pago exitoso</span>
              </div>
            )}
            {paymentStatus === 'failed' && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2">
                <XCircle className="h-4 w-4 text-destructive mt-0.5" />
                <div>
                  <div className="text-sm font-medium">Pago fallido</div>
                  <div className="text-xs text-muted-foreground">{paymentError || 'Ocurrió un error durante el pago. Verifique la conexión y los datos ingresados.'}</div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <CustomerSelection
              selectedCustomer={selectedCustomer}
              setSelectedCustomer={setSelectedCustomer}
              activeCustomer={activeCustomer}
              customerSearch={customerSearch}
              setCustomerSearch={setCustomerSearch}
              customerTypeFilter={customerTypeFilter}
              setCustomerTypeFilter={setCustomerTypeFilter}
              customerTypes={customerTypes}
              showFrequentOnly={showFrequentOnly}
              setShowFrequentOnly={setShowFrequentOnly}
              filteredCustomers={filteredCustomers}
              setCustomers={setCustomers}
              setCustomersSourceSupabase={setCustomersSourceSupabase}
              customersSourceSupabase={customersSourceSupabase}
              lastCustomerRefreshCount={lastCustomerRefreshCount}
              setLastCustomerRefreshCount={setLastCustomerRefreshCount}
              newCustomerOpen={newCustomerOpen}
              setNewCustomerOpen={setNewCustomerOpen}
              newFirstName={newFirstName}
              setNewFirstName={setNewFirstName}
              newLastName={newLastName}
              setNewLastName={setNewLastName}
              newPhone={newPhone}
              setNewPhone={setNewPhone}
              newEmail={newEmail}
              setNewEmail={setNewEmail}
              newType={newType}
              setNewType={setNewType}
              newCustomerSaving={newCustomerSaving}
              createNewCustomer={createNewCustomer}
              creditSummary={creditSummary || undefined}
              showCreditHistory={showCreditHistory}
              setShowCreditHistory={setShowCreditHistory}
              formatCurrency={formatCurrency}
            />

            {/* Selector de reparación vinculada (Múltiple) */}
            {selectedCustomer && (
              <div className="mt-6 border-t pt-4">
                {(() => {
                   const activeRepairs = customerRepairs.filter(r => r.status !== 'entregado')
                   
                   return (
                   <>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium flex items-center gap-2 text-sm">
                          <Wrench className="h-4 w-4" />
                          Vincular a Reparación ({selectedRepairIds.length})
                        </h4>
                        {selectedRepairIds.length > 0 && (
                           <Button variant="ghost" size="sm" onClick={() => setSelectedRepairIds([])} className="h-6 text-xs text-muted-foreground hover:text-destructive px-2">
                              Limpiar selección
                           </Button>
                        )}
                      </div>
                      
                      {selectedRepairIds.length === 0 && activeRepairs.length > 0 && (
                         <div className="text-xs text-muted-foreground mb-2 px-1">
                            Seleccione las reparaciones que desea vincular a esta venta.
                         </div>
                      )}

                      {activeRepairs.length === 0 ? (
                         <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-md text-center border border-dashed">
                            No hay reparaciones pendientes para este cliente.
                         </div>
                      ) : (
                         <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                            {activeRepairs.map((repair: any) => {
                               const isSelected = selectedRepairIds.includes(repair.id);
                               return (
                                  <div key={repair.id} 
                                       className={`rounded-lg border transition-all duration-200 overflow-hidden ${isSelected ? 'border-primary bg-primary/5 shadow-sm' : 'bg-card hover:bg-accent/5'}`}
                                  >
                                     {/* Header Row - Click to toggle */}
                                     <div 
                                        className="p-3 flex items-center justify-between cursor-pointer select-none"
                                        onClick={() => {
                                           if (isSelected) {
                                              setSelectedRepairIds(selectedRepairIds.filter(id => id !== repair.id))
                                           } else {
                                              setSelectedRepairIds([...selectedRepairIds, repair.id])
                                           }
                                        }}
                                     >
                                        <div className="flex items-center gap-3">
                                           <div className={`h-5 w-5 rounded border flex items-center justify-center transition-colors shrink-0 ${isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/30 bg-background'}`}>
                                              {isSelected && <CheckCircle2 className="h-3.5 w-3.5" />}
                                           </div>
                                           <div>
                                              <div className="font-medium text-sm flex items-center gap-2">
                                                 {repair.device_brand || 'Equipo'} {repair.device_model || ''}
                                              </div>
                                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                  <Badge variant="outline" className={`
                                                      capitalize font-normal text-[10px] px-1.5 py-0 h-4
                                                      ${repair.status === 'listo' || repair.status === 'entregado' ? 'border-green-500 text-green-600 bg-green-50 dark:bg-green-900/20' : ''}
                                                      ${repair.status === 'reparacion' ? 'border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-900/20' : ''}
                                                      ${repair.status === 'diagnostico' ? 'border-yellow-500 text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20' : ''}
                                                  `}>
                                                      {supabaseStatusToLabel[repair.status] || repair.status}
                                                  </Badge>
                                                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                      <Calendar className="h-3 w-3" />
                                                      {new Date(repair.created_at).toLocaleDateString()}
                                                  </span>
                                              </div>
                                           </div>
                                        </div>
                                        <div className="text-right shrink-0 ml-2">
                                           <div className="font-bold text-sm">
                                              {formatCurrency(repair.final_cost || repair.estimated_cost || 0)}
                                           </div>
                                           <div className="text-[10px] text-muted-foreground">
                                              {repair.final_cost ? 'Costo Final' : 'Estimado'}
                                           </div>
                                        </div>
                                     </div>

                                     {/* Expanded Details (only if selected) */}
                                     {isSelected && (
                                        <div className="px-3 pb-3 pt-0 animate-in slide-in-from-top-1 duration-200">
                                           {repair.notes && (
                                              <div className="mt-1 mb-2 text-xs bg-background/50 p-2 rounded border text-muted-foreground flex gap-2 items-start">
                                                 <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                                 <span className="line-clamp-2">{repair.notes}</span>
                                              </div>
                                           )}
                                           <div className="flex justify-end">
                                              <Link href={`/dashboard/repairs?repairId=${repair.id}`} target="_blank" className="text-[10px] text-primary hover:underline flex items-center gap-1">
                                                  Ver ficha completa <Users className="h-3 w-3" />
                                              </Link>
                                           </div>
                                        </div>
                                     )}
                                  </div>
                               )
                            })}
                         </div>
                      )}
                   </>
                   )
                })()}

                {/* Global Actions for Selected Repairs */}
                {selectedRepairIds.length > 0 && (
                   <div className="mt-4 p-3 bg-muted/30 rounded-lg border animate-in fade-in duration-300">
                      <div className="flex items-center justify-between mb-2">
                         <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Acciones ({selectedRepairIds.length} seleccionados)</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                         <div className="flex items-center justify-between rounded-lg border p-2 bg-background hover:bg-muted/20 transition-colors">
                            <div className="flex gap-2 items-center">
                               <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                               </div>
                               <div>
                                  <div className="text-xs font-semibold leading-tight">Marcar como entregados</div>
                                  <div className="text-[10px] text-muted-foreground leading-tight">Actualizar estado a "Entregado"</div>
                               </div>
                            </div>
                            <Switch checked={markRepairDelivered} onCheckedChange={setMarkRepairDelivered} />
                         </div>
                         
                         <div className="flex items-center justify-between rounded-lg border p-2 bg-background hover:bg-muted/20 transition-colors">
                            <div className="flex gap-2 items-center">
                               <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                                  <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                               </div>
                               <div>
                                  <div className="text-xs font-semibold leading-tight">Actualizar costo final</div>
                                  <div className="text-[10px] text-muted-foreground leading-tight">Usar precio de venta</div>
                               </div>
                            </div>
                            <Switch checked={finalCostFromSale} onCheckedChange={setFinalCostFromSale} />
                         </div>
                      </div>
                   </div>
                )}
              </div>
            )}

            <PaymentMethods
              isMixedPayment={isMixedPayment}
              setIsMixedPayment={setIsMixedPayment}
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              cashReceived={cashReceived}
              setCashReceived={setCashReceived}
              cardNumber={cardNumber}
              setCardNumber={setCardNumber}
              transferReference={transferReference}
              setTransferReference={setTransferReference}
              splitAmount={splitAmount}
              setSplitAmount={setSplitAmount}
              paymentSplit={paymentSplit}
              addPaymentSplit={addPaymentSplit}
              removePaymentSplit={removePaymentSplit}
              getTotalPaid={getTotalPaid}
              getRemainingAmount={getRemainingAmount}
              cartTotal={cartCalculations.total}
              cartChange={cartCalculations.change}
              cartRemaining={cartCalculations.remaining}
              canUseCredit={canUseCredit}
              creditSummary={creditSummary || undefined}
              formatCurrency={formatCurrency}
            />

            <div className="mt-4">
              <label className="text-sm font-medium mb-2 block">Descuento (%)</label>
              <Input
                type="number"
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))}
                placeholder="0"
                max="100"
              />
            </div>

            <div className="mt-4">
              <label className="text-sm font-medium mb-2 block">Notas</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas adicionales..."
              />
            </div>
          </div>

          <div>
            <SaleSummary
              cart={cart}
              cartCalculations={cartCalculations}
              discount={discount}
              isWholesale={isWholesale}
              WHOLESALE_DISCOUNT_RATE={WHOLESALE_DISCOUNT_RATE}
              formatCurrency={formatCurrency}
            />

            <div className="mt-6 space-y-2">
              {!isMixedPayment ? (
                <>
                  {paymentMethod === 'credit' ? (
                    <Button
                      className="w-full"
                      onClick={processCreditSale}
                      disabled={
                        !isRegisterOpen ||
                        paymentStatus === 'processing' ||
                        !activeCustomer ||
                        !canUseCredit
                      }
                    >
                      {paymentStatus === 'processing' ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Procesando…
                        </span>
                      ) : (
                        <>Vender a Crédito - {formatCurrency(cartCalculations.total)}</>
                      )}
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      onClick={processSale}
                      disabled={
                        !isRegisterOpen ||
                        paymentStatus === 'processing' ||
                        !paymentMethod ||
                        (paymentMethod === 'cash' && cashReceived < cartCalculations.total) ||
                        (paymentMethod === 'card' && cardNumber.length < 4) ||
                        (paymentMethod === 'transfer' && !transferReference)
                      }
                    >
                      {paymentStatus === 'processing' ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Procesando…
                        </span>
                      ) : (
                        <>Confirmar Venta - {formatCurrency(cartCalculations.total)}</>
                      )}
                    </Button>
                  )}
                </>
              ) : (
                <Button
                  className="w-full"
                  onClick={processMixedPayment}
                  disabled={!isRegisterOpen || paymentStatus === 'processing' || getRemainingAmount() > 0.01}
                >
                  {paymentStatus === 'processing' ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Procesando…
                    </span>
                  ) : (
                    <>
                      {getRemainingAmount() > 0.01
                        ? `Faltan ${formatCurrency(getRemainingAmount())}`
                        : 'Confirmar Venta Mixta'}
                    </>
                  )}
                </Button>
              )}

              <Button
                variant="outline"
                className="w-full"
                onClick={onCancel}
                disabled={paymentStatus === 'processing'}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
      
      {/* Modal de historial de crédito */}
      <Dialog open={showCreditHistory} onOpenChange={setShowCreditHistory}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Historial de Crédito</DialogTitle>
          </DialogHeader>
          {activeCustomer && (
            <CustomerCreditHistory 
              customer={activeCustomer} 
              onClose={() => setShowCreditHistory(false)}
              compact={true}
            />
          )}
        </DialogContent>
      </Dialog>
    </Dialog>
  )
})

CheckoutModal.displayName = 'CheckoutModal'