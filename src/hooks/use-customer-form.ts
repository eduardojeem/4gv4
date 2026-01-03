/**
 * useCustomerForm - Hook personalizado para el formulario de edición de clientes
 * 
 * Maneja el estado del formulario, validaciones, auto-guardado y navegación por pasos
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { 
  validateFormStep, 
  calculateFormProgress, 
  shouldAutoSave,
  transformFormDataToCustomer 
} from '@/lib/customer-form-utils'
import { Customer } from '@/hooks/use-customer-state'

// Form schema
const customerFormSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  phone: z.string().min(10, 'Teléfono debe tener al menos 10 dígitos'),
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
  birthday: z.date().optional(),
  notifications: z.object({
    email_marketing: z.boolean(),
    sms_notifications: z.boolean(),
    whatsapp_updates: z.boolean(),
    birthday_reminders: z.boolean(),
  }).optional(),
  privacy: z.object({
    data_sharing: z.boolean(),
    analytics_tracking: z.boolean(),
    marketing_consent: z.boolean(),
  }).optional()
})

type CustomerFormData = z.infer<typeof customerFormSchema>

interface UseCustomerFormOptions {
  customer: Customer
  onSave: (data: CustomerFormData) => Promise<void>
  autoSaveEnabled?: boolean
  autoSaveDelay?: number
}

const FORM_STEPS = [
  { id: 'basic', title: 'Información Básica' },
  { id: 'contact', title: 'Ubicación y Empresa' },
  { id: 'classification', title: 'Clasificación' },
  { id: 'financial', title: 'Configuración Financiera' },
  { id: 'preferences', title: 'Preferencias' },
  { id: 'additional', title: 'Información Adicional' }
]

export function useCustomerForm({
  customer,
  onSave,
  autoSaveEnabled = false,
  autoSaveDelay = 3000
}: UseCustomerFormOptions) {
  // Form state
  const [currentStep, setCurrentStep] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [autoSaveInProgress, setAutoSaveInProgress] = useState(false)
  const [stepValidation, setStepValidation] = useState<Record<string, boolean>>({})
  
  // Refs
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout>()
  const lastSavedDataRef = useRef<CustomerFormData | null>(null)

  // Form setup
  const form = useForm<CustomerFormData>({
    resolver: zodResolver(customerFormSchema),
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
      segment: customer.segment as any || 'regular',
      status: customer.status || 'active',
      credit_limit: customer.credit_limit || 0,
      discount_percentage: customer.discount_percentage || 0,
      payment_terms: customer.payment_terms || 'Contado',
      preferred_contact: customer.preferred_contact as any || 'email',
      tags: customer.tags || [],
      notes: customer.notes || '',
      birthday: customer.birthday ? new Date(customer.birthday) : undefined,
      notifications: {
        email_marketing: true,
        sms_notifications: true,
        whatsapp_updates: true,
        birthday_reminders: true,
      },
      privacy: {
        data_sharing: false,
        analytics_tracking: true,
        marketing_consent: true,
      }
    },
    mode: 'onChange'
  })

  // Watch form values
  const formValues = form.watch()

  // Calculate progress
  const progress = calculateFormProgress(formValues)

  // Validate current step
  const validateCurrentStep = useCallback(() => {
    const currentStepId = FORM_STEPS[currentStep].id
    const validation = validateFormStep(currentStepId, formValues)
    
    setStepValidation(prev => ({
      ...prev,
      [currentStepId]: validation.isValid
    }))
    
    return validation
  }, [currentStep, formValues])

  // Auto-save functionality
  const performAutoSave = useCallback(async () => {
    if (!autoSaveEnabled || !hasUnsavedChanges) return
    
    try {
      setAutoSaveInProgress(true)
      const transformedData = transformFormDataToCustomer(formValues)
      await onSave(transformedData)
      
      setLastSaved(new Date())
      setHasUnsavedChanges(false)
      lastSavedDataRef.current = formValues
      
      toast.success('Cambios guardados automáticamente', {
        duration: 2000,
        position: 'bottom-right'
      })
    } catch (error) {
      toast.error('Error al guardar automáticamente')
    } finally {
      setAutoSaveInProgress(false)
    }
  }, [autoSaveEnabled, hasUnsavedChanges, formValues, onSave])

  // Track changes for auto-save
  useEffect(() => {
    if (shouldAutoSave(formValues, lastSavedDataRef.current)) {
      setHasUnsavedChanges(true)
      
      if (autoSaveEnabled) {
        // Clear existing timeout
        if (autoSaveTimeoutRef.current) {
          clearTimeout(autoSaveTimeoutRef.current)
        }
        
        // Set new timeout
        autoSaveTimeoutRef.current = setTimeout(performAutoSave, autoSaveDelay)
      }
    }
    
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [formValues, autoSaveEnabled, autoSaveDelay, performAutoSave])

  // Validate current step on change
  useEffect(() => {
    validateCurrentStep()
  }, [validateCurrentStep])

  // Navigation functions
  const nextStep = useCallback(() => {
    const validation = validateCurrentStep()
    
    if (!validation.isValid) {
      validation.errors.forEach(error => {
        toast.error(error)
      })
      return false
    }
    
    if (currentStep < FORM_STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
      return true
    }
    
    return false
  }, [currentStep, validateCurrentStep])

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
      return true
    }
    return false
  }, [currentStep])

  const goToStep = useCallback((step: number) => {
    if (step >= 0 && step < FORM_STEPS.length) {
      setCurrentStep(step)
      return true
    }
    return false
  }, [])

  // Form submission
  const handleSubmit = useCallback(async (data: CustomerFormData) => {
    setIsSubmitting(true)
    
    try {
      const transformedData = transformFormDataToCustomer(data)
      await onSave(transformedData)
      
      setHasUnsavedChanges(false)
      setLastSaved(new Date())
      lastSavedDataRef.current = data
      
      toast.success('Cliente actualizado exitosamente')
      return true
    } catch (error) {
      toast.error('Error al actualizar cliente')
      return false
    } finally {
      setIsSubmitting(false)
    }
  }, [onSave])

  // Reset form
  const resetForm = useCallback(() => {
    form.reset()
    setCurrentStep(0)
    setHasUnsavedChanges(false)
    setLastSaved(null)
    setStepValidation({})
    lastSavedDataRef.current = null
  }, [form])

  // Check if can proceed to next step
  const canProceedToNext = stepValidation[FORM_STEPS[currentStep]?.id] !== false

  // Check if step is completed
  const isStepCompleted = useCallback((stepIndex: number) => {
    const stepId = FORM_STEPS[stepIndex]?.id
    return stepValidation[stepId] === true
  }, [stepValidation])

  return {
    // Form instance
    form,
    
    // State
    currentStep,
    isSubmitting,
    hasUnsavedChanges,
    lastSaved,
    autoSaveInProgress,
    progress,
    
    // Navigation
    nextStep,
    prevStep,
    goToStep,
    canProceedToNext,
    isStepCompleted,
    
    // Actions
    handleSubmit: form.handleSubmit(handleSubmit),
    resetForm,
    validateCurrentStep,
    
    // Data
    formValues,
    steps: FORM_STEPS,
    
    // Validation
    stepValidation,
    
    // Utils
    performAutoSave
  }
}