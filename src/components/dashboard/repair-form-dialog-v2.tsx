'use client'

/**
 * RepairFormDialogV2
 *
 * Versión mejorada del formulario de reparaciones con:
 * - Validación en tiempo real con Zod + React Hook Form
 * - Mensajes de error inline en español
 * - Type-safety completo
 * - Modo rápido con validación relajada
 * - Mejor UX con enfoque automático en errores
 * - CustomerSelector para búsqueda y creación inline de clientes
 */

import React, { useEffect, useMemo, useState } from 'react'
import { formatCurrency } from '@/lib/currency'
import { useAuth } from '@/contexts/auth-context'
import { cn } from '@/lib/utils'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Save, X, User, Phone, Mail, Smartphone, Laptop, Tablet,
  AlertCircle, Trash, Plus, Zap, UserPlus, Pencil, Package, MessageSquare, DollarSign, Calculator, FileText,
  Search, Loader2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { toast } from 'sonner'
import {
  RepairFormSchema,
  RepairFormQuickSchema,
  type RepairFormData
} from '@/schemas'
import { CustomerSelectorV3 } from './repairs/CustomerSelectorV3'
import { QuickCustomerModal } from './repairs/QuickCustomerModal'
import { PatternDrawer } from './repairs/PatternDrawer'
import { AppError } from '@/lib/errors'
// import { uploadFile } from '@/lib/supabase-storage'
import { ImageUploader } from '@/components/dashboard/products/ImageUploader'
import { useSubscriptionStatus, repairPhotoLimit } from '@/contexts/SubscriptionStatusContext'
import { UpgradeHint } from '@/components/admin/PlanGate'
import { RepairCostCalculator, type CostCalculationMode } from './repairs/RepairCostCalculator'
import { Repair } from '@/types/repairs'

export type RepairFormMode = 'add' | 'edit'

interface RepairFormDialogV2Props {
  open: boolean
  mode: RepairFormMode
  technicians: Array<{ id: string; name: string }>
  initialData?: Partial<RepairFormData>
  repair?: Repair
  onClose: () => void
  onSubmit: (data: RepairFormData) => Promise<boolean>
}

const deviceTypeOptions = [
  { value: 'smartphone', label: 'Smartphone', icon: Smartphone },
  { value: 'laptop', label: 'Laptop', icon: Laptop },
  { value: 'tablet', label: 'Tablet', icon: Tablet },
  { value: 'desktop', label: 'Desktop', icon: Laptop },
  { value: 'accessory', label: 'Accesorio', icon: Smartphone },
  { value: 'other', label: 'Otro', icon: Smartphone }
] as const

const priorityOptions = [
  { value: 'low', label: 'Baja', color: 'bg-green-100 text-green-700' },
  { value: 'medium', label: 'Media', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'high', label: 'Alta', color: 'bg-red-100 text-red-700' }
] as const

const urgencyOptions = [
  { value: 'medium', label: 'Normal', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'high', label: 'Urgente', color: 'bg-red-100 text-red-700' }
] as const

const sectionCardClass =
  'shadow-lg border border-slate-200/80 bg-white/90 dark:border-slate-800/80 dark:bg-slate-950/70'

const sectionHeaderClass =
  'border-b border-slate-200/70 bg-slate-50/70 dark:border-slate-800/80 dark:bg-slate-950/40'

const sectionTitleClass = 'text-base font-semibold text-slate-900 dark:text-slate-100'

const sectionIconClass =
  'flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900'

const subsectionCardClass =
  'border border-slate-200/80 bg-white dark:border-slate-800/80 dark:bg-slate-950/60 shadow-sm'

const fieldClass = 'border-slate-200 dark:border-slate-800'

