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
        toast.success('Cliente actualizado correctamente')
        onSuccess?.(result.data)
        onClose()
      } else {
        toast.error(result.error || 'Error al actualizar cliente')
      }
    } catch (error) {
      console.error('Error updating customer:', error)
      toast.error('Error inesperado al actualizar cliente')
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