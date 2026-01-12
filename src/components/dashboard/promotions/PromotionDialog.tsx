'use client'

import { useState, useEffect } from 'react'
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
import { Calendar as CalendarIcon, Loader2, Sparkles } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import type { Promotion, PromotionType } from '@/types/promotion'
import { createClient } from '@/lib/supabase/client'

interface PromotionDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    promotion?: Promotion | null
    onSave: (data: Omit<Promotion, 'id' | 'created_at' | 'updated_at'>) => Promise<boolean>
    onUpdate: (id: string, data: Partial<Promotion>) => Promise<boolean>
    validateCode: (code: string, excludeId?: string) => Promise<boolean>
}

export function PromotionDialog({
    open,
    onOpenChange,
    promotion,
    onSave,
    onUpdate,
    validateCode
}: PromotionDialogProps) {
    const isEditing = !!promotion

    const [formData, setFormData] = useState({
        name: '',
        code: '',
        description: '',
        type: 'percentage' as PromotionType,
        value: 0,
        min_purchase: 0,
        max_discount: 0,
        start_date: null as Date | null,
        end_date: null as Date | null,
        is_active: true,
        usage_limit: null as number | null,
        applicable_products: [] as string[],
    })

    const [errors, setErrors] = useState<Record<string, string>>({})
    const [saving, setSaving] = useState(false)
    const [validatingCode, setValidatingCode] = useState(false)
    const [applyToRepairs, setApplyToRepairs] = useState(false)
    const [products, setProducts] = useState<Array<{ id: string; name: string; sku: string; type: 'product' | 'service' }>>([])
    const [productSearch, setProductSearch] = useState('')
    const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])

    // Initialize form when dialog opens
    useEffect(() => {
        if (open && promotion) {
            setFormData({
                name: promotion.name,
                code: promotion.code,
                description: promotion.description || '',
                type: promotion.type,
                value: promotion.value,
                min_purchase: promotion.min_purchase || 0,
                max_discount: promotion.max_discount || 0,
                start_date: promotion.start_date ? new Date(promotion.start_date) : null,
                end_date: promotion.end_date ? new Date(promotion.end_date) : null,
                is_active: promotion.is_active,
                usage_limit: promotion.usage_limit || null,
                applicable_products: promotion.applicable_products || [],
            })
            setSelectedProductIds(promotion.applicable_products || [])
            setApplyToRepairs(Array.isArray((promotion as any).applicable_categories) && (promotion as any).applicable_categories.includes('service'))
        } else if (open && !promotion) {
            // Reset form for new promotion
            setFormData({
                name: '',
                code: '',
                description: '',
                type: 'percentage',
                value: 0,
                min_purchase: 0,
                max_discount: 0,
                start_date: null,
                end_date: null,
                is_active: true,
                usage_limit: null,
                applicable_products: [],
            })
            setSelectedProductIds([])
            setApplyToRepairs(false)
        }
        setErrors({})
    }, [open, promotion])

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
                const { data: repairData, error: repairError } = await supabase
                    .from('repairs')
                    .select('id,device_model,device_brand')
                    .order('device_model', { ascending: true })
                const repairRows = !repairError && Array.isArray(repairData)
                    ? (repairData as any[]).map(row => ({
                        id: row.id,
                        name: `Reparación ${row.device_brand || ''} ${row.device_model || ''}`.trim(),
                        sku: row.id,
                        type: 'service' as const
                    }))
                    : []
                setProducts([...productRows, ...repairRows])
            }
        })()
    }, [open])

    const generateCode = () => {
        const randomCode = `PROMO${Math.random().toString(36).substring(2, 8).toUpperCase()}`
        setFormData(prev => ({ ...prev, code: randomCode }))
    }

    const validateForm = async () => {
        const newErrors: Record<string, string> = {}

        if (!formData.name.trim()) {
            newErrors.name = 'El nombre es requerido'
        }

        if (!formData.code.trim()) {
            newErrors.code = 'El código es requerido'
        } else {
            setValidatingCode(true)
            const isCodeValid = await validateCode(formData.code, promotion?.id)
            setValidatingCode(false)
            if (!isCodeValid) {
                newErrors.code = 'Este código ya está en uso'
            }
        }

        if (formData.value <= 0) {
            newErrors.value = 'El valor debe ser mayor a 0'
        }

        if (formData.type === 'percentage' && formData.value > 100) {
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

        const submitData = {
            name: formData.name.trim(),
            code: formData.code.trim().toUpperCase(),
            description: formData.description.trim() || undefined,
            type: formData.type,
            value: formData.value,
            min_purchase: formData.min_purchase > 0 ? formData.min_purchase : undefined,
            max_discount: formData.max_discount > 0 ? formData.max_discount : undefined,
            start_date: formData.start_date ? formData.start_date.toISOString() : null,
            end_date: formData.end_date ? formData.end_date.toISOString() : null,
            is_active: formData.is_active,
            usage_limit: formData.usage_limit || null,
            applicable_products: selectedProductIds.length > 0 ? selectedProductIds : undefined,
            applicable_categories: applyToRepairs ? ['service'] : undefined,
        }

        let success = false
        if (isEditing) {
            success = await onUpdate(promotion.id, submitData)
        } else {
            success = await onSave(submitData as any)
        }

        setSaving(false)

        if (success) {
            onOpenChange(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {isEditing ? 'Editar promoción' : 'Nueva promoción'}
                    </DialogTitle>
                    <DialogDescription>
                        {isEditing
                            ? 'Actualiza la información de la promoción'
                            : 'Completa los datos para crear una nueva promoción'}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Basic Info */}
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Nombre *</Label>
                            <Input
                                id="name"
                                placeholder="Ej: Descuento de Verano"
                                value={formData.name}
                                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                className={errors.name ? 'border-red-500' : ''}
                            />
                            {errors.name && (
                                <p className="text-sm text-red-500">{errors.name}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="code">Código *</Label>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={generateCode}
                                    className="h-7 gap-1 text-xs"
                                >
                                    <Sparkles className="h-3 w-3" />
                                    Generar
                                </Button>
                            </div>
                            <Input
                                id="code"
                                placeholder="VERANO2024"
                                value={formData.code}
                                onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                                className={errors.code ? 'border-red-500' : ''}
                            />
                            {errors.code && (
                                <p className="text-sm text-red-500">{errors.code}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">Descripción</Label>
                            <Textarea
                                id="description"
                                placeholder="Descripción de la promoción (opcional)"
                                value={formData.description}
                                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                rows={3}
                            />
                        </div>
                </div>

                    {/* Discount Config */}
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="type">Tipo de descuento *</Label>
                            <Select
                                value={formData.type}
                                onValueChange={(value: PromotionType) => setFormData(prev => ({ ...prev, type: value }))}
                            >
                                <SelectTrigger id="type">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="percentage">Porcentaje</SelectItem>
                                    <SelectItem value="fixed">Monto Fijo</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="value">
                                {formData.type === 'percentage' ? 'Porcentaje (%)' : 'Monto'} *
                            </Label>
                            <Input
                                id="value"
                                type="number"
                                min="0"
                                max={formData.type === 'percentage' ? '100' : undefined}
                                step={formData.type === 'percentage' ? '1' : '1000'}
                                value={formData.value}
                                onChange={(e) => setFormData(prev => ({ ...prev, value: parseFloat(e.target.value) || 0 }))}
                                className={errors.value ? 'border-red-500' : ''}
                            />
                            {errors.value && (
                                <p className="text-sm text-red-500">{errors.value}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="min_purchase">Compra mínima</Label>
                            <Input
                                id="min_purchase"
                                type="number"
                                min="0"
                                step="1000"
                                value={formData.min_purchase}
                                onChange={(e) => setFormData(prev => ({ ...prev, min_purchase: parseFloat(e.target.value) || 0 }))}
                            />
                        </div>

                        {formData.type === 'percentage' && (
                            <div className="space-y-2">
                                <Label htmlFor="max_discount">Descuento máximo</Label>
                                <Input
                                    id="max_discount"
                                    type="number"
                                    min="0"
                                    step="1000"
                                    value={formData.max_discount}
                                    onChange={(e) => setFormData(prev => ({ ...prev, max_discount: parseFloat(e.target.value) || 0 }))}
                                />
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="usage_limit">Límite de uso</Label>
                            <Input
                                id="usage_limit"
                                type="number"
                                min="0"
                                placeholder="Sin límite"
                                value={formData.usage_limit || ''}
                                onChange={(e) => setFormData(prev => ({ ...prev, usage_limit: e.target.value ? parseInt(e.target.value) : null }))}
                            />
                        </div>
                    </div>

                    {/* Applicable Products */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label>Productos aplicables (opcional)</Label>
                            {selectedProductIds.length > 0 && (
                                <span className="text-xs text-muted-foreground">{selectedProductIds.length} seleccionados</span>
                            )}
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Switch id="apply-repairs" checked={applyToRepairs} onCheckedChange={setApplyToRepairs} />
                                <Label htmlFor="apply-repairs">Aplicar a reparaciones</Label>
                            </div>
                            {applyToRepairs && <span className="text-xs text-muted-foreground">Categoría: service</span>}
                        </div>
                        <Input
                            placeholder="Buscar productos por nombre o SKU"
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                        />
                        <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1">
                            {products
                                .filter(p => {
                                    const q = productSearch.trim().toLowerCase()
                                    if (!q) return true
                                    return p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q)
                                })
                                .map(p => {
                                    const checked = selectedProductIds.includes(p.id)
                                    return (
                                        <label key={p.id} className="flex items-center justify-between text-sm py-1">
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    className="h-4 w-4"
                                                    checked={checked}
                                                    onChange={(e) => {
                                                        setSelectedProductIds(prev => {
                                                            if (e.target.checked) return [...prev, p.id]
                                                            return prev.filter(id => id !== p.id)
                                                        })
                                                    }}
                                                />
                                                <span>{p.name}</span>
                                            </div>
                                            <span className="text-muted-foreground text-xs">{p.type === 'service' ? 'SERVICIO' : p.sku}</span>
                                        </label>
                                    )
                                })}
                            {products.length === 0 && (
                                <p className="text-xs text-muted-foreground">No se encontraron productos</p>
                            )}
                        </div>
                        {selectedProductIds.length > 0 && (
                            <div className="flex justify-end">
                                <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedProductIds([])}>Quitar todos</Button>
                            </div>
                        )}
                    </div>

                    {/* Dates */}
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Fecha de inicio</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            'w-full justify-start text-left font-normal',
                                            !formData.start_date && 'text-muted-foreground'
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {formData.start_date ? (
                                            format(formData.start_date, "PPP", { locale: es })
                                        ) : (
                                            'Seleccionar fecha'
                                        )}
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

                        <div className="space-y-2">
                            <Label>Fecha de fin</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            'w-full justify-start text-left font-normal',
                                            !formData.end_date && 'text-muted-foreground',
                                            errors.end_date && 'border-red-500'
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {formData.end_date ? (
                                            format(formData.end_date, "PPP", { locale: es })
                                        ) : (
                                            'Seleccionar fecha'
                                        )}
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
                                <p className="text-sm text-red-500">{errors.end_date}</p>
                            )}
                        </div>
                    </div>

                    {/* Active Status */}
                    <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                        <div className="space-y-0.5">
                            <Label htmlFor="is_active" className="font-medium">
                                Promoción activa
                            </Label>
                            <p className="text-sm text-muted-foreground">
                                La promoción estará disponible para usar inmediatamente
                            </p>
                        </div>
                        <Switch
                            id="is_active"
                            checked={formData.is_active}
                            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                        />
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={saving}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={saving || validatingCode}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isEditing ? 'Guardar cambios' : 'Crear promoción'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
