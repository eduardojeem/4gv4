'use client'

/**
 * CustomerEditFormV2 - Formulario de Edición con Diseño de Vista Detalle
 * 
 * Características:
 * - Mismo diseño y estructura que CustomerDetail
 * - Campos editables organizados en pestañas
 * - Validación en tiempo real
 * - Modo oscuro optimizado
 * - Vista previa de cambios
 * - Autoguardado opcional
 */

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  User, Phone, Mail, MapPin, FileText, AlertCircle, Check, 
  CreditCard, Building, Tag, Save, X, 
  Calendar, Smartphone, Clock, Star, Shield,
  Loader2, CheckCircle2, Info, Plus, Minus,
  Settings, Bell, LayoutDashboard, ArrowLeft,
  Copy, MessageSquare
} from 'lucide-react'

// UI Components
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Slider } from '@/components/ui/slider'
import { toast } from 'sonner'

// Types and utilities
import { Customer } from '@/hooks/use-customer-state'
import { cn } from '@/lib/utils'

// Validation Schema
const customerEditSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().min(10, 'Teléfono debe tener al menos 10 dígitos').optional().or(z.literal('')),
  whatsapp: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  company: z.string().optional(),
  position: z.string().optional(),
  ruc: z.string().optional(),
  customer_type: z.enum(['regular', 'premium', 'empresa']),
  segment: z.enum(['vip', 'premium', 'regular', 'new', 'high_value', 'low_value', 'business', 'wholesale']),
  status: z.enum(['active', 'inactive', 'suspended', 'pending']),
  credit_limit: z.number().min(0).optional(),
  discount_percentage: z.number().min(0).max(100).optional(),
  payment_terms: z.string().optional(),
  preferred_contact: z.enum(['email', 'phone', 'whatsapp', 'sms']),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  birthday: z.string().optional(),
})

type CustomerEditFormData = z.infer<typeof customerEditSchema>

