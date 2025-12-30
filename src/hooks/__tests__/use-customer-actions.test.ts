import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useCustomerActions } from '../use-customer-actions'
import { toast } from 'sonner'

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }
}))

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn(() => mockSupabaseClient),
  select: vi.fn(() => mockSupabaseClient),
  insert: vi.fn(() => mockSupabaseClient),
  update: vi.fn(() => mockSupabaseClient),
  delete: vi.fn(() => mockSupabaseClient),
  eq: vi.fn(() => mockSupabaseClient),
  in: vi.fn(() => mockSupabaseClient),
  single: vi.fn(() => Promise.resolve({ data: null, error: null })),
  channel: vi.fn(() => ({
    on: vi.fn(() => ({ on: vi.fn(() => ({ on: vi.fn(() => ({ subscribe: vi.fn() })) })) }))
  }))
}

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabaseClient
}))

// Mock customer service
const mockCustomerService = {
  getCustomers: vi.fn(),
  createCustomer: vi.fn(),
  updateCustomer: vi.fn(),
  deleteCustomer: vi.fn()
}

vi.mock('@/services/customer-service', () => ({
  default: mockCustomerService
}))

const mockCustomer = {
  id: '1',
  name: 'Juan Pérez',
  email: 'juan@example.com',
  phone: '+593991234567',
  customer_type: 'regular' as const,
  status: 'active' as const,
  segment: 'regular',
  city: 'Quito',
  address: 'Av. Principal 123'
}

describe('useCustomerActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createCustomer', () => {
    it('should create a customer successfully', async () => {
      mockCustomerService.createCustomer.mockResolvedValue({
        success: true,
        data: mockCustomer
      })

      const { result } = renderHook(() => useCustomerActions())

      const response = await result.current.createCustomer({
        name: 'Juan Pérez',
        email: 'juan@example.com',
        phone: '+593991234567'
      })

      expect(response.success).toBe(true)
      expect(response.customer).toEqual(mockCustomer)
      expect(toast.success).toHaveBeenCalledWith('Cliente creado exitosamente')
    })

    it('should handle creation errors', async () => {
      mockCustomerService.createCustomer.mockResolvedValue({
        success: false,
        error: 'Email already exists'
      })

      const { result } = renderHook(() => useCustomerActions())

      const response = await result.current.createCustomer({
        name: 'Juan Pérez',
        email: 'juan@example.com',
        phone: '+593991234567'
      })

      expect(response.success).toBe(false)
      expect(toast.error).toHaveBeenCalled()
    })
  })

  describe('updateCustomer', () => {
    it('should update a customer successfully', async () => {
      mockCustomerService.updateCustomer.mockResolvedValue({
        success: true,
        data: { ...mockCustomer, name: 'Juan Pérez Updated' }
      })

      const { result } = renderHook(() => useCustomerActions())

      const response = await result.current.updateCustomer('1', {
        name: 'Juan Pérez Updated'
      })

      expect(response.success).toBe(true)
      expect(toast.success).toHaveBeenCalledWith('Cliente actualizado exitosamente')
    })

    it('should handle update errors', async () => {
      mockCustomerService.updateCustomer.mockResolvedValue({
        success: false,
        error: 'Customer not found'
      })

      const { result } = renderHook(() => useCustomerActions())

      const response = await result.current.updateCustomer('999', {
        name: 'Updated Name'
      })

      expect(response.success).toBe(false)
      expect(toast.error).toHaveBeenCalled()
    })
  })

  describe('deleteCustomer', () => {
    it('should delete a customer successfully', async () => {
      mockCustomerService.deleteCustomer.mockResolvedValue({
        success: true
      })

      const { result } = renderHook(() => useCustomerActions())

      const response = await result.current.deleteCustomer('1')

      expect(response.success).toBe(true)
      expect(toast.success).toHaveBeenCalledWith('Cliente eliminado exitosamente')
    })

    it('should handle deletion errors', async () => {
      mockCustomerService.deleteCustomer.mockResolvedValue({
        success: false,
        error: 'Customer has active orders'
      })

      const { result } = renderHook(() => useCustomerActions())

      const response = await result.current.deleteCustomer('1')

      expect(response.success).toBe(false)
      expect(toast.error).toHaveBeenCalled()
    })
  })

  describe('bulkUpdate', () => {
    it('should update multiple customers successfully', async () => {
      mockSupabaseClient.update.mockReturnValue(mockSupabaseClient)
      mockSupabaseClient.in.mockReturnValue(Promise.resolve({
        data: [mockCustomer, mockCustomer],
        error: null
      }))

      const { result } = renderHook(() => useCustomerActions())

      const response = await result.current.bulkUpdate(
        ['1', '2'],
        { status: 'inactive' as const }
      )

      expect(response.success).toBe(true)
      expect(toast.success).toHaveBeenCalledWith('2 cliente(s) actualizado(s)')
    })
  })

  describe('addNote', () => {
    it('should add a note to customer successfully', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: { notes: 'Existing note' },
        error: null
      })
      mockSupabaseClient.eq.mockReturnValue(Promise.resolve({
        error: null
      }))

      const { result } = renderHook(() => useCustomerActions())

      const response = await result.current.addNote('1', 'New note')

      expect(response.success).toBe(true)
      expect(toast.success).toHaveBeenCalledWith('Nota agregada exitosamente')
    })
  })

  describe('addTag', () => {
    it('should add a tag to customer successfully', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: { tags: ['existing-tag'] },
        error: null
      })
      mockSupabaseClient.eq.mockReturnValue(Promise.resolve({
        error: null
      }))

      const { result } = renderHook(() => useCustomerActions())

      const response = await result.current.addTag('1', 'new-tag')

      expect(response.success).toBe(true)
      expect(toast.success).toHaveBeenCalledWith('Etiqueta agregada exitosamente')
    })

    it('should not add duplicate tag', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: { tags: ['existing-tag'] },
        error: null
      })

      const { result } = renderHook(() => useCustomerActions())

      const response = await result.current.addTag('1', 'existing-tag')

      expect(response.success).toBe(true)
      expect(toast.info).toHaveBeenCalledWith('La etiqueta ya existe')
    })
  })

  describe('removeTag', () => {
    it('should remove a tag from customer successfully', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: { tags: ['tag1', 'tag2'] },
        error: null
      })
      mockSupabaseClient.eq.mockReturnValue(Promise.resolve({
        error: null
      }))

      const { result } = renderHook(() => useCustomerActions())

      const response = await result.current.removeTag('1', 'tag1')

      expect(response.success).toBe(true)
      expect(toast.success).toHaveBeenCalledWith('Etiqueta eliminada exitosamente')
    })
  })

  describe('refreshCustomers', () => {
    it('should refresh customers list successfully', async () => {
      mockCustomerService.getCustomers.mockResolvedValue({
        success: true,
        data: [mockCustomer]
      })

      const { result } = renderHook(() => useCustomerActions())

      const customers = await result.current.refreshCustomers()

      expect(customers).toHaveLength(1)
      expect(toast.success).toHaveBeenCalledWith('Clientes actualizados')
    })
  })
})
