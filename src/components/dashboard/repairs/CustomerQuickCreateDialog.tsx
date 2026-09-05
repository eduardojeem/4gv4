'use client'

/**
 * Alta y edicion rapida de un cliente, en un solo dialogo.
 *
 * Habia dos: este —solo alta, usado por el selector de reparaciones y por el
 * checkout del POS— y `QuickCustomerModal` —alta y edicion, usado por el
 * formulario de reparacion. Pedian los mismos datos y pegaban al mismo endpoint,
 * pero cada uno con su propio estado, su propia validacion y su propia forma de
 * armar el cliente que devolvia. Arreglar algo en uno y olvidar el otro es
 * exactamente lo que venia pasando: el label del telefono alternativo se
 * agrego primero aca y tardo en llegar al otro.
 */

import { useEffect, useState } from 'react'
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
import { 
    Loader2, 
    Save, 
    X, 
    UserPlus, 
    UserCog, 
    Sparkles, 
    CheckCircle2, 
    Building2, 
    Globe, 
    AlertTriangle,
    User,
    Phone,
    Mail,
    Users
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Customer } from '@/hooks/use-customers'
import { validateCustomerContact, normalizePhone, MIN_PHONE_DIGITS, ALTERNATE_PHONE_LABELS } from '@/lib/customers/contact-rules'
import { useCustomerDuplicates } from '@/hooks/use-customer-duplicates'
import { duplicatesMessage } from '@/lib/customers/duplicate-check'

