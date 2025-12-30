/**
 * useCustomers Hook Tests - Fase 5 Testing & QA
 * Tests para el hook de gestión de clientes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useCustomers } from '@/hooks/use-customers'
import { createMockCustomer } from '@/test/setup'

// Mock de Supabase
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        data: [],
        error: null
      })),
      ilike: vi.fn(() => ({
        data: [],
        error: null
      })),
      order: vi.fn(() => ({
        data: [],
        error: null
      })),
      range: vi.fn(() => ({
        data: [],
        error: null,
        count: 0
      }))
    })),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        data: [],
        error: null
      }))
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({
          data: [],
          error: null
        }))
      }))
    })),
    delete: vi.fn(() => ({
      eq: vi.fn(() => ({
        data: [],
        error: null
      }))
    }))
  }))
}

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabase
}))

describe('useCustomers Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Initial State', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useCustomers())
      
      expect(result.current.customers).toEqual([])
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.totalCount).toBe(0)
      expect(result.current.currentPage).toBe(1)
    })
  })

  describe('Fetch Customers', () => {
    it('should fetch customers successfully', async () => {
      const mockCustomers = [
        createMockCustomer({ id: '1', name: 'John Doe' }),
        createMockCustomer({ id: '2', name: 'Jane Smith' })
      ]
      
      mockSupabase.from().select().order.mockResolvedValueOnce({
        data: mockCustomers,
        error: null,
        count: 2
      })
      
      const { result } = renderHook(() => useCustomers())
      
      await act(async () => {
        await result.current.fetchCustomers()
      })
      
      expect(result.current.customers).toEqual(mockCustomers)
      expect(result.current.totalCount).toBe(2)
      expect(result.current.loading).toBe(false)
    })

    it('should handle fetch errors', async () => {
      const mockError = { message: 'Database error' }
      
      mockSupabase.from().select().order.mockResolvedValueOnce({
        data: null,
        error: mockError
      })
      
      const { result } = renderHook(() => useCustomers())
      
      await act(async () => {
        await result.current.fetchCustomers()
      })
      
      expect(result.current.customers).toEqual([])
      expect(result.current.error).toBe(mockError.message)
      expect(result.current.loading).toBe(false)
    })

    it('should set loading state during fetch', async () => {
      let resolvePromise: (value: any) => void
      const promise = new Promise(resolve => {
        resolvePromise = resolve
      })
      
      mockSupabase.from().select().order.mockReturnValueOnce(promise)
      
      const { result } = renderHook(() => useCustomers())
      
      act(() => {
        result.current.fetchCustomers()
      })
      
      expect(result.current.loading).toBe(true)
      
      await act(async () => {
        resolvePromise!({ data: [], error: null })
        await promise
      })
      
      expect(result.current.loading).toBe(false)
    })
  })

  describe('Search Customers', () => {
    it('should search customers by name', async () => {
      const mockCustomers = [
        createMockCustomer({ id: '1', name: 'John Doe' })
      ]
      
      mockSupabase.from().select().ilike.mockResolvedValueOnce({
        data: mockCustomers,
        error: null
      })
      
      const { result } = renderHook(() => useCustomers())
      
      await act(async () => {
        await result.current.searchCustomers('John')
      })
      
      expect(mockSupabase.from().select().ilike).toHaveBeenCalledWith('name', '%John%')
      expect(result.current.customers).toEqual(mockCustomers)
    })

    it('should search customers by email', async () => {
      const mockCustomers = [
        createMockCustomer({ id: '1', email: 'john@example.com' })
      ]
      
      mockSupabase.from().select().ilike.mockResolvedValueOnce({
        data: mockCustomers,
        error: null
      })
      
      const { result } = renderHook(() => useCustomers())
      
      await act(async () => {
        await result.current.searchCustomers('john@example.com')
      })
      
      expect(result.current.customers).toEqual(mockCustomers)
    })

    it('should handle empty search query', async () => {
      const { result } = renderHook(() => useCustomers())
      
      await act(async () => {
        await result.current.searchCustomers('')
      })
      
      // Should call fetchCustomers instead
      expect(mockSupabase.from().select().order).toHaveBeenCalled()
    })
  })

  describe('Create Customer', () => {
    it('should create customer successfully', async () => {
      const newCustomer = createMockCustomer({ name: 'New Customer' })
      
      mockSupabase.from().insert().select.mockResolvedValueOnce({
        data: [newCustomer],
        error: null
      })
      
      const { result } = renderHook(() => useCustomers())
      
      let createdCustomer: any
      
      await act(async () => {
        createdCustomer = await result.current.createCustomer({
          name: 'New Customer',
          email: 'new@example.com',
          phone: '123-456-7890'
        })
      })
      
      expect(createdCustomer).toEqual(newCustomer)
      expect(mockSupabase.from().insert).toHaveBeenCalledWith({
        name: 'New Customer',
        email: 'new@example.com',
        phone: '123-456-7890'
      })
    })

    it('should handle create errors', async () => {
      const mockError = { message: 'Validation error' }
      
      mockSupabase.from().insert().select.mockResolvedValueOnce({
        data: null,
        error: mockError
      })
      
      const { result } = renderHook(() => useCustomers())
      
      await expect(
        act(async () => {
          await result.current.createCustomer({
            name: 'Invalid Customer',
            email: 'invalid-email'
          })
        })
      ).rejects.toThrow('Validation error')
    })

    it('should validate required fields', async () => {
      const { result } = renderHook(() => useCustomers())
      
      await expect(
        act(async () => {
          await result.current.createCustomer({
            name: '', // Empty name
            email: 'test@example.com'
          })
        })
      ).rejects.toThrow('Name is required')
    })
  })

  describe('Update Customer', () => {
    it('should update customer successfully', async () => {
      const updatedCustomer = createMockCustomer({ 
        id: '1', 
        name: 'Updated Name' 
      })
      
      mockSupabase.from().update().eq().select.mockResolvedValueOnce({
        data: [updatedCustomer],
        error: null
      })
      
      const { result } = renderHook(() => useCustomers())
      
      let result_customer: any
      
      await act(async () => {
        result_customer = await result.current.updateCustomer('1', {
          name: 'Updated Name'
        })
      })
      
      expect(result_customer).toEqual(updatedCustomer)
      expect(mockSupabase.from().update).toHaveBeenCalledWith({
        name: 'Updated Name'
      })
    })

    it('should handle update errors', async () => {
      const mockError = { message: 'Customer not found' }
      
      mockSupabase.from().update().eq().select.mockResolvedValueOnce({
        data: null,
        error: mockError
      })
      
      const { result } = renderHook(() => useCustomers())
      
      await expect(
        act(async () => {
          await result.current.updateCustomer('non-existent', {
            name: 'Updated Name'
          })
        })
      ).rejects.toThrow('Customer not found')
    })
  })

  describe('Delete Customer', () => {
    it('should delete customer successfully', async () => {
      mockSupabase.from().delete().eq.mockResolvedValueOnce({
        data: [],
        error: null
      })
      
      const { result } = renderHook(() => useCustomers())
      
      await act(async () => {
        await result.current.deleteCustomer('1')
      })
      
      expect(mockSupabase.from().delete().eq).toHaveBeenCalledWith('id', '1')
    })

    it('should handle delete errors', async () => {
      const mockError = { message: 'Cannot delete customer with active orders' }
      
      mockSupabase.from().delete().eq.mockResolvedValueOnce({
        data: null,
        error: mockError
      })
      
      const { result } = renderHook(() => useCustomers())
      
      await expect(
        act(async () => {
          await result.current.deleteCustomer('1')
        })
      ).rejects.toThrow('Cannot delete customer with active orders')
    })
  })

  describe('Pagination', () => {
    it('should handle pagination correctly', async () => {
      const mockCustomers = Array.from({ length: 10 }, (_, i) => 
        createMockCustomer({ id: `${i + 1}`, name: `Customer ${i + 1}` })
      )
      
      mockSupabase.from().select().order().range.mockResolvedValueOnce({
        data: mockCustomers.slice(0, 5),
        error: null,
        count: 10
      })
      
      const { result } = renderHook(() => useCustomers())
      
      await act(async () => {
        await result.current.fetchCustomers({ page: 1, limit: 5 })
      })
      
      expect(result.current.customers).toHaveLength(5)
      expect(result.current.totalCount).toBe(10)
      expect(result.current.currentPage).toBe(1)
    })

    it('should navigate to next page', async () => {
      const { result } = renderHook(() => useCustomers())
      
      mockSupabase.from().select().order().range.mockResolvedValueOnce({
        data: [],
        error: null,
        count: 20
      })
      
      await act(async () => {
        await result.current.goToPage(2)
      })
      
      expect(result.current.currentPage).toBe(2)
      expect(mockSupabase.from().select().order().range).toHaveBeenCalledWith(10, 19)
    })
  })

  describe('Performance', () => {
    it('should debounce search queries', async () => {
      const { result } = renderHook(() => useCustomers())
      
      // Multiple rapid search calls
      act(() => {
        result.current.searchCustomers('J')
        result.current.searchCustomers('Jo')
        result.current.searchCustomers('Joh')
        result.current.searchCustomers('John')
      })
      
      await waitFor(() => {
        // Should only make one API call due to debouncing
        expect(mockSupabase.from().select().ilike).toHaveBeenCalledTimes(1)
        expect(mockSupabase.from().select().ilike).toHaveBeenCalledWith('name', '%John%')
      })
    })

    it('should cache customer data', async () => {
      const mockCustomers = [createMockCustomer({ id: '1' })]
      
      mockSupabase.from().select().order.mockResolvedValueOnce({
        data: mockCustomers,
        error: null
      })
      
      const { result } = renderHook(() => useCustomers())
      
      // First fetch
      await act(async () => {
        await result.current.fetchCustomers()
      })
      
      // Second fetch should use cache
      await act(async () => {
        await result.current.fetchCustomers({ useCache: true })
      })
      
      // Should only call API once
      expect(mockSupabase.from().select().order).toHaveBeenCalledTimes(1)
      expect(result.current.customers).toEqual(mockCustomers)
    })
  })
})