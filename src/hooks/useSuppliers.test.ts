import { describe, it, expect, vi, beforeEach } from 'vitest'
import { computeSupplierStats } from './suppliers-stats'
import type { UISupplier } from '../lib/types/supplier-ui'

vi.mock('@/lib/supabase/client', () => {
  const insert = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: {} }) }) })
  const update = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: {} }) }), eq: vi.fn() })
  const del = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({}) })
  const order = vi.fn().mockReturnValue({ range: vi.fn().mockReturnValue(Promise.resolve({ data: [], count: 0 })) })
  const select = vi.fn().mockReturnValue({ order })
  const from = vi.fn().mockReturnValue({ select, insert, update, delete: del })
  const channel = vi.fn().mockReturnValue({ on: vi.fn().mockReturnValue({ subscribe: vi.fn().mockReturnValue({}) }) })
  return {
    createClient: () => ({ from, channel, removeChannel: vi.fn() })
  }
})

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

describe('computeSupplierStats', () => {
  it('calcula métricas básicas correctamente', () => {
    const data: UISupplier[] = [
      { id: '1', name: 'A', contact_person: 'X', email: 'a@x.com', phone: '1', business_type: 'manufacturer', status: 'active', rating: 4, total_orders: 2, total_amount: 100, address: '', city: '', country: '', website: '', postal_code: '', notes: '', created_at: '', updated_at: '' },
      { id: '2', name: 'B', contact_person: 'Y', email: 'b@y.com', phone: '2', business_type: 'retailer', status: 'inactive', rating: 2, total_orders: 1, total_amount: 50, address: '', city: '', country: '', website: '', postal_code: '', notes: '', created_at: '', updated_at: '' },
    ]
    const stats = computeSupplierStats(data)
    expect(stats.total_suppliers).toBe(2)
    expect(stats.active_suppliers).toBe(1)
    expect(stats.inactive_suppliers).toBe(1)
    expect(stats.pending_suppliers).toBe(0)
    expect(stats.avg_rating).toBe((4 + 2) / 2)
    expect(stats.total_orders).toBe(3)
    expect(stats.total_amount).toBe(150)
  })
})

// Pruebas limitadas a la función pura para evitar dependencias de alias en entorno de tests
