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
  AlertCircle, Trash, Plus, Zap, UserPlus
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
import { uploadFile } from '@/lib/supabase-storage'
import { ImageUploader } from '@/components/dashboard/products/ImageUploader'
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
      }]
    }
  })

  // Field array for devices
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'devices'
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
        }]
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

  // Focus first error field on submit
  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      const firstErrorField = Object.keys(errors)[0]
      if (firstErrorField && firstErrorField !== 'root') {
        setFocus(firstErrorField as keyof RepairFormData)
      }
    }
  }, [errors, setFocus])

  return (
    <>
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl w-[95vw] max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0 pb-4 border-b">
          <DialogTitle className="text-xl font-semibold">
            {mode === 'add' ? 'Nueva Reparación' : 'Editar Reparación'}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Complete los datos del cliente y los dispositivos a reparar
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-1">
          <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-6 py-4">
            {/* Quick Mode Toggle */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
              <div className="flex items-center gap-3">
                <Zap className="h-5 w-5 text-primary" />
                <div>
                  <Label htmlFor="quick-mode" className="cursor-pointer font-medium">
                    Modo Rápido
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Validación simplificada para registro rápido
                  </p>
                </div>
              </div>
              <Switch
                id="quick-mode"
                checked={quickMode}
                onCheckedChange={setQuickMode}
              />
            </div>

            {/* Customer Selection */}
            <Card className="shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <User className="h-5 w-5 text-primary" />
                    Información del Cliente
                  </CardTitle>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowQuickCustomerModal(true)}
                    disabled={isSubmitting}
                    className="gap-2 text-sm hover:bg-primary/5 hover:text-primary hover:border-primary/30"
                  >
                    <UserPlus className="h-4 w-4" />
                    Nuevo Cliente
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <CustomerSelectorV3
                  value={watch('existingCustomerId')}
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
              </CardContent>
            </Card>

            {/* Priority and Urgency */}
            <Card className="shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <AlertCircle className="h-5 w-5 text-primary" />
                  Prioridad y Urgencia
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Priority */}
                  <div className="space-y-3">
                    <Label htmlFor="priority" className="text-sm font-medium">
                      Prioridad <span className="text-red-500">*</span>
                    </Label>
                    <Controller
                      name="priority"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className={`h-11 ${errors.priority ? 'border-red-500' : ''}`}>
                            <SelectValue placeholder="Selecciona prioridad" />
                          </SelectTrigger>
                          <SelectContent>
                            {priorityOptions.map(option => (
                              <SelectItem key={option.value} value={option.value}>
                                <div className="flex items-center gap-2">
                                  <Badge className={`${option.color} text-xs`}>{option.label}</Badge>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.priority && (
                      <p className="text-sm text-red-500 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.priority.message}
                      </p>
                    )}
                  </div>

                  {/* Urgency */}
                  <div className="space-y-3">
                    <Label htmlFor="urgency" className="text-sm font-medium">
                      Urgencia <span className="text-red-500">*</span>
                    </Label>
                    <Controller
                      name="urgency"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className={`h-11 ${errors.urgency ? 'border-red-500' : ''}`}>
                            <SelectValue placeholder="Selecciona urgencia" />
                          </SelectTrigger>
                          <SelectContent>
                            {urgencyOptions.map(option => (
                              <SelectItem key={option.value} value={option.value}>
                                <div className="flex items-center gap-2">
                                  <Badge className={`${option.color} text-xs`}>{option.label}</Badge>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.urgency && (
                      <p className="text-sm text-red-500 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.urgency.message}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Devices */}
            <Card className="shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Smartphone className="h-5 w-5 text-primary" />
                    Dispositivos a Reparar
                  </CardTitle>
                  <Button
                    type="button"
                    variant="outline"
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
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Agregar Dispositivo
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
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
                {fields.map((field, index) => (
                  <Card key={field.id} className="border-2 border-dashed border-muted-foreground/20 hover:border-primary/30 transition-colors">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-medium flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                            {index + 1}
                          </div>
                          Dispositivo {index + 1}
                        </CardTitle>
                        {fields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => remove(index)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        {/* Device Type */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">
                            Tipo de Dispositivo <span className="text-red-500">*</span>
                          </Label>
                          <Controller
                            name={`devices.${index}.deviceType`}
                            control={control}
                            render={({ field }) => (
                              <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger
                                  className={`h-11 ${errors.devices?.[index]?.deviceType ? 'border-red-500' : ''}`}
                                >
                                  <SelectValue placeholder="Selecciona el tipo" />
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
                            <p className="text-sm text-red-500 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              {errors.devices[index]?.deviceType?.message}
                            </p>
                          )}
                        </div>

                        {/* Brand */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">
                            Marca <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            {...register(`devices.${index}.brand`)}
                            placeholder="Apple, Samsung, Xiaomi..."
                            className={`h-11 ${errors.devices?.[index]?.brand ? 'border-red-500' : ''}`}
                          />
                          {errors.devices?.[index]?.brand && (
                            <p className="text-sm text-red-500 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              {errors.devices[index]?.brand?.message}
                            </p>
                          )}
                        </div>

                        {/* Model */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">
                            Modelo <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            {...register(`devices.${index}.model`)}
                            placeholder="iPhone 15 Pro, Galaxy S24..."
                            className={`h-11 ${errors.devices?.[index]?.model ? 'border-red-500' : ''}`}
                          />
                          {errors.devices?.[index]?.model && (
                            <p className="text-sm text-red-500 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              {errors.devices[index]?.model?.message}
                            </p>
                          )}
                        </div>

                        {/* Technician */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">
                            Técnico Asignado <span className="text-red-500">*</span>
                          </Label>
                          <Controller
                            name={`devices.${index}.technician`}
                            control={control}
                            render={({ field }) => (
                              <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger
                                  className={`h-11 ${errors.devices?.[index]?.technician ? 'border-red-500' : ''}`}
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
                            <p className="text-sm text-red-500 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              {errors.devices[index]?.technician?.message}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Issue */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">
                          Problema Principal <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          {...register(`devices.${index}.issue`)}
                          placeholder="Pantalla rota, no enciende, batería agotada..."
                          className={`h-11 ${errors.devices?.[index]?.issue ? 'border-red-500' : ''}`}
                        />
                        {errors.devices?.[index]?.issue && (
                          <p className="text-sm text-red-500 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {errors.devices[index]?.issue?.message}
                          </p>
                        )}
                      </div>

                      {/* Description */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">
                          Descripción Detallada {!quickMode && <span className="text-red-500">*</span>}
                        </Label>
                        <Textarea
                          {...register(`devices.${index}.description`)}
                          placeholder="Describe el problema en detalle, síntomas, cuándo ocurrió..."
                          rows={4}
                          className={`resize-none ${errors.devices?.[index]?.description ? 'border-red-500' : ''}`}
                        />
                        {errors.devices?.[index]?.description && (
                          <p className="text-sm text-red-500 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {errors.devices[index]?.description?.message}
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        {/* Access Password */}
                        <div className="space-y-3">
                          <Label className="text-sm font-medium">
                            Acceso al Dispositivo
                            <span className="text-xs text-muted-foreground ml-1">(opcional)</span>
                          </Label>
                          
                          {/* Access Type Selector */}
                          <Controller
                            name={`devices.${index}.accessType`}
                            control={control}
                            render={({ field }) => (
                              <Select value={field.value || 'none'} onValueChange={field.onChange}>
                                <SelectTrigger className="h-10 text-sm">
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
                            <div className="space-y-2">
                              <Input
                                type="text"
                                {...register(`devices.${index}.accessPassword`)}
                                placeholder={
                                  watch(`devices.${index}.accessType`) === 'pin' ? 'Ej: 1234, 0000' :
                                  watch(`devices.${index}.accessType`) === 'password' ? 'Ej: micontraseña123' :
                                  'Describe el método de acceso...'
                                }
                                className={`h-10 text-sm ${errors.devices?.[index]?.accessPassword ? 'border-red-500' : ''}`}
                              />
                            </div>
                          )}

                          {/* Biometric note */}
                          {watch(`devices.${index}.accessType`) === 'biometric' && (
                            <div className="text-xs text-blue-600 bg-blue-50 rounded p-2 border border-blue-200">
                              ℹ️ <strong>Acceso biométrico:</strong> El cliente deberá estar presente para desbloquear o proporcionar método alternativo
                            </div>
                          )}

                          {/* No protection note */}
                          {watch(`devices.${index}.accessType`) === 'none' && (
                            <div className="text-xs text-green-600 bg-green-50 rounded p-2 border border-green-200">
                              ✅ <strong>Sin protección:</strong> El dispositivo se puede acceder libremente
                            </div>
                          )}

                          {errors.devices?.[index]?.accessPassword && (
                            <p className="text-sm text-red-500 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              {errors.devices[index]?.accessPassword?.message}
                            </p>
                          )}
                        </div>

                        {/* Estimated Cost */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">
                            Costo Estimado
                            <span className="text-xs text-muted-foreground ml-1">(opcional)</span>
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            {...register(`devices.${index}.estimatedCost`, {
                              valueAsNumber: true
                            })}
                            placeholder="0.00"
                            className={`h-11 ${errors.devices?.[index]?.estimatedCost ? 'border-red-500' : ''}`}
                          />
                          {errors.devices?.[index]?.estimatedCost && (
                            <p className="text-sm text-red-500 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              {errors.devices[index]?.estimatedCost?.message}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Images */}
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">
                          Fotos del Dispositivo
                          <span className="text-xs text-muted-foreground ml-1">(opcional)</span>
                        </Label>
                        <Controller
                          name={`devices.${index}.images`}
                          control={control}
                          render={({ field }) => {
                            const supabase = createClient()
                            const onUploadFiles = async (files: File[]): Promise<string[]> => {
                              const urls: string[] = []
                              for (const file of files) {
                                const ext = file.name.split('.').pop() || 'jpg'
                                const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
                                const path = `uploads/${filename}`
                                
                                const result = await uploadFile('repair-images', path, file, { upsert: true })
                                
                                if (result.success && result.url) {
                                  urls.push(result.url)
                                } else {
                                  console.warn('Failed to upload image:', result.error)
                                  // Show user-friendly error for first failure
                                  if (urls.length === 0 && result.error?.includes('not found')) {
                                    toast.error('Image storage not configured. Images will be skipped.')
                                  }
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
                ))}

                {errors.devices && typeof errors.devices.message === 'string' && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.devices.message}
                  </p>
                )}
              </CardContent>
            </Card>
          </form>
        </div>

        {/* Form Actions */}
        <DialogFooter className="flex-shrink-0 pt-4 border-t bg-background">
          <div className="flex items-center justify-between w-full">
            <div className="text-xs text-muted-foreground">
              {!isValid && Object.keys(errors).length > 0 && (
                <span className="flex items-center gap-1 text-red-500">
                  <AlertCircle className="h-3 w-3" />
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
                className="min-w-[100px]"
              >
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={!isValid || isSubmitting}
                onClick={handleSubmit(onSubmitForm)}
                className="min-w-[140px]"
              >
                <Save className="h-4 w-4 mr-2" />
                {isSubmitting ? 'Guardando...' : mode === 'add' ? 'Crear Reparación' : 'Guardar Cambios'}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Quick Customer Creation Modal */}
    <QuickCustomerModal
      open={showQuickCustomerModal}
      onClose={() => setShowQuickCustomerModal(false)}
      onCustomerCreated={handleQuickCustomerCreated}
    />
  </>
  )
}
