'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useTenantScope } from '@/hooks/use-tenant-scope'
import { useActiveOrganization } from '@/contexts/ActiveOrganizationContext'
import { useBranch } from '@/contexts/branch-context'
import { useAuth } from '@/contexts/auth-context'
import { useSubscriptionStatus } from '@/contexts/SubscriptionStatusContext'
import { branchHeaders } from '@/lib/branches/client'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/currency'
import { useSales } from '@/hooks/useSales'
import { Calendar, User, CreditCard, ShoppingCart, Receipt, Printer, ShieldAlert, Ban, Loader2, MoreHorizontal, RefreshCw, AlertTriangle, Building2 } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { printReceipt, CompanyInfo } from '@/lib/receipt-utils'
import { buildReprintReceiptData, type StoredSale } from '@/lib/after-sales/sale-receipt'
import { useSharedSettings } from '@/hooks/use-shared-settings'
import { CreateAfterSalesCaseDialog } from '@/components/dashboard/after-sales/CreateAfterSalesCaseDialog'
import { paymentMethodLabel } from '@/lib/i18n/labels'

export interface SaleDetailItem {
  id: string
  product_id?: string
  product_name?: string
  products?: { name?: string; sku?: string } | null
  sku?: string
  quantity: number
  price?: number
  unit_price?: number
  discount?: number
  /** Columna real de sale_items: el descuento de la línea en moneda. */
  discount_amount?: number | null
  subtotal?: number
  total?: number
  is_service?: boolean
}

export interface SaleDetailPayment {
  id: string
  method?: string
  payment_method?: string
  payment_index?: number
  amount: number
  reference?: string
  card_last4?: string
  created_at?: string
}

type SaleDetailCustomer = { name?: string | null; phone?: string | null; email?: string | null }

export interface SaleDetailRecord {
  id: string
  /** Código guardado por el POS (sales.code). */
  code?: string | null
  sale_number?: string
  customer?: SaleDetailCustomer | SaleDetailCustomer[] | null
  subtotal_amount?: number | null
  created_by?: string | null
  sale_payments?: SaleDetailPayment[] | null
  created_at: string
  customer_id?: string | null
  customer_name?: string | null
  cashier_id?: string | null
  cashier_name?: string | null
  branch_id?: string | null
  total_amount?: number
  total?: number
  subtotal?: number
  tax_amount?: number
  tax?: number
  discount_amount?: number
  discount?: number
  change_amount?: number
  payment_method?: string
  payment_status?: string
  /** `cancelled` cuando la venta se anuló. */
  status?: string
  notes?: string
  sale_items?: SaleDetailItem[]
  items?: SaleDetailItem[]
  payments?: SaleDetailPayment[]
}

function saleItems(sale: SaleDetailRecord) {
  return sale.sale_items || sale.items || []
}

/** Pagos de la venta: los del POS viven en sale_payments; `payments` es la tabla anterior. */
export function salePayments(sale: SaleDetailRecord): SaleDetailPayment[] {
  const rows = sale.sale_payments?.length ? sale.sale_payments : (sale.payments || [])
  return [...rows].sort((a, b) => (a.payment_index ?? 0) - (b.payment_index ?? 0))
}

export function saleReference(sale: SaleDetailRecord) {
  return sale.code || sale.sale_number || sale.id.slice(0, 8).toUpperCase()
}

/**
 * Subtotal bruto guardado. Antes se mostraba total - IVA: con precios con IVA
 * incluido y un descuento, «Subtotal - Descuento» no daba el total.
 */
export function saleSubtotal(sale: SaleDetailRecord) {
  return Number(sale.subtotal_amount ?? sale.subtotal ?? (Number(sale.total_amount ?? sale.total ?? 0) + Number(sale.discount_amount ?? sale.discount ?? 0)))
}

