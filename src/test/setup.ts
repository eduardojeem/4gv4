/**
 * Test Setup - Fase 5 Testing & QA
 * Configuración global para todos los tests
 */

import '@testing-library/jest-dom'
import { expect, afterEach, beforeAll, afterAll, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { server } from './mocks/server'

// Configuración global de mocks
beforeAll(() => {
  // Iniciar MSW server para mocks de API
  server.listen({ onUnhandledRequest: 'error' })
  
  // Mock de Next.js router
  vi.mock('next/navigation', () => ({
    useRouter: () => ({
      push: vi.fn(),
      replace: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      prefetch: vi.fn()
    }),
    usePathname: () => '/dashboard',
    useSearchParams: () => new URLSearchParams()
  }))

  // Mock de Supabase con channel completo
  vi.mock('@/lib/supabase/client', () => ({
    createClient: () => {
      const mockChannel = {
        on: vi.fn(),
        subscribe: vi.fn(),
        unsubscribe: vi.fn()
      }
      
      // Configurar el método 'on' para que retorne el mismo channel para chaining
      mockChannel.on.mockImplementation(() => mockChannel)
      
      return {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              data: [],
              error: null
            }))
          })),
          insert: vi.fn(() => ({
            data: [],
            error: null
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              data: [],
              error: null
            }))
          })),
          delete: vi.fn(() => ({
            eq: vi.fn(() => ({
              data: [],
              error: null
            }))
          }))
        })),
        channel: vi.fn(() => mockChannel),
        auth: {
          getUser: vi.fn(() => Promise.resolve({
            data: { user: { id: 'test-user', email: 'test@example.com' } },
            error: null
          }))
        }
      }
    }
  }))

  // Mock de performance APIs
  Object.defineProperty(window, 'performance', {
    value: {
      now: vi.fn(() => Date.now()),
      mark: vi.fn(),
      measure: vi.fn(),
      getEntriesByType: vi.fn(() => []),
      getEntriesByName: vi.fn(() => [])
    },
    writable: true
  })

  // También definir en global para compatibilidad
  Object.defineProperty(global, 'performance', {
    value: {
      now: vi.fn(() => Date.now()),
      mark: vi.fn(),
      measure: vi.fn(),
      getEntriesByType: vi.fn(() => []),
      getEntriesByName: vi.fn(() => [])
    },
    writable: true
  })

  // Mock de PerformanceObserver
  global.PerformanceObserver = vi.fn().mockImplementation((callback) => {
    const mockObserver = {
      observe: vi.fn(),
      disconnect: vi.fn(),
      takeRecords: vi.fn(() => []),
      // Simular callback para tests
      _callback: callback,
      _triggerCallback: (entries: any[]) => {
        if (callback) {
          callback({ 
            getEntries: () => entries,
            getEntriesByName: (name: string) => entries.filter(e => e.name === name),
            getEntriesByType: (type: string) => entries.filter(e => e.entryType === type)
          }, mockObserver)
        }
      }
    }
    return mockObserver
  })

  // Mock de PerformanceEntry para Web Vitals
  global.PerformanceEntry = vi.fn().mockImplementation(() => ({
    name: 'test-entry',
    entryType: 'measure',
    startTime: 0,
    duration: 100
  }))

  // Mock específico para Web Vitals entries
  const createMockWebVitalEntry = (type: string, value: number) => ({
    name: type,
    entryType: type,
    startTime: value,
    duration: value,
    value: value,
    hadRecentInput: false
  })

  // Hacer disponibles los mocks para tests específicos
  ;(global as any).createMockWebVitalEntry = createMockWebVitalEntry

  // Mock de IntersectionObserver
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn()
  }))

  // Mock de ResizeObserver
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn()
  }))

  // Mock de matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  })

  // Mock de localStorage
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn()
  }
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock
  })

  // Mock de console para tests más limpios
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  // Limpiar DOM después de cada test
  cleanup()
  
  // Reset de todos los mocks
  vi.clearAllMocks()
  
  // Reset de MSW handlers
  server.resetHandlers()
})

afterAll(() => {
  // Cerrar MSW server
  server.close()
  
  // Restaurar mocks
  vi.restoreAllMocks()
})

// Utilidades de testing personalizadas
export const createMockUser = (overrides = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  role: 'user',
  ...overrides
})

export const createMockProduct = (overrides = {}) => ({
  id: 'test-product-id',
  name: 'Test Product',
  price: 100,
  stock: 10,
  category: 'test-category',
  ...overrides
})

export const createMockCustomer = (overrides = {}) => ({
  id: 'test-customer-id',
  name: 'Test Customer',
  email: 'customer@example.com',
  phone: '123-456-7890',
  ...overrides
})

// Matcher personalizado para testing de performance
expect.extend({
  toBeWithinPerformanceThreshold(received: number, threshold: number) {
    const pass = received <= threshold
    return {
      pass,
      message: () =>
        pass
          ? `Expected ${received}ms to exceed ${threshold}ms`
          : `Expected ${received}ms to be within ${threshold}ms threshold`
    }
  }
})

// Declaración de tipos para TypeScript
declare global {
  namespace Vi {
    interface JestAssertion<T = any> {
      toBeWithinPerformanceThreshold(threshold: number): T
    }
  }
}