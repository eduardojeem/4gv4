'use client'

import { useState, useEffect, useMemo } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import {
    Calendar as CalendarIcon,
    Loader2,
    Sparkles,
    Tag,
    Percent,
    DollarSign,
    ShoppingBag,
    Clock,
    Zap,
    Search,
    X,
    CheckSquare,
    Package,
    Wrench,
    CheckCircle2,
    AlertCircle,
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import type { Promotion, PromotionType } from '@/types/promotion'
import { createClient } from '@/lib/supabase/client'

interface PromotionDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    promotion?: Promotion | null
    /** Cuando se abre para duplicar: precarga los datos pero crea una promo nueva */
    duplicateFrom?: Promotion | null
    onSave: (data: Omit<Promotion, 'id' | 'created_at' | 'updated_at'>) => Promise<boolean>
    onUpdate: (id: string, data: Partial<Promotion>) => Promise<boolean>
    validateCode: (code: string, excludeId?: string) => Promise<boolean>
}

function randomPromoCode() {
    return `PROMO${Math.random().toString(36).substring(2, 8).toUpperCase()}`
}

// Section wrapper for visual grouping
function FormSection({
    icon: Icon,
    title,
    description,
    children,
    className,
}: {
    icon: React.ElementType
    title: string
    description?: string
    children: React.ReactNode
    className?: string
}) {
    return (
        <div className={cn('rounded-xl border bg-card p-4 space-y-4', className)}>
            <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="space-y-0.5">
                    <p className="text-sm font-semibold leading-none">{title}</p>
                    {description && (
                        <p className="text-xs text-muted-foreground">{description}</p>
                    )}
                </div>
            </div>
            <div className="space-y-3 pl-11">
                {children}
            </div>
        </div>
    )
}

