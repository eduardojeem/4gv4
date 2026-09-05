'use client'

/**
 * CustomerEditFormV2 - Formulario de Edición Modernizado de Clientes
 * 
 * Características:
 * - Diseño profesional coherente con CustomerDetail
 * - Límite de crédito con formato de miles y botones rápidos de 1-clic
 * - Atajos de teclado (Ctrl+S para guardar, ESC para cancelar)
 * - Pestañas organizadas con validación y estados claros
 * - Probador rápido de WhatsApp
 * - Sugerencias inteligentes de etiquetas
 * - Barra de guardado superior e inferior para máxima comodidad
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
  Copy, MessageSquare, ExternalLink, Sparkles,
  Percent, Hash, Coins
} from 'lucide-react'

// UI Components
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from 'sonner'

// Types and utilities
import { Customer } from '@/hooks/use-customer-state'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import customerService from '@/services/customer-service'
import { customerTypeLabel } from '@/lib/i18n/labels'

import { ALTERNATE_PHONE_LABELS } from '@/lib/customers/contact-rules'
import { useCustomerDuplicates } from '@/hooks/use-customer-duplicates'
import { duplicatesMessage } from '@/lib/customers/duplicate-check'

// Validation Schema
const customerEditSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  // Contacto de un tercero: el celular del cliente suele ser el equipo que dejo
  // en el taller, asi que ahi no se lo puede ubicar.
  alternate_phone: z.string().optional().or(z.literal('')),
  alternate_phone_label: z.string().optional().or(z.literal('')),
  whatsapp: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  city: z.string().optional().or(z.literal('')),
  company: z.string().optional().or(z.literal('')),
  position: z.string().optional().or(z.literal('')),
  ruc: z.string().optional().or(z.literal('')),
  customer_type: z.enum(['regular', 'premium', 'empresa']),
  segment: z.enum(['vip', 'premium', 'regular', 'new', 'high_value', 'low_value', 'business', 'wholesale']),
  status: z.enum(['active', 'inactive', 'suspended', 'pending']),
  credit_limit: z.number().min(0).optional(),
  discount_percentage: z.number().min(0).max(100).optional(),
  payment_terms: z.string().optional().or(z.literal('')),
  preferred_contact: z.enum(['email', 'phone', 'whatsapp', 'sms']),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional().or(z.literal('')),
  birthday: z.string().optional().or(z.literal('')),
})

type CustomerEditFormData = z.infer<typeof customerEditSchema>

interface CustomerEditFormV2Props {
  customer: Customer
  onSave: (data: CustomerEditFormData) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

const SEGMENT_OPTIONS = ['vip', 'premium', 'regular', 'new', 'high_value', 'low_value', 'business', 'wholesale'] as const
const CONTACT_OPTIONS = ['email', 'phone', 'whatsapp', 'sms'] as const
const TYPE_OPTIONS = ['regular', 'premium', 'empresa'] as const
const STATUS_OPTIONS = ['active', 'inactive', 'suspended', 'pending'] as const

const TAG_SUGGESTIONS = ['VIP', 'Frecuente', 'Taller', 'Mayorista', 'Empresa', 'Con Crédito', 'Puntual', 'Garantía']

const CREDIT_PRESETS = [
  { label: '0 Gs (Sin Crédito)', value: 0 },
  { label: '500.000 Gs', value: 500000 },
  { label: '1.000.000 Gs', value: 1000000 },
  { label: '2.000.000 Gs', value: 2000000 },
  { label: '5.000.000 Gs', value: 5000000 },
  { label: '10.000.000 Gs', value: 10000000 },
]

const safeSegment = (v: string | undefined) => (SEGMENT_OPTIONS as readonly string[]).includes(v || '') ? (v as typeof SEGMENT_OPTIONS[number]) : 'regular'
const safeContact = (v: string | undefined) => (CONTACT_OPTIONS as readonly string[]).includes(v || '') ? (v as typeof CONTACT_OPTIONS[number]) : 'email'
const safeType = (v: string | undefined) => (TYPE_OPTIONS as readonly string[]).includes(v || '') ? (v as typeof TYPE_OPTIONS[number]) : 'regular'
const safeStatus = (v: string | undefined) => (STATUS_OPTIONS as readonly string[]).includes(v || '') ? (v as typeof STATUS_OPTIONS[number]) : 'active'

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
      alternate_phone: customer.alternate_phone || '',
      alternate_phone_label: customer.alternate_phone_label || '',
      whatsapp: customer.whatsapp || '',
      address: customer.address || '',
      city: customer.city || '',
      company: customer.company || '',
      position: customer.position || '',
      ruc: customer.ruc || '',
      customer_type: safeType(customer.customer_type),
      segment: safeSegment(customer.segment),
      status: safeStatus(customer.status),
      credit_limit: customer.credit_limit || 0,
      discount_percentage: customer.discount_percentage || 0,
      payment_terms: customer.payment_terms || '',
      preferred_contact: safeContact(customer.preferred_contact),
      tags: customer.tags || [],
      notes: customer.notes || '',
      birthday: customer.birthday || '',
    }
  })

  const { watch, setValue, getValues, reset, handleSubmit } = form

  // Aviso anticipado de que el telefono, el correo o el RUC ya estan cargados en
  // otro cliente. Quien decide es el servidor, que rechaza el guardado con 409.
  const duplicates = useCustomerDuplicates({
    phone: watch('phone'),
    email: watch('email'),
    ruc: watch('ruc'),
    excludeId: customer.id,
  })
  const watchedValues = watch()

  // Cargar datos frescos
  useEffect(() => {
    let mounted = true
    ;(async () => {
      const res = await customerService.getCustomer(customer.id)
      if (mounted && res.success && res.data) {
        reset({
          name: res.data.name || '',
          email: res.data.email || '',
          phone: res.data.phone || '',
          whatsapp: (res.data as any).whatsapp || '',
          address: res.data.address || '',
          city: res.data.city || '',
          company: (res.data as any).company || '',
          position: (res.data as any).position || '',
          ruc: (res.data as any).ruc || '',
          customer_type: safeType(res.data.customer_type as any),
          segment: safeSegment(res.data.segment as any),
          status: safeStatus(res.data.status as any),
          credit_limit: res.data.credit_limit || 0,
          discount_percentage: res.data.discount_percentage || 0,
          payment_terms: res.data.payment_terms || '',
          preferred_contact: safeContact(res.data.preferred_contact as any),
          tags: res.data.tags || [],
          notes: (res.data as any).notes || '',
          birthday: (res.data as any).birthday || '',
        })
      }
    })()
    return () => { mounted = false }
  }, [customer.id, reset])

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
      const preparedData = {
        ...data,
        credit_limit: data.credit_limit !== undefined ? Number(data.credit_limit) : 0,
        discount_percentage: data.discount_percentage !== undefined ? Number(data.discount_percentage) : 0,
        name: data.name?.trim(),
        email: data.email?.trim() || undefined,
        phone: data.phone?.trim() || undefined,
        alternate_phone: data.alternate_phone?.trim() || null,
        // Sin telefono, la aclaracion de quien atiende no significa nada.
        alternate_phone_label: data.alternate_phone?.trim() ? (data.alternate_phone_label?.trim() || null) : null,
        whatsapp: data.whatsapp?.trim() || undefined,
        address: data.address?.trim() || undefined,
        city: data.city?.trim() || undefined,
        company: data.company?.trim() || undefined,
        position: data.position?.trim() || undefined,
        ruc: data.ruc?.trim() || undefined,
        payment_terms: data.payment_terms?.trim() || undefined,
        notes: data.notes?.trim() || undefined,
        birthday: data.birthday?.trim() || undefined,
      }

      await onSave(preparedData)
      setHasChanges(false)
    } catch (error) {
      console.error('Error saving customer:', error)
      toast.error('Error al actualizar cliente')
    } finally {
      setIsSaving(false)
    }
  }

  // Atajos de teclado: Ctrl+S para guardar, ESC para cancelar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSubmit(handleSave)()
      } else if (e.key === 'Escape') {
        const activeEl = document.activeElement
        const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')
        if (!isInput) {
          onCancel()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSubmit, handleSave, onCancel])

  const addTag = (tagToAdd?: string) => {
    const target = (tagToAdd || newTag).trim()
    if (target && !watchedValues.tags?.includes(target)) {
      const currentTags = watchedValues.tags || []
      setValue('tags', [...currentTags, target], { shouldDirty: true })
      if (!tagToAdd) setNewTag('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    const currentTags = watchedValues.tags || []
    setValue('tags', currentTags.filter(tag => tag !== tagToRemove), { shouldDirty: true })
  }

  const initials = customer.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'CL'

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ─── BARRA SUPERIOR DE ACCIONES ─── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-[#0d1117] rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-4"
      >
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            className="group gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-1.5 font-bold text-slate-800 shadow-xs hover:border-slate-400 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            <span className="text-xs">Volver</span>
            <kbd className="hidden sm:inline-flex items-center h-4 px-1.5 text-[9px] font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 rounded border border-slate-300 dark:border-slate-700">
              ESC
            </kbd>
          </Button>
          
          <div className="flex items-center gap-3">
            <Avatar className="h-11 w-11 rounded-xl border border-slate-200 shadow-xs dark:border-slate-700">
              <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${customer.name}`} />
              <AvatarFallback className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-bold text-sm">
                {initials}
              </AvatarFallback>
            </Avatar>
            
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900 dark:text-white">
                  Editar: {customer.name}
                </h1>
                {hasChanges && (
                  <Badge className="bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 text-[10px] font-semibold">
                    ● Cambios sin guardar
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Código: <span className="font-mono font-semibold">{customer.customerCode || customer.id.slice(-6)}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isSaving || isLoading}
            className="rounded-xl border-slate-300 dark:border-slate-700"
          >
            <X className="h-4 w-4 mr-1.5" />
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit(handleSave)}
            disabled={isSaving || isLoading || !hasChanges}
            className="rounded-xl bg-blue-600 hover:bg-blue-700 font-bold text-white shadow-sm"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {isSaving ? 'Guardando...' : 'Guardar Cambios'}
            <kbd className="hidden sm:inline-flex ml-2 items-center h-4 px-1.5 text-[9px] font-mono bg-blue-700/60 rounded border border-blue-400/40">
              Ctrl+S
            </kbd>
          </Button>
        </div>
      </motion.div>

      {/* ─── PESTAÑAS DEL FORMULARIO ─── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="border-b border-slate-200 dark:border-slate-800">
          <TabsList className="h-12 bg-transparent p-0 gap-6">
            <TabsTrigger
              value="overview"
              className="h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:shadow-none px-1 font-semibold text-slate-500 hover:text-slate-700 text-xs sm:text-sm"
            >
              <User className="h-4 w-4 mr-2 text-blue-600" />
              General y Contacto
            </TabsTrigger>
            <TabsTrigger
              value="profile"
              className="h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:shadow-none px-1 font-semibold text-slate-500 hover:text-slate-700 text-xs sm:text-sm"
            >
              <Building className="h-4 w-4 mr-2 text-indigo-600" />
              Empresa y Perfil
            </TabsTrigger>
            <TabsTrigger
              value="financial"
              className="h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:shadow-none px-1 font-semibold text-slate-500 hover:text-slate-700 text-xs sm:text-sm"
            >
              <CreditCard className="h-4 w-4 mr-2 text-emerald-600" />
              Línea de Crédito y Finanzas
            </TabsTrigger>
            <TabsTrigger
              value="notes"
              className="h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:shadow-none px-1 font-semibold text-slate-500 hover:text-slate-700 text-xs sm:text-sm"
            >
              <FileText className="h-4 w-4 mr-2 text-amber-600" />
              Notas y Etiquetas
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ─── PESTAÑA 1: GENERAL Y CONTACTO ─── */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card className="border border-slate-200 dark:border-slate-800 shadow-sm">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-t-xl pb-4">
                  <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                    <User className="h-4.5 w-4.5 text-blue-600" />
                    Datos Principales del Cliente
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Información personal y canales directos de comunicación
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5 p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Nombre */}
                    <div className="space-y-1.5">
                      <Label htmlFor="name" className="text-xs font-bold text-slate-700 dark:text-slate-300">
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
                              placeholder="Ej: Juan Pérez"
                              className={cn(
                                "h-9 text-sm",
                                fieldState.error && "border-rose-500 ring-rose-500"
                              )}
                            />
                            {fieldState.error && (
                              <p className="text-xs text-rose-500 mt-1">{fieldState.error.message}</p>
                            )}
                          </div>
                        )}
                      />
                    </div>

                    {/* RUC / CI */}
                    <div className="space-y-1.5">
                      <Label htmlFor="ruc" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        RUC / Documento CI
                      </Label>
                      <Controller
                        name="ruc"
                        control={form.control}
                        render={({ field }) => (
                          <div className="relative">
                            <Input
                              {...field}
                              id="ruc"
                              placeholder="Ej: 4589234-1"
                              className="h-9 text-sm font-mono pl-8"
                            />
                            <Hash className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                          </div>
                        )}
                      />
                    </div>

                    {duplicates.length > 0 && (
                      <div className="sm:col-span-2 flex items-start gap-2 rounded-xl border border-amber-300/70 bg-amber-50 p-3 text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-200">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold">{duplicatesMessage(duplicates)}</p>
                          <p className="mt-0.5 text-[11px] opacity-80">
                            Son datos que no se pueden repetir dentro de la empresa: si quedan en dos fichas, las compras y la deuda del cliente se reparten entre las dos.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Teléfono */}
                    <div className="space-y-1.5">
                      <Label htmlFor="phone" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Teléfono Principal
                      </Label>
                      <Controller
                        name="phone"
                        control={form.control}
                        render={({ field }) => (
                          <div className="relative">
                            <Input
                              {...field}
                              id="phone"
                              placeholder="Ej: 0981 123 456"
                              className="h-9 text-sm font-mono pl-8"
                            />
                            <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                          </div>
                        )}
                      />
                    </div>

                    {/* Contacto alternativo */}
                    <div className="space-y-1.5">
                      <Label htmlFor="alternate_phone" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Otro teléfono para avisarle
                      </Label>
                      <Controller
                        name="alternate_phone"
                        control={form.control}
                        render={({ field }) => (
                          <div className="relative">
                            <Input
                              {...field}
                              id="alternate_phone"
                              placeholder="Si deja su celular en reparación"
                              className="h-9 text-sm font-mono pl-8"
                            />
                            <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                          </div>
                        )}
                      />
                    </div>

                    {watchedValues.alternate_phone?.trim() ? (
                      <div className="space-y-1.5">
                        <Label htmlFor="alternate_phone_label" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          ¿De quién es ese teléfono?
                        </Label>
                        <Controller
                          name="alternate_phone_label"
                          control={form.control}
                          render={({ field }) => (
                            <>
                              <Input
                                {...field}
                                id="alternate_phone_label"
                                list="customer-edit-alternate-labels"
                                placeholder="Ej: hermana, jefe, hijo…"
                                className="h-9 text-sm"
                              />
                              <datalist id="customer-edit-alternate-labels">
                                {ALTERNATE_PHONE_LABELS.map((label) => (
                                  <option key={label} value={label} />
                                ))}
                              </datalist>
                            </>
                          )}
                        />
                      </div>
                    ) : null}

                    {/* WhatsApp */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="whatsapp" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          WhatsApp
                        </Label>
                        {watchedValues.whatsapp && (
                          <a
                            href={`https://wa.me/${watchedValues.whatsapp.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] font-semibold text-emerald-600 hover:underline flex items-center gap-1"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Probar chat
                          </a>
                        )}
                      </div>
                      <Controller
                        name="whatsapp"
                        control={form.control}
                        render={({ field }) => (
                          <div className="relative">
                            <Input
                              {...field}
                              id="whatsapp"
                              placeholder="Ej: 595981123456"
                              className="h-9 text-sm font-mono pl-8"
                            />
                            <MessageSquare className="absolute left-2.5 top-2.5 h-4 w-4 text-emerald-600" />
                          </div>
                        )}
                      />
                    </div>

                    {/* Email */}
                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Correo Electrónico
                      </Label>
                      <Controller
                        name="email"
                        control={form.control}
                        render={({ field, fieldState }) => (
                          <div className="relative">
                            <Input
                              {...field}
                              id="email"
                              type="email"
                              placeholder="cliente@ejemplo.com"
                              className={cn(
                                "h-9 text-sm pl-8",
                                fieldState.error && "border-rose-500 ring-rose-500"
                              )}
                            />
                            <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                            {fieldState.error && (
                              <p className="text-xs text-rose-500 mt-1">{fieldState.error.message}</p>
                            )}
                          </div>
                        )}
                      />
                    </div>

                    {/* Cumpleaños */}
                    <div className="space-y-1.5">
                      <Label htmlFor="birthday" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Fecha de Nacimiento
                      </Label>
                      <Controller
                        name="birthday"
                        control={form.control}
                        render={({ field }) => (
                          <div className="relative">
                            <Input
                              {...field}
                              id="birthday"
                              type="date"
                              className="h-9 text-sm pl-8"
                            />
                            <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                          </div>
                        )}
                      />
                    </div>

                    {/* Dirección */}
                    <div className="space-y-1.5 md:col-span-2">
                      <Label htmlFor="address" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Dirección Domiciliaria / Comercial
                      </Label>
                      <Controller
                        name="address"
                        control={form.control}
                        render={({ field }) => (
                          <div className="relative">
                            <Input
                              {...field}
                              id="address"
                              placeholder="Ej: Avda. Principal 1234 c/ Calle 2"
                              className="h-9 text-sm pl-8"
                            />
                            <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                          </div>
                        )}
                      />
                    </div>

                    {/* Ciudad */}
                    <div className="space-y-1.5 md:col-span-2">
                      <Label htmlFor="city" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Ciudad
                      </Label>
                      <Controller
                        name="city"
                        control={form.control}
                        render={({ field }) => (
                          <Input
                            {...field}
                            id="city"
                            placeholder="Ej: Asunción, San Lorenzo, CDE..."
                            className="h-9 text-sm"
                          />
                        )}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Columna Derecha: Estado y Preferencia */}
            <div className="space-y-6">
              <Card className="border border-slate-200 dark:border-slate-800 shadow-sm">
                <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 rounded-t-xl pb-4">
                  <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                    <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600" />
                    Estado y Notificaciones
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 p-5">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Estado de la Cuenta
                    </Label>
                    <Controller
                      name="status"
                      control={form.control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">
                              <div className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                <span>Activo (Operativo)</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="inactive">
                              <div className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-slate-400" />
                                <span>Inactivo</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="suspended">
                              <div className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-rose-500" />
                                <span>Suspendido / Bloqueado</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="pending">
                              <div className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-amber-500" />
                                <span>Pendiente de Verificación</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Canal de Contacto Preferido
                    </Label>
                    <Controller
                      name="preferred_contact"
                      control={form.control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="whatsapp">
                              <div className="flex items-center gap-2">
                                <Smartphone className="h-4 w-4 text-emerald-600" />
                                WhatsApp
                              </div>
                            </SelectItem>
                            <SelectItem value="phone">
                              <div className="flex items-center gap-2">
                                <Phone className="h-4 w-4 text-blue-600" />
                                Llamada Telefónica
                              </div>
                            </SelectItem>
                            <SelectItem value="email">
                              <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4 text-purple-600" />
                                Correo Electrónico
                              </div>
                            </SelectItem>
                            <SelectItem value="sms">
                              <div className="flex items-center gap-2">
                                <MessageSquare className="h-4 w-4 text-amber-600" />
                                Mensaje SMS
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Vista Previa Rápida */}
              <Card className="border border-slate-200 dark:border-slate-800 shadow-sm bg-slate-50/50 dark:bg-slate-900/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5" />
                    Resumen en Tiempo Real
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-800">
                    <span className="text-slate-500">Cliente:</span>
                    <span className="font-bold text-slate-800 dark:text-white truncate max-w-[150px]">{watchedValues.name || '-'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-800">
                    <span className="text-slate-500">RUC/CI:</span>
                    <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{watchedValues.ruc || 'Sin documento'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-800">
                    <span className="text-slate-500">Límite Crédito:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(watchedValues.credit_limit || 0)}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Tipo:</span>
                    <Badge variant="outline" className="text-[10px] uppercase font-bold">
                      {customerTypeLabel(watchedValues.customer_type)}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ─── PESTAÑA 2: EMPRESA Y PERFIL ─── */}
        <TabsContent value="profile" className="space-y-6">
          <Card className="border border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 rounded-t-xl pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                <Building className="h-4.5 w-4.5 text-indigo-600" />
                Perfil Comercial y Segmentación
              </CardTitle>
              <CardDescription className="text-xs">
                Clasificación para promociones, tarifas y cuentas corporativas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Tipo de cliente */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Tipo de Cliente
                  </Label>
                  <Controller
                    name="customer_type"
                    control={form.control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="regular">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-slate-500" />
                              <span>Regular (Consumidor Final)</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="premium">
                            <div className="flex items-center gap-2">
                              <Star className="h-4 w-4 text-purple-500" />
                              <span>Premium (Cliente Preferencial)</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="empresa">
                            <div className="flex items-center gap-2">
                              <Building className="h-4 w-4 text-indigo-500" />
                              <span>Empresa / Corporativo</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                {/* Segmento */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Segmento Comercial
                  </Label>
                  <Controller
                    name="segment"
                    control={form.control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="regular">Regular</SelectItem>
                          <SelectItem value="vip">⭐ VIP</SelectItem>
                          <SelectItem value="wholesale">📦 Mayorista</SelectItem>
                          <SelectItem value="business">🏢 Empresarial</SelectItem>
                          <SelectItem value="premium">💎 Premium</SelectItem>
                          <SelectItem value="new">🆕 Nuevo Cliente</SelectItem>
                          <SelectItem value="high_value">🔥 Alto Valor</SelectItem>
                          <SelectItem value="low_value">Bajo Valor</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                {/* Empresa */}
                <div className="space-y-1.5">
                  <Label htmlFor="company" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Razón Social / Nombre de Empresa
                  </Label>
                  <Controller
                    name="company"
                    control={form.control}
                    render={({ field }) => (
                      <Input
                        {...field}
                        id="company"
                        placeholder="Ej: Distribuidora Central S.A."
                        className="h-9 text-sm"
                      />
                    )}
                  />
                </div>

                {/* Cargo */}
                <div className="space-y-1.5">
                  <Label htmlFor="position" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Cargo o Puesto
                  </Label>
                  <Controller
                    name="position"
                    control={form.control}
                    render={({ field }) => (
                      <Input
                        {...field}
                        id="position"
                        placeholder="Ej: Gerente de Compras, Encargado IT"
                        className="h-9 text-sm"
                      />
                    )}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── PESTAÑA 3: LÍNEA DE CRÉDITO Y FINANZAS ─── */}
        <TabsContent value="financial" className="space-y-6">
          <Card className="border border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 rounded-t-xl pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                <Coins className="h-4.5 w-4.5 text-emerald-600" />
                Habilitación de Crédito y Descuentos
              </CardTitle>
              <CardDescription className="text-xs">
                Gestiona el crédito disponible en el POS y condiciones comerciales
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Límite de Crédito */}
                <div className="space-y-3 md:col-span-2 p-4 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/50">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <Label htmlFor="credit_limit" className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                        Límite de Crédito Autorizado
                      </Label>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">
                        Permite procesar ventas en cuotas o a cuenta corriente en el POS
                      </p>
                    </div>
                    <div className="text-right font-bold text-lg text-emerald-700 dark:text-emerald-300 font-mono">
                      {formatCurrency(watchedValues.credit_limit || 0)}
                    </div>
                  </div>

                  <Controller
                    name="credit_limit"
                    control={form.control}
                    render={({ field }) => (
                      <div className="space-y-3">
                        <Input
                          id="credit_limit"
                          type="number"
                          min="0"
                          step="100000"
                          value={field.value || ''}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                          placeholder="0"
                          className="h-10 text-base font-bold font-mono bg-white dark:bg-slate-900"
                        />

                        {/* Presets 1-clic */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[11px] font-semibold text-slate-500 mr-1">Rápido:</span>
                          {CREDIT_PRESETS.map((preset) => (
                            <Button
                              key={preset.value}
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => field.onChange(preset.value)}
                              className={cn(
                                "h-6 px-2 text-[10.5px] font-semibold rounded-lg",
                                field.value === preset.value
                                  ? "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700"
                                  : "bg-white hover:bg-emerald-50 text-slate-700 border-slate-300 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700"
                              )}
                            >
                              {preset.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  />
                </div>

                {/* Descuento habitual */}
                <div className="space-y-1.5">
                  <Label htmlFor="discount_percentage" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Descuento Automático (%)
                  </Label>
                  <Controller
                    name="discount_percentage"
                    control={form.control}
                    render={({ field }) => (
                      <div className="relative">
                        <Input
                          {...field}
                          id="discount_percentage"
                          type="number"
                          min="0"
                          max="100"
                          placeholder="0"
                          onChange={(e) => field.onChange(Number(e.target.value))}
                          className="h-9 text-sm pl-8 font-mono"
                        />
                        <Percent className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                      </div>
                    )}
                  />
                  <p className="text-[11px] text-slate-500">
                    Se aplicará por defecto en las compras registradas para este cliente.
                  </p>
                </div>

                {/* Términos de pago */}
                <div className="space-y-1.5">
                  <Label htmlFor="payment_terms" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Términos / Plazo de Pago
                  </Label>
                  <Controller
                    name="payment_terms"
                    control={form.control}
                    render={({ field }) => (
                      <Input
                        {...field}
                        id="payment_terms"
                        placeholder="Ej: Contado, 15 días, 30 días, 3 cuotas..."
                        className="h-9 text-sm"
                      />
                    )}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── PESTAÑA 4: NOTAS Y ETIQUETAS ─── */}
        <TabsContent value="notes" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Notas */}
            <Card className="border border-slate-200 dark:border-slate-800 shadow-sm">
              <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-t-xl pb-4">
                <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                  <FileText className="h-4.5 w-4.5 text-amber-600" />
                  Notas Internas
                </CardTitle>
                <CardDescription className="text-xs">
                  Anotaciones privadas para los vendedores y técnicos
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <Controller
                  name="notes"
                  control={form.control}
                  render={({ field }) => (
                    <Textarea
                      {...field}
                      placeholder="Escribe notas, preferencias del cliente, advertencias o acuerdos especiales..."
                      rows={6}
                      className="text-sm resize-none"
                    />
                  )}
                />
              </CardContent>
            </Card>

            {/* Etiquetas */}
            <Card className="border border-slate-200 dark:border-slate-800 shadow-sm">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 rounded-t-xl pb-4">
                <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                  <Tag className="h-4.5 w-4.5 text-purple-600" />
                  Etiquetas de Identificación
                </CardTitle>
                <CardDescription className="text-xs">
                  Tags para filtros y búsquedas avanzadas
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-6">
                {/* Lista de tags activos */}
                <div className="flex flex-wrap gap-2 min-h-[3rem] p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                  {watchedValues.tags && watchedValues.tags.length > 0 ? (
                    watchedValues.tags.map((tag, index) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 font-semibold px-2 py-0.5 flex items-center gap-1.5"
                      >
                        <span>{tag}</span>
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="hover:bg-purple-200 dark:hover:bg-purple-800 rounded-full p-0.5 transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400 italic">No hay etiquetas asignadas</span>
                  )}
                </div>

                {/* Input para nuevo tag */}
                <div className="flex gap-2">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="Escribir nueva etiqueta..."
                    className="h-9 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addTag()
                      }
                    }}
                  />
                  <Button
                    type="button"
                    onClick={() => addTag()}
                    disabled={!newTag.trim()}
                    className="h-9 px-3 bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Agregar
                  </Button>
                </div>

                {/* Sugerencias rápidas */}
                <div className="space-y-1.5 pt-2">
                  <span className="text-[11px] font-bold text-slate-500">Sugerencias rápidas:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {TAG_SUGGESTIONS.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => addTag(tag)}
                        disabled={watchedValues.tags?.includes(tag)}
                        className={cn(
                          "text-[11px] px-2 py-0.5 rounded-lg border font-medium transition-all",
                          watchedValues.tags?.includes(tag)
                            ? "opacity-40 bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                            : "bg-white hover:bg-purple-50 text-slate-700 border-slate-300 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300"
                        )}
                      >
                        + {tag}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ─── BARRA INFERIOR DE GUARDADO FIJA / FOOTER ─── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {hasChanges ? (
            <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold">
              <AlertCircle className="h-4 w-4" />
              Tienes cambios pendientes por guardar
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
              <CheckCircle2 className="h-4 w-4" />
              Todos los datos están al día
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSaving || isLoading}
            className="rounded-xl border-slate-300 dark:border-slate-700"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit(handleSave)}
            disabled={isSaving || isLoading || !hasChanges}
            className="rounded-xl bg-blue-600 hover:bg-blue-700 font-bold text-white shadow-sm"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {isSaving ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </div>
      </div>
    </div>
  )
}
