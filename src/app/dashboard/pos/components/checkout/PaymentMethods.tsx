/**
 * Componente para selección de métodos de pago
 * Extraído del CheckoutModal para mejor modularización
 */

import React, { useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CreditCard, Users, Clock, AlertCircle, Trash2, Sparkles, Loader2 } from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import { useCheckout } from '../../contexts/CheckoutContext'
import { usePOSCustomer } from '../../contexts/POSCustomerContext'
import { useCreditSystem } from '@/hooks/use-credit-system'
import { toast } from 'sonner'
import { CreditStatusPanel } from './CreditStatusPanel'
import { buildCreditInstallmentPlan } from '@/lib/credits/installments'
import { formatThousands, parseThousands } from '@/lib/currency'
import { ProductCreditPlanPicker } from './ProductCreditPlanPicker'
import {
  buildManualDownPaymentSplit,
  buildProductCreditPayments,
  getProductCreditAllocation,
  type CartProductCreditPlan,
} from '../../lib/cart-credit-plans'

/**
 * Genera sugerencias inteligentes de billetes basadas en el monto total
 */
function getSmartSuggestions(amount: number, currency: string): number[] {
  if (amount <= 0) return []
  
  const suggestions = new Set<number>()
  suggestions.add(amount) // Monto exacto
  
  const roundingUnit = currency === 'PYG' ? 1000 : 1
  suggestions.add(Math.ceil(amount / roundingUnit) * roundingUnit)
  
  // Billetes comunes (PYG)
  const bills = currency === 'PYG'
    ? [5000, 10000, 20000, 50000, 100000]
    : [5, 10, 20, 50, 100]
  bills.forEach(bill => {
    if (bill > amount) {
      suggestions.add(bill)
    }
    // También sugerir múltiplos si el monto es grande
    const nextMultiple = Math.ceil(amount / bill) * bill
    if (nextMultiple > amount) {
      suggestions.add(nextMultiple)
    }
  })
  
  return Array.from(suggestions)
    .filter(s => s >= amount)
    .sort((a, b) => a - b)
    .slice(0, 5) // Limitar a 5 sugerencias
}

interface PaymentMethodsProps {
  // Cálculos
  cartTotal: number
  
  // Crédito
  canUseCredit: boolean
  creditSummary?: {
    availableCredit: number
    usedCredit: number
  }
  
  formatCurrency: (amount: number) => string
  currency: string
  productCreditPlans?: CartProductCreditPlan[]

  // Cobrar una cuota de un credito ya activo (no de esta venta). Ya existe
  // el dialogo -CheckoutModal lo abre desde el paso 1, Cliente- pero no
  // habia forma de llegar a el desde el paso de "Como paga", que es donde
  // el cajero esta parado cuando elige Credito.
  setShowCreditHistory?: (show: boolean) => void
}

