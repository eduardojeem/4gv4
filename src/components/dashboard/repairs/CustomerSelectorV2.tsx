'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useCustomers, type Customer } from '@/hooks/use-customers'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useDebounce } from '@/hooks/use-debounce'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
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
import { 
    Check, 
    ChevronsUpDown, 
    Plus, 
    User, 
    Loader2, 
    Phone, 
    Mail, 
    Star,
    Clock,
    Search,
    X,
    UserPlus,
    Zap
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { createSupabaseClient } from '@/lib/supabase/client'
import { motion, AnimatePresence  } from '../../ui/motion'

interface CustomerSelectorV2Props {
    value?: string
    onChange: (customerId: string, customerData?: Customer) => void
    error?: string
    disabled?: boolean
    placeholder?: string
    showCreateInline?: boolean
}

interface CustomerUsageStats {
    customerId: string
    count: number
    lastUsed: number
}

// Fuzzy search utility
function fuzzyMatch(text: string, query: string): number {
    const textLower = text.toLowerCase()
    const queryLower = query.toLowerCase()
    
    // Exact match gets highest score
    if (textLower.includes(queryLower)) {
        return queryLower.length / textLower.length
    }
    
    // Fuzzy matching
    let score = 0
    let queryIndex = 0
    
    for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
        if (textLower[i] === queryLower[queryIndex]) {
            score++
            queryIndex++
        }
    }
    
    return queryIndex === queryLower.length ? score / textLower.length : 0
}

// Get customer usage statistics
function getCustomerUsageStats(): CustomerUsageStats[] {
    try {
        if (typeof window === 'undefined') return []
        const raw = localStorage.getItem('customer-usage-stats')
        return raw ? JSON.parse(raw) : []
    } catch {
        return []
    }
}

// Update customer usage statistics
function updateCustomerUsage(customerId: string) {
    try {
        if (typeof window === 'undefined') return
        
        const stats = getCustomerUsageStats()
        const existing = stats.find(s => s.customerId === customerId)
        
        if (existing) {
            existing.count++
            existing.lastUsed = Date.now()
        } else {
            stats.push({
                customerId,
                count: 1,
                lastUsed: Date.now()
            })
        }
        
        // Keep only top 50 most used customers
        const sorted = stats.sort((a, b) => b.count - a.count).slice(0, 50)
        localStorage.setItem('customer-usage-stats', JSON.stringify(sorted))
    } catch (error) {
        console.warn('Error updating customer usage:', error)
    }
}

