'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createSupabaseClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Save, X } from 'lucide-react'
import type { Customer } from '@/hooks/use-customers'

const customerSchema = z.object({
    first_name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
    last_name: z.string().min(2, 'El apellido debe tener al menos 2 caracteres'),
    phone: z.string().min(8, 'El teléfono debe tener al menos 8 dígitos'),
    email: z.string().email('Email inválido').optional().or(z.literal('')),
})

type CustomerFormData = z.infer<typeof customerSchema>

interface CustomerQuickCreateDialogProps {
    open: boolean
    onClose: () => void
    onCreated: (customerId: string, customerData: Customer) => void
}

export function CustomerQuickCreateDialog({
    open,
    onClose,
    onCreated,
}: CustomerQuickCreateDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false)

    const {
        register,
        handleSubmit,
        formState: { errors },
        reset,
    } = useForm<CustomerFormData>({
        resolver: zodResolver(customerSchema),
    })

    const onSubmit = async (data: CustomerFormData) => {
        setIsSubmitting(true)
        try {
            const supabase = createSupabaseClient()

            const { data: customerRow, error } = await supabase
                .from('customers')
                .insert({
                    name: `${data.first_name} ${data.last_name}`.trim(),
                    phone: data.phone,
                    email: data.email || null,
                    customer_type: 'regular',
                    status: 'active',
                })
                .select('id, name, phone, email, customer_type, status, created_at')
                .single()

            if (error) throw error

            toast.success('Cliente creado exitosamente')
            const parts = String(customerRow.name || '').trim().split(/\s+/)
            const created: Customer = {
                id: customerRow.id,
                first_name: parts[0] || '',
                last_name: parts.slice(1).join(' ') || '',
                phone: customerRow.phone || '',
                email: customerRow.email || '',
                customer_type: customerRow.customer_type || 'regular',
                status: customerRow.status || 'active',
                created_at: customerRow.created_at
            }
            onCreated(customerRow.id, created)
            reset()
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error)
            console.error('Error creating customer:', message)
            toast.error(message || 'Error al crear el cliente')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleClose = () => {
        if (!isSubmitting) {
            reset()
            onClose()
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Crear Nuevo Cliente</DialogTitle>
                    <DialogDescription>
                        Ingresa los datos del nuevo cliente. Los campos marcados con * son obligatorios.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        {/* First Name */}
                        <div className="space-y-2">
                            <Label htmlFor="first_name">
                                Nombre <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="first_name"
                                {...register('first_name')}
                                placeholder="Juan"
                                className={errors.first_name ? 'border-red-500' : ''}
                                disabled={isSubmitting}
                            />
                            {errors.first_name && (
                                <p className="text-sm text-red-500">{errors.first_name.message}</p>
                            )}
                        </div>

                        {/* Last Name */}
                        <div className="space-y-2">
                            <Label htmlFor="last_name">
                                Apellido <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="last_name"
                                {...register('last_name')}
                                placeholder="Pérez"
                                className={errors.last_name ? 'border-red-500' : ''}
                                disabled={isSubmitting}
                            />
                            {errors.last_name && (
                                <p className="text-sm text-red-500">{errors.last_name.message}</p>
                            )}
                        </div>
                    </div>

                    {/* Phone */}
                    <div className="space-y-2">
                        <Label htmlFor="phone">
                            Teléfono <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="phone"
                            {...register('phone')}
                            placeholder="+1234567890"
                            className={errors.phone ? 'border-red-500' : ''}
                            disabled={isSubmitting}
                        />
                        {errors.phone && (
                            <p className="text-sm text-red-500">{errors.phone.message}</p>
                        )}
                    </div>

                    {/* Email */}
                    <div className="space-y-2">
                        <Label htmlFor="email">Email (opcional)</Label>
                        <Input
                            id="email"
                            type="email"
                            {...register('email')}
                            placeholder="email@ejemplo.com"
                            className={errors.email ? 'border-red-500' : ''}
                            disabled={isSubmitting}
                        />
                        {errors.email && (
                            <p className="text-sm text-red-500">{errors.email.message}</p>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleClose}
                            disabled={isSubmitting}
                        >
                            <X className="mr-2 h-4 w-4" />
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creando...
                                </>
                            ) : (
                                <>
                                    <Save className="mr-2 h-4 w-4" />
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