export function PaymentMethods({
  cartTotal,
  canUseCredit,
  creditSummary,
  formatCurrency,
  currency,
  productCreditPlans = [],
  setShowCreditHistory,
}: PaymentMethodsProps) {
  
  const {
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
    electronicProvider,
    setElectronicProvider,
    electronicInstitution,
    setElectronicInstitution,
    electronicChannel,
    setElectronicChannel,
    terminalId,
    setTerminalId,
    splitAmount,
    setSplitAmount,
    paymentSplit,
    setPaymentSplit,
    addPaymentSplit,
    removePaymentSplit,
    creditTerms,
    setCreditTerms,
    creditPlanSuggestion,
    applyProductCreditSuggestion,
  } = useCheckout()

  const { activeCustomer, refreshCustomers } = usePOSCustomer()
  const { loadCreditData } = useCreditSystem()
  const [isEnablingCredit, setIsEnablingCredit] = React.useState(false)
  const [customCreditLimit, setCustomCreditLimit] = React.useState('')
  const [showCustomLimitInput, setShowCustomLimitInput] = React.useState(false)

  // Adelanto manual sobre el credito general del cliente: distinto del
  // adelanto automatico de ProductCreditPlanPicker, que lo dicta un plan
  // predefinido por producto. Aca lo elige la persona en el momento.
  const [downPaymentInput, setDownPaymentInput] = React.useState('')
  const [downPaymentMethod, setDownPaymentMethod] = React.useState<'cash' | 'card' | 'transfer'>('cash')
  const downPaymentAmount = parseThousands(downPaymentInput)

  const handleApplyDownPayment = React.useCallback(() => {
    if (downPaymentAmount <= 0) return
    setPaymentSplit(buildManualDownPaymentSplit(cartTotal, downPaymentAmount, downPaymentMethod, () => crypto.randomUUID()))
    setIsMixedPayment(true)
    setPaymentMethod('')
    setSplitAmount(0)
    setDownPaymentInput('')
    const financedAmount = Math.max(0, cartTotal - downPaymentAmount)
    toast.info('Adelanto aplicado', {
      description: financedAmount > 0
        ? `${formatCurrency(downPaymentAmount)} ahora y ${formatCurrency(financedAmount)} a crédito.`
        : `${formatCurrency(downPaymentAmount)} cubre el total: no queda nada por financiar.`,
    })
  }, [cartTotal, downPaymentAmount, downPaymentMethod, formatCurrency, setIsMixedPayment, setPaymentMethod, setPaymentSplit, setSplitAmount])

  const handleEnableCredit = async (amount: number) => {
    if (!activeCustomer?.id) {
      toast.error('Selecciona un cliente primero para habilitar crédito')
      return
    }
    setIsEnablingCredit(true)
    try {
      const res = await fetch('/api/customers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: activeCustomer.id,
          credit_limit: amount,
        }),
      })
      const data = await res.json()
      if (data?.success) {
        toast.success(`Línea de crédito activada: ${formatCurrency(amount)}`)
        await Promise.all([
          refreshCustomers(),
          loadCreditData(activeCustomer.id)
        ])
        setShowCustomLimitInput(false)
        setCustomCreditLimit('')
      } else {
        toast.error(data?.error || 'No se pudo actualizar el límite de crédito')
      }
    } catch {
      toast.error('Error de conexión al habilitar el crédito')
    } finally {
      setIsEnablingCredit(false)
    }
  }

  // Estado local para el input de efectivo para permitir borrarlo fácilmente (evita que el 0 se quede "pegado")
  const [localCashInput, setLocalCashInput] = React.useState(cashReceived === 0 ? '' : cashReceived.toString())
  const [localSplitInput, setLocalSplitInput] = React.useState(splitAmount === 0 ? '' : splitAmount.toString())

  // Sincronizar de global a local cuando cambia externamente (ej: reset)
  React.useEffect(() => {
    if (Number(localCashInput) !== cashReceived) {
      setLocalCashInput(cashReceived === 0 ? '' : cashReceived.toString())
    }
  }, [cashReceived, localCashInput])

  React.useEffect(() => {
    if (Number(localSplitInput) !== splitAmount) {
      setLocalSplitInput(splitAmount === 0 ? '' : splitAmount.toString())
    }
  }, [localSplitInput, splitAmount])

  // Calcular totales locales usando el contexto
  const getTotalPaid = useCallback(() => {
    return paymentSplit.reduce((total, split) => total + split.amount, 0)
  }, [paymentSplit])

  const getRemainingAmount = useCallback(() => {
    // Redondear a 2 decimales para evitar problemas de punto flotante
    return Math.round((cartTotal - getTotalPaid()) * 100) / 100
  }, [cartTotal, getTotalPaid])

  // Lógica de auto-completar: si selecciona efectivo y el monto recibido es 0, proponer el total de la venta
  React.useEffect(() => {
    if (paymentMethod === 'cash' && !isMixedPayment && cashReceived === 0) {
      setCashReceived(cartTotal)
    }
    
    // En pago mixto, proponer el restante al seleccionar un método si el monto es 0
    if (isMixedPayment && paymentMethod && splitAmount === 0) {
      setSplitAmount(getRemainingAmount())
    }
  }, [cashReceived, paymentMethod, isMixedPayment, cartTotal, getRemainingAmount, setCashReceived, setSplitAmount, splitAmount])

  // Cálculos para pago en efectivo simple
  const cashChange = Math.max(0, cashReceived - cartTotal)
  const cashRemaining = Math.max(0, cartTotal - cashReceived)

  const paymentMethods = [
    { id: 'cash', label: 'Efectivo', icon: GSIcon, color: 'text-muted-foreground' },
    { id: 'card', label: 'Tarjeta', icon: CreditCard, color: 'text-muted-foreground' },
    { id: 'transfer', label: 'Transferencia', icon: Users, color: 'text-muted-foreground' },
    { id: 'credit', label: 'Crédito', icon: Clock, color: 'text-muted-foreground' }
  ]
  const existingCreditPrincipal = React.useMemo(
    () => paymentSplit
      .filter(split => split.method === 'credit')
      .reduce((total, split) => total + split.amount, 0),
    [paymentSplit]
  )
  const creditSplitPlan = React.useMemo(() => buildCreditInstallmentPlan({
    principalAmount: Math.max(0, existingCreditPrincipal + splitAmount),
    interestRate: creditTerms.interestRate,
    installmentCount: creditTerms.count,
    frequency: creditTerms.frequency,
  }), [creditTerms.count, creditTerms.frequency, creditTerms.interestRate, existingCreditPrincipal, splitAmount])
  const canUseMixedCredit = Boolean(
    creditSummary && creditSummary.availableCredit >= creditSplitPlan.financedTotal
  )
  const handleProductPlanSelect = React.useCallback((plan: CartProductCreditPlan) => {
    applyProductCreditSuggestion(plan)
    const allocation = getProductCreditAllocation(plan, cartTotal)

    if (allocation.dueNow <= 0) return

    setPaymentSplit(buildProductCreditPayments(plan, cartTotal, () => crypto.randomUUID()))
    setIsMixedPayment(true)
    setPaymentMethod('')
    setSplitAmount(0)
    toast.info('Venta separada automáticamente', {
      description: `${formatCurrency(allocation.financedPrincipal)} a crédito y ${formatCurrency(allocation.dueNow)} para pagar ahora.`,
    })
  }, [applyProductCreditSuggestion, cartTotal, formatCurrency, setIsMixedPayment, setPaymentMethod, setPaymentSplit, setSplitAmount])

  return (
    <div className="space-y-4">
      {/* Toggle entre pago simple y mixto */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold">¿Cómo paga el cliente?</h4>
          <p className="text-xs text-muted-foreground">Seleccioná una opción para continuar.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const nextMixed = !isMixedPayment
            setIsMixedPayment(nextMixed)
            setPaymentMethod(nextMixed ? '' : 'cash')
            setSplitAmount(0)
            if (!nextMixed) setPaymentSplit([])
          }}
          className="shrink-0 text-xs"
        >
          {isMixedPayment ? 'Pago Simple' : 'Pago Mixto'}
        </Button>
      </div>

      {!isMixedPayment ? (
        // Pago simple
        <div className="space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {paymentMethods.map(method => (
            <Button
              key={method.id}
              variant={paymentMethod === method.id ? "default" : "outline"}
              aria-pressed={paymentMethod === method.id}
              className={`h-auto min-h-16 w-full flex-col items-start justify-center gap-1 px-3 py-2 text-left transition-all ${
                method.id === 'credit' && !canUseCredit 
                  ? 'opacity-70' // Visualmente distinto pero interactivo
                  : paymentMethod === method.id 
                  ? 'ring-2 ring-primary ring-offset-1'
                  : 'hover:bg-accent'
              }`}
              onClick={() => setPaymentMethod(method.id)}
              // Permitimos seleccionar crédito incluso si no es válido para mostrar la advertencia
              // disabled={method.id === 'credit' && !canUseCredit}
            >
              <span className="flex w-full items-center gap-2">
                <method.icon className={`h-4 w-4 ${method.color}`} aria-hidden="true" />
                <span className="font-semibold">{method.label}</span>
              </span>
              {method.id === 'credit' && (
                <div className="flex min-h-4 w-full flex-col items-start">
                  {creditSummary && (creditSummary.availableCredit + creditSummary.usedCredit) > 0 ? (
                    // Cliente con crédito configurado
                    <>
                      <span className={`text-xs font-semibold ${
                        canUseCredit ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                        {canUseCredit ? 
                          `${formatCurrency(creditSummary.availableCredit)}` : 
                          'Insuficiente'
                        }
                      </span>
                      {canUseCredit && (
                        <span className="text-[10px] text-muted-foreground">
                          disponible
                        </span>
                      )}
                    </>
                  ) : (
                    // Cliente sin crédito configurado
                    <span className="text-[10px] text-muted-foreground">
                      No habilitado
                    </span>
                  )}
                </div>
              )}
            </Button>
            ))}
          </div>
          
          {/* Cobrar una cuota de un credito ya activo, sin depender de esta
              venta -por ejemplo si vino solo a pagar, o si de paso quiere
              pagar antes de llevarse algo nuevo-. Es el mismo dialogo que
              ya existe en el paso 1 (Cliente); esto solo lo hace alcanzable
              desde donde el cajero esta parado. */}
          {paymentMethod === 'credit' && activeCustomer && setShowCreditHistory && creditSummary && creditSummary.usedCredit > 0 && (
            <button
              type="button"
              onClick={() => setShowCreditHistory(true)}
              className="mt-2 flex w-full items-center justify-between rounded-lg border border-blue-200 bg-blue-50/60 px-3 py-2 text-left text-xs font-medium text-blue-800 transition-colors hover:bg-blue-100 dark:border-blue-800/60 dark:bg-blue-950/20 dark:text-blue-300 dark:hover:bg-blue-950/40"
            >
              <span>¿Vino a pagar una cuota de su crédito? Cobrala acá.</span>
              <span className="shrink-0 font-semibold underline">Cobrar cuota</span>
            </button>
          )}

          {/* Información adicional para venta a crédito */}
          {paymentMethod === 'credit' && (
            <ProductCreditPlanPicker
              cartTotal={cartTotal}
              plans={productCreditPlans}
              selectedPlan={creditPlanSuggestion}
              onSelect={handleProductPlanSelect}
              formatCurrency={formatCurrency}
            />
          )}

          {paymentMethod === 'credit' && canUseCredit && creditSummary && (
            <>
              <CreditStatusPanel
                cartTotal={cartTotal}
                creditSummary={creditSummary}
                terms={creditTerms}
                suggestion={creditPlanSuggestion}
                onTermsChange={setCreditTerms}
                formatCurrency={formatCurrency}
              />

              {/* Adelanto manual: cobrar una parte ahora y financiar el resto.
                  Arma el mismo split de Pago Mixto, pero guiado desde el
                  boton de Credito en vez de requerir que el cajero sepa
                  cambiar a Pago Mixto por su cuenta. */}
              <div className="mt-3 rounded-lg border border-dashed border-blue-300/60 bg-blue-50/40 p-3 dark:border-blue-800/60 dark:bg-blue-950/20">
                <label className="text-xs font-semibold text-blue-800 dark:text-blue-300">
                  ¿El cliente va a dar un adelanto?
                </label>
                <p className="mt-0.5 text-[11px] text-blue-700/80 dark:text-blue-400/80">
                  Cobrá una parte ahora y financiá el resto a crédito.
                </p>
                <div className="mt-2 grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_auto_auto]">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">₲</span>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder={`Ej: ${formatCurrency(Math.round(cartTotal * 0.3))}`}
                      value={formatThousands(downPaymentInput)}
                      onChange={(e) => setDownPaymentInput(parseThousands(e.target.value) > 0 ? String(parseThousands(e.target.value)) : '')}
                      onFocus={(e) => e.target.select()}
                      className="pl-7 font-bold font-mono"
                    />
                  </div>
                  <Select value={downPaymentMethod} onValueChange={(value) => setDownPaymentMethod(value as 'cash' | 'card' | 'transfer')}>
                    <SelectTrigger className="w-full sm:w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Efectivo</SelectItem>
                      <SelectItem value="card">Tarjeta</SelectItem>
                      <SelectItem value="transfer">Transferencia</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="sm"
                    className="col-span-2 sm:col-span-1"
                    disabled={downPaymentAmount <= 0}
                    onClick={handleApplyDownPayment}
                  >
                    Aplicar adelanto
                  </Button>
                </div>
                {downPaymentAmount > 0 && (
                  <p className="mt-2 text-[11px] text-blue-800 dark:text-blue-300">
                    Financia <strong>{formatCurrency(Math.max(0, cartTotal - downPaymentAmount))}</strong> a crédito.
                  </p>
                )}
              </div>
            </>
          )}

          {/* Advertencia y opciones para habilitar crédito si no tiene crédito suficiente */}
          {paymentMethod === 'credit' && !canUseCredit && (
            <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div className="flex-1 space-y-1">
                  {!activeCustomer ? (
                    <div>
                      <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                        Cliente no seleccionado
                      </p>
                      <p className="text-xs text-amber-800 dark:text-amber-300">
                        Debes seleccionar un cliente en el panel para procesar ventas a crédito.
                      </p>
                    </div>
                  ) : (!creditSummary || (creditSummary.availableCredit + creditSummary.usedCredit) === 0) ? (
                    <div>
                      <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                        Crédito no habilitado para {activeCustomer.name}
                      </p>
                      <p className="text-xs text-amber-800 dark:text-amber-300">
                        El cliente no tiene un límite de crédito activo (₲ 0). Puedes asignarle una línea de crédito con 1 clic para continuar:
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                        Crédito insuficiente para esta venta
                      </p>
                      <p className="text-xs text-amber-800 dark:text-amber-300">
                        Disponible: <strong className="text-emerald-700 dark:text-emerald-400 font-mono">{formatCurrency(creditSummary.availableCredit)}</strong> · Requerido: <strong className="font-mono">{formatCurrency(cartTotal)}</strong>
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {activeCustomer && (
                <div className="pt-2 border-t border-amber-500/20 space-y-2">
                  <span className="text-xs font-semibold text-amber-900 dark:text-amber-200 block">
                    Opciones rápidas para habilitar crédito:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={isEnablingCredit}
                      onClick={() => handleEnableCredit(Math.max(1000000, cartTotal))}
                      className="h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                    >
                      {isEnablingCredit ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Habilitar {formatCurrency(Math.max(1000000, cartTotal))}
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isEnablingCredit}
                      onClick={() => handleEnableCredit(2000000)}
                      className="h-8 text-xs bg-card border-amber-300 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-950/40"
                    >
                      Límite ₲ 2.000.000
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isEnablingCredit}
                      onClick={() => handleEnableCredit(5000000)}
                      className="h-8 text-xs bg-card border-amber-300 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-950/40"
                    >
                      Límite ₲ 5.000.000
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowCustomLimitInput(!showCustomLimitInput)}
                      className="h-8 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {showCustomLimitInput ? 'Cancelar' : 'Otro monto...'}
                    </Button>
                  </div>

                  {showCustomLimitInput && (
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-amber-500/20">
                      <div className="relative flex-1">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">₲</span>
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder="Ingresar nuevo límite"
                          value={formatThousands(customCreditLimit)}
                          onChange={(e) => {
                            const raw = parseThousands(e.target.value)
                            setCustomCreditLimit(raw > 0 ? String(raw) : (e.target.value === '' ? '' : '0'))
                          }}
                          className="h-8 pl-6 text-xs font-mono font-bold"
                        />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        disabled={isEnablingCredit || !customCreditLimit || Number(customCreditLimit) <= 0}
                        onClick={() => handleEnableCredit(Number(customCreditLimit))}
                        className="h-8 px-3 text-xs bg-primary"
                      >
                        {isEnablingCredit ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                        Guardar Límite
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        // Pago mixto
        <div className="space-y-4">
          <ProductCreditPlanPicker
            cartTotal={cartTotal}
            plans={productCreditPlans}
            selectedPlan={creditPlanSuggestion}
            onSelect={handleProductPlanSelect}
            formatCurrency={formatCurrency}
          />
          <div className="bg-muted rounded-lg p-3">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Total a pagar:</span>
              <span className="font-bold text-primary">{formatCurrency(cartTotal)}</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm">Pagado:</span>
              <span className="font-medium text-primary">{formatCurrency(getTotalPaid())}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Restante:</span>
              <span className={`font-medium ${getRemainingAmount() > 0 ? 'text-destructive' : 'text-primary'}`}>
                {formatCurrency(getRemainingAmount())}
              </span>
            </div>
          </div>

          {/* Lista de pagos agregados */}
          {paymentSplit.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Pagos agregados:</h4>
              {paymentSplit.map(split => (
                <div key={split.id} className="flex items-center justify-between bg-card border border-border rounded p-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm capitalize">{split.method}</span>
                    {split.reference && (
                      <span className="text-xs text-muted-foreground">({split.reference})</span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">{formatCurrency(split.amount)}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removePaymentSplit(split.id)}
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                      aria-label={`Eliminar pago de ${formatCurrency(split.amount)}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {paymentSplit.length >= 10 && (
            <p className="text-xs font-medium text-destructive" role="alert">
              Se alcanzó el máximo de 10 formas de pago por venta.
            </p>
          )}

          {/* Agregar nuevo pago */}
          <div className="border rounded-lg p-3 space-y-3">
            <h4 className="text-sm font-medium">Agregar pago:</h4>
            <div className="grid grid-cols-2 gap-2">
              {paymentMethods.map(method => (
                <Button
                  key={method.id}
                  variant="outline"
                  size="sm"
                  onClick={() => setPaymentMethod(method.id)}
                  className={paymentMethod === method.id ? 'bg-accent ring-1 ring-ring' : ''}
                  disabled={
                    paymentSplit.length >= 10 ||
                    (method.id === 'credit' && (!creditSummary || creditSummary.availableCredit <= 0))
                  }
                >
                  <method.icon className="h-3 w-3 mr-1" />
                  {method.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Campos específicos por método de pago */}
      {paymentMethod === 'cash' && !isMixedPayment && (
        <div className="mt-4">
          <label className="text-sm font-medium mb-2 block">Efectivo recibido</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">₲</span>
            <Input
              type="text"
              inputMode="numeric"
              value={formatThousands(localCashInput)}
              onChange={(e) => {
                const raw = parseThousands(e.target.value)
                setLocalCashInput(raw > 0 ? String(raw) : (e.target.value === '' ? '' : '0'))
                setCashReceived(raw)
              }}
              onFocus={(e) => e.target.select()}
              placeholder="0"
              className="pl-7 font-bold font-mono text-base"
            />
          </div>
          
          {/* Sugerencias rápidas de billetes y montos exactos */}
          <div className="mt-2.5 flex flex-wrap gap-1.5 items-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-xs font-semibold bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
              onClick={() => {
                setLocalCashInput(cartTotal.toString())
                setCashReceived(cartTotal)
              }}
            >
              Monto Exacto ({formatCurrency(cartTotal)})
            </Button>
            {getSmartSuggestions(cartTotal, currency).map((suggestion) => (
              <Button
                key={suggestion}
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs bg-card hover:bg-primary hover:text-primary-foreground transition-all duration-150 border-border/70 font-medium"
                onClick={() => {
                  setLocalCashInput(suggestion.toString())
                  setCashReceived(suggestion)
                }}
              >
                {formatCurrency(suggestion)}
              </Button>
            ))}
            {localCashInput !== '' && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                onClick={() => {
                  setLocalCashInput('')
                  setCashReceived(0)
                }}
              >
                Limpiar
              </Button>
            )}
          </div>

          {/* Indicador de Restante / Falta Cobrar */}
          {cashRemaining > 0 && (
            <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 flex items-center justify-between text-xs">
              <span className="font-semibold">Falta cobrar:</span>
              <span className="font-bold text-sm tabular-nums">{formatCurrency(cashRemaining)}</span>
            </div>
          )}

          {/* Indicador GIGANTE de Vuelto / Cambio a Entregar */}
          {cashChange > 0 && (
            <div className="mt-3 p-3.5 rounded-xl bg-emerald-500/15 border-2 border-emerald-500/40 text-emerald-900 dark:text-emerald-200 flex items-center justify-between shadow-sm animate-in fade-in-50 duration-200">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  💵 Vuelto a Entregar
                </p>
                <p className="text-2xl font-black tabular-nums text-emerald-600 dark:text-emerald-300">
                  {formatCurrency(cashChange)}
                </p>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <p>Cobrado: <strong className="text-foreground">{formatCurrency(cashReceived)}</strong></p>
                <p>Total ticket: <strong className="text-foreground">{formatCurrency(cartTotal)}</strong></p>
              </div>
            </div>
          )}
        </div>
      )}

      {paymentMethod === 'card' && !isMixedPayment && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div><label className="text-sm font-medium mb-2 block">Proveedor</label><Input list="electronic-providers" value={electronicProvider} onChange={(e) => setElectronicProvider(e.target.value)} placeholder="Bancard, Pagopar..." /></div>
          <div><label className="text-sm font-medium mb-2 block">Terminal</label><Input value={terminalId} onChange={(e) => setTerminalId(e.target.value)} placeholder="POS-01" /></div>
          <div><label className="text-sm font-medium mb-2 block">Entidad</label><Input value={electronicInstitution} onChange={(e) => setElectronicInstitution(e.target.value)} placeholder="Banco emisor" /></div>
          <div><label className="text-sm font-medium mb-2 block">Últimos 4 dígitos</label><Input type="text" inputMode="numeric" value={cardNumber} onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="1234" maxLength={4} /></div>
        </div>
      )}

      {paymentMethod === 'transfer' && !isMixedPayment && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div><label className="text-sm font-medium mb-2 block">Canal</label><Select value={electronicChannel} onValueChange={(value) => { const channel = value as 'bank_transfer' | 'qr'; setElectronicChannel(channel); if (channel === 'qr' && !electronicProvider) setElectronicProvider('Pagopar') }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="bank_transfer">Transferencia bancaria</SelectItem><SelectItem value="qr">QR</SelectItem></SelectContent></Select></div>
          <div><label className="text-sm font-medium mb-2 block">Proveedor</label><Input list="electronic-providers" value={electronicProvider} onChange={(e) => setElectronicProvider(e.target.value)} placeholder="Banco o Pagopar" /></div>
          <div><label className="text-sm font-medium mb-2 block">Banco o entidad</label><Input list="financial-institutions" value={electronicInstitution} onChange={(e) => setElectronicInstitution(e.target.value)} placeholder="Entidad receptora" /></div>
          <div><label className="text-sm font-medium mb-2 block">Referencia</label><Input type="text" value={transferReference} onChange={(e) => setTransferReference(e.target.value)} placeholder="Número de referencia" /></div>
        </div>
      )}

      <datalist id="electronic-providers"><option value="Bancard" /><option value="Pagopar" /><option value="Dinelco" /><option value="Terminal POS" /></datalist>
      <datalist id="financial-institutions"><option value="Banco Nacional de Fomento" /><option value="Banco Continental" /><option value="Banco Familiar" /><option value="Banco Atlas" /><option value="Banco Itaú" /><option value="Sudameris" /><option value="ueno bank" /><option value="Bancop" /></datalist>

      {/* Campos para pago mixto */}
      {isMixedPayment && paymentMethod && (
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-sm font-medium mb-2 block">Monto a pagar con {paymentMethod}</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">₲</span>
              <Input
                type="text"
                inputMode="numeric"
                placeholder={`Máximo: ${formatCurrency(getRemainingAmount())}`}
                value={formatThousands(localSplitInput)}
                onChange={(e) => {
                  const raw = parseThousands(e.target.value)
                  setLocalSplitInput(raw > 0 ? String(raw) : (e.target.value === '' ? '' : '0'))
                  setSplitAmount(raw)
                }}
                onFocus={(e) => e.target.select()}
                className="pl-7 font-bold font-mono"
              />
            </div>
          </div>

          {getRemainingAmount() > 0.01 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const remaining = getRemainingAmount()
                setLocalSplitInput(remaining.toString())
                setSplitAmount(remaining)
              }}
            >
              Usar restante: {formatCurrency(getRemainingAmount())}
            </Button>
          )}

          {paymentMethod === 'credit' && creditSummary && splitAmount > 0 && (
            <CreditStatusPanel
              cartTotal={splitAmount}
              creditSummary={creditSummary}
              terms={creditTerms}
              suggestion={creditPlanSuggestion}
              onTermsChange={setCreditTerms}
              formatCurrency={formatCurrency}
            />
          )}

          {paymentMethod === 'card' && (
            <div>
              <label className="text-sm font-medium mb-2 block">Últimos 4 dígitos</label>
              <Input
                type="text"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="1234"
                maxLength={4}
              />
            </div>
          )}

          {paymentMethod === 'transfer' && (
            <div>
              <label className="text-sm font-medium mb-2 block">Referencia</label>
              <Input
                type="text"
                value={transferReference}
                onChange={(e) => setTransferReference(e.target.value)}
                placeholder="Número de referencia"
              />
            </div>
          )}

          {(paymentMethod === 'card' || paymentMethod === 'transfer') && (
            <div className="grid gap-3 sm:grid-cols-2">
              {paymentMethod === 'transfer' && (
                <div><label className="text-sm font-medium mb-2 block">Canal</label><Select value={electronicChannel} onValueChange={(value) => { const channel = value as 'bank_transfer' | 'qr'; setElectronicChannel(channel); if (channel === 'qr' && !electronicProvider) setElectronicProvider('Pagopar') }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="bank_transfer">Transferencia</SelectItem><SelectItem value="qr">QR</SelectItem></SelectContent></Select></div>
              )}
              <div><label className="text-sm font-medium mb-2 block">Proveedor</label><Input list="electronic-providers" value={electronicProvider} onChange={(e) => setElectronicProvider(e.target.value)} placeholder="Proveedor" /></div>
              <div><label className="text-sm font-medium mb-2 block">Entidad</label><Input list="financial-institutions" value={electronicInstitution} onChange={(e) => setElectronicInstitution(e.target.value)} placeholder="Banco o entidad" /></div>
              {paymentMethod === 'card' && <div><label className="text-sm font-medium mb-2 block">Terminal</label><Input value={terminalId} onChange={(e) => setTerminalId(e.target.value)} placeholder="POS-01" /></div>}
            </div>
          )}

          <Button
            onClick={() => {
              const amount = Number(splitAmount)
              const requiresCard = paymentMethod === 'card'
              const requiresRef = paymentMethod === 'transfer'
              const isCardOk = !requiresCard || (cardNumber && cardNumber.length === 4)
              const isRefOk = !requiresRef || !!transferReference
              
              if (amount > 0 && amount <= getRemainingAmount() && isCardOk && isRefOk) {
                addPaymentSplit(
                  paymentMethod,
                  amount,
                  paymentMethod === 'transfer' ? transferReference :
                    paymentMethod === 'card' ? cardNumber : undefined
                )
                setSplitAmount(0)
                setPaymentMethod('')
                setCardNumber('')
                setTransferReference('')
                setElectronicProvider('')
                setElectronicInstitution('')
                setElectronicChannel('bank_transfer')
                setTerminalId('')
              }
            }}
            className="w-full"
            disabled={
              !paymentMethod ||
              splitAmount <= 0 ||
              splitAmount > getRemainingAmount() ||
              paymentSplit.length >= 10 ||
              (paymentMethod === 'card' && cardNumber.length < 4) ||
              (paymentMethod === 'transfer' && !transferReference) ||
              (paymentMethod === 'credit' && !canUseMixedCredit)
            }
          >
            Agregar Pago
          </Button>
          {paymentMethod === 'credit' && splitAmount > 0 && !canUseMixedCredit && (
            <p className="text-xs font-medium text-destructive" role="alert">
              El crédito disponible no cubre el monto financiado de esta parte.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
