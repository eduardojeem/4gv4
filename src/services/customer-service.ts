import { Customer } from '@/hooks/use-customer-state'
import { createClient } from '@/lib/supabase/client'
import { 
  createCustomerSchema, 
  updateCustomerSchema,
  validateCustomerData,
  getValidationErrors
} from '@/lib/validations/customer'

export interface CreateCustomerRequest {
  name: string
  email: string
  phone: string
  address?: string
  segment?: 'vip' | 'premium' | 'regular' | 'new'
  notes?: string
  // Add other fields as needed for creation
  customer_type?: "premium" | "empresa" | "regular"
  city?: string
  ruc?: string
  credit_limit?: number
  payment_terms?: string
  tags?: string[]
}

export interface UpdateCustomerRequest extends Partial<CreateCustomerRequest> {
  id: string // Changed to string for UUID
}

export interface CustomerResponse {
  success: boolean
  data?: Customer
  error?: string
}

export interface CustomersListResponse {
  success: boolean
  data?: Customer[]
  error?: string
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

class CustomerService {
  private supabase = createClient()

  private mapSupabaseToCustomer(data: Record<string, unknown>): Customer {
    return {
      ...data,
      customerCode: (data.customer_code as string) || `CLI-${(data.id as string)?.slice(0, 6)}`,
      customer_type: (data.customer_type as 'premium' | 'regular' | 'empresa') || 'regular',
      status: (data.status as 'active' | 'inactive' | 'suspended') || 'active',
      total_purchases: Number(data.total_purchases) || 0,
      total_repairs: Number(data.total_repairs) || 0,
      registration_date: data.created_at as string,
      last_visit: (data.last_visit as string) || (data.created_at as string),
      last_activity: (data.updated_at as string) || (data.created_at as string),
      credit_score: Number(data.credit_score) || 0,
      segment: (data.segment as string) || 'regular',
      satisfaction_score: Number(data.satisfaction_score) || 0,
      lifetime_value: Number(data.lifetime_value) || 0,
      avg_order_value: Number(data.avg_order_value) || 0,
      purchase_frequency: (data.purchase_frequency as string) || 'low',
      preferred_contact: (data.preferred_contact as string) || 'email',
      loyalty_points: Number(data.loyalty_points) || 0,
      credit_limit: Number(data.credit_limit) || 0,
      current_balance: Number(data.current_balance) || 0,
      pending_amount: Number(data.pending_amount) || 0,
      tags: (data.tags as string[]) || [],
      discount_percentage: Number(data.discount_percentage) || 0,
      payment_terms: (data.payment_terms as string) || 'Contado',
      assigned_salesperson: (data.assigned_salesperson as string) || 'Sin asignar',
      last_purchase_amount: Number(data.last_purchase_amount) || 0,
      total_spent_this_year: Number(data.total_spent_this_year) || 0
    } as Customer
  }

