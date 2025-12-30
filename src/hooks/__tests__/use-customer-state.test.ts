import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useCustomerState } from '../use-customer-state'

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        range: () => ({
          order: () => Promise.resolve({
            data: mockCustomers,
            error: null,
            count: mockCustomers.length
          })
        })
      })
    }),
    channel: () => ({
      on: () => ({ on: () => ({ on: () => ({ subscribe: () => ({}) }) }) })
    })
  })
}))

// Mock customer service
vi.mock('@/services/customer-service', () => ({
  default: {
    getCustomers: vi.fn(() => Promise.resolve({
      success: true,
      data: mockCustomers,
      pagination: {
        page: 1,
        limit: 50,
        total: mockCustomers.length,
        totalPages: 1
      }
    }))
  }
}))

const mockCustomers = [
  {
    id: '1',
    customerCode: 'CLI-001',
    name: 'Juan Pérez',
    email: 'juan@example.com',
    phone: '+593991234567',
    customer_type: 'regular' as const,
    status: 'active' as const,
    segment: 'regular',
    city: 'Quito',
    address: 'Av. Principal 123',
    lifetime_value: 1000,
    credit_score: 8,
    tags: ['vip'],
    total_purchases: 5,
    total_repairs: 2,
    registration_date: '2024-01-01',
    last_visit: '2024-12-01',
    last_activity: '2024-12-01',
    satisfaction_score: 9,
    avg_order_value: 200,
    purchase_frequency: 'medium',
    preferred_contact: 'email',
    loyalty_points: 100,
    credit_limit: 5000,
    current_balance: 0,
    pending_amount: 0,
    notes: '',
    discount_percentage: 0,
    payment_terms: 'Contado',
    assigned_salesperson: 'María López',
    last_purchase_amount: 200,
    total_spent_this_year: 1000
  },
  {
    id: '2',
    customerCode: 'CLI-002',
    name: 'María García',
    email: 'maria@example.com',
    phone: '+593991234568',
    customer_type: 'premium' as const,
    status: 'active' as const,
    segment: 'premium',
    city: 'Guayaquil',
    address: 'Calle Secundaria 456',
    lifetime_value: 5000,
    credit_score: 9,
    tags: ['premium'],
    total_purchases: 20,
    total_repairs: 5,
    registration_date: '2023-06-01',
    last_visit: '2024-12-05',
    last_activity: '2024-12-05',
    satisfaction_score: 10,
    avg_order_value: 250,
    purchase_frequency: 'high',
    preferred_contact: 'whatsapp',
    loyalty_points: 500,
    credit_limit: 10000,
    current_balance: 0,
    pending_amount: 0,
    notes: '',
    discount_percentage: 10,
    payment_terms: '30 días',
    assigned_salesperson: 'Pedro Sánchez',
    last_purchase_amount: 300,
    total_spent_this_year: 5000
  }
]

describe('useCustomerState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should load customers on mount', async () => {
    const { result } = renderHook(() => useCustomerState())

    expect(result.current.loading).toBe(true)

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.customers).toHaveLength(2)
    expect(result.current.customers[0].name).toBe('Juan Pérez')
  })

  it('should filter customers by search term', async () => {
    const { result } = renderHook(() => useCustomerState())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Update search filter
    result.current.setState(prev => ({
      ...prev,
      filters: {
        ...prev.filters,
        search: 'juan'
      }
    }))

    await waitFor(() => {
      expect(result.current.filteredCustomers).toHaveLength(1)
      expect(result.current.filteredCustomers[0].name).toBe('Juan Pérez')
    })
  })

  it('should filter customers by status', async () => {
    const { result } = renderHook(() => useCustomerState())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Both customers are active
    result.current.setState(prev => ({
      ...prev,
      filters: {
        ...prev.filters,
        status: 'active'
      }
    }))

    await waitFor(() => {
      expect(result.current.filteredCustomers).toHaveLength(2)
    })
  })

  it('should filter customers by customer type', async () => {
    const { result } = renderHook(() => useCustomerState())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    result.current.setState(prev => ({
      ...prev,
      filters: {
        ...prev.filters,
        customer_type: 'premium'
      }
    }))

    await waitFor(() => {
      expect(result.current.filteredCustomers).toHaveLength(1)
      expect(result.current.filteredCustomers[0].customer_type).toBe('premium')
    })
  })

  it('should paginate customers correctly', async () => {
    const { result } = renderHook(() => useCustomerState())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Set items per page to 1
    result.current.setItemsPerPage(1)

    await waitFor(() => {
      expect(result.current.paginatedCustomers).toHaveLength(1)
      expect(result.current.pagination.totalPages).toBe(2)
    })

    // Go to page 2
    result.current.setPage(2)

    await waitFor(() => {
      expect(result.current.pagination.currentPage).toBe(2)
      expect(result.current.paginatedCustomers[0].name).toBe('María García')
    })
  })

  it('should handle empty search results', async () => {
    const { result } = renderHook(() => useCustomerState())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    result.current.setState(prev => ({
      ...prev,
      filters: {
        ...prev.filters,
        search: 'nonexistent'
      }
    }))

    await waitFor(() => {
      expect(result.current.filteredCustomers).toHaveLength(0)
    })
  })

  it('should filter by credit score range', async () => {
    const { result } = renderHook(() => useCustomerState())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Filter for credit score >= 9
    result.current.setState(prev => ({
      ...prev,
      filters: {
        ...prev.filters,
        credit_score_range: [9, 10]
      }
    }))

    await waitFor(() => {
      expect(result.current.filteredCustomers).toHaveLength(1)
      expect(result.current.filteredCustomers[0].name).toBe('María García')
    })
  })

  it('should filter by lifetime value range', async () => {
    const { result } = renderHook(() => useCustomerState())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Filter for lifetime value >= 5000
    result.current.setState(prev => ({
      ...prev,
      filters: {
        ...prev.filters,
        lifetime_value_range: [5000, 10000]
      }
    }))

    await waitFor(() => {
      expect(result.current.filteredCustomers).toHaveLength(1)
      expect(result.current.filteredCustomers[0].name).toBe('María García')
    })
  })
})
