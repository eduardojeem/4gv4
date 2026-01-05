'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { User, Phone, Mail, Loader2, UserPlus, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

interface QuickCustomerModalProps {
  open: boolean
  onClose: () => void
  onCustomerCreated?: (customer: { id: string; name: string; phone: string; email: string }) => void
  onCustomerUpdated?: (customer: { id: string; name: string; phone: string; email: string }) => void
  customerToEdit?: { id: string; name: string; phone: string; email: string } | null
}

export function QuickCustomerModal({ 
  open, 
  onClose, 
  onCustomerCreated, 
  onCustomerUpdated,
  customerToEdit 
}: QuickCustomerModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: ''
  })

  // Update form data when customerToEdit changes
  useEffect(() => {
    if (open) {
      if (customerToEdit) {
        setFormData({
          name: customerToEdit.name || '',
          phone: customerToEdit.phone || '',
          email: customerToEdit.email || ''
        })
      } else {
        setFormData({
          name: '',
          phone: '',
          email: ''
        })
      }
    }
  }, [open, customerToEdit])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      toast.error('El nombre del cliente es requerido')
      return
    }

    setIsSubmitting(true)
    try {
      const supabase = createClient()
      
      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
      }

      if (customerToEdit) {
        // Update existing customer
        const { data: customerRow, error } = await supabase
          .from('customers')
          .update(payload)
          .eq('id', customerToEdit.id)
          .select('id, name, phone, email')
          .single()

        if (error) throw error

        const updatedCustomer = {
          id: customerRow.id,
          name: customerRow.name,
          phone: customerRow.phone || '',
          email: customerRow.email || ''
        }

        onCustomerUpdated?.(updatedCustomer)
        toast.success(`Cliente "${formData.name}" actualizado exitosamente`)
      } else {
        // Create new customer
        const { data: customerRow, error } = await supabase
          .from('customers')
          .insert({
            ...payload,
            customer_type: 'regular',
            status: 'active',
          })
          .select('id, name, phone, email')
          .single()

        if (error) throw error

        const newCustomer = {
          id: customerRow.id,
          name: customerRow.name,
          phone: customerRow.phone || '',
          email: customerRow.email || ''
        }

        onCustomerCreated?.(newCustomer)
        toast.success(`Cliente "${formData.name}" creado exitosamente`)
      }
      
      handleClose()
    } catch (error: any) {
      console.error('Error saving customer:', error)
      const message = error?.message || 'Error al guardar el cliente'
      
      if (message.includes('duplicate key') && message.includes('email')) {
        toast.error('Ya existe un cliente con ese email')
      } else {
        toast.error(message)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      setFormData({ name: '', phone: '', email: '' })
      onClose()
    }
  }

  const isEditing = !!customerToEdit

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Pencil className="h-5 w-5 text-primary" />
                Actualizar Cliente
              </>
            ) : (
              <>
                <UserPlus className="h-5 w-5 text-primary" />
                Crear Nuevo Cliente
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? 'Actualiza los datos del cliente seleccionado'
              : 'Ingresa los datos básicos del cliente para crearlo rápidamente'
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="customer-name" className="text-sm font-medium">
              Nombre Completo <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="customer-name"
                type="text"
                placeholder="Ej: Juan Pérez"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="pl-10 h-11"
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="customer-phone" className="text-sm font-medium">
              Teléfono <span className="text-xs text-muted-foreground">(opcional)</span>
            </Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="customer-phone"
                type="tel"
                placeholder="Ej: +595 21 123456"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                className="pl-10 h-11"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="customer-email" className="text-sm font-medium">
              Email <span className="text-xs text-muted-foreground">(opcional)</span>
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="customer-email"
                type="email"
                placeholder="Ej: juan@email.com"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="pl-10 h-11"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !formData.name.trim()}
              className="gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isEditing ? 'Actualizando...' : 'Creando...'}
                </>
              ) : (
                <>
                  {isEditing ? <Pencil className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                  {isEditing ? 'Actualizar Cliente' : 'Crear Cliente'}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}