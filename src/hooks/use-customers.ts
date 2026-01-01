import { useState, useEffect, useCallback, useMemo } from 'react'
import { createSupabaseClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { AppError } from '@/lib/errors'
import { Customer, CustomerFilters } from './use-customer-state'
export type { Customer, CustomerFilters }
import { useDebounce } from './use-debounce'

interface UseCustomersOptions {
  initialFilters?: Partial<CustomerFilters>
  pageSize?: number
  enableCache?: boolean
  autoRefresh?: boolean
}

interface PaginationState {
  currentPage: number
  itemsPerPage: number
  totalItems: number
  totalPages: number
}

export function useCustomers(options: UseCustomersOptions = {}) {
    const {
        initialFilters = {},
        pageSize = 50,
        enableCache = true,
        autoRefresh = false
    } = options

    // Estado principal
    const [customers, setCustomers] = useState<Customer[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)
    
    // Estado de filtros
    const [filters, setFilters] = useState<CustomerFilters>({
        search: '',
        status: 'all',
        customer_type: 'all',
        segment: 'all',
        city: 'all',
        assigned_salesperson: 'all',
        date_range: { from: null, to: null },
        credit_score_range: [0, 10],
        lifetime_value_range: [0, 10000],
        tags: [],
        ...initialFilters
    })
    
    // Estado de paginación
    const [pagination, setPagination] = useState<PaginationState>({
        currentPage: 1,
        itemsPerPage: pageSize,
        totalItems: 0,
        totalPages: 0
    })

    // Búsqueda con debounce
    const debouncedSearch = useDebounce(filters.search, 300)

    // Clientes filtrados
    const filteredCustomers = useMemo(() => {
        let filtered = customers

        // Aplicar búsqueda
        if (debouncedSearch) {
            const searchLower = debouncedSearch.toLowerCase()
            filtered = filtered.filter(customer =>
                customer.name.toLowerCase().includes(searchLower) ||
                customer.email.toLowerCase().includes(searchLower) ||
                customer.phone.includes(searchLower) ||
                (customer.ruc && customer.ruc.includes(searchLower))
            )
        }

        // Aplicar filtros
        if (filters.status !== 'all') {
            filtered = filtered.filter(c => c.status === filters.status)
        }

        if (filters.customer_type !== 'all') {
            filtered = filtered.filter(c => c.customer_type === filters.customer_type)
        }

        if (filters.segment !== 'all') {
            filtered = filtered.filter(c => c.segment === filters.segment)
        }

        if (filters.city !== 'all') {
            filtered = filtered.filter(c => c.city === filters.city)
        }

        if (filters.assigned_salesperson !== 'all') {
            filtered = filtered.filter(c => c.assigned_salesperson === filters.assigned_salesperson)
        }

        // Filtro por rango de fechas
        if (filters.date_range.from && filters.date_range.to) {
            filtered = filtered.filter(c => {
                const customerDate = new Date(c.registration_date)
                return customerDate >= filters.date_range.from! && customerDate <= filters.date_range.to!
            })
        }

        // Filtro por rango de credit score
        if (filters.credit_score_range) {
            const [min, max] = filters.credit_score_range
            filtered = filtered.filter(c => 
                (c.credit_score || 0) >= min && (c.credit_score || 0) <= max
            )
        }

        // Filtro por rango de lifetime value
        if (filters.lifetime_value_range) {
            const [min, max] = filters.lifetime_value_range
            filtered = filtered.filter(c => 
                (c.lifetime_value || 0) >= min && (c.lifetime_value || 0) <= max
            )
        }

        // Filtro por tags
        if (filters.tags.length > 0) {
            filtered = filtered.filter(c => 
                filters.tags.some(tag => c.tags.includes(tag))
            )
        }

        return filtered
    }, [customers, debouncedSearch, filters])

    // Clientes paginados
    const paginatedCustomers = useMemo(() => {
        const startIndex = (pagination.currentPage - 1) * pagination.itemsPerPage
        const endIndex = startIndex + pagination.itemsPerPage
        return filteredCustomers.slice(startIndex, endIndex)
    }, [filteredCustomers, pagination.currentPage, pagination.itemsPerPage])

    // Actualizar paginación cuando cambian los filtros
    useEffect(() => {
        const totalItems = filteredCustomers.length
        const totalPages = Math.ceil(totalItems / pagination.itemsPerPage)
        
        setPagination(prev => ({
            ...prev,
            totalItems,
            totalPages,
            currentPage: Math.min(prev.currentPage, totalPages || 1)
        }))
    }, [filteredCustomers.length, pagination.itemsPerPage])

    const fetchCustomers = useCallback(async () => {
        setIsLoading(true)
        setError(null)

        try {
            const supabase = createSupabaseClient()
            const { data, error: fetchError } = await supabase
                .from('customers')
                .select('*')
                .order('created_at', { ascending: false })

            if (fetchError) throw fetchError

            const transformedCustomers: Customer[] = (data || []).map((c: any) => ({
                id: c.id,
                customerCode: c.customer_code || `CLI-${c.id?.slice(0, 6)}`,
                name: c.name || '',
                email: c.email || '',
                phone: c.phone || '',
                ruc: c.ruc,
                customer_type: c.customer_type || 'regular',
                status: c.status || 'active',
                total_purchases: c.total_purchases || 0,
                total_repairs: c.total_repairs || 0,
                registration_date: c.created_at,
                created_at: c.created_at,
                last_visit: c.last_visit || c.created_at,
                last_activity: c.updated_at || c.created_at,
                address: c.address || '',
                city: c.city || '',
                credit_score: c.credit_score || 0,
                segment: c.segment || 'regular',
                satisfaction_score: c.satisfaction_score || 0,
                lifetime_value: c.lifetime_value || 0,
                avg_order_value: c.avg_order_value || 0,
                purchase_frequency: c.purchase_frequency || 'low',
                preferred_contact: c.preferred_contact || 'email',
                birthday: c.birthday || '',
                loyalty_points: c.loyalty_points || 0,
                credit_limit: c.credit_limit || 0,
                current_balance: c.current_balance || 0,
                pending_amount: c.pending_amount || 0,
                notes: c.notes || '',
                tags: c.tags || [],
                whatsapp: c.whatsapp,
                social_media: c.social_media,
                company: c.company,
                position: c.position,
                referral_source: c.referral_source || '',
                discount_percentage: c.discount_percentage || 0,
                payment_terms: c.payment_terms || 'Contado',
                assigned_salesperson: c.assigned_salesperson || 'Sin asignar',
                last_purchase_amount: c.last_purchase_amount || 0,
                total_spent_this_year: c.total_spent_this_year || 0,
                avatar: c.avatar
            }))

            setCustomers(transformedCustomers)
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Error al cargar clientes')
            setError(error)
            toast.error(error.message)
        } finally {
            setIsLoading(false)
        }
    }, [])

    // Acciones
    const actions = {
        // Filtros
        updateFilters: (newFilters: Partial<CustomerFilters>) => {
            setFilters(prev => ({ ...prev, ...newFilters }))
            setPagination(prev => ({ ...prev, currentPage: 1 })) // Reset a primera página
        },
        
        clearFilters: () => {
            setFilters({
                search: '',
                status: 'all',
                customer_type: 'all',
                segment: 'all',
                city: 'all',
                assigned_salesperson: 'all',
                date_range: { from: null, to: null },
                credit_score_range: [0, 10],
                lifetime_value_range: [0, 10000],
                tags: []
            })
        },

        // Paginación
        setPage: (page: number) => {
            setPagination(prev => ({ ...prev, currentPage: page }))
        },
        
        setItemsPerPage: (itemsPerPage: number) => {
            setPagination(prev => ({ 
                ...prev, 
                itemsPerPage, 
                currentPage: 1,
                totalPages: Math.ceil(prev.totalItems / itemsPerPage)
            }))
        },
        
        nextPage: () => {
            setPagination(prev => ({
                ...prev,
                currentPage: Math.min(prev.currentPage + 1, prev.totalPages)
            }))
        },
        
        prevPage: () => {
            setPagination(prev => ({
                ...prev,
                currentPage: Math.max(prev.currentPage - 1, 1)
            }))
        },

        // CRUD
        refresh: fetchCustomers,
        
        createCustomer: async (customerData: Partial<Customer>) => {
            try {
                const supabase = createSupabaseClient()
                const { data, error } = await supabase
                    .from('customers')
                    .insert([customerData])
                    .select()
                    .single()

                if (error) throw error

                await fetchCustomers() // Refresh la lista
                toast.success('Cliente creado exitosamente')
                return { success: true, customer: data }
            } catch (err) {
                const error = err instanceof Error ? err : new Error('Error al crear cliente')
                toast.error(error.message)
                return { success: false, error }
            }
        },

        updateCustomer: async (id: string, customerData: Partial<Customer>) => {
            try {
                const supabase = createSupabaseClient()
                const { data, error } = await supabase
                    .from('customers')
                    .update(customerData)
                    .eq('id', id)
                    .select()
                    .single()

                if (error) throw error

                // Actualizar en el estado local
                setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...data } : c))
                toast.success('Cliente actualizado exitosamente')
                return { success: true, customer: data }
            } catch (err) {
                const error = err instanceof Error ? err : new Error('Error al actualizar cliente')
                toast.error(error.message)
                return { success: false, error }
            }
        },

        deleteCustomer: async (id: string) => {
            try {
                const supabase = createSupabaseClient()
                const { error } = await supabase
                    .from('customers')
                    .delete()
                    .eq('id', id)

                if (error) throw error

                // Remover del estado local
                setCustomers(prev => prev.filter(c => c.id !== id))
                toast.success('Cliente eliminado exitosamente')
                return { success: true }
            } catch (err) {
                const error = err instanceof Error ? err : new Error('Error al eliminar cliente')
                toast.error(error.message)
                return { success: false, error }
            }
        }
    }

    // Auto-refresh
    useEffect(() => {
        if (autoRefresh) {
            const interval = setInterval(fetchCustomers, 30000) // Cada 30 segundos
            return () => clearInterval(interval)
        }
    }, [autoRefresh, fetchCustomers])

    // Fetch inicial
    useEffect(() => {
        fetchCustomers()
    }, [fetchCustomers])

    return {
        // Estado
        customers: filteredCustomers,
        paginatedCustomers,
        allCustomers: customers,
        filters,
        pagination,
        isLoading,
        error,
        
        // Metadatos
        metadata: {
            totalCount: filteredCustomers.length,
            totalAllCustomers: customers.length,
            hasMore: pagination.currentPage < pagination.totalPages,
            isEmpty: filteredCustomers.length === 0
        },
        
        // Acciones
        actions
    }
}