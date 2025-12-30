/**
 * MSW Server Setup - Fase 5 Testing & QA
 * Mock Service Worker para interceptar requests HTTP en tests
 */

import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

// Handlers para diferentes endpoints
const handlers = [
  // Auth endpoints
  http.post('/api/auth/login', () => {
    return HttpResponse.json({
      user: {
        id: 'test-user',
        email: 'test@example.com',
        name: 'Test User'
      },
      token: 'mock-jwt-token'
    })
  }),

  // Products endpoints
  http.get('/api/products', ({ request }: { request: Request }) => {
    const url = new URL(request.url)
    const page = url.searchParams.get('page') || '1'
    const limit = url.searchParams.get('limit') || '10'
    
    return HttpResponse.json({
      data: Array.from({ length: parseInt(limit) }, (_, i) => ({
        id: `product-${i + 1}`,
        name: `Product ${i + 1}`,
        price: (i + 1) * 10,
        stock: Math.floor(Math.random() * 100),
        category: 'test-category'
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: 100,
        totalPages: Math.ceil(100 / parseInt(limit))
      }
    })
  }),

  http.post('/api/products', async ({ request }: { request: Request }) => {
    const body = await request.json()
    return HttpResponse.json({
      id: 'new-product-id',
      ...body,
      createdAt: new Date().toISOString()
    }, { status: 201 })
  }),

  http.put('/api/products/:id', async ({ params, request }: { params: Record<string, string>; request: Request }) => {
    const body = await request.json()
    return HttpResponse.json({
      id: params.id,
      ...body,
      updatedAt: new Date().toISOString()
    })
  }),

  http.delete('/api/products/:id', ({ params }: { params: Record<string, string> }) => {
    return HttpResponse.json({
      message: `Product ${params.id} deleted successfully`
    })
  }),

  // Customers endpoints
  http.get('/api/customers', () => {
    return HttpResponse.json({
      data: [
        {
          id: 'customer-1',
          name: 'John Doe',
          email: 'john@example.com',
          phone: '123-456-7890'
        },
        {
          id: 'customer-2',
          name: 'Jane Smith',
          email: 'jane@example.com',
          phone: '098-765-4321'
        }
      ]
    })
  }),

  // POS endpoints
  http.post('/api/pos/checkout', async ({ request }: { request: Request }) => {
    const body = await request.json()
    return HttpResponse.json({
      transactionId: 'txn-' + Date.now(),
      total: body.total,
      status: 'completed',
      receipt: {
        id: 'receipt-' + Date.now(),
        items: body.items,
        total: body.total,
        timestamp: new Date().toISOString()
      }
    })
  }),

  // Analytics endpoints
  http.get('/api/analytics/dashboard', () => {
    return HttpResponse.json({
      totalSales: 15000,
      totalOrders: 150,
      totalCustomers: 75,
      averageOrderValue: 100,
      salesGrowth: 12.5,
      topProducts: [
        { id: '1', name: 'Product 1', sales: 50 },
        { id: '2', name: 'Product 2', sales: 45 },
        { id: '3', name: 'Product 3', sales: 40 }
      ]
    })
  }),

  // Error scenarios para testing
  http.get('/api/error/500', () => {
    return HttpResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }),

  http.get('/api/error/404', () => {
    return HttpResponse.json(
      { error: 'Not Found' },
      { status: 404 }
    )
  }),

  http.get('/api/error/timeout', () => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(HttpResponse.json({ data: 'delayed response' }))
      }, 5000)
    })
  })
]

// Crear servidor MSW
export const server = setupServer(...handlers)

// Utilidades para tests
export const mockApiError = (endpoint: string, status: number = 500) => {
  server.use(
    http.get(endpoint, () => {
      return HttpResponse.json(
        { error: 'Mock API Error' },
        { status }
      )
    })
  )
}

export const mockApiSuccess = (endpoint: string, data: any) => {
  server.use(
    http.get(endpoint, () => {
      return HttpResponse.json(data)
    })
  )
}

export const mockApiDelay = (endpoint: string, delay: number = 1000) => {
  server.use(
    http.get(endpoint, async () => {
      await new Promise(resolve => setTimeout(resolve, delay))
      return HttpResponse.json({ data: 'delayed response' })
    })
  )
}