'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { X, SlidersHorizontal, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet'
import { Card, CardContent } from '@/components/ui/card'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FilterConfig {
    key: string
    label: string
    type: 'text' | 'select' | 'date' | 'dateRange' | 'number'
    options?: { label: string; value: string | number }[]
    placeholder?: string
    min?: number
    max?: number
}

export interface FilterPanelProps {
    filters: FilterConfig[]
    values: Record<string, string | number>
    onChange: (values: Record<string, string | number>) => void
    onClear: () => void
    orientation?: 'horizontal' | 'vertical'
    collapsible?: boolean
    className?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getActiveCount(values: Record<string, string | number>) {
    return Object.values(values).filter(v => v !== '' && v !== null && v !== undefined).length
}

function getActiveLabels(filters: FilterConfig[], values: Record<string, string | number>): { key: string; label: string; display: string }[] {
    return filters.flatMap(f => {
        const v = values[f.key]
        if (v === '' || v === null || v === undefined) return []
        let display = String(v)
        if (f.type === 'select') {
            const opt = f.options?.find(o => String(o.value) === String(v))
            display = opt?.label ?? display
        }
        if (f.type === 'date') {
            try { display = new Date(v).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }) } catch { /* noop */ }
        }
        return [{ key: f.key, label: f.label, display }]
    })
}

// ─── Single filter field ──────────────────────────────────────────────────────

