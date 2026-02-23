'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Loader2, Search, ShieldCheck, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { toast } from 'sonner'
import { RecaptchaProvider } from '@/components/public/RecaptchaProvider'
import { useRecaptcha } from '@/hooks/use-recaptcha'
import { cn } from '@/lib/utils'

const searchSchema = z.object({
  ticketNumber: z.string().min(1, 'El número de ticket es requerido'),
  contact: z.string().min(1, 'El email o teléfono es requerido'),
})

type SearchFormValues = z.infer<typeof searchSchema>

export function RepairSearchForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [qrVerified, setQrVerified] = useState<boolean | null>(null)
  const [verifying, setVerifying] = useState(false)
  const { executeRecaptcha } = useRecaptcha()

  const form = useForm<SearchFormValues>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      ticketNumber: '',
      contact: '',
    },
  })

  // Detectar parámetros del QR y redirigir al nuevo formato
  useEffect(() => {
    const ticketFromQR = searchParams.get('ticket')
    const verifyHash = searchParams.get('verify')
    
    if (ticketFromQR && verifyHash) {
      // Redirigir automáticamente a la página de detalle con el hash de verificación
      // Esto da soporte a los códigos QR antiguos que apuntaban a esta página
      toast.info('Redirigiendo a los detalles de la reparación...')
      router.replace(`/mis-reparaciones/${ticketFromQR}?verify=${verifyHash}`)
    }
  }, [searchParams, router])

  async function onSubmit(data: SearchFormValues) {
    setIsLoading(true)
    try {
      // Get reCAPTCHA token
      let recaptchaToken = ''
      try {
        recaptchaToken = await executeRecaptcha('repair_search')
      } catch (e) {
        console.error('Recaptcha error:', e)
        // Continue without token (backend might allow it or fail gracefully)
      }
      
      const response = await fetch('/api/public/repairs/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          recaptchaToken
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Error al consultar reparación')
      }

      toast.success('Ticket verificado correctamente')
      router.push(`/mis-reparaciones/${data.ticketNumber}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error desconocido')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* QR Verification Badge */}
      {qrVerified !== null && (
        <div className={cn(
          'rounded-xl border p-4 flex items-center gap-3',
          qrVerified 
            ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900'
            : 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900'
        )}>
          {qrVerified ? (
            <>
              <ShieldCheck className="h-6 w-6 text-green-600 shrink-0" />
              <div>
                <p className="font-semibold text-green-900 dark:text-green-100">Comprobante Verificado</p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Este es un comprobante auténtico. Ingresa tu contacto para ver el estado.
                </p>
              </div>
            </>
          ) : (
            <>
              <ShieldAlert className="h-6 w-6 text-red-600 shrink-0" />
              <div>
                <p className="font-semibold text-red-900 dark:text-red-100">Verificación Fallida</p>
                <p className="text-sm text-red-700 dark:text-red-300">
                  No se pudo verificar la autenticidad de este comprobante
                </p>
              </div>
            </>
          )}
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="ticketNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número de Ticket</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: 10234" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="contact"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email o Teléfono</FormLabel>
                  <FormControl>
                    <Input placeholder="Registrado en la orden" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verificando...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Consultar Estado
              </>
            )}
          </Button>
        </form>
      </Form>
    </div>
  )
}