export function CustomerSelectorV2({ 
    value, 
    onChange, 
    error, 
    disabled,
    placeholder = "Buscar o crear cliente...",
    showCreateInline = true
}: CustomerSelectorV2Props) {
    const { customers, isLoading, refreshCustomers } = useCustomers()
    const [open, setOpen] = useState(false)
    const [searchValue, setSearchValue] = useState('')
    const [showInlineCreate, setShowInlineCreate] = useState(false)
    const [isCreating, setIsCreating] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    
    const debouncedSearch = useDebounce(searchValue, 200)

    // Find selected customer
    const selectedCustomer = useMemo(() => {
        return customers.find(c => c.id === value)
    }, [customers, value])

    // Get usage statistics
    const usageStats = useMemo(() => getCustomerUsageStats(), [])

    // Enhanced customer filtering with fuzzy search and scoring
    const filteredCustomers = useMemo(() => {
        if (!debouncedSearch) {
            // Show most used customers when no search
            const statsMap = new Map(usageStats.map(s => [s.customerId, s]))
            return customers
                .map(customer => ({
                    customer,
                    stats: statsMap.get(customer.id),
                    score: 0
                }))
                .sort((a, b) => {
                    // Prioritize by usage, then by recent activity
                    const aCount = a.stats?.count || 0
                    const bCount = b.stats?.count || 0
                    if (aCount !== bCount) return bCount - aCount
                    
                    const aLastUsed = a.stats?.lastUsed || 0
                    const bLastUsed = b.stats?.lastUsed || 0
                    return bLastUsed - aLastUsed
                })
                .slice(0, 20)
                .map(item => item.customer)
        }

        const query = debouncedSearch.toLowerCase()
        const digits = query.replace(/\D/g, '')
        
        return customers
            .map(customer => {
                const fullName = `${customer.first_name} ${customer.last_name}`.toLowerCase()
                const phone = (customer.phone || '').replace(/\D/g, '')
                const email = (customer.email || '').toLowerCase()
                
                let score = 0
                
                // Name matching (highest priority)
                const nameScore = fuzzyMatch(fullName, query)
                if (nameScore > 0) score += nameScore * 3
                
                // Phone matching
                if (digits && phone.includes(digits)) {
                    score += digits.length / phone.length * 2
                }
                
                // Email matching
                if (email.includes(query)) {
                    score += query.length / email.length * 1.5
                }
                
                // Boost score for frequently used customers
                const stats = usageStats.find(s => s.customerId === customer.id)
                if (stats) {
                    score += Math.min(stats.count * 0.1, 1)
                }
                
                return { customer, score }
            })
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 15)
            .map(item => item.customer)
    }, [customers, debouncedSearch, usageStats])

    // Recent customers (last 7 days)
    const recentCustomers = useMemo(() => {
        const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000)
        return usageStats
            .filter(s => s.lastUsed > weekAgo)
            .sort((a, b) => b.lastUsed - a.lastUsed)
            .slice(0, 5)
            .map(s => customers.find(c => c.id === s.customerId))
            .filter(Boolean) as Customer[]
    }, [customers, usageStats])

    // Favorite customers (most used)
    const favoriteCustomers = useMemo(() => {
        return usageStats
            .filter(s => s.count >= 3)
            .sort((a, b) => b.count - a.count)
            .slice(0, 3)
            .map(s => customers.find(c => c.id === s.customerId))
            .filter(Boolean) as Customer[]
    }, [customers, usageStats])

    const handleSelect = useCallback((customerId: string) => {
        const customer = customers.find(c => c.id === customerId)
        onChange(customerId, customer)
        updateCustomerUsage(customerId)
        setOpen(false)
        setSearchValue('')
    }, [customers, onChange])

    const handleCreateInline = useCallback(async () => {
        if (!searchValue.trim()) return
        
        setIsCreating(true)
        try {
            const supabase = createSupabaseClient()
            
            // Try to parse name from search value
            const parts = searchValue.trim().split(/\s+/)
            const firstName = parts[0] || ''
            const lastName = parts.slice(1).join(' ') || ''
            
            // Check for phone number in search
            const phoneMatch = searchValue.match(/[\d\s\-\+\(\)]+/)
            const phone = phoneMatch ? phoneMatch[0].replace(/\D/g, '') : ''
            
            // Check for email in search
            const emailMatch = searchValue.match(/\S+@\S+\.\S+/)
            const email = emailMatch ? emailMatch[0] : ''
            
            if (!firstName) {
                toast.error('Por favor ingresa al menos un nombre')
                return
            }
            
            const { data: customerRow, error } = await supabase
                .from('customers')
                .insert({
                    name: `${firstName} ${lastName}`.trim(),
                    phone: phone || null,
                    email: email || null,
                    customer_type: 'regular',
                    status: 'active',
                })
                .select('id, name, phone, email, customer_type, status, created_at')
                .single()

            if (error) throw error

            const created: Customer = {
                id: customerRow.id,
                first_name: firstName,
                last_name: lastName,
                phone: phone || '',
                email: email || '',
                customer_type: customerRow.customer_type || 'regular',
                status: customerRow.status || 'active',
                created_at: customerRow.created_at
            }

            toast.success(`Cliente "${firstName} ${lastName}" creado exitosamente`)
            onChange(customerRow.id, created)
            updateCustomerUsage(customerRow.id)
            setOpen(false)
            setSearchValue('')
            setShowInlineCreate(false)
            refreshCustomers()
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error)
            console.error('Error creating customer:', message)
            toast.error('Error al crear el cliente: ' + message)
        } finally {
            setIsCreating(false)
        }
    }, [searchValue, onChange, refreshCustomers])

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!open) return
            
            // Ctrl/Cmd + Enter to create new customer
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && searchValue.trim()) {
                e.preventDefault()
                if (showCreateInline) {
                    handleCreateInline()
                }
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [open, searchValue, showCreateInline, handleCreateInline])

    const getCustomerInitials = (customer: Customer) => {
        return `${customer.first_name[0] || ''}${customer.last_name[0] || ''}`.toUpperCase()
    }

    const getUsageInfo = (customerId: string) => {
        return usageStats.find(s => s.customerId === customerId)
    }

    return (
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
                            "w-full justify-between h-auto min-h-[40px] p-3",
                            error && "border-red-500",
                            !value && "text-muted-foreground"
                        )}
                        disabled={disabled || isLoading}
                    >
                        {selectedCustomer ? (
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <Avatar className="h-8 w-8">
                                    <AvatarFallback className="text-xs bg-primary/10">
                                        {getCustomerInitials(selectedCustomer)}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0 text-left">
                                    <div className="font-medium truncate">
                                        {selectedCustomer.first_name} {selectedCustomer.last_name}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        {selectedCustomer.phone && (
                                            <span className="flex items-center gap-1">
                                                <Phone className="h-3 w-3" />
                                                {selectedCustomer.phone}
                                            </span>
                                        )}
                                        {selectedCustomer.email && (
                                            <span className="flex items-center gap-1">
                                                <Mail className="h-3 w-3" />
                                                {selectedCustomer.email}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {getUsageInfo(selectedCustomer.id) && (
                                    <Badge variant="secondary" className="text-xs">
                                        <Star className="h-3 w-3 mr-1" />
                                        {getUsageInfo(selectedCustomer.id)?.count}
                                    </Badge>
                                )}
                            </div>
                        ) : (
                            <span className="flex items-center gap-2">
                                <Search className="h-4 w-4" />
                                {placeholder}
                            </span>
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[500px] p-0" align="start">
                    <div className="flex items-center justify-between px-3 py-2 border-b">
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                            {isLoading ? (
                                <>
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    Cargando clientes...
                                </>
                            ) : (
                                <>
                                    <User className="h-3 w-3" />
                                    {customers.length} clientes disponibles
                                </>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={refreshCustomers}
                                disabled={disabled || isLoading}
                                className="h-7 px-2"
                            >
                                <Loader2 className={cn("h-3 w-3", isLoading && "animate-spin")} />
                            </Button>
                        </div>
                    </div>
                    
                    <Command shouldFilter={false}>
                        <div className="relative">
                            <CommandInput
                                ref={inputRef}
                                placeholder="Buscar por nombre, teléfono o email..."
                                value={searchValue}
                                onValueChange={setSearchValue}
                                className="border-0 focus:ring-0"
                            />
                            {searchValue && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                                    onClick={() => setSearchValue('')}
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                            )}
                        </div>
                        
                        <CommandList className="max-h-[400px]">
                            <CommandEmpty>
                                <div className="text-center py-6 space-y-3">
                                    <div className="text-sm text-muted-foreground">
                                        {searchValue ? 
                                            `No se encontró ningún cliente para "${searchValue}"` :
                                            'No hay clientes disponibles'
                                        }
                                    </div>
                                    {showCreateInline && searchValue.trim() && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="space-y-2"
                                        >
                                            <Button
                                                size="sm"
                                                onClick={handleCreateInline}
                                                disabled={isCreating}
                                                className="gap-2"
                                            >
                                                {isCreating ? (
                                                    <>
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                        Creando...
                                                    </>
                                                ) : (
                                                    <>
                                                        <UserPlus className="h-4 w-4" />
                                                        Crear "{searchValue}"
                                                    </>
                                                )}
                                            </Button>
                                            <div className="text-xs text-muted-foreground">
                                                Presiona Ctrl+Enter para crear rápidamente
                                            </div>
                                        </motion.div>
                                    )}
                                </div>
                            </CommandEmpty>

                            {/* Quick Create Option */}
                            {showCreateInline && searchValue.trim() && (
                                <CommandGroup>
                                    <CommandItem
                                        onSelect={handleCreateInline}
                                        className="bg-primary/5 border border-primary/20 font-medium"
                                        disabled={isCreating}
                                    >
                                        <div className="flex items-center gap-3 flex-1">
                                            {isCreating ? (
                                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                            ) : (
                                                <UserPlus className="h-4 w-4 text-primary" />
                                            )}
                                            <div className="flex-1">
                                                <div className="font-medium text-primary">
                                                    Crear nuevo cliente: "{searchValue}"
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    Ctrl+Enter para crear rápidamente
                                                </div>
                                            </div>
                                            <Badge variant="outline" className="text-xs">
                                                <Zap className="h-3 w-3 mr-1" />
                                                Nuevo
                                            </Badge>
                                        </div>
                                    </CommandItem>
                                </CommandGroup>
                            )}

                            {/* Favorite Customers */}
                            {!debouncedSearch && favoriteCustomers.length > 0 && (
                                <CommandGroup heading="⭐ Favoritos">
                                    {favoriteCustomers.map((customer) => {
                                        const usage = getUsageInfo(customer.id)
                                        return (
                                            <CommandItem
                                                key={customer.id}
                                                value={customer.id}
                                                onSelect={handleSelect}
                                                className="py-3"
                                            >
                                                <Check
                                                    className={cn(
                                                        "mr-3 h-4 w-4",
                                                        value === customer.id ? "opacity-100" : "opacity-0"
                                                    )}
                                                />
                                                <Avatar className="h-8 w-8 mr-3">
                                                    <AvatarFallback className="text-xs bg-yellow-100 text-yellow-800">
                                                        {getCustomerInitials(customer)}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium truncate">
                                                        {customer.first_name} {customer.last_name}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                                                        {customer.phone && (
                                                            <span className="flex items-center gap-1">
                                                                <Phone className="h-3 w-3" />
                                                                {customer.phone}
                                                            </span>
                                                        )}
                                                        {customer.email && (
                                                            <span className="flex items-center gap-1">
                                                                <Mail className="h-3 w-3" />
                                                                {customer.email}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="secondary" className="text-xs">
                                                        <Star className="h-3 w-3 mr-1" />
                                                        {usage?.count}
                                                    </Badge>
                                                </div>
                                            </CommandItem>
                                        )
                                    })}
                                </CommandGroup>
                            )}

                            {/* Recent Customers */}
                            {!debouncedSearch && recentCustomers.length > 0 && (
                                <CommandGroup heading="🕒 Recientes">
                                    {recentCustomers.map((customer) => {
                                        const usage = getUsageInfo(customer.id)
                                        return (
                                            <CommandItem
                                                key={customer.id}
                                                value={customer.id}
                                                onSelect={handleSelect}
                                                className="py-3"
                                            >
                                                <Check
                                                    className={cn(
                                                        "mr-3 h-4 w-4",
                                                        value === customer.id ? "opacity-100" : "opacity-0"
                                                    )}
                                                />
                                                <Avatar className="h-8 w-8 mr-3">
                                                    <AvatarFallback className="text-xs bg-blue-100 text-blue-800">
                                                        {getCustomerInitials(customer)}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium truncate">
                                                        {customer.first_name} {customer.last_name}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                                                        {customer.phone && (
                                                            <span className="flex items-center gap-1">
                                                                <Phone className="h-3 w-3" />
                                                                {customer.phone}
                                                            </span>
                                                        )}
                                                        {customer.email && (
                                                            <span className="flex items-center gap-1">
                                                                <Mail className="h-3 w-3" />
                                                                {customer.email}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline" className="text-xs">
                                                        <Clock className="h-3 w-3 mr-1" />
                                                        {usage && new Date(usage.lastUsed).toLocaleDateString()}
                                                    </Badge>
                                                </div>
                                            </CommandItem>
                                        )
                                    })}
                                </CommandGroup>
                            )}

                            {/* All Customers */}
                            <CommandGroup heading={debouncedSearch ? "🔍 Resultados de búsqueda" : "👥 Todos los clientes"}>
                                <AnimatePresence>
                                    {filteredCustomers.map((customer, index) => {
                                        const usage = getUsageInfo(customer.id)
                                        return (
                                            <motion.div
                                                key={customer.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -10 }}
                                                transition={{ delay: index * 0.02 }}
                                            >
                                                <CommandItem
                                                    value={customer.id}
                                                    onSelect={handleSelect}
                                                    className="py-3"
                                                >
                                                    <Check
                                                        className={cn(
                                                            "mr-3 h-4 w-4",
                                                            value === customer.id ? "opacity-100" : "opacity-0"
                                                        )}
                                                    />
                                                    <Avatar className="h-8 w-8 mr-3">
                                                        <AvatarFallback className="text-xs">
                                                            {getCustomerInitials(customer)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-medium truncate">
                                                            {customer.first_name} {customer.last_name}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                                                            {customer.phone && (
                                                                <span className="flex items-center gap-1">
                                                                    <Phone className="h-3 w-3" />
                                                                    {customer.phone}
                                                                </span>
                                                            )}
                                                            {customer.email && (
                                                                <span className="flex items-center gap-1">
                                                                    <Mail className="h-3 w-3" />
                                                                    {customer.email}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {usage && usage.count > 1 && (
                                                        <Badge variant="secondary" className="text-xs">
                                                            {usage.count}x
                                                        </Badge>
                                                    )}
                                                </CommandItem>
                                            </motion.div>
                                        )
                                    })}
                                </AnimatePresence>
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
            
            {error && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                    <X className="h-3 w-3" />
                    {error}
                </p>
            )}
            
            {selectedCustomer && (
                <div className="flex justify-between items-center">
                    <div className="text-xs text-muted-foreground">
                        Cliente seleccionado
                    </div>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onChange('', undefined)}
                        disabled={disabled || isLoading}
                        className="h-6 px-2 text-xs"
                    >
                        <X className="h-3 w-3 mr-1" />
                        Limpiar
                    </Button>
                </div>
            )}
        </div>
    )
}