'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
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
import { Badge } from '@/components/ui/badge'
import { Loader2, Save, X, UserPlus, Sparkles, CheckCircle2, Building2, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Customer } from '@/hooks/use-customers'
import { validateCustomerContact, normalizePhone, MIN_PHONE_DIGITS, ALTERNATE_PHONE_LABELS } from '@/lib/customers/contact-rules'

// El apellido deja de ser obligatorio: una empresa no tiene, y exigirlo obligaba
// a inventar uno para poder cargarla. El telefono si, y ademas se admite un
// contacto alternativo porque el celular del cliente suele ser el equipo que
// dejo en el taller.
const customerSchema = z
    .object({
        first_name: z.string().min(2, 'El nombre o razón social debe tener al menos 2 caracteres'),
        last_name: z.string().optional().or(z.literal('')),
        phone: z.string().min(MIN_PHONE_DIGITS, `El teléfono debe tener al menos ${MIN_PHONE_DIGITS} dígitos`),
        alternate_phone: z.string().optional().or(z.literal('')),
        alternate_phone_label: z.string().optional().or(z.literal('')),
        email: z.string().email('Email inválido').optional().or(z.literal('')),
        ruc: z.string().optional().or(z.literal('')),
        is_wholesale: z.boolean().optional(),
    })
    .superRefine((data, ctx) => {
        const errors = validateCustomerContact({
            name: data.first_name,
            phone: data.phone,
            email: data.email,
            alternatePhone: data.alternate_phone,
            alternatePhoneLabel: data.alternate_phone_label,
        })

        if (errors.alternatePhone) {
            ctx.addIssue({ code: 'custom', path: ['alternate_phone'], message: errors.alternatePhone })
        }
        if (errors.alternatePhoneLabel) {
            ctx.addIssue({ code: 'custom', path: ['alternate_phone_label'], message: errors.alternatePhoneLabel })
        }
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
    const [isWholesale, setIsWholesale] = useState(false)
    const [sendWebInvite, setSendWebInvite] = useState(false)

    const {
        register,
        handleSubmit,
        watch,
        formState: { errors },
        reset,
    } = useForm<CustomerFormData>({
        resolver: zodResolver(customerSchema),
        defaultValues: {
            first_name: '',
            last_name: '',
            phone: '',
            alternate_phone: '',
            alternate_phone_label: '',
            email: '',
            ruc: '',
            is_wholesale: false,
        }
    })

    const onSubmit = async (data: CustomerFormData) => {
        if (sendWebInvite && !data.email?.trim()) {
            toast.error('Para enviar la invitación a la web se requiere ingresar un correo electrónico')
            return
        }

        setIsSubmitting(true)
        try {
            const response = await fetch('/api/repairs/customers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: `${data.first_name} ${data.last_name || ''}`.trim(),
                    phone: normalizePhone(data.phone),
                    alternate_phone: data.alternate_phone ? normalizePhone(data.alternate_phone) : null,
                    alternate_phone_label: data.alternate_phone?.trim() ? (data.alternate_phone_label || null) : null,
                    email: data.email || null,
                    ruc: data.ruc || null,
                    customer_type: isWholesale ? 'wholesale' : 'regular',
                    is_wholesale: isWholesale,
                }),
            })

            const payload = await response.json().catch(() => null) as {
                success?: boolean
                data?: {
                    id: string
                    customer_code?: string | null
                    name?: string | null
                    phone?: string | null
                    email?: string | null
                    ruc?: string | null
                    customer_type?: string | null
                    status?: string | null
                    created_at?: string | null
                }
                error?: string
            } | null

            if (!response.ok || !payload?.success || !payload.data) {
                throw new Error(payload?.error || 'Error al crear el cliente')
            }

            const customerRow = payload.data

            toast.success('Cliente creado exitosamente')

            // Enviar invitación para el portal de clientes
            if (sendWebInvite && customerRow.id && data.email?.trim()) {
                try {
                    const inviteRes = await fetch(`/api/customers/${customerRow.id}/create-account`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sendInvite: true }),
                    })
                    const inviteBody = await inviteRes.json().catch(() => ({}))
                    if (inviteRes.ok && inviteBody.success) {
                        toast.success(`Invitación al portal web enviada a ${data.email.trim()}`)
                    } else if (inviteBody.error) {
                        toast.info(inviteBody.error)
                    }
                } catch {
                    toast.info('No se pudo enviar el correo de invitación automáticamente.')
                }
            }

            const parts = String(customerRow.name || '').trim().split(/\s+/)
            const created: Customer = {
                id: customerRow.id,
                customerCode: customerRow.customer_code || `CLI-${String(customerRow.id).slice(0, 6)}`,
                name: String(customerRow.name || '').trim() || [parts[0], parts.slice(1).join(' ')].filter(Boolean).join(' ').trim(),
                phone: customerRow.phone || '',
                email: customerRow.email || '',
                ruc: customerRow.ruc || '',
                customer_type: (customerRow.customer_type as Customer['customer_type']) || (isWholesale ? 'wholesale' : 'regular'),
                status: (customerRow.status as Customer['status']) || 'active',
                total_purchases: 0,
                total_repairs: 0,
                registration_date: customerRow.created_at || new Date().toISOString(),
                created_at: customerRow.created_at || new Date().toISOString(),
                last_visit: customerRow.created_at || new Date().toISOString(),
                last_activity: customerRow.created_at || new Date().toISOString(),
                address: '',
                city: '',
                credit_score: 0,
                segment: isWholesale ? 'wholesale' : 'regular',
                satisfaction_score: 0,
                lifetime_value: 0,
                avg_order_value: 0,
                purchase_frequency: 'low',
                preferred_contact: 'email',
                birthday: '',
                loyalty_points: 0,
                credit_limit: 0,
                current_balance: 0,
                pending_amount: 0,
                notes: '',
                tags: [],
                referral_source: '',
                discount_percentage: 0,
                payment_terms: 'Contado',
                assigned_salesperson: 'Sin asignar',
                last_purchase_amount: 0,
                total_spent_this_year: 0
            }
            onCreated(customerRow.id, created)
            reset()
            setIsWholesale(false)
            setSendWebInvite(false)
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
            setIsWholesale(false)
            setSendWebInvite(false)
            onClose()
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[490px] p-0 overflow-hidden rounded-2xl">
                <DialogHeader className="p-5 pb-3 border-b bg-white dark:bg-slate-950">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                            <UserPlus className="h-5 w-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-lg font-bold">Crear Nuevo Cliente</DialogTitle>
                            <DialogDescription className="text-xs">
                                Ingresa los datos básicos para registrar al cliente en el sistema.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-3.5">
                    <div className="grid grid-cols-2 gap-3">
                        {/* First Name */}
                        <div className="space-y-1.5">
                            <Label htmlFor="first_name" className="text-xs font-bold">
                                Nombre o razón social <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="first_name"
                                {...register('first_name')}
                                placeholder="Juan"
                                className={cn("h-10 text-xs font-medium", errors.first_name && 'border-red-500')}
                                disabled={isSubmitting}
                                autoFocus
                            />
                            {errors.first_name && (
                                <p className="text-[11px] text-red-500">{errors.first_name.message}</p>
                            )}
                        </div>

                        {/* Last Name */}
                        <div className="space-y-1.5">
                            <Label htmlFor="last_name" className="text-xs font-bold">
                                Apellido <span className="text-[10px] text-muted-foreground font-normal">(opcional)</span>
                            </Label>
                            <Input
                                id="last_name"
                                {...register('last_name')}
                                placeholder="Pérez"
                                className={cn("h-10 text-xs font-medium", errors.last_name && 'border-red-500')}
                                disabled={isSubmitting}
                            />
                            {errors.last_name && (
                                <p className="text-[11px] text-red-500">{errors.last_name.message}</p>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Phone */}
                        <div className="space-y-1.5">
                            <Label htmlFor="phone" className="text-xs font-bold">
                                Teléfono <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="phone"
                                {...register('phone')}
                                placeholder="0981 123456"
                                className={cn("h-10 text-xs font-medium", errors.phone && 'border-red-500')}
                                disabled={isSubmitting}
                            />
                            {errors.phone && (
                                <p className="text-[11px] text-red-500">{errors.phone.message}</p>
                            )}
                        </div>

                        {/* Contacto alternativo: el celular del cliente suele ser
                            el equipo que acaba de dejar en el taller. */}
                        <div className="space-y-1.5">
                            <Label htmlFor="alternate_phone" className="text-xs font-bold">
                                Otro teléfono para avisarle{' '}
                                <span className="text-[10px] text-muted-foreground font-normal">(opcional)</span>
                            </Label>
                            <Input
                                id="alternate_phone"
                                {...register('alternate_phone')}
                                placeholder="Si deja su celular acá"
                                className={cn("h-10 text-xs font-medium", errors.alternate_phone && 'border-red-500')}
                                disabled={isSubmitting}
                            />
                            {errors.alternate_phone && (
                                <p className="text-[11px] text-red-500">{errors.alternate_phone.message}</p>
                            )}
                        </div>

                        {watch('alternate_phone')?.trim() ? (
                            <div className="space-y-1.5 sm:col-span-2">
                                <Label htmlFor="alternate_phone_label" className="text-xs font-bold">
                                    ¿De quién es ese teléfono? <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="alternate_phone_label"
                                    list="repair-alternate-phone-labels"
                                    {...register('alternate_phone_label')}
                                    placeholder="Ej: hermana, jefe, hijo…"
                                    className={cn("h-10 text-xs font-medium", errors.alternate_phone_label && 'border-red-500')}
                                    disabled={isSubmitting}
                                />
                                <datalist id="repair-alternate-phone-labels">
                                    {ALTERNATE_PHONE_LABELS.map((label) => (
                                        <option key={label} value={label} />
                                    ))}
                                </datalist>
                                {errors.alternate_phone_label && (
                                    <p className="text-[11px] text-red-500">{errors.alternate_phone_label.message}</p>
                                )}
                            </div>
                        ) : null}

                        {/* RUC / CI */}
                        <div className="space-y-1.5">
                            <Label htmlFor="ruc" className="text-xs font-bold">
                                RUC / C.I. <span className="text-[10px] text-muted-foreground font-normal">(opcional)</span>
                            </Label>
                            <div className="relative">
                                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="ruc"
                                    {...register('ruc')}
                                    placeholder="4567890-1"
                                    className="pl-9 h-10 text-xs font-medium"
                                    disabled={isSubmitting}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Email */}
                    <div className="space-y-1.5">
                        <Label htmlFor="email" className="text-xs font-bold">
                            Email {sendWebInvite ? <span className="text-red-500">*</span> : <span className="text-[10px] text-muted-foreground font-normal">(opcional)</span>}
                        </Label>
                        <Input
                            id="email"
                            type="email"
                            {...register('email')}
                            placeholder="email@ejemplo.com"
                            className={cn("h-10 text-xs font-medium", errors.email && 'border-red-500')}
                            disabled={isSubmitting}
                        />
                        {errors.email && (
                            <p className="text-[11px] text-red-500">{errors.email.message}</p>
                        )}
                    </div>

                    {/* Opciones de Acceso: Mayorista e Invitación Web */}
                    <div className="grid grid-cols-1 gap-2 pt-1">
                        {/* Opción Habilitar como Mayorista */}
                        <div
                            onClick={() => setIsWholesale(prev => !prev)}
                            className={cn(
                                "p-3 rounded-xl border transition-all cursor-pointer select-none",
                                isWholesale
                                    ? "border-violet-400 bg-violet-50/60 dark:border-violet-700 dark:bg-violet-950/30"
                                    : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 hover:border-slate-300 dark:hover:border-slate-700"
                            )}
                        >
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className={cn(
                                        "flex h-7 w-7 items-center justify-center rounded-lg transition-colors shrink-0",
                                        isWholesale
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
                                            {isWholesale && (
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
                                    isWholesale
                                        ? "bg-violet-600 border-violet-600 text-white"
                                        : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                                )}>
                                    {isWholesale && <CheckCircle2 className="h-3.5 w-3.5" />}
                                </div>
                            </div>
                        </div>

                        {/* Opción Enviar Invitación al Portal Web Público */}
                        <div
                            onClick={() => setSendWebInvite(prev => !prev)}
                            className={cn(
                                "p-3 rounded-xl border transition-all cursor-pointer select-none",
                                sendWebInvite
                                    ? "border-cyan-500 bg-cyan-50/60 dark:border-cyan-700 dark:bg-cyan-950/30"
                                    : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 hover:border-slate-300 dark:hover:border-slate-700"
                            )}
                        >
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className={cn(
                                        "flex h-7 w-7 items-center justify-center rounded-lg transition-colors shrink-0",
                                        sendWebInvite
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
                                            {sendWebInvite && (
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
                                    sendWebInvite
                                        ? "bg-cyan-600 border-cyan-600 text-white"
                                        : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                                )}>
                                    {sendWebInvite && <CheckCircle2 className="h-3.5 w-3.5" />}
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
                            <X className="mr-1.5 h-3.5 w-3.5" />
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="h-9 text-xs font-bold bg-cyan-600 hover:bg-cyan-700 text-white gap-1.5"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Creando...
                                </>
                            ) : (
                                <>
                                    <Save className="h-3.5 w-3.5" />
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
