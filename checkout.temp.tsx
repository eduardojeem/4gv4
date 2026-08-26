'use client'

import React, { memo } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  Clock,
  PackageX,
  ChevronDown,
  UserRound,
  WalletCards,
  ReceiptText,
} from 'lucide-react'
import { CustomerCreditHistory } from '@/components/pos/CustomerCreditHistory'
import { useCreditSystem } from '@/hooks/use-credit-system'
import { CartItem } from '../types'
import { Badge } from '@/components/ui/badge'
import { PaymentMethods } from './checkout/PaymentMethods'
import { StoreCreditPanel } from './checkout/StoreCreditPanel'
import { CustomerSelection } from './checkout/CustomerSelection'
import { SaleSummary } from './checkout/SaleSummary'
import { PromotionsSection } from './checkout/PromotionsSection'
import { SaleConfirmationDialog } from './checkout/SaleConfirmationDialog'
import type { Promotion } from '@/types/promotion'
import { buildCreditInstallmentPlan } from '@/lib/credits/installments'
import { getMixedPaymentValidation } from '../lib/payment-validation'
import { getRepairBalanceDue } from '../lib/repair-charge'
import type { CartProductCreditPlan } from '../lib/cart-credit-plans'
import { buildPosCreditSummary } from '@/lib/credits/pos-credit-summary'

import { useCheckout } from '../contexts/CheckoutContext'
import { usePOSCustomer } from '../contexts/POSCustomerContext'

type CheckoutRepair = {
  id: string
  status: string
  device_brand?: string | null
  device_model?: string | null
  created_at: string
  final_cost?: number | null
  estimated_cost?: number | null
  paid_amount?: number | null
  notes?: string | null
  payment_status?: string | null
}

// Define props interface
export interface CheckoutModalProps {
  // Repair Linking
  selectedRepairIds: string[]
  setSelectedRepairIds: (val: string[]) => void
  customerRepairs: CheckoutRepair[]
  markRepairDelivered: boolean
  setMarkRepairDelivered: (val: boolean) => void
  deliveryOutcome: 'repaired' | 'withdrawn' | 'unrepairable'
  setDeliveryOutcome: (val: 'repaired' | 'withdrawn' | 'unrepairable') => void
  supabaseStatusToLabel: Record<string, string>
  
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
  isWholesale: boolean
  WHOLESALE_DISCOUNT_RATE: number
  discount: number
  onDiscountChange: (discount: number) => void
  currency: string
  productCreditPlans: CartProductCreditPlan[]
  
  // Actions
  processSale: () => void
  processMixedPayment: () => void
  formatCurrency: (amount: number) => string
  
  // Promotions
  allPromotions: Promotion[]
  onApplyPromoCode: (code: string) => void
  
  // Register State
  isRegisterOpen: boolean
  onOpenRegister?: () => void

  // Cleanup/Cancel actions
  onCancel: () => void
}

