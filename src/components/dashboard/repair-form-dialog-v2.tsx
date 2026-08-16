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

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatCurrency } from '@/lib/currency'
import { useAuth } from '@/contexts/auth-context'
import { useBranch } from '@/contexts/branch-context'
import { branchHeaders } from '@/lib/branches/client'
import { useSharedSettings } from '@/hooks/use-shared-settings'
import { calculateRepairPricing, validateRepairPricing } from '@/lib/repairs/pricing'
import { resolveServicePricingSelection } from '@/lib/repairs/service-pricing-selection'
import { cn } from '@/lib/utils'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Save, User, Phone, Mail, Smartphone, Laptop, Tablet,
  AlertCircle, Trash, Plus, Zap, UserPlus, Pencil, Package, MessageSquare, DollarSign, Calculator, FileText,
  Search, Loader2, Maximize2, Minimize2
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
import { PAYMENT_METHODS } from './repairs/RepairPaymentDialog'
import { useCashRegister } from '@/hooks/useCashRegister'
import { OpenCashRegisterDialog } from '@/app/dashboard/pos/components/OpenCashRegisterDialog'
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

// Marcas conocidas + palabras que casi siempre implican una marca aunque el
// texto no la nombre ("iPhone" nunca es de otra marca que Apple). Sirve para
// adivinar marca/tipo/modelo a partir del NOMBRE del servicio (ej. "Cambio
// Pantalla iPhone 13 Pro"), que es texto libre que cada organización carga a
// su gusto — no hay un campo estructurado de marca/modelo en el catálogo de
// servicios. Por eso esto es una heurística de mejor esfuerzo, no una
// búsqueda exacta: puede no acertar, y quien complete el formulario siempre
// puede corregir lo que se autocompletó.
const SERVICE_NAME_DEVICE_HINTS: Array<{
  keyword: string
  brand: string
  deviceType: 'smartphone' | 'tablet' | 'laptop' | 'desktop'
}> = [
  { keyword: 'iphone', brand: 'Apple', deviceType: 'smartphone' },
  { keyword: 'ipad', brand: 'Apple', deviceType: 'tablet' },
  { keyword: 'macbook', brand: 'Apple', deviceType: 'laptop' },
  { keyword: 'imac', brand: 'Apple', deviceType: 'desktop' },
  { keyword: 'galaxy tab', brand: 'Samsung', deviceType: 'tablet' },
  { keyword: 'galaxy', brand: 'Samsung', deviceType: 'smartphone' },
  { keyword: 'redmi', brand: 'Xiaomi', deviceType: 'smartphone' },
  { keyword: 'poco', brand: 'Xiaomi', deviceType: 'smartphone' },
  { keyword: 'mi pad', brand: 'Xiaomi', deviceType: 'tablet' },
  { keyword: 'moto ', brand: 'Motorola', deviceType: 'smartphone' },
]

const KNOWN_DEVICE_BRANDS = [
  'Apple', 'Samsung', 'Xiaomi', 'Huawei', 'Motorola', 'LG', 'Sony',
  'Lenovo', 'HP', 'Dell', 'Asus', 'Acer', 'Nokia', 'OnePlus', 'Oppo', 'Vivo', 'ZTE', 'Realme'
]

function guessDeviceFromServiceName(serviceName: string): {
  brand?: string
  deviceType?: 'smartphone' | 'tablet' | 'laptop' | 'desktop'
  model?: string
} {
  const lower = serviceName.toLowerCase()

  // Prioridad 1: palabras que implican marca y tipo a la vez (iPhone, Galaxy...).
  const hint = SERVICE_NAME_DEVICE_HINTS.find((h) => lower.includes(h.keyword))
  if (hint) {
    const anchorIndex = lower.indexOf(hint.keyword)
    const afterAnchor = serviceName.slice(anchorIndex + hint.keyword.length).trim()
    return {
      brand: hint.brand,
      deviceType: hint.deviceType,
      model: afterAnchor || undefined,
    }
  }

  // Prioridad 2: el nombre de una marca conocida aparece literal (ej. "Cambio
  // batería Sony Xperia"). No hay pista de tipo en este caso, se deja vacío.
  const brand = KNOWN_DEVICE_BRANDS.find((b) => lower.includes(b.toLowerCase()))
  if (brand) {
    const anchorIndex = lower.indexOf(brand.toLowerCase())
    const afterAnchor = serviceName.slice(anchorIndex + brand.length).trim()
    return { brand, model: afterAnchor || undefined }
  }

  return {}
}

