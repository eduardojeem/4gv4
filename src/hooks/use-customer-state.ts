import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { useDebounce } from "./use-debounce"

export interface Customer {
  id: string  // UUID from Supabase
  profile_id?: string // Linked user profile ID
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
  purchases_min: number
  spent_min: number
  loyalty_points_min: number
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
  lifetime_value_range: [0, Number.MAX_SAFE_INTEGER],
  tags: [],
  purchases_min: 0,
  spent_min: 0,
  loyalty_points_min: 0
}

/**
 * Maps a raw Supabase row to the Customer interface.
 * Centralized here to avoid duplication in realtime handlers.
 */
export function mapRawToCustomer(raw: Record<string, any>): Customer {
  return {
    ...raw,
    id: raw.id,
    profile_id: raw.profile_id,
    customerCode: raw.customer_code || `CLI-${raw.id?.slice(0, 6)}`,
    name: raw.name || '',
    email: raw.email || '',
    phone: raw.phone || '',
    ruc: raw.ruc,
    customer_type: raw.customer_type || 'regular',
    status: raw.status || 'active',
    total_purchases: raw.total_purchases || 0,
    total_repairs: raw.total_repairs || 0,
    registration_date: raw.created_at,
    created_at: raw.created_at,
    last_visit: raw.last_visit || raw.created_at,
    last_activity: raw.updated_at || raw.created_at,
    address: raw.address || '',
    city: raw.city || '',
    credit_score: raw.credit_score || 0,
    segment: raw.segment || 'regular',
    satisfaction_score: raw.satisfaction_score || 0,
    lifetime_value: raw.lifetime_value || 0,
    avg_order_value: raw.avg_order_value || 0,
    purchase_frequency: raw.purchase_frequency || 'low',
    preferred_contact: raw.preferred_contact || 'email',
    birthday: raw.birthday || '',
    loyalty_points: raw.loyalty_points || 0,
    credit_limit: raw.credit_limit || 0,
    current_balance: raw.current_balance || 0,
    pending_amount: raw.pending_amount || 0,
    notes: raw.notes || '',
    tags: raw.tags || [],
    whatsapp: raw.whatsapp,
    social_media: raw.social_media,
    company: raw.company,
    position: raw.position,
    referral_source: raw.referral_source || '',
    discount_percentage: raw.discount_percentage || 0,
    payment_terms: raw.payment_terms || 'Contado',
    assigned_salesperson: raw.assigned_salesperson || 'Sin asignar',
    last_purchase_amount: raw.last_purchase_amount || 0,
    total_spent_this_year: raw.total_spent_this_year || 0,
    avatar: raw.avatar,
  } as Customer
}

