'use client'

import { useState, useMemo, type PointerEvent } from 'react'
import { useCustomers, type Customer } from '@/hooks/use-customers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useDebounce } from '@/hooks/use-debounce'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import { Check, ChevronsUpDown, Plus, User, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CustomerQuickCreateDialog } from './CustomerQuickCreateDialog'

function stopFocusSteal(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault()
}

interface CustomerSelectorProps {
    value?: string
    initialCustomer?: Pick<Customer, 'id' | 'name' | 'phone' | 'email'>
    onChange: (customerId: string, customerData?: Customer) => void
    error?: string
    disabled?: boolean
}

export function CustomerSelector({ value, initialCustomer, onChange, error, disabled }: CustomerSelectorProps) {
    const { customers, isLoading, actions } = useCustomers()
    const [open, setOpen] = useState(false)
    const [showQuickCreate, setShowQuickCreate] = useState(false)
    const [searchValue, setSearchValue] = useState('')
    const [optimisticCustomer, setOptimisticCustomer] = useState<Customer | null>(null)
    const debouncedSearch = useDebounce(searchValue, 300)

    // Find selected customer
    const selectedCustomer = useMemo(() => {
        const fromList = customers.find(c => c.id === value)
        if (fromList) return fromList
        if (optimisticCustomer?.id === value) return optimisticCustomer
        if (initialCustomer?.id === value) {
            return {
                id: initialCustomer.id,
                customerCode: `CLI-${initialCustomer.id.slice(0, 6)}`,
                name: initialCustomer.name || '',
                email: initialCustomer.email || '',
                phone: initialCustomer.phone || '',
                customer_type: 'regular',
                status: 'active',
                total_purchases: 0,
                total_repairs: 0,
                registration_date: '',
                created_at: '',
                last_visit: '',
                last_activity: '',
                address: '',
                city: '',
                credit_score: 0,
                segment: 'regular',
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
                total_spent_this_year: 0
            } satisfies Customer
        }
    }, [customers, initialCustomer, optimisticCustomer, value])

    // Filter customers based on search
    const filteredCustomers = useMemo(() => {
        if (!debouncedSearch) return customers.slice(0, 50)
        const lower = debouncedSearch.toLowerCase()
        const digits = debouncedSearch.replace(/\D/g, '')
        const normalize = (p?: string) => (p || '').replace(/\D/g, '')
        return customers.filter(c =>
            (c.name || '').toLowerCase().includes(lower) ||
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
        if (customer) setOptimisticCustomer(customer)
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
        setOptimisticCustomer(customerData)
        onChange(customerId, customerData)
        setShowQuickCreate(false)
    }

    return (
        <>
            <div className="space-y-2">
                <Label htmlFor="customer">
                    Cliente <span className="text-red-500">*</span>
                </Label>
                <Popover open={open} onOpenChange={setOpen} modal>
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
                            disabled={disabled}
                        >
                            {selectedCustomer ? (
                                <div className="flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    <span className="truncate">
                                        {selectedCustomer.name || 'Cliente sin nombre'}
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
                    <PopoverContent className="z-[70] w-[400px] p-0" align="start">
                        <div className="flex items-center justify-between px-3 py-2">
                            <div className="text-xs text-muted-foreground">
                                {isLoading ? 'Cargando clientes...' : `${customers.length} clientes`}
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={actions.refresh}
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
                        <div>
                            <div className="border-b px-3 py-2">
                                <Input
                                placeholder="Buscar por nombre, teléfono o email..."
                                value={searchValue}
                                onChange={(event) => setSearchValue(event.target.value)}
                                autoComplete="off"
                                className="h-9 border-0 px-0 shadow-none focus-visible:ring-0"
                                />
                            </div>
                            <div className="max-h-[300px] overflow-y-auto overflow-x-hidden p-1">
                                {!isLoading && filteredCustomers.length === 0 && recentCustomers.length === 0 && (
                                    <div className="text-center py-6">
                                        <p className="text-sm text-muted-foreground mb-3">
                                            No se encontró ningún cliente
                                        </p>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onPointerDown={(event) => {
                                                event.preventDefault()
                                                handleCreateNew()
                                            }}
                                            className="gap-2"
                                        >
                                            <Plus className="h-4 w-4" />
                                            Crear nuevo cliente
                                        </Button>
                                    </div>
                                )}
                                <div>
                                    <button
                                        type="button"
                                        onPointerDown={(event) => {
                                            event.preventDefault()
                                            handleCreateNew()
                                        }}
                                        className="relative flex w-full cursor-pointer select-none items-center rounded-sm bg-muted/50 px-2 py-1.5 text-left text-sm font-medium outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                                    >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Crear nuevo cliente
                                    </button>
                                </div>
                                {!debouncedSearch && recentCustomers.length > 0 && (
                                    <div>
                                        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Recientes</div>
                                        {recentCustomers.map((customer) => (
                                            <button
                                                type="button"
                                                key={customer.id}
                                                value={customer.id}
                                                onPointerDown={(event) => {
                                                    stopFocusSteal(event)
                                                    handleSelect(customer.id)
                                                }}
                                                className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                                            >
                                                <Check
                                                    className={cn(
                                                        "mr-2 h-4 w-4",
                                                        value === customer.id ? "opacity-100" : "opacity-0"
                                                    )}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium truncate">
                                                        {customer.name || 'Cliente sin nombre'}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground flex gap-2">
                                                        {customer.phone && <span>{customer.phone}</span>}
                                                        {customer.email && <span>• {customer.email}</span>}
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                <div>
                                    <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Clientes</div>
                                    {filteredCustomers.map((customer) => (
                                        <button
                                            type="button"
                                            key={customer.id}
                                            value={customer.id}
                                            onPointerDown={(event) => {
                                                stopFocusSteal(event)
                                                handleSelect(customer.id)
                                            }}
                                            className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                                        >
                                            <Check
                                                className={cn(
                                                    "mr-2 h-4 w-4",
                                                    value === customer.id ? "opacity-100" : "opacity-0"
                                                )}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium truncate">
                                                    {customer.name || 'Cliente sin nombre'}
                                                </div>
                                                <div className="text-xs text-muted-foreground flex gap-2">
                                                    {customer.phone && <span>{customer.phone}</span>}
                                                    {customer.email && <span>• {customer.email}</span>}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
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
                        onClick={() => {
                            setOptimisticCustomer(null)
                            onChange('', undefined)
                        }}
                        disabled={disabled}
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
