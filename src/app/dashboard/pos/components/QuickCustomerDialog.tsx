'use client'

import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UserPlus, Loader2, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Customer } from '../types'

interface QuickCustomerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCustomerCreated: (customer: Customer) => void
}

export function QuickCustomerDialog({
  open,
  onOpenChange,
  onCustomerCreated
}: QuickCustomerDialogProps) {
  const supabase = React.useMemo(() => createClient(), [])
  const [name, setName] = useState('')
  const [idNumber, setIdNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('El nombre del cliente es obligatorio')
      return
    }

    setLoading(true)
    try {
      const { data: orgData } = await supabase.auth.getUser()
      
      const payload: any = {
        name: name.trim(),
        document_id: idNumber.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        created_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('customers')
        .insert([payload])
        .select()
        .single()

      if (error) throw error

      toast.success('Cliente creado y asignado', {
        description: `${data.name} ya está seleccionado para esta venta.`
      })

      onCustomerCreated(data as Customer)
      setName('')
      setIdNumber('')
      setPhone('')
      setEmail('')
      onOpenChange(false)
    } catch (err: any) {
      console.error('Error creating customer from POS', err)
      toast.error('No se pudo crear el cliente', {
        description: err.message || 'Verifica los datos ingresados.'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Alta Rápida de Cliente</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Registra un nuevo cliente en segundos sin salir de la caja
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cust_name" className="text-xs font-semibold">
              Nombre / Razón Social <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="cust_name"
              placeholder="Ej: Juan Pérez o Empresa S.A."
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cust_id" className="text-xs font-medium">
                CI / RUC
              </Label>
              <Input
                id="cust_id"
                placeholder="Ej: 4.567.890 o 80012345-6"
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cust_phone" className="text-xs font-medium">
                Teléfono / WhatsApp
              </Label>
              <Input
                id="cust_phone"
                placeholder="Ej: 0981 123456"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cust_email" className="text-xs font-medium">
              Email (opcional)
            </Label>
            <Input
              id="cust_email"
              type="email"
              placeholder="cliente@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
              disabled={loading || !name.trim()}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Crear y Asignar
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
