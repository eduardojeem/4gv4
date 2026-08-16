'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { User, Phone, Mail, Loader2, UserPlus, Pencil, Building2, Sparkles, CheckCircle2, Globe } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export interface QuickCustomerData {
  id: string
  name: string
  phone: string
  email: string
  ruc?: string
  customer_type?: string
  is_wholesale?: boolean
}

interface QuickCustomerModalProps {
  open: boolean
  onClose: () => void
  onCustomerCreated?: (customer: QuickCustomerData) => void
  onCustomerUpdated?: (customer: QuickCustomerData) => void
  customerToEdit?: QuickCustomerData | null
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
    email: '',
    ruc: '',
    isWholesale: false,
    sendWebInvite: false,
  })

  // Update form data when customerToEdit changes
  useEffect(() => {
    if (open) {
      if (customerToEdit) {
        const isWholesale = Boolean(
          customerToEdit.is_wholesale ||
          customerToEdit.customer_type === 'wholesale' ||
          customerToEdit.customer_type === 'mayorista'
        )
        setFormData({
          name: customerToEdit.name || '',
          phone: customerToEdit.phone || '',
          email: customerToEdit.email || '',
          ruc: customerToEdit.ruc || '',
          isWholesale,
          sendWebInvite: false,
        })
      } else {
        setFormData({
          name: '',
          phone: '',
          email: '',
          ruc: '',
          isWholesale: false,
          sendWebInvite: false,
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

    if (formData.sendWebInvite && !formData.email.trim()) {
      toast.error('Para enviar la invitación a la web se requiere ingresar un correo electrónico')
      return
    }

    setIsSubmitting(true)
    try {
      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
        ruc: formData.ruc.trim() || null,
        customer_type: formData.isWholesale ? 'wholesale' : 'regular',
        is_wholesale: formData.isWholesale,
      }

      let customerId = ''
      let customerRow: any = null

      if (customerToEdit) {
        const response = await fetch('/api/repairs/customers', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: customerToEdit.id,
            ...payload,
          }),
        })

        const body = await response.json().catch(() => null) as {
          success?: boolean
          data?: { id: string; name?: string | null; phone?: string | null; email?: string | null; ruc?: string | null; customer_type?: string | null }
          error?: string
        } | null

        if (!response.ok || !body?.success || !body.data) {
          throw new Error(body?.error || 'Error al actualizar el cliente')
        }

        customerRow = body.data
        customerId = customerRow.id

        const updatedCustomer: QuickCustomerData = {
          id: customerRow.id,
          name: customerRow.name || '',
          phone: customerRow.phone || '',
          email: customerRow.email || '',
          ruc: customerRow.ruc || '',
          customer_type: customerRow.customer_type || (formData.isWholesale ? 'wholesale' : 'regular'),
          is_wholesale: formData.isWholesale,
        }

        onCustomerUpdated?.(updatedCustomer)
        toast.success(`Cliente "${formData.name}" actualizado exitosamente`)
      } else {
        const response = await fetch('/api/repairs/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        const body = await response.json().catch(() => null) as {
          success?: boolean
          data?: { id: string; name?: string | null; phone?: string | null; email?: string | null; ruc?: string | null; customer_type?: string | null }
          error?: string
        } | null

        if (!response.ok || !body?.success || !body.data) {
          throw new Error(body?.error || 'Error al crear el cliente')
        }

        customerRow = body.data
        customerId = customerRow.id

        const newCustomer: QuickCustomerData = {
          id: customerRow.id,
          name: customerRow.name || '',
          phone: customerRow.phone || '',
          email: customerRow.email || '',
          ruc: customerRow.ruc || '',
          customer_type: customerRow.customer_type || (formData.isWholesale ? 'wholesale' : 'regular'),
          is_wholesale: formData.isWholesale,
        }

        onCustomerCreated?.(newCustomer)
        toast.success(`Cliente "${formData.name}" creado exitosamente`)
      }

      // Si se marcó enviar invitación para cuenta web pública
      if (formData.sendWebInvite && customerId && formData.email.trim()) {
        try {
          const inviteRes = await fetch(`/api/customers/${customerId}/create-account`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sendInvite: true }),
          })
          const inviteBody = await inviteRes.json().catch(() => ({}))
          if (inviteRes.ok && inviteBody.success) {
            toast.success(`Invitación al portal web enviada a ${formData.email.trim()}`)
          } else if (inviteBody.error) {
            toast.info(inviteBody.error)
          }
        } catch {
          toast.info('No se pudo enviar el correo de invitación automáticamente.')
        }
      }
      
      handleClose()
    } catch (error: unknown) {
      console.error('Error saving customer:', error)
      const message = error instanceof Error ? error.message : 'Error al guardar el cliente'
      
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
      setFormData({ name: '', phone: '', email: '', ruc: '', isWholesale: false, sendWebInvite: false })
      onClose()
    }
  }

  const isEditing = !!customerToEdit

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[490px] p-0 overflow-hidden rounded-2xl">
        <DialogHeader className="p-5 pb-3 border-b bg-white dark:bg-slate-950">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
              {isEditing ? <Pencil className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                {isEditing ? 'Actualizar Cliente' : 'Registrar Nuevo Cliente'}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {isEditing 
                  ? 'Modifica los datos del cliente, categoría y acceso web.'
                  : 'Ingresa los datos para registrar al cliente en el sistema.'
                }
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="customer-name" className="text-xs font-bold">
              Nombre Completo / Razón Social <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="customer-name"
                type="text"
                placeholder="Ej: Juan Pérez / Electro Tech S.A."
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="pl-9 h-10 text-xs font-medium"
                disabled={isSubmitting}
                required
                autoFocus
              />
            </div>
          </div>

          {/* Phone & RUC */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="customer-phone" className="text-xs font-bold">
                Teléfono / WhatsApp
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="customer-phone"
                  type="tel"
                  placeholder="Ej: 0981 123456"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className="pl-9 h-10 text-xs font-medium"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="customer-ruc" className="text-xs font-bold">
                RUC / C.I. <span className="text-[10px] text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="customer-ruc"
                  type="text"
                  placeholder="Ej: 4567890-1"
                  value={formData.ruc}
                  onChange={(e) => setFormData(prev => ({ ...prev, ruc: e.target.value }))}
                  className="pl-9 h-10 text-xs font-medium"
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="customer-email" className="text-xs font-bold">
              Correo Electrónico {formData.sendWebInvite ? <span className="text-red-500">*</span> : <span className="text-[10px] text-muted-foreground font-normal">(opcional)</span>}
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="customer-email"
                type="email"
                placeholder="cliente@ejemplo.com"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="pl-9 h-10 text-xs font-medium"
                disabled={isSubmitting}
                required={formData.sendWebInvite}
              />
            </div>
          </div>

          {/* Opciones de Acceso: Mayorista e Invitación Web */}
          <div className="grid grid-cols-1 gap-2 pt-1">
            {/* Opción Habilitar como Mayorista */}
            <div
              onClick={() => setFormData(prev => ({ ...prev, isWholesale: !prev.isWholesale }))}
              className={cn(
                "p-3 rounded-xl border transition-all cursor-pointer select-none",
                formData.isWholesale
                  ? "border-violet-400 bg-violet-50/60 dark:border-violet-700 dark:bg-violet-950/30"
                  : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 hover:border-slate-300 dark:hover:border-slate-700"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-lg transition-colors shrink-0",
                    formData.isWholesale
                      ? "bg-violet-600 text-white"
                      : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                  )}>
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        Cliente Mayorista
                      </p>
                      {formData.isWholesale && (
                        <Badge className="bg-violet-600 text-white text-[9px] py-0 px-1 font-bold">
                          Tarifa Especial
                        </Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">
                      Aplica precios mayoristas automáticos en repuestos y servicios.
                    </p>
                  </div>
                </div>
                <div className={cn(
                  "h-4.5 w-4.5 rounded-md border flex items-center justify-center shrink-0 transition-colors",
                  formData.isWholesale
                    ? "bg-violet-600 border-violet-600 text-white"
                    : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                )}>
                  {formData.isWholesale && <CheckCircle2 className="h-3.5 w-3.5" />}
                </div>
              </div>
            </div>

            {/* Opción Enviar Invitación al Portal Web Público */}
            <div
              onClick={() => setFormData(prev => ({ ...prev, sendWebInvite: !prev.sendWebInvite }))}
              className={cn(
                "p-3 rounded-xl border transition-all cursor-pointer select-none",
                formData.sendWebInvite
                  ? "border-cyan-500 bg-cyan-50/60 dark:border-cyan-700 dark:bg-cyan-950/30"
                  : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 hover:border-slate-300 dark:hover:border-slate-700"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-lg transition-colors shrink-0",
                    formData.sendWebInvite
                      ? "bg-cyan-600 text-white"
                      : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                  )}>
                    <Globe className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        Invitar a la Web Pública
                      </p>
                      {formData.sendWebInvite && (
                        <Badge className="bg-cyan-600 text-white text-[9px] py-0 px-1 font-bold">
                          Portal Web
                        </Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">
                      Envía un email para que el cliente cree su contraseña y consulte sus órdenes.
                    </p>
                  </div>
                </div>
                <div className={cn(
                  "h-4.5 w-4.5 rounded-md border flex items-center justify-center shrink-0 transition-colors",
                  formData.sendWebInvite
                    ? "bg-cyan-600 border-cyan-600 text-white"
                    : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                )}>
                  {formData.sendWebInvite && <CheckCircle2 className="h-3.5 w-3.5" />}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
              className="h-9 text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !formData.name.trim()}
              className="gap-2 h-9 text-xs font-bold bg-cyan-600 hover:bg-cyan-700 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isEditing ? 'Actualizando...' : 'Creando...'}
                </>
              ) : (
                <>
                  {isEditing ? <Pencil className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                  {isEditing ? 'Actualizar Cliente' : 'Guardar Cliente'}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
