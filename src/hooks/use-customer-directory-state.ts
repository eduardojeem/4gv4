import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useOptionalActiveOrganization } from '@/contexts/ActiveOrganizationContext'
import { mapRawToCustomer, syncCustomerSpend, type Customer, type CustomerFilters, type CustomerState } from './use-customer-state'

const defaultFilters: CustomerFilters = {
  search: '', status: 'all', customer_type: 'all', segment: 'all', city: 'all',
  assigned_salesperson: 'all', date_range: { from: null, to: null },
  credit_score_range: [0, 10], lifetime_value_range: [0, Number.MAX_SAFE_INTEGER],
  tags: [], purchases_min: 0, spent_min: 0, loyalty_points_min: 0,
}

function initialDirectoryState(): CustomerState {
  const params = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search)
  const page = Number(params.get('page'))
  const pageSize = Number(params.get('pageSize'))
  const requestedSort = params.get('sort') || 'created_at'
  const sortBy = ['created_at', 'name', 'email', 'phone', 'status', 'last_activity', 'lifetime_value', 'total_purchases'].includes(requestedSort)
    ? requestedSort : 'created_at'
  const numeric = (key: string, fallback: number) => {
    const value = Number(params.get(key))
    return params.has(key) && Number.isFinite(value) ? value : fallback
  }
  const date = (key: string) => {
    const value = params.get(key)
    if (!value) return null
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  return {
    customers: [], filteredCustomers: [], paginatedCustomers: [],
    filters: {
      ...defaultFilters,
      search: params.get('search') || params.get('q') || '',
      status: params.get('status') || 'all',
      customer_type: params.get('customer_type') || 'all',
      segment: params.get('segment') || 'all',
      city: params.get('city') || 'all',
      assigned_salesperson: params.get('assigned_salesperson') || 'all',
      credit_score_range: [numeric('credit_score_min', 0), numeric('credit_score_max', 10)],
      lifetime_value_range: [numeric('lifetime_value_min', 0), numeric('lifetime_value_max', Number.MAX_SAFE_INTEGER)],
      loyalty_points_min: numeric('loyalty_points_min', 0),
      purchases_min: numeric('purchases_min', 0),
      spent_min: numeric('spent_min', 0),
      has_credit_limit: params.get('has_credit_limit') === '1',
      has_debt: params.get('has_debt') === 'true',
      tags: params.getAll('tag'),
      date_range: { from: date('registered_from'), to: date('registered_to') },
    },
    viewMode: 'table', selectedCustomer: null, loading: true, searching: false,
    error: null, sortBy, sortOrder: params.get('order') === 'asc' ? 'asc' : 'desc',
    pagination: {
      currentPage: Number.isInteger(page) && page > 0 ? page : 1,
      itemsPerPage: [10, 25, 50, 100].includes(pageSize) ? pageSize : 10,
      totalItems: 0, totalPages: 0,
    },
  }
}

export function customerDirectoryParams(filters: CustomerFilters, page: number, limit: number, sort = 'created_at', order: 'asc' | 'desc' = 'desc'): URLSearchParams {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  params.set('sort', sort)
  params.set('order', order)
  const values: Record<string, string> = {
    search: filters.search.trim(), status: filters.status, customer_type: filters.customer_type,
    segment: filters.segment, city: filters.city, assigned_salesperson: filters.assigned_salesperson,
  }
  for (const [key, value] of Object.entries(values)) if (value && value !== 'all') params.set(key, value)
  if (filters.credit_score_range[0] > 0) params.set('credit_score_min', String(filters.credit_score_range[0]))
  if (filters.credit_score_range[1] < 10) params.set('credit_score_max', String(filters.credit_score_range[1]))
  if (filters.loyalty_points_min > 0) params.set('loyalty_points_min', String(filters.loyalty_points_min))
  if (filters.purchases_min > 0) params.set('purchases_min', String(filters.purchases_min))
  if (filters.spent_min > 0) params.set('spent_min', String(filters.spent_min))
  if (filters.lifetime_value_range[0] > 0) params.set('lifetime_value_min', String(filters.lifetime_value_range[0]))
  if (filters.lifetime_value_range[1] < Number.MAX_SAFE_INTEGER) params.set('lifetime_value_max', String(filters.lifetime_value_range[1]))
  if (filters.has_credit_limit) params.set('has_credit_limit', '1')
  if (filters.has_debt) params.set('has_debt', 'true')
  for (const tag of filters.tags) params.append('tag', tag)
  if (filters.date_range.from) params.set('registered_from', filters.date_range.from.toISOString())
  if (filters.date_range.to) params.set('registered_to', filters.date_range.to.toISOString())
  return params
}