export function toStoredSale(sale: SaleDetailRecord): StoredSale {
  const customer = Array.isArray(sale.customer) ? sale.customer[0] : sale.customer
  return {
    id: sale.id,
    code: sale.code || sale.sale_number || null,
    createdAt: sale.created_at,
    subtotal: saleSubtotal(sale),
    tax: Number(sale.tax_amount ?? sale.tax ?? 0),
    discount: Number(sale.discount_amount ?? sale.discount ?? 0),
    total: Number(sale.total_amount ?? sale.total ?? 0),
    paymentMethod: sale.payment_method ?? null,
    cashierName: sale.cashier_name ?? null,
    customer: customer?.name ? customer : (sale.customer_name ? { name: sale.customer_name } : null),
    items: saleItems(sale).map(item => ({
      id: item.id,
      product_id: item.product_id ?? null,
      name: item.product_name || item.products?.name || 'Producto',
      sku: item.products?.sku || item.sku || null,
      quantity: Number(item.quantity || 1),
      unitPrice: Number(item.unit_price ?? item.price ?? 0),
      discount: item.discount_amount ?? item.discount ?? null,
    })),
    payments: salePayments(sale).map(payment => ({
      id: payment.id,
      method: payment.payment_method ?? payment.method,
      amount: Number(payment.amount) || 0,
      reference: payment.reference ?? null,
    })),
  }
}

interface SaleDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  saleId: string | null
  onSaleChanged?: () => void | Promise<void>
}

/** Un nuevo ámbito o venta desmonta su detalle y sus confirmaciones. */
export function SaleDetailsModal(props: SaleDetailsModalProps) {
  const { scope, organizationId } = useTenantScope()
  const { organization, isLoading } = useActiveOrganization()
  const { selectedBranchId } = useBranch()
  if (!props.isOpen || !props.saleId || isLoading || !organizationId || organizationId !== organization?.id) return null
  return <SaleDetailsContent key={`${scope}:${selectedBranchId}:${props.saleId}`} {...props} />
}

export function salePaymentSummary(sale: SaleDetailRecord) {
  const payments = salePayments(sale)
  const financed = payments.filter(p => ['credit', 'credito', 'crédito'].includes(p.payment_method ?? p.method ?? '')).reduce((sum, p) => sum + Number(p.amount || 0), 0)
  const applied = payments.filter(p => !['credit', 'credito', 'crédito'].includes(p.payment_method ?? p.method ?? '')).reduce((sum, p) => sum + Number(p.amount || 0), 0)
  return { applied: payments.length ? applied : null, financed: payments.length ? financed : null }
}