export function RepairFormDialogV2({
  open,
  mode,
  technicians,
  initialData,
  repair,
  onClose,
  onSubmit
}: RepairFormDialogV2Props) {
  const formId = 'repair-form-dialog-form'
  const { planCode } = useSubscriptionStatus()
  const photoLimit = repairPhotoLimit(planCode)
  const [quickMode, setQuickMode] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showQuickCustomerModal, setShowQuickCustomerModal] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<{ id: string; name: string; phone: string; email: string } | null>(null)
  const [selectedQuickCustomer, setSelectedQuickCustomer] = useState<{ id: string; name: string; phone: string; email: string } | null>(null)

  // Inventory part lookup states
  const [inventorySearchOpen, setInventorySearchOpen] = useState(false)
  const [inventorySearchQuery, setInventorySearchQuery] = useState('')
  const [inventoryProducts, setInventoryProducts] = useState<Array<{
    id: string
    name: string
    sku?: string | null
    sale_price?: number | null
    offer_price?: number | null
    stock_quantity?: number | null
  }>>([])
  const [loadingInventory, setLoadingInventory] = useState(false)

  // Fetch inventory products with debounce
  useEffect(() => {
    if (!inventorySearchOpen) {
      setInventoryProducts([])
      setInventorySearchQuery('')
      return
    }

    const controller = new AbortController()
    setLoadingInventory(true)

    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/products?per_page=15&query=${encodeURIComponent(inventorySearchQuery)}`,
          { signal: controller.signal }
        )
        const payload = await res.json().catch(() => ({}))
        const productsList = Array.isArray(payload?.data?.products) ? payload.data.products : []
        setInventoryProducts(productsList)
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setInventoryProducts([])
        }
      } finally {
        setLoadingInventory(false)
      }
    }, 250)

    return () => {
      clearTimeout(t)
      controller.abort()
    }
  }, [inventorySearchOpen, inventorySearchQuery])

  // Buscador de servicios (ej. "Cambio de pantalla") para autocompletar el
  // Costo Estimado por dispositivo. Un servicio es un producto con
  // unit_measure='servicio' o en la categoría "Servicios" — el mismo
  // criterio que ya usa InventoryContext para separar servicios de repuestos
  // físicos, así que se repite acá en vez de inventar uno nuevo.
  const [serviceSearchIndex, setServiceSearchIndex] = useState<number | null>(null)
  const [serviceSearchQuery, setServiceSearchQuery] = useState('')
  const [serviceResults, setServiceResults] = useState<Array<{
    id: string
    name: string
    sale_price?: number | null
    wholesale_price?: number | null
    unit_measure?: string | null
    category?: { name?: string | null } | null
    brand?: string | null
    tags?: string[] | null
  }>>([])
  const [loadingServices, setLoadingServices] = useState(false)

  useEffect(() => {
    if (serviceSearchIndex === null) {
      setServiceResults([])
      setServiceSearchQuery('')
      return
    }

    const controller = new AbortController()
    setLoadingServices(true)

    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/products?per_page=30&query=${encodeURIComponent(serviceSearchQuery)}`,
          { signal: controller.signal }
        )
        const payload = await res.json().catch(() => ({}))
        const list = Array.isArray(payload?.data?.products) ? payload.data.products : []
        const services = list.filter((p: { unit_measure?: string; category?: { name?: string } }) => {
          const isServiceUnit = (p.unit_measure || '').toLowerCase() === 'servicio'
          const isServiceCategory = (p.category?.name || '').toLowerCase().includes('servicio')
          return isServiceUnit || isServiceCategory
        })
        setServiceResults(services)
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setServiceResults([])
        }
      } finally {
        setLoadingServices(false)
      }
    }, 250)

    return () => {
      clearTimeout(t)
      controller.abort()
    }
  }, [serviceSearchIndex, serviceSearchQuery])

  // Select schema based on quick mode
  const resolver = zodResolver(quickMode ? RepairFormQuickSchema : RepairFormSchema) as unknown as import('react-hook-form').Resolver<RepairFormData>

  // Initialize form with React Hook Form + Zod
  // Use RepairFormData as the main type (compatible with both schemas)
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isValid, submitCount },
    watch,
    setValue,
    reset,
    setFocus,
    trigger
  } = useForm<RepairFormData>({
    resolver,
    mode: 'onChange', // Validate on change for real-time feedback
    defaultValues: {
      customerName: initialData?.customerName || '',
      customerPhone: initialData?.customerPhone || '',
      customerEmail: initialData?.customerEmail || '',
      customerAddress: initialData?.customerAddress || '',
      customerDocument: initialData?.customerDocument || '',
      customerCity: initialData?.customerCity || '',
      customerCountry: initialData?.customerCountry || '',
      existingCustomerId: initialData?.existingCustomerId || '',
      isNewCustomer: initialData?.isNewCustomer ?? false,
      priority: initialData?.priority || 'medium',
      urgency: initialData?.urgency || 'medium',
      devices: initialData?.devices || [{
        deviceType: 'smartphone',
        brand: '',
        model: '',
        issue: '',
        description: '',
        accessType: 'none',
        images: [],
        technician: '',
        estimatedCost: 0
      }],
      parts: initialData?.parts || [],
      notes: initialData?.notes || [],
      laborCost: initialData?.laborCost || 0,
      finalCost: initialData?.finalCost || null,
      warrantyMonths: initialData?.warrantyMonths ?? 3,
      warrantyType: initialData?.warrantyType || 'full',
      warrantyNotes: initialData?.warrantyNotes || ''
    }
  })

  // Field array for devices
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'devices'
  })

  // Field array for parts
  const { fields: partsFields, append: appendPart, remove: removePart } = useFieldArray({
    control,
    name: 'parts'
  })

  // Field array for notes
  const { fields: notesFields, append: appendNote, remove: removeNote } = useFieldArray({
    control,
    name: 'notes'
  })

  // Cálculo automático de costos: repuestos + (mano de obra o total, según el
  // modo) derivan el tercero. Arranca en 'manual' a propósito: al editar una
  // reparación existente, un modo automático por defecto recalcularía en
  // silencio un costo que el técnico ya cargó a mano, sin que nadie lo pidiera.
  const [calculationMode, setCalculationMode] = useState<CostCalculationMode>('manual')
  const { user } = useAuth()
  const watchedParts = watch('parts')
  const watchedFinalCost = watch('finalCost')
  const watchedLaborCost = watch('laborCost')

  // Estado mayorista del cliente elegido, para saber qué precio de servicio
  // ofrecer. Solo se puede saber si el cliente tiene cuenta vinculada (el
  // caso más común en un mostrador es que no la tenga): sin eso, no hay
  // mayorista que detectar y se usa el precio normal.
  const [customerIsWholesale, setCustomerIsWholesale] = useState(false)
  const watchedCustomerId = watch('existingCustomerId')

  useEffect(() => {
    if (!watchedCustomerId) {
      setCustomerIsWholesale(false)
      return
    }
    let cancelled = false
    fetch(`/api/customers/${watchedCustomerId}/wholesale-status`)
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (!cancelled && payload?.success) setCustomerIsWholesale(Boolean(payload.data?.isWholesale))
      })
      .catch(() => {
        // Sin verificación posible, se asume precio normal: es el default
        // más seguro (nunca aplica un descuento sin poder confirmarlo).
        if (!cancelled) setCustomerIsWholesale(false)
      })
    return () => {
      cancelled = true
    }
  }, [watchedCustomerId])
  const watchedTechnicianId = watch('devices.0.technician')

  const partsCostForLabor = useMemo(
    () => (watchedParts || []).reduce((sum, part) => sum + (Number(part.cost) || 0) * (Number(part.quantity) || 0), 0),
    [watchedParts]
  )

  useEffect(() => {
    if (calculationMode === 'labor-from-final') {
      if (watchedFinalCost === null || watchedFinalCost === undefined) return
      const derived = Math.max(0, Math.round((watchedFinalCost - partsCostForLabor) * 100) / 100)
      if (derived !== watch('laborCost')) {
        setValue('laborCost', derived, { shouldDirty: true, shouldValidate: true })
      }
      return
    }

    if (calculationMode === 'final-from-labor') {
      const derived = Math.round(((watchedLaborCost || 0) + partsCostForLabor) * 100) / 100
      if (derived !== watch('finalCost')) {
        setValue('finalCost', derived, { shouldDirty: true, shouldValidate: true })
      }
    }
  }, [calculationMode, watchedFinalCost, watchedLaborCost, partsCostForLabor, setValue, watch])

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      reset({
        customerName: initialData?.customerName || '',
        customerPhone: initialData?.customerPhone || '',
        customerEmail: initialData?.customerEmail || '',
        customerAddress: initialData?.customerAddress || '',
        customerDocument: initialData?.customerDocument || '',
        customerCity: initialData?.customerCity || '',
        customerCountry: initialData?.customerCountry || '',
        existingCustomerId: initialData?.existingCustomerId || '',
        isNewCustomer: initialData?.isNewCustomer ?? false,
        priority: initialData?.priority || 'medium',
        urgency: initialData?.urgency || 'medium',
        devices: initialData?.devices || [{
          deviceType: 'smartphone',
          brand: '',
          model: '',
          issue: '',
          description: '',
          accessType: 'none',
          images: [],
          // Si quien crea el ticket aparece en la lista de técnicos, se
          // autoasigna. Antes quedaba "Sin asignar" siempre, incluso cuando
          // un técnico creaba su propia reparación desde su propia agenda:
          // un clic de más, y si se olvidaba, la reparación no podía pasar
          // a "reparación" hasta que alguien se acordara de asignarla.
          technician: user?.id && technicians.some((tech) => tech.id === user.id) ? user.id : '',
          estimatedCost: 0
        }],
        parts: initialData?.parts || [],
        notes: initialData?.notes || [],
        laborCost: initialData?.laborCost || 0,
        finalCost: initialData?.finalCost || null,
        warrantyMonths: initialData?.warrantyMonths ?? 3,
        warrantyType: initialData?.warrantyType || 'full',
        warrantyNotes: initialData?.warrantyNotes || ''
      })
      setSelectedQuickCustomer(null)
    }
  }, [open, initialData, reset, user?.id, technicians])

  useEffect(() => {
    if (open) {
      void trigger()
    }
  }, [open, quickMode, trigger])

  // Handle form submission
  const onSubmitForm = async (data: RepairFormData) => {
    setIsSubmitting(true)
    try {
      const didSubmit = await onSubmit(data)
      if (!didSubmit) return
      onClose()
    } catch (error) {
      const appError = AppError.from(error)
      toast.error(appError.message, {
        action: appError.action
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle quick customer creation
  const handleQuickCustomerCreated = (customer: { id: string; name: string; phone: string; email: string }) => {
    // Auto-select the new customer
    setValue('existingCustomerId', customer.id, { shouldDirty: true, shouldValidate: true })
    setValue('customerName', customer.name, { shouldDirty: true, shouldValidate: true })
    setValue('customerPhone', customer.phone, { shouldDirty: true, shouldValidate: true })
    setValue('customerEmail', customer.email, { shouldDirty: true, shouldValidate: true })
    setSelectedQuickCustomer(customer)
  }

  const handleQuickCustomerUpdated = (customer: { id: string; name: string; phone: string; email: string }) => {
    setValue('customerName', customer.name, { shouldDirty: true, shouldValidate: true })
    setValue('customerPhone', customer.phone, { shouldDirty: true, shouldValidate: true })
    setValue('customerEmail', customer.email, { shouldDirty: true, shouldValidate: true })
    setSelectedQuickCustomer(customer)
    setEditingCustomer(null)
  }

  const handleEditCustomer = () => {
    const id = watch('existingCustomerId')
    const name = watch('customerName')
    const phone = watch('customerPhone')
    const email = watch('customerEmail')

    if (id) {
      setEditingCustomer({ id, name, phone, email })
      setShowQuickCustomerModal(true)
    }
  }

  // Focus first error field on submit
  useEffect(() => {
    if (submitCount > 0 && Object.keys(errors).length > 0) {
      const firstErrorField = Object.keys(errors)[0]
      if (firstErrorField && firstErrorField !== 'root') {
        setFocus(firstErrorField as keyof RepairFormData)
      }
    }
  }, [errors, setFocus, submitCount])

  // Estado para pantalla completa
  const [isFullscreen, setIsFullscreen] = useState(false)

  return (
    <>
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className={`overflow-hidden flex flex-col p-0 transition-all duration-300 rounded-2xl border-border/60 shadow-2xl max-sm:w-screen max-sm:h-[100dvh] max-sm:max-w-full max-sm:rounded-none ${isFullscreen ? 'sm:w-[98vw] sm:max-w-[98vw] sm:h-[96vh] sm:max-h-[96vh]' : 'sm:w-[92vw] sm:max-w-5xl sm:h-[88vh] sm:max-h-[88vh]'} dark:bg-slate-950 dark:border-slate-800`}>
        <DialogHeader className="flex-shrink-0 px-4 sm:px-6 py-3.5 border-b border-border bg-muted/20 dark:border-slate-800">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                {mode === 'add' ? <Plus className="h-5 w-5" /> : <Pencil className="h-5 w-5" />}
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg font-bold tracking-tight truncate">
                  {mode === 'add' ? 'Nueva Reparación' : 'Editar Reparación'}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground dark:text-slate-400 truncate">
                  Complete los datos del cliente y los dispositivos a reparar
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 mr-8">
              {mode === 'edit' && repair && (
                <Badge variant="outline" className="bg-background font-mono text-xs px-2.5 py-1">
                  #{repair.ticketNumber || repair.id.slice(0, 8).toUpperCase()}
                </Badge>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="h-9 w-9"
                title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
              >
                {isFullscreen ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
                  </svg>
                )}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 bg-gradient-to-b from-background to-muted/10 dark:from-slate-950 dark:to-slate-900/50">
          <form id={formId} onSubmit={handleSubmit(onSubmitForm)} className="space-y-5 max-w-[1800px] mx-auto">
            {/* Quick Mode Toggle */}
            <div className="flex items-center justify-between px-4 py-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200/70 dark:border-amber-800/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-400/90 dark:bg-amber-500 flex items-center justify-center shrink-0">
                  <Zap className="h-4.5 w-4.5 text-white" />
                </div>
                <div>
                  <Label htmlFor="quick-mode" className="cursor-pointer font-semibold text-sm text-amber-900 dark:text-amber-100">
                    Modo Rápido
                  </Label>
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Validación simplificada para registro rápido
                  </p>
                </div>
              </div>
              <Switch
                id="quick-mode"
                checked={quickMode}
                onCheckedChange={setQuickMode}
                className="data-[state=checked]:bg-amber-500 dark:data-[state=checked]:bg-amber-600"
              />
            </div>

            {/* Sección 1: Información del Cliente (Ancho Completo) */}
            <Card className={sectionCardClass}>
              <CardHeader className={`pb-3 ${sectionHeaderClass}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={sectionIconClass}>
                      <User className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className={sectionTitleClass}>
                        Información del Cliente
                      </CardTitle>
                      {watch('customerName') && (
                        <p className="text-xs text-muted-foreground dark:text-slate-400 mt-0.5">
                          {watch('customerName')}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    {watch('existingCustomerId') && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleEditCustomer}
                        disabled={isSubmitting}
                        className="h-8 w-8 p-0 hover:bg-muted hover:text-foreground transition-colors"
                        title="Editar cliente"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingCustomer(null)
                        setShowQuickCustomerModal(true)
                      }}
                      disabled={isSubmitting}
                      className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary transition-colors"
                      title="Nuevo cliente"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <CustomerSelectorV3
                  value={watch('existingCustomerId')}
                  initialCustomer={selectedQuickCustomer || (initialData?.existingCustomerId ? {
                    id: initialData.existingCustomerId,
                    name: initialData.customerName || '',
                    phone: initialData.customerPhone || '',
                    email: initialData.customerEmail || ''
                  } : undefined)}
                  onChange={(customerId, customerData) => {
                    setValue('existingCustomerId', customerId, { shouldDirty: true, shouldValidate: true })

                    if (!customerId) {
                      setValue('customerName', '', { shouldDirty: true, shouldValidate: true })
                      setValue('customerPhone', '', { shouldDirty: true, shouldValidate: true })
                      setValue('customerEmail', '', { shouldDirty: true, shouldValidate: true })
                      setSelectedQuickCustomer(null)
                      return
                    }

                    // Auto-fill customer data if available
                    if (customerData) {
                      setValue('customerName', customerData.name, { shouldDirty: true, shouldValidate: true })
                      setValue('customerPhone', customerData.phone || '', { shouldDirty: true, shouldValidate: true })
                      setValue('customerEmail', customerData.email || '', { shouldDirty: true, shouldValidate: true })
                      setSelectedQuickCustomer({
                        id: customerId,
                        name: customerData.name || '',
                        phone: customerData.phone || '',
                        email: customerData.email || ''
                      })
                    }
                  }}
                  error={errors.existingCustomerId?.message}
                />
                
                {/* Información adicional del cliente si está seleccionado */}
                {watch('existingCustomerId') && watch('customerPhone') && (
                  <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800/80 space-y-2">
                    {watch('customerPhone') && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground dark:text-slate-400">
                        <Phone className="h-3 w-3 text-primary" />
                        <span>{watch('customerPhone')}</span>
                      </div>
                    )}
                    {watch('customerEmail') && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground dark:text-slate-400">
                        <Mail className="h-3 w-3 text-primary" />
                        <span>{watch('customerEmail')}</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sección 2: Dispositivos a Reparar (Ancho Completo) */}
            <Card className={sectionCardClass}>
              <CardHeader className={`pb-3 ${sectionHeaderClass}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={sectionIconClass}>
                      <Smartphone className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className={sectionTitleClass}>
                        Dispositivos a Reparar
                      </CardTitle>
                      <p className="text-xs text-muted-foreground dark:text-slate-400 mt-0.5">
                        {fields.length} {fields.length === 1 ? 'dispositivo' : 'dispositivos'} registrado{fields.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  {mode === 'add' && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => append({
                        deviceType: 'smartphone',
                        brand: '',
                        model: '',
                        issue: '',
                        description: '',
                        accessType: 'none',
                        images: [],
                        technician: '',
                        estimatedCost: 0
                      })}
                      className="h-8 gap-1.5 hover:bg-primary/10 hover:text-primary transition-colors text-xs"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Agregar
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                {fields.map((field, index) => {
                  const deviceType = watch(`devices.${index}.deviceType`)
                  const DeviceIcon = deviceTypeOptions.find(opt => opt.value === deviceType)?.icon || Smartphone
                  
                  return (
                  <Card key={field.id} className={subsectionCardClass}>
                    <CardHeader className={`pb-2 ${sectionHeaderClass}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-slate-900 text-xs font-bold text-white shadow-sm dark:bg-slate-100 dark:text-slate-900">
                            {index + 1}
                          </div>
                          <div>
                            <CardTitle className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                              <DeviceIcon className="h-3.5 w-3.5" />
                              Dispositivo {index + 1}
                            </CardTitle>
                            {watch(`devices.${index}.brand`) && watch(`devices.${index}.model`) && (
                              <p className="text-xs text-muted-foreground dark:text-slate-400 mt-0.5">
                                {watch(`devices.${index}.brand`)} {watch(`devices.${index}.model`)}
                              </p>
                            )}
                          </div>
                        </div>
                        {mode === 'add' && fields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => remove(index)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/50 h-7 w-7 p-0"
                            title="Eliminar dispositivo"
                          >
                            <Trash className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-3">
                      {/* Grid de 3 columnas para información básica */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {/* Device Type */}
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium flex items-center gap-1 text-muted-foreground dark:text-slate-400">
                            <Smartphone className="h-3 w-3 text-primary" />
                            Tipo <span className="text-red-500">*</span>
                          </Label>
                          <Controller
                            name={`devices.${index}.deviceType`}
                            control={control}
                            render={({ field }) => (
                              <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger
                                  className={`h-9 text-sm ${fieldClass} ${errors.devices?.[index]?.deviceType ? 'border-red-500' : ''}`}
                                >
                                  <SelectValue placeholder="Tipo" />
                                </SelectTrigger>
                                <SelectContent>
                                  {deviceTypeOptions.map(option => {
                                    const Icon = option.icon
                                    return (
                                      <SelectItem key={option.value} value={option.value}>
                                        <div className="flex items-center gap-2">
                                          <Icon className="h-4 w-4" />
                                          {option.label}
                                        </div>
                                      </SelectItem>
                                    )
                                  })}
                                </SelectContent>
                              </Select>
                            )}
                          />
                          {errors.devices?.[index]?.deviceType && (
                            <p className="text-xs text-red-500 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              {errors.devices[index]?.deviceType?.message}
                            </p>
                          )}
                        </div>

                        {/* Brand */}
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-muted-foreground dark:text-slate-400">
                            Marca <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            {...register(`devices.${index}.brand`)}
                            placeholder="Apple, Samsung..."
                            className={`h-9 text-sm ${fieldClass} ${errors.devices?.[index]?.brand ? 'border-red-500' : ''}`}
                          />
                          {errors.devices?.[index]?.brand && (
                            <p className="text-xs text-red-500 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              {errors.devices[index]?.brand?.message}
                            </p>
                          )}
                        </div>

                        {/* Model */}
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-muted-foreground dark:text-slate-400">
                            Modelo <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            {...register(`devices.${index}.model`)}
                            placeholder="iPhone 15 Pro..."
                            className={`h-9 text-sm ${fieldClass} ${errors.devices?.[index]?.model ? 'border-red-500' : ''}`}
                          />
                          {errors.devices?.[index]?.model && (
                            <p className="text-xs text-red-500 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              {errors.devices[index]?.model?.message}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Grid de 2 columnas para técnico y costo */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Technician */}
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium flex items-center gap-1 text-muted-foreground dark:text-slate-400">
                            <User className="h-3 w-3 text-primary" />
                            Técnico Asignado
                          </Label>
                          <Controller
                            name={`devices.${index}.technician`}
                            control={control}
                            render={({ field }) => (
                              <Select
                                value={field.value || '__unassigned__'}
                                onValueChange={value =>
                                  field.onChange(value === '__unassigned__' ? '' : value)
                                }
                              >
                                <SelectTrigger
                                  className={`h-9 text-sm ${fieldClass} ${errors.devices?.[index]?.technician ? 'border-red-500' : ''}`}
                                >
                                  <SelectValue placeholder="Sin asignar" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__unassigned__">
                                    <div className="flex items-center gap-2">
                                      <User className="h-4 w-4" />
                                      Sin asignar
                                    </div>
                                  </SelectItem>
                                  {technicians.map(tech => (
                                    <SelectItem key={tech.id} value={tech.id}>
                                      <div className="flex items-center gap-2">
                                        <User className="h-4 w-4" />
                                        {tech.name}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                          {errors.devices?.[index]?.technician && (
                            <p className="text-xs text-red-500 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              {errors.devices[index]?.technician?.message}
                            </p>
                          )}
                        </div>

                        {/* Estimated Cost */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <Label className="text-xs font-medium flex items-center gap-1 text-muted-foreground dark:text-slate-400">
                              <DollarSign className="h-3 w-3 text-primary" />
                              Costo Estimado
                              <span className="text-xs text-muted-foreground ml-1">(opcional)</span>
                            </Label>
                            <Popover
                              open={serviceSearchIndex === index}
                              onOpenChange={(isOpen) => setServiceSearchIndex(isOpen ? index : null)}
                            >
                              <PopoverTrigger asChild>
                                <button
                                  type="button"
                                  className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                                >
                                  <Search className="h-3 w-3" />
                                  Buscar servicio
                                </button>
                              </PopoverTrigger>
                              <PopoverContent align="end" className="w-80 p-0">
                                <div className="p-2.5 border-b">
                                  <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                    <Input
                                      value={serviceSearchQuery}
                                      onChange={(e) => setServiceSearchQuery(e.target.value)}
                                      placeholder="Ej: Cambio de pantalla..."
                                      className="pl-8 h-8 text-xs"
                                      autoFocus
                                    />
                                  </div>
                                </div>
                                <div className="max-h-64 overflow-y-auto p-1.5">
                                  {loadingServices ? (
                                    <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      Buscando...
                                    </div>
                                  ) : serviceResults.length === 0 ? (
                                    <p className="py-6 text-center text-xs text-muted-foreground">
                                      {serviceSearchQuery
                                        ? 'Sin servicios que coincidan.'
                                        : 'Escribí para buscar un servicio.'}
                                    </p>
                                  ) : (
                                    serviceResults.map((svc) => {
                                      const price = customerIsWholesale && svc.wholesale_price
                                        ? svc.wholesale_price
                                        : (svc.sale_price ?? 0)
                                      return (
                                        <button
                                          key={svc.id}
                                          type="button"
                                          onClick={() => {
                                            setValue(`devices.${index}.estimatedCost`, price, {
                                              shouldDirty: true,
                                              shouldValidate: true,
                                            })
                                            // Si el problema todavía no se cargó, se completa con el
                                            // nombre del servicio. No pisa lo que ya se haya escrito.
                                            if (!watch(`devices.${index}.issue`)) {
                                              setValue(`devices.${index}.issue`, svc.name, { shouldDirty: true })
                                            }

                                            // Autocompletar Tipo, Marca y Modelo desde el servicio
                                            const deviceTypeTag = svc.tags?.find((t: string) => t.startsWith('deviceType:'))?.split(':')[1]
                                            const deviceModelTag = svc.tags?.find((t: string) => t.startsWith('model:'))?.split(':')[1]

                                            const setVal = setValue as any;
                                            const watchVal = watch as any;

                                            if (deviceTypeTag && !watchVal(`devices.${index}.deviceType`)) {
                                              setVal(`devices.${index}.deviceType`, deviceTypeTag, { shouldDirty: true, shouldValidate: true })
                                            }
                                            if (svc.brand && !watchVal(`devices.${index}.deviceBrand`)) {
                                              setVal(`devices.${index}.deviceBrand`, svc.brand, { shouldDirty: true, shouldValidate: true })
                                            }
                                            if (deviceModelTag && !watchVal(`devices.${index}.deviceModel`)) {
                                              setVal(`devices.${index}.deviceModel`, deviceModelTag, { shouldDirty: true, shouldValidate: true })
                                            }

                                            // El servicio también carga la Mano de Obra de la
                                            // calculadora compartida, pero solo cuando no hay
                                            // ambigüedad: un solo equipo (la calculadora es
                                            // compartida entre todos, no por equipo) y en modo
                                            // manual (si ya está derivando labor del total, pisarlo
                                            // acá lo dejaría mostrado como "automático" con un valor
                                            // que en realidad se cargó a mano).
                                            const alsoSetLabor = fields.length === 1 && calculationMode === 'manual'
                                            if (alsoSetLabor) {
                                              setValue('laborCost', price, { shouldDirty: true, shouldValidate: true })
                                            }

                                            toast.success(`"${svc.name}" — ${formatCurrency(price)}`, {
                                              description: [
                                                customerIsWholesale && svc.wholesale_price ? 'Precio mayorista aplicado.' : null,
                                                alsoSetLabor ? 'Se cargó también como Mano de Obra.' : null,
                                              ].filter(Boolean).join(' ') || undefined,
                                            })
                                            setServiceSearchIndex(null)
                                          }}
                                          className="flex w-full items-center justify-between gap-2 rounded-lg p-2 text-left text-xs hover:bg-muted/70"
                                        >
                                          <span className="min-w-0 truncate font-medium">{svc.name}</span>
                                          <span className="shrink-0 font-semibold text-primary">
                                            {formatCurrency(price)}
                                          </span>
                                        </button>
                                      )
                                    })
                                  )}
                                </div>
                                {customerIsWholesale && (
                                  <div className="border-t px-2.5 py-1.5 text-[10px] text-violet-600 dark:text-violet-400">
                                    Cliente mayorista: se muestra el precio mayorista cuando está cargado.
                                  </div>
                                )}
                              </PopoverContent>
                            </Popover>
                          </div>
                          <div className="relative">
                            <DollarSign className="absolute left-2.5 top-2 h-4 w-4 text-primary" />
                            <Input
                              type="number"
                              step="0.01"
                              {...register(`devices.${index}.estimatedCost`, {
                                valueAsNumber: true
                              })}
                              placeholder="0.00"
                              className={`h-9 text-sm pl-8 font-semibold ${fieldClass} ${errors.devices?.[index]?.estimatedCost ? 'border-red-500' : ''}`}
                            />
                          </div>
                          {errors.devices?.[index]?.estimatedCost && (
                            <p className="text-xs text-red-500 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              {errors.devices[index]?.estimatedCost?.message}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Problema y Descripción en ancho completo */}
                      <div className="space-y-3 pt-2 border-t border-slate-200/70 dark:border-slate-800/80">
                      {/* Issue */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium flex items-center gap-1 text-muted-foreground dark:text-slate-400">
                          <AlertCircle className="h-3 w-3 text-primary" />
                          Problema Principal <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          {...register(`devices.${index}.issue`)}
                          placeholder="Pantalla rota, no enciende..."
                          className={`h-9 text-sm ${fieldClass} ${errors.devices?.[index]?.issue ? 'border-red-500' : ''}`}
                        />
                        {errors.devices?.[index]?.issue && (
                          <p className="text-xs text-red-500 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {errors.devices[index]?.issue?.message}
                          </p>
                        )}
                      </div>

                      {/* Description */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium flex items-center gap-1 text-muted-foreground dark:text-slate-400">
                          <FileText className="h-3 w-3 text-primary" />
                          Descripción Detallada
                        </Label>
                        <Textarea
                          {...register(`devices.${index}.description`)}
                          placeholder="Describe el problema en detalle..."
                          rows={2}
                          className={`resize-none text-sm ${fieldClass} ${errors.devices?.[index]?.description ? 'border-red-500' : ''}`}
                        />
                        {errors.devices?.[index]?.description && (
                          <p className="text-xs text-red-500 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {errors.devices[index]?.description?.message}
                          </p>
                        )}
                      </div>
                      </div>

                      {/* Acceso y Seguridad */}
                      <div className="space-y-3 pt-2 border-t border-slate-200/70 dark:border-slate-800/80">
                        {/* Access Password */}
                        <div className="space-y-2">
                          <Label className="text-xs font-medium text-muted-foreground dark:text-slate-400">
                            Acceso al Dispositivo
                            <span className="text-xs text-muted-foreground ml-1">(opcional)</span>
                          </Label>
                          
                          {/* Access Type Selector */}
                          <Controller
                            name={`devices.${index}.accessType`}
                            control={control}
                            render={({ field }) => (
                              <Select
                                value={field.value || 'none'}
                                onValueChange={(value) => {
                                  if (value !== field.value) {
                                    setValue(`devices.${index}.accessPassword`, '', {
                                      shouldDirty: true,
                                      shouldValidate: true
                                    })
                                  }
                                  field.onChange(value)
                                }}
                              >
                                <SelectTrigger className={`h-9 text-sm ${fieldClass}`}>
                                  <SelectValue placeholder="Tipo de acceso" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">
                                    <div className="flex items-center gap-2">
                                      <div className="w-4 h-4 rounded border-2 border-muted-foreground/30"></div>
                                      <span>Sin protección</span>
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="pin">
                                    <div className="flex items-center gap-2">
                                      <div className="w-4 h-4 bg-blue-100 rounded flex items-center justify-center text-xs font-mono text-blue-700">
                                        #
                                      </div>
                                      <span>PIN (números)</span>
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="password">
                                    <div className="flex items-center gap-2">
                                      <div className="w-4 h-4 bg-green-100 rounded flex items-center justify-center text-xs text-green-700">
                                        A
                                      </div>
                                      <span>Contraseña (texto)</span>
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="pattern">
                                    <div className="flex items-center gap-2">
                                      <div className="w-4 h-4 bg-purple-100 rounded flex items-center justify-center">
                                        <div className="grid grid-cols-2 gap-0.5">
                                          <div className="w-1 h-1 bg-purple-600 rounded-full"></div>
                                          <div className="w-1 h-1 bg-purple-300 rounded-full"></div>
                                          <div className="w-1 h-1 bg-purple-600 rounded-full"></div>
                                          <div className="w-1 h-1 bg-purple-600 rounded-full"></div>
                                        </div>
                                      </div>
                                      <span>Patrón de desbloqueo</span>
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="biometric">
                                    <div className="flex items-center gap-2">
                                      <div className="w-4 h-4 bg-orange-100 rounded flex items-center justify-center text-xs text-orange-700">
                                        👆
                                      </div>
                                      <span>Biométrico (huella/cara)</span>
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="other">
                                    <div className="flex items-center gap-2">
                                      <div className="w-4 h-4 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-700">
                                        ?
                                      </div>
                                      <span>Otro método</span>
                                    </div>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          />

                          {/* Pattern Drawer - Only show for pattern type */}
                          {watch(`devices.${index}.accessType`) === 'pattern' && (
                            <Controller
                              name={`devices.${index}.accessPassword`}
                              control={control}
                              render={({ field }) => (
                                <PatternDrawer
                                  value={field.value || ''}
                                  onChange={field.onChange}
                                  disabled={isSubmitting}
                                />
                              )}
                            />
                          )}

                          {/* Access Password Input - Only show for text-based types */}
                          {watch(`devices.${index}.accessType`) && 
                           ['pin', 'password', 'other'].includes(watch(`devices.${index}.accessType`)) && (
                            <div className="space-y-1.5">
                              <Input
                                type="text"
                                autoComplete="off"
                                inputMode={watch(`devices.${index}.accessType`) === 'pin' ? 'numeric' : 'text'}
                                {...register(`devices.${index}.accessPassword`)}
                                placeholder={
                                  watch(`devices.${index}.accessType`) === 'pin' ? 'Ej: 1234, 0000' :
                                  watch(`devices.${index}.accessType`) === 'password' ? 'Ej: micontraseña123' :
                                  'Describe el método de acceso...'
                                }
                                className={`h-9 text-sm ${fieldClass} ${errors.devices?.[index]?.accessPassword ? 'border-red-500' : ''}`}
                              />
                            </div>
                          )}

                          {/* Biometric note */}
                          {watch(`devices.${index}.accessType`) === 'biometric' && (
                            <div className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 rounded p-2 border border-blue-200 dark:border-blue-900">
                              ℹ️ El cliente deberá estar presente para desbloquear
                            </div>
                          )}

                          {/* No protection note */}
                          {watch(`devices.${index}.accessType`) === 'none' && (
                            <div className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 rounded p-2 border border-green-200 dark:border-green-900">
                              ✅ El dispositivo se puede acceder libremente
                            </div>
                          )}

                          {errors.devices?.[index]?.accessPassword && (
                            <p className="text-xs text-red-500 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              {errors.devices[index]?.accessPassword?.message}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Images */}
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-muted-foreground dark:text-slate-400">
                          Fotos del Dispositivo
                          <span className="text-xs text-muted-foreground ml-1">(opcional)</span>
                        </Label>
                        <Controller
                          name={`devices.${index}.images`}
                          control={control}
                          render={({ field }) => {
                            // Función mejorada para subir archivos a través de API (evita problemas de RLS)
                            const onUploadFiles = async (files: File[]): Promise<string[]> => {
                              const urls: string[] = []
                              
                              for (const file of files) {
                                try {
                                  const ext = file.name.split('.').pop() || 'jpg'
                                  const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
                                  const path = `uploads/${filename}`
                                  
                                  // Usar FormData para enviar el archivo a nuestra API
                                  const formData = new FormData()
                                  formData.append('file', file)
                                  formData.append('bucket', 'repair-images')
                                  formData.append('path', path)

                                  const response = await fetch('/api/upload', {
                                    method: 'POST',
                                    body: formData
                                  })

                                  if (!response.ok) {
                                    throw new Error(`Upload failed with status: ${response.status}`)
                                  }

                                  const result = await response.json()
                                  
                                  if (result.success && result.url) {
                                    urls.push(result.url)
                                  } else {
                                    throw new Error(result.error || 'Unknown upload error')
                                  }
                                } catch (error) {
                                  console.error('Failed to upload image:', error)
                                  toast.error('Error al subir imagen. Intente nuevamente.')
                                }
                              }
                              return urls
                            }
                            // Plan FREE: sin fotos. BASIC: máx 3. PRO/ENTERPRISE: ilimitado (tope técnico 6).
                            if (photoLimit === 0) {
                              return (
                                <UpgradeHint
                                  requiredPlan="Basic"
                                  message="Las fotos de reparación están disponibles desde el plan Basic."
                                />
                              )
                            }
                            return (
                              <ImageUploader
                                images={field.value || []}
                                onChange={field.onChange}
                                maxImages={photoLimit === null ? 6 : Math.min(6, photoLimit)}
                                maxSize={5242880}
                                onUploadFiles={onUploadFiles}
                              />
                            )
                          }}
                        />
                      </div>
                    </CardContent>
                  </Card>
                )})}

                {errors.devices && typeof errors.devices.message === 'string' && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.devices.message}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Sección 3: Prioridad y Urgencia (Ancho Completo) */}
            <Card className={sectionCardClass}>
              <CardHeader className={`pb-3 ${sectionHeaderClass}`}>
                <div className="flex items-center gap-3">
                  <div className={sectionIconClass}>
                    <AlertCircle className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className={sectionTitleClass}>
                      Prioridad y Urgencia
                    </CardTitle>
                    <p className="text-xs text-muted-foreground dark:text-slate-400 mt-0.5">
                      Define la importancia de la reparación
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 gap-3">
                  {/* Priority */}
                  <div className="space-y-2">
                    <Label htmlFor="priority" className="text-xs font-medium text-muted-foreground dark:text-slate-400">
                      Prioridad <span className="text-red-500">*</span>
                    </Label>
                    <Controller
                      name="priority"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className={`h-9 text-sm ${fieldClass} ${errors.priority ? 'border-red-500' : ''}`}>
                            <SelectValue placeholder="Selecciona" />
                          </SelectTrigger>
                          <SelectContent>
                            {priorityOptions.map(option => (
                              <SelectItem key={option.value} value={option.value}>
                                <div className="flex items-center gap-2">
                                  <Badge className={`${option.color} text-xs px-2 py-0`}>{option.label}</Badge>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.priority && (
                      <p className="text-xs text-red-500 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.priority.message}
                      </p>
                    )}
                  </div>

                  {/* Urgency */}
                  <div className="space-y-2">
                    <Label htmlFor="urgency" className="text-xs font-medium text-muted-foreground dark:text-slate-400">
                      Urgencia <span className="text-red-500">*</span>
                    </Label>
                    <Controller
                      name="urgency"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className={`h-9 text-sm ${fieldClass} ${errors.urgency ? 'border-red-500' : ''}`}>
                            <SelectValue placeholder="Selecciona" />
                          </SelectTrigger>
                          <SelectContent>
                            {urgencyOptions.map(option => (
                              <SelectItem key={option.value} value={option.value}>
                                <div className="flex items-center gap-2">
                                  <Badge className={`${option.color} text-xs px-2 py-0`}>{option.label}</Badge>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.urgency && (
                      <p className="text-xs text-red-500 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.urgency.message}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {mode === 'add' && fields.length > 1 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                Los repuestos, notas y costos se aplican al lote completo. Para registrar costos o piezas distintas por equipo, crea cada reparación por separado.
              </div>
            )}

            {/* Secciones de ancho completo: Repuestos, Notas y Calculadora */}
            {/* Parts */}
            <Card className="shadow-lg border-2 hover:border-primary/30 transition-colors bg-gradient-to-br from-white to-orange-50/30 dark:from-slate-900 dark:to-orange-950/20 dark:border-slate-800 dark:hover:border-primary/50 mt-4">
              <CardHeader className="pb-5 bg-gradient-to-r from-orange-50/50 to-transparent dark:from-orange-950/30 dark:to-transparent">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 dark:from-orange-600 dark:to-orange-700 flex items-center justify-center shadow-md">
                      <Package className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="bg-gradient-to-r from-orange-700 to-orange-600 dark:from-orange-400 dark:to-orange-500 bg-clip-text text-transparent font-bold text-xl">
                        Repuestos y Materiales
                      </CardTitle>
                      {partsFields.length > 0 && (
                        <p className="text-xs text-muted-foreground dark:text-slate-400 mt-1">
                          {partsFields.length} {partsFields.length === 1 ? 'repuesto' : 'repuestos'} • Total: {formatCurrency(
                            partsFields.reduce((acc, _, index) => {
                              const cost = watch(`parts.${index}.cost`) || 0
                              const quantity = watch(`parts.${index}.quantity`) || 0
                              return acc + (cost * quantity)
                            }, 0)
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setInventorySearchOpen(true)}
                      className="gap-2 hover:bg-cyan-50 hover:text-cyan-700 hover:border-cyan-300 dark:hover:bg-cyan-950/50 dark:hover:text-cyan-400 dark:hover:border-cyan-700 transition-colors shadow-sm"
                    >
                      <Package className="h-4 w-4" />
                      Agregar del Inventario
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => appendPart({
                        name: '',
                        cost: 0,
                        quantity: 1,
                        supplier: '',
                        partNumber: ''
                      })}
                      className="gap-2 hover:bg-orange-50 hover:text-orange-700 hover:border-orange-300 dark:hover:bg-orange-950/50 dark:hover:text-orange-400 dark:hover:border-orange-700 transition-colors shadow-sm"
                    >
                      <Plus className="h-4 w-4" />
                      Agregar Repuesto
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-6">
                {partsFields.length === 0 && (
                  <div className="text-center py-12 border-2 border-dashed rounded-xl bg-gradient-to-br from-orange-50/50 to-orange-100/30 dark:from-orange-950/20 dark:to-orange-900/10 border-orange-200 dark:border-orange-900/50">
                    <div className="w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mx-auto mb-4">
                      <Package className="h-8 w-8 text-orange-500 dark:text-orange-400" />
                    </div>
                    <p className="text-muted-foreground dark:text-slate-400 font-medium">No hay repuestos registrados</p>
                    <p className="text-xs text-muted-foreground dark:text-slate-500 mt-1">Agrega los repuestos necesarios para esta reparación</p>
                  </div>
                )}
                {partsFields.map((field, index) => {
                  const cost = watch(`parts.${index}.cost`) || 0
                  const quantity = watch(`parts.${index}.quantity`) || 0
                  const total = cost * quantity
                  
                  return (
                    <Card key={field.id} className="border-2 border-orange-200/50 dark:border-orange-900/30 hover:border-orange-300 dark:hover:border-orange-800 transition-colors bg-gradient-to-br from-white to-orange-50/20 dark:from-slate-900/50 dark:to-orange-950/10 shadow-sm">
                      <CardContent className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                          {/* Número de item */}
                          <div className="md:col-span-12 flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 dark:from-orange-600 dark:to-orange-700 flex items-center justify-center text-xs font-bold text-white shadow-sm">
                                {index + 1}
                              </div>
                              <span className="text-sm font-semibold text-orange-800 dark:text-orange-300">Repuesto {index + 1}</span>
                              {total > 0 && (
                                <Badge variant="secondary" className="ml-2 bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-300 border-orange-300 dark:border-orange-800">
                                  Total: {formatCurrency(total)}
                                </Badge>
                              )}
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removePart(index)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/50 h-8 w-8 p-0"
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </div>

                          {/* Nombre del Repuesto */}
                          <div className="md:col-span-5 space-y-2">
                            <Label className="text-sm font-medium flex items-center gap-1">
                              <Package className="h-3 w-3 text-orange-600 dark:text-orange-400" />
                              Nombre del Repuesto
                              <span className="text-red-500">*</span>
                            </Label>
                            <Input 
                              {...register(`parts.${index}.name`)} 
                              placeholder="Ej: Pantalla OLED, Batería, Conector USB..."
                              className="border-orange-200 dark:border-orange-900/50 focus:border-orange-400 dark:focus:border-orange-600"
                            />
                            {errors.parts?.[index]?.name && (
                              <p className="text-xs text-red-500 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                {errors.parts[index]?.name?.message}
                              </p>
                            )}
                          </div>

                          {/* Costo Unitario */}
                          <div className="md:col-span-2 space-y-2">
                            <Label className="text-sm font-medium flex items-center gap-1">
                              <DollarSign className="h-3 w-3 text-orange-600 dark:text-orange-400" />
                              Costo Unit.
                            </Label>
                            <div className="relative">
                              <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-orange-600 dark:text-orange-400" />
                              <Input 
                                type="number"
                                step="0.01"
                                min="0"
                                className="pl-9 border-orange-200 dark:border-orange-900/50 focus:border-orange-400 dark:focus:border-orange-600 font-semibold" 
                                {...register(`parts.${index}.cost`, { valueAsNumber: true })} 
                                placeholder="0.00"
                              />
                            </div>
                          </div>

                          {/* Cantidad */}
                          <div className="md:col-span-2 space-y-2">
                            <Label className="text-sm font-medium flex items-center gap-1">
                              <Calculator className="h-3 w-3 text-orange-600 dark:text-orange-400" />
                              Cantidad
                            </Label>
                            <Input 
                              type="number"
                              min="1"
                              className="border-orange-200 dark:border-orange-900/50 focus:border-orange-400 dark:focus:border-orange-600 font-semibold text-center" 
                              {...register(`parts.${index}.quantity`, { valueAsNumber: true })} 
                              placeholder="1"
                            />
                          </div>

                          {/* Proveedor */}
                          <div className="md:col-span-3 space-y-2">
                            <Label className="text-sm font-medium flex items-center gap-1">
                              <Package className="h-3 w-3 text-orange-600 dark:text-orange-400" />
                              Proveedor
                            </Label>
                            <Input 
                              {...register(`parts.${index}.supplier`)} 
                              placeholder="Ej: Amazon, MercadoLibre..."
                              className="border-orange-200 dark:border-orange-900/50 focus:border-orange-400 dark:focus:border-orange-600"
                            />
                          </div>

                          {/* Número de Parte (opcional) */}
                          <div className="md:col-span-12 space-y-2">
                            <Label className="text-sm font-medium text-muted-foreground dark:text-slate-400">
                              Número de Parte / SKU (opcional)
                            </Label>
                            <Input 
                              {...register(`parts.${index}.partNumber`)} 
                              placeholder="Ej: A2342, SKU-12345..."
                              className="border-orange-200 dark:border-orange-900/50 focus:border-orange-400 dark:focus:border-orange-600 text-sm"
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </CardContent>
            </Card>

            {/* Notes */}
            <Card className="shadow-lg border-2 hover:border-primary/30 transition-colors bg-gradient-to-br from-white to-indigo-50/30 dark:from-slate-900 dark:to-indigo-950/20 dark:border-slate-800 dark:hover:border-primary/50 mt-4">
              <CardHeader className="pb-5 bg-gradient-to-r from-indigo-50/50 to-transparent dark:from-indigo-950/30 dark:to-transparent">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 dark:from-indigo-600 dark:to-indigo-700 flex items-center justify-center shadow-md">
                      <MessageSquare className="h-5 w-5 text-white" />
                    </div>
                    <span className="bg-gradient-to-r from-indigo-700 to-indigo-600 dark:from-indigo-400 dark:to-indigo-500 bg-clip-text text-transparent font-bold">
                      Notas de Reparación
                    </span>
                  </CardTitle>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => appendNote({
                      text: '',
                      isInternal: false
                    })}
                    className="gap-2 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 dark:hover:bg-indigo-950/50 dark:hover:text-indigo-400 dark:hover:border-indigo-700 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Agregar Nota
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                {notesFields.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                    No hay notas registradas
                  </div>
                )}
                {notesFields.map((field, index) => (
                  <div key={field.id} className="flex gap-4 items-start p-4 border rounded-lg bg-muted/20">
                    <div className="flex-1 space-y-2">
                      <Label className="text-sm">Contenido de la nota</Label>
                      <Textarea {...register(`notes.${index}.text`)} placeholder="Escribe una nota..." />
                      {errors.notes?.[index]?.text && (
                        <p className="text-xs text-red-500">{errors.notes[index]?.text?.message}</p>
                      )}
                      <div className="flex items-center gap-2 pt-2">
                         <Controller
                            control={control}
                            name={`notes.${index}.isInternal`}
                            render={({ field }) => (
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            )}
                          />
                          <Label className="text-sm text-muted-foreground">Nota interna (solo visible para técnicos)</Label>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeNote(index)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 mt-8"
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Cost Calculator */}
            <RepairCostCalculator
              laborCost={watch('laborCost') || 0}
              onLaborCostChange={(cost) => setValue('laborCost', cost)}
              finalCost={watch('finalCost')}
              onFinalCostChange={(cost) => setValue('finalCost', cost)}
              parts={watch('parts') || []}
              disabled={isSubmitting}
              error={errors.finalCost?.message || errors.laborCost?.message}
              calculationMode={calculationMode}
              onCalculationModeChange={setCalculationMode}
              technicianId={watchedTechnicianId}
              technicianName={technicians.find((tech) => tech.id === watchedTechnicianId)?.name}
              canViewCommission={user?.role === 'admin' || user?.role === 'super_admin'}
            />

            {/* Warranty Section */}
            <Card className="shadow-lg border-2 border-amber-200 dark:border-amber-900/50 hover:border-amber-400 dark:hover:border-amber-700 transition-all duration-200 bg-gradient-to-br from-white to-amber-50/20 dark:from-slate-900/50 dark:to-amber-950/10">
              <CardHeader className="pb-3 bg-gradient-to-r from-amber-50/50 to-transparent dark:from-amber-950/30 dark:to-transparent border-b border-amber-100 dark:border-amber-900/30">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 dark:from-amber-600 dark:to-amber-700 flex items-center justify-center shadow-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-amber-800 dark:text-amber-300">
                      🛡️ Garantía
                    </CardTitle>
                    <p className="text-xs text-muted-foreground dark:text-slate-400 mt-0.5">
                      Configure la garantía de la reparación
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Warranty Months */}
                  <div className="space-y-2">
                    <Label htmlFor="warrantyMonths" className="text-sm font-medium flex items-center gap-2">
                      Duración de Garantía
                      <span className="text-xs text-muted-foreground font-normal">(meses)</span>
                    </Label>
                    <Controller
                      name="warrantyMonths"
                      control={control}
                      defaultValue={3}
                      render={({ field }) => (
                        <Select
                          value={String(field.value ?? 3)}
                          onValueChange={(value) => field.onChange(Number(value))}
                          disabled={isSubmitting}
                        >
                          <SelectTrigger className={errors.warrantyMonths ? 'border-red-500' : ''}>
                            <SelectValue placeholder="Seleccionar duración" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">Sin garantía</SelectItem>
                            <SelectItem value="1">1 mes</SelectItem>
                            <SelectItem value="3">3 meses (recomendado)</SelectItem>
                            <SelectItem value="6">6 meses</SelectItem>
                            <SelectItem value="12">1 año</SelectItem>
                            <SelectItem value="24">2 años</SelectItem>
                            <SelectItem value="36">3 años</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.warrantyMonths && (
                      <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.warrantyMonths.message}
                      </p>
                    )}
                  </div>

                  {/* Warranty Type */}
                  <div className="space-y-2">
                    <Label htmlFor="warrantyType" className="text-sm font-medium">
                      Tipo de Cobertura
                    </Label>
                    <Controller
                      name="warrantyType"
                      control={control}
                      defaultValue="full"
                      render={({ field }) => (
                        <Select
                          value={field.value || 'full'}
                          onValueChange={field.onChange}
                          disabled={isSubmitting || watch('warrantyMonths') === 0}
                        >
                          <SelectTrigger className={errors.warrantyType ? 'border-red-500' : ''}>
                            <SelectValue placeholder="Seleccionar tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="labor">
                              <div className="flex flex-col">
                                <span className="font-medium">Solo mano de obra</span>
                                <span className="text-xs text-muted-foreground">Cubre el trabajo realizado</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="parts">
                              <div className="flex flex-col">
                                <span className="font-medium">Solo repuestos</span>
                                <span className="text-xs text-muted-foreground">Cubre las piezas instaladas</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="full">
                              <div className="flex flex-col">
                                <span className="font-medium">Completa</span>
                                <span className="text-xs text-muted-foreground">Cubre mano de obra y repuestos</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.warrantyType && (
                      <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.warrantyType.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Warranty Notes */}
                <div className="space-y-2">
                  <Label htmlFor="warrantyNotes" className="text-sm font-medium flex items-center gap-2">
                    Notas Adicionales
                    <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
                  </Label>
                  <Textarea
                    id="warrantyNotes"
                    placeholder="Ej: Incluye repuestos originales, no cubre daños por líquidos..."
                    className={`min-h-[80px] resize-none ${errors.warrantyNotes ? 'border-red-500' : ''}`}
                    disabled={isSubmitting || watch('warrantyMonths') === 0}
                    {...register('warrantyNotes')}
                  />
                  {errors.warrantyNotes && (
                    <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.warrantyNotes.message}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Estas notas aparecerán en el comprobante de reparación
                  </p>
                </div>

                {/* Warranty Preview */}
                {watch('warrantyMonths') > 0 && (
                  <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center flex-shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600 dark:text-amber-400">
                          <circle cx="12" cy="12" r="10"/>
                          <path d="M12 16v-4"/>
                          <path d="M12 8h.01"/>
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-100 mb-1">
                          Vista Previa de Garantía
                        </h4>
                        <div className="text-xs text-amber-800 dark:text-amber-200 space-y-1">
                          <p>• Duración: <strong>{watch('warrantyMonths')} {watch('warrantyMonths') === 1 ? 'mes' : 'meses'}</strong></p>
                          <p>• Cubre: <strong>
                            {watch('warrantyType') === 'labor' && 'Solo mano de obra'}
                            {watch('warrantyType') === 'parts' && 'Solo repuestos'}
                            {watch('warrantyType') === 'full' && 'Completa (mano de obra + repuestos)'}
                          </strong></p>
                          {watch('warrantyNotes') && (
                            <p>• Notas: <strong>{watch('warrantyNotes')}</strong></p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </form>
        </div>

        {/* Form Actions */}
        <DialogFooter className="flex-shrink-0 px-4 py-3 border-t border-border bg-background dark:border-slate-800">
          <div className="flex items-center justify-between w-full gap-3">
            <div className="text-sm min-w-0">
              {!isValid && Object.keys(errors).length > 0 && (
                <span className="flex items-center gap-2 text-red-600 dark:text-red-400 font-medium text-xs sm:text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  Completa los campos requeridos
                </span>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                form={formId}
                type="submit"
                disabled={isSubmitting}
                className="min-w-[150px]"
              >
                <Save className="h-4 w-4 mr-2" />
                {isSubmitting ? 'Guardando...' : mode === 'add' ? 'Crear Reparación' : 'Guardar Cambios'}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Quick Customer Creation/Edit Modal */}
    <QuickCustomerModal
      open={showQuickCustomerModal}
      onClose={() => {
        setShowQuickCustomerModal(false)
        setEditingCustomer(null)
      }}
      onCustomerCreated={handleQuickCustomerCreated}
      onCustomerUpdated={handleQuickCustomerUpdated}
      customerToEdit={editingCustomer}
    />

    {/* Inventory Product Selector Modal */}
    <Dialog open={inventorySearchOpen} onOpenChange={setInventorySearchOpen}>
      <DialogContent className="sm:max-w-[550px] max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Package className="h-5.5 w-5.5 text-cyan-600 dark:text-cyan-400" />
            Buscar Repuesto en Inventario
          </DialogTitle>
          <DialogDescription>
            Busca y selecciona repuestos del inventario local para agregarlos directamente a esta reparación.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 pb-3 border-b bg-slate-50/50 dark:bg-slate-900/10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={inventorySearchQuery}
              onChange={(e) => setInventorySearchQuery(e.target.value)}
              placeholder="Buscar por nombre de producto o SKU..."
              className="pl-9.5"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 min-h-[300px]">
          {loadingInventory ? (
            <div className="flex flex-col items-center justify-center py-20 text-sm text-muted-foreground gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-cyan-600 dark:text-cyan-400" />
              <span>Buscando repuestos en el inventario...</span>
            </div>
          ) : inventoryProducts.length > 0 ? (
            <div className="grid gap-2.5">
              {inventoryProducts.map((product) => {
                // null/undefined = sin control de stock para ese producto
                // (se permite igual); 0 explícito sí bloquea: agregar un
                // repuesto sin unidades disponibles solo genera un costo que
                // después no se puede cubrir físicamente.
                const outOfStock = product.stock_quantity === 0
                const alreadyAdded = partsFields.some((field, index) => watch(`parts.${index}.productId`) === product.id)

                return (
                <div
                  key={product.id}
                  className={cn(
                    'flex items-center justify-between p-3.5 border rounded-2xl transition-all duration-200',
                    outOfStock
                      ? 'opacity-60 cursor-not-allowed bg-slate-50/50 dark:bg-slate-900/20'
                      : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/40'
                  )}
                  onClick={() => {
                    if (outOfStock) {
                      toast.error(`"${product.name}" no tiene stock disponible`)
                      return
                    }
                    appendPart({
                      name: product.name,
                      cost: product.offer_price || product.sale_price || 0,
                      quantity: 1,
                      supplier: 'Inventario Local',
                      partNumber: product.sku || '',
                      productId: product.id
                    })
                    toast.success(`Repuesto "${product.name}" agregado`, {
                      description: alreadyAdded ? 'Ya habías agregado este repuesto: se sumó otra línea.' : undefined
                    })
                    setInventorySearchOpen(false)
                  }}
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <p className="font-bold text-sm text-slate-850 dark:text-slate-150 leading-snug truncate">
                      {product.name}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5 text-2xs font-semibold text-muted-foreground">
                      {product.sku && (
                        <Badge variant="outline" className="font-mono py-0.5 px-2 text-[9px] font-bold">
                          SKU: {product.sku}
                        </Badge>
                      )}
                      <span className={outOfStock ? 'text-red-600 dark:text-red-400 font-bold' : ''}>
                        {product.stock_quantity !== null && product.stock_quantity !== undefined
                          ? outOfStock ? 'Sin stock' : `Stock: ${product.stock_quantity} disp.`
                          : 'Stock: ilimitado'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <strong className="text-sm font-black text-cyan-600 dark:text-cyan-400">
                      {formatCurrency(product.offer_price || product.sale_price || 0)}
                    </strong>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-7 px-3 text-xs font-bold rounded-lg"
                      disabled={outOfStock}
                    >
                      Seleccionar
                    </Button>
                  </div>
                </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-20">
              <Package className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-350">
                {inventorySearchQuery ? 'No se encontraron repuestos' : 'Escribe para buscar repuestos'}
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                {inventorySearchQuery 
                  ? 'Intenta con otros términos de búsqueda o agrega un repuesto personalizado manual.'
                  : 'Busca por nombre, categoría o código SKU para filtrar la lista.'}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
    </>
  )
}