export function useCustomerDirectoryState() {
  const [state, setState] = useState<CustomerState>(initialDirectoryState)
  const [revision, setRevision] = useState(0)
  const [directorySummary, setDirectorySummary] = useState({ total: 0, active: 0 })
  const organizationContext = useOptionalActiveOrganization()
  const organizationId = organizationContext?.organization?.id ?? null
  const organizationLoading = organizationContext?.isLoading ?? false
  const organizationError = organizationContext?.error ?? null
  const previousOrganizationId = useRef(organizationId)
  useEffect(() => {
    if (previousOrganizationId.current === organizationId) return
    previousOrganizationId.current = organizationId
    setState((prev) => ({ ...prev, customers: [], filteredCustomers: [], paginatedCustomers: [], loading: true }))
    setDirectorySummary({ total: 0, active: 0 })
  }, [organizationId])
  useEffect(() => {
    const restore = () => {
      const next = initialDirectoryState()
      setState((prev) => ({
        ...prev,
        filters: next.filters,
        sortBy: next.sortBy,
        sortOrder: next.sortOrder,
        pagination: { ...prev.pagination, currentPage: next.pagination.currentPage, itemsPerPage: next.pagination.itemsPerPage },
      }))
    }
    window.addEventListener('popstate', restore)
    return () => window.removeEventListener('popstate', restore)
  }, [])
  const refreshPage = useCallback(async () => {
    setRevision((value) => value + 1)
    return undefined as Customer[] | undefined
  }, [])

  useEffect(() => {
    if (organizationId || organizationLoading) return
    setState((prev) => ({
      ...prev, loading: false,
      error: organizationError || 'No hay una organización activa para cargar clientes.',
    }))
  }, [organizationId, organizationLoading, organizationError])

  useEffect(() => {
    if (!organizationId) return
    const controller = new AbortController()
    const params = customerDirectoryParams(state.filters, state.pagination.currentPage, state.pagination.itemsPerPage, state.sortBy, state.sortOrder)
    setState((prev) => ({ ...prev, loading: true, error: null }))
    void (async () => {
      try {
        const response = await fetch(`/api/customers?${params.toString()}`, { signal: controller.signal })
        const result = await response.json()
        if (!response.ok || !result.success) throw new Error(result.error || 'No se pudieron cargar los clientes.')
        if (controller.signal.aborted) return
        const customers = (result.data || []).map(mapRawToCustomer) as Customer[]
        const total = Number(result.pagination?.total || 0)
        const lastPage = Math.max(1, Math.ceil(total / state.pagination.itemsPerPage))
        if (state.pagination.currentPage > lastPage) {
          setState((prev) => ({ ...prev, pagination: { ...prev.pagination, currentPage: lastPage } }))
          return
        }
        setState((prev) => ({
          ...prev, customers, filteredCustomers: customers, paginatedCustomers: customers,
          loading: false, error: null,
          pagination: { ...prev.pagination, totalItems: total, totalPages: Math.ceil(total / prev.pagination.itemsPerPage) },
        }))
        if (result.summary) setDirectorySummary({ total: Number(result.summary.total || 0), active: Number(result.summary.active || 0) })
        void syncCustomerSpend(setState, customers).catch(() => {
          if (!controller.signal.aborted) toast.warning('Los importes gastados pueden no estar al día.')
        })
      } catch (error) {
        if (controller.signal.aborted) return
        setState((prev) => ({ ...prev, loading: false, error: error instanceof Error ? error.message : 'No se pudieron cargar los clientes.' }))
      }
    })()
    return () => controller.abort()
  }, [state.filters, state.pagination.currentPage, state.pagination.itemsPerPage, state.sortBy, state.sortOrder, revision, organizationId])

  useEffect(() => {
    if (!organizationId) return
    const client = createClient()
    const channel = client.channel(`customer_directory:${organizationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers', filter: `organization_id=eq.${organizationId}` }, () => setRevision((value) => value + 1))
      .subscribe()
    return () => { void client.removeChannel(channel) }
  }, [organizationId])

  const setPage = useCallback((page: number) => setState((prev) => ({
    ...prev, pagination: { ...prev.pagination, currentPage: Math.max(1, Math.min(page, prev.pagination.totalPages || page)) },
  })), [])
  const setItemsPerPage = useCallback((itemsPerPage: number) => setState((prev) => ({
    ...prev, pagination: { ...prev.pagination, currentPage: 1, itemsPerPage },
  })), [])
  const setSort = useCallback((sortBy: string, sortOrder: 'asc' | 'desc') => setState((prev) => ({
    ...prev, sortBy, sortOrder, pagination: { ...prev.pagination, currentPage: 1 },
  })), [])
  const nextPage = useCallback(() => setPage(state.pagination.currentPage + 1), [setPage, state.pagination.currentPage])
  const prevPage = useCallback(() => setPage(state.pagination.currentPage - 1), [setPage, state.pagination.currentPage])

  // La página visible es la única fuente de filas. Los importes enriquecidos y
  // las ediciones actualizan `customers`; no conservar copias que queden viejas.
  return {
    ...state,
    filteredCustomers: state.customers,
    paginatedCustomers: state.customers,
    setState, setPage, setItemsPerPage, setSort, nextPage, prevPage, refreshPage, directorySummary,
  }
}
