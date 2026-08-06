'use client'

import { useState, useMemo, useEffect, useCallback, type PointerEvent } from 'react'
import type { Customer } from '@/hooks/use-customers'
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
import { toast } from 'sonner'

interface RepairCustomerRow {
    id: string
    customer_code?: string | null
    name?: string | null
    email?: string | null
    phone?: string | null
    address?: string | null
    city?: string | null
    ruc?: string | null
    customer_type?: string | null
    status?: string | null
    created_at?: string | null
    updated_at?: string | null
}

function stopFocusSteal(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault()
}

function mapCustomerRow(row: RepairCustomerRow): Customer {
    const createdAt = row.created_at || new Date().toISOString()
    return {
        id: row.id,
        customerCode: row.customer_code || `CLI-${row.id.slice(0, 6)}`,
        name: row.name || '',
        email: row.email || '',
        phone: row.phone || '',
        ruc: row.ruc || '',
        customer_type: (row.customer_type as Customer['customer_type']) || 'regular',
        status: (row.status as Customer['status']) || 'active',
        total_purchases: 0,
        total_repairs: 0,
        registration_date: createdAt,
        created_at: createdAt,
        last_visit: createdAt,
        last_activity: row.updated_at || createdAt,
        address: row.address || '',
        city: row.city || '',
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
        total_spent_this_year: 0,
    }
}

interface CustomerSelectorProps {
    value?: string
    initialCustomer?: Pick<Customer, 'id' | 'name' | 'phone' | 'email'>
    onChange: (customerId: string, customerData?: Customer) => void
    error?: string
    disabled?: boolean
}

export function CustomerSelector({ value, initialCustomer, onChange, error, disabled }: CustomerSelectorProps) {
    const [customers, setCustomers] = useState<Customer[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [open, setOpen] = useState(false)
    const [showQuickCreate, setShowQuickCreate] = useState(false)
    const [searchValue, setSearchValue] = useState('')
    const [optimisticCustomer, setOptimisticCustomer] = useState<Customer | null>(null)
    const debouncedSearch = useDebounce(searchValue, 300)

    // La búsqueda va al servidor, no filtra una lista fija en el navegador.
    // Antes se traían los 200 clientes más recientes una sola vez y se
    // filtraban acá: un cliente que no estuviera entre esos 200 (cualquiera
    // con más de 200 clientes más nuevos que él) era imposible de encontrar
    // sin importar qué se escribiera en el buscador.
    const refreshCustomers = useCallback(async (term?: string) => {
        try {
            setIsLoading(true)
            const query = term ? `?q=${encodeURIComponent(term)}` : ''
            const response = await fetch(`/api/repairs/customers${query}`, { cache: 'no-store' })
            const payload = await response.json().catch(() => null) as { success?: boolean; data?: RepairCustomerRow[]; error?: string } | null

            if (!response.ok || !payload?.success) {
                throw new Error(payload?.error || 'No se pudieron cargar los clientes')
            }

            setCustomers((payload.data || []).map(mapCustomerRow))
        } catch (err) {
            const message = err instanceof Error ? err.message : 'No se pudieron cargar los clientes'
            toast.error(message)
            setCustomers([])
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        void refreshCustomers(debouncedSearch)
    }, [refreshCustomers, debouncedSearch])

    const selectedCustomer = useMemo(() => {
        const fromList = customers.find(c => c.id === value)
        if (fromList) return fromList
        if (optimisticCustomer?.id === value) return optimisticCustomer
        if (initialCustomer?.id === value) {
            return mapCustomerRow({
                id: initialCustomer.id,
                name: initialCustomer.name,
                email: initialCustomer.email,
                phone: initialCustomer.phone,
                customer_type: 'regular',
                status: 'active',
            })
        }
    }, [customers, initialCustomer, optimisticCustomer, value])

    // `customers` ya viene filtrado del servidor (ver refreshCustomers):
    // filtrar de nuevo acá era buscar dentro de una búsqueda ya hecha, con el
    // riesgo de que un resultado real quedara afuera por una regla de texto
    // ligeramente distinta a la del servidor.
    const filteredCustomers = customers

    const recentCustomers = useMemo(() => {
        try {
            if (typeof window === 'undefined') return []
            const raw = localStorage.getItem('recent-customers')
            const ids: string[] = raw ? JSON.parse(raw) : []
            return ids.map(id => customers.find(c => c.id === id)).filter(Boolean).slice(0, 5) as Customer[]
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
        setCustomers((current) => [customerData, ...current.filter((customer) => customer.id !== customerId)])
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
                                {isLoading
                                    ? 'Buscando...'
                                    : debouncedSearch
                                        ? `${customers.length} resultado${customers.length === 1 ? '' : 's'}`
                                        : `${customers.length} recientes`}
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => void refreshCustomers(debouncedSearch)}
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
