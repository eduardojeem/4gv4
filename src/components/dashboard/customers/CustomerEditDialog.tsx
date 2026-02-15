'use client'

/**
 * CustomerEditDialog - Dialog wrapper para el formulario de edición mejorado
 * 
 * Integra el CustomerEditFormV2 con el sistema de modales existente
 * y maneja la comunicación con el contexto de clientes.
 */

import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CustomerEditFormV2 } from './CustomerEditFormV2'
import { Customer } from '@/hooks/use-customer-state'
import { useCustomerActions } from '@/hooks/use-customer-actions'
import { toast } from 'sonner'
import { mutate as globalMutate } from 'swr'

// Simple VisuallyHidden component for accessibility
const VisuallyHidden = ({ children }: { children: React.ReactNode }) => (
  <div className="sr-only">
    {children}
  </div>
)

interface CustomerEditDialogProps {
  customer: Customer | null
  isOpen: boolean
  onClose: () => void
  onSuccess?: (customer: Customer) => void
}

export function CustomerEditDialog({
  customer,
  isOpen,
  onClose,
  onSuccess
}: CustomerEditDialogProps) {
  const { updateCustomer } = useCustomerActions()
  const [saveError, setSaveError] = React.useState<string | null>(null)

  const handleSave = async (formData: any) => {
    if (!customer) return

    try {
      // Mapear los datos del formulario al formato esperado por el servicio
      const updateData = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        whatsapp: formData.whatsapp,
        address: formData.address,
        city: formData.city,
        company: formData.company,
        position: formData.position,
        ruc: formData.ruc,
        customer_type: formData.customer_type,
        segment: formData.segment,
        status: formData.status,
        credit_limit: formData.credit_limit,
        discount_percentage: formData.discount_percentage,
        payment_terms: formData.payment_terms,
        preferred_contact: formData.preferred_contact,
        tags: formData.tags,
        notes: formData.notes,
        birthday: formData.birthday,
      }

      const result = await updateCustomer(customer.id, updateData)
      
      if (result.success) {
        const updated = (result as any).data || (result as any).customer || customer
        // Actualizar caché de SWR para la ficha del cliente
        await globalMutate(['customer', String(customer.id)], updated, false)
        // Opcional: actualizar listas y filtros si existen
        await globalMutate((key: any) => Array.isArray(key) && key[0] === 'customers', undefined, true)

        toast.success('Cliente actualizado correctamente')
        setSaveError(null)
        onSuccess?.(updated as any)
        onClose()
      } else {
        const msg = typeof (result as any).error === 'string'
          ? (result as any).error
          : ((result as any).error?.message || 'Error al actualizar cliente')
        setSaveError(msg)
        toast.error(msg)
      }
    } catch (error) {
      console.error('Error updating customer:', error)
      const msg = (error as any)?.message || 'Error inesperado al actualizar cliente'
      setSaveError(msg)
      toast.error(msg)
    }
  }

  if (!customer) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-none w-[95vw] h-[95vh] p-0 bg-transparent border-0 shadow-none">
        <VisuallyHidden>
          <DialogHeader>
            <DialogTitle>
              Editar Cliente: {customer.name}
            </DialogTitle>
          </DialogHeader>
        </VisuallyHidden>
        <div className="w-full h-full">
          {saveError && (
            <div className="mx-6 mt-4 p-3 border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 rounded-md text-sm">
              {saveError}
            </div>
          )}
          <CustomerEditFormV2
            customer={customer}
            onSave={handleSave}
            onCancel={onClose}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
