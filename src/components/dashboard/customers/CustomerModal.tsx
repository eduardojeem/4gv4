'use client'

/**
 * CustomerModal Simplificado
 *
 * Modal simplificado de cliente basado en el patrón del sistema de reparaciones:
 * - Interfaz limpia y directa
 * - Solo funcionalidades esenciales
 * - Fácil de usar y entender
 * - Formulario simplificado integrado
 */

import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  User,
  UserPlus,
  Mail,
  Phone,
  MapPin,
  Edit,
  X,
  Star,
  Calendar,
  Wallet,
  CreditCard,
  ChevronDown,
  ChevronUp,
  Info,
  AlertCircle
} from 'lucide-react'
import { Customer } from '@/hooks/use-customer-state'
import { useCustomerActions } from '@/hooks/use-customer-actions'
import { CustomerFormSimple, SimpleCustomerFormData } from '../customer-form-simple'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'

interface CustomerModalProps {
  customer: Customer | null
  isOpen: boolean
  onClose: () => void
  mode: 'view' | 'edit' | 'create'
}

export const CustomerModal: React.FC<CustomerModalProps> = ({
  customer,
  isOpen,
  onClose,
  mode: initialMode
}) => {
  const [mode, setMode] = useState(initialMode)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { updateCustomer, createCustomer } = useCustomerActions()
  const [storeBalance, setStoreBalance] = useState(0)
  const [storeMovements, setStoreMovements] = useState<Array<{ id: string; amount: number; reason: string; source_type: string; created_at: string }>>([])
  const [storeExpanded, setStoreExpanded] = useState(false)
  const [livePurchases, setLivePurchases] = useState<number | null>(null)
  const [liveSpent, setLiveSpent] = useState<number | null>(null)
  const [liveCredits, setLiveCredits] = useState<{ total: number; active: number; pendingBalance: number } | null>(null)

  useEffect(() => {
    setMode(initialMode)
  }, [initialMode])

  useEffect(() => {
    if (!isOpen || !customer?.id) {
      setStoreBalance(0)
      setStoreMovements([])
      setStoreExpanded(false)
      setLivePurchases(null)
      setLiveSpent(null)
      setLiveCredits(null)
      return
    }
    let cancelled = false
    const load = async () => {
      try {
        const [creditRes, salesRes, repairsRes, creditsRes] = await Promise.allSettled([
          fetch(`/api/customers/${customer.id}/store-credit?page=1&pageSize=10`),
          fetch(`/api/customers/${customer.id}/sales?limit=1`),
          fetch(`/api/customers/${customer.id}/repairs?limit=1`),
          fetch(`/api/customers/${customer.id}/credits`),
        ])

        if (!cancelled && creditRes.status === 'fulfilled' && creditRes.value.ok) {
          const payload = await creditRes.value.json().catch(() => null)
          if (payload?.success) {
            setStoreBalance(Number(payload.data?.balance || 0))
            setStoreMovements(payload.data?.movements ?? [])
          }
        }

        if (!cancelled && creditsRes.status === 'fulfilled' && creditsRes.value.ok) {
          const creditsPayload = await creditsRes.value.json().catch(() => null)
          if (creditsPayload?.stats) {
            setLiveCredits({
              total: creditsPayload.stats.totalCredits || 0,
              active: creditsPayload.stats.activeCredits || 0,
              pendingBalance: creditsPayload.stats.pendingBalance || 0,
            })
          }
        }

        let salesCount = 0
        let salesTotal = 0
        let repairsTotal = 0

        if (!cancelled && salesRes.status === 'fulfilled' && salesRes.value.ok) {
          const salesPayload = await salesRes.value.json().catch(() => null)
          if (salesPayload?.stats) {
            salesCount = salesPayload.stats.totalPurchases || 0
            salesTotal = salesPayload.stats.totalSpent || 0
          }
        }

        if (!cancelled && repairsRes.status === 'fulfilled' && repairsRes.value.ok) {
          const repairsPayload = await repairsRes.value.json().catch(() => null)
          if (repairsPayload?.stats) {
            repairsTotal = repairsPayload.stats.totalSpent || 0
          }
        }

        if (!cancelled) {
          setLivePurchases(salesCount)
          setLiveSpent(salesTotal + repairsTotal)
        }
      } catch { /* silent */ }
    }
    void load()
    return () => { cancelled = true }
  }, [isOpen, customer?.id])

  const handleFormSubmit = async (formData: SimpleCustomerFormData) => {
    setIsSubmitting(true)
    try {
      let result
      const fullName = `${formData.firstName} ${formData.lastName || ''}`.trim() || formData.firstName.trim()
      const segmentValue = formData.customerType === 'individual' ? 'regular' as const :
        formData.customerType === 'mayorista' ? 'wholesale' as const :
        formData.customerType === 'vip' ? 'vip' as const : 'business' as const

      if (mode === 'create') {
        const customerData = {
          name: fullName,
          ruc: formData.ruc?.trim() || undefined,
          email: formData.email?.trim() || undefined,
          phone: formData.phone?.trim() || undefined,
          city: formData.city?.trim() || undefined,
          address: formData.address?.trim() || undefined,
          status: 'active' as const,
          segment: segmentValue,
          tags: [],
          notes: formData.notes?.trim() || undefined,
          credit_limit: formData.creditLimit ? parseFloat(formData.creditLimit) : 0,
          payment_terms: formData.paymentTerms || 'contado',
          totalSpent: 0,
          lastPurchase: null,
          joinDate: new Date().toISOString(),
          avatar: undefined
        }

        result = await createCustomer(customerData)
        if (result?.success) {
          onClose()
        }
      } else if (customer) {
        const updatedData = {
          name: fullName,
          ruc: formData.ruc?.trim() || undefined,
          email: formData.email?.trim() || undefined,
          phone: formData.phone?.trim() || undefined,
          city: formData.city?.trim() || undefined,
          address: formData.address?.trim() || undefined,
          notes: formData.notes?.trim() || undefined,
          segment: segmentValue,
          credit_limit: formData.creditLimit ? parseFloat(formData.creditLimit) : 0,
          payment_terms: formData.paymentTerms || 'contado',
        }

        result = await updateCustomer(customer.id, updatedData)
        if (result?.success) {
          onClose()
        }
      }
    } catch {
      toast.error('Error al guardar el cliente')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getInitialFormData = (): Partial<SimpleCustomerFormData> => {
    if (!customer) return {}

    const nameParts = (customer.name || '').trim().split(' ')
    return {
      firstName: nameParts[0] || '',
      lastName: nameParts.slice(1).join(' ') || '',
      ruc: customer.ruc || '',
      phone: customer.phone || '',
      email: customer.email || '',
      city: customer.city || 'Asunción',
      address: customer.address || '',
      customerType: customer.segment === 'wholesale' ? 'mayorista' :
        customer.segment === 'business' ? 'empresa' :
        customer.segment === 'vip' ? 'vip' : 'individual',
      creditLimit: customer.credit_limit?.toString() || '',
      paymentTerms: customer.payment_terms || 'contado',
      notes: customer.notes || ''
    }
  }

  const getSegmentBadge = (segment: string) => {
    const variants = {
      regular: { label: 'Regular', variant: 'default' as const },
      premium: { label: 'Premium', variant: 'secondary' as const },
      vip: { label: 'VIP', variant: 'destructive' as const },
      wholesale: { label: 'Mayorista', variant: 'outline' as const },
      business: { label: 'Empresa', variant: 'outline' as const }
    }

    const config = variants[segment as keyof typeof variants] || variants.regular
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const getStatusBadge = (status?: string) => {
    const norm = String(status || '').toLowerCase().trim()
    if (norm === 'inactive' || norm === 'inactivo' || norm === 'desactivado') {
      return <Badge variant="secondary" className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">Inactivo</Badge>
    }
    if (norm === 'suspended' || norm === 'suspendido') {
      return <Badge variant="destructive">Suspendido</Badge>
    }
    return <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-white">Activo</Badge>
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto p-5 sm:p-6 border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1117] rounded-2xl shadow-xl">
        <DialogHeader className="pb-3 border-b border-slate-100 dark:border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-sm",
                mode === 'create'
                  ? "bg-gradient-to-br from-emerald-600 to-teal-600 shadow-emerald-500/20"
                  : "bg-gradient-to-br from-blue-600 to-indigo-600 shadow-blue-500/20"
              )}>
                {mode === 'create' ? <UserPlus className="h-5 w-5" /> : <User className="h-5 w-5" />}
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white">
                  {mode === 'create' ? 'Nuevo Cliente' : (customer?.name || 'Cliente')}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                  {mode === 'create'
                    ? 'Completa los datos de contacto, RUC/CI y condiciones comerciales'
                    : mode === 'edit'
                      ? 'Edita la información del cliente'
                      : 'Ficha y resumen del cliente'
                  }
                </DialogDescription>
              </div>
            </div>

            {mode === 'view' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMode('edit')}
                className="h-8 gap-1.5 text-xs font-semibold rounded-lg"
              >
                <Edit className="h-3.5 w-3.5" />
                Editar
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="pt-2">
          {mode === 'view' && customer ? (
            // Vista de solo lectura
            <div className="space-y-6">
              {/* Información básica */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Información Personal
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={customer.avatar || undefined} />
                      <AvatarFallback className="text-lg">
                        {customer.name?.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-2">
                      <h3 className="text-xl font-semibold">{customer.name}</h3>
                      <div className="flex gap-2">
                        {getStatusBadge(customer.status)}
                        {getSegmentBadge(customer.segment)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{customer.phone}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{customer.email}</span>
                    </div>
                    <div className="flex items-center gap-2 md:col-span-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{customer.address}</span>
                    </div>
                  </div>

                  {customer.notes && (
                    <div className="pt-4 border-t">
                      <h4 className="font-medium mb-2">Notas</h4>
                      <p className="text-muted-foreground">{customer.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Saldo a Favor */}
              <Card className={storeBalance > 0 ? 'border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-500/20' : ''}>
                <CardHeader className="pb-3">
                  <CardTitle className={`flex items-center justify-between text-sm ${storeBalance > 0 ? 'text-emerald-800 dark:text-emerald-300' : 'text-muted-foreground'}`}>
                    <div className="flex items-center gap-2">
                      <Wallet className={`h-4 w-4 ${storeBalance > 0 ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                      Saldo a Favor
                    </div>
                    {storeBalance > 0 && (
                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-800/40 dark:text-emerald-300 border-0 text-xs">
                        ✓ Disponible
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className={`text-2xl font-bold tabular-nums ${storeBalance > 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground'}`}>
                        {formatCurrency(storeBalance)}
                      </p>
                      <p className={`text-xs mt-0.5 ${storeBalance > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                        {storeBalance > 0 ? '💡 Aplicable en próxima compra o reparación' : 'Sin saldo acumulado aún'}
                      </p>
                    </div>
                  </div>

                  {storeMovements.length > 0 && (
                    <>
                      <Separator />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={`h-7 px-0 text-xs ${storeBalance > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'}`}
                        onClick={() => setStoreExpanded(v => !v)}
                      >
                        {storeExpanded ? <ChevronUp className="h-3.5 w-3.5 mr-1" /> : <ChevronDown className="h-3.5 w-3.5 mr-1" />}
                        {storeExpanded ? 'Ocultar' : `Ver ${storeMovements.length} movimiento${storeMovements.length !== 1 ? 's' : ''}`}
                      </Button>
                      {storeExpanded && (
                        <ul className="divide-y rounded-lg border bg-background text-sm overflow-hidden">
                          {storeMovements.slice(0, 5).map(m => (
                            <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2">
                              <div className="min-w-0">
                                <p className="font-medium truncate">{m.reason}</p>
                                <p className="text-xs text-muted-foreground">
                                  {({ after_sales: 'Posventa', sale: 'Venta', repair: 'Reparación', manual: 'Ajuste manual' } as Record<string, string>)[m.source_type] || 'Movimiento'} · {new Date(m.created_at).toLocaleDateString('es-PY')}
                                </p>
                              </div>
                              <span className={`shrink-0 font-bold tabular-nums text-sm ${m.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {m.amount >= 0 ? '+' : '-'}{formatCurrency(Math.abs(Number(m.amount)))}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}

                  {storeBalance === 0 && storeMovements.length === 0 && (
                    <div className="flex items-start gap-2">
                      <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                      <p className="text-xs text-muted-foreground">El saldo a favor se genera por devoluciones, créditos o ajustes manuales.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Estado de Crédito y Deudas */}
              <Card className={liveCredits && (liveCredits.active > 0 || liveCredits.pendingBalance > 0) ? 'border-purple-200 bg-purple-50/50 dark:bg-purple-950/20 dark:border-purple-500/20' : ''}>
                <CardHeader className="pb-3">
                  <CardTitle className={`flex items-center justify-between text-sm ${liveCredits && liveCredits.active > 0 ? 'text-purple-800 dark:text-purple-300' : 'text-muted-foreground'}`}>
                    <div className="flex items-center gap-2">
                      <CreditCard className={`h-4 w-4 ${liveCredits && liveCredits.active > 0 ? 'text-purple-600' : 'text-muted-foreground'}`} />
                      Créditos del Cliente
                    </div>
                    {liveCredits && liveCredits.active > 0 ? (
                      <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-800/40 dark:text-purple-300 border-0 text-xs font-bold">
                        {liveCredits.active} crédito{liveCredits.active !== 1 ? 's' : ''} activo{liveCredits.active !== 1 ? 's' : ''}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">Sin créditos activos</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className={`text-2xl font-bold tabular-nums ${liveCredits && liveCredits.pendingBalance > 0 ? 'text-purple-700 dark:text-purple-300' : 'text-muted-foreground'}`}>
                        {formatCurrency(liveCredits?.pendingBalance || customer.current_balance || 0)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {liveCredits && liveCredits.pendingBalance > 0 ? 'Saldo deudor total en cuotas' : 'Sin saldo deudor pendiente'}
                      </p>
                    </div>
                    {customer.credit_limit && customer.credit_limit > 0 && (
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Límite Aprobado</p>
                        <p className="text-sm font-semibold tabular-nums">{formatCurrency(customer.credit_limit)}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Información adicional */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="h-5 w-5" />
                    Información Adicional
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <span className="text-sm text-muted-foreground">Total compras</span>
                      <p className="text-lg font-semibold tabular-nums">{livePurchases ?? customer.total_purchases ?? 0}</p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Total gastado</span>
                      <p className="text-lg font-semibold tabular-nums">{formatCurrency(liveSpent ?? customer.lifetime_value ?? 0)}</p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Fecha de registro</span>
                      <p className="flex items-center gap-1 mt-0.5 text-sm font-medium">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {customer.registration_date ? new Date(customer.registration_date).toLocaleDateString() : 'No disponible'}
                      </p>
                    </div>
                  </div>

                  {customer.tags && customer.tags.length > 0 && (
                    <div>
                      <span className="text-sm text-muted-foreground">Etiquetas</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {customer.tags.map((tag, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            // Formulario de edición/creación
            <CustomerFormSimple
              initialData={getInitialFormData()}
              onSubmit={handleFormSubmit}
              onCancel={() => mode === 'edit' ? setMode('view') : onClose()}
              submitLabel={mode === 'create' ? 'Crear Cliente' : 'Actualizar Cliente'}
              isSubmitting={isSubmitting}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}