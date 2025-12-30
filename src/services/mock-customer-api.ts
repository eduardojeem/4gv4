import { Customer } from '@/hooks/use-customer-state'
import { CreateCustomerRequest, CustomerResponse, CustomersListResponse } from './customer-service'

// Mock data storage (in a real app, this would be a database)
let mockCustomers: Customer[] = [
  {
    id: "1",
    customerCode: "CLI-001",
    name: "María García",
    email: "maria.garcia@email.com",
    phone: "+598 99 123 456",
    address: "Av. 18 de Julio 1234, Montevideo",
    city: "Montevideo",
    customer_type: "premium",
    status: "active",
    total_purchases: 45,
    total_repairs: 3,
    registration_date: "2020-03-15",
    last_visit: "2024-01-15",
    last_activity: "2024-01-15",
    credit_score: 9.5,
    segment: "high_value",
    satisfaction_score: 4.8,
    lifetime_value: 15000,
    avg_order_value: 333,
    purchase_frequency: "high",
    preferred_contact: "email",
    birthday: "1985-05-15",
    loyalty_points: 1500,
    credit_limit: 20000,
    current_balance: 0,
    pending_amount: 0,
    notes: "Cliente VIP desde 2020",
    tags: ["vip", "loyal"],
    company: "Tech Solutions SA",
    referral_source: "Referido",
    discount_percentage: 10,
    payment_terms: "30 días",
    assigned_salesperson: "Juan Pérez",
    last_purchase_amount: 500,
    total_spent_this_year: 8000
  },
  {
    id: "2",
    customerCode: "CLI-002",
    name: "Carlos Rodríguez",
    email: "carlos.rodriguez@email.com",
    phone: "+598 99 234 567",
    address: "Bvar. Artigas 567, Montevideo",
    city: "Montevideo",
    customer_type: "regular",
    status: "active",
    total_purchases: 28,
    total_repairs: 1,
    registration_date: "2021-06-20",
    last_visit: "2024-01-10",
    last_activity: "2024-01-10",
    credit_score: 7.5,
    segment: "medium_value",
    satisfaction_score: 4.5,
    lifetime_value: 8500,
    avg_order_value: 304,
    purchase_frequency: "medium",
    preferred_contact: "phone",
    birthday: "1990-08-22",
    loyalty_points: 850,
    credit_limit: 10000,
    current_balance: 0,
    pending_amount: 0,
    notes: "Compra regularmente productos de alta gama",
    tags: ["regular"],
    company: "Distribuidora ABC",
    referral_source: "Web",
    discount_percentage: 5,
    payment_terms: "15 días",
    assigned_salesperson: "Ana López",
    last_purchase_amount: 300,
    total_spent_this_year: 4500
  }
]

let nextId = 3

// Simulate network delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export class MockCustomerAPI {
  static async getCustomers(page = 1, limit = 50): Promise<CustomersListResponse> {
    await delay(500) // Simulate network delay
    
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedCustomers = mockCustomers.slice(startIndex, endIndex)
    
    return {
      success: true,
      data: paginatedCustomers,
      pagination: {
        page,
        limit,
        total: mockCustomers.length,
        totalPages: Math.ceil(mockCustomers.length / limit)
      }
    }
  }

  static async getCustomer(id: string): Promise<CustomerResponse> {
    await delay(300)
    
    const customer = mockCustomers.find(c => c.id === id)
    
    if (!customer) {
      return {
        success: false,
        error: 'Cliente no encontrado'
      }
    }
    
    return {
      success: true,
      data: customer
    }
  }

  static async createCustomer(customerData: CreateCustomerRequest): Promise<CustomerResponse> {
    await delay(800) // Simulate longer delay for creation
    
    // Validate required fields
    if (!customerData.name || !customerData.email || !customerData.phone) {
      return {
        success: false,
        error: 'Faltan campos requeridos: nombre, email y teléfono'
      }
    }
    
    // Check if email already exists
    const existingCustomer = mockCustomers.find(c => c.email === customerData.email)
    if (existingCustomer) {
      return {
        success: false,
        error: 'Ya existe un cliente con este email'
      }
    }
    
    const newCustomer: Customer = {
      id: String(nextId++),
      customerCode: `CLI-${String(nextId).padStart(3, '0')}`,
      name: customerData.name,
      email: customerData.email,
      phone: customerData.phone,
      address: customerData.address || '',
      city: 'Montevideo',
      customer_type: (customerData.segment as "premium" | "empresa" | "regular") || 'regular',
      status: 'active',
      total_purchases: 0,
      total_repairs: 0,
      registration_date: new Date().toISOString(),
      last_visit: new Date().toISOString(),
      last_activity: new Date().toISOString(),
      credit_score: 5.0,
      segment: customerData.segment || 'new',
      satisfaction_score: 5.0,
      lifetime_value: 0,
      avg_order_value: 0,
      purchase_frequency: "none",
      preferred_contact: "email",
      birthday: '',
      loyalty_points: 0,
      credit_limit: 0,
      current_balance: 0,
      pending_amount: 0,
      notes: customerData.notes || '',
      tags: [],
      company: (customerData as CreateCustomerRequest & { company?: string }).company || '',
      referral_source: 'Directo',
      discount_percentage: 0,
      payment_terms: 'Contado',
      assigned_salesperson: 'Sin asignar',
      last_purchase_amount: 0,
      total_spent_this_year: 0
    }
    
    mockCustomers.push(newCustomer)
    
    return {
      success: true,
      data: newCustomer
    }
  }

  static async updateCustomer(id: string, customerData: Partial<CreateCustomerRequest>): Promise<CustomerResponse> {
    await delay(600)
    
    const customerIndex = mockCustomers.findIndex(c => c.id === id)
    
    if (customerIndex === -1) {
      return {
        success: false,
        error: 'Cliente no encontrado'
      }
    }
    
    // Check if email already exists (excluding current customer)
    if (customerData.email) {
      const existingCustomer = mockCustomers.find(c => c.email === customerData.email && c.id !== id)
      if (existingCustomer) {
        return {
          success: false,
          error: 'Ya existe un cliente con este email'
        }
      }
    }
    
    const updatedCustomer: Customer = {
      ...mockCustomers[customerIndex],
      ...customerData
    }
    
    mockCustomers[customerIndex] = updatedCustomer
    
    return {
      success: true,
      data: updatedCustomer
    }
  }

  static async deleteCustomer(id: string): Promise<{ success: boolean; error?: string }> {
    await delay(400)
    
    const customerIndex = mockCustomers.findIndex(c => c.id === id)
    
    if (customerIndex === -1) {
      return {
        success: false,
        error: 'Cliente no encontrado'
      }
    }
    
    mockCustomers.splice(customerIndex, 1)
    
    return {
      success: true
    }
  }

  static async searchCustomers(query: string): Promise<CustomersListResponse> {
    await delay(400)
    
    const lowercaseQuery = query.toLowerCase()
    const filteredCustomers = mockCustomers.filter(customer =>
      customer.name.toLowerCase().includes(lowercaseQuery) ||
      customer.email.toLowerCase().includes(lowercaseQuery) ||
      customer.phone.includes(query)
    )
    
    return {
      success: true,
      data: filteredCustomers
    }
  }
}

export default MockCustomerAPI