function FilterField({ filter, value, onChange }: { filter: FilterConfig; value: string | number; onChange: (v: string | number) => void }) {
    switch (filter.type) {
        case 'text':
            return (
                <Input
                    placeholder={filter.placeholder || filter.label}
                    value={value || ''}
                    onChange={e => onChange(e.target.value)}
                    className="h-8 text-sm w-full"
                />
            )
        case 'select':
            return (
                <Select
                    value={(value === '' || value === null || value === undefined) ? '' : String(value)}
                    onValueChange={v => onChange(v === '__empty__' ? '' : v)}
                >
                    <SelectTrigger className="h-8 text-sm w-full">
                        <SelectValue placeholder={filter.placeholder || `Seleccionar ${filter.label}`} />
                    </SelectTrigger>
                    <SelectContent>
                        {filter.options?.map(opt => (
                            <SelectItem key={opt.value} value={opt.value === '' ? '__empty__' : String(opt.value)}>
                                {opt.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            )
        case 'number':
            return (
                <Input
                    type="number"
                    placeholder={filter.placeholder || filter.label}
                    value={value || ''}
                    onChange={e => onChange(e.target.value)}
                    min={filter.min}
                    max={filter.max}
                    className="h-8 text-sm w-full"
                />
            )
        case 'date':
            return (
                <Input
                    type="date"
                    value={value || ''}
                    onChange={e => onChange(e.target.value)}
                    className="h-8 text-sm w-full"
                />
            )
        default:
            return null
    }
}

// ─── Fields grid ─────────────────────────────────────────────────────────────

function FiltersGrid({ filters, values, onChange, orientation }: {
    filters: FilterConfig[]
    values: Record<string, string | number>
    onChange: (key: string, value: string | number) => void
    orientation: 'horizontal' | 'vertical'
}) {
    return (
        <div className={cn(
            'gap-3',
            orientation === 'horizontal'
                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                : 'flex flex-col'
        )}>
            {filters.map(f => (
                <div key={f.key} className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{f.label}</Label>
                    <FilterField filter={f} value={values[f.key]} onChange={v => onChange(f.key, v)} />
                </div>
            ))}
        </div>
    )
}

// ─── Active filter tags ───────────────────────────────────────────────────────

function ActiveTags({ activeLabels, onRemove }: {
    activeLabels: { key: string; label: string; display: string }[]
    onRemove: (key: string) => void
}) {
    if (activeLabels.length === 0) return null
    return (
        <div className="flex flex-wrap items-center gap-1.5">
            {activeLabels.map(({ key, label, display }) => (
                <span
                    key={key}
                    className="inline-flex items-center gap-1 h-6 pl-2.5 pr-1.5 rounded-full border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-[11px] font-medium"
                >
                    <span className="opacity-70">{label}:</span>
                    <span>{display}</span>
                    <button
                        type="button"
                        onClick={() => onRemove(key)}
                        className="ml-0.5 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800 p-0.5 transition-colors"
                    >
                        <X className="h-2.5 w-2.5" />
                    </button>
                </span>
            ))}
        </div>
    )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function FilterPanel({
    filters,
    values,
    onChange,
    onClear,
    orientation = 'horizontal',
    collapsible = false,
    className,
}: FilterPanelProps) {
    const [open, setOpen] = useState(false)

    const handleChange = (key: string, value: string | number) => onChange({ ...values, [key]: value })
    const handleRemoveOne = (key: string) => onChange({ ...values, [key]: '' })

    const activeCount = getActiveCount(values)
    const activeLabels = getActiveLabels(filters, values)
    const hasActive = activeCount > 0

    // ── Collapsible (inline accordion) ──
    if (collapsible) {
        return (
            <div className={cn('space-y-2', className)}>
                {/* Trigger row */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Mobile: Sheet drawer */}
                    <div className="sm:hidden">
                        <Sheet>
                            <SheetTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 gap-1.5">
                                    <SlidersHorizontal className="h-3.5 w-3.5" />
                                    Filtros avanzados
                                    {hasActive && (
                                        <span className="inline-flex items-center justify-center h-4 min-w-[1rem] px-1 rounded-full bg-blue-500 text-white text-[10px] font-bold">
                                            {activeCount}
                                        </span>
                                    )}
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="w-80">
                                <SheetHeader>
                                    <SheetTitle className="flex items-center gap-2">
                                        <SlidersHorizontal className="h-4 w-4" />
                                        Filtros avanzados
                                    </SheetTitle>
                                </SheetHeader>
                                <div className="mt-6 space-y-4">
                                    <FiltersGrid filters={filters} values={values} onChange={handleChange} orientation="vertical" />
                                    <div className="pt-4 border-t">
                                        <Button variant="outline" size="sm" onClick={onClear} disabled={!hasActive} className="w-full gap-1.5">
                                            <X className="h-3.5 w-3.5" />
                                            Limpiar filtros
                                        </Button>
                                    </div>
                                </div>
                            </SheetContent>
                        </Sheet>
                    </div>

                    {/* Desktop: inline toggle */}
                    <button
                        type="button"
                        onClick={() => setOpen(p => !p)}
                        className={cn(
                            'hidden sm:inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-medium transition-all duration-150',
                            open || hasActive
                                ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                                : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/40'
                        )}
                    >
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        Filtros avanzados
                        {hasActive && (
                            <span className="inline-flex items-center justify-center h-4 min-w-[1rem] px-1 rounded-full bg-blue-500 text-white text-[10px] font-bold">
                                {activeCount}
                            </span>
                        )}
                        <ChevronDown className={cn('h-3 w-3 transition-transform duration-200', open && 'rotate-180')} />
                    </button>

                    {/* Active tags */}
                    <ActiveTags activeLabels={activeLabels} onRemove={handleRemoveOne} />

                    {/* Clear all */}
                    {hasActive && (
                        <button
                            type="button"
                            onClick={onClear}
                            className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors h-6 px-1.5 rounded hover:bg-muted"
                        >
                            <X className="h-3 w-3" />
                            Limpiar todo
                        </button>
                    )}
                </div>

                {/* Expandable panel (desktop only) */}
                <div className={cn(
                    'hidden sm:block overflow-hidden transition-all duration-200 ease-in-out',
                    open ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
                )}>
                    <div className="rounded-xl border border-border/60 bg-muted/20 dark:bg-white/[0.02] p-4">
                        <FiltersGrid filters={filters} values={values} onChange={handleChange} orientation={orientation} />
                    </div>
                </div>
            </div>
        )
    }

    // ── Inline (always visible) ──
    return (
        <Card className={cn('border border-border/60 shadow-sm', className)}>
            <CardContent className="p-4 space-y-3">
                <FiltersGrid filters={filters} values={values} onChange={handleChange} orientation={orientation} />
                {hasActive && (
                    <div className="flex items-center justify-between pt-2 border-t border-border/40">
                        <ActiveTags activeLabels={activeLabels} onRemove={handleRemoveOne} />
                        <Button variant="ghost" size="sm" onClick={onClear} className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground shrink-0">
                            <X className="h-3 w-3" />
                            Limpiar
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
