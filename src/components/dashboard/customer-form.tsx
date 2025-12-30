"use client"

import React, { useEffect, useState } from 'react'
import { User, Mail, Phone, FileText, CheckCircle, AlertCircle, Loader2, Building, MessageCircle, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { config } from '@/lib/config'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'

export interface CustomerFormData {
  customerCode: string
  firstName: string
  lastName: string
  company: string
  customerType: 'individual' | 'mayorista' | 'empresa'
  customerCategory: 'nuevo' | 'regular' | 'premium' | 'vip'
  email: string
  phone: string
  whatsapp: string
  preferredContact: 'email' | 'phone' | 'whatsapp'
  documentNumber: string
  documentType: 'ci' | 'ruc' | 'pasaporte'
  address: string
  city: string
  postalCode: string
  country: string
  creditLimit: string
  paymentTerms: string
  applicableDiscounts: string
  notes: string
  tags: string[]
}

interface FieldValidation {
  isValid: boolean
  message?: string
  isValidating?: boolean
}

interface DuplicateState {
  email?: boolean
  phone?: boolean
  documentNumber?: boolean
}

interface CustomerFormProps {
  initialValues?: Partial<CustomerFormData>
  onCustomerSaved?: (customer: { id?: string } & CustomerFormData) => void
  submitLabel?: string
  hideActions?: boolean
  compact?: boolean
}

export function CustomerForm({ initialValues, onCustomerSaved, submitLabel = 'Guardar Cliente', hideActions = false, compact = false }: CustomerFormProps) {
  const generateCustomerCode = (): string => {
    const prefix = 'CLI'
    const timestamp = Date.now().toString().slice(-6)
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
    return `${prefix}${timestamp}${random}`
  }

  const [formProgress, setFormProgress] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [errors, setErrors] = useState<Partial<CustomerFormData>>({})
  const [fieldValidations, setFieldValidations] = useState<Record<string, FieldValidation>>({})
  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateState>({})

  const [formData, setFormData] = useState<CustomerFormData>({
    customerCode: generateCustomerCode(),
    firstName: '',
    lastName: '',
    company: '',
    customerType: 'individual',
    customerCategory: 'nuevo',
    email: '',
    phone: '',
    whatsapp: '',
    preferredContact: 'email',
    documentNumber: '',
    documentType: 'ci',
    address: '',
    city: '',
    postalCode: '',
    country: 'Uruguay',
    creditLimit: '',
    paymentTerms: '',
    applicableDiscounts: '',
    notes: '',
    tags: []
  })

  useEffect(() => {
    if (initialValues) {
      setFormData(prev => ({ ...prev, ...initialValues, customerCode: prev.customerCode }))
    }
  }, [initialValues])

  useEffect(() => {
    const requiredFields = ['firstName', 'phone']
    const filledFields = requiredFields.filter(field => (formData as any)[field]?.toString().trim())
    const progress = (filledFields.length / requiredFields.length) * 100
    setFormProgress(progress)
  }, [formData])

  const validateField = async (field: keyof CustomerFormData, value: string): Promise<FieldValidation> => {
    setFieldValidations(prev => ({ ...prev, [field]: { isValid: false, isValidating: true } }))
    await new Promise(resolve => setTimeout(resolve, 300))
    let validation: FieldValidation = { isValid: true }

    switch (field) {
      case 'firstName':
      case 'lastName':
        if (!value.trim()) {
          validation = { isValid: false, message: `${field === 'firstName' ? 'El nombre' : 'El apellido'} es obligatorio` }
        } else if (value.trim().length < 2) {
          validation = { isValid: false, message: 'Debe tener al menos 2 caracteres' }
        }
        break
      case 'email':
        if (!value.trim()) {
          validation = { isValid: false, message: 'El email es obligatorio' }
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          validation = { isValid: false, message: 'El formato del email no es válido' }
        }
        break
      case 'phone':
        if (!value.trim()) {
          validation = { isValid: false, message: 'El teléfono es obligatorio' }
        } else if (!/^[+]?[\d\s\-()]{9,}$/.test(value)) {
          validation = { isValid: false, message: 'El formato del teléfono no es válido' }
        }
        break
      case 'documentNumber':
        if (!value.trim()) {
          validation = { isValid: false, message: 'El número de documento es obligatorio' }
        } else if (value.trim().length < 6) {
          validation = { isValid: false, message: 'El documento debe tener al menos 6 caracteres' }
        }
        break
      case 'address':
        if (!value.trim()) {
          validation = { isValid: false, message: 'La dirección es obligatoria' }
        } else if (value.trim().length < 10) {
          validation = { isValid: false, message: 'La dirección debe ser más específica' }
        }
        break
      case 'city':
        if (!value.trim()) {
          validation = { isValid: false, message: 'La ciudad es obligatoria' }
        }
        break
      case 'postalCode':
        if (!value.trim()) {
          validation = { isValid: false, message: 'El código postal es obligatorio' }
        } else if (!/^\d{4,6}$/.test(value)) {
          validation = { isValid: false, message: 'Código postal inválido (4-6 dígitos)' }
        }
        break
    }

    setFieldValidations(prev => ({ ...prev, [field]: validation }))
    return validation
  }

  const validateForm = (): boolean => {
    const newErrors: Partial<CustomerFormData> = {}
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'El nombre es obligatorio'
    }
    if (!formData.phone.trim()) {
      newErrors.phone = 'El número de celular es obligatorio'
    } else if (!/^[+]?[\d\s\-()]{9,}$/.test(formData.phone)) {
      newErrors.phone = 'El formato del número de celular no es válido'
    }
    if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'El formato del email no es válido'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleInputChange = async (field: keyof CustomerFormData, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value as any }))
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }))
    if (typeof value === 'string' && ['firstName', 'phone'].includes(field)) {
      await validateField(field, value)
    }
    if (typeof value === 'string' && ['email', 'phone', 'documentNumber'].includes(field)) {
      await checkDuplicates(field as any, value)
    }
  }

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      handleInputChange('tags', [...formData.tags, newTag.trim()])
      setNewTag('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    handleInputChange('tags', formData.tags.filter(tag => tag !== tagToRemove))
  }

  const checkDuplicates = async (type: 'email' | 'phone' | 'documentNumber', value: string) => {
    if (!value || !config.supabase.isConfigured) return
    const supabase = createSupabaseClient()
    const { data }: any = await supabase
      .from('customers')
      .select('id')
      .or(type === 'email' ? `email.eq.${value}` : type === 'phone' ? `phone.eq.${value}` : `document.eq.${value}`)
      .limit(1)
    setDuplicateInfo(prev => ({ ...prev, [type]: (data || []).length > 0 }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) {
      toast.error('Por favor, corrige los errores en el formulario')
      return
    }
    setIsSubmitting(true)

    try {
      if (config.supabase.isConfigured) {
        toast.loading('Registrando cliente...', { id: 'customer-registration' })
        const supabase = createSupabaseClient()
        const { firstName, lastName, phone, email, address, city, country, documentNumber } = formData
        const { data, error }: any = await supabase
          .from('customers')
          .insert({
            first_name: firstName,
            last_name: lastName,
            phone,
            email: email || null,
            address: address || null,
            city: city || null,
            country: country || null,
            document: documentNumber || null,
            customer_type: 'nuevo',
            credit_limit: formData.creditLimit ? parseFloat(formData.creditLimit) : 0,
            payment_terms: formData.paymentTerms || 'contado'
          })
          .select('id')
          .single()
        if (error) {
          toast.error('No se pudo registrar el cliente', { id: 'customer-registration' })
        } else {
          toast.success('¡Cliente registrado exitosamente!', { id: 'customer-registration' })
          onCustomerSaved?.({ ...formData, id: data?.id })
        }
      } else {
        // Modo demo: simular pasos
        toast.loading('Validando información...', { id: 'customer-registration' })
        await new Promise(resolve => setTimeout(resolve, 800))
        toast.loading('Creando perfil de cliente...', { id: 'customer-registration' })
        await new Promise(resolve => setTimeout(resolve, 800))
        toast.loading('Finalizando registro...', { id: 'customer-registration' })
        await new Promise(resolve => setTimeout(resolve, 400))
        onCustomerSaved?.({ ...formData })
        toast.success('¡Cliente registrado exitosamente!', { id: 'customer-registration' })
      }
    } catch (error) {
      toast.error('Error al registrar el cliente', { id: 'customer-registration' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const customerTypeOptions = [
    { value: 'individual', label: 'Individual', description: 'Cliente persona física', icon: <User className="h-4 w-4" /> },
    { value: 'mayorista', label: 'Mayorista', description: 'Cliente con compras por volumen', icon: <Building className="h-4 w-4" /> },
    { value: 'empresa', label: 'Empresa', description: 'Cliente corporativo', icon: <Building className="h-4 w-4" /> }
  ]

  const customerCategoryOptions = [
    { value: 'nuevo', label: 'Nuevo', description: 'Cliente recién registrado', color: 'bg-blue-100 text-blue-800' },
    { value: 'regular', label: 'Regular', description: 'Cliente con historial estándar', color: 'bg-gray-100 text-gray-800' },
    { value: 'premium', label: 'Premium', description: 'Cliente con beneficios especiales', color: 'bg-purple-100 text-purple-800' },
    { value: 'vip', label: 'VIP', description: 'Cliente de máxima prioridad', color: 'bg-yellow-100 text-yellow-800' }
  ]

  const contactMethodOptions = [
    { value: 'email', label: 'Email', icon: <Mail className="h-4 w-4" /> },
    { value: 'phone', label: 'Teléfono', icon: <Phone className="h-4 w-4" /> },
    { value: 'whatsapp', label: 'WhatsApp', icon: <MessageCircle className="h-4 w-4" /> }
  ]

  const documentTypeOptions = [
    { value: 'ci', label: 'Cédula de Identidad (CI)' },
    { value: 'ruc', label: 'RUC' },
    { value: 'pasaporte', label: 'Pasaporte' }
  ]

  const getFieldIcon = (field: string) => {
    const validation = fieldValidations[field]
    if (validation?.isValidating) return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
    if (validation?.isValid === true) return <CheckCircle className="h-4 w-4 text-green-500" />
    if (validation?.isValid === false) return <AlertCircle className="h-4 w-4 text-red-500" />
    return null
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="mt-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Progreso del formulario</span>
          <span className="text-sm text-slate-600 dark:text-slate-400">{Math.round(formProgress)}%</span>
        </div>
        <Progress value={formProgress} className="h-2 bg-slate-200 dark:bg-slate-700" />
      </div>

      {/* Datos Generales */}
      <div className="space-y-6 p-6 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
            <User className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h3 className="text-xl font-semibold text-indigo-700 dark:text-indigo-300">Datos Generales</h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="customerCode" className="text-sm font-medium text-slate-700 dark:text-slate-300">Código de Cliente</Label>
            <div className="relative">
              <Input id="customerCode" value={formData.customerCode} readOnly className="bg-slate-50 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 cursor-not-allowed" />
              <div className="absolute right-3 top-3">
                <CheckCircle className="h-4 w-4 text-green-500" />
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Generado automáticamente</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="firstName" className="text-sm font-medium flex items-center gap-1 text-slate-700 dark:text-slate-300">Nombre <span className="text-red-500 dark:text-red-400">*</span></Label>
            <div className="relative">
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                placeholder="Ej: María"
                className={cn(
                  'pr-10 transition-all duration-200 bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500',
                  errors.firstName ? 'border-red-500 focus:border-red-500 dark:border-red-400 dark:focus:border-red-400' :
                    fieldValidations.firstName?.isValid ? 'border-green-500 focus:border-green-500 dark:border-green-400 dark:focus:border-green-400' : 'focus:border-indigo-500 dark:focus:border-indigo-400'
                )}
                aria-describedby={errors.firstName ? 'firstName-error' : undefined}
                aria-invalid={!!errors.firstName}
              />
              <div className="absolute right-3 top-3">{getFieldIcon('firstName')}</div>
            </div>
            {errors.firstName && (
              <p id="firstName-error" className="text-sm text-red-500 dark:text-red-400 flex items-center gap-1" role="alert">
                <AlertCircle className="h-3 w-3" />{errors.firstName}
              </p>
            )}
            {fieldValidations.firstName?.message && !errors.firstName && (
              <p className="text-sm text-red-500 dark:text-red-400 flex items-center gap-1" role="alert">
                <AlertCircle className="h-3 w-3" />{fieldValidations.firstName.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="lastName" className="text-sm font-medium flex items-center gap-1 text-slate-700 dark:text-slate-300">Apellido <span className="text-red-500 dark:text-red-400">*</span></Label>
            <div className="relative">
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                placeholder="Ej: González"
                className={cn(
                  'pr-10 transition-all duration-200 bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500',
                  errors.lastName ? 'border-red-500 focus:border-red-500 dark:border-red-400 dark:focus:border-red-400' :
                    fieldValidations.lastName?.isValid ? 'border-green-500 focus:border-green-500 dark:border-green-400 dark:focus:border-green-400' : 'focus:border-indigo-500 dark:focus:border-indigo-400'
                )}
                aria-describedby={errors.lastName ? 'lastName-error' : undefined}
                aria-invalid={!!errors.lastName}
              />
              <div className="absolute right-3 top-3">{getFieldIcon('lastName')}</div>
            </div>
            {errors.lastName && (
              <p id="lastName-error" className="text-sm text-red-500 dark:text-red-400 flex items-center gap-1" role="alert">
                <AlertCircle className="h-3 w-3" />{errors.lastName}
              </p>
            )}
            {fieldValidations.lastName?.message && !errors.lastName && (
              <p className="text-sm text-red-500 dark:text-red-400 flex items-center gap-1" role="alert">
                <AlertCircle className="h-3 w-3" />{fieldValidations.lastName.message}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="company" className="text-sm font-medium text-slate-700 dark:text-slate-300">Empresa (opcional)</Label>
          <Input id="company" value={formData.company} onChange={(e) => handleInputChange('company', e.target.value)} placeholder="Nombre de la empresa" className="transition-all duration-200 bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-indigo-500 dark:focus:border-indigo-400" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="customerType" className="text-sm font-medium flex items-center gap-1">Tipo de Cliente <span className="text-red-500">*</span></Label>
            <Select value={formData.customerType} onValueChange={(value: 'individual' | 'mayorista' | 'empresa') => handleInputChange('customerType', value)}>
              <SelectTrigger className="transition-all duration-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {customerTypeOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-3">{option.icon}<div className="flex flex-col"><span className="font-medium">{option.label}</span><span className="text-xs text-muted-foreground">{option.description}</span></div></div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="customerCategory" className="text-sm font-medium flex items-center gap-1">Categoría de Cliente <span className="text-red-500">*</span></Label>
            <Select value={formData.customerCategory} onValueChange={(value: 'nuevo' | 'regular' | 'premium' | 'vip') => handleInputChange('customerCategory', value)}>
              <SelectTrigger className="transition-all duration-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {customerCategoryOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-3"><div className={cn('w-3 h-3 rounded-full', option.color)}></div><div className="flex flex-col"><span className="font-medium">{option.label}</span><span className="text-xs text-muted-foreground">{option.description}</span></div></div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Separator className="my-8" />

      {/* Información de Contacto */}
      <div className="space-y-6 p-6 bg-white dark:bg-slate-800 rounded-xl border border-green-100 dark:border-green-900/30 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg"><Mail className="h-5 w-5 text-green-600 dark:text-green-400" /></div>
          <h3 className="text-xl font-semibold text-green-700 dark:text-green-300">Información de Contacto</h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium flex items-center gap-1 text-slate-700 dark:text-slate-300">Correo Electrónico <span className="text-red-500 dark:text-red-400">*</span></Label>
            <div className="relative">
              <Input id="email" type="email" value={formData.email} onChange={(e) => handleInputChange('email', e.target.value)} placeholder="cliente@email.com" className={cn('pr-10 transition-all duration-200 bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500', errors.email ? 'border-red-500 focus:border-red-500 dark:border-red-400 dark:focus:border-red-400' : fieldValidations.email?.isValid ? 'border-green-500 focus:border-green-500 dark:border-green-400 dark:focus:border-green-400' : 'focus:border-emerald-500 dark:focus:border-emerald-400')} aria-describedby={errors.email ? 'email-error' : undefined} aria-invalid={!!errors.email} />
              <div className="absolute right-3 top-3">{getFieldIcon('email')}</div>
            </div>
            {errors.email && (<p id="email-error" className="text-sm text-red-500 dark:text-red-400 flex items-center gap-1" role="alert"><AlertCircle className="h-3 w-3" />{errors.email}</p>)}
            {duplicateInfo.email && (<p className="text-sm text-orange-600">Este correo ya está registrado</p>)}
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-sm font-medium flex items-center gap-1 text-slate-700 dark:text-slate-300">Número de Teléfono <span className="text-red-500 dark:text-red-400">*</span></Label>
            <div className="relative">
              <Input id="phone" type="tel" value={formData.phone} onChange={(e) => handleInputChange('phone', e.target.value)} placeholder="+598 99 123 456" className={cn('pr-10 transition-all duration-200 bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500', errors.phone ? 'border-red-500 focus:border-red-500 dark:border-red-400 dark:focus:border-red-400' : fieldValidations.phone?.isValid ? 'border-green-500 focus:border-green-500 dark:border-green-400 dark:focus:border-green-400' : 'focus:border-emerald-500 dark:focus:border-emerald-400')} aria-describedby={errors.phone ? 'phone-error' : undefined} aria-invalid={!!errors.phone} />
              <div className="absolute right-3 top-3">{getFieldIcon('phone')}</div>
            </div>
            {errors.phone && (<p id="phone-error" className="text-sm text-red-500 dark:text-red-400 flex items-center gap-1" role="alert"><AlertCircle className="h-3 w-3" />{errors.phone}</p>)}
            {duplicateInfo.phone && (<p className="text-sm text-orange-600">Este teléfono ya está registrado</p>)}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="whatsapp" className="text-sm font-medium text-slate-700 dark:text-slate-300">WhatsApp (opcional)</Label>
            <Input id="whatsapp" value={formData.whatsapp} onChange={(e) => handleInputChange('whatsapp', e.target.value)} placeholder="+598 99 123 456" className="transition-all duration-200 bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-500 dark:focus:border-emerald-400" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="preferredContact" className="text-sm font-medium text-slate-700 dark:text-slate-300">Método de Contacto Preferido</Label>
            <Select value={formData.preferredContact} onValueChange={(value: 'email' | 'phone' | 'whatsapp') => handleInputChange('preferredContact', value)}>
              <SelectTrigger className="transition-all duration-200 bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 focus:border-emerald-500 dark:focus:border-emerald-400">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {contactMethodOptions.map(option => (
                  <SelectItem key={option.value} value={option.value} className="hover:bg-emerald-50 dark:hover:bg-emerald-900/30">
                    <div className="flex items-center gap-2">{option.icon}<span>{option.label}</span></div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Separator className={cn('border-slate-200 dark:border-slate-700', compact ? 'my-4' : 'my-8')} />

      {/* Información Financiera */}
      <div className="space-y-6 p-6 bg-white dark:bg-slate-800 rounded-xl border border-amber-100 dark:border-amber-900/30 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
            <CreditCard className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <h3 className="text-xl font-semibold text-amber-700 dark:text-amber-300">Información Financiera</h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="creditLimit" className="text-sm font-medium text-slate-700 dark:text-slate-300">Límite de Crédito</Label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-500">$</span>
              <Input
                id="creditLimit"
                type="number"
                min="0"
                step="100"
                value={formData.creditLimit}
                onChange={(e) => handleInputChange('creditLimit', e.target.value)}
                placeholder="0.00"
                className="pl-7 transition-all duration-200 bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-amber-500 dark:focus:border-amber-400"
              />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Monto máximo de crédito permitido para este cliente</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="paymentTerms" className="text-sm font-medium text-slate-700 dark:text-slate-300">Términos de Pago</Label>
            <Select value={formData.paymentTerms} onValueChange={(value) => handleInputChange('paymentTerms', value)}>
              <SelectTrigger className="transition-all duration-200 bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 focus:border-amber-500 dark:focus:border-amber-400">
                <SelectValue placeholder="Seleccionar términos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contado">Contado</SelectItem>
                <SelectItem value="15_dias">15 Días</SelectItem>
                <SelectItem value="30_dias">30 Días</SelectItem>
                <SelectItem value="60_dias">60 Días</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Separator className={cn('border-slate-200 dark:border-slate-700', compact ? 'my-4' : 'my-8')} />

      {/* Documentación */}
      <div className="space-y-6 p-6 bg-white dark:bg-slate-800 rounded-xl border border-violet-100 dark:border-violet-900/30 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-lg"><FileText className="h-5 w-5 text-violet-600 dark:text-violet-400" /></div>
          <h3 className="text-xl font-semibold text-violet-700 dark:text-violet-300">Documentación</h3>
        </div>

        <div className={cn('grid grid-cols-1 md:grid-cols-2', compact ? 'gap-3' : 'lg:grid-cols-2 gap-4')}>
          <div className="space-y-2">
            <Label htmlFor="documentType" className="text-sm font-medium text-slate-700 dark:text-slate-300">Tipo de Documento</Label>
            <Select value={formData.documentType} onValueChange={(value: 'ci' | 'ruc' | 'pasaporte') => handleInputChange('documentType', value)}>
              <SelectTrigger className="transition-all duration-200 bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 focus:border-violet-500 dark:focus:border-violet-400">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {documentTypeOptions.map(option => (
                  <SelectItem key={option.value} value={option.value} className="hover:bg-violet-50 dark:hover:bg-violet-900/30">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="documentNumber" className="text-sm font-medium flex items-center gap-1 text-slate-700 dark:text-slate-300">
              Número de Documento <span className="text-red-500 dark:text-red-400">*</span>
            </Label>
            <div className="relative">
              <Input
                id="documentNumber"
                value={formData.documentNumber}
                onChange={(e) => handleInputChange('documentNumber', e.target.value)}
                placeholder="Ej: 12345678"
                className={cn(
                  'h-9 pr-8 text-sm transition-all duration-200 bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500',
                  errors.documentNumber ? 'border-red-500 focus:border-red-500 dark:border-red-400 dark:focus:border-red-400' :
                    fieldValidations.documentNumber?.isValid ? 'border-green-500 focus:border-green-500 dark:border-green-400 dark:focus:border-green-400' : 'focus:border-violet-500 dark:focus:border-violet-400'
                )}
                aria-describedby={errors.documentNumber ? 'documentNumber-error' : undefined}
                aria-invalid={!!errors.documentNumber}
              />
              <div className="absolute right-2 top-2">{getFieldIcon('documentNumber')}</div>
            </div>
            {errors.documentNumber && (
              <p id="documentNumber-error" className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1" role="alert">
                <AlertCircle className="h-3 w-3" />{errors.documentNumber}
              </p>
            )}
            {duplicateInfo.documentNumber && (
              <p className="text-xs text-orange-600">Este documento ya está registrado</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="address" className="text-sm font-medium flex items-center gap-1 text-slate-700 dark:text-slate-300">
            Dirección Completa <span className="text-red-500 dark:text-red-400">*</span>
          </Label>
          <div className="relative">
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => handleInputChange('address', e.target.value)}
              placeholder="Ej: Av. 18 de Julio 1234, Apto 5"
              className={cn(
                'h-9 pr-8 text-sm transition-all duration-200 bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500',
                errors.address ? 'border-red-500 focus:border-red-500 dark:border-red-400 dark:focus:border-red-400' :
                  fieldValidations.address?.isValid ? 'border-green-500 focus:border-green-500 dark:border-green-400 dark:focus:border-green-400' : 'focus:border-violet-500 dark:focus:border-violet-400'
              )}
              aria-describedby={errors.address ? 'address-error' : undefined}
              aria-invalid={!!errors.address}
            />
            <div className="absolute right-2 top-2">{getFieldIcon('address')}</div>
          </div>
          {errors.address && (
            <p id="address-error" className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1" role="alert">
              <AlertCircle className="h-3 w-3" />{errors.address}
            </p>
          )}
        </div>

        <div className={cn('grid grid-cols-1 md:grid-cols-3', compact ? 'gap-3' : 'lg:grid-cols-3 gap-4')}>
          <div className="space-y-2">
            <Label htmlFor="city" className="text-sm font-medium flex items-center gap-1 text-slate-700 dark:text-slate-300">
              Ciudad <span className="text-red-500 dark:text-red-400">*</span>
            </Label>
            <div className="relative">
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => handleInputChange('city', e.target.value)}
                placeholder="Ej: Montevideo"
                className={cn(
                  'h-9 pr-8 text-sm transition-all duration-200 bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500',
                  errors.city ? 'border-red-500 focus:border-red-500 dark:border-red-400 dark:focus:border-red-400' :
                    fieldValidations.city?.isValid ? 'border-green-500 focus:border-green-500 dark:border-green-400 dark:focus:border-green-400' : 'focus:border-violet-500 dark:focus:border-violet-400'
                )}
                aria-describedby={errors.city ? 'city-error' : undefined}
                aria-invalid={!!errors.city}
              />
              <div className="absolute right-2 top-2">{getFieldIcon('city')}</div>
            </div>
            {errors.city && (
              <p id="city-error" className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1" role="alert">
                <AlertCircle className="h-3 w-3" />{errors.city}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="postalCode" className="text-sm font-medium text-slate-700 dark:text-slate-300">Código Postal</Label>
            <Input
              id="postalCode"
              value={formData.postalCode}
              onChange={(e) => handleInputChange('postalCode', e.target.value)}
              placeholder="Ej: 12345"
              className="h-9 text-sm transition-all duration-200 bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-violet-500 dark:focus:border-violet-400"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="country" className="text-sm font-medium text-slate-700 dark:text-slate-300">País</Label>
            <Input
              id="country"
              value={formData.country}
              onChange={(e) => handleInputChange('country', e.target.value)}
              placeholder="Ej: Uruguay"
              className="h-9 text-sm transition-all duration-200 bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-violet-500 dark:focus:border-violet-400"
            />
          </div>
        </div>
      </div>

      {/* Sección adicional (colapsable en modo compacto) */}
      {compact ? (
        <Collapsible defaultOpen={false}>
          <div className="flex items-center justify-between p-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Más detalles (opcional)</span>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1 h-8 text-sm">
                Mostrar
              </Button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
            <div className="space-y-4 p-4 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-lg border border-slate-200/50 dark:border-slate-700/50 shadow-sm">
              <div className={cn('grid grid-cols-1 md:grid-cols-2', compact ? 'gap-3' : 'gap-4')}>
                <div className="space-y-1.5">
                  <Label htmlFor="notes" className="text-sm font-medium text-slate-700 dark:text-slate-300">Notas</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    placeholder="Información adicional, preferencias, etc."
                    className="min-h-[80px] text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tags" className="text-sm font-medium text-slate-700 dark:text-slate-300">Etiquetas</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      placeholder="Nueva etiqueta"
                      className="h-8 text-sm"
                    />
                    <Button type="button" variant="outline" size="sm" onClick={addTag} className="h-8 px-3 text-sm">
                      Agregar
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {formData.tags.map((tag) => (
                      <span key={tag} className="px-2 py-1 text-xs rounded border bg-slate-50 dark:bg-slate-900/40">
                        {tag}
                        <button type="button" className="ml-1 text-red-500 hover:text-red-700" onClick={() => removeTag(tag)}>
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      ) : (
        <div className="space-y-4 p-4 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-lg border border-slate-200/50 dark:border-slate-700/50 shadow-sm">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-sm font-medium text-slate-700 dark:text-slate-300">Notas</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="Información adicional, preferencias, etc."
                className="min-h-[80px] text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tags" className="text-sm font-medium text-slate-700 dark:text-slate-300">Etiquetas</Label>
              <div className="flex gap-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Nueva etiqueta"
                  className="h-8 text-sm"
                />
                <Button type="button" variant="outline" size="sm" onClick={addTag} className="h-8 px-3 text-sm">
                  Agregar
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {formData.tags.map((tag) => (
                  <span key={tag} className="px-2 py-1 text-xs rounded border bg-slate-50 dark:bg-slate-900/40">
                    {tag}
                    <button type="button" className="ml-1 text-red-500 hover:text-red-700" onClick={() => removeTag(tag)}>
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {!hideActions && (
        <div className="flex justify-end gap-2">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="h-9 px-6 bg-indigo-600 hover:bg-indigo-700 text-sm font-medium"
          >
            {isSubmitting ? 'Guardando...' : submitLabel}
          </Button>
        </div>
      )}
    </form>
  )
}