  async getCustomers(page = 1, limit = 50): Promise<CustomersListResponse> {
    try {
      const from = (page - 1) * limit
      const to = from + limit - 1

      const result = await this.supabase
        .from('customers')
        .select('*', { count: 'exact' })
        .range(from, to)
        .order('created_at', { ascending: false })

      if (result.error) throw result.error

      const customers = (result.data || []).map((item: Record<string, unknown>) => this.mapSupabaseToCustomer(item))
      const total = result.count || 0

      return {
        success: true,
        data: customers,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    } catch (error: unknown) {
      console.error('Error fetching customers:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      return {
        success: false,
        error: errorMessage
      }
    }
  }

  async getCustomer(id: string | number): Promise<CustomerResponse> {
    try {
      // Handle both string (UUID) and number IDs if legacy exists, but prefer UUID
      const queryId = String(id)

      const { data, error } = await this.supabase
        .from('customers')
        .select('*')
        .eq('id', queryId)
        .single()

      if (error) throw error

      return {
        success: true,
        data: this.mapSupabaseToCustomer(data)
      }
    } catch (error: unknown) {
      console.error('Error fetching customer:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      return {
        success: false,
        error: errorMessage || 'Error al obtener cliente'
      }
    }
  }

  async createCustomer(customerData: CreateCustomerRequest): Promise<CustomerResponse> {
    try {
      // Validate input data
      const validation = validateCustomerData(createCustomerSchema, customerData)
      
      if (!validation.success) {
        const errors = getValidationErrors(validation.errors)
        const errorMessage = Object.values(errors).join(', ')
        return {
          success: false,
          error: `Validación fallida: ${errorMessage}`
        }
      }

      const validatedData = validation.data

      // Map frontend fields to DB fields if necessary
      const dbData = {
        name: validatedData.name,
        email: validatedData.email,
        phone: validatedData.phone,
        address: validatedData.address,
        segment: validatedData.segment,
        notes: validatedData.notes,
        customer_type: validatedData.customer_type,
        city: validatedData.city,
        ruc: validatedData.ruc,
        credit_limit: validatedData.credit_limit,
        discount_percentage: validatedData.discount_percentage,
        payment_terms: validatedData.payment_terms,
        preferred_contact: validatedData.preferred_contact,
        tags: validatedData.tags,
        whatsapp: validatedData.whatsapp,
        social_media: validatedData.social_media,
        company: validatedData.company,
        position: validatedData.position,
        referral_source: validatedData.referral_source,
        assigned_salesperson: validatedData.assigned_salesperson,
        birthday: validatedData.birthday,
        // Default values for new customers
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const { data, error } = await this.supabase
        .from('customers')
        .insert(dbData)
        .select()
        .single()

      if (error) throw error

      return {
        success: true,
        data: this.mapSupabaseToCustomer(data)
      }
    } catch (error: unknown) {
      console.error('Error creating customer:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      return {
        success: false,
        error: errorMessage || 'Error al crear cliente'
      }
    }
  }

  async updateCustomer(id: string | number, customerData: Partial<CreateCustomerRequest>): Promise<CustomerResponse> {
    try {
      const queryId = String(id)

      // Validate input data
      const validation = validateCustomerData(updateCustomerSchema, customerData)
      
      if (!validation.success) {
        const errors = getValidationErrors(validation.errors)
        const errorMessage = Object.values(errors).join(', ')
        return {
          success: false,
          error: `Validación fallida: ${errorMessage}`
        }
      }

      const validatedData = validation.data

      const dbData = {
        ...validatedData,
        updated_at: new Date().toISOString()
      }

      const { data, error } = await this.supabase
        .from('customers')
        .update(dbData)
        .eq('id', queryId)
        .select()
        .single()

      if (error) throw error

      return {
        success: true,
        data: this.mapSupabaseToCustomer(data)
      }
    } catch (error: unknown) {
      console.error('Error updating customer:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      return {
        success: false,
        error: errorMessage || 'Error al actualizar cliente'
      }
    }
  }

  async deleteCustomer(id: string | number): Promise<{ success: boolean; error?: string }> {
    try {
      const queryId = String(id)

      const { error } = await this.supabase
        .from('customers')
        .delete()
        .eq('id', queryId)

      if (error) throw error

      return { success: true }
    } catch (error: unknown) {
      console.error('Error deleting customer:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      return {
        success: false,
        error: errorMessage || 'Error al eliminar cliente'
      }
    }
  }

  async searchCustomers(query: string, limit: number = 50): Promise<CustomersListResponse> {
    try {
      if (!query || query.trim().length === 0) {
        // If no query, return first page of customers
        return this.getCustomers(1, limit)
      }

      const { data, error, count } = await this.supabase
        .from('customers')
        .select('*', { count: 'exact' })
        .or(`name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%,customer_code.ilike.%${query}%`)
        .limit(limit)
        .order('created_at', { ascending: false })

      if (error) throw error

      return {
        success: true,
        data: (data || []).map(this.mapSupabaseToCustomer),
        pagination: {
          page: 1,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      }
    } catch (error: unknown) {
      console.error('Error searching customers:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      return {
        success: false,
        error: errorMessage || 'Error al buscar clientes'
      }
    }
  }

  async getCustomersByFilters(filters: {
    status?: string
    customer_type?: string
    segment?: string
    city?: string
    page?: number
    limit?: number
  }): Promise<CustomersListResponse> {
    try {
      const page = filters.page || 1
      const limit = filters.limit || 50
      const from = (page - 1) * limit
      const to = from + limit - 1

      let query = this.supabase
        .from('customers')
        .select('*', { count: 'exact' })

      // Apply filters
      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status)
      }
      if (filters.customer_type && filters.customer_type !== 'all') {
        query = query.eq('customer_type', filters.customer_type)
      }
      if (filters.segment && filters.segment !== 'all') {
        query = query.eq('segment', filters.segment)
      }
      if (filters.city && filters.city !== 'all') {
        query = query.eq('city', filters.city)
      }

      const { data, error, count } = await query
        .range(from, to)
        .order('created_at', { ascending: false })

      if (error) throw error

      const customers = (data || []).map(this.mapSupabaseToCustomer)
      const total = count || 0

      return {
        success: true,
        data: customers,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    } catch (error: unknown) {
      console.error('Error fetching customers by filters:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      return {
        success: false,
        error: errorMessage || 'Error al obtener clientes filtrados'
      }
    }
  }
 
   // Obtener el crédito (id) del cliente si existe
   private async getCustomerCreditId(customerId: string): Promise<{ success: boolean; creditId?: string; error?: string }> {
     try {
       const { data, error } = await this.supabase
         .from('customer_credits')
         .select('id')
         .eq('customer_id', customerId)
         .single()
 
       if (error) {
         // Si no existe registro de crédito, devolver success con creditId undefined
         if (error.code === 'PGRST116') {
           return { success: true }
         }
         throw error
       }
 
       return { success: true, creditId: data?.id }
     } catch (error: unknown) {
       const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
       console.warn('Error obteniendo crédito del cliente:', errorMessage)
       return { success: false, error: errorMessage }
     }
   }
 
   // Resumen de crédito del cliente desde la vista credit_summary
   async getCustomerCreditSummary(customerId: string): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> {
     try {
       const credit = await this.getCustomerCreditId(customerId)
       if (!credit.success) {
         return { success: false, error: credit.error || 'No se pudo obtener el crédito del cliente' }
       }
       if (!credit.creditId) {
         return { success: true, data: undefined }
       }
 
       const { data, error } = await this.supabase
         .from('credit_summary')
         .select('*')
         .eq('credit_id', credit.creditId)
         .single()
 
       if (error) throw error
 
       return { success: true, data }
     } catch (error: unknown) {
       console.error('Error fetching credit summary:', error)
       const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
       return { success: false, error: errorMessage }
     }
   }
 
   // Progreso de cuotas del crédito del cliente desde la vista credit_installments_progress
   async getCustomerInstallmentsProgress(customerId: string): Promise<{ success: boolean; data?: Record<string, unknown>[]; error?: string }> {
     try {
       const credit = await this.getCustomerCreditId(customerId)
       if (!credit.success) {
         return { success: false, error: credit.error || 'No se pudo obtener el crédito del cliente' }
       }
       if (!credit.creditId) {
         return { success: true, data: [] }
       }
 
       const { data, error } = await this.supabase
         .from('credit_installments_progress')
         .select('*')
         .eq('credit_id', credit.creditId)
         .order('installment_number', { ascending: true })
 
       if (error) throw error
 
       return { success: true, data: data || [] }
     } catch (error: unknown) {
       console.error('Error fetching installments progress:', error)
       const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
       return { success: false, error: errorMessage }
     }
   }
  async getCustomerSales(customerId: string | number): Promise<{ success: boolean; data?: Record<string, unknown>[]; error?: string }> {
    try {
      const queryId = String(customerId)

      // Check if sales table exists, if not return empty array
      const { data, error } = await this.supabase
        .from('sales')
        .select(`
          *,
          total:total_amount,
          tax:tax_amount,
          discount:discount_amount,
          sale_items (
            quantity,
            price:unit_price,
            product:products (
              name
            )
          )
        `)
        .eq('customer_id', queryId)
        .order('created_at', { ascending: false })
        .limit(100) // Limit to 100 most recent sales

      // If table doesn't exist or other error, return empty array instead of failing
      if (error) {
        // Log error but don't fail - sales table might not exist yet
        console.warn('Sales table not available or error fetching sales:', error.message)
        return {
          success: true,
          data: []
        }
      }

      // Map response to match expected structure
      const mappedData = (data || []).map((sale: Record<string, unknown>) => ({
        id: sale.id,
        date: sale.created_at,
        invoiceNumber: (sale.code as string) || (sale.sale_number as string) || `SALE-${(sale.id as string).slice(0,8)}`,
        paymentMethod: sale.payment_method,
        status: sale.status,
        total: sale.total || sale.total_amount,
        items: ((sale.sale_items as Record<string, unknown>[]) || []).map((item: Record<string, unknown>) => ({
          name: (item.product as Record<string, unknown>)?.name || 'Producto desconocido',
          quantity: item.quantity,
          price: item.price || item.unit_price
        }))
      }))

      return {
        success: true,
        data: mappedData
      }
    } catch (error: unknown) {
      // Catch any unexpected errors and return empty array
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      console.warn('Error fetching customer sales:', errorMessage)
      return {
        success: true,
        data: []
      }
    }
  }

  async importCustomersFromCSV(file: File): Promise<{ success: boolean; imported?: number; errors?: string[]; error?: string }> {
    try {
      const text = await file.text()
      const lines = text.split('\n').filter(line => line.trim())
      
      if (lines.length < 2) {
        return {
          success: false,
          error: 'El archivo debe contener al menos una fila de encabezados y una fila de datos'
        }
      }

      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
      const dataLines = lines.slice(1)
      
      // Validate required headers
      const requiredHeaders = ['name', 'email']
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h))
      
      if (missingHeaders.length > 0) {
        return {
          success: false,
          error: `Faltan columnas requeridas: ${missingHeaders.join(', ')}`
        }
      }

      const errors: string[] = []
      let imported = 0

      for (let i = 0; i < dataLines.length; i++) {
        const line = dataLines[i]
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''))
        
        if (values.length !== headers.length) {
          errors.push(`Fila ${i + 2}: Número incorrecto de columnas`)
          continue
        }

        // Create customer object from CSV data
        const customerData: Record<string, unknown> = {}
        headers.forEach((header, index) => {
          customerData[header] = values[index] || null
        })

        // Validate required fields
        if (!customerData.name || !customerData.email) {
          errors.push(`Fila ${i + 2}: Faltan campos requeridos (name, email)`)
          continue
        }

        // Check if email already exists
        const existingCustomer = await this.supabase
          .from('customers')
          .select('id')
          .eq('email', customerData.email)
          .single()

        if (existingCustomer.data) {
          errors.push(`Fila ${i + 2}: Email ${customerData.email} ya existe`)
          continue
        }

        // Create customer
        const result = await this.createCustomer({
          name: (customerData.name as string) || '',
          email: (customerData.email as string) || '',
          phone: (customerData.phone as string) || '',
          address: (customerData.address as string) || '',
          city: (customerData.city as string) || '',
          customer_type: (customerData.customer_type as 'premium' | 'regular' | 'empresa') || 'regular',
          segment: (customerData.segment as 'vip' | 'premium' | 'regular' | 'new') || 'regular',
          notes: (customerData.notes as string) || ''
        })

        if (result.success) {
          imported++
        } else {
          errors.push(`Fila ${i + 2}: ${result.error}`)
        }
      }

      return {
        success: imported > 0,
        imported,
        errors
      }
    } catch (error: any) {
      console.error('Error importing CSV:', error)
      return {
        success: false,
        error: error.message || 'Error al procesar el archivo CSV'
      }
    }
  }
}

export const customerService = new CustomerService()
export default customerService
