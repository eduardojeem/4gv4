'use client'

import React, { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { 
  Send, 
  User, 
  Mail, 
  MessageSquare, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Phone
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

// Validation schema
const contactSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Por favor ingresa un email válido'),
  phone: z.string().optional(),
  subject: z.string().min(5, 'El asunto debe tener al menos 5 caracteres'),
  message: z.string().min(10, 'El mensaje debe tener al menos 10 caracteres')
})

type ContactFormData = z.infer<typeof contactSchema>

interface ContactFormProps {
  recipientName: string
  recipientEmail: string
  className?: string
  onSuccess?: () => void
}

function FormField({
  name,
  label,
  type = 'text',
  placeholder,
  icon,
  register,
  error,
  required = false,
  ...props
}: {
  name: keyof ContactFormData
  label: string
  type?: string
  placeholder: string
  icon: React.ReactNode
  register: any
  error?: string
  required?: boolean
  [key: string]: any
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-2"
    >
      <Label htmlFor={name} className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        <span>{label}</span>
        {required && <span className="text-red-500">*</span>}
      </Label>
      
      <div className="relative">
        <Input
          id={name}
          type={type}
          placeholder={placeholder}
          {...register(name)}
          className={cn(
            "pl-10 pr-4 py-3 border-2 rounded-xl transition-all duration-200",
            "focus:border-primary focus:ring-4 focus:ring-primary/10",
            error 
              ? "border-red-500 bg-red-50/50 dark:bg-red-950/20" 
              : "border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-950/50"
          )}
          {...props}
        />
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          {icon}
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400"
          >
            <AlertCircle className="h-3 w-3" />
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export function ContactForm({
  recipientName,
  recipientEmail,
  className,
  onSuccess
}: ContactFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle')

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isValid }
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    mode: 'onChange'
  })

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true)
    setSubmitStatus('idle')

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Here you would typically send the email
      console.log('Contact form submitted:', {
        ...data,
        recipientEmail,
        timestamp: new Date().toISOString()
      })

      setSubmitStatus('success')
      reset()
      onSuccess?.()
      
      // Reset success message after 5 seconds
      setTimeout(() => {
        setSubmitStatus('idle')
      }, 5000)
    } catch (error) {
      setSubmitStatus('error')
      console.error('Error submitting contact form:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("space-y-6", className)}
    >
      {/* Header */}
      <div className="text-center sm:text-left">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          Contactar a {recipientName}
        </h2>
        <p className="text-muted-foreground">
          Envía un mensaje directo a {recipientName}
        </p>
      </div>

      <Card className="border-none shadow-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl p-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Form fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              name="name"
              label="Nombre completo"
              placeholder="Ej: Juan Pérez"
              icon={<User className="h-4 w-4" />}
              register={register}
              error={errors.name?.message}
              required
            />
            
            <FormField
              name="email"
              label="Correo electrónico"
              type="email"
              placeholder="ejemplo@correo.com"
              icon={<Mail className="h-4 w-4" />}
              register={register}
              error={errors.email?.message}
              required
            />
          </div>

          <FormField
            name="phone"
            label="Teléfono (opcional)"
            type="tel"
            placeholder="+595 981 123 456"
            icon={<Phone className="h-4 w-4" />}
            register={register}
            error={errors.phone?.message}
          />

          <FormField
            name="subject"
            label="Asunto"
            placeholder="¿Sobre qué quieres hablar?"
            icon={<MessageSquare className="h-4 w-4" />}
            register={register}
            error={errors.subject?.message}
            required
          />

          {/* Message field */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2"
          >
            <Label htmlFor="message" className="flex items-center gap-2 text-sm font-semibold">
              <MessageSquare className="h-4 w-4" />
              <span>Mensaje</span>
              <span className="text-red-500">*</span>
            </Label>
            
            <div className="relative">
              <Textarea
                id="message"
                placeholder="Cuéntale a {recipientName} sobre tu propuesta o consulta..."
                rows={5}
                {...register("message")}
                className={cn(
                  "pl-10 pr-4 py-3 border-2 rounded-xl transition-all duration-200 resize-none",
                  "focus:border-primary focus:ring-4 focus:ring-primary/10",
                  errors.message 
                    ? "border-red-500 bg-red-50/50 dark:bg-red-950/20" 
                    : "border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-950/50"
                )}
              />
              <div className="absolute left-3 top-3 text-slate-400">
                <MessageSquare className="h-4 w-4" />
              </div>
            </div>

            <AnimatePresence>
              {errors.message && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400"
                >
                  <AlertCircle className="h-3 w-3" />
                  {errors.message.message}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Status messages */}
          <AnimatePresence>
            {submitStatus === 'success' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-xl p-4"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <div>
                    <p className="font-semibold text-green-800 dark:text-green-300">
                      ¡Mensaje enviado con éxito!
                    </p>
                    <p className="text-sm text-green-600 dark:text-green-400">
                      {recipientName} recibirá tu mensaje pronto.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {submitStatus === 'error' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl p-4"
              >
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  <div>
                    <p className="font-semibold text-red-800 dark:text-red-300">
                      Error al enviar el mensaje
                    </p>
                    <p className="text-sm text-red-600 dark:text-red-400">
                      Por favor, inténtalo de nuevo más tarde.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit button */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-between"
          >
            <div className="text-xs text-muted-foreground">
              Los campos marcados con <span className="text-red-500">*</span> son obligatorios
            </div>
            
            <Button
              type="submit"
              disabled={isSubmitting || !isValid}
              className={cn(
                "h-12 px-8 rounded-xl font-semibold transition-all",
                "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Enviar mensaje
                </>
              )}
            </Button>
          </motion.div>
        </form>
      </Card>
    </motion.section>
  )
}