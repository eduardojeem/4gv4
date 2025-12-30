'use client'

import React, { useState } from 'react'
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
import { User, Phone, Mail, Loader2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

interface QuickCustomerModalProps {
  open: boolean
  onClose: () => void
  onCustomerCreated: (customer: { id: string; name: string; phone: string; email: string }) => void
}

export function QuickCustomerModal({ open, onClose, onCustomerCreated }: QuickCustomerModalProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      toast.error('El nombre del cliente es requerido')
      return
    }

    setIsCreating(true)
    try {
      const supabase = createClient()
      
      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
        customer_type: 'regular',
        status: 'active',
      }

      const { data: customerRow, error } = await supabase
        .from('customers')
        .insert(payload)
        .select('id, name, phone, email')
        .single()

      if (error) throw error

      const newCustomer = {
        id: customerRow.id,
        name: customerRow.name,
        phone: customerRow.phone || '',
        email: customerRow.email || ''
      }

      onCustomerCreated(newCustomer)
      toast.success(`Cliente "${formData.name}" creado exitosamente`)
      
      // Reset form and close modal
      setFormData({ name: '', phone: '', email: '' })
      onClose()
    } catch (error: any) {
      console.error('Error creating customer:', error)
      const message = error?.message || 'Error al crear el cliente'
      
      if (message.includes('duplicate key') && message.includes('email')) {
        toast.error('Ya existe un cliente con ese email')
      } else {
        toast.error(message)
      }
    } finally {
      setIsCreating(false)
    }
  }

  const handleClose = () => {
    if (!isCreating) {
      setFormData({ name: '', phone: '', email: '' })
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Crear Nuevo Cliente
          </DialogTitle>
          <DialogDescription>
            Ingresa los datos básicos del cliente para crearlo rápidamente
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
                disabled={isCreating}
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
                disabled={isCreating}
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
                disabled={isCreating}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isCreating}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isCreating || !formData.name.trim()}
              className="gap-2"
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  Crear Cliente
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}