interface CustomerEditFormV2Props {
  customer: Customer
  onSave: (data: CustomerEditFormData) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

export function CustomerEditFormV2({ 
  customer, 
  onSave, 
  onCancel, 
  isLoading = false 
}: CustomerEditFormV2Props) {
  const [activeTab, setActiveTab] = useState("overview")
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [newTag, setNewTag] = useState('')

  const form = useForm<CustomerEditFormData>({
    resolver: zodResolver(customerEditSchema),
    defaultValues: {
      name: customer.name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      whatsapp: customer.whatsapp || '',
      address: customer.address || '',
      city: customer.city || '',
      company: customer.company || '',
      position: customer.position || '',
      ruc: customer.ruc || '',
      customer_type: customer.customer_type || 'regular',
      segment: customer.segment || 'regular',
      status: customer.status || 'active',
      credit_limit: customer.credit_limit || 0,
      discount_percentage: customer.discount_percentage || 0,
      payment_terms: customer.payment_terms || '',
      preferred_contact: customer.preferred_contact || 'email',
      tags: customer.tags || [],
      notes: customer.notes || '',
      birthday: customer.birthday || '',
    }
  })

  const { watch, setValue, getValues } = form
  const watchedValues = watch()

  // Detectar cambios
  useEffect(() => {
    const subscription = watch(() => {
      setHasChanges(true)
    })
    return () => subscription.unsubscribe()
  }, [watch])

  const handleSave = async (data: CustomerEditFormData) => {
    setIsSaving(true)
    try {
      // Limpiar y preparar los datos antes de enviar
      const cleanedData = {
        ...data,
        // Limpiar campos de teléfono - si están vacíos o son placeholders, enviar undefined
        phone: data.phone && data.phone.trim() && !data.phone.includes('[REDACTED]') ? data.phone.trim() : undefined,
        whatsapp: data.whatsapp && data.whatsapp.trim() && !data.whatsapp.includes('[REDACTED]') ? data.whatsapp.trim() : undefined,
        // Limpiar otros campos opcionales
        email: data.email && data.email.trim() ? data.email.trim() : undefined,
        address: data.address && data.address.trim() ? data.address.trim() : undefined,
        city: data.city && data.city.trim() ? data.city.trim() : undefined,
        company: data.company && data.company.trim() ? data.company.trim() : undefined,
        position: data.position && data.position.trim() ? data.position.trim() : undefined,
        ruc: data.ruc && data.ruc.trim() ? data.ruc.trim() : undefined,
        payment_terms: data.payment_terms && data.payment_terms.trim() ? data.payment_terms.trim() : undefined,
        notes: data.notes && data.notes.trim() ? data.notes.trim() : undefined,
        birthday: data.birthday && data.birthday.trim() ? data.birthday.trim() : undefined,
        // Asegurar que los arrays no estén vacíos
        tags: data.tags && data.tags.length > 0 ? data.tags : undefined,
      }

      await onSave(cleanedData)
      setHasChanges(false)
      toast.success('Cliente actualizado correctamente')
    } catch (error) {
      console.error('Error saving customer:', error)
      toast.error('Error al actualizar cliente')
    } finally {
      setIsSaving(false)
    }
  }

  const addTag = () => {
    if (newTag.trim() && !watchedValues.tags?.includes(newTag.trim())) {
      const currentTags = watchedValues.tags || []
      setValue('tags', [...currentTags, newTag.trim()])
      setNewTag('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    const currentTags = watchedValues.tags || []
    setValue('tags', currentTags.filter(tag => tag !== tagToRemove))
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-10">
      {/* Header Section - Similar to CustomerDetail */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6"
      >
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onCancel}
            className="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border-4 border-white shadow-lg">
              <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${customer.name}`} />
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-lg font-bold">
                {customer.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'CL'}
              </AvatarFallback>
            </Avatar>
            
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Editar Cliente
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                Modificando información de {customer.name}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className="bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20">
                  ID: {customer.customerCode || customer.id.slice(-6)}
                </Badge>
                {hasChanges && (
                  <Badge variant="outline" className="bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-900/20">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Cambios pendientes
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isSaving}
            className="border-gray-300 dark:border-gray-600"
          >
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
          <Button
            onClick={form.handleSubmit(handleSave)}
            disabled={isSaving || !hasChanges}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {isSaving ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </div>
      </motion.div>

      {/* Main Content Tabs - Same structure as CustomerDetail */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="border-b border-gray-200 dark:border-gray-800">
          <TabsList className="h-12 bg-transparent p-0 gap-6">
            <TabsTrigger
              value="overview"
              className="h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:shadow-none px-0 font-medium text-gray-500 hover:text-gray-700"
            >
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Información General
            </TabsTrigger>
            <TabsTrigger
              value="profile"
              className="h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:shadow-none px-0 font-medium text-gray-500 hover:text-gray-700"
            >
              <User className="h-4 w-4 mr-2" />
              Perfil y Segmentación
            </TabsTrigger>
            <TabsTrigger
              value="financial"
              className="h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:shadow-none px-0 font-medium text-gray-500 hover:text-gray-700"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Configuración Financiera
            </TabsTrigger>
            <TabsTrigger
              value="notes"
              className="h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:shadow-none px-0 font-medium text-gray-500 hover:text-gray-700"
            >
              <FileText className="h-4 w-4 mr-2" />
              Notas y Etiquetas
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab Content: Overview - Personal Information */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Personal Info */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="border-0 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-t-lg">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <User className="h-5 w-5 text-blue-600" />
                    Información Personal
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Nombre Completo *
                      </Label>
                      <Controller
                        name="name"
                        control={form.control}
                        render={({ field, fieldState }) => (
                          <div>
                            <Input
                              {...field}
                              id="name"
                              placeholder="Nombre completo del cliente"
                              className={cn(
                                "bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600",
                                fieldState.error && "border-red-500"
                              )}
                            />
                            {fieldState.error && (
                              <p className="text-sm text-red-500 mt-1">{fieldState.error.message}</p>
                            )}
                          </div>
                        )}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Email
                      </Label>
                      <Controller
                        name="email"
                        control={form.control}
                        render={({ field, fieldState }) => (
                          <div>
                            <Input
                              {...field}
                              id="email"
                              type="email"
                              placeholder="correo@ejemplo.com"
                              className={cn(
                                "bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600",
                                fieldState.error && "border-red-500"
                              )}
                            />
                            {fieldState.error && (
                              <p className="text-sm text-red-500 mt-1">{fieldState.error.message}</p>
                            )}
                          </div>
                        )}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Teléfono
                      </Label>
                      <Controller
                        name="phone"
                        control={form.control}
                        render={({ field, fieldState }) => (
                          <div>
                            <Input
                              {...field}
                              id="phone"
                              placeholder="+1234567890"
                              className={cn(
                                "bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600",
                                fieldState.error && "border-red-500"
                              )}
                            />
                            {fieldState.error && (
                              <p className="text-sm text-red-500 mt-1">{fieldState.error.message}</p>
                            )}
                          </div>
                        )}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="whatsapp" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        WhatsApp
                      </Label>
                      <Controller
                        name="whatsapp"
                        control={form.control}
                        render={({ field }) => (
                          <Input
                            {...field}
                            id="whatsapp"
                            placeholder="+1234567890"
                            className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600"
                          />
                        )}
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="address" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Dirección
                      </Label>
                      <Controller
                        name="address"
                        control={form.control}
                        render={({ field }) => (
                          <Input
                            {...field}
                            id="address"
                            placeholder="Dirección completa"
                            className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600"
                          />
                        )}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="city" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Ciudad
                      </Label>
                      <Controller
                        name="city"
                        control={form.control}
                        render={({ field }) => (
                          <Input
                            {...field}
                            id="city"
                            placeholder="Ciudad"
                            className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600"
                          />
                        )}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="birthday" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Fecha de Nacimiento
                      </Label>
                      <Controller
                        name="birthday"
                        control={form.control}
                        render={({ field }) => (
                          <Input
                            {...field}
                            id="birthday"
                            type="date"
                            className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600"
                          />
                        )}
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900 dark:text-white">Información Empresarial</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="company" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Empresa
                        </Label>
                        <Controller
                          name="company"
                          control={form.control}
                          render={({ field }) => (
                            <Input
                              {...field}
                              id="company"
                              placeholder="Nombre de la empresa"
                              className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600"
                            />
                          )}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="position" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Cargo
                        </Label>
                        <Controller
                          name="position"
                          control={form.control}
                          render={({ field }) => (
                            <Input
                              {...field}
                              id="position"
                              placeholder="Cargo o posición"
                              className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600"
                            />
                          )}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="ruc" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          RUC/RFC
                        </Label>
                        <Controller
                          name="ruc"
                          control={form.control}
                          render={({ field }) => (
                            <Input
                              {...field}
                              id="ruc"
                              placeholder="Número de identificación fiscal"
                              className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600"
                            />
                          )}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Status & Quick Actions */}
            <div className="space-y-6">
              <Card className="border-0 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-t-lg">
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    Estado del Cliente
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 p-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Estado Actual
                    </Label>
                    <Controller
                      name="status"
                      control={form.control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-green-500" />
                                Activo
                              </div>
                            </SelectItem>
                            <SelectItem value="inactive">
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-gray-500" />
                                Inactivo
                              </div>
                            </SelectItem>
                            <SelectItem value="suspended">
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-red-500" />
                                Suspendido
                              </div>
                            </SelectItem>
                            <SelectItem value="pending">
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-yellow-500" />
                                Pendiente
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Preferencia de Contacto
                    </Label>
                    <Controller
                      name="preferred_contact"
                      control={form.control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="email">
                              <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4" />
                                Email
                              </div>
                            </SelectItem>
                            <SelectItem value="phone">
                              <div className="flex items-center gap-2">
                                <Phone className="h-4 w-4" />
                                Teléfono
                              </div>
                            </SelectItem>
                            <SelectItem value="whatsapp">
                              <div className="flex items-center gap-2">
                                <Smartphone className="h-4 w-4" />
                                WhatsApp
                              </div>
                            </SelectItem>
                            <SelectItem value="sms">
                              <div className="flex items-center gap-2">
                                <MessageSquare className="h-4 w-4" />
                                SMS
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300 flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    Vista Previa
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm">
                    <span className="font-medium">Nombre:</span> {watchedValues.name || 'Sin nombre'}
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">Email:</span> {watchedValues.email || 'Sin email'}
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">Teléfono:</span> {watchedValues.phone || 'Sin teléfono'}
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">Estado:</span> 
                    <Badge variant="outline" className="ml-2">
                      {watchedValues.status === 'active' ? 'Activo' : 
                       watchedValues.status === 'inactive' ? 'Inactivo' :
                       watchedValues.status === 'suspended' ? 'Suspendido' : 'Pendiente'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Tab Content: Profile & Segmentation */}
        <TabsContent value="profile" className="space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-t-lg">
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5 text-indigo-600" />
                Segmentación y Perfil
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Tipo de Cliente
                  </Label>
                  <Controller
                    name="customer_type"
                    control={form.control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="regular">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              Regular
                            </div>
                          </SelectItem>
                          <SelectItem value="premium">
                            <div className="flex items-center gap-2">
                              <Star className="h-4 w-4" />
                              Premium
                            </div>
                          </SelectItem>
                          <SelectItem value="empresa">
                            <div className="flex items-center gap-2">
                              <Building className="h-4 w-4" />
                              Empresa
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Segmento
                  </Label>
                  <Controller
                    name="segment"
                    control={form.control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="vip">VIP</SelectItem>
                          <SelectItem value="premium">Premium</SelectItem>
                          <SelectItem value="regular">Regular</SelectItem>
                          <SelectItem value="new">Nuevo</SelectItem>
                          <SelectItem value="high_value">Alto Valor</SelectItem>
                          <SelectItem value="low_value">Bajo Valor</SelectItem>
                          <SelectItem value="business">Empresarial</SelectItem>
                          <SelectItem value="wholesale">Mayorista</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Content: Financial Configuration */}
        <TabsContent value="financial" className="space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-t-lg">
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-green-600" />
                Configuración Financiera
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="credit_limit" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Límite de Crédito
                  </Label>
                  <Controller
                    name="credit_limit"
                    control={form.control}
                    render={({ field }) => (
                      <Input
                        {...field}
                        id="credit_limit"
                        type="number"
                        min="0"
                        placeholder="0"
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600"
                      />
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="discount_percentage" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Descuento (%)
                  </Label>
                  <Controller
                    name="discount_percentage"
                    control={form.control}
                    render={({ field }) => (
                      <Input
                        {...field}
                        id="discount_percentage"
                        type="number"
                        min="0"
                        max="100"
                        placeholder="0"
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600"
                      />
                    )}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="payment_terms" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Términos de Pago
                  </Label>
                  <Controller
                    name="payment_terms"
                    control={form.control}
                    render={({ field }) => (
                      <Input
                        {...field}
                        id="payment_terms"
                        placeholder="Ej: 30 días, Contado, etc."
                        className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600"
                      />
                    )}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Content: Notes & Tags */}
        <TabsContent value="notes" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-0 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-t-lg">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-amber-600" />
                  Notas
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <Controller
                  name="notes"
                  control={form.control}
                  render={({ field }) => (
                    <Textarea
                      {...field}
                      placeholder="Agregar notas sobre el cliente..."
                      rows={6}
                      className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 resize-none"
                    />
                  )}
                />
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-t-lg">
                <CardTitle className="flex items-center gap-2">
                  <Tag className="h-5 w-5 text-purple-600" />
                  Etiquetas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-6">
                <div className="flex flex-wrap gap-2">
                  {watchedValues.tags?.map((tag, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300 flex items-center gap-1"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="ml-1 hover:bg-purple-200 dark:hover:bg-purple-800 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="Nueva etiqueta"
                    className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addTag()
                      }
                    }}
                  />
                  <Button
                    type="button"
                    onClick={addTag}
                    disabled={!newTag.trim()}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}