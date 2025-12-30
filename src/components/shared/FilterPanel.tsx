'use client'

import { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
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
import { X, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet'

// ============================================================================
// Types
// ============================================================================

export interface FilterConfig {
    key: string
    label: string
    type: 'text' | 'select' | 'date' | 'dateRange' | 'number'
    options?: { label: string; value: any }[]
    placeholder?: string
    min?: number
    max?: number
}

export interface FilterPanelProps {
    filters: FilterConfig[]
    values: Record<string, any>
    onChange: (values: Record<string, any>) => void
    onClear: () => void
    orientation?: 'horizontal' | 'vertical'
    collapsible?: boolean
    className?: string
}

// ============================================================================
// Main Component
// ============================================================================

export function FilterPanel({
    filters,
    values,
    onChange,
    onClear,
    orientation = 'horizontal',
    collapsible = false,
    className
}: FilterPanelProps) {

    const handleChange = (key: string, value: any) => {
        onChange({ ...values, [key]: value })
    }

    const handleClearAll = () => {
        onClear()
    }

    const hasActiveFilters = Object.values(values).some(v => v !== '' && v !== null && v !== undefined)

    const renderFilter = (filter: FilterConfig) => {
        switch (filter.type) {
            case 'text':
                return (
                    <Input
                        placeholder={filter.placeholder || filter.label}
                        value={values[filter.key] || ''}
                        onChange={(e) => handleChange(filter.key, e.target.value)}
                        className="w-full"
                    />
                )

            case 'select':
                return (
                    <Select
                        value={(values[filter.key] === '' || values[filter.key] === null || values[filter.key] === undefined) ? '' : String(values[filter.key])}
                        onValueChange={(value) => handleChange(filter.key, value === '__empty__' ? '' : value)}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder={filter.placeholder || `Seleccionar ${filter.label}`} />
                        </SelectTrigger>
                        <SelectContent>
                            {filter.options?.map((option) => (
                                <SelectItem key={option.value} value={(option.value === '' ? '__empty__' : String(option.value))}>
                                    {option.label}
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
                        value={values[filter.key] || ''}
                        onChange={(e) => handleChange(filter.key, e.target.value)}
                        min={filter.min}
                        max={filter.max}
                        className="w-full"
                    />
                )

            case 'date':
                return (
                    <Input
                        type="date"
                        value={values[filter.key] || ''}
                        onChange={(e) => handleChange(filter.key, e.target.value)}
                        className="w-full"
                    />
                )

            default:
                return null
        }
    }

    const FiltersContent = (
        <div className={cn(
            "space-y-4",
            orientation === 'horizontal' && "md:grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:space-y-0"
        )}>
            {filters.map((filter) => (
                <div key={filter.key} className="space-y-2">
                    <Label className="text-sm font-medium">{filter.label}</Label>
                    {renderFilter(filter)}
                </div>
            ))}
        </div>
    )

    // Mobile: Drawer
    if (collapsible) {
        return (
            <div className={cn("flex items-center gap-2", className)}>
                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="outline" className="gap-2">
                            <SlidersHorizontal className="h-4 w-4" />
                            Filtros
                            {hasActiveFilters && (
                                <span className="ml-1 rounded-full bg-blue-500 px-2 py-0.5 text-xs text-white">
                                    {Object.values(values).filter(v => v).length}
                                </span>
                            )}
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-80">
                        <SheetHeader>
                            <SheetTitle>Filtros</SheetTitle>
                        </SheetHeader>
                        <div className="mt-6 space-y-4">
                            {FiltersContent}
                            <div className="flex gap-2 pt-4 border-t">
                                <Button
                                    variant="outline"
                                    onClick={handleClearAll}
                                    disabled={!hasActiveFilters}
                                    className="flex-1"
                                >
                                    <X className="h-4 w-4 mr-2" />
                                    Limpiar
                                </Button>
                            </div>
                        </div>
                    </SheetContent>
                </Sheet>

                {hasActiveFilters && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClearAll}
                        className="text-muted-foreground"
                    >
                        <X className="h-4 w-4 mr-1" />
                        Limpiar filtros
                    </Button>
                )}
            </div>
        )
    }

    // Desktop: Inline
    return (
        <Card className={cn("border-0 shadow-sm", className)}>
            <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                        {FiltersContent}
                    </div>
                    {hasActiveFilters && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleClearAll}
                            className="flex-shrink-0"
                        >
                            <X className="h-4 w-4 mr-2" />
                            Limpiar
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
