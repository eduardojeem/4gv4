import { useState, useMemo, useEffect } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import customerService from "@/services/customer-service"
import { useDebounce } from "./use-debounce"

export interface Customer {
  id: string  // UUID from Supabase
  customerCode: string
  name: string
  email: string
  phone: string
  ruc?: string
  customer_type: "premium" | "empresa" | "regular"
  status: "active" | "inactive" | "suspended"
  total_purchases: number
  total_repairs: number
  registration_date: string
  created_at?: string  // Agregado para compatibilidad con metrics-service
  last_visit: string
  last_activity: string
  address: string
  city: string
  credit_score: number
  segment: string
  satisfaction_score: number
  lifetime_value: number
  avg_order_value: number
  purchase_frequency: string
  preferred_contact: string
  birthday: string
  loyalty_points: number
  credit_limit: number
  current_balance: number
  pending_amount: number
  notes: string
  tags: string[]
  whatsapp?: string
  social_media?: string
  company?: string
  position?: string
  referral_source: string
  discount_percentage: number
  payment_terms: string
  assigned_salesperson: string
  last_purchase_amount: number
  total_spent_this_year: number
  avatar?: string
  repairs_history?: Record<string, unknown>[]
  sales_history?: Record<string, unknown>[]
  activity_timeline?: Record<string, unknown>[]
}

export interface CustomerFilters {
  search: string
  status: string
  customer_type: string
  segment: string
  city: string
  assigned_salesperson: string
  date_range: {
    from: Date | null
    to: Date | null
  }
  credit_score_range: [number, number]
  lifetime_value_range: [number, number]
  tags: string[]
}

export interface CustomerState {
  customers: Customer[]
  filteredCustomers: Customer[]
  paginatedCustomers: Customer[]
  filters: CustomerFilters
  viewMode: "table" | "grid" | "timeline"
  selectedCustomer: Customer | null
  loading: boolean
  searching: boolean
  error: string | null
  sortBy: string
  sortOrder: "asc" | "desc"
  pagination: {
    currentPage: number
    itemsPerPage: number
    totalItems: number
    totalPages: number
  }
}

const initialFilters: CustomerFilters = {
  search: "",
  status: "all",
  customer_type: "all",
  segment: "all",
  city: "all",
  assigned_salesperson: "all",
  date_range: { from: null, to: null },
  credit_score_range: [0, 10],
  lifetime_value_range: [0, 10000],
  tags: []
}

// Mock data removed - using Supabase
const mockCustomers: Customer[] = []

