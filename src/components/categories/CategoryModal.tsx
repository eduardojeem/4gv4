'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { validateCategoryInput } from '@/hooks/useCategories'
import type { Category } from '@/hooks/useCategories'
import { Loader2, FolderOpen, FolderTree, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CategoryModalProps {
    isOpen: boolean
    onClose: () => void
    onSubmit: (data: { name: string; description: string; parent_id: string | null; is_active: boolean }) => Promise<void>
    category?: Category
    categories: Category[]
    loading?: boolean
    initialParentId?: string | null
}

function stringToColorClass(str: string): string {
    const colors = ['text-violet-600', 'text-blue-600', 'text-emerald-600', 'text-amber-600', 'text-rose-600', 'text-cyan-600', 'text-orange-600', 'text-pink-600', 'text-indigo-600', 'text-teal-600']
    let hash = 0
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
    return colors[Math.abs(hash) % colors.length]
}

export function CategoryModal({
    isOpen,
    onClose,
    onSubmit,
    category,
    categories,
    initialParentId
}: CategoryModalProps) {
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [parentId, setParentId] = useState<string>('none')
    const [isActive, setIsActive] = useState(true)
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        if (isOpen) {
            if (category) {
                setName(category.name)
                setDescription(category.description || '')
                setParentId(category.parent_id || 'none')
                setIsActive(category.is_active)
            } else {
                setName('')
                setDescription('')
                setParentId(initialParentId || 'none')
                setIsActive(true)
            }
            setErrors({})
            setSubmitting(false)
        }
    }, [isOpen, category, initialParentId])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const { valid, errors: validationErrors } = validateCategoryInput({ name, description })
        if (!valid) {
            setErrors(validationErrors)
            return
        }
        setSubmitting(true)
        try {
            await onSubmit({
                name: name.trim(),
                description: description.trim(),
                parent_id: parentId === 'none' ? null : parentId,
                is_active: isActive
            })
            onClose()
        } catch {
            // handled by parent toast
        } finally {
            setSubmitting(false)
        }
    }

    // Prevent circular hierarchy
    const blockedParentIds = useMemo(() => {
        if (!category) return new Set<string>()
        const childByParent = new Map<string, string[]>()
        for (const c of categories) {
            if (!c.parent_id) continue
            const bucket = childByParent.get(c.parent_id) ?? []
            bucket.push(c.id)
            childByParent.set(c.parent_id, bucket)
        }
        const blocked = new Set<string>([category.id])
        const stack = [category.id]
        while (stack.length > 0) {
            const cur = stack.pop()!
            for (const childId of childByParent.get(cur) ?? []) {
                if (!blocked.has(childId)) { blocked.add(childId); stack.push(childId) }
            }
        }
        return blocked
    }, [categories, category])

    const availableParents = categories.filter(c => !blockedParentIds.has(c.id))
    const selectedParent = availableParents.find(c => c.id === parentId)

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-primary/10 p-2.5">
                            <FolderOpen className={cn("h-5 w-5", name ? stringToColorClass(name) : "text-primary")} />
                        </div>
                        <div>
                            <DialogTitle className="text-lg">
                                {category ? 'Editar Categoría' : 'Nueva Categoría'}
                            </DialogTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {category ? `Editando: ${category.name}` : 'Completá los datos para crear la categoría'}
                            </p>
                        </div>
                    </div>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-5 pt-2">
                    {/* Name */}
                    <div className="space-y-1.5">
                        <Label htmlFor="cat-name">
                            Nombre <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="cat-name"
                            value={name}
                            onChange={(e) => {
                                setName(e.target.value)
                                if (errors.name) setErrors({ ...errors, name: '' })
                            }}
                            placeholder="Ej: Electrónica, Accesorios..."
                            className={errors.name ? 'border-red-500 focus-visible:ring-red-500' : ''}
                            autoFocus
                        />
                        {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
                    </div>

                    {/* Description */}
                    <div className="space-y-1.5">
                        <Label htmlFor="cat-desc">Descripción</Label>
                        <Textarea
                            id="cat-desc"
                            value={description}
                            onChange={(e) => {
                                setDescription(e.target.value)
                                if (errors.description) setErrors({ ...errors, description: '' })
                            }}
                            placeholder="Describe brevemente esta categoría..."
                            className={cn("resize-none", errors.description ? 'border-red-500' : '')}
                            rows={2}
                        />
                        {errors.description && <p className="text-xs text-red-500">{errors.description}</p>}
                    </div>

                    {/* Parent + Status row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="flex items-center gap-1.5">
                                <FolderTree className="h-3.5 w-3.5 text-muted-foreground" />
                                Categoría Padre
                            </Label>
                            <Select value={parentId} onValueChange={setParentId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Ninguna (Raíz)" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">
                                        <span className="text-muted-foreground">Ninguna (Raíz)</span>
                                    </SelectItem>
                                    {availableParents.map((c) => (
                                        <SelectItem key={c.id} value={c.id}>
                                            {c.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {selectedParent && (
                                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <ChevronRight className="h-3 w-3" />
                                    Sub de: <span className="font-medium text-foreground">{selectedParent.name}</span>
                                </p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label>Estado</Label>
                            <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
                                <div className="flex items-center gap-2">
                                    <span className={cn(
                                        "h-2 w-2 rounded-full",
                                        isActive ? "bg-green-500" : "bg-gray-400"
                                    )} />
                                    <span className="text-sm font-medium">
                                        {isActive ? 'Activa' : 'Inactiva'}
                                    </span>
                                </div>
                                <Switch
                                    checked={isActive}
                                    onCheckedChange={setIsActive}
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="pt-2">
                        <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={submitting}>
                            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {category ? 'Guardar Cambios' : 'Crear Categoría'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