export function PromotionDialog({
    open,
    onOpenChange,
    promotion,
    duplicateFrom,
    onSave,
    onUpdate,
    validateCode
}: PromotionDialogProps) {
    const isEditing = !!promotion
    const isDuplicating = !promotion && !!duplicateFrom

    // Numeric fields stored as strings so the user can freely delete digits
    // (a controlled <input type="number"> bound to a number never lets you clear it).
    const [formData, setFormData] = useState({
        name: '',
        code: '',
        description: '',
        type: 'percentage' as PromotionType,
        value: '' as string,
        min_purchase: '' as string,
        max_discount: '' as string,
        start_date: null as Date | null,
        end_date: null as Date | null,
        is_active: true,
        usage_limit: '' as string,
        applicable_products: [] as string[],
    })

    const [errors, setErrors] = useState<Record<string, string>>({})
    const [saving, setSaving] = useState(false)
    const [validatingCode, setValidatingCode] = useState(false)
    // Status of the auto-check run when the dialog opens in duplicate mode
    const [codeStatus, setCodeStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
    const [autoCodeAttempts, setAutoCodeAttempts] = useState(0)
    const [applyToRepairs, setApplyToRepairs] = useState(false)
    const [products, setProducts] = useState<Array<{ id: string; name: string; sku: string; type: 'product' | 'service' }>>([])
    const [productSearch, setProductSearch] = useState('')
    const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])

    // Helpers to convert numeric values to editable strings
    const numStr = (v: number | null | undefined, fallback = '') =>
        v != null && v !== 0 ? String(v) : fallback

    const parseNumberInput = (raw: string): number => {
        const s = String(raw ?? '').trim()
        if (!s) return 0
        const cleaned = s.replace(/[^0-9.,]/g, '')
        const lastDot = cleaned.lastIndexOf('.')
        const lastComma = cleaned.lastIndexOf(',')
        const decimalPos = Math.max(lastDot, lastComma)
        if (decimalPos === -1) return Number(cleaned.replace(/[.,]/g, '')) || 0
        const intPart = cleaned.slice(0, decimalPos).replace(/[.,]/g, '')
        const fracPart = cleaned.slice(decimalPos + 1).replace(/[.,]/g, '')
        const normalized = `${intPart}.${fracPart}`
        return Number(normalized) || 0
    }

    // Initialize form when dialog opens
    useEffect(() => {
        if (open && promotion) {
            setFormData({
                name: promotion.name,
                code: promotion.code,
                description: promotion.description || '',
                type: promotion.type,
                value: numStr(promotion.value),
                min_purchase: numStr(promotion.min_purchase),
                max_discount: numStr(promotion.max_discount),
                start_date: promotion.start_date ? new Date(promotion.start_date) : null,
                end_date: promotion.end_date ? new Date(promotion.end_date) : null,
                is_active: promotion.is_active,
                usage_limit: numStr(promotion.usage_limit),
                applicable_products: promotion.applicable_products || [],
            })
            setSelectedProductIds(promotion.applicable_products || [])
            setApplyToRepairs(Array.isArray((promotion as any).applicable_categories) && (promotion as any).applicable_categories.includes('service'))
        } else if (open && duplicateFrom) {
            setFormData({
                name: `${duplicateFrom.name} (Copia)`,
                code: randomPromoCode(),
                description: duplicateFrom.description || '',
                type: duplicateFrom.type,
                value: numStr(duplicateFrom.value),
                min_purchase: numStr(duplicateFrom.min_purchase),
                max_discount: numStr(duplicateFrom.max_discount),
                start_date: null,
                end_date: null,
                is_active: false,
                usage_limit: numStr(duplicateFrom.usage_limit),
                applicable_products: duplicateFrom.applicable_products || [],
            })
            setSelectedProductIds(duplicateFrom.applicable_products || [])
            setApplyToRepairs(Array.isArray(duplicateFrom.applicable_categories) && duplicateFrom.applicable_categories.includes('service'))
        } else if (open) {
            setFormData({
                name: '',
                code: '',
                description: '',
                type: 'percentage',
                value: '',
                min_purchase: '',
                max_discount: '',
                start_date: null,
                end_date: null,
                is_active: true,
                usage_limit: '',
                applicable_products: [],
            })
            setSelectedProductIds([])
            setApplyToRepairs(false)
        }
        setErrors({})
        setProductSearch('')
        setAutoCodeAttempts(0)
        // Reset code status whenever the dialog (re)opens
        setCodeStatus(open && !promotion && !!duplicateFrom ? 'checking' : 'idle')
    }, [open, promotion, duplicateFrom])

    // Auto-validate the pre-generated code when the dialog opens in duplicate mode.
    // Uses a debounce so rapid regenerations only fire one network request.
    useEffect(() => {
        if (!isDuplicating || !formData.code) return
        setCodeStatus('checking')
        const timer = setTimeout(async () => {
            // For a duplicate we are creating a NEW promo, so no ID to exclude.
            const ok = await validateCode(formData.code)
            setCodeStatus(ok ? 'available' : 'taken')
        }, 350)
        return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formData.code, isDuplicating])

    useEffect(() => {
        if (!isDuplicating) return
        if (codeStatus !== 'taken') return
        if (autoCodeAttempts >= 3) return

        setAutoCodeAttempts(prev => prev + 1)
        const next = randomPromoCode()
        setFormData(prev => ({ ...prev, code: next }))
    }, [autoCodeAttempts, codeStatus, isDuplicating])

    // Load products for selection
    useEffect(() => {
        if (!open) return
        const supabase = createClient()
        ;(async () => {
            const { data, error } = await supabase
                .from('products')
                .select('id,name,sku')
                .order('name', { ascending: true })
            if (!error && Array.isArray(data)) {
                const productRows = (data as any[]).map(row => ({ ...row, type: 'product' as const }))
                setProducts(productRows)
            }
        })()
    }, [open])

    useEffect(() => {
        if (!open) return
        if (selectedProductIds.length === 0) return
        if (products.length === 0) return
        const known = new Set(products.map(p => p.id))
        const filtered = selectedProductIds.filter(id => known.has(id))
        if (filtered.length === selectedProductIds.length) return
        setSelectedProductIds(filtered)
    }, [open, products, selectedProductIds])

    const generateCode = () => {
        const randomCode = `PROMO${Math.random().toString(36).substring(2, 8).toUpperCase()}`
        setFormData(prev => ({ ...prev, code: randomCode }))
    }

    const validateForm = async () => {
        const newErrors: Record<string, string> = {}
        const numValue = parseNumberInput(formData.value)

        if (!formData.name.trim()) {
            newErrors.name = 'El nombre es requerido'
        }

        if (!formData.code.trim()) {
            newErrors.code = 'El código es requerido'
        } else {
            setValidatingCode(true)
            // For edits, exclude the current promo ID so its own code stays valid.
            // For new / duplicate, excludeId is undefined (correct — no ID to exclude yet).
            const isCodeValid = await validateCode(formData.code, isEditing ? promotion?.id : undefined)
            setValidatingCode(false)
            if (!isCodeValid) {
                newErrors.code = 'Este código ya está en uso'
            }
        }

        if (numValue <= 0) {
            newErrors.value = 'El valor debe ser mayor a 0'
        }

        if (formData.type === 'percentage' && numValue > 100) {
            newErrors.value = 'El porcentaje no puede ser mayor a 100'
        }

        if (formData.start_date && formData.end_date && formData.start_date >= formData.end_date) {
            newErrors.end_date = 'La fecha de fin debe ser posterior a la de inicio'
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!(await validateForm())) {
            return
        }

        setSaving(true)

        // Parse string fields back to numbers for submission
        const numValue = parseNumberInput(formData.value)
        const numMinPurchase = parseNumberInput(formData.min_purchase)
        const numMaxDiscount = parseNumberInput(formData.max_discount)
        const numUsageLimit = formData.usage_limit ? parseInt(formData.usage_limit, 10) : null

        const submitData = {
            name: formData.name.trim(),
            code: formData.code.trim().toUpperCase(),
            description: formData.description.trim(),
            type: formData.type,
            value: numValue,
            min_purchase: numMinPurchase > 0 ? numMinPurchase : 0,
            max_discount: formData.type === 'percentage' && numMaxDiscount > 0 ? numMaxDiscount : null,
            start_date: formData.start_date ? formData.start_date.toISOString() : null,
            end_date: formData.end_date ? formData.end_date.toISOString() : null,
            is_active: formData.is_active,
            usage_limit: numUsageLimit,
            // Always reset usage_count to 0 for new / duplicate promotions.
            // Sending it explicitly prevents accidental copy of the original's count.
            ...(!isEditing && { usage_count: 0 }),
            applicable_products: selectedProductIds,
            applicable_categories: applyToRepairs ? ['service'] : [],
        }

        let success = false
        if (isEditing && promotion) {
            success = await onUpdate(promotion.id, submitData as unknown as Partial<Promotion>)
        } else {
            success = await onSave(submitData as unknown as Omit<Promotion, 'id' | 'created_at' | 'updated_at'>)
        }

        setSaving(false)

        if (success) {
            onOpenChange(false)
        }
    }

    const filteredProducts = products.filter(p => {
        const q = productSearch.trim().toLowerCase()
        if (!q) return true
        return p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q)
    })
    const unknownSelectedCount = useMemo(() => {
        if (selectedProductIds.length === 0) return 0
        const known = new Set(products.map(p => p.id))
        let missing = 0
        for (const id of selectedProductIds) {
            if (!known.has(id)) missing++
        }
        return missing
    }, [products, selectedProductIds])

    const totalSelected = selectedProductIds.length + (applyToRepairs ? 1 : 0)

    // Determine modal accent color/mode
    const modalVariant = isEditing
        ? 'edit'
        : isDuplicating
            ? 'duplicate'
            : 'create'

    const headerMeta = {
        create: {
            title: 'Nueva promoción',
            description: 'Completa los datos para crear una nueva promoción',
            badge: { label: 'Nueva', className: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/20' },
        },
        edit: {
            title: 'Editar promoción',
            description: 'Actualizá la información de la promoción',
            badge: { label: 'Editando', className: 'bg-blue-500/15 text-blue-600 border-blue-500/20' },
        },
        duplicate: {
            title: 'Duplicar promoción',
            description: 'Revisá y ajustá los datos antes de crear la copia',
            badge: { label: 'Copia', className: 'bg-amber-500/15 text-amber-600 border-amber-500/20' },
        },
    }[modalVariant]

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[92vh] overflow-hidden flex flex-col gap-0 p-0">

                {/* ── Header ──────────────────────────────────────────────── */}
                <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                                modalVariant === 'create' && 'bg-emerald-500/15',
                                modalVariant === 'edit' && 'bg-blue-500/15',
                                modalVariant === 'duplicate' && 'bg-amber-500/15',
                            )}>
                                <Tag className={cn(
                                    'h-5 w-5',
                                    modalVariant === 'create' && 'text-emerald-600',
                                    modalVariant === 'edit' && 'text-blue-600',
                                    modalVariant === 'duplicate' && 'text-amber-600',
                                )} />
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <DialogTitle className="text-lg font-semibold leading-none">
                                        {headerMeta.title}
                                    </DialogTitle>
                                    <Badge
                                        variant="outline"
                                        className={cn('text-[10px] px-1.5 py-0 font-semibold', headerMeta.badge.className)}
                                    >
                                        {headerMeta.badge.label}
                                    </Badge>
                                </div>
                                <DialogDescription className="text-xs">
                                    {headerMeta.description}
                                </DialogDescription>
                                {isDuplicating && duplicateFrom && (
                                    <p className="text-[11px] text-muted-foreground">
                                        Copiando desde: <span className="font-medium text-foreground">{duplicateFrom.name}</span>
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </DialogHeader>

                {/* ── Scrollable body ──────────────────────────────────────── */}
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

                        {/* ── 1. Identificación ─────────────────────────────── */}
                        <FormSection
                            icon={Tag}
                            title="Identificación"
                            description="Nombre visible y código único para canjear la promo"
                        >
                            {/* Nombre */}
                            <div className="space-y-1.5">
                                <Label htmlFor="name" className="text-xs font-medium">
                                    Nombre <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="name"
                                    placeholder="Ej: Descuento de Verano"
                                    value={formData.name}
                                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    className={cn('h-9', errors.name && 'border-red-500 focus-visible:ring-red-500')}
                                />
                                {errors.name && (
                                    <p className="text-xs text-red-500 flex items-center gap-1">
                                        <X className="h-3 w-3" />{errors.name}
                                    </p>
                                )}
                            </div>

                            {/* Código */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="code" className="text-xs font-medium">
                                        Código de cupón <span className="text-red-500">*</span>
                                    </Label>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={generateCode}
                                        className="h-6 gap-1 text-[11px] px-2 text-primary hover:text-primary"
                                    >
                                        <Sparkles className="h-3 w-3" />
                                        Generar aleatorio
                                    </Button>
                                </div>
                                <div className="relative">
                                    <Input
                                        id="code"
                                        placeholder="VERANO2024"
                                        value={formData.code}
                                        onChange={(e) => {
                                            setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))
                                            // Reset auto-check status so it re-runs after typing
                                            if (isDuplicating) setCodeStatus('checking')
                                        }}
                                        className={cn(
                                            'h-9 font-mono uppercase tracking-widest pr-10',
                                            errors.code && 'border-red-500 focus-visible:ring-red-500',
                                            isDuplicating && codeStatus === 'taken' && !errors.code && 'border-amber-400 focus-visible:ring-amber-400'
                                        )}
                                    />
                                    {/* Submit-time spinner */}
                                    {validatingCode && (
                                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                                    )}
                                    {/* Duplicate-mode real-time status */}
                                    {!validatingCode && isDuplicating && codeStatus === 'checking' && (
                                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-sky-500" />
                                    )}
                                    {!validatingCode && isDuplicating && codeStatus === 'available' && (
                                        <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
                                    )}
                                    {!validatingCode && isDuplicating && codeStatus === 'taken' && (
                                        <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-500" />
                                    )}
                                </div>
                                {/* Inline status messages for duplicate mode */}
                                {isDuplicating && !errors.code && codeStatus === 'available' && (
                                    <p className="text-xs text-emerald-600 flex items-center gap-1">
                                        <CheckCircle2 className="h-3 w-3" /> Código disponible
                                    </p>
                                )}
                                {isDuplicating && !errors.code && codeStatus === 'taken' && (
                                    <p className="text-xs text-amber-600 flex items-center gap-1">
                                        <AlertCircle className="h-3 w-3" /> Código ya en uso — generá uno nuevo
                                    </p>
                                )}
                                {errors.code && (
                                    <p className="text-xs text-red-500 flex items-center gap-1">
                                        <X className="h-3 w-3" />{errors.code}
                                    </p>
                                )}
                            </div>

                            {/* Descripción */}
                            <div className="space-y-1.5">
                                <Label htmlFor="description" className="text-xs font-medium">
                                    Descripción <span className="text-muted-foreground font-normal">(opcional)</span>
                                </Label>
                                <Textarea
                                    id="description"
                                    placeholder="Breve descripción de la promoción..."
                                    value={formData.description}
                                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                    rows={2}
                                    className="resize-none text-sm"
                                />
                            </div>
                        </FormSection>

                        {/* ── 2. Descuento ──────────────────────────────────── */}
                        <FormSection
                            icon={Percent}
                            title="Configuración del descuento"
                            description="Tipo, valor y restricciones de la promoción"
                        >
                            {/* Tipo + Valor */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label htmlFor="type" className="text-xs font-medium">
                                        Tipo <span className="text-red-500">*</span>
                                    </Label>
                                    <Select
                                        value={formData.type}
                                        onValueChange={(value: PromotionType) => setFormData(prev => ({ ...prev, type: value }))}
                                    >
                                        <SelectTrigger id="type" className="h-9">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="percentage">
                                                <span className="flex items-center gap-2">
                                                    <Percent className="h-3.5 w-3.5 text-violet-500" />
                                                    Porcentaje
                                                </span>
                                            </SelectItem>
                                            <SelectItem value="fixed">
                                                <span className="flex items-center gap-2">
                                                    <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                                                    Monto fijo
                                                </span>
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="value" className="text-xs font-medium">
                                        {formData.type === 'percentage' ? 'Porcentaje (%)' : 'Monto ($)'}{' '}
                                        <span className="text-red-500">*</span>
                                    </Label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium">
                                            {formData.type === 'percentage' ? '%' : '$'}
                                        </span>
                                        <Input
                                            id="value"
                                            type="text"
                                            inputMode="decimal"
                                            placeholder={formData.type === 'percentage' ? '0' : '0'}
                                            value={formData.value}
                                            onChange={(e) => {
                                                const raw = e.target.value.replace(/[^0-9.,]/g, '')
                                                setFormData(prev => ({ ...prev, value: raw }))
                                            }}
                                            className={cn('h-9 pl-7', errors.value && 'border-red-500 focus-visible:ring-red-500')}
                                        />
                                    </div>
                                    {errors.value && (
                                        <p className="text-xs text-red-500 flex items-center gap-1">
                                            <X className="h-3 w-3" />{errors.value}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Compra mínima + Descuento máximo (solo %) */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label htmlFor="min_purchase" className="text-xs font-medium">
                                        Compra mínima ($)
                                    </Label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium">$</span>
                                        <Input
                                            id="min_purchase"
                                            type="text"
                                            inputMode="decimal"
                                            placeholder="0"
                                            value={formData.min_purchase}
                                            onChange={(e) => {
                                                const raw = e.target.value.replace(/[^0-9.,]/g, '')
                                                setFormData(prev => ({ ...prev, min_purchase: raw }))
                                            }}
                                            className="h-9 pl-7"
                                        />
                                    </div>
                                </div>

                                {formData.type === 'percentage' && (
                                    <div className="space-y-1.5">
                                        <Label htmlFor="max_discount" className="text-xs font-medium">
                                            Descuento máximo ($)
                                        </Label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium">$</span>
                                            <Input
                                                id="max_discount"
                                                type="text"
                                                inputMode="decimal"
                                                placeholder="0"
                                                value={formData.max_discount}
                                                onChange={(e) => {
                                                    const raw = e.target.value.replace(/[^0-9.,]/g, '')
                                                    setFormData(prev => ({ ...prev, max_discount: raw }))
                                                }}
                                                className="h-9 pl-7"
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <Label htmlFor="usage_limit" className="text-xs font-medium">
                                        Límite de usos
                                    </Label>
                                    <Input
                                        id="usage_limit"
                                        type="text"
                                        inputMode="numeric"
                                        placeholder="Sin límite"
                                        value={formData.usage_limit}
                                        onChange={(e) => {
                                            const raw = e.target.value.replace(/[^0-9]/g, '')
                                            setFormData(prev => ({ ...prev, usage_limit: raw }))
                                        }}
                                        className="h-9"
                                    />
                                </div>
                            </div>
                        </FormSection>

                        {/* ── 3. Vigencia ───────────────────────────────────── */}
                        <FormSection
                            icon={Clock}
                            title="Vigencia"
                            description="Período en que la promoción estará activa"
                        >
                            <div className="grid grid-cols-2 gap-3">
                                {/* Fecha inicio */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium">Fecha de inicio</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className={cn(
                                                    'h-9 w-full justify-start text-left font-normal text-sm',
                                                    !formData.start_date && 'text-muted-foreground'
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 h-3.5 w-3.5 shrink-0" />
                                                {formData.start_date
                                                    ? format(formData.start_date, 'dd MMM yyyy', { locale: es })
                                                    : 'Sin fecha inicio'}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={formData.start_date || undefined}
                                                onSelect={(date) => setFormData(prev => ({ ...prev, start_date: date || null }))}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                {/* Fecha fin */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium">Fecha de fin</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className={cn(
                                                    'h-9 w-full justify-start text-left font-normal text-sm',
                                                    !formData.end_date && 'text-muted-foreground',
                                                    errors.end_date && 'border-red-500'
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 h-3.5 w-3.5 shrink-0" />
                                                {formData.end_date
                                                    ? format(formData.end_date, 'dd MMM yyyy', { locale: es })
                                                    : 'Sin fecha fin'}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={formData.end_date || undefined}
                                                onSelect={(date) => setFormData(prev => ({ ...prev, end_date: date || null }))}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                    {errors.end_date && (
                                        <p className="text-xs text-red-500 flex items-center gap-1">
                                            <X className="h-3 w-3" />{errors.end_date}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Clear dates shortcut */}
                            {(formData.start_date || formData.end_date) && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs text-muted-foreground hover:text-foreground px-2"
                                    onClick={() => setFormData(prev => ({ ...prev, start_date: null, end_date: null }))}
                                >
                                    <X className="h-3 w-3 mr-1" /> Quitar fechas
                                </Button>
                            )}
                        </FormSection>

                        {/* ── 4. Aplicabilidad ──────────────────────────────── */}
                        <FormSection
                            icon={ShoppingBag}
                            title="Aplicabilidad"
                            description="Productos o categorías donde aplica el descuento"
                        >
                            {/* Toggle reparaciones */}
                            <div className={cn(
                                'flex items-center justify-between rounded-lg border px-3 py-2.5 transition-colors',
                                applyToRepairs ? 'border-primary/30 bg-primary/5' : 'bg-muted/40'
                            )}>
                                <div className="flex items-center gap-2">
                                    <Wrench className={cn('h-4 w-4', applyToRepairs ? 'text-primary' : 'text-muted-foreground')} />
                                    <div>
                                        <p className="text-xs font-medium">Aplicar a reparaciones</p>
                                        <p className="text-[11px] text-muted-foreground">Incluye todos los servicios de reparación</p>
                                    </div>
                                </div>
                                <Switch id="apply-repairs" checked={applyToRepairs} onCheckedChange={setApplyToRepairs} />
                            </div>

                            {/* Buscador de productos */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs font-medium flex items-center gap-1.5">
                                        <Package className="h-3.5 w-3.5" />
                                        Productos específicos
                                        <span className="text-muted-foreground font-normal">(opcional)</span>
                                    </Label>
                                    {selectedProductIds.length > 0 && (
                                        <div className="flex items-center gap-1.5">
                                            <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                                                {selectedProductIds.length} seleccionados
                                            </Badge>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-5 text-[10px] px-1.5 text-muted-foreground hover:text-foreground"
                                                onClick={() => setSelectedProductIds([])}
                                            >
                                                <X className="h-3 w-3 mr-0.5" /> Quitar
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                {/* Search input */}
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                                    <Input
                                        placeholder="Buscar por nombre o SKU..."
                                        value={productSearch}
                                        onChange={(e) => setProductSearch(e.target.value)}
                                        className="h-8 pl-8 text-sm"
                                    />
                                    {productSearch && (
                                        <button
                                            type="button"
                                            onClick={() => setProductSearch('')}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>

                                {/* Product list */}
                                <div className="max-h-44 overflow-y-auto rounded-lg border bg-muted/20 divide-y divide-border/50">
                                    {filteredProducts.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                                            <Package className="h-6 w-6 mb-1.5 opacity-40" />
                                            <p className="text-xs">
                                                {productSearch ? 'Sin resultados para esa búsqueda' : 'No se encontraron productos'}
                                            </p>
                                        </div>
                                    ) : (
                                        filteredProducts.map(p => {
                                            const checked = selectedProductIds.includes(p.id)
                                            return (
                                                <label
                                                    key={p.id}
                                                    className={cn(
                                                        'flex items-center gap-2.5 px-3 py-2 cursor-pointer text-sm transition-colors',
                                                        checked ? 'bg-primary/8' : 'hover:bg-muted/60'
                                                    )}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        className="h-3.5 w-3.5 accent-primary"
                                                        checked={checked}
                                                        onChange={(e) => {
                                                            setSelectedProductIds(prev => {
                                                                if (e.target.checked) return [...prev, p.id]
                                                                return prev.filter(id => id !== p.id)
                                                            })
                                                        }}
                                                    />
                                                    <span className={cn('flex-1 truncate text-xs', checked && 'font-medium')}>
                                                        {p.name}
                                                    </span>
                                                    <Badge
                                                        variant="outline"
                                                        className={cn(
                                                            'text-[10px] px-1 py-0 h-4 shrink-0 font-normal',
                                                            p.type === 'service'
                                                                ? 'border-violet-500/30 text-violet-600 bg-violet-500/5'
                                                                : 'text-muted-foreground'
                                                        )}
                                                    >
                                                        {p.type === 'service' ? 'SERVICIO' : p.sku || '—'}
                                                    </Badge>
                                                </label>
                                            )
                                        })
                                    )}
                                </div>

                                {/* Summary of selection */}
                                {totalSelected > 0 && (
                                    <p className="text-[11px] text-muted-foreground">
                                        Aplica a{' '}
                                        <span className="font-medium text-foreground">{totalSelected}</span>{' '}
                                        {totalSelected === 1 ? 'ítem' : 'ítems'} seleccionados
                                        {applyToRepairs && selectedProductIds.length > 0 && ' (incluye reparaciones)'}
                                    </p>
                                )}
                                {unknownSelectedCount > 0 && (
                                    <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-[11px] text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
                                        <div className="flex items-center justify-between gap-2">
                                            <span>Hay {unknownSelectedCount} seleccionados que ya no están disponibles.</span>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 px-2 text-[11px]"
                                                onClick={() => {
                                                    const known = new Set(products.map(p => p.id))
                                                    setSelectedProductIds(prev => prev.filter(id => known.has(id)))
                                                }}
                                            >
                                                Quitar
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </FormSection>

                        {/* ── 5. Estado ─────────────────────────────────────── */}
                        <div className={cn(
                            'flex items-center justify-between rounded-xl border px-4 py-3 transition-colors',
                            formData.is_active
                                ? 'border-emerald-500/30 bg-emerald-500/5'
                                : 'border-border bg-muted/30'
                        )}>
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    'flex h-8 w-8 items-center justify-center rounded-lg',
                                    formData.is_active ? 'bg-emerald-500/15' : 'bg-muted'
                                )}>
                                    <Zap className={cn(
                                        'h-4 w-4',
                                        formData.is_active ? 'text-emerald-600' : 'text-muted-foreground'
                                    )} />
                                </div>
                                <div>
                                    <p className="text-sm font-medium">
                                        {formData.is_active ? 'Promoción activa' : 'Promoción inactiva'}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {formData.is_active
                                            ? 'Disponible para usar inmediatamente'
                                            : 'No aparecerá en el POS ni marketplace'}
                                    </p>
                                </div>
                            </div>
                            <Switch
                                id="is_active"
                                checked={formData.is_active}
                                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                            />
                        </div>

                    </div>

                    {/* ── Footer ──────────────────────────────────────────────── */}
                    <DialogFooter className="px-6 py-4 border-t shrink-0 bg-muted/20">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={saving}
                            className="h-9"
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            disabled={saving || validatingCode || (isDuplicating && codeStatus !== 'available')}
                            className={cn(
                                'h-9 gap-2',
                                modalVariant === 'create' && 'bg-emerald-600 hover:bg-emerald-700',
                                modalVariant === 'duplicate' && 'bg-amber-600 hover:bg-amber-700',
                            )}
                        >
                            {saving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <CheckSquare className="h-4 w-4" />
                            )}
                            {isEditing
                                ? 'Guardar cambios'
                                : isDuplicating
                                    ? 'Crear copia'
                                    : 'Crear promoción'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
