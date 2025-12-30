'use client'

import { useState, useMemo } from 'react'
import { useCustomers, type Customer } from '@/hooks/use-customers'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useDebounce } from '@/hooks/use-debounce'
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import { Check, ChevronsUpDown, Plus, User, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CustomerQuickCreateDialog } from './CustomerQuickCreateDialog'

interface CustomerSelectorProps {
    value?: string
    onChange: (customerId: string, customerData?: Customer) => void
    error?: string
    disabled?: boolean
}

export function CustomerSelector({ value, onChange, error, disabled }: CustomerSelectorProps) {
    const { customers, isLoading, refreshCustomers } = useCustomers()
    const [open, setOpen] = useState(false)
    const [showQuickCreate, setShowQuickCreate] = useState(false)
    const [searchValue, setSearchValue] = useState('')
    const debouncedSearch = useDebounce(searchValue, 300)

    // Find selected customer
    const selectedCustomer = useMemo(() => {
        return customers.find(c => c.id === value)
    }, [customers, value])

    // Filter customers based on search
    const filteredCustomers = useMemo(() => {
        if (!debouncedSearch) return customers.slice(0, 50)
        const lower = debouncedSearch.toLowerCase()
        const digits = debouncedSearch.replace(/\D/g, '')
        const normalize = (p?: string) => (p || '').replace(/\D/g, '')
        return customers.filter(c =>
            `${c.first_name} ${c.last_name}`.toLowerCase().includes(lower) ||
            normalize(c.phone).includes(digits) ||
            (c.email || '').toLowerCase().includes(lower)
        ).slice(0, 50)
    }, [customers, debouncedSearch])

    const recentCustomers = useMemo(() => {
        try {
            if (typeof window === 'undefined') return []
            const raw = localStorage.getItem('recent-customers')
            const ids: string[] = raw ? JSON.parse(raw) : []
            return ids.map(id => customers.find(c => c.id === id)).filter(Boolean).slice(0, 5) as typeof customers
        } catch {
            return []
        }
    }, [customers])

    const handleSelect = (customerId: string) => {
        const customer = customers.find(c => c.id === customerId)
        onChange(customerId, customer)
        setOpen(false)
        try {
            if (typeof window !== 'undefined') {
                const key = 'recent-customers'
                const raw = localStorage.getItem(key)
                const ids: string[] = raw ? JSON.parse(raw) : []
                const next = [customerId, ...ids.filter((x) => x !== customerId)].slice(0, 10)
                localStorage.setItem(key, JSON.stringify(next))
            }
        } catch {}
    }

    const handleCreateNew = () => {
        setOpen(false)
        setShowQuickCreate(true)
    }

    const handleCustomerCreated = (customerId: string, customerData: Customer) => {
        onChange(customerId, customerData)
        setShowQuickCreate(false)
    }

    return (
        <>
            <div className="space-y-2">
                <Label htmlFor="customer">
                    Cliente <span className="text-red-500">*</span>
                </Label>
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            id="customer"
                            variant="outline"
                            role="combobox"
                            aria-expanded={open}
                            className={cn(
                                "w-full justify-between",
                                error && "border-red-500",
                                !value && "text-muted-foreground"
                            )}
                            disabled={disabled || isLoading}
                        >
                            {selectedCustomer ? (
                                <div className="flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    <span className="truncate">
                                        {selectedCustomer.first_name} {selectedCustomer.last_name}
                                    </span>
                                    {selectedCustomer.phone && (
                                        <span className="text-muted-foreground text-xs">
                                            • {selectedCustomer.phone}
                                        </span>
                                    )}
                                </div>
                            ) : (
                                <span className="flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    Selecciona o crea un cliente
                                </span>
                            )}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                        <div className="flex items-center justify-between px-3 py-2">
                            <div className="text-xs text-muted-foreground">
                                {isLoading ? 'Cargando clientes...' : `${customers.length} clientes`}
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={refreshCustomers}
                                    disabled={disabled || isLoading}
                                    className="h-8"
                                >
                                    {isLoading && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
                                    Actualizar
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleCreateNew}
                                    disabled={disabled}
                                    className="h-8"
                                >
                                    <Plus className="h-3 w-3 mr-2" />
                                    Nuevo
                                </Button>
                            </div>
                        </div>
                        <Command shouldFilter={false}>
                            <CommandInput
                                placeholder="Buscar por nombre, teléfono o email..."
                                value={searchValue}
                                onValueChange={setSearchValue}
                            />
                            <CommandList>
                                <CommandEmpty>
                                    <div className="text-center py-6">
                                        <p className="text-sm text-muted-foreground mb-3">
                                            No se encontró ningún cliente
                                        </p>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={handleCreateNew}
                                            className="gap-2"
                                        >
                                            <Plus className="h-4 w-4" />
                                            Crear nuevo cliente
                                        </Button>
                                    </div>
                                </CommandEmpty>
                                <CommandGroup>
                                    <CommandItem
                                        onSelect={handleCreateNew}
                                        className="bg-muted/50 font-medium"
                                    >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Crear nuevo cliente
                                    </CommandItem>
                                </CommandGroup>
                                {!debouncedSearch && recentCustomers.length > 0 && (
                                    <CommandGroup heading="Recientes">
                                        {recentCustomers.map((customer) => (
                                            <CommandItem
                                                key={customer.id}
                                                value={customer.id}
                                                onSelect={handleSelect}
                                            >
                                                <Check
                                                    className={cn(
                                                        "mr-2 h-4 w-4",
                                                        value === customer.id ? "opacity-100" : "opacity-0"
                                                    )}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium truncate">
                                                        {customer.first_name} {customer.last_name}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground flex gap-2">
                                                        {customer.phone && <span>{customer.phone}</span>}
                                                        {customer.email && <span>• {customer.email}</span>}
                                                    </div>
                                                </div>
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                )}
                                <CommandGroup heading="Clientes">
                                    {filteredCustomers.map((customer) => (
                                        <CommandItem
                                            key={customer.id}
                                            value={customer.id}
                                            onSelect={handleSelect}
                                        >
                                            <Check
                                                className={cn(
                                                    "mr-2 h-4 w-4",
                                                    value === customer.id ? "opacity-100" : "opacity-0"
                                                )}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium truncate">
                                                    {customer.first_name} {customer.last_name}
                                                </div>
                                                <div className="text-xs text-muted-foreground flex gap-2">
                                                    {customer.phone && <span>{customer.phone}</span>}
                                                    {customer.email && <span>• {customer.email}</span>}
                                                </div>
                                            </div>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
                {error && (
                    <p className="text-sm text-red-500">{error}</p>
                )}
                <div className="flex justify-end">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onChange('', undefined)}
                        disabled={disabled || isLoading}
                    >
                        Limpiar selección
                    </Button>
                </div>
            </div>

            <CustomerQuickCreateDialog
                open={showQuickCreate}
                onClose={() => setShowQuickCreate(false)}
                onCreated={handleCustomerCreated}
            />
        </>
    )
}
