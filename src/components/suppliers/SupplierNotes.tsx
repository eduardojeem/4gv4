'use client'

import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Check, FileText, Pencil, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

/** Igual que el limite del schema de la API (suppliers.notes). */
const MAX_LENGTH = 2000

export function SupplierNotes({
    supplierId,
    notes,
    updatedAt,
    onSaved,
}: {
    supplierId: string
    notes?: string | null
    updatedAt?: string | null
    /** Devuelve las notas guardadas para que el padre refresque su estado. */
    onSaved?: (nextNotes: string | null) => void
}) {
    const saved = notes?.trim() || ''
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState(saved)
    const [saving, setSaving] = useState(false)

    // Si el proveedor cambia (o llegan notas nuevas desde afuera) y no se esta
    // editando, el borrador sigue al valor guardado.
    useEffect(() => {
        if (!editing) setDraft(saved)
    }, [saved, editing, supplierId])

    const trimmedDraft = draft.trim()
    const hasChanges = trimmedDraft !== saved
    const remaining = MAX_LENGTH - draft.length
    const isOverLimit = remaining < 0

    const lastUpdatedLabel = useMemo(() => {
        if (!updatedAt) return null
        const date = new Date(updatedAt)
        if (!Number.isFinite(date.getTime())) return null
        return format(date, "d 'de' MMMM yyyy, HH:mm", { locale: es })
    }, [updatedAt])

    const save = async (nextValue: string) => {
        setSaving(true)
        try {
            const response = await fetch('/api/suppliers', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: supplierId, notes: nextValue || null }),
            })
            const payload = await response.json().catch(() => null) as { success?: boolean; error?: string } | null

            if (!response.ok || payload?.success === false) {
                throw new Error(payload?.error || 'No se pudieron guardar las notas.')
            }

            toast.success(nextValue ? 'Notas guardadas' : 'Notas eliminadas')
            setEditing(false)
            onSaved?.(nextValue || null)
        } catch (error) {
            toast.error('No se pudieron guardar las notas', {
                description: error instanceof Error ? error.message : 'Intenta nuevamente.',
            })
        } finally {
            setSaving(false)
        }
    }

    const cancel = () => {
        setDraft(saved)
        setEditing(false)
    }

    // ── Modo edicion ──────────────────────────────────────────────────────────
    if (editing) {
        return (
            <div className="space-y-3">
                <Textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    rows={10}
                    autoFocus
                    disabled={saving}
                    aria-label="Notas del proveedor"
                    aria-invalid={isOverLimit}
                    placeholder="Condiciones acordadas, contactos alternativos, días de entrega, observaciones de calidad…"
                    className="resize-y text-sm"
                    onKeyDown={(event) => {
                        // Atajo estandar para guardar sin sacar las manos del teclado.
                        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && hasChanges && !isOverLimit) {
                            event.preventDefault()
                            void save(trimmedDraft)
                        }
                        if (event.key === 'Escape') {
                            event.preventDefault()
                            cancel()
                        }
                    }}
                />

                <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className={cn('text-xs', isOverLimit ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                        {isOverLimit
                            ? `Te pasaste por ${Math.abs(remaining)} caracteres`
                            : `${remaining} caracteres disponibles`}
                        <span className="ml-2 hidden sm:inline text-muted-foreground">
                            · Ctrl+Enter para guardar, Esc para cancelar
                        </span>
                    </p>

                    <div className="flex gap-2">
                        <Button variant="ghost" size="sm" className="gap-1.5" onClick={cancel} disabled={saving}>
                            <X className="h-3.5 w-3.5" />
                            Cancelar
                        </Button>
                        <Button
                            size="sm"
                            className="gap-1.5"
                            onClick={() => void save(trimmedDraft)}
                            disabled={saving || !hasChanges || isOverLimit}
                        >
                            <Check className="h-3.5 w-3.5" />
                            {saving ? 'Guardando…' : 'Guardar'}
                        </Button>
                    </div>
                </div>
            </div>
        )
    }

    // ── Estado vacio ──────────────────────────────────────────────────────────
    if (!saved) {
        return (
            <div role="status" className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center">
                <FileText className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm font-medium">Todavía no hay notas</p>
                <p className="max-w-sm text-xs text-muted-foreground">
                    Anotá condiciones acordadas, contactos alternativos o cualquier detalle
                    que convenga tener a mano al trabajar con este proveedor.
                </p>
                <Button variant="outline" size="sm" className="mt-2 gap-1.5" onClick={() => setEditing(true)}>
                    <Pencil className="h-3.5 w-3.5" />
                    Escribir una nota
                </Button>
            </div>
        )
    }

    // ── Lectura ───────────────────────────────────────────────────────────────
    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                {lastUpdatedLabel ? (
                    <p className="text-xs text-muted-foreground">Última modificación: {lastUpdatedLabel}</p>
                ) : <span />}

                <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditing(true)}>
                        <Pencil className="h-3.5 w-3.5" />
                        Editar
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-muted-foreground hover:text-destructive"
                        disabled={saving}
                        onClick={() => void save('')}
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                        Borrar
                    </Button>
                </div>
            </div>

            <div className="rounded-lg border bg-muted/20 p-4">
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{saved}</p>
            </div>
        </div>
    )
}
