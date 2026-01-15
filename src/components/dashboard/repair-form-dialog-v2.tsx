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

import React, { useEffect, useState } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Save, X, User, Phone, Mail, MapPin, Smartphone, Laptop, Tablet,
  AlertCircle, Trash, Plus, Zap, UserPlus, Pencil, Package, MessageSquare, DollarSign, Calculator, FileText
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
import { toast } from 'sonner'
import {
  RepairFormSchema,
  RepairFormQuickSchema,
  type RepairFormData,
  type RepairFormDataQuick
} from '@/schemas'
import { CustomerSelectorV3 } from './repairs/CustomerSelectorV3'
import { QuickCustomerModal } from './repairs/QuickCustomerModal'
import { PatternDrawer } from './repairs/PatternDrawer'
import { AppError } from '@/lib/errors'
import { createClient } from '@/lib/supabase/client'
// import { uploadFile } from '@/lib/supabase-storage'
import { ImageUploader } from '@/components/dashboard/products/ImageUploader'
import { RepairCostCalculator } from './repairs/RepairCostCalculator'
import { Repair } from '@/types/repairs'

export type RepairFormMode = 'add' | 'edit'

interface RepairFormDialogV2Props {
  open: boolean
  mode: RepairFormMode
  technicians: Array<{ id: string; name: string }>
  initialData?: Partial<RepairFormData>
  repair?: Repair
  onClose: () => void
  onSubmit: (data: RepairFormData) => Promise<void>
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
  { value: 'low', label: 'Baja', color: 'bg-green-100 text-green-700' },
  { value: 'medium', label: 'Media', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'high', label: 'Alta', color: 'bg-red-100 text-red-700' }
] as const