function SaleDetailsContent({ isOpen, onClose, saleId, onSaleChanged }: SaleDetailsModalProps) {
  const { getSale } = useSales(false)
  const { settings, isLoading: settingsLoading, error: settingsError, scope: settingsScope } = useSharedSettings()
  const { scope, currentScope } = useTenantScope()
  const { branches, selectedBranchId } = useBranch()
  const { user, hasPermission } = useAuth()
  const { effectiveModules } = useSubscriptionStatus()
  const [sale, setSale] = useState<SaleDetailRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)
  const [afterSalesOpen, setAfterSalesOpen] = useState(false)
  const [voidOpen, setVoidOpen] = useState(false)
  const [voidReason, setVoidReason] = useState('')
  const [voiding, setVoiding] = useState(false)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const isCurrent = () => alive.current && currentScope.current === scope
  const isVoided = sale?.status === 'cancelled'
  const canVoid = hasPermission('pos.cash.manage')
  const canAfterSales = hasPermission('crm.customers.manage') && effectiveModules.includes('crm')

  useEffect(() => {
    let active = true
    setLoading(true)
    setSale(null)
    void getSale(saleId!).then(data => {
      if (active && currentScope.current === scope) { setSale(data); setLoading(false) }
    }).catch(() => { if (active && currentScope.current === scope) setLoading(false) })
    return () => { active = false }
  }, [saleId, getSale, retry, scope, currentScope])

  const handleVoid = async () => {
    if (!sale || voiding || !canVoid || isVoided || !isCurrent()) return
    setVoiding(true)
    try {
      const params = new URLSearchParams({ id: sale.id })
      if (voidReason.trim()) params.set('reason', voidReason.trim())
      const response = await fetch(`/api/sales?${params}`, { method: 'DELETE', headers: branchHeaders(selectedBranchId) })
      const payload = await response.json().catch(() => null) as { success?: boolean; error?: string; message?: string } | null
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'No se pudo anular la venta.')
      if (!isCurrent()) return
      setSale({ ...sale, status: 'cancelled' })
      setVoidOpen(false)
      setVoidReason('')
      toast.success(payload.message || 'Venta anulada')
      try { await onSaleChanged?.() } catch { toast.error('La venta se anuló, pero el resumen necesita actualizarse.') }
    } catch (error) {
      if (isCurrent()) toast.error(error instanceof Error ? error.message : 'No se pudo anular la venta.')
    } finally { if (isCurrent()) setVoiding(false) }
  }

  const handlePrintReceipt = () => {
    if (!sale || isVoided || !isCurrent() || settingsLoading || settingsError || settingsScope !== 'organization') return
    if (!settings.companyName.trim() || settings.companyName === 'Mi Empresa') {
      toast.error('Completá los datos del negocio antes de imprimir el comprobante.')
      return
    }
    const companyInfo: CompanyInfo = {
      name: settings.companyName, address: settings.companyAddress, phone: settings.companyPhone,
      email: settings.companyEmail, ruc: settings.companyRuc,
    }
    try { printReceipt(buildReprintReceiptData(toStoredSale(sale)), companyInfo) }
    catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo preparar el comprobante.') }
  }

  const customer = sale ? toStoredSale(sale).customer : null
  const paymentSummary = sale ? salePaymentSummary(sale) : null
  const branch = branches.find(branch => branch.id === sale?.branch_id)
  const cashier = sale?.cashier_name || ((sale?.created_by || sale?.cashier_id) === user?.id ? user?.profile?.name : null)
  const paymentStatus = ({ paid: 'Pagada', pending: 'Pendiente de pago', partial: 'Pago parcial', unpaid: 'Sin pagar', refunded: 'Reembolsada', cancelled: 'Anulada' } as Record<string, string>)[sale?.payment_status ?? ''] || 'Estado de pago no informado'

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open && !voiding) onClose() }}>
      <DialogContent className="flex max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-3xl sm:max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b bg-muted/20 px-5 pb-4 pt-5 text-left sm:px-6">
          <div className="flex items-start gap-3 pr-7">
            <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><Receipt className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg">Detalle de la venta</DialogTitle>
              <DialogDescription className="mt-1 break-all text-xs">{sale ? saleReference(sale) : 'Consultá los datos y pagos registrados.'}</DialogDescription>
            </div>
          </div>
          {sale && !loading && <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
            <Badge variant={isVoided ? 'destructive' : 'secondary'}>{isVoided ? 'Venta anulada' : paymentStatus}</Badge>
            <div className="flex items-center gap-2">
              {(canVoid || canAfterSales) && !isVoided && <DropdownMenu>
                <DropdownMenuTrigger asChild><Button size="sm" variant="outline" disabled={voiding}><MoreHorizontal className="mr-1 h-4 w-4" />Más</Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {canAfterSales && <DropdownMenuItem onSelect={() => setAfterSalesOpen(true)}><ShieldAlert className="mr-2 h-4 w-4" />Gestionar posventa</DropdownMenuItem>}
                  {canVoid && <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setVoidOpen(true)}><Ban className="mr-2 h-4 w-4" />Anular venta</DropdownMenuItem>}
                </DropdownMenuContent>
              </DropdownMenu>}
            </div>
          </div>}
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-6">
          {loading && <div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Cargando detalle...</div>}
          {!loading && !sale && <div role="alert" className="rounded-xl border border-dashed p-6 text-center">
            <AlertTriangle className="mx-auto mb-3 h-7 w-7 text-amber-600" /><p className="font-medium">No pudimos cargar esta venta</p>
            <p className="mt-1 text-sm text-muted-foreground">Revisá tu conexión, la empresa y la sucursal seleccionadas.</p>
            <Button className="mt-4" variant="outline" onClick={() => setRetry(n => n + 1)}><RefreshCw className="mr-2 h-4 w-4" />Reintentar</Button>
          </div>}
          {!loading && sale && <>
            {isVoided && <p role="status" className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">Esta venta está anulada. Los importes de abajo son el registro original; no representan un cobro vigente. Su copia está deshabilitada.</p>}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="col-span-2 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:col-span-1"><p className="text-xs font-medium text-muted-foreground">Total de la venta</p><p className="mt-1 break-words text-2xl font-bold text-primary">{formatCurrency(sale.total_amount ?? sale.total)}</p></div>
              <div className="rounded-xl border bg-card p-4"><p className="text-xs font-medium text-muted-foreground">Pagado al realizar la venta</p><p className="mt-1 break-words text-lg font-semibold">{paymentSummary?.applied == null ? 'Sin desglose' : formatCurrency(paymentSummary.applied)}</p></div>
              <div className="rounded-xl border bg-card p-4"><p className="text-xs font-medium text-muted-foreground">Importe financiado</p><p className="mt-1 break-words text-lg font-semibold">{paymentSummary?.financed == null ? 'Sin desglose' : formatCurrency(paymentSummary.financed)}</p></div>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">Estos importes corresponden al momento de la venta e incluyen el saldo a favor utilizado. Para ver cuotas posteriores o la deuda actual, consultá Créditos.</p>
            {settingsError && <p className="text-xs text-amber-700 dark:text-amber-400">No se pudieron cargar los datos del negocio. La impresión está deshabilitada.</p>}
            <Card className="shadow-none"><CardContent className="grid gap-5 pt-5 sm:grid-cols-2">
              <div className="min-w-0"><p className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground"><User className="h-4 w-4" />Cliente</p><p className="break-words font-semibold">{customer?.name || 'Consumidor final'}</p>{customer?.phone && <p className="mt-1 break-words text-sm text-muted-foreground">{customer.phone}</p>}{customer?.email && <p className="break-all text-sm text-muted-foreground">{customer.email}</p>}</div>
              <div className="min-w-0 space-y-2 text-sm"><p className="flex items-center gap-2"><Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />{new Date(sale.created_at).toLocaleString('es-PY')}</p><p className="flex items-start gap-2 break-all"><Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />Sucursal: {branch?.name || 'Nombre no disponible'}</p><p className="break-all text-muted-foreground">Cajero: {cashier || 'Nombre no disponible'}</p></div>
            </CardContent></Card>
            <Card className="shadow-none"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm"><ShoppingCart className="h-4 w-4 text-primary" />Productos y servicios <span className="ml-auto text-xs text-muted-foreground">{saleItems(sale).length} ítems</span></CardTitle></CardHeader>
              <CardContent><div className="divide-y">{saleItems(sale).map(item => <div key={item.id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0"><p className="break-words text-sm font-medium">{item.product_name || item.products?.name || (item.is_service ? 'Servicio' : 'Producto')}</p><p className="mt-1 text-xs text-muted-foreground">{item.quantity} × {formatCurrency(item.unit_price ?? item.price ?? 0)}</p>{(item.products?.sku || item.sku) && <p className="mt-1 break-all text-xs text-muted-foreground">SKU: {item.products?.sku || item.sku}</p>}{Number(item.discount_amount ?? item.discount ?? 0) > 0 && <p className="mt-1 text-xs text-primary">Descuento: −{formatCurrency(item.discount_amount ?? item.discount)}</p>}</div>
                <p className="shrink-0 text-sm font-semibold tabular-nums">{formatCurrency(item.subtotal ?? item.total ?? (Number(item.quantity) * Number(item.unit_price ?? item.price ?? 0) - Number(item.discount_amount ?? item.discount ?? 0)))}</p>
              </div>)}{!saleItems(sale).length && <p className="py-4 text-sm text-muted-foreground">No se guardó el detalle de los ítems.</p>}</div>
              <div className="mt-4 space-y-2 rounded-xl bg-muted/40 p-4 text-sm"><div className="flex justify-between gap-3"><span>Subtotal</span><span>{formatCurrency(saleSubtotal(sale))}</span></div>{Number(sale.discount_amount ?? sale.discount ?? 0) > 0 && <div className="flex justify-between gap-3"><span>Descuento</span><span>−{formatCurrency(sale.discount_amount ?? sale.discount)}</span></div>}<div className="flex justify-between gap-3 text-muted-foreground"><span>IVA informado</span><span>{formatCurrency(sale.tax_amount ?? sale.tax ?? 0)}</span></div><Separator /><div className="flex justify-between gap-3 font-bold"><span>Total</span><span>{formatCurrency(sale.total_amount ?? sale.total)}</span></div></div>
              </CardContent></Card>
            <Card className="shadow-none"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm"><CreditCard className="h-4 w-4 text-primary" />Medios de pago de la venta</CardTitle></CardHeader><CardContent>
              <div className="divide-y">{salePayments(sale).map(payment => <div key={payment.id} className="flex items-start justify-between gap-3 py-3 first:pt-0"><div className="min-w-0"><p className="text-sm font-medium">{paymentMethodLabel(payment.payment_method ?? payment.method)}</p>{payment.reference && <p className="mt-1 break-all text-xs text-muted-foreground">Referencia: {payment.reference}</p>}{payment.card_last4 && <p className="text-xs text-muted-foreground">Tarjeta terminada en {payment.card_last4}</p>}{payment.created_at && <p className="text-xs text-muted-foreground">{new Date(payment.created_at).toLocaleString('es-PY')}</p>}</div><p className="shrink-0 text-sm font-semibold tabular-nums">{formatCurrency(payment.amount)}</p></div>)}</div>
              {!salePayments(sale).length && <p className="text-sm text-muted-foreground">Medio declarado: {paymentMethodLabel(sale.payment_method)}. Esta venta no tiene un desglose de pagos guardado.</p>}
              {sale.change_amount != null && <p className="mt-3 flex justify-between gap-3 border-t pt-3 text-sm"><span>Vuelto registrado</span><span className="font-medium">{formatCurrency(sale.change_amount)}</span></p>}
            </CardContent></Card>
            {sale.notes && <div className="rounded-xl border p-4"><p className="mb-1 text-sm font-semibold">Notas</p><p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{sale.notes}</p></div>}
          </>}
        </div>
        {sale && !loading && <div className="shrink-0 border-t bg-background px-4 py-3 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">{isVoided ? 'No se puede reimprimir una venta anulada.' : 'La copia conserva el número y la fecha originales. No genera otra venta ni un nuevo cobro.'}</p>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" className="flex-1 sm:flex-none" disabled={voiding} onClick={onClose}>Cerrar</Button>
              <Button className="flex-1 sm:flex-none" disabled={isVoided || voiding || settingsLoading || !!settingsError || settingsScope !== 'organization'} onClick={handlePrintReceipt}><Printer className="mr-2 h-4 w-4" />Reimprimir copia</Button>
            </div>
          </div>
        </div>}
        <AlertDialog open={voidOpen && !!sale && !isVoided} onOpenChange={open => { if (!voiding) setVoidOpen(open) }}>
          <AlertDialogContent className="max-w-md"><AlertDialogHeader><AlertDialogTitle>¿Anular la venta {sale ? saleReference(sale) : ''}?</AlertDialogTitle><AlertDialogDescription className="leading-relaxed">Se devuelve el stock y se revierten los movimientos internos asociados: efectivo de caja, cuotas impagas, saldo a favor y puntos. Si cobraste una reparación, vuelve a quedar con saldo pendiente. Las transferencias y los pagos con tarjeta no se reintegran automáticamente al cliente. No se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
            <label className="space-y-2 text-sm">Motivo (opcional)<Input value={voidReason} onChange={event => setVoidReason(event.target.value)} maxLength={300} disabled={voiding} /></label>
            <AlertDialogFooter><AlertDialogCancel disabled={voiding}>Volver</AlertDialogCancel><Button variant="destructive" onClick={handleVoid} disabled={voiding}>{voiding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Sí, anular venta</Button></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {sale && canAfterSales && !isVoided && <CreateAfterSalesCaseDialog open={afterSalesOpen} onOpenChange={setAfterSalesOpen} sourceType="sale" saleId={sale.id} customerId={sale.customer_id || null} reference={saleReference(sale)} customerName={customer?.name || null} allowedRequestTypes={['product_warranty', 'exchange', 'return']} saleItems={saleItems(sale).map(item => ({ id: item.id, product_id: item.product_id ?? null, name: item.product_name || item.products?.name || 'Producto', quantity: Number(item.quantity) || 1, unitPrice: Number(item.unit_price ?? item.price) || 0, imageUrl: null }))} />}
      </DialogContent>
    </Dialog>
  )
}