export const CheckoutModal = memo<CheckoutModalProps>(({
  selectedRepairIds,
  setSelectedRepairIds,
  customerRepairs,
  markRepairDelivered,
  setMarkRepairDelivered,
  deliveryOutcome,
  setDeliveryOutcome,
  supabaseStatusToLabel,
  cart,
  cartCalculations,
  isWholesale,
  WHOLESALE_DISCOUNT_RATE,
  discount,
  onDiscountChange,
  currency,
  productCreditPlans,
  processSale,
  processMixedPayment,
  formatCurrency,
  allPromotions,
  onApplyPromoCode,
  isRegisterOpen,
  onOpenRegister,
  onCancel
}) => {
  const {
    isCheckoutOpen,
    paymentStatus,
    paymentError,
    paymentMethod,
    isMixedPayment,
    cashReceived,
    cardNumber,
    transferReference,
    notes,
    setNotes,
    creditTerms,
    paymentSplit,
    storeCreditApplied
  } = useCheckout()

  const {
    activeCustomer,
    selectedCustomer
  } = usePOSCustomer()

  // Lo que falta cobrar despues de aplicar el saldo a favor. El total de la
  // venta no cambia: cambia cuanto hay que cobrar por otros medios, asi que
  // tanto el pago mixto como el financiado se calculan sobre esto.
  const amountDue = Math.max(0, cartCalculations.total - storeCreditApplied)

  const mixedPaymentValidation = React.useMemo(
    () => getMixedPaymentValidation(amountDue, paymentSplit),
    [amountDue, paymentSplit]
  )

  // Sistema de creditos
  const { canSellOnCredit, getCreditSummary, loadCreditData } = useCreditSystem()
  const [showCreditHistory, setShowCreditHistory] = React.useState(false)
  const [pendingConfirmation, setPendingConfirmation] = React.useState<'sale' | 'mixed' | null>(null)
  const confirmationSubmittedRef = React.useRef(false)

  React.useEffect(() => {
    if (!isCheckoutOpen) {
      confirmationSubmittedRef.current = false
      setPendingConfirmation(null)
    } else if (paymentStatus === 'failed') {
      confirmationSubmittedRef.current = false
    }
  }, [isCheckoutOpen, paymentStatus])
  
  // Cargar datos de credito cuando cambia el cliente
  React.useEffect(() => {
    if (activeCustomer?.id) {
      loadCreditData(activeCustomer.id)
    }
  }, [activeCustomer?.id, loadCreditData])
  
  // Verificar si el cliente puede comprar a credito
  const creditPlan = React.useMemo(() => buildCreditInstallmentPlan({
    principalAmount: amountDue,
    interestRate: creditTerms.interestRate,
    installmentCount: creditTerms.count,
    frequency: creditTerms.frequency,
  }), [amountDue, creditTerms.count, creditTerms.frequency, creditTerms.interestRate])
  const canUseCredit = activeCustomer && canSellOnCredit(activeCustomer, creditPlan.financedTotal)
  const displayTotal = paymentMethod === 'credit' ? creditPlan.financedTotal : amountDue
  const creditSummary = activeCustomer ? getCreditSummary(activeCustomer) : null
  const mixedCreditPrincipal = React.useMemo(() => paymentSplit
    .filter((split) => split.method === 'credit')
    .reduce((total, split) => total + split.amount, 0), [paymentSplit])
  const mixedImmediateAmount = React.useMemo(() => paymentSplit
    .filter((split) => split.method !== 'credit')
    .reduce((total, split) => total + split.amount, 0), [paymentSplit])
  const confirmationHasCredit = paymentMethod === 'credit' || (isMixedPayment && mixedCreditPrincipal > 0)
  const confirmationCreditPrincipal = isMixedPayment ? mixedCreditPrincipal : amountDue
  const confirmationCreditSummary = React.useMemo(
    () => buildPosCreditSummary(confirmationCreditPrincipal, creditTerms),
    [confirmationCreditPrincipal, creditTerms],
  )
  const confirmationImmediateAmount = isMixedPayment
    ? mixedImmediateAmount
    : paymentMethod === 'credit' ? 0 : amountDue
  const confirmationTotal = cartCalculations.total + (confirmationHasCredit ? confirmationCreditSummary.interestAmount : 0)
  const paymentLabel = isMixedPayment
    ? confirmationHasCredit ? 'Pago mixto con crÃ©dito' : 'Pago mixto'
    : paymentMethod === 'cash' ? 'Efectivo'
      : paymentMethod === 'card' ? 'Tarjeta'
        : paymentMethod === 'transfer' ? 'Transferencia'
          : paymentMethod === 'credit' ? 'CrÃ©dito'
            : 'Sin seleccionar'

  const confirmPendingSale = React.useCallback(() => {
    if (paymentStatus === 'processing' || confirmationSubmittedRef.current || !pendingConfirmation) return
    confirmationSubmittedRef.current = true
    if (pendingConfirmation === 'mixed') processMixedPayment()
    else processSale()
  }, [paymentStatus, pendingConfirmation, processMixedPayment, processSale])

  const openSaleConfirmation = React.useCallback((kind: 'sale' | 'mixed') => {
    confirmationSubmittedRef.current = false
    setPendingConfirmation(kind)
  }, [])

  return (
    <Dialog open={isCheckoutOpen} onOpenChange={(open) => {
      if (!open && paymentStatus !== 'processing') onCancel()
    }}>
      <DialogContent showCloseButton={paymentStatus !== 'processing'} className="flex max-h-[92vh] w-[95vw] flex-col overflow-hidden p-0 max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:w-screen max-sm:max-w-full max-sm:rounded-none sm:max-w-3xl md:max-w-5xl lg:max-w-6xl">
        <DialogHeader className="shrink-0 border-b bg-muted/30 px-4 py-3 pr-12 sm:px-6 sm:py-4">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <DollarSign className="h-4 w-4 text-primary" aria-hidden="true" />
            Cobrar venta
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            VerificÃ¡ el cliente, elegÃ­ cÃ³mo cobra la venta y confirmÃ¡ el total.
          </DialogDescription>
        </DialogHeader>

        <div className="shrink-0 border-b bg-background/95 px-4 py-2.5 sm:px-6 sm:py-3">
          <ol className="grid grid-cols-3 gap-1.5 text-xs sm:gap-3 sm:text-sm" aria-label="Pasos para cobrar la venta">
            <li className="flex min-w-0 items-center gap-2 rounded-md bg-primary/10 px-2 py-2 text-primary sm:px-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
              <span className="min-w-0">
                <span className="block truncate font-semibold">Cliente</span>
                <span className="hidden truncate text-[10px] text-muted-foreground sm:block">{activeCustomer?.name || 'Consumidor final'}</span>
              </span>
            </li>
            <li className="flex min-w-0 items-center gap-2 rounded-md border bg-card px-2 py-2 sm:px-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-background text-xs font-bold">2</span>
              <span className="min-w-0">
                <span className="block truncate font-semibold">Forma de cobro</span>
                <span className="hidden truncate text-[10px] capitalize text-muted-foreground sm:block">{isMixedPayment ? 'Pago mixto' : (paymentMethod || 'Elegir mÃ©todo')}</span>
              </span>
            </li>
            <li className="flex min-w-0 items-center gap-2 rounded-md border bg-card px-2 py-2 sm:px-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-background text-xs font-bold">3</span>
              <span className="min-w-0">
                <span className="block truncate font-semibold">Confirmar</span>
                <span className="hidden truncate text-[10px] text-muted-foreground sm:block">{formatCurrency(displayTotal)}</span>
              </span>
            </li>
          </ol>
          <div className="sr-only">
            <span>1. Cliente</span>
            <span>2. Forma de cobro</span>
            <span>3. Revisar y confirmar</span>
          </div>
        </div>
        
        {!isRegisterOpen && (
          <div className="mx-6 mt-4 mb-1 flex items-center justify-between gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-destructive">
             <div className="flex items-center gap-2">
               <AlertCircle className="h-4 w-4" />
               <span className="text-sm font-medium">La caja esta cerrada. Debe abrirla antes de procesar ventas.</span>
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
          <div aria-live="polite" className="mx-6 mt-3 mb-1">
            {paymentStatus === 'processing' && (
              <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
                <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                <div className="text-xs">
                  <span className="font-semibold text-foreground">Procesando venta...</span>
                  <span className="text-muted-foreground ml-1.5">Validando inventario, pagos y caja registradora.</span>
                </div>
              </div>
            )}
            {paymentStatus === 'success' && (
              <div className="flex items-center gap-3 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2.5 dark:border-emerald-800 dark:bg-emerald-950/40">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300">Â¡Venta completada con Ã©xito!</div>
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-400">Generando comprobante de venta...</div>
                </div>
              </div>
            )}
            {paymentStatus === 'failed' && (
              <div className="flex items-start gap-3 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 dark:border-rose-900/50 dark:bg-rose-950/40">
                <XCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
                <div className="space-y-0.5 min-w-0">
                  <div className="text-xs font-bold text-rose-800 dark:text-rose-300">No se pudo completar la venta</div>
                  <div className="text-xs text-rose-700 dark:text-rose-300 font-medium">
                    {paymentError || 'OcurriÃ³ un error al procesar el cobro. Verifique la conexiÃ³n y los datos ingresados.'}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 max-sm:pb-44 sm:px-6">
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.72fr)]">
          <div className="space-y-4 rounded-xl border bg-card/70 p-4 md:p-5">
            <div className="flex items-center gap-3 border-b pb-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UserRound className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-sm font-semibold">1. Cliente</h3>
                <p className="text-xs text-muted-foreground">IdentificÃ¡ al comprador y vinculÃ¡ reparaciones si corresponde.</p>
              </div>
            </div>
            <CustomerSelection
              creditSummary={creditSummary || undefined}
              showCreditHistory={showCreditHistory}
              setShowCreditHistory={setShowCreditHistory}
              formatCurrency={formatCurrency}
              customerRepairs={customerRepairs}
              selectedRepairIds={selectedRepairIds}
              supabaseStatusToLabel={supabaseStatusToLabel}
              paymentStatus={paymentStatus}
            />

            {/* Selector de reparacion vinculada (Multiple) */}
            {selectedCustomer && (
              <div className="mt-6 border-t pt-4">
                {(() => {
                   const activeRepairs = customerRepairs.filter(repair => (
                     repair.status !== 'entregado' &&
                     repair.payment_status !== 'pagado' &&
                     !(paymentStatus === 'success' && selectedRepairIds.includes(repair.id))
                   ))
                   
                   return (
                   <>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium flex items-center gap-2 text-sm">
                          <Wrench className="h-4 w-4" />
                          Vincular a Reparacion ({selectedRepairIds.length})
                        </h4>
                        {selectedRepairIds.length > 0 && (
                           <Button variant="ghost" size="sm" onClick={() => setSelectedRepairIds([])} className="h-6 text-xs text-muted-foreground hover:text-destructive px-2">
                              Limpiar seleccion
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
                             {activeRepairs.map((repair) => {
                               const isSelected = selectedRepairIds.includes(repair.id);
                               return (
                                  <div key={repair.id} 
                                       className={`rounded-lg border transition-all duration-200 overflow-hidden ${isSelected ? 'border-primary bg-primary/5 shadow-sm' : 'bg-card hover:bg-accent/5'}`}
                                  >
                                     {/* Header Row - Click to toggle */}
                                     <div 
                                        className="p-3 flex items-center justify-between cursor-pointer select-none"
                                        role="checkbox"
                                        aria-checked={isSelected}
                                        tabIndex={paymentStatus === 'processing' ? -1 : 0}
                                        onClick={() => {
                                           if (isSelected) {
                                              setSelectedRepairIds(selectedRepairIds.filter(id => id !== repair.id))
                                           } else {
                                              setSelectedRepairIds([...selectedRepairIds, repair.id])
                                           }
                                        }}
                                        onKeyDown={(event) => {
                                           if (event.key !== 'Enter' && event.key !== ' ') return
                                           event.preventDefault()
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
                                              {formatCurrency(getRepairBalanceDue(repair))}
                                           </div>
                                           <div className="text-[10px] text-muted-foreground">
                                              {(repair.paid_amount || 0) > 0
                                                 ? 'Saldo pendiente'
                                                 : repair.final_cost ? 'Costo Final' : 'Estimado'}
                                           </div>
                                        </div>
                                     </div>

                                     {/* Expanded Details (only if selected) */}
                                     {isSelected && (
                                        <div className="px-3 pb-3 pt-0 animate-in slide-in-from-top-1 duration-200">
                                           {(repair.paid_amount || 0) > 0 && (
                                              <div className="mt-1 mb-2 text-[11px] text-muted-foreground">
                                                 Costo total {formatCurrency(repair.final_cost || repair.estimated_cost || 0)} Â· ya pagado {formatCurrency(repair.paid_amount || 0)}
                                              </div>
                                           )}
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
                         {(() => {
                            // El servidor solo entrega equipos en estado "listo".
                            // Antes el interruptor se ofrecia igual y la venta
                            // entera fallaba al confirmar, con el codigo crudo
                            // REPAIR_DELIVERY_INVALID_STATE en pantalla.
                            const notReady = customerRepairs.filter(
                              (repair) => selectedRepairIds.includes(repair.id)
                                && String(repair.status ?? '').toLowerCase() !== 'listo'
                            )
                            const canDeliver = notReady.length === 0

                            return (
                              <div className={cn(
                                'flex items-center justify-between rounded-lg border p-2 transition-colors',
                                canDeliver ? 'bg-background hover:bg-muted/20' : 'bg-muted/30',
                              )}>
                                 <div className="flex gap-2 items-center">
                                    <div className={cn(
                                      'h-8 w-8 rounded-full flex items-center justify-center shrink-0',
                                      canDeliver ? 'bg-green-100 dark:bg-green-900/30' : 'bg-muted',
                                    )}>
                                       <CheckCircle2 className={cn(
                                         'h-4 w-4',
                                         canDeliver ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground',
                                       )} />
                                    </div>
                                    <div>
                                       <div className="text-xs font-semibold leading-tight">Marcar como entregados</div>
                                       <div className="text-[10px] text-muted-foreground leading-tight">
                                          {canDeliver
                                            ? 'Actualizar estado a "Entregado"'
                                            : `${notReady.length === 1 ? 'La reparaciÃ³n no estÃ¡' : `${notReady.length} reparaciones no estÃ¡n`} en "Listo para entrega". PodÃ©s cobrarla igual.`}
                                       </div>
                                    </div>
                                 </div>
                                 <Switch
                                   checked={canDeliver && markRepairDelivered}
                                   onCheckedChange={setMarkRepairDelivered}
                                   disabled={!canDeliver}
                                 />
                              </div>
                            )
                         })()}

                         {/* Delivery outcome selector: visible when markRepairDelivered is ON */}
                         {markRepairDelivered && (
                           <div className="col-span-2 p-2 rounded-lg border bg-muted/20 animate-in fade-in slide-in-from-top-1 duration-200">
                             <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Resultado de la reparacion</div>
                             <div className="grid grid-cols-3 gap-1.5">
                               {([
                                 { value: 'repaired' as const, label: 'Reparado', Icon: CheckCircle2, cls: 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' },
                                 { value: 'withdrawn' as const, label: 'Retirado', Icon: PackageX, cls: 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' },
                                 { value: 'unrepairable' as const, label: 'Sin reparar', Icon: Wrench, cls: 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' },
                               ]).map(({ value, label, Icon, cls }) => (
                                 <button
                                   key={value}
                                   type="button"
                                   onClick={() => setDeliveryOutcome(value)}
                                   className={`flex flex-col items-center gap-1 rounded border p-2 text-center text-[10px] font-medium transition-all ${
                                     deliveryOutcome === value ? cls : 'border-border bg-background text-muted-foreground hover:bg-muted/30'
                                   }`}
                                 >
                                   <Icon className="h-3.5 w-3.5" />
                                   {label}
                                 </button>
                               ))}
                             </div>
                           </div>
                         )}

                      </div>
                   </div>
                )}
              </div>
            )}

            <StoreCreditPanel
              key={selectedCustomer || 'sin-cliente'}
              customerId={selectedCustomer}
              cartTotal={cartCalculations.total}
              formatCurrency={formatCurrency}
            />

            <div className="flex items-center gap-3 border-b pb-3 pt-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <WalletCards className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-sm font-semibold">2. Forma de cobro</h3>
                <p className="text-xs text-muted-foreground">ElegÃ­ un mÃ©todo simple o combinÃ¡ varios en pago mixto.</p>
              </div>
            </div>
            <PaymentMethods
              cartTotal={amountDue}
              canUseCredit={canUseCredit}
              creditSummary={creditSummary || undefined}
              formatCurrency={formatCurrency}
              currency={currency}
              productCreditPlans={productCreditPlans}
            />

            <details className="group rounded-lg border bg-muted/15">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span>
                  Opciones adicionales
                  <span className="ml-2 text-xs font-normal text-muted-foreground">PromociÃ³n, descuento o nota</span>
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="space-y-4 border-t px-3 py-4">
                <PromotionsSection
                  cart={cart}
                  cartTotal={cartCalculations.total}
                  allPromotions={allPromotions}
                  onApplyPromoCode={onApplyPromoCode}
                  formatCurrency={formatCurrency}
                />
                <div>
                  <label className="mb-2 block text-sm font-medium" htmlFor="pos-checkout-discount">Descuento general (%)</label>
                  <Input
                    id="pos-checkout-discount"
                    type="number"
                    value={discount}
                    onChange={(e) => onDiscountChange(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                    placeholder="0"
                    min="0"
                    max="100"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium" htmlFor="pos-checkout-notes">Nota interna</label>
                  <Textarea
                    id="pos-checkout-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="InformaciÃ³n adicional de la venta"
                  />
                </div>
              </div>
            </details>
          </div>

          <div className="rounded-xl border bg-card/70 p-4 md:sticky md:top-0 md:p-5">
            <div className="mb-4 flex items-center gap-3 border-b pb-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <ReceiptText className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-sm font-semibold">3. Revisar y confirmar</h3>
                <p className="text-xs text-muted-foreground">ComprobÃ¡ los importes antes de registrar la venta.</p>
              </div>
            </div>
            <SaleSummary
              cart={cart}
              cartCalculations={cartCalculations}
              isWholesale={isWholesale}
              WHOLESALE_DISCOUNT_RATE={WHOLESALE_DISCOUNT_RATE}
              formatCurrency={formatCurrency}
            />

            <div data-testid="pos-checkout-actions" className="mt-6 space-y-2 max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:z-50 max-sm:border-t max-sm:bg-background/95 max-sm:px-4 max-sm:pt-3 max-sm:pb-[max(0.75rem,env(safe-area-inset-bottom))] max-sm:shadow-[0_-8px_24px_-16px_rgba(0,0,0,0.45)] max-sm:backdrop-blur">
              <span data-testid="pos-checkout-footer" className="sr-only">ConfirmaciÃ³n de la venta</span>
              {!isMixedPayment ? (
                <>
                  {paymentMethod === 'credit' ? (
                    <Button
                      className="pos-button-primary pos-button-confirm-sale w-full h-12 text-base font-semibold shadow-md"
                      onClick={() => openSaleConfirmation('sale')}
                      disabled={
                        !isRegisterOpen ||
                        paymentStatus === 'processing' ||
                        !activeCustomer ||
                        !canUseCredit
                      }
                    >
                      {paymentStatus === 'processing' ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Procesando...
                        </span>
                      ) : (
                        <div className="flex flex-col items-center w-full">
                          <span className="flex items-center gap-2">
                            <Clock className="h-5 w-5" />
                            Revisar venta a crÃ©dito
                          </span>
                          <span className="text-xs font-normal opacity-90 mt-0.5">
                            Total financiado {formatCurrency(displayTotal)}
                          </span>
                        </div>
                      )}
                    </Button>
                  ) : (
                    <Button
                      className="pos-button-primary pos-button-confirm-sale w-full h-12 text-base font-semibold shadow-md"
                      onClick={() => openSaleConfirmation('sale')}
                      disabled={
                        !isRegisterOpen ||
                        paymentStatus === 'processing' ||
                        !paymentMethod ||
                        (paymentMethod === 'cash' && cashReceived < amountDue) ||
                        (paymentMethod === 'card' && cardNumber.length < 4) ||
                        (paymentMethod === 'transfer' && !transferReference)
                      }
                    >
                      {paymentStatus === 'processing' ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Procesando...
                        </span>
                      ) : (
                        <>Revisar venta - {formatCurrency(displayTotal)}</>
                      )}
                    </Button>
                  )}
                </>
              ) : (
                <Button
                  className="pos-button-primary pos-button-confirm-sale w-full h-12 text-base font-semibold shadow-md"
                  onClick={() => openSaleConfirmation('mixed')}
                  disabled={!isRegisterOpen || paymentStatus === 'processing' || !mixedPaymentValidation.valid}
                >
                  {paymentStatus === 'processing' ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                          Procesando...
                    </span>
                  ) : (
                    <>
                      {mixedPaymentValidation.code === 'PAYMENT_INCOMPLETE'
                        ? `Faltan ${formatCurrency(mixedPaymentValidation.remaining)}`
                        : mixedPaymentValidation.code === 'PAYMENT_EXCESS'
                          ? `Exceso ${formatCurrency(Math.abs(mixedPaymentValidation.remaining))}`
                          : paymentSplit.length === 0
                            ? 'Agregue una forma de pago'
                            : 'Revisar venta mixta'}
                    </>
                  )}
                </Button>
              )}

              {!isRegisterOpen ? (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 text-center font-medium">
                  âš ï¸ La caja registradora debe estar abierta para confirmar la venta.
                </p>
              ) : paymentMethod === 'cash' && cashReceived < amountDue ? (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 text-center font-medium">
                  ðŸ’¡ Ingresa el efectivo recibido o haz clic en <strong>Monto Exacto</strong>.
                </p>
              ) : paymentMethod === 'card' && cardNumber.length < 4 ? (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 text-center font-medium">
                  ðŸ’¡ Ingresa los 4 dÃ­gitos finales del ticket de tarjeta.
                </p>
              ) : paymentMethod === 'transfer' && !transferReference ? (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 text-center font-medium">
                  ðŸ’¡ Ingresa el nÃºmero de referencia de la transferencia.
                </p>
              ) : paymentMethod === 'credit' && !activeCustomer ? (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 text-center font-medium">
                  ðŸ’¡ Selecciona un cliente en la columna izquierda para vender a crÃ©dito.
                </p>
              ) : paymentMethod === 'credit' && !canUseCredit ? (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 text-center font-medium">
                  ðŸ’¡ Habilita la lÃ­nea de crÃ©dito del cliente en el panel de pago.
                </p>
              ) : null}

              <Button
                variant="outline"
                className="w-full h-11"
                onClick={onCancel}
                disabled={paymentStatus === 'processing'}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      </div>
      </DialogContent>
      
      <SaleConfirmationDialog
        open={pendingConfirmation !== null && isCheckoutOpen}
        onOpenChange={(open) => {
          if (!open) {
            confirmationSubmittedRef.current = false
            setPendingConfirmation(null)
          }
        }}
        onConfirm={confirmPendingSale}
        mode={confirmationHasCredit ? 'credit' : 'sale'}
        customerName={activeCustomer?.name || 'Consumidor final'}
        paymentLabel={paymentLabel}
        total={confirmationTotal}
        immediateAmount={confirmationImmediateAmount}
        financedPrincipal={confirmationHasCredit ? confirmationCreditPrincipal : undefined}
        interestAmount={confirmationHasCredit ? confirmationCreditSummary.interestAmount : undefined}
        installmentCount={confirmationHasCredit ? confirmationCreditSummary.installmentCount : undefined}
        installmentAmount={confirmationHasCredit ? confirmationCreditSummary.installmentAmount : undefined}
        firstDueDate={confirmationHasCredit ? confirmationCreditSummary.firstDueDate : undefined}
        formatCurrency={formatCurrency}
        isProcessing={paymentStatus === 'processing'}
      />

      {/* Modal de historial de credito */}
      <Dialog open={showCreditHistory} onOpenChange={setShowCreditHistory}>
        <DialogContent className="max-w-6xl max-h-[92vh] p-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b bg-muted/30 flex flex-row items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Historial de Credito
            </DialogTitle>
          </DialogHeader>

          <div className="px-6 py-3 border-b bg-background/90">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg border bg-muted/20 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">Cliente</p>
                <p className="font-semibold truncate">{activeCustomer?.name || 'Sin cliente seleccionado'}</p>
              </div>
              <div className="rounded-lg border bg-muted/20 px-3 py-2 text-right">
                <p className="text-[11px] text-muted-foreground">Estado de credito</p>
                <p className="font-semibold">
                  {creditSummary
                    ? `${formatCurrency(creditSummary.availableCredit)} disponible`
                    : 'Sin informacion'}
                </p>
              </div>
            </div>
          </div>

          {activeCustomer && (
            <div className="px-6 py-4 overflow-y-auto bg-background/95 max-h-[70vh]">
              <div className="rounded-xl border bg-card/70 p-4 md:p-5">
                <CustomerCreditHistory
                  customer={activeCustomer}
                  onClose={() => setShowCreditHistory(false)}
                  compact={true}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Dialog>
  )
})

CheckoutModal.displayName = 'CheckoutModal'


