import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import type { Repair } from '@/types/repairs'
import type { Customer } from '@/types/customer-types'
import { mockRepairs } from '@/data/mock-repairs'

type MockUser = {
  id: string
  email: string
  user_metadata: Record<string, unknown>
}

let currentUser: MockUser | null = {
  id: 'demo-user-id',
  email: 'demo@4gcelulares.com',
  user_metadata: { full_name: 'Usuario Demo', role: 'admin' }
}

// Mock data for customers
const mockCustomersData = [
  {
    id: '1',
    name: 'Juan Pérez',
    email: 'juan.perez@email.com',
    phone: '+595-21-123456',
    address: 'Av. España 123',
    city: 'Asunción',
    customer_code: 'CLI-001',
    customer_type: 'regular',
    status: 'active',
    total_purchases: 5,
    total_repairs: 2,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
    last_visit: '2024-01-15T10:00:00Z',
    credit_score: 8,
    segment: 'premium',
    satisfaction_score: 9,
    lifetime_value: 2500000,
    avg_order_value: 500000,
    purchase_frequency: 'high',
    preferred_contact: 'email',
    loyalty_points: 1250,
    credit_limit: 1000000,
    current_balance: 0,
    pending_amount: 0,
    tags: ['vip', 'frecuente'],
    discount_percentage: 5,
    payment_terms: 'Contado',
    assigned_salesperson: 'María González',
    last_purchase_amount: 450000,
    total_spent_this_year: 1200000,
    ruc: '12345678-9',
    notes: 'Cliente VIP, excelente historial de pagos'
  },
  {
    id: '2',
    name: 'María González',
    email: 'maria.gonzalez@email.com',
    phone: '+595-21-654321',
    address: 'Calle Palma 456',
    city: 'Asunción',
    customer_code: 'CLI-002',
    customer_type: 'premium',
    status: 'active',
    total_purchases: 8,
    total_repairs: 1,
    created_at: '2024-01-10T14:30:00Z',
    updated_at: '2024-01-10T14:30:00Z',
    last_visit: '2024-01-10T14:30:00Z',
    credit_score: 9,
    segment: 'vip',
    satisfaction_score: 10,
    lifetime_value: 4200000,
    avg_order_value: 525000,
    purchase_frequency: 'high',
    preferred_contact: 'whatsapp',
    loyalty_points: 2100,
    credit_limit: 2000000,
    current_balance: 0,
    pending_amount: 0,
    tags: ['vip', 'empresa'],
    discount_percentage: 10,
    payment_terms: '30 días',
    assigned_salesperson: 'Carlos Rodríguez',
    last_purchase_amount: 680000,
    total_spent_this_year: 1800000,
    company: 'Tech Solutions SA',
    position: 'Gerente IT',
    notes: 'Cliente empresarial, compras regulares de equipos'
  },
  {
    id: '3',
    name: 'Carlos Rodríguez',
    email: 'carlos.rodriguez@email.com',
    phone: '+595-21-789012',
    address: 'Av. Mariscal López 789',
    city: 'San Lorenzo',
    customer_code: 'CLI-003',
    customer_type: 'regular',
    status: 'active',
    total_purchases: 3,
    total_repairs: 0,
    created_at: '2024-01-20T09:15:00Z',
    updated_at: '2024-01-20T09:15:00Z',
    last_visit: '2024-01-20T09:15:00Z',
    credit_score: 7,
    segment: 'regular',
    satisfaction_score: 8,
    lifetime_value: 850000,
    avg_order_value: 283333,
    purchase_frequency: 'medium',
    preferred_contact: 'phone',
    loyalty_points: 425,
    credit_limit: 500000,
    current_balance: 0,
    pending_amount: 0,
    tags: ['nuevo'],
    discount_percentage: 0,
    payment_terms: 'Contado',
    assigned_salesperson: 'Ana Martínez',
    last_purchase_amount: 320000,
    total_spent_this_year: 850000,
    notes: 'Cliente nuevo, potencial para crecimiento'
  },
  {
    id: '4',
    name: 'Ana Martínez',
    email: 'ana.martinez@email.com',
    phone: '+595-21-345678',
    address: 'Calle Independencia 321',
    city: 'Luque',
    customer_code: 'CLI-004',
    customer_type: 'empresa',
    status: 'active',
    total_purchases: 12,
    total_repairs: 3,
    created_at: '2023-12-05T16:45:00Z',
    updated_at: '2023-12-05T16:45:00Z',
    last_visit: '2023-12-05T16:45:00Z',
    credit_score: 8,
    segment: 'premium',
    satisfaction_score: 9,
    lifetime_value: 6800000,
    avg_order_value: 566667,
    purchase_frequency: 'high',
    preferred_contact: 'email',
    loyalty_points: 3400,
    credit_limit: 3000000,
    current_balance: 150000,
    pending_amount: 150000,
    tags: ['empresa', 'credito'],
    discount_percentage: 8,
    payment_terms: '60 días',
    assigned_salesperson: 'Juan Pérez',
    last_purchase_amount: 750000,
    total_spent_this_year: 2400000,
    company: 'Distribuidora Central',
    ruc: '98765432-1',
    notes: 'Cliente empresarial con línea de crédito'
  },
  {
    id: '5',
    name: 'Luis Fernández',
    email: 'luis.fernandez@email.com',
    phone: '+595-21-567890',
    address: 'Av. Eusebio Ayala 654',
    city: 'Asunción',
    customer_code: 'CLI-005',
    customer_type: 'regular',
    status: 'inactive',
    total_purchases: 1,
    total_repairs: 0,
    created_at: '2023-11-15T11:20:00Z',
    updated_at: '2023-11-15T11:20:00Z',
    last_visit: '2023-11-15T11:20:00Z',
    credit_score: 6,
    segment: 'regular',
    satisfaction_score: 7,
    lifetime_value: 180000,
    avg_order_value: 180000,
    purchase_frequency: 'low',
    preferred_contact: 'email',
    loyalty_points: 90,
    credit_limit: 0,
    current_balance: 0,
    pending_amount: 0,
    tags: ['inactivo'],
    discount_percentage: 0,
    payment_terms: 'Contado',
    assigned_salesperson: 'Sin asignar',
    last_purchase_amount: 180000,
    total_spent_this_year: 0,
    notes: 'Cliente inactivo, última compra hace varios meses'
  }
]

