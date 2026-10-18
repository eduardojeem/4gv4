'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { validateCategoryInput } from '@/hooks/useCategories'
import type { Category } from '@/hooks/useCategories'
import { Loader2, FolderOpen, FolderTree, ChevronRight, Sparkles, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useGlobalCategorySuggest } from '@/hooks/useGlobalCategorySuggest'
import type { GlobalCategorySuggestion } from '@/hooks/useGlobalCategorySuggest'
import type { GlobalCategory } from '@/lib/categories/global-catalog'

interface CategoryModalProps {
    isOpen: boolean
    onClose: () => void
    onSubmit: (data: { name: string; description: string; parent_id: string | null; global_category_id: string | null; is_active: boolean }) => Promise<void>
    category?: Category
    categories: Category[]
    loading?: boolean
    initialParentId?: string | null
    /** Catálogo global del rubro, para elegir o mostrar el vínculo. */
    globalCatalog?: GlobalCategory[]
}

const NO_GLOBAL = 'none'

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
    initialParentId,
    globalCatalog = [],
}: CategoryModalProps) {
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [parentId, setParentId] = useState<string>('none')
    const [isActive, setIsActive] = useState(true)
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [submitting, setSubmitting] = useState(false)
    // Mapeo a categoría global (opcional, mejora el marketplace)
    const [globalCategoryId, setGlobalCategoryId] = useState<string | null>(null)
    const [globalCategoryName, setGlobalCategoryName] = useState<string>('')

    // Sugerencias mientras no esté vinculada: al crear y también al editar.
    const { suggestions, isLoading: suggestLoading, dismiss: dismissSuggestions } =
      useGlobalCategorySuggest(name, isOpen && !globalCategoryId)

    // «Padre / Hijo», para elegir del catálogo sin confundir dos «Accesorios».
    const globalOptions = useMemo(() => {
        const byId = new Map(globalCatalog.map((item) => [item.id, item]))
        return globalCatalog.map((item) => {
            const parent = item.parent_id ? byId.get(item.parent_id) : undefined
            return { id: item.id, label: parent ? `${parent.name} / ${item.name}` : item.name }
        })
    }, [globalCatalog])

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
            // Al editar se parte del vínculo que ya tiene. Antes se reiniciaba y se
            // guardaba vacío: cualquier edición desvinculaba la categoría del marketplace.
            const linkedId = category?.global_category_id ?? null
            setGlobalCategoryId(linkedId)
            setGlobalCategoryName(linkedId ? globalCatalog.find((item) => item.id === linkedId)?.name ?? 'Categoría del marketplace' : '')
        }
    }, [isOpen, category, initialParentId, globalCatalog])

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
                is_active: isActive,
                global_category_id: globalCategoryId ?? null,
            })
            onClose()
        } catch {
            // handled by parent toast
        } finally {
            setSubmitting(false)
        }
    }

    const handlePickSuggestion = (s: GlobalCategorySuggestion) => {
        setGlobalCategoryId(s.id)
        setGlobalCategoryName(s.name)
        dismissSuggestions()
    }

    const handleClearGlobal = () => {
        setGlobalCategoryId(null)
        setGlobalCategoryName('')
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
                                {category ? 'Editar categoría' : 'Nueva categoría'}
                            </DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                                {category ? `Editando: ${category.name}` : 'Completá los datos para crear la categoría'}
                            </DialogDescription>
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

                        {/* Panel de sugerencias de categoría global */}
                        {!globalCategoryId && suggestions.length > 0 && (
                            <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 dark:border-blue-800 dark:bg-blue-950/30">
                                <div className="mb-2 flex items-center justify-between">
                                    <p className="flex items-center gap-1.5 text-xs font-medium text-blue-700 dark:text-blue-300">
                                        <Sparkles className="h-3.5 w-3.5" />
                                        ¿Querés usar una categoría del marketplace?
                                    </p>
                                    <button
                                        type="button"
                                        onClick={dismissSuggestions}
                                        className="text-blue-500 hover:text-blue-700"
                                        aria-label="Ocultar sugerencias"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {suggestions.map((s) => (
                                        <button
                                            key={s.id}
                                            type="button"
                                            onClick={() => handlePickSuggestion(s)}
                                            className={cn(
                                                'flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                                                'border-blue-200 bg-white text-blue-700 hover:border-blue-400 hover:bg-blue-50',
                                                'dark:border-blue-700 dark:bg-slate-900 dark:text-blue-300'
                                            )}
                                        >
                                            {s.parent_name ? (
                                                <span className="text-blue-400">{s.parent_name} /</span>
                                            ) : null}
                                            {s.name}
                                            <span className="text-blue-300">
                                                {Math.round(s.similarity * 100)}%
                                            </span>
                                        </button>
                                    ))}
                                </div>
                                <p className="mt-1.5 text-xs text-blue-700/80 dark:text-blue-300/80">
                                    Asociar tu categoría al marketplace mejora la visibilidad de tus productos.
                                </p>
                            </div>
                        )}

                        {/* Categoría global seleccionada */}
                        {globalCategoryId && (
                            <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 dark:border-emerald-800 dark:bg-emerald-950/30">
                                <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                                    <Sparkles className="h-3.5 w-3.5" />
                                    Vinculada al marketplace como:
                                    <span className="font-semibold">{globalCategoryName}</span>
                                </p>
                                <button
                                    type="button"
                                    onClick={handleClearGlobal}
                                    className="text-emerald-500 hover:text-emerald-700"
                                    aria-label="Quitar el vínculo con el marketplace"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        )}

                        {!globalCategoryId && suggestLoading && (
                            <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Buscando similitudes en el marketplace…
                            </p>
                        )}
                    </div>

                    {/* Elegir a mano del catálogo, al crear o al editar */}
                    {globalOptions.length > 0 && (
                        <div className="space-y-1.5">
                            <Label htmlFor="cat-global">Categoría del marketplace</Label>
                            <Select
                                value={globalCategoryId ?? NO_GLOBAL}
                                onValueChange={(value) => {
                                    if (value === NO_GLOBAL) {
                                        handleClearGlobal()
                                        return
                                    }
                                    setGlobalCategoryId(value)
                                    setGlobalCategoryName(globalCatalog.find((item) => item.id === value)?.name ?? '')
                                    dismissSuggestions()
                                }}
                            >
                                <SelectTrigger id="cat-global">
                                    <SelectValue placeholder="Sin vincular" />
                                </SelectTrigger>
                                <SelectContent className="max-h-72">
                                    <SelectItem value={NO_GLOBAL}>
                                        <span className="text-muted-foreground">Sin vincular</span>
                                    </SelectItem>
                                    {globalOptions.map((option) => (
                                        <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                Agrupa tus productos con los de otras tiendas en el marketplace. No cambia el nombre de tu categoría.
                            </p>
                        </div>
                    )}

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
                            placeholder="Describí brevemente esta categoría…"
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
                                Categoría padre
                            </Label>
                            <Select value={parentId} onValueChange={setParentId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Ninguna (principal)" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">
                                        <span className="text-muted-foreground">Ninguna (principal)</span>
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
                            {category ? 'Guardar cambios' : 'Crear categoría'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
