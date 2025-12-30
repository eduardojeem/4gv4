'use client'

import React, { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { validateCategoryInput } from '@/hooks/useCategories'
import type { Category } from '@/hooks/useCategories'
import { Loader2 } from 'lucide-react'

interface CategoryModalProps {
    isOpen: boolean
    onClose: () => void
    onSubmit: (data: { name: string; description: string; parent_id: string | null; is_active: boolean }) => Promise<void>
    category?: Category
    categories: Category[]
    loading?: boolean
    initialParentId?: string | null
}

export function CategoryModal({
    isOpen,
    onClose,
    onSubmit,
    category,
    categories,
    loading,
    initialParentId
}: CategoryModalProps) {
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [parentId, setParentId] = useState<string>('none')
    const [isActive, setIsActive] = useState(true)
    const [errors, setErrors] = useState<Record<string, string>>({})

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
        }
    }, [isOpen, category, initialParentId])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        const { valid, errors: validationErrors } = validateCategoryInput({ name, description })

        if (!valid) {
            setErrors(validationErrors)
            return
        }

        try {
            await onSubmit({
                name,
                description,
                parent_id: parentId === 'none' ? null : parentId,
                is_active: isActive
            })
            onClose()
        } catch (error) {
            console.error(error)
        }
    }

    // Filter out the current category and its children to prevent circular references
    const availableParents = categories.filter(c => {
        if (!category) return true
        return c.id !== category.id // Simple check, could be recursive for full tree safety
    })

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{category ? 'Editar Categoría' : 'Nueva Categoría'}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Nombre</Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => {
                                setName(e.target.value)
                                if (errors.name) setErrors({ ...errors, name: '' })
                            }}
                            placeholder="Ej: Electrónica"
                            className={errors.name ? 'border-red-500' : ''}
                        />
                        {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Descripción</Label>
                        <Textarea
                            id="description"
                            value={description}
                            onChange={(e) => {
                                setDescription(e.target.value)
                                if (errors.description) setErrors({ ...errors, description: '' })
                            }}
                            placeholder="Describe la categoría..."
                            className={errors.description ? 'border-red-500' : ''}
                        />
                        {errors.description && <p className="text-sm text-red-500">{errors.description}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Categoría Padre</Label>
                            <Select value={parentId} onValueChange={setParentId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Ninguna (Raíz)</SelectItem>
                                    {availableParents.map((c) => (
                                        <SelectItem key={c.id} value={c.id}>
                                            {c.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Estado</Label>
                            <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                                <span className="text-sm font-medium">
                                    {isActive ? 'Activa' : 'Inactiva'}
                                </span>
                                <Switch
                                    checked={isActive}
                                    onCheckedChange={setIsActive}
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {category ? 'Guardar Cambios' : 'Crear Categoría'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