// Un solo campo de nombre en vez de nombre + apellido: la base guarda un solo
// `name`, una empresa no tiene apellido, y partir el nombre para editarlo y
// volver a unirlo al guardar reordenaba lo que la persona habia escrito.
const customerSchema = z
    .object({
        name: z.string().min(2, 'El nombre o razón social debe tener al menos 2 caracteres'),
        phone: z.string().min(MIN_PHONE_DIGITS, `El teléfono debe tener al menos ${MIN_PHONE_DIGITS} dígitos`),
        alternate_phone: z.string().optional().or(z.literal('')),
        alternate_phone_label: z.string().optional().or(z.literal('')),
        email: z.string().email('Email inválido').optional().or(z.literal('')),
        ruc: z.string().optional().or(z.literal('')),
    })
    .superRefine((data, ctx) => {
        const errors = validateCustomerContact({
            name: data.name,
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

/**
 * Lo minimo que hace falta para abrir la edicion, y lo unico que las pantallas
 * leen del cliente que se acaba de guardar. Deliberadamente mas chico que
 * `Customer`: el formulario de reparacion arma uno de estos con lo que tiene a
 * mano, sin poder completar las tres decenas de campos de un cliente entero.
 */
export type QuickCustomerData = {
    id: string
    name?: string | null
    phone?: string | null
    email?: string | null
    alternate_phone?: string | null
    alternate_phone_label?: string | null
    ruc?: string | null
    customer_type?: string | null
    is_wholesale?: boolean
}

/** Lo que devuelve la API al crear o actualizar. */
type SavedCustomerRow = {
    id: string
    customer_code?: string | null
    name?: string | null
    phone?: string | null
    alternate_phone?: string | null
    alternate_phone_label?: string | null
    email?: string | null
    ruc?: string | null
    customer_type?: string | null
    status?: string | null
    created_at?: string | null
}

interface CustomerQuickCreateDialogProps {
    open: boolean
    onClose: () => void
    /** Se llama al crear. El id va aparte porque varios consumidores lo usan para autoseleccionar. */
    onCreated?: (customerId: string, customerData: Customer & { is_wholesale?: boolean }) => void
    /** Se llama al editar. Sin esto el dialogo solo da de alta. */
    onUpdated?: (customerData: Customer & { is_wholesale?: boolean }) => void
    /** Con un cliente acá el dialogo pasa a modo edicion. */
    customerToEdit?: QuickCustomerData | null
}

const EMPTY_FORM: CustomerFormData = {
    name: '',
    phone: '',
    alternate_phone: '',
    alternate_phone_label: '',
    email: '',
    ruc: '',
}

export function CustomerQuickCreateDialog({
    open,
    onClose,
    onCreated,
    onUpdated,
    customerToEdit = null,
}: CustomerQuickCreateDialogProps) {
    const isEditing = Boolean(customerToEdit)
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
        defaultValues: EMPTY_FORM,
    })

    // Aviso anticipado de que el telefono, el correo o el RUC ya estan cargados
    // en otro cliente. Quien decide es el servidor: esto solo evita llenar el
    // formulario entero para que despues lo rechace.
    const duplicates = useCustomerDuplicates({
        phone: watch('phone'),
        email: watch('email'),
        ruc: watch('ruc'),
        excludeId: customerToEdit?.id ?? null,
    })

    // Al abrir se carga lo que hay que editar, o se limpia para un alta nueva.
    // Sin esto el formulario conservaba lo de la vez anterior.
    useEffect(() => {
        if (!open) return

        if (customerToEdit) {
            reset({
                name: customerToEdit.name || '',
                phone: customerToEdit.phone || '',
                alternate_phone: customerToEdit.alternate_phone || '',
                alternate_phone_label: customerToEdit.alternate_phone_label || '',
                email: customerToEdit.email || '',
                ruc: customerToEdit.ruc || '',
            })
            setIsWholesale(Boolean(
                customerToEdit.is_wholesale ||
                customerToEdit.customer_type === 'wholesale' ||
                customerToEdit.customer_type === 'mayorista'
            ))
        } else {
            reset(EMPTY_FORM)
            setIsWholesale(false)
        }
        // La invitacion al portal nunca se arrastra: es una accion, no un dato
        // del cliente, y reenviarla sin querer manda un correo de verdad.
        setSendWebInvite(false)
    }, [open, customerToEdit, reset])

    /**
     * Arma el cliente que se devuelve a la pantalla. Estaba escrito cuatro veces
     * entre los dos dialogos —alta y edicion en cada uno— con las mismas
     * caidas de respaldo copiadas a mano.
     */
    function toCustomer(row: SavedCustomerRow, data: CustomerFormData): Customer & { is_wholesale?: boolean } {
        const alternatePhone = data.alternate_phone?.trim() ? normalizePhone(data.alternate_phone) : null
        const createdAt = row.created_at || new Date().toISOString()

        return {
            id: row.id,
            customerCode: row.customer_code || `CLI-${String(row.id).slice(0, 6)}`,
            name: String(row.name || data.name).trim(),
            phone: row.phone || normalizePhone(data.phone),
            alternate_phone: row.alternate_phone ?? alternatePhone,
            alternate_phone_label: row.alternate_phone_label ?? (alternatePhone ? (data.alternate_phone_label || null) : null),
            email: row.email || data.email || '',
            ruc: row.ruc || data.ruc || '',
            customer_type: (row.customer_type as Customer['customer_type']) || (isWholesale ? 'wholesale' : 'regular'),
            is_wholesale: isWholesale,
            status: (row.status as Customer['status']) || 'active',
            total_purchases: 0,
            total_repairs: 0,
            registration_date: createdAt,
            created_at: createdAt,
            last_visit: createdAt,
            last_activity: createdAt,
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
            total_spent_this_year: 0,
        }
    }

    const onSubmit = async (data: CustomerFormData) => {
        if (sendWebInvite && !data.email?.trim()) {
            toast.error('Para enviar la invitación a la web se requiere ingresar un correo electrónico')
            return
        }

        setIsSubmitting(true)
        try {
            const alternatePhone = data.alternate_phone?.trim() ? normalizePhone(data.alternate_phone) : null
            const payload = {
                name: data.name.trim(),
                phone: normalizePhone(data.phone),
                alternate_phone: alternatePhone,
                // Sin telefono, la aclaracion de quien atiende no significa nada.
                alternate_phone_label: alternatePhone ? (data.alternate_phone_label || null) : null,
                email: data.email || null,
                ruc: data.ruc || null,
                customer_type: isWholesale ? 'wholesale' : 'regular',
                is_wholesale: isWholesale,
            }

            const response = await fetch('/api/repairs/customers', {
                method: isEditing ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(isEditing ? { id: customerToEdit!.id, ...payload } : payload),
            })

            const body = await response.json().catch(() => null) as {
                success?: boolean
                data?: SavedCustomerRow
                error?: string
            } | null

            if (!response.ok || !body?.success || !body.data) {
                throw new Error(body?.error || (isEditing ? 'Error al actualizar el cliente' : 'Error al crear el cliente'))
            }

            const saved = toCustomer(body.data, data)
            toast.success(`Cliente "${saved.name}" ${isEditing ? 'actualizado' : 'creado'} exitosamente`)

            // La invitacion se manda despues de guardar y su fallo se avisa
            // aparte: reportarlo como error del alta seria enganoso, porque el
            // cliente ya quedo creado y volverian a cargarlo duplicado.
            if (sendWebInvite && data.email?.trim()) {
                try {
                    const inviteRes = await fetch(`/api/customers/${saved.id}/create-account`, {
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

            if (isEditing) {
                onUpdated?.(saved)
            } else {
                onCreated?.(saved.id, saved)
            }

            reset(EMPTY_FORM)
            setIsWholesale(false)
            setSendWebInvite(false)
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error)
            console.error('Error al guardar el cliente:', message)
            toast.error(message || 'Error al guardar el cliente')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleClose = () => {
        if (!isSubmitting) {
            reset(EMPTY_FORM)
            setIsWholesale(false)
            setSendWebInvite(false)
            onClose()
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="w-[95vw] sm:max-w-[520px] max-h-[92dvh] sm:max-h-[88vh] flex flex-col p-0 overflow-hidden rounded-2xl border-border/80 shadow-2xl">
                {/* Header fijo superior con gradiente sutil */}
                <DialogHeader className="p-4 sm:p-5 pb-3 sm:pb-3.5 border-b bg-gradient-to-r from-slate-50 to-white dark:from-slate-900/60 dark:to-slate-950 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl shadow-xs transition-colors shrink-0",
                            isEditing 
                                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20" 
                                : "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20"
                        )}>
                            {isEditing ? <UserCog className="h-5 w-5 sm:h-6 sm:w-6" /> : <UserPlus className="h-5 w-5 sm:h-6 sm:w-6" />}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <DialogTitle className="text-base sm:text-lg font-bold tracking-tight text-foreground truncate">
                                    {isEditing ? 'Editar Ficha de Cliente' : 'Nuevo Cliente para Taller'}
                                </DialogTitle>
                                {isEditing && (
                                    <Badge variant="outline" className="text-[10px] font-bold px-1.5 py-0 h-4 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700">
                                        Modo Edición
                                    </Badge>
                                )}
                            </div>
                            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                                {isEditing
                                    ? 'Actualizá los datos de contacto y facturación del cliente.'
                                    : 'Completá los datos clave para órdenes de reparación y seguimiento.'}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                {/* Formulario scrolleable en móviles y desktop */}
                <form id="customer-quick-create-form" onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                    {duplicates.length > 0 && (
                        <div className="flex items-start gap-2.5 rounded-xl border border-amber-300/80 bg-amber-50/90 p-3 text-amber-900 shadow-xs dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold leading-tight">{duplicatesMessage(duplicates)}</p>
                                <p className="mt-1 text-[11px] opacity-85 leading-normal">
                                    Buscalo en el selector en lugar de duplicarlo: registrarlo doble divide sus órdenes, garantías e historial.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Sección 1: Identificación y Nombre */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 pb-0.5 border-b border-border/40">
                            <User className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
                            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                Datos del Titular
                            </span>
                        </div>

                        {/* Nombre o Razón Social */}
                        <div className="space-y-1.5">
                            <Label htmlFor="name" className="text-xs font-semibold text-foreground flex items-center justify-between">
                                <span>Nombre o razón social <span className="text-red-500 font-bold">*</span></span>
                            </Label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
                                <Input
                                    id="name"
                                    {...register('name')}
                                    placeholder="Ej: Juan Pérez / Electro Servicios S.R.L."
                                    className={cn(
                                        "pl-9 h-10 text-xs sm:text-sm font-medium rounded-xl transition-all shadow-2xs",
                                        errors.name && 'border-red-500 focus-visible:ring-red-500'
                                    )}
                                    disabled={isSubmitting}
                                    autoFocus
                                />
                            </div>
                            {errors.name && (
                                <p className="text-[11px] font-medium text-red-500 mt-1">{errors.name.message}</p>
                            )}
                        </div>

                        {/* RUC / CI */}
                        <div className="space-y-1.5">
                            <Label htmlFor="ruc" className="text-xs font-semibold text-foreground flex items-center justify-between">
                                <span>RUC / C.I.</span>
                                <span className="text-[10px] text-muted-foreground font-normal">Opcional para facturación</span>
                            </Label>
                            <div className="relative">
                                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
                                <Input
                                    id="ruc"
                                    {...register('ruc')}
                                    placeholder="Ej: 4567890 o 80012345-6"
                                    className="pl-9 h-10 text-xs sm:text-sm font-mono font-medium rounded-xl transition-all shadow-2xs"
                                    disabled={isSubmitting}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Sección 2: Contacto Directo y Alternativo */}
                    <div className="space-y-3 pt-1">
                        <div className="flex items-center gap-2 pb-0.5 border-b border-border/40">
                            <Phone className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
                            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                Comunicación y Notificaciones
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Teléfono Principal */}
                            <div className="space-y-1.5">
                                <Label htmlFor="phone" className="text-xs font-semibold text-foreground flex items-center justify-between">
                                    <span>Teléfono <span className="text-red-500 font-bold">*</span></span>
                                </Label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
                                    <Input
                                        id="phone"
                                        type="tel"
                                        {...register('phone')}
                                        placeholder="Ej: 0981 123456"
                                        className={cn(
                                            "pl-9 h-10 text-xs sm:text-sm font-medium rounded-xl transition-all shadow-2xs",
                                            errors.phone && 'border-red-500 focus-visible:ring-red-500'
                                        )}
                                        disabled={isSubmitting}
                                    />
                                </div>
                                {errors.phone && (
                                    <p className="text-[11px] font-medium text-red-500 mt-1">{errors.phone.message}</p>
                                )}
                            </div>

                            {/* Contacto alternativo */}
                            <div className="space-y-1.5">
                                <Label htmlFor="alternate_phone" className="text-xs font-semibold text-foreground flex items-center justify-between">
                                    <span>Otro teléfono para avisarle</span>
                                    <span className="text-[10px] text-muted-foreground font-normal">(opcional)</span>
                                </Label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
                                    <Input
                                        id="alternate_phone"
                                        type="tel"
                                        {...register('alternate_phone')}
                                        placeholder="Si deja su celular acá"
                                        className={cn(
                                            "pl-9 h-10 text-xs sm:text-sm font-medium rounded-xl transition-all shadow-2xs",
                                            errors.alternate_phone && 'border-red-500 focus-visible:ring-red-500'
                                        )}
                                        disabled={isSubmitting}
                                    />
                                </div>
                                {errors.alternate_phone && (
                                    <p className="text-[11px] font-medium text-red-500 mt-1">{errors.alternate_phone.message}</p>
                                )}
                            </div>

                            {/* Aclaración de quién es el teléfono alternativo */}
                            {watch('alternate_phone')?.trim() ? (
                                <div className="space-y-1.5 sm:col-span-2 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-800/40 p-2.5 rounded-xl">
                                    <Label htmlFor="alternate_phone_label" className="text-xs font-bold text-indigo-900 dark:text-indigo-200 flex items-center justify-between">
                                        <span>¿De quién es ese teléfono? <span className="text-red-500">*</span></span>
                                        <span className="text-[10px] font-normal text-indigo-700 dark:text-indigo-300">Indica a quién contactar</span>
                                    </Label>
                                    <div className="relative mt-1">
                                        <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-500/70 dark:text-indigo-400/70" />
                                        <Input
                                            id="alternate_phone_label"
                                            list="repair-alternate-phone-labels"
                                            {...register('alternate_phone_label')}
                                            placeholder="Ej: Hermana, Esposo, Papá, Trabajo, etc."
                                            className={cn(
                                                "pl-9 h-10 text-xs sm:text-sm font-medium rounded-xl bg-white dark:bg-slate-900 transition-all",
                                                errors.alternate_phone_label && 'border-red-500 focus-visible:ring-red-500'
                                            )}
                                            disabled={isSubmitting}
                                        />
                                    </div>
                                    <datalist id="repair-alternate-phone-labels">
                                        {ALTERNATE_PHONE_LABELS.map((label) => (
                                            <option key={label} value={label} />
                                        ))}
                                    </datalist>
                                    {errors.alternate_phone_label && (
                                        <p className="text-[11px] font-medium text-red-500 mt-1">{errors.alternate_phone_label.message}</p>
                                    )}
                                </div>
                            ) : null}

                            {/* Email */}
                            <div className="space-y-1.5 sm:col-span-2">
                                <Label htmlFor="email" className="text-xs font-semibold text-foreground flex items-center justify-between">
                                    <span>Email {sendWebInvite ? <span className="text-red-500 font-bold">*</span> : null}</span>
                                    <span className="text-[10px] text-muted-foreground font-normal">
                                        {sendWebInvite ? 'Requerido para la invitación' : '(opcional)'}
                                    </span>
                                </Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
                                    <Input
                                        id="email"
                                        type="email"
                                        {...register('email')}
                                        placeholder="cliente@ejemplo.com"
                                        className={cn(
                                            "pl-9 h-10 text-xs sm:text-sm font-medium rounded-xl transition-all shadow-2xs",
                                            errors.email && 'border-red-500 focus-visible:ring-red-500'
                                        )}
                                        disabled={isSubmitting}
                                    />
                                </div>
                                {errors.email && (
                                    <p className="text-[11px] font-medium text-red-500 mt-1">{errors.email.message}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Sección 3: Categoría Comercial y Acceso Web */}
                    <div className="space-y-2 pt-1">
                        <div className="flex items-center gap-2 pb-0.5 border-b border-border/40">
                            <Sparkles className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
                            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                Opciones Especiales
                            </span>
                        </div>

                        <div className="grid grid-cols-1 gap-2 pt-0.5">
                            {/* Opción Habilitar como Mayorista */}
                            <div
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setIsWholesale(p => !p) } }}
                                onClick={() => setIsWholesale(prev => !prev)}
                                className={cn(
                                    "p-3 rounded-xl border transition-all cursor-pointer select-none",
                                    isWholesale
                                        ? "border-violet-400/80 bg-violet-50/70 dark:border-violet-700/70 dark:bg-violet-950/40 shadow-xs"
                                        : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/60"
                                )}
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className={cn(
                                            "flex h-8 w-8 items-center justify-center rounded-lg transition-colors shrink-0",
                                            isWholesale
                                                ? "bg-violet-600 text-white shadow-xs"
                                                : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                        )}>
                                            <Sparkles className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                                                    Tarifa Mayorista / Técnico
                                                </p>
                                                {isWholesale && (
                                                    <Badge className="bg-violet-600 hover:bg-violet-600 text-white text-[9px] py-0 px-1.5 font-bold h-4">
                                                        Activo
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                                                Aplica precios mayoristas automáticos en repuestos e insumos de reparación.
                                            </p>
                                        </div>
                                    </div>
                                    <div className={cn(
                                        "h-5 w-5 rounded-md border flex items-center justify-center shrink-0 transition-colors",
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
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setSendWebInvite(p => !p) } }}
                                onClick={() => setSendWebInvite(prev => !prev)}
                                className={cn(
                                    "p-3 rounded-xl border transition-all cursor-pointer select-none",
                                    sendWebInvite
                                        ? "border-cyan-500/80 bg-cyan-50/70 dark:border-cyan-700/70 dark:bg-cyan-950/40 shadow-xs"
                                        : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/60"
                                )}
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className={cn(
                                            "flex h-8 w-8 items-center justify-center rounded-lg transition-colors shrink-0",
                                            sendWebInvite
                                                ? "bg-cyan-600 text-white shadow-xs"
                                                : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                        )}>
                                            <Globe className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                                                    Enviar Invitación al Portal Web
                                                </p>
                                                {sendWebInvite && (
                                                    <Badge className="bg-cyan-600 hover:bg-cyan-600 text-white text-[9px] py-0 px-1.5 font-bold h-4">
                                                        Email
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                                                Envía un correo para que el cliente consulte sus reparaciones en línea.
                                            </p>
                                        </div>
                                    </div>
                                    <div className={cn(
                                        "h-5 w-5 rounded-md border flex items-center justify-center shrink-0 transition-colors",
                                        sendWebInvite
                                            ? "bg-cyan-600 border-cyan-600 text-white"
                                            : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                                    )}>
                                        {sendWebInvite && <CheckCircle2 className="h-3.5 w-3.5" />}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </form>

                {/* Footer fijo inferior con botones amplios y touch-friendly */}
                <DialogFooter className="p-3.5 sm:p-4 border-t bg-slate-50/80 dark:bg-slate-900/60 flex-row items-center justify-between gap-2 shrink-0">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleClose}
                        disabled={isSubmitting}
                        className="h-10 sm:h-9 px-4 text-xs font-medium rounded-xl flex-1 sm:flex-initial"
                    >
                        <X className="mr-1.5 h-3.5 w-3.5" />
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        form="customer-quick-create-form"
                        disabled={isSubmitting}
                        className={cn(
                            "h-10 sm:h-9 px-5 text-xs font-bold text-white gap-2 rounded-xl shadow-xs transition-all active:scale-[0.98] flex-1 sm:flex-initial",
                            isEditing
                                ? "bg-amber-600 hover:bg-amber-700"
                                : "bg-cyan-600 hover:bg-cyan-700"
                        )}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>{isEditing ? 'Guardando...' : 'Creando...'}</span>
                            </>
                        ) : (
                            <>
                                <Save className="h-4 w-4" />
                                <span>{isEditing ? 'Guardar Cambios' : 'Crear Cliente'}</span>
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