export function useCustomerState() {
  // Core state — only source-of-truth data lives here.
  // filteredCustomers and paginatedCustomers are derived via useMemo (not stored in state).
  const [state, setState] = useState<Omit<CustomerState, 'filteredCustomers' | 'paginatedCustomers'>>({
    customers: [],
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

  // Load customers on mount
  useEffect(() => {
    const loadCustomers = async () => {
      try {
        setState(prev => ({ ...prev, loading: true, error: null }))

        // Load all pages to keep local filtering aligned.
        const pageSize = 200
        let currentPage = 1
        let totalPages = 1
        const allCustomers: Customer[] = []

        while (currentPage <= totalPages) {
          const response = await fetch(`/api/customers?page=${currentPage}&limit=${pageSize}`)
          const result = await response.json()

          if (!response.ok || !result.success) {
            throw new Error(result.error || 'Error al cargar clientes')
          }

          allCustomers.push(...(result.data || []).map(mapRawToCustomer))
          totalPages = result.pagination?.totalPages || 1
          currentPage += 1
        }

        setState(prev => ({
          ...prev,
          customers: allCustomers,
          loading: false,
        }))
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
        setState(prev => ({
          ...prev,
          error: "Error al cargar clientes",
          loading: false
        }))
        toast.error("Error al cargar clientes: " + errorMessage)
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
          const mappedCustomer = mapRawToCustomer(payload.new as any)
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
          const mappedCustomer = mapRawToCustomer(payload.new as any)
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
          setState(prev => ({
            ...prev,
            customers: prev.customers.filter(c => c.id !== (payload.old as any).id)
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

  // Derive searching state without storing it
  const searching = state.filters.search !== debouncedSearchTerm

  // Enhanced search function with fuzzy matching and pattern detection
  const performIntelligentSearch = useCallback((customers: Customer[], searchTerm: string): Customer[] => {
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
      
      if (text.includes(query)) return 100
      
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
      
      const nameScore = fuzzyMatch(customer.name || '', term)
      if (nameScore > 30) {
        totalScore += nameScore * 2
        matchCount++
      }
      
      if (customer.email) {
        if (isEmail && customer.email.toLowerCase() === term) {
          totalScore += 100
          matchCount++
        } else if (customer.email.toLowerCase().includes(term)) {
          totalScore += 90
          matchCount++
        }
      }
      
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
      
      if (customer.customerCode) {
        if (isCode && customer.customerCode.toLowerCase().includes(term)) {
          totalScore += 95
          matchCount++
        } else if (customer.customerCode.toLowerCase().includes(term)) {
          totalScore += 90
          matchCount++
        }
      }
      
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
      
      if (customer.city && customer.city.toLowerCase().includes(term)) {
        totalScore += 70
        matchCount++
      }
      
      if (customer.company && customer.company.toLowerCase().includes(term)) {
        totalScore += 75
        matchCount++
      }
      
      if (customer.address && customer.address.toLowerCase().includes(term)) {
        totalScore += 50
        matchCount++
      }
      
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
    
    return scoredCustomers
      .filter(item => item.score > 25)
      .sort((a, b) => b.score - a.score)
      .map(item => item.customer)
  }, [])

  // Derive filtered customers (not stored in state)
  const filteredCustomers = useMemo(() => {
    let filtered = [...state.customers]

    if (debouncedSearchTerm) {
      filtered = performIntelligentSearch(filtered, debouncedSearchTerm)
    }

    if (state.filters.status !== "all") {
      filtered = filtered.filter(customer => customer.status === state.filters.status)
    }

    if (state.filters.customer_type !== "all") {
      filtered = filtered.filter(customer => customer.customer_type === state.filters.customer_type)
    }

    if (state.filters.segment !== "all") {
      filtered = filtered.filter(customer => customer.segment === state.filters.segment)
    }

    if (state.filters.city !== "all") {
      filtered = filtered.filter(customer => customer.city === state.filters.city)
    }

    if (state.filters.assigned_salesperson !== "all") {
      filtered = filtered.filter(customer => customer.assigned_salesperson === state.filters.assigned_salesperson)
    }

    filtered = filtered.filter(customer =>
      customer.credit_score >= state.filters.credit_score_range[0] &&
      customer.credit_score <= state.filters.credit_score_range[1]
    )

    filtered = filtered.filter(customer =>
      customer.lifetime_value >= state.filters.lifetime_value_range[0] &&
      customer.lifetime_value <= state.filters.lifetime_value_range[1]
    )

    if (state.filters.purchases_min > 0) {
      filtered = filtered.filter(customer => (customer.total_purchases || 0) >= state.filters.purchases_min)
    }

    if (state.filters.spent_min > 0) {
      filtered = filtered.filter(customer => (((customer.total_spent_this_year as number) ?? customer.lifetime_value) || 0) >= state.filters.spent_min)
    }

    if (state.filters.loyalty_points_min > 0) {
      filtered = filtered.filter(customer => (customer.loyalty_points ?? 0) >= state.filters.loyalty_points_min)
    }

    if (state.filters.tags.length > 0) {
      filtered = filtered.filter(customer =>
        state.filters.tags.some(tag => customer.tags.includes(tag))
      )
    }

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
  }, [state.customers, debouncedSearchTerm, state.filters, state.sortBy, state.sortOrder, performIntelligentSearch])

  // Derive pagination metadata from filtered results
  const totalItems = filteredCustomers.length
  const totalPages = Math.ceil(totalItems / state.pagination.itemsPerPage)
  
  // Auto-correct currentPage if it exceeds totalPages
  const currentPage = state.pagination.currentPage > totalPages && totalPages > 0
    ? 1
    : state.pagination.currentPage

  // Derive paginated customers (not stored in state)
  const paginatedCustomers = useMemo(() => {
    const startIndex = (currentPage - 1) * state.pagination.itemsPerPage
    const endIndex = startIndex + state.pagination.itemsPerPage
    return filteredCustomers.slice(startIndex, endIndex)
  }, [filteredCustomers, currentPage, state.pagination.itemsPerPage])

  // Compose the full pagination object for consumers
  const pagination = useMemo(() => ({
    currentPage,
    itemsPerPage: state.pagination.itemsPerPage,
    totalItems,
    totalPages
  }), [currentPage, state.pagination.itemsPerPage, totalItems, totalPages])

  // Pagination functions
  const setPage = useCallback((page: number) => {
    setState(prev => ({
      ...prev,
      pagination: {
        ...prev.pagination,
        currentPage: Math.max(1, Math.min(page, totalPages || 1))
      }
    }))
  }, [totalPages])

  const setItemsPerPage = useCallback((itemsPerPage: number) => {
    setState(prev => ({
      ...prev,
      pagination: {
        ...prev.pagination,
        itemsPerPage,
        currentPage: 1
      }
    }))
  }, [])

  const nextPage = useCallback(() => {
    setPage(currentPage + 1)
  }, [setPage, currentPage])

  const prevPage = useCallback(() => {
    setPage(currentPage - 1)
  }, [setPage, currentPage])

  // Build the public state shape that matches CustomerState for consumers
  const publicState: CustomerState = {
    customers: state.customers,
    filteredCustomers,
    paginatedCustomers,
    filters: state.filters,
    viewMode: state.viewMode,
    selectedCustomer: state.selectedCustomer,
    loading: state.loading,
    searching,
    error: state.error,
    sortBy: state.sortBy,
    sortOrder: state.sortOrder,
    pagination
  }

  // Provide a setState wrapper that keeps the same external API
  // but internally only updates source-of-truth fields
  const publicSetState = useCallback((updater: React.SetStateAction<CustomerState>) => {
    setState(prev => {
      const prevFull: CustomerState = {
        ...prev,
        filteredCustomers: [],
        paginatedCustomers: [],
        searching: false,
      }
      const next = typeof updater === 'function' ? updater(prevFull) : updater
      // Extract only source-of-truth fields
      return {
        customers: next.customers,
        filters: next.filters,
        viewMode: next.viewMode,
        selectedCustomer: next.selectedCustomer,
        loading: next.loading,
        searching: next.searching ?? false,
        error: next.error,
        sortBy: next.sortBy,
        sortOrder: next.sortOrder,
        pagination: {
          currentPage: next.pagination.currentPage,
          itemsPerPage: next.pagination.itemsPerPage,
          totalItems: next.pagination.totalItems,
          totalPages: next.pagination.totalPages,
        }
      }
    })
  }, [])

  return {
    ...publicState,
    setPage,
    setItemsPerPage,
    nextPage,
    prevPage,
    setState: publicSetState
  }
}