export function RepairFormDialogV2({
  open,
  mode,
  technicians,
  initialData,
  repair,
  onClose,
  onSubmit
}: RepairFormDialogV2Props) {
  const [quickMode, setQuickMode] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showQuickCustomerModal, setShowQuickCustomerModal] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<{ id: string; name: string; phone: string; email: string } | null>(null)

  // Select schema based on quick mode
  const schema = quickMode ? RepairFormQuickSchema : RepairFormSchema

  // Initialize form with React Hook Form + Zod
  // Use RepairFormData as the main type (compatible with both schemas)
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isValid, isDirty },
    watch,
    setValue,
    reset,
    setFocus
  } = useForm<RepairFormData>({
    resolver: zodResolver(schema) as unknown as import('react-hook-form').Resolver<RepairFormData>,
    mode: 'onChange', // Validate on change for real-time feedback
    defaultValues: {
      customerName: initialData?.customerName || '',
      customerPhone: initialData?.customerPhone || '',
      customerEmail: initialData?.customerEmail || '',
      customerAddress: initialData?.customerAddress || '',
      customerDocument: initialData?.customerDocument || '',
      customerCity: initialData?.customerCity || '',
      customerCountry: initialData?.customerCountry || '',
      existingCustomerId: initialData?.existingCustomerId,
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
        existingCustomerId: initialData?.existingCustomerId,
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
      })
    }
  }, [open, initialData, reset])

  // Handle form submission
  const onSubmitForm = async (data: RepairFormData) => {
    setIsSubmitting(true)
    try {
      await onSubmit(data)
      toast.success(mode === 'add' ? 'Reparación creada exitosamente' : 'Reparación actualizada exitosamente')
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
    setValue('existingCustomerId', customer.id)
    setValue('customerName', customer.name)
    setValue('customerPhone', customer.phone)
    setValue('customerEmail', customer.email)
  }

  const handleQuickCustomerUpdated = (customer: { id: string; name: string; phone: string; email: string }) => {
    setValue('customerName', customer.name)
    setValue('customerPhone', customer.phone)
    setValue('customerEmail', customer.email)
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
    if (Object.keys(errors).length > 0) {
      const firstErrorField = Object.keys(errors)[0]
      if (firstErrorField && firstErrorField !== 'root') {
        setFocus(firstErrorField as keyof RepairFormData)
      }
    }
  }, [errors, setFocus])

  // Estado para pantalla completa
  const [isFullscreen, setIsFullscreen] = useState(false)

  return (
    <>
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className={`${isFullscreen ? 'max-w-full w-full max-h-full h-full' : 'max-w-[96vw] w-[96vw] max-h-[96vh] h-[96vh]'} overflow-hidden flex flex-col p-0 dark:bg-slate-950 dark:border-slate-800 transition-all duration-300`}>
        <DialogHeader className="flex-shrink-0 px-8 pt-6 pb-5 border-b border-border bg-gradient-to-r from-primary/5 via-primary/3 to-transparent dark:from-primary/10 dark:via-primary/5 dark:to-transparent dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent dark:from-primary dark:to-primary/80">
                {mode === 'add' ? '✨ Nueva Reparación' : '✏️ Editar Reparación'}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-1 dark:text-slate-400">
                Complete los datos del cliente y los dispositivos a reparar
              </DialogDescription>
            </div>
            <div className="flex items-center gap-3">
              {mode === 'edit' && repair && (
                <div className="text-right px-4 py-2 bg-primary/10 dark:bg-primary/20 rounded-lg border border-primary/20 dark:border-primary/30">
                  <div className="text-xs text-muted-foreground dark:text-slate-400">Ticket</div>
                  <div className="text-lg font-mono font-bold text-primary dark:text-primary">
                    #{repair.ticketNumber || repair.id.slice(0, 8).toUpperCase()}
                  </div>
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="h-9 w-9 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors"
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
          <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-5 max-w-[1800px] mx-auto">
            {/* Quick Mode Toggle */}
            <div className="flex items-center justify-between p-5 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 rounded-xl border-2 border-amber-200/50 dark:border-amber-800/50 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 dark:from-amber-500 dark:to-orange-600 flex items-center justify-center shadow-lg">
                  <Zap className="h-6 w-6 text-white" />
                </div>
                <div>
                  <Label htmlFor="quick-mode" className="cursor-pointer font-semibold text-base text-amber-900 dark:text-amber-100">
                    Modo Rápido
                  </Label>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
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
            <Card className="shadow-lg border-2 border-blue-200 dark:border-blue-900/50 hover:border-blue-400 dark:hover:border-blue-700 transition-all duration-200 bg-gradient-to-br from-white to-blue-50/20 dark:from-slate-900/50 dark:to-blue-950/10">
              <CardHeader className="pb-3 bg-gradient-to-r from-blue-50/50 to-transparent dark:from-blue-950/30 dark:to-transparent border-b border-blue-100 dark:border-blue-900/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 flex items-center justify-center shadow-lg">
                      <User className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold text-blue-800 dark:text-blue-300">
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
                        className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-950/50 dark:hover:text-blue-400 transition-colors"
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
                      className="h-8 w-8 p-0 hover:bg-green-50 hover:text-green-700 dark:hover:bg-green-950/50 dark:hover:text-green-400 transition-colors"
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
                  initialCustomer={initialData?.existingCustomerId ? {
                    id: initialData.existingCustomerId,
                    name: initialData.customerName || '',
                    phone: initialData.customerPhone || '',
                    email: initialData.customerEmail || ''
                  } : undefined}
                  onChange={(customerId, customerData) => {
                    setValue('existingCustomerId', customerId)
                    // Auto-fill customer data if available
                    if (customerData) {
                      setValue('customerName', customerData.name)
                      setValue('customerPhone', customerData.phone || '')
                      setValue('customerEmail', customerData.email || '')
                    }
                  }}
                  error={errors.existingCustomerId?.message}
                />
                
                {/* Información adicional del cliente si está seleccionado */}
                {watch('existingCustomerId') && watch('customerPhone') && (
                  <div className="pt-2 border-t border-blue-100 dark:border-blue-900/30 space-y-2">
                    {watch('customerPhone') && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground dark:text-slate-400">
                        <Phone className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                        <span>{watch('customerPhone')}</span>
                      </div>
                    )}
                    {watch('customerEmail') && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground dark:text-slate-400">
                        <Mail className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                        <span>{watch('customerEmail')}</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sección 2: Dispositivos a Reparar (Ancho Completo) */}
            <Card className="shadow-lg border-2 border-green-200 dark:border-green-900/50 hover:border-green-400 dark:hover:border-green-700 transition-all duration-200 bg-gradient-to-br from-white to-green-50/20 dark:from-slate-900/50 dark:to-green-950/10">
              <CardHeader className="pb-3 bg-gradient-to-r from-green-50/50 to-transparent dark:from-green-950/30 dark:to-transparent border-b border-green-100 dark:border-green-900/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-500 to-green-600 dark:from-green-600 dark:to-green-700 flex items-center justify-center shadow-lg">
                      <Smartphone className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold text-green-800 dark:text-green-300">
                        Dispositivos a Reparar
                      </CardTitle>
                      <p className="text-xs text-muted-foreground dark:text-slate-400 mt-0.5">
                        {fields.length} {fields.length === 1 ? 'dispositivo' : 'dispositivos'} registrado{fields.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
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
                    className="h-8 gap-1.5 hover:bg-green-50 hover:text-green-700 dark:hover:bg-green-950/50 dark:hover:text-green-400 transition-colors text-xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Agregar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                {mode === 'edit' && repair?.images?.length ? (
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Galería de imágenes existentes</Label>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                      {repair.images.map((img) => (
                        <div key={img.id} className="relative rounded-lg overflow-hidden border shadow-sm">
                          <img
                            src={img.url}
                            alt={img.description || 'Imagen de reparación'}
                            className="w-full h-full object-cover aspect-square"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {fields.map((field, index) => {
                  const deviceType = watch(`devices.${index}.deviceType`)
                  const DeviceIcon = deviceTypeOptions.find(opt => opt.value === deviceType)?.icon || Smartphone
                  
                  return (
                  <Card key={field.id} className="border-2 border-green-200 dark:border-green-900/50 hover:border-green-400 dark:hover:border-green-700 transition-all duration-200 bg-gradient-to-br from-white to-green-50/20 dark:from-slate-900/50 dark:to-green-950/10 shadow-md hover:shadow-lg">
                    <CardHeader className="pb-2 bg-gradient-to-r from-green-50/50 to-transparent dark:from-green-950/30 dark:to-transparent border-b border-green-100 dark:border-green-900/30">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-green-600 dark:from-green-600 dark:to-green-700 flex items-center justify-center text-xs font-bold text-white shadow-md">
                            {index + 1}
                          </div>
                          <div>
                            <CardTitle className="text-sm font-bold text-green-800 dark:text-green-300 flex items-center gap-1.5">
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
                        {fields.length > 1 && (
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
                            <Smartphone className="h-3 w-3 text-green-600 dark:text-green-400" />
                            Tipo <span className="text-red-500">*</span>
                          </Label>
                          <Controller
                            name={`devices.${index}.deviceType`}
                            control={control}
                            render={({ field }) => (
                              <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger
                                  className={`h-9 text-sm border-green-200 dark:border-green-900/50 ${errors.devices?.[index]?.deviceType ? 'border-red-500' : ''}`}
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
                            className={`h-9 text-sm border-green-200 dark:border-green-900/50 ${errors.devices?.[index]?.brand ? 'border-red-500' : ''}`}
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
                            className={`h-9 text-sm border-green-200 dark:border-green-900/50 ${errors.devices?.[index]?.model ? 'border-red-500' : ''}`}
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
                            <User className="h-3 w-3 text-green-600 dark:text-green-400" />
                            Técnico Asignado <span className="text-red-500">*</span>
                          </Label>
                          <Controller
                            name={`devices.${index}.technician`}
                            control={control}
                            render={({ field }) => (
                              <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger
                                  className={`h-9 text-sm border-green-200 dark:border-green-900/50 ${errors.devices?.[index]?.technician ? 'border-red-500' : ''}`}
                                >
                                  <SelectValue placeholder="Selecciona técnico" />
                                </SelectTrigger>
                                <SelectContent>
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
                          <Label className="text-xs font-medium flex items-center gap-1 text-muted-foreground dark:text-slate-400">
                            <DollarSign className="h-3 w-3 text-green-600 dark:text-green-400" />
                            Costo Estimado
                            <span className="text-xs text-muted-foreground ml-1">(opcional)</span>
                          </Label>
                          <div className="relative">
                            <DollarSign className="absolute left-2.5 top-2 h-4 w-4 text-green-600 dark:text-green-400" />
                            <Input
                              type="number"
                              step="0.01"
                              {...register(`devices.${index}.estimatedCost`, {
                                valueAsNumber: true
                              })}
                              placeholder="0.00"
                              className={`h-9 text-sm pl-8 border-green-200 dark:border-green-900/50 font-semibold ${errors.devices?.[index]?.estimatedCost ? 'border-red-500' : ''}`}
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
                      <div className="space-y-3 pt-2 border-t border-green-100 dark:border-green-900/30">
                      {/* Issue */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium flex items-center gap-1 text-muted-foreground dark:text-slate-400">
                          <AlertCircle className="h-3 w-3 text-green-600 dark:text-green-400" />
                          Problema Principal <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          {...register(`devices.${index}.issue`)}
                          placeholder="Pantalla rota, no enciende..."
                          className={`h-9 text-sm border-green-200 dark:border-green-900/50 ${errors.devices?.[index]?.issue ? 'border-red-500' : ''}`}
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
                          <FileText className="h-3 w-3 text-green-600 dark:text-green-400" />
                          Descripción Detallada
                        </Label>
                        <Textarea
                          {...register(`devices.${index}.description`)}
                          placeholder="Describe el problema en detalle..."
                          rows={2}
                          className={`resize-none text-sm border-green-200 dark:border-green-900/50 ${errors.devices?.[index]?.description ? 'border-red-500' : ''}`}
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
                      <div className="space-y-3 pt-2 border-t border-green-100 dark:border-green-900/30">
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
                              <Select value={field.value || 'none'} onValueChange={field.onChange}>
                                <SelectTrigger className="h-9 text-sm border-green-200 dark:border-green-900/50">
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
                                {...register(`devices.${index}.accessPassword`)}
                                placeholder={
                                  watch(`devices.${index}.accessType`) === 'pin' ? 'Ej: 1234, 0000' :
                                  watch(`devices.${index}.accessType`) === 'password' ? 'Ej: micontraseña123' :
                                  'Describe el método de acceso...'
                                }
                                className={`h-9 text-sm border-green-200 dark:border-green-900/50 ${errors.devices?.[index]?.accessPassword ? 'border-red-500' : ''}`}
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
                            return (
                              <ImageUploader
                                images={field.value || []}
                                onChange={field.onChange}
                                maxImages={6}
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
            <Card className="shadow-lg border-2 border-purple-200 dark:border-purple-900/50 hover:border-purple-400 dark:hover:border-purple-700 transition-all duration-200 bg-gradient-to-br from-white to-purple-50/20 dark:from-slate-900/50 dark:to-purple-950/10">
              <CardHeader className="pb-3 bg-gradient-to-r from-purple-50/50 to-transparent dark:from-purple-950/30 dark:to-transparent border-b border-purple-100 dark:border-purple-900/30">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700 flex items-center justify-center shadow-lg">
                    <AlertCircle className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-purple-800 dark:text-purple-300">
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
                          <SelectTrigger className={`h-9 text-sm border-purple-200 dark:border-purple-900/50 ${errors.priority ? 'border-red-500' : ''}`}>
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
                          <SelectTrigger className={`h-9 text-sm border-purple-200 dark:border-purple-900/50 ${errors.urgency ? 'border-red-500' : ''}`}>
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
                          {partsFields.length} {partsFields.length === 1 ? 'repuesto' : 'repuestos'} • Total: {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(
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
                                  Total: {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(total)}
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
                          value={String(field.value || 3)}
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
                      defaultValue="labor"
                      render={({ field }) => (
                        <Select
                          value={field.value || 'labor'}
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
        <DialogFooter className="flex-shrink-0 px-8 py-6 border-t border-border bg-gradient-to-r from-muted/30 to-transparent dark:from-slate-900/50 dark:to-transparent dark:border-slate-800 backdrop-blur-sm">
          <div className="flex items-center justify-between w-full">
            <div className="text-sm">
              {!isValid && Object.keys(errors).length > 0 && (
                <span className="flex items-center gap-2 text-red-600 dark:text-red-400 font-medium bg-red-50 dark:bg-red-950/50 px-4 py-2 rounded-lg border border-red-200 dark:border-red-900">
                  <AlertCircle className="h-4 w-4" />
                  Completa los campos requeridos
                </span>
              )}
            </div>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
                className="min-w-[120px] h-11 hover:bg-muted dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={!isValid || isSubmitting}
                onClick={handleSubmit(onSubmitForm)}
                className="min-w-[160px] h-11 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 dark:from-primary dark:to-primary/90 shadow-lg hover:shadow-xl transition-all"
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
    </>
  )
}