function findFirstErrorPath(value: unknown, prefix = ''): string | null {
  if (!value || typeof value !== 'object') return null

  const record = value as Record<string, unknown>
  if (typeof record.message === 'string' && prefix) return prefix

  for (const [key, nestedValue] of Object.entries(record)) {
    if (key === 'message' || key === 'type' || key === 'ref' || key === 'types' || key === 'root') continue
    const path = findFirstErrorPath(nestedValue, prefix ? `${prefix}.${key}` : key)
    if (path) return path
  }

  return null
}

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
  const { selectedBranchId } = useBranch()
  const { settings: sharedSettings } = useSharedSettings()
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
    purchase_price?: number | null
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
          `/api/products?per_page=15&strict_branch_stock=true&query=${encodeURIComponent(inventorySearchQuery)}`,
          {
            signal: controller.signal,
            headers: branchHeaders(selectedBranchId),
          }
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
  }, [inventorySearchOpen, inventorySearchQuery, selectedBranchId])

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
  }>>([])
  const [loadingServices, setLoadingServices] = useState(false)
  // Decide qué pasa al elegir un servicio: si su precio ya incluye repuestos
  // (el repuesto que se agregue después se descuenta de la mano de obra para
  // que el total no se mueva) o si es solo mano de obra (el repuesto suma
  // arriba). No hay forma de adivinar esto del catálogo — cada organización
  // arma sus precios distinto — así que lo elige quien está cargando.
  const [serviceIncludesParts, setServiceIncludesParts] = useState(false)

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
          {
            signal: controller.signal,
            headers: branchHeaders(selectedBranchId),
          }
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
  }, [serviceSearchIndex, serviceSearchQuery, selectedBranchId])

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
    getValues,
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
      laborCost: initialData?.laborCost ?? 0,
      finalCost: initialData?.finalCost ?? null,
      pricingMode: initialData?.pricingMode || 'automatic',
      discountAmount: initialData?.discountAmount || 0,
      priceOverrideReason: initialData?.priceOverrideReason || '',
      warrantyMonths: initialData?.warrantyMonths ?? 3,
      warrantyType: initialData?.warrantyType || 'full',
      warrantyNotes: initialData?.warrantyNotes || '',
      depositAmount: null,
      depositMethod: null,
      depositReference: ''
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

  const [calculationMode, setCalculationMode] = useState<CostCalculationMode>(initialData?.pricingMode || 'automatic')
  const { user } = useAuth()

  // Estado de caja para el adelanto: si está cerrada, el campo se bloquea y
  // se ofrece abrirla ahí mismo en vez de dejar cargar un monto que el
  // cobro real (al guardar) va a rechazar igual por falta de caja abierta.
  const cashRegister = useCashRegister()
  const [cajaChecked, setCajaChecked] = useState(false)
  const [cajaAbierta, setCajaAbierta] = useState(false)
  const [isOpenRegisterDialogOpen, setIsOpenRegisterDialogOpen] = useState(false)
  const [openingAmount, setOpeningAmount] = useState('')
  const [openingNote, setOpeningNote] = useState('')
  const [isOpeningRegister, setIsOpeningRegister] = useState(false)

  // checkOpenSession cambia de identidad en cada chequeo (depende de
  // currentSession): se guarda en un ref para poder llamar siempre a la
  // versión más nueva desde un callback de identidad estable, sin meterlo
  // en un array de dependencias y sin quedarse con una versión vieja.
  const checkOpenSessionRef = useRef(cashRegister.checkOpenSession)
  useEffect(() => {
    checkOpenSessionRef.current = cashRegister.checkOpenSession
  })

  const refreshCajaStatus = useCallback(async () => {
    const session = await checkOpenSessionRef.current()
    setCajaAbierta(!!session)
    setCajaChecked(true)
    return !!session
  }, [])

  useEffect(() => {
    if (mode !== 'add') return
    void refreshCajaStatus()
  }, [mode, refreshCajaStatus])
  const watchedParts = watch('parts')
  const watchedFinalCost = watch('finalCost')
  const watchedLaborCost = watch('laborCost')
  const watchedDiscountAmount = watch('discountAmount')

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

  const calculatedPricing = useMemo(() => calculateRepairPricing({
    mode: calculationMode,
    currency: sharedSettings.currency,
    laborCost: watchedLaborCost,
    finalCost: watchedFinalCost,
    discountAmount: watchedDiscountAmount,
    paidAmount: repair?.paidAmount || 0,
    parts: watchedParts,
  }), [calculationMode, sharedSettings.currency, watchedLaborCost, watchedFinalCost, watchedDiscountAmount, repair?.paidAmount, watchedParts])

  useEffect(() => {
    if (calculationMode === 'budget') {
      if (watchedFinalCost === null || watchedFinalCost === undefined) return
      if (calculatedPricing.laborCost !== watchedLaborCost) {
        setValue('laborCost', calculatedPricing.laborCost, { shouldDirty: true, shouldValidate: true })
      }
      return
    }

    if (calculationMode === 'automatic') {
      if (calculatedPricing.customerTotal !== watchedFinalCost) {
        setValue('finalCost', calculatedPricing.customerTotal, { shouldDirty: true, shouldValidate: true })
      }
    }
  }, [calculationMode, calculatedPricing.customerTotal, calculatedPricing.laborCost, watchedFinalCost, watchedLaborCost, setValue])

  // Reset only once per dialog session. Technician data can arrive after the
  // dialog opens and must never erase fields the operator already completed.
  const dialogSessionRef = useRef<string | null>(null)
  useEffect(() => {
    if (!open) {
      dialogSessionRef.current = null
      return
    }

    const sessionKey = `${mode}:${repair?.id || 'new'}`
    if (dialogSessionRef.current !== sessionKey) {
      dialogSessionRef.current = sessionKey
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
        laborCost: initialData?.laborCost ?? 0,
        finalCost: initialData?.finalCost ?? null,
        pricingMode: initialData?.pricingMode || 'automatic',
        discountAmount: initialData?.discountAmount || 0,
        priceOverrideReason: initialData?.priceOverrideReason || '',
        warrantyMonths: initialData?.warrantyMonths ?? 3,
        warrantyType: initialData?.warrantyType || 'full',
        warrantyNotes: initialData?.warrantyNotes || '',
        depositAmount: initialData?.depositAmount ?? null,
        depositMethod: initialData?.depositMethod ?? null,
        depositReference: initialData?.depositReference || ''
      })
      setSelectedQuickCustomer(null)
      setCalculationMode(initialData?.pricingMode || 'automatic')
    }
  }, [open, mode, repair?.id, initialData, reset, user?.id, technicians])

  useEffect(() => {
    if (!open || mode !== 'add' || !user?.id) return
    if (!technicians.some((tech) => tech.id === user.id)) return
    if (getValues('devices.0.technician')) return

    setValue('devices.0.technician', user.id, { shouldDirty: false, shouldValidate: true })
  }, [getValues, mode, open, setValue, technicians, user?.id])

  useEffect(() => {
    if (open) {
      void trigger()
    }
  }, [open, quickMode, trigger])

  // Handle form submission
  const onSubmitForm = async (data: RepairFormData) => {
    // El monto del adelanto no exige método a nivel schema (así no se
    // valida un método sin monto por defecto); acá sí es obligatorio si
    // hay algo cargado, para no perder de qué manera cobrar.
    if ((data.depositAmount ?? 0) > 0 && !data.depositMethod) {
      toast.error('Elegí un método de pago para el adelanto, o dejá el monto en blanco.')
      return
    }
    setIsSubmitting(true)
    try {
      const isBasicBatch = mode === 'add' && data.devices.length > 1
      const baseSubmissionData = quickMode || isBasicBatch
        ? {
            ...data,
            parts: [],
            notes: [],
            laborCost: 0,
            finalCost: null,
            pricingMode: 'automatic' as const,
            discountAmount: 0,
            priceOverrideReason: '',
            warrantyMonths: 0,
            warrantyNotes: '',
            depositAmount: null,
            depositMethod: null,
            depositReference: '',
          }
        : data
      const effectivePricingMode: CostCalculationMode = quickMode || isBasicBatch ? 'automatic' : calculationMode
      const pricing = calculateRepairPricing({
        mode: effectivePricingMode,
        currency: sharedSettings.currency,
        laborCost: baseSubmissionData.laborCost,
        finalCost: baseSubmissionData.finalCost,
        discountAmount: baseSubmissionData.discountAmount,
        paidAmount: repair?.paidAmount || 0,
        parts: baseSubmissionData.parts,
      })
      const violations = validateRepairPricing({
        mode: effectivePricingMode,
        currency: sharedSettings.currency,
        laborCost: baseSubmissionData.laborCost,
        finalCost: baseSubmissionData.finalCost,
        discountAmount: baseSubmissionData.discountAmount,
        paidAmount: repair?.paidAmount || 0,
        parts: baseSubmissionData.parts,
      })
      if (violations.includes('DISCOUNT_EXCEEDS_SUBTOTAL')) {
        toast.error('El descuento no puede superar el subtotal de la reparación.')
        return
      }
      if (violations.includes('FINAL_REQUIRED')) {
        toast.error('Ingresa el total acordado con el cliente.')
        return
      }
      if (violations.includes('FINAL_BELOW_PARTS_PRICE')) {
        toast.error('El presupuesto no cubre el precio de los repuestos.')
        return
      }
      if (violations.includes('FINAL_BELOW_PAID_AMOUNT')) {
        toast.error('El total no puede ser menor que el monto ya pagado.')
        return
      }
      if (pricing.discountAmount > 0 && (baseSubmissionData.priceOverrideReason || '').trim().length < 5) {
        toast.error('Especifica el motivo del descuento.')
        return
      }
      if (effectivePricingMode === 'manual' && pricing.customerTotal < pricing.partsPrice && (baseSubmissionData.priceOverrideReason || '').trim().length < 5) {
        toast.error('Especifica el motivo del precio manual por debajo de los repuestos.')
        return
      }
      if ((baseSubmissionData.depositAmount ?? 0) > pricing.customerTotal) {
        toast.error('El adelanto no puede superar el total de la reparación.')
        return
      }
      const hasPricingDetails = pricing.laborCost > 0 || pricing.partsPrice > 0 || baseSubmissionData.finalCost !== null
      const submissionData = baseSubmissionData.devices.length === 1 && hasPricingDetails
        ? {
            ...baseSubmissionData,
            laborCost: pricing.laborCost,
            finalCost: pricing.customerTotal,
            pricingMode: effectivePricingMode,
            devices: [{
              ...baseSubmissionData.devices[0],
              estimatedCost: pricing.customerTotal,
            }],
          }
        : { ...baseSubmissionData, pricingMode: effectivePricingMode }
      const didSubmit = await onSubmit(submissionData)
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

  const handleAddDevice = () => {
    const values = getValues()
    const hasIndividualDetails =
      (values.parts?.length ?? 0) > 0 ||
      (values.notes?.length ?? 0) > 0 ||
      (values.laborCost ?? 0) > 0 ||
      values.finalCost !== null ||
      (values.depositAmount ?? 0) > 0

    if (hasIndividualDetails) {
      toast.error('Los costos, repuestos, notas y adelantos corresponden a un solo equipo. Quita esos datos antes de agregar otro.')
      return
    }

    append({
      deviceType: 'smartphone',
      brand: '',
      model: '',
      issue: '',
      description: '',
      accessType: 'none',
      images: [],
      technician: '',
      estimatedCost: 0
    })
  }

  // Focus first error field on submit
  useEffect(() => {
    if (submitCount > 0 && Object.keys(errors).length > 0) {
      const firstErrorField = findFirstErrorPath(errors)
      if (firstErrorField) {
        setFocus(firstErrorField as Parameters<typeof setFocus>[0])
      }
    }
  }, [errors, setFocus, submitCount])

  // Estado para pantalla completa
  const [isFullscreen, setIsFullscreen] = useState(false)

  return (
    <>
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose() }}>
      <DialogContent className={`overflow-hidden flex flex-col p-0 transition-all duration-300 rounded-lg border-border/60 shadow-xl max-sm:w-screen max-sm:h-[100dvh] max-sm:max-w-full max-sm:rounded-none ${isFullscreen ? 'sm:w-[98vw] sm:max-w-[98vw] sm:h-[96vh] sm:max-h-[96vh]' : 'sm:w-[94vw] sm:max-w-6xl sm:h-[90vh] sm:max-h-[90vh]'} dark:bg-slate-950 dark:border-slate-800`}>
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
                aria-label={isFullscreen ? "Salir de pantalla completa" : "Ver en pantalla completa"}
              >
                {isFullscreen ? <Minimize2 className="h-[18px] w-[18px]" /> : <Maximize2 className="h-[18px] w-[18px]" />}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto bg-muted/20 px-3 py-4 sm:px-6 sm:py-5 dark:bg-slate-950">
          <form id={formId} onSubmit={handleSubmit(onSubmitForm)} className="mx-auto max-w-[1800px] space-y-5">
            {/* Quick Mode Toggle */}
            <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200/70 bg-amber-50 px-3 py-3 sm:px-4 dark:border-amber-800/50 dark:bg-amber-950/30">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-400/90 dark:bg-amber-500 flex items-center justify-center shrink-0">
                  <Zap className="h-4.5 w-4.5 text-white" />
                </div>
                <div>
                  <Label htmlFor="quick-mode" className="cursor-pointer font-semibold text-sm text-amber-900 dark:text-amber-100">
                    Modo Rápido
                  </Label>
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Solo cliente, equipo, problema y asignación
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

            <nav aria-label="Secciones del formulario" className="sticky top-0 z-10 rounded-lg border bg-background/95 p-2 shadow-sm backdrop-blur">
              <ol className="grid grid-cols-3 gap-1">
                {[
                  { id: 'repair-customer-section', number: 1, label: 'Cliente' },
                  { id: 'repair-device-section', number: 2, label: 'Equipo' },
                  { id: 'repair-details-section', number: 3, label: quickMode ? 'Asignación' : 'Detalles' },
                ].map((step) => (
                  <li key={step.id}>
                    <button
                      type="button"
                      onClick={() => document.getElementById(step.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                      className="flex h-9 w-full items-center justify-center gap-2 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:text-sm"
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                        {step.number}
                      </span>
                      <span className="truncate">{step.label}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </nav>

            {/* Sección 1: Información del Cliente (Ancho Completo) */}
            <Card id="repair-customer-section" className={`${sectionCardClass} scroll-mt-16`}>
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
            <Card id="repair-device-section" className={`${sectionCardClass} scroll-mt-16`}>
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
                      onClick={handleAddDevice}
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
                              Precio de referencia del servicio
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
                                <div className="p-2.5 border-b space-y-2">
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
                                  {fields.length === 1 && (
                                    <label className="flex items-center gap-2 text-[11px] text-muted-foreground cursor-pointer">
                                      <Switch
                                        checked={serviceIncludesParts}
                                        onCheckedChange={setServiceIncludesParts}
                                        className="h-4 w-7 [&>span]:h-3 [&>span]:w-3 [&>span]:data-[state=checked]:translate-x-3"
                                      />
                                      <span>
                                        El precio del servicio ya incluye repuestos
                                        {serviceIncludesParts && (
                                          <span className="block text-primary">
                                            Si agregás un repuesto después, se descuenta de la mano de obra: el total no cambia.
                                          </span>
                                        )}
                                      </span>
                                    </label>
                                  )}
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

                                            // Tipo, marca y modelo: el catálogo de servicios no tiene
                                            // estos como campos propios (solo nombre y precio), así
                                            // que se infieren del NOMBRE del servicio. Es una
                                            // heurística de texto, no un dato exacto — por eso solo
                                            // completa lo que esté VACÍO, nunca pisa lo ya escrito.
                                            const guess = guessDeviceFromServiceName(svc.name)
                                            if (guess.deviceType && !watch(`devices.${index}.deviceType`)) {
                                              setValue(`devices.${index}.deviceType`, guess.deviceType, {
                                                shouldDirty: true,
                                                shouldValidate: true,
                                              })
                                            }
                                            if (guess.brand && !watch(`devices.${index}.brand`)) {
                                              setValue(`devices.${index}.brand`, guess.brand, {
                                                shouldDirty: true,
                                                shouldValidate: true,
                                              })
                                            }
                                            if (guess.model && !watch(`devices.${index}.model`)) {
                                              setValue(`devices.${index}.model`, guess.model, {
                                                shouldDirty: true,
                                                shouldValidate: true,
                                              })
                                            }

                                            // El servicio también carga la calculadora compartida,
                                            // pero solo cuando no hay ambigüedad de a cuál equipo
                                            // corresponde: un solo equipo en el formulario (la
                                            // calculadora es compartida entre todos, no por equipo).
                                            //
                                            // Dos caminos según si el precio ya incluye repuestos:
                                            // - Ya incluye: se fija como Costo Final y se pasa a modo
                                            //   "labor = final - repuestos", así que un repuesto que
                                            //   se agregue después se descuenta de la mano de obra y
                                            //   el total sigue en el mismo precio pactado.
                                            // - Es solo mano de obra: se fija como Mano de Obra en
                                            //   modo manual (como antes), y un repuesto que se agregue
                                            //   suma arriba, como corresponde si no estaba incluido.
                                            const selection = resolveServicePricingSelection({
                                              price,
                                              includesParts: serviceIncludesParts,
                                              deviceCount: fields.length,
                                            })

                                            if (selection.affectsCalculator && selection.pricingMode) {
                                              setCalculationMode(selection.pricingMode)
                                              setValue('pricingMode', selection.pricingMode, { shouldDirty: true })

                                              if (selection.laborCost !== undefined) {
                                                setValue('laborCost', selection.laborCost, { shouldDirty: true, shouldValidate: true })
                                              }
                                              if (selection.finalCost !== undefined) {
                                                setValue('finalCost', selection.finalCost, { shouldDirty: true, shouldValidate: true })
                                              }
                                            }

                                            const calculatorNote = selection.message || null

                                            toast.success(`"${svc.name}" — ${formatCurrency(price)}`, {
                                              description: [
                                                customerIsWholesale && svc.wholesale_price ? 'Precio mayorista aplicado.' : null,
                                                calculatorNote,
                                                (guess.brand || guess.model || guess.deviceType)
                                                  ? 'Tipo/marca/modelo sugeridos: revisalos antes de guardar.'
                                                  : null,
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
                          <p className="text-[11px] text-muted-foreground">
                            Al elegir un servicio, este valor también actualiza la calculadora cuando hay un solo equipo.
                          </p>
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
            <Card id="repair-details-section" className={`${sectionCardClass} scroll-mt-16`}>
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

            {!quickMode && mode === 'add' && fields.length > 1 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                El alta múltiple registra los datos básicos de cada equipo. Para cargar repuestos, notas, costos, adelantos o garantía, crea cada reparación por separado.
              </div>
            )}

            {!quickMode && (mode !== 'add' || fields.length === 1) && (
              <>
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
                        internalCost: 0,
                        quantity: 1,
                        stockAvailable: null,
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
                  const productId = watch(`parts.${index}.productId`)
                  const stockAvailable = watch(`parts.${index}.stockAvailable`)
                  const total = cost * quantity
                  
                  return (
                    <Card key={field.id} className="border-2 border-orange-200/50 dark:border-orange-900/30 hover:border-orange-300 dark:hover:border-orange-800 transition-colors bg-gradient-to-br from-white to-orange-50/20 dark:from-slate-900/50 dark:to-orange-950/10 shadow-sm">
                      <CardContent className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                          {/* Número de item */}
                          <div className="md:col-span-12 flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 dark:from-orange-600 dark:to-orange-700 flex items-center justify-center text-xs font-bold text-white shadow-sm">
                                {index + 1}
                              </div>
                              <span className="text-sm font-semibold text-orange-800 dark:text-orange-300">Repuesto {index + 1}</span>

                              {productId ? (
                                <Badge variant="outline" className="bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800 text-[11px] gap-1">
                                  <Package className="h-3 w-3 text-cyan-600 dark:text-cyan-400" />
                                  Inventario Local
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setValue(`parts.${index}.productId`, undefined, { shouldDirty: true })
                                      setValue(`parts.${index}.stockAvailable`, null, { shouldDirty: true })
                                      toast.info(`Repuesto "${watch(`parts.${index}.name`)}" desvinculado del inventario local`)
                                    }}
                                    className="ml-1 px-1 py-0.2 rounded hover:bg-red-100 dark:hover:bg-red-950 text-red-600 font-bold transition-colors"
                                    title="Desvincular del inventario local (convertir en repuesto manual)"
                                  >
                                    ✕
                                  </button>
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 text-[11px]">
                                  Repuesto manual
                                </Badge>
                              )}

                              {total > 0 && (
                                <Badge variant="secondary" className="bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-300 border-orange-300 dark:border-orange-800">
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

                          {/* Precio cobrado al cliente */}
                          <div className="md:col-span-3 space-y-2">
                            <Label className="text-sm font-medium flex items-center gap-1">
                              <DollarSign className="h-3 w-3 text-orange-600 dark:text-orange-400" />
                              Precio al cliente
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
                            {errors.parts?.[index]?.cost && (
                              <p className="flex items-center gap-1 text-xs text-red-500">
                                <AlertCircle className="h-3 w-3" />
                                {errors.parts[index]?.cost?.message}
                              </p>
                            )}
                          </div>

                          {/* Costo real para margen y reportes */}
                          <div className="md:col-span-2 space-y-2">
                            <Label className="text-sm font-medium">Costo interno</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              disabled={Boolean(productId)}
                              className="font-medium"
                              {...register(`parts.${index}.internalCost`, { valueAsNumber: true })}
                              placeholder={productId ? 'Desde inventario' : '0.00'}
                            />
                            <p className="text-[11px] leading-4 text-muted-foreground">
                              {productId ? 'Se toma del costo de compra del producto.' : 'Se usa para calcular el margen; no se muestra al cliente.'}
                            </p>
                            {errors.parts?.[index]?.internalCost && (
                              <p className="flex items-center gap-1 text-xs text-red-500">
                                <AlertCircle className="h-3 w-3" />
                                {errors.parts[index]?.internalCost?.message}
                              </p>
                            )}
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
                              max={productId && stockAvailable !== null && stockAvailable !== undefined ? stockAvailable : undefined}
                              className="border-orange-200 dark:border-orange-900/50 focus:border-orange-400 dark:focus:border-orange-600 font-semibold text-center" 
                              {...register(`parts.${index}.quantity`, { valueAsNumber: true })} 
                              placeholder="1"
                            />
                            {productId && stockAvailable !== null && stockAvailable !== undefined && (
                              <p className="text-[11px] text-muted-foreground">Disponible: {stockAvailable}</p>
                            )}
                            {errors.parts?.[index]?.quantity && (
                              <p className="flex items-center gap-1 text-xs text-red-500">
                                <AlertCircle className="h-3 w-3" />
                                {errors.parts[index]?.quantity?.message}
                              </p>
                            )}
                          </div>

                          {/* Proveedor */}
                          <div className="md:col-span-2 space-y-2">
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
              onLaborCostChange={(cost) => setValue('laborCost', cost, { shouldDirty: true, shouldValidate: true })}
              finalCost={watch('finalCost')}
              onFinalCostChange={(cost) => setValue('finalCost', cost, { shouldDirty: true, shouldValidate: true })}
              discountAmount={watch('discountAmount') || 0}
              onDiscountAmountChange={(amount) => setValue('discountAmount', amount, { shouldDirty: true, shouldValidate: true })}
              paidAmount={repair?.paidAmount || 0}
              currency={sharedSettings.currency}
              parts={watch('parts') || []}
              disabled={isSubmitting}
              error={errors.finalCost?.message || errors.laborCost?.message}
              calculationMode={calculationMode}
              onCalculationModeChange={(nextMode) => {
                setCalculationMode(nextMode)
                setValue('pricingMode', nextMode, { shouldDirty: true })
              }}
              canUseManual={user?.role === 'admin' || user?.role === 'super_admin'}
              overrideReason={watch('priceOverrideReason') || ''}
              onOverrideReasonChange={(reason) => setValue('priceOverrideReason', reason, { shouldDirty: true, shouldValidate: true })}
              taxRate={sharedSettings.taxRate}
              technicianId={watchedTechnicianId}
              technicianName={technicians.find((tech) => tech.id === watchedTechnicianId)?.name}
              canViewCommission={user?.role === 'admin' || user?.role === 'super_admin'}
            />

            {/* Adelanto al recibir: solo tiene sentido con un equipo. Con
                varios, el formulario ya obliga a costos compartidos (ver
                hasSharedRepairData en page.tsx), así que un solo adelanto
                repartido entre reparaciones distintas sería ambiguo. */}
            {mode === 'add' && fields.length === 1 && (
              <Card className="shadow-lg border-2 border-emerald-200 dark:border-emerald-900/50 hover:border-emerald-400 dark:hover:border-emerald-700 transition-all duration-200 bg-gradient-to-br from-white to-emerald-50/20 dark:from-slate-900/50 dark:to-emerald-950/10">
                <CardHeader className="pb-3 bg-gradient-to-r from-emerald-50/50 to-transparent dark:from-emerald-950/30 dark:to-transparent border-b border-emerald-100 dark:border-emerald-900/30">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-700 flex items-center justify-center shadow-lg">
                      <DollarSign className="h-[18px] w-[18px] text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold text-emerald-800 dark:text-emerald-300">
                        Adelanto <span className="font-normal text-muted-foreground">(opcional)</span>
                      </CardTitle>
                      <p className="text-xs text-muted-foreground dark:text-slate-400 mt-0.5">
                        Si el cliente paga algo al dejar el equipo, se cobra al guardar
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  {cajaChecked && !cajaAbierta && (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5">
                      <p className="text-xs text-amber-800 dark:text-amber-300">
                        La caja está cerrada: no se puede registrar un adelanto hasta abrirla.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 shrink-0 border-amber-400 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/40"
                        onClick={() => setIsOpenRegisterDialogOpen(true)}
                      >
                        Abrir caja
                      </Button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="depositAmount" className="text-sm font-medium">Monto del adelanto</Label>
                      <Input
                        id="depositAmount"
                        type="number"
                        min={0}
                        step="0.01"
                        {...register('depositAmount', { valueAsNumber: true })}
                        placeholder="0"
                        disabled={isSubmitting || !cajaAbierta}
                      />
                      {errors.depositAmount && (
                        <p className="text-xs text-red-500">{errors.depositAmount.message}</p>
                      )}
                    </div>

                    {cajaAbierta && (watch('depositAmount') ?? 0) > 0 && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Método de pago</Label>
                        <div className="grid grid-cols-3 gap-1.5">
                          {PAYMENT_METHODS.filter((m) => m.id !== 'credit').map((m) => {
                            const Icon = m.icon
                            const isSelected = watch('depositMethod') === m.id
                            return (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => setValue('depositMethod', m.id as 'cash' | 'card' | 'transfer', { shouldDirty: true })}
                                disabled={isSubmitting}
                                className={cn(
                                  'flex flex-col items-center gap-1 rounded-lg border-2 p-2 text-[11px] font-medium transition-all',
                                  isSelected
                                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                                    : 'border-border hover:border-muted-foreground/40 hover:bg-muted/30 text-muted-foreground'
                                )}
                              >
                                <Icon className="h-4 w-4" />
                                {m.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {cajaAbierta && (watch('depositAmount') ?? 0) > 0 && PAYMENT_METHODS.find((m) => m.id === watch('depositMethod'))?.requiresRef && (
                    <div className="space-y-2">
                      <Label htmlFor="depositReference" className="text-sm font-medium">
                        {watch('depositMethod') === 'card' ? 'N° de Autorización' : 'N° de Referencia'}
                      </Label>
                      <Input
                        id="depositReference"
                        {...register('depositReference')}
                        placeholder={watch('depositMethod') === 'card' ? 'Últimos 4 dígitos' : 'Número de referencia'}
                        disabled={isSubmitting}
                      />
                    </div>
                  )}

                  {cajaAbierta && (watch('depositAmount') ?? 0) > 0 && !watch('depositMethod') && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Elegí un método de pago para el adelanto.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

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
                      🛡️ Configuración de Garantía del Servicio
                    </CardTitle>
                    <p className="text-xs text-muted-foreground dark:text-slate-400 mt-0.5">
                      Establece el tiempo de cobertura y cláusulas que figurarán en el comprobante del cliente
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {/* Atajos Rápidos de Selección */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-amber-900 dark:text-amber-300 uppercase tracking-wider">
                    Atajos Rápidos de Duración
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { months: 0, label: 'Sin Garantía' },
                      { months: 1, label: '1 Mes' },
                      { months: 3, label: '3 Meses (Estándar)' },
                      { months: 6, label: '6 Meses' },
                      { months: 12, label: '1 Año' },
                    ].map((preset) => {
                      const active = watch('warrantyMonths') === preset.months
                      return (
                        <Button
                          key={preset.months}
                          type="button"
                          variant={active ? 'default' : 'outline'}
                          size="sm"
                          disabled={isSubmitting}
                          onClick={() => setValue('warrantyMonths', preset.months, { shouldDirty: true, shouldValidate: true })}
                          className={cn(
                            'h-7 text-xs rounded-lg transition-all',
                            active
                              ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm font-semibold'
                              : 'border-amber-200 dark:border-amber-900/60 hover:bg-amber-100/50 dark:hover:bg-amber-950/40 text-amber-900 dark:text-amber-300'
                          )}
                        >
                          {preset.label}
                        </Button>
                      )
                    })}
                  </div>
                </div>

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
                            <SelectItem value="0">Sin garantía (0 meses)</SelectItem>
                            <SelectItem value="1">1 mes</SelectItem>
                            <SelectItem value="3">3 meses (recomendado)</SelectItem>
                            <SelectItem value="6">6 meses</SelectItem>
                            <SelectItem value="12">1 año (12 meses)</SelectItem>
                            <SelectItem value="24">2 años (24 meses)</SelectItem>
                            <SelectItem value="36">3 años (36 meses)</SelectItem>
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
                                <span className="font-medium">Completa (Mano de obra + Repuestos)</span>
                                <span className="text-xs text-muted-foreground">Cobertura integral recomendada</span>
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

                {/* Warranty Notes with Template Chips */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="warrantyNotes" className="text-sm font-medium flex items-center gap-2">
                      Notas y Condiciones Especiales
                      <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
                    </Label>
                  </div>

                  {/* Plantillas Rápidas de Cláusulas */}
                  {watch('warrantyMonths') > 0 && (
                    <div className="space-y-1">
                      <span className="text-[11px] text-muted-foreground font-medium">Insertar cláusula rápida:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          'Aplica únicamente a la pieza sustituida.',
                          'No cubre daños por humedad, agua o líquidos.',
                          'No cubre caídas, golpes o fracturas de cristal.',
                          'Garantía de batería por ciclos de carga.',
                          'Conserve el comprobante para reclamos.',
                        ].map((clause) => (
                          <button
                            key={clause}
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => {
                              const current = watch('warrantyNotes') || ''
                              if (current.includes(clause)) return
                              const updated = current ? `${current}\n• ${clause}` : `• ${clause}`
                              setValue('warrantyNotes', updated, { shouldDirty: true })
                            }}
                            className="text-[11px] px-2 py-0.5 rounded border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
                          >
                            + {clause}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <Textarea
                    id="warrantyNotes"
                    placeholder="Ej: La garantía aplica sobre la pantalla cambiada. Excluye daños por humedad o golpes posteriores..."
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
                    Estas notas aparecerán en la sección 🛡️ Garantía del comprobante impreso o PDF.
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
              </>
            )}
          </form>
        </div>

        {/* Form Actions */}
        <DialogFooter className="flex-shrink-0 border-t border-border bg-background px-3 py-3 sm:px-4 dark:border-slate-800">
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <div className="min-h-5 min-w-0 text-sm">
              {!isValid && Object.keys(errors).length > 0 && (
                <span className="flex items-center gap-2 text-red-600 dark:text-red-400 font-medium text-xs sm:text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  Completa los campos requeridos
                </span>
              )}
            </div>
            <div className="grid w-full shrink-0 grid-cols-2 gap-2 sm:flex sm:w-auto">
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
                className="min-w-0 sm:min-w-[150px]"
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

    {/* Abrir caja, para poder registrar el adelanto */}
    <OpenCashRegisterDialog
      open={isOpenRegisterDialogOpen}
      onOpenChange={setIsOpenRegisterDialogOpen}
      amount={openingAmount}
      onAmountChange={setOpeningAmount}
      note={openingNote}
      onNoteChange={setOpeningNote}
      isSubmitting={isOpeningRegister}
      onSubmit={async (amount, note) => {
        setIsOpeningRegister(true)
        try {
          const opened = await cashRegister.openRegister('principal', amount, undefined, note)
          if (opened) {
            await refreshCajaStatus()
            setIsOpenRegisterDialogOpen(false)
            setOpeningAmount('')
            setOpeningNote('')
          }
        } finally {
          setIsOpeningRegister(false)
        }
      }}
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
                const alreadyAddedIndex = partsFields.findIndex((field, index) => watch(`parts.${index}.productId`) === product.id)

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
                    if (alreadyAddedIndex >= 0) {
                      const currentQuantity = watch(`parts.${alreadyAddedIndex}.quantity`) || 0
                      const nextQuantity = currentQuantity + 1
                      if (product.stock_quantity !== null && product.stock_quantity !== undefined && nextQuantity > product.stock_quantity) {
                        toast.error(`Solo hay ${product.stock_quantity} unidades de "${product.name}" en esta sucursal`)
                        return
                      }
                      setValue(`parts.${alreadyAddedIndex}.quantity`, nextQuantity, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                      toast.success(`Cantidad de "${product.name}" actualizada a ${nextQuantity}`)
                      setInventorySearchOpen(false)
                      return
                    }
                    appendPart({
                      name: product.name,
                      cost: product.offer_price || product.sale_price || 0,
                      internalCost: product.purchase_price ?? undefined,
                      quantity: 1,
                      stockAvailable: product.stock_quantity ?? null,
                      supplier: 'Inventario Local',
                      partNumber: product.sku || '',
                      productId: product.id
                    })
                    toast.success(`Repuesto "${product.name}" agregado`)
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