export const createMockSupabaseClient = (): SupabaseClient => {
  return {
    auth: {
      getUser: async () => ({
        data: { user: currentUser || null },
        error: null
      }),
      getSession: async () => ({
        data: { session: currentUser ? { user: currentUser } : null },
        error: null
      }),
      signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
        if (email === 'admin@demo.com' && password === 'demo123') {
          currentUser = {
            id: 'demo-user-id',
            email: 'admin@demo.com',
            user_metadata: { full_name: 'Admin Demo', role: 'admin' }
          }
          return {
            data: {
              user: currentUser
            },
            error: null
          };
        }
        return {
          data: { user: null },
          error: { message: 'Credenciales inválidas' }
        };
      },
      signUp: async ({ email, password, options }: { email: string; password: string; options?: { data?: Record<string, unknown> } }) => {
        currentUser = {
          id: 'new-demo-user-id',
          email,
          user_metadata: options?.data || {}
        }
        return {
          data: {
            user: currentUser
          },
          error: null
        };
      },
      signOut: async () => {
        currentUser = null
        return { error: null }
      },
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => { } } } })
    },
    storage: {
      from: (bucket: string) => ({
        getPublicUrl: (path: string) => ({ data: { publicUrl: `/${bucket}/${path}` } }),
        upload: async (path: string, _file: File | Blob) => ({ data: { path }, error: null })
      })
    },
    from: (table: string) => {
      const toDbRepair = (r: Repair) => ({
        id: r.id,
        customer: {
          id: 'CLI-DEMO',
          name: r.customer?.name || '',
          phone: r.customer?.phone || '',
          email: r.customer?.email || ''
        },
        device_brand: r.brand,
        device_model: r.model,
        device_type: r.deviceType,
        problem_description: r.issue,
        diagnosis: r.description || null,
        solution: null,
        status: r.status,
        priority: r.priority,
        urgency: r.urgency,
        estimated_cost: r.estimatedCost,
        final_cost: r.finalCost,
        labor_cost: r.laborCost,
        technician: r.technician
          ? { id: r.technician.id, full_name: r.technician.name }
          : null,
        location: r.location,
        warranty_months: r.warranty
          ? parseInt(String(r.warranty).match(/\d+/)?.[0] || '0')
          : null,
        created_at: r.createdAt,
        estimated_completion: r.estimatedCompletion,
        completed_at: r.completedAt,
        updated_at: r.lastUpdate,
        progress: r.progress,
        customer_rating: r.customerRating,
        notify_customer: r.notifications?.customer ?? false,
        notify_technician: r.notifications?.technician ?? false,
        notify_manager: r.notifications?.manager ?? false
      })
      const toDbCustomer = (c: Record<string, unknown>) => {
        const parts = String(c.name || '').trim().split(/\s+/)
        const first_name = parts[0] || ''
        const last_name = parts.slice(1).join(' ') || ''
        return {
          id: c.id as string,
          first_name,
          last_name,
          phone: c.phone as string || '',
          email: c.email as string || '',
          customer_type: c.customer_type || 'regular',
          status: c.status || 'active',
          created_at: c.created_at || new Date().toISOString()
        }
      }
      const mockDbRepairs = mockRepairs.map(toDbRepair)
      const mockDbCustomers = mockCustomersData.map(toDbCustomer)
      const dataForTable: unknown[] =
        table === 'repairs'
          ? mockDbRepairs
          : table === 'customers'
          ? mockDbCustomers
          : []
      const createQueryBuilder = (data: unknown[] = [], totalCount?: number) => ({
        select: (columns?: string, options?: { count?: 'exact' | null; head?: boolean }) => createQueryBuilder(data, options?.count ? (typeof totalCount === 'number' ? totalCount : data.length) : undefined),
        eq: (column: string, value: unknown) => createQueryBuilder(data),
        gte: (column: string, value: unknown) => createQueryBuilder(data),
        lte: (column: string, value: unknown) => createQueryBuilder(data),
        in: (column: string, values: unknown[]) => createQueryBuilder(data),
        order: (column: string, options?: { ascending?: boolean }) => createQueryBuilder(data),
        or: (expr: string) => createQueryBuilder(data),
        limit: (count: number) => createQueryBuilder(data),
        range: (from: number, to: number) => createQueryBuilder(data.slice(from, to + 1), typeof totalCount === 'number' ? totalCount : data.length),
        single: () => Promise.resolve({
          data: data[0] || null,
          error: null
        }),
        maybeSingle: () => Promise.resolve({
          data: data[0] || null,
          error: null
        }),
        then: (resolve: (result: { data: unknown[]; error: null; count?: number }) => unknown) => {
          return resolve({
            data,
            error: null,
            count: typeof totalCount === 'number' ? totalCount : undefined
          });
        }
      });

      return {
        select: (columns?: string, options?: { count?: 'exact' | null; head?: boolean }) => createQueryBuilder(dataForTable, options?.count ? dataForTable.length : undefined),
        eq: (column: string, value: unknown) => createQueryBuilder(dataForTable),
        gte: (column: string, value: unknown) => createQueryBuilder(dataForTable),
        lte: (column: string, value: unknown) => createQueryBuilder(dataForTable),
        in: (column: string, values: unknown[]) => createQueryBuilder(dataForTable),
        order: (column: string, options?: { ascending?: boolean }) => createQueryBuilder(dataForTable),
        or: (expr: string) => createQueryBuilder(dataForTable),
        limit: (count: number) => createQueryBuilder(dataForTable),
        range: (from: number, to: number) => createQueryBuilder(dataForTable.slice(from, to + 1), dataForTable.length),
        insert: (data: unknown) => ({
          select: (columns?: string) => ({
            single: () => Promise.resolve({
              data: Array.isArray(data) ? (data as unknown[])[0] : data,
              error: null
            }),
            maybeSingle: () => Promise.resolve({
              data: Array.isArray(data) ? (data as unknown[])[0] : data,
              error: null
            }),
            then: (resolve: (result: { data: unknown[]; error: null; count: number }) => unknown) => {
              const arr = Array.isArray(data) ? (data as unknown[]) : [data]
              return resolve({
                data: arr,
                error: null,
                count: arr.length
              });
            }
          }),
          then: (resolve: (result: { data: unknown[]; error: null; count: number }) => unknown) => {
            const arr = Array.isArray(data) ? (data as unknown[]) : [data]
            return resolve({
              data: arr,
              error: null,
              count: arr.length
            });
          }
        }),
        update: (data: unknown) => ({
          eq: (column: string, value: unknown) => ({
            select: (columns?: string) => ({
              single: () => Promise.resolve({
                data,
                error: null
              }),
              maybeSingle: () => Promise.resolve({
                data,
                error: null
              }),
              then: (resolve: (result: { data: unknown[]; error: null; count: number }) => unknown) => {
                return resolve({
                  data: [data],
                  error: null,
                  count: 1
                });
              }
            })
          }),
          in: (column: string, values: unknown[]) => Promise.resolve({
            data: null,
            error: null,
            count: values?.length || 0
          })
        }),
        delete: () => ({
          eq: (column: string, value: unknown) => Promise.resolve({
            data: null,
            error: null,
            count: 0
          }),
          in: (column: string, values: unknown[]) => Promise.resolve({
            data: null,
            error: null,
            count: values?.length || 0
          })
        })
      };
    },
    rpc: async (fn: string, params?: Record<string, unknown>) => {
      if (fn === 'get_supplier_stats') {
        return {
          data: null,
          error: { message: 'Function not found in mock' }
        }
      }
      return { data: null, error: { message: `RPC ${fn} not implemented in mock` } }
    },
    channel: (name: string): RealtimeChannel => {
      const mockChannel = {
        topic: name,
        params: {},
        socket: {},
        bindings: [],
        timeout: 10000,
        joinedOnce: false,
        joinRef: null,
        ref: 0,
        state: 'closed' as unknown as never,
        on: (..._args: unknown[]) => {
          return mockChannel;
        },
        subscribe: () => Promise.resolve({ status: 'SUBSCRIBED' }),
        unsubscribe: () => Promise.resolve({ status: 'CLOSED' }),
        send: () => { },
        leave: () => Promise.resolve({ status: 'OK' }),
        onError: () => mockChannel,
        onClose: () => mockChannel,
        push: () => ({}),
        trigger: () => { },
        rejoinUntilConnected: () => { },
        join: () => Promise.resolve({ status: 'OK' }),
        isJoined: () => false,
        isClosed: () => true,
        isErrored: () => false,
        isJoining: () => false,
        isLeaving: () => false
      } as unknown as RealtimeChannel;
      return mockChannel;
    }
  } as unknown as SupabaseClient;
};

export const mockSupabase = createMockSupabaseClient();