export function useCustomerState() {
  const [state, setState] = useState<CustomerState>({
    customers: [],
    filteredCustomers: [],
    paginatedCustomers: [],
    filters: initialFilters,
    viewMode: "table",
    selectedCustomer: null,
    loading: true,
    searching: false,
    error: null,
    sortBy: "name",
    sortOrder: "asc",
    pagination: {
      currentPage: 1,
      itemsPerPage: 10,
      totalItems: 0,
      totalPages: 0
    }
  })

  // Expose setState for actions
  const stateWithSetter = { ...state, setState }

  // Load customers on mount with pagination
  useEffect(() => {
    const loadCustomers = async () => {
      try {
        console.log('🔄 [CustomerState] Starting to load customers...')
        setState(prev => ({ ...prev, loading: true, error: null }))

        // Load only the first page (50 customers) for better performance
        // This reduces initial load time and memory usage
        console.log('📞 [CustomerState] Calling customerService.getCustomers(1, 50)...')
        const response = await customerService.getCustomers(1, 50)
        console.log('📊 [CustomerState] Service response:', response)

        if (!response.success || !response.data) {
          console.error('❌ [CustomerState] Service returned error:', response.error)
          throw new Error(response.error || 'Error al cargar clientes')
        }

        console.log('✅ [CustomerState] Successfully loaded', response.data.length, 'customers')
        console.log('📋 [CustomerState] First customer sample:', response.data[0])

        setState(prev => ({
          ...prev,
          customers: response.data || [],
          loading: false,
          pagination: {
            ...prev.pagination,
            totalItems: response.pagination?.total || response.data?.length || 0,
            totalPages: response.pagination?.totalPages || Math.ceil((response.data?.length || 0) / prev.pagination.itemsPerPage)
          }
        }))
        
        console.log('🎯 [CustomerState] State updated successfully')
      } catch (error: unknown) {
        console.error('💥 [CustomerState] Error loading customers:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
        setState(prev => ({
          ...prev,
          error: "Error al cargar clientes",
          loading: false
        }))
        toast.error("Error al cargar clientes: " + error.message)
      }
    }

    loadCustomers()
  }, [])

  // Realtime subscription for automatic updates
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('customers_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'customers' },
        (payload) => {
          console.log('Customer inserted:', payload.new)
          const newCustomer = payload.new as any
          const mappedCustomer: Customer = {
            ...newCustomer,
            customerCode: newCustomer.customer_code || `CLI-${newCustomer.id?.slice(0, 6)}`,
            customer_type: newCustomer.customer_type || 'regular',
            status: newCustomer.status || 'active',
            total_purchases: newCustomer.total_purchases || 0,
            total_repairs: newCustomer.total_repairs || 0,
            registration_date: newCustomer.created_at,
            last_visit: newCustomer.last_visit || newCustomer.created_at,
            last_activity: newCustomer.updated_at || newCustomer.created_at,
            credit_score: newCustomer.credit_score || 0,
            segment: newCustomer.segment || 'regular',
            satisfaction_score: newCustomer.satisfaction_score || 0,
            lifetime_value: newCustomer.lifetime_value || 0,
            avg_order_value: newCustomer.avg_order_value || 0,
            purchase_frequency: newCustomer.purchase_frequency || 'low',
            preferred_contact: newCustomer.preferred_contact || 'email',
            loyalty_points: newCustomer.loyalty_points || 0,
            credit_limit: newCustomer.credit_limit || 0,
            current_balance: newCustomer.current_balance || 0,
            pending_amount: newCustomer.pending_amount || 0,
            tags: newCustomer.tags || [],
            discount_percentage: newCustomer.discount_percentage || 0,
            payment_terms: newCustomer.payment_terms || 'Contado',
            assigned_salesperson: newCustomer.assigned_salesperson || 'Sin asignar',
            last_purchase_amount: newCustomer.last_purchase_amount || 0,
            total_spent_this_year: newCustomer.total_spent_this_year || 0
          }
          setState(prev => ({
            ...prev,
            customers: [mappedCustomer, ...prev.customers]
          }))
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'customers' },
        (payload) => {
          console.log('Customer updated:', payload.new)
          const updatedCustomer = payload.new as any
          const mappedCustomer: Customer = {
            ...updatedCustomer,
            customerCode: updatedCustomer.customer_code || `CLI-${updatedCustomer.id?.slice(0, 6)}`,
            customer_type: updatedCustomer.customer_type || 'regular',
            status: updatedCustomer.status || 'active',
            total_purchases: updatedCustomer.total_purchases || 0,
            total_repairs: updatedCustomer.total_repairs || 0,
            registration_date: updatedCustomer.created_at,
            last_visit: updatedCustomer.last_visit || updatedCustomer.created_at,
            last_activity: updatedCustomer.updated_at || updatedCustomer.created_at,
            credit_score: updatedCustomer.credit_score || 0,
            segment: updatedCustomer.segment || 'regular',
            satisfaction_score: updatedCustomer.satisfaction_score || 0,
            lifetime_value: updatedCustomer.lifetime_value || 0,
            avg_order_value: updatedCustomer.avg_order_value || 0,
            purchase_frequency: updatedCustomer.purchase_frequency || 'low',
            preferred_contact: updatedCustomer.preferred_contact || 'email',
            loyalty_points: updatedCustomer.loyalty_points || 0,
            credit_limit: updatedCustomer.credit_limit || 0,
            current_balance: updatedCustomer.current_balance || 0,
            pending_amount: updatedCustomer.pending_amount || 0,
            tags: updatedCustomer.tags || [],
            discount_percentage: updatedCustomer.discount_percentage || 0,
            payment_terms: updatedCustomer.payment_terms || 'Contado',
            assigned_salesperson: updatedCustomer.assigned_salesperson || 'Sin asignar',
            last_purchase_amount: updatedCustomer.last_purchase_amount || 0,
            total_spent_this_year: updatedCustomer.total_spent_this_year || 0
          }
          setState(prev => ({
            ...prev,
            customers: prev.customers.map(c =>
              c.id === mappedCustomer.id ? mappedCustomer : c
            )
          }))
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'customers' },
        (payload) => {
          console.log('Customer deleted:', payload.old)
          setState(prev => ({
            ...prev,
            customers: prev.customers.filter(c => c.id !== payload.old.id)
          }))
        }
      )
      .subscribe()

    return () => {
      if (channel && typeof channel.unsubscribe === 'function') {
        channel.unsubscribe()
      }
    }
  }, [])

  // Debounce search term for better performance
  const debouncedSearchTerm = useDebounce(state.filters.search, 300)

  // Update searching state when search term changes
  useEffect(() => {
    if (state.filters.search !== debouncedSearchTerm) {
      setState(prev => ({ ...prev, searching: true }))
    } else {
      setState(prev => ({ ...prev, searching: false }))
    }
  }, [state.filters.search, debouncedSearchTerm])

  // Enhanced search function with fuzzy matching and pattern detection
  const performIntelligentSearch = (customers: Customer[], searchTerm: string): Customer[] => {
    if (!searchTerm || searchTerm.trim().length === 0) return customers
    
    const term = searchTerm.toLowerCase().trim()
    
    // Detect search patterns
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(term)
    const isPhone = /^[\d\s\-\+\(\)]+$/.test(term) && term.replace(/\D/g, '').length >= 8
    const isRUC = /^\d{12}$/.test(term.replace(/\D/g, ''))
    const isCode = /^CLI-/.test(term.toUpperCase())
    const isQuickFilter = term.includes(':')
    
    // Handle quick filters (e.g., "customer_type:premium", "city:Montevideo")
    if (isQuickFilter) {
      const [filterType, filterValue] = term.split(':')
      return customers.filter(customer => {
        switch (filterType) {
          case 'customer_type':
            return customer.customer_type === filterValue
          case 'city':
            return customer.city?.toLowerCase() === filterValue.toLowerCase()
          case 'status':
            return customer.status === filterValue
          case 'segment':
            return customer.segment?.toLowerCase() === filterValue.toLowerCase()
          default:
            return true
        }
      })
    }
    
    // Fuzzy matching function
    const fuzzyMatch = (text: string, query: string): number => {
      if (!text) return 0
      text = text.toLowerCase()
      
      // Exact match gets highest score
      if (text.includes(query)) return 100
      
      // Calculate fuzzy score
      let score = 0
      let queryIndex = 0
      
      for (let i = 0; i < text.length && queryIndex < query.length; i++) {
        if (text[i] === query[queryIndex]) {
          score += 1
          queryIndex++
        }
      }
      
      return queryIndex === query.length ? (score / query.length) * 80 : 0
    }
    
    // Score and filter customers
    const scoredCustomers = customers.map(customer => {
      let totalScore = 0
      let matchCount = 0
      
      // Name matching (highest priority)
      const nameScore = fuzzyMatch(customer.name || '', term)
      if (nameScore > 30) {
        totalScore += nameScore * 2 // Double weight for name
        matchCount++
      }
      
      // Email matching (exact pattern or contains)
      if (customer.email) {
        if (isEmail && customer.email.toLowerCase() === term) {
          totalScore += 100
          matchCount++
        } else if (customer.email.toLowerCase().includes(term)) {
          totalScore += 90
          matchCount++
        }
      }
      
      // Phone matching
      if (customer.phone) {
        const cleanPhone = customer.phone.replace(/\D/g, '')
        const cleanTerm = term.replace(/\D/g, '')
        if (isPhone && cleanPhone.includes(cleanTerm)) {
          totalScore += 95
          matchCount++
        } else if (customer.phone.includes(term)) {
          totalScore += 85
          matchCount++
        }
      }
      
      // Customer code matching
      if (customer.customerCode) {
        if (isCode && customer.customerCode.toLowerCase().includes(term)) {
          totalScore += 95
          matchCount++
        } else if (customer.customerCode.toLowerCase().includes(term)) {
          totalScore += 90
          matchCount++
        }
      }
      
      // RUC matching
      if (customer.ruc) {
        const cleanRUC = customer.ruc.replace(/\D/g, '')
        const cleanTerm = term.replace(/\D/g, '')
        if (isRUC && cleanRUC === cleanTerm) {
          totalScore += 100
          matchCount++
        } else if (customer.ruc.includes(term)) {
          totalScore += 85
          matchCount++
        }
      }
      
      // City matching
      if (customer.city && customer.city.toLowerCase().includes(term)) {
        totalScore += 70
        matchCount++
      }
      
      // Company matching
      if (customer.company && customer.company.toLowerCase().includes(term)) {
        totalScore += 75
        matchCount++
      }
      
      // Address matching (lower priority)
      if (customer.address && customer.address.toLowerCase().includes(term)) {
        totalScore += 50
        matchCount++
      }
      
      // Notes matching (lowest priority)
      if (customer.notes && customer.notes.toLowerCase().includes(term)) {
        totalScore += 30
        matchCount++
      }
      
      return {
        customer,
        score: matchCount > 0 ? totalScore / matchCount : 0,
        matchCount
      }
    })
    
    // Filter and sort by score
    return scoredCustomers
      .filter(item => item.score > 25) // Minimum score threshold
      .sort((a, b) => b.score - a.score) // Sort by score descending
      .map(item => item.customer)
  }

  // Filter customers based on current filters
  const filteredCustomers = useMemo(() => {
    let filtered = [...state.customers]

    // Search filter with intelligent matching
    if (debouncedSearchTerm) {
      filtered = performIntelligentSearch(filtered, debouncedSearchTerm)
    }

    // Status filter
    if (state.filters.status !== "all") {
      filtered = filtered.filter(customer => customer.status === state.filters.status)
    }

    // Customer type filter
    if (state.filters.customer_type !== "all") {
      filtered = filtered.filter(customer => customer.customer_type === state.filters.customer_type)
    }

    // Segment filter
    if (state.filters.segment !== "all") {
      filtered = filtered.filter(customer => customer.segment === state.filters.segment)
    }

    // City filter
    if (state.filters.city !== "all") {
      filtered = filtered.filter(customer => customer.city === state.filters.city)
    }

    // Assigned salesperson filter
    if (state.filters.assigned_salesperson !== "all") {
      filtered = filtered.filter(customer => customer.assigned_salesperson === state.filters.assigned_salesperson)
    }

    // Credit score range filter
    filtered = filtered.filter(customer =>
      customer.credit_score >= state.filters.credit_score_range[0] &&
      customer.credit_score <= state.filters.credit_score_range[1]
    )

    // Lifetime value range filter
    filtered = filtered.filter(customer =>
      customer.lifetime_value >= state.filters.lifetime_value_range[0] &&
      customer.lifetime_value <= state.filters.lifetime_value_range[1]
    )

    // Tags filter
    if (state.filters.tags.length > 0) {
      filtered = filtered.filter(customer =>
        state.filters.tags.some(tag => customer.tags.includes(tag))
      )
    }

    // Date range filter
    if (state.filters.date_range.from && state.filters.date_range.to) {
      filtered = filtered.filter(customer => {
        const customerDate = new Date(customer.registration_date)
        return customerDate >= state.filters.date_range.from! &&
          customerDate <= state.filters.date_range.to!
      })
    }

    // Sort
    filtered.sort((a, b) => {
      const aValue = a[state.sortBy as keyof Customer]
      const bValue = b[state.sortBy as keyof Customer]

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return state.sortOrder === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return state.sortOrder === 'asc'
          ? aValue - bValue
          : bValue - aValue
      }

      return 0
    })

    return filtered
  }, [state.customers, debouncedSearchTerm, state.filters, state.sortBy, state.sortOrder])

  // Calculate paginated customers
  const paginatedCustomers = useMemo(() => {
    const startIndex = (state.pagination.currentPage - 1) * state.pagination.itemsPerPage
    const endIndex = startIndex + state.pagination.itemsPerPage
    return filteredCustomers.slice(startIndex, endIndex)
  }, [filteredCustomers, state.pagination.currentPage, state.pagination.itemsPerPage])

  // Update filtered customers and pagination when they change
  useEffect(() => {
    const totalItems = filteredCustomers.length
    const totalPages = Math.ceil(totalItems / state.pagination.itemsPerPage)

    setState(prev => ({
      ...prev,
      filteredCustomers,
      paginatedCustomers,
      pagination: {
        ...prev.pagination,
        totalItems,
        totalPages,
        // Reset to page 1 if current page is beyond total pages
        currentPage: prev.pagination.currentPage > totalPages ? 1 : prev.pagination.currentPage
      }
    }))
  }, [filteredCustomers, paginatedCustomers, state.pagination.itemsPerPage])

  // Pagination functions
  const setPage = (page: number) => {
    setState(prev => ({
      ...prev,
      pagination: {
        ...prev.pagination,
        currentPage: Math.max(1, Math.min(page, prev.pagination.totalPages))
      }
    }))
  }

  const setItemsPerPage = (itemsPerPage: number) => {
    setState(prev => ({
      ...prev,
      pagination: {
        ...prev.pagination,
        itemsPerPage,
        currentPage: 1 // Reset to first page when changing items per page
      }
    }))
  }

  const nextPage = () => {
    setPage(state.pagination.currentPage + 1)
  }

  const prevPage = () => {
    setPage(state.pagination.currentPage - 1)
  }

  return {
    ...state,
    filteredCustomers,
    paginatedCustomers,
    setPage,
    setItemsPerPage,
    nextPage,
    prevPage,
    setState
  }
}