'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Loader2, Search } from 'lucide-react'
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

const searchSchema = z.object({
  ticketNumber: z.string().min(1, 'El número de ticket es requerido'),
  contact: z.string().min(1, 'El email o teléfono es requerido'),
})

type SearchFormValues = z.infer<typeof searchSchema>

export function RepairSearchForm() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const { executeRecaptcha } = useRecaptcha()

  const form = useForm<SearchFormValues>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      ticketNumber: '',
      contact: '',
    },
  })

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
  )
}
