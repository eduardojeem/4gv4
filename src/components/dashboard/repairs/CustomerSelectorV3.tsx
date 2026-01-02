'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import { 
    Check, 
    ChevronsUpDown, 
    User, 
    Loader2, 
    Phone, 
    Mail, 
    Star,
    Search,
    X,
    TrendingUp
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { motion, AnimatePresence  } from '../../ui/motion'
import { useCustomerSearch } from '@/hooks/use-customer-search'
import type { Customer } from '@/hooks/use-customer-state'
import { CustomerDetailModal } from './CustomerDetailModal'

interface CustomerSelectorV3Props {
    value?: string
    onChange: (customerId: string, customerData?: Customer) => void
    error?: string
    disabled?: boolean
    placeholder?: string
    maxResults?: number
}

export function CustomerSelectorV3({ 
    value, 
    onChange, 
    error, 
    disabled,
    placeholder = "Buscar cliente por nombre, teléfono o email...",
    maxResults = 20
}: CustomerSelectorV3Props) {
    const [open, setOpen] = useState(false)
    const [showCustomerDetail, setShowCustomerDetail] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    
    const {
        searchQuery,
        setSearchQuery,
        searchResults,
        recentCustomers,
        favoriteCustomers,
        isLoading,
        refreshCustomers,
        updateUsage,
        clearSearch,
        getCustomerById,
        getUsageInfo,
        isSearching
    } = useCustomerSearch({ 
        maxResults,
        prioritizeRecent: true 
    })

    // Find selected customer
    const selectedCustomer = getCustomerById(value || '')

    const handleSelect = useCallback((customerId: string) => {
        const customer = getCustomerById(customerId)
        
        if (customer) {
            onChange(customerId, customer)
            updateUsage(customerId)
            setOpen(false)
            clearSearch()
        } else {
            console.warn('CustomerSelector: Customer not found for ID:', customerId)
            toast.error('Error al seleccionar el cliente. Por favor, intenta de nuevo.')
        }
    }, [onChange, updateUsage, clearSearch, getCustomerById])

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!open) return
            
            // Escape to close
            if (e.key === 'Escape') {
                setOpen(false)
                clearSearch()
            }
            
            // Enter to select first result
            if (e.key === 'Enter' && searchResults.length > 0) {
                e.preventDefault()
                handleSelect(searchResults[0].customer.id)
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [open, searchResults, handleSelect, clearSearch])

    const getCustomerInitials = (customer: Customer) => {
        // Use the 'name' field and split by space to get initials
        const nameParts = (customer.name || '').trim().split(/\s+/)
        const firstInitial = nameParts[0]?.[0] || ''
        const lastInitial = nameParts[1]?.[0] || ''
        return `${firstInitial}${lastInitial}`.toUpperCase() || 'CL'
    }

    const getMatchTypeIcon = (matchType: string) => {
        switch (matchType) {
            case 'phone': return <Phone className="h-3 w-3" />
            case 'email': return <Mail className="h-3 w-3" />
            case 'exact': return <Star className="h-3 w-3" />
            default: return <User className="h-3 w-3" />
        }
    }

    const getMatchTypeColor = (matchType: string) => {
        switch (matchType) {
            case 'phone': return 'text-blue-600 bg-blue-50 border-blue-200'
            case 'email': return 'text-green-600 bg-green-50 border-green-200'
            case 'exact': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
            default: return 'text-gray-600 bg-gray-50 border-gray-200'
        }
    }

    const getMatchTypeLabel = (matchType: string) => {
        switch (matchType) {
            case 'phone': return 'Teléfono'
            case 'email': return 'Email'
            case 'exact': return 'Exacto'
            default: return 'Nombre'
        }
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
                            "w-full justify-between h-auto min-h-[44px] p-3",
                            error && "border-red-500 focus:border-red-500",
                            !value && "text-muted-foreground"
                        )}
                        disabled={disabled || isLoading}
                    >
                        {selectedCustomer ? (
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <Avatar className="h-9 w-9">
                                    <AvatarFallback className="text-sm bg-primary/10 font-semibold">
                                        {getCustomerInitials(selectedCustomer)}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0 text-left">
                                    <div className="font-semibold truncate text-foreground">
                                        {selectedCustomer.name}
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
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
                                    <div className="flex items-center gap-1">
                                        <Badge variant="secondary" className="text-xs">
                                            <TrendingUp className="h-3 w-3 mr-1" />
                                            {getUsageInfo(selectedCustomer.id)?.count}
                                        </Badge>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <span className="flex items-center gap-2 text-muted-foreground">
                                <Search className="h-4 w-4" />
                                {placeholder}
                            </span>
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[600px] p-0" align="start">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
                        <div className="text-sm font-medium flex items-center gap-2">
                            {isLoading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Cargando clientes...
                                </>
                            ) : isSearching ? (
                                <>
                                    <Search className="h-4 w-4 text-primary" />
                                    <span>Buscando "{searchQuery}"</span>
                                    {searchResults.length > 0 && (
                                        <Badge variant="secondary" className="text-xs ml-1">
                                            {searchResults.length} encontrado{searchResults.length !== 1 ? 's' : ''}
                                        </Badge>
                                    )}
                                </>
                            ) : (
                                <>
                                    <User className="h-4 w-4" />
                                    <span>Buscar Cliente</span>
                                    <Badge variant="outline" className="text-xs ml-2">
                                        {favoriteCustomers.length + recentCustomers.length + searchResults.length} disponibles
                                    </Badge>
                                </>
                            )}
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={refreshCustomers}
                            disabled={disabled || isLoading}
                            className="h-8 px-2"
                            title="Actualizar lista de clientes"
                        >
                            <Loader2 className={cn("h-4 w-4", isLoading && "animate-spin")} />
                        </Button>
                    </div>
                    
                        {/* Simplified Customer List without Command component issues */}
                        <div className="max-h-[450px] overflow-y-auto">
                            {/* Search Input */}
                            <div className="sticky top-0 bg-background border-b p-3">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        placeholder="Escribe para buscar clientes..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full h-12 pl-10 pr-10 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                    />
                                    {searchQuery && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 p-0 hover:bg-red-50 hover:text-red-600"
                                            onClick={clearSearch}
                                            title="Limpiar búsqueda"
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    )}
                                    {isSearching && (
                                        <div className="absolute right-10 top-1/2 -translate-y-1/2">
                                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Customer Lists */}
                            <div className="p-2">
                                {/* Empty State */}
                                {!isLoading && searchResults.length === 0 && favoriteCustomers.length === 0 && recentCustomers.length === 0 && (
                                    <div className="text-center py-8 space-y-4">
                                        <div className="text-sm text-muted-foreground">
                                            {searchQuery ? (
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <Search className="h-4 w-4" />
                                                        <span>No se encontraron clientes para "{searchQuery}"</span>
                                                    </div>
                                                    <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 max-w-sm mx-auto">
                                                        <div className="font-medium mb-2">💡 Consejos de búsqueda:</div>
                                                        <ul className="space-y-1 text-left">
                                                            <li>• Verifica la ortografía</li>
                                                            <li>• Intenta con menos caracteres</li>
                                                            <li>• Busca por teléfono o email</li>
                                                            <li>• Usa el botón "Nuevo Cliente" para crear uno</li>
                                                        </ul>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <User className="h-4 w-4" />
                                                        <span>💡 Comienza escribiendo para buscar clientes</span>
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        Puedes buscar por nombre, teléfono o email
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Search Results */}
                                {searchResults.length > 0 && (
                                    <div>
                                        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground flex items-center gap-2">
                                            {isSearching ? (
                                                <>
                                                    <Search className="h-4 w-4" />
                                                    Resultados de búsqueda
                                                    <Badge variant="secondary" className="text-xs">
                                                        {searchResults.length} encontrado{searchResults.length !== 1 ? 's' : ''}
                                                    </Badge>
                                                </>
                                            ) : (
                                                <>
                                                    <User className="h-4 w-4" />
                                                    Todos los clientes
                                                    <Badge variant="outline" className="text-xs">
                                                        {searchResults.length} disponibles
                                                    </Badge>
                                                </>
                                            )}
                                        </div>
                                        <div className="space-y-1">
                                            <AnimatePresence>
                                                {searchResults.map((result, index) => {
                                                    const { customer, matchType } = result
                                                    const usage = getUsageInfo(customer.id)
                                                    return (
                                                        <motion.div
                                                            key={customer.id}
                                                            initial={{ opacity: 0, y: 10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            exit={{ opacity: 0, y: -10 }}
                                                            transition={{ delay: index * 0.03 }}
                                                            onClick={() => {
                                                                handleSelect(customer.id)
                                                            }}
                                                            className="flex items-center gap-3 p-3 rounded-md hover:bg-muted/50 transition-colors cursor-pointer"
                                                        >
                                                            <div className={cn(
                                                                "h-4 w-4 text-primary",
                                                                value === customer.id ? "opacity-100" : "opacity-0"
                                                            )}>
                                                                <Check className="h-4 w-4" />
                                                            </div>
                                                            <Avatar className="h-10 w-10 border">
                                                                <AvatarFallback className="text-sm font-semibold">
                                                                    {getCustomerInitials(customer)}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="font-semibold truncate text-sm">
                                                                    {customer.name}
                                                                </div>
                                                                <div className="text-xs text-muted-foreground flex items-center gap-3 mt-1">
                                                                    {customer.phone && (
                                                                        <span className="flex items-center gap-1">
                                                                            <Phone className="h-3 w-3" />
                                                                            {customer.phone}
                                                                        </span>
                                                                    )}
                                                                    {customer.email && (
                                                                        <span className="flex items-center gap-1 truncate">
                                                                            <Mail className="h-3 w-3" />
                                                                            <span className="truncate">{customer.email}</span>
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                {isSearching && (
                                                                    <Badge 
                                                                        variant="outline" 
                                                                        className={cn("text-xs border", getMatchTypeColor(matchType))}
                                                                    >
                                                                        <span className="flex items-center gap-1">
                                                                            {getMatchTypeIcon(matchType)}
                                                                            {getMatchTypeLabel(matchType)}
                                                                        </span>
                                                                    </Badge>
                                                                )}
                                                                {usage && usage.count > 1 && (
                                                                    <Badge variant="secondary" className="text-xs">
                                                                        <TrendingUp className="h-3 w-3 mr-1" />
                                                                        {usage.count}x
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </motion.div>
                                                    )
                                                })}
                                            </AnimatePresence>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                </PopoverContent>
            </Popover>
            
            {error && (
                <motion.p 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm text-red-500 flex items-center gap-1"
                >
                    <X className="h-3 w-3" />
                    {error}
                </motion.p>
            )}
            
            {selectedCustomer && (
                <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800"
                >
                    <div className="text-sm text-green-700 dark:text-green-300 flex items-center gap-2">
                        <Check className="h-4 w-4" />
                        <span className="font-medium">Cliente seleccionado:</span>
                        <span className="font-semibold">{selectedCustomer.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setShowCustomerDetail(true)}
                            className="h-7 px-3 text-xs hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300"
                            title="Ver detalles del cliente"
                        >
                            <User className="h-3 w-3 mr-1" />
                            Ver Detalle
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onChange('', undefined)}
                            disabled={disabled || isLoading}
                            className="h-7 px-2 text-xs hover:bg-red-50 hover:text-red-600"
                            title="Limpiar selección"
                        >
                            <X className="h-3 w-3 mr-1" />
                            Limpiar
                        </Button>
                    </div>
                </motion.div>
            )}
        </div>

        {/* Customer Detail Modal */}
        <CustomerDetailModal
            open={showCustomerDetail}
            onClose={() => setShowCustomerDetail(false)}
            customer={selectedCustomer || null}
        />
    </>
    )
}