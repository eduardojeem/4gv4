'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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

const searchSchema = z.object({
  ticketNumber: z.string().min(1, 'El numero de ticket es requerido'),
  contact: z.string().min(1, 'El email o telefono es requerido'),
})

type SearchFormValues = z.infer<typeof searchSchema>

export function RepairSearchForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const hasPrefilledFromQr = useRef(false)

  const form = useForm<SearchFormValues>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      ticketNumber: '',
      contact: '',
    },
  })

  // Compatibilidad con QR antiguo: /mis-reparaciones?ticket=...&verify=...
  useEffect(() => {
    const ticketFromQR = searchParams.get('ticket')
    const verifyHash = searchParams.get('verify')

    if (ticketFromQR && verifyHash) {
      toast.info('Redirigiendo a los detalles de la reparacion...')
      router.replace(`/mis-reparaciones/${encodeURIComponent(ticketFromQR)}?verify=${encodeURIComponent(verifyHash)}`)
      return
    }

    if (ticketFromQR && !hasPrefilledFromQr.current) {
      form.setValue('ticketNumber', ticketFromQR.trim().toUpperCase())
      toast.info('Ticket detectado desde QR. Completa tu contacto para continuar.')
      hasPrefilledFromQr.current = true
    }
  }, [searchParams, router, form])

  async function onSubmit(data: SearchFormValues) {
    setIsLoading(true)
    try {
      const normalizedTicketNumber = data.ticketNumber.trim().toUpperCase()

      const response = await fetch('/api/public/repairs/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          ticketNumber: normalizedTicketNumber,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Error al consultar reparacion')
      }

      toast.success('Ticket verificado correctamente')
      const resolvedTicket = result?.data?.repair?.ticketNumber || normalizedTicketNumber
      router.push(`/mis-reparaciones/${encodeURIComponent(resolvedTicket)}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error desconocido')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="ticketNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Numero de Ticket</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: R-2026-00042" {...field} />
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
                  <FormLabel>Email o Telefono</FormLabel>
                  <FormControl>
                    <Input placeholder="Registrado en la orden" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            Si llegaste desde un QR, completa tu contacto para validar el acceso.
          </p>

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
