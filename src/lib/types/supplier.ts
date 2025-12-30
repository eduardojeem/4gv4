export interface Supplier {
  id: string
  name: string
  contact_person: string
  email: string
  phone: string
  address: string
  city: string
  country: string
  postal_code?: string
  tax_id?: string
  website?: string

  // Business Information
  business_type: 'manufacturer' | 'distributor' | 'wholesaler' | 'retailer' | 'service_provider'
  industry: string
  company_size: 'small' | 'medium' | 'large' | 'enterprise'

  // Status and Performance
  status: 'active' | 'inactive' | 'pending' | 'suspended'
  rating: number // 1-5 stars
  reliability_score: number // 0-100
  quality_score: number // 0-100
  delivery_score: number // 0-100

  // Financial Information
  payment_terms: string
  credit_limit?: number
  currency: string
  tax_rate?: number

  // Operational Details
  lead_time_days: number
  minimum_order_amount: number
  shipping_cost?: number
  return_policy?: string
  warranty_terms?: string

  // Product Information
  products_count: number
  categories: string[]
  specialties: string[]

  // Order History
  total_orders: number
  total_amount: number
  avg_order_value: number
  last_order_date?: string

  // Performance Metrics
  on_time_delivery_rate: number // percentage
  defect_rate: number // percentage
  response_time_hours: number

  // Relationship Management
  account_manager?: string
  preferred_contact_method: 'email' | 'phone' | 'whatsapp' | 'in_person'
  communication_language: string
  time_zone: string

  // Certifications and Compliance
  certifications: string[]
  compliance_status: 'compliant' | 'non_compliant' | 'pending_review'
  last_audit_date?: string

  // Notes and Documentation
  notes?: string
  internal_notes?: string
  tags: string[]

  // System Information
  created_at: string
  updated_at: string
  created_by: string
  last_modified_by: string

  // Integration and Sync
  external_id?: string
  sync_status: 'synced' | 'pending' | 'error' | 'never'
  last_sync_date?: string

  // Contract Information
  contract_start_date?: string
  contract_end_date?: string
  contract_type?: 'fixed' | 'renewable' | 'ongoing'

  // Risk Assessment
  risk_level: 'low' | 'medium' | 'high'
  risk_factors: string[]

  // Performance Trends
  performance_trend: 'improving' | 'stable' | 'declining'
  last_performance_review?: string
}

export interface SupplierFormData {
  name: string
  contact_person: string
  email: string
  phone: string
  address: string
  city: string
  country: string
  postal_code: string
  tax_id: string
  website: string
  business_type: Supplier['business_type']
  industry: string
  company_size: Supplier['company_size']
  payment_terms: string
  credit_limit: number
  currency: string
  lead_time_days: number
  minimum_order_amount: number
  shipping_cost: number
  categories: string[]
  specialties: string[]
  account_manager: string
  preferred_contact_method: Supplier['preferred_contact_method']
  communication_language: string
  time_zone: string
  certifications: string[]
  notes: string
  internal_notes: string
  tags: string[]
  contract_start_date: string
  contract_end_date: string
  contract_type: Supplier['contract_type']
}

export interface SupplierFilters {
  search: string
  status: Supplier['status'] | 'all'
  business_type: Supplier['business_type'] | 'all'
  rating: number | 'all'
  country: string | 'all'
  industry: string | 'all'
  risk_level: Supplier['risk_level'] | 'all'
  performance_trend: Supplier['performance_trend'] | 'all'
  date_range: 'all' | 'today' | 'week' | 'month' | 'quarter' | 'year'
  sort_by: 'name' | 'rating' | 'total_orders' | 'last_order' | 'created_at'
  sort_order: 'asc' | 'desc'
}

export interface DetailedSupplierStats {
  total_suppliers: number
  active_suppliers: number
  inactive_suppliers: number
  pending_suppliers: number
  suspended_suppliers: number
  total_products: number
  total_orders: number
  total_amount: number
  avg_rating: number
  avg_delivery_time: number
  on_time_delivery_rate: number
  top_performers: Supplier[]
  risk_distribution: {
    low: number
    medium: number
    high: number
  }
  performance_trends: {
    improving: number
    stable: number
    declining: number
  }
}

export interface SupplierOrder {
  id: string
  supplier_id: string
  order_number: string
  order_date: string
  expected_delivery: string
  actual_delivery?: string
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
  items: SupplierOrderItem[]
  subtotal: number
  tax: number
  shipping: number
  total: number
  currency: string
  payment_status: 'pending' | 'paid' | 'overdue' | 'cancelled'
  notes?: string
  tracking_number?: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface SupplierOrderItem {
  id: string
  product_id: string
  product_name: string
  sku: string
  quantity: number
  unit_price: number
  total_price: number
  received_quantity?: number
  quality_check_status?: 'pending' | 'passed' | 'failed'
  notes?: string
}

export interface SupplierPerformanceMetrics {
  supplier_id: string
  period: string // YYYY-MM format
  orders_count: number
  total_amount: number
  on_time_deliveries: number
  late_deliveries: number
  cancelled_orders: number
  defective_items: number
  total_items: number
  avg_response_time: number
  customer_satisfaction: number
  cost_savings: number
  quality_incidents: number
  calculated_at: string
}

export interface SupplierContact {
  id: string
  supplier_id: string
  name: string
  position: string
  email: string
  phone: string
  department: string
  is_primary: boolean
  notes?: string
  created_at: string
  updated_at: string
}

export interface SupplierDocument {
  id: string
  supplier_id: string
  name: string
  type: 'contract' | 'certificate' | 'invoice' | 'catalog' | 'other'
  file_url: string
  file_size: number
  mime_type: string
  expiry_date?: string
  is_active: boolean
  uploaded_by: string
  uploaded_at: string
  notes?: string
}

export interface SupplierAudit {
  id: string
  supplier_id: string
  audit_type: 'quality' | 'compliance' | 'financial' | 'operational'
  audit_date: string
  auditor: string
  score: number
  status: 'passed' | 'failed' | 'conditional'
  findings: string[]
  recommendations: string[]
  follow_up_date?: string
  report_url?: string
  created_at: string
}

// Color schemes for different supplier statuses and types
export const SUPPLIER_COLORS = {
  status: {
    active: {
      bg: 'bg-green-50',
      text: 'text-green-700',
      border: 'border-green-200',
      badge: 'bg-green-100 text-green-800'
    },
    inactive: {
      bg: 'bg-gray-50',
      text: 'text-gray-700',
      border: 'border-gray-200',
      badge: 'bg-gray-100 text-gray-800'
    },
    pending: {
      bg: 'bg-yellow-50',
      text: 'text-yellow-700',
      border: 'border-yellow-200',
      badge: 'bg-yellow-100 text-yellow-800'
    },
    suspended: {
      bg: 'bg-red-50',
      text: 'text-red-700',
      border: 'border-red-200',
      badge: 'bg-red-100 text-red-800'
    }
  },
  business_type: {
    manufacturer: {
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      border: 'border-blue-200',
      badge: 'bg-blue-100 text-blue-800'
    },
    distributor: {
      bg: 'bg-purple-50',
      text: 'text-purple-700',
      border: 'border-purple-200',
      badge: 'bg-purple-100 text-purple-800'
    },
    wholesaler: {
      bg: 'bg-indigo-50',
      text: 'text-indigo-700',
      border: 'border-indigo-200',
      badge: 'bg-indigo-100 text-indigo-800'
    },
    retailer: {
      bg: 'bg-pink-50',
      text: 'text-pink-700',
      border: 'border-pink-200',
      badge: 'bg-pink-100 text-pink-800'
    },
    service_provider: {
      bg: 'bg-teal-50',
      text: 'text-teal-700',
      border: 'border-teal-200',
      badge: 'bg-teal-100 text-teal-800'
    }
  },
  risk_level: {
    low: {
      bg: 'bg-green-50',
      text: 'text-green-700',
      border: 'border-green-200',
      badge: 'bg-green-100 text-green-800'
    },
    medium: {
      bg: 'bg-yellow-50',
      text: 'text-yellow-700',
      border: 'border-yellow-200',
      badge: 'bg-yellow-100 text-yellow-800'
    },
    high: {
      bg: 'bg-red-50',
      text: 'text-red-700',
      border: 'border-red-200',
      badge: 'bg-red-100 text-red-800'
    }
  },
  performance_trend: {
    improving: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
      badge: 'bg-emerald-100 text-emerald-800'
    },
    stable: {
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      border: 'border-blue-200',
      badge: 'bg-blue-100 text-blue-800'
    },
    declining: {
      bg: 'bg-orange-50',
      text: 'text-orange-700',
      border: 'border-orange-200',
      badge: 'bg-orange-100 text-orange-800'
    }
  }
} as const

export const SUPPLIER_BUSINESS_TYPES = [
  { value: 'manufacturer', label: 'Fabricante' },
  { value: 'distributor', label: 'Distribuidor' },
  { value: 'wholesaler', label: 'Mayorista' },
  { value: 'retailer', label: 'Minorista' },
  { value: 'service_provider', label: 'Proveedor de Servicios' }
] as const

export const SUPPLIER_COMPANY_SIZES = [
  { value: 'small', label: 'Pequeña (1-50 empleados)' },
  { value: 'medium', label: 'Mediana (51-250 empleados)' },
  { value: 'large', label: 'Grande (251-1000 empleados)' },
  { value: 'enterprise', label: 'Empresa (1000+ empleados)' }
] as const

export const SUPPLIER_CONTACT_METHODS = [
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Teléfono' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'in_person', label: 'En Persona' }
] as const

export const SUPPLIER_CONTRACT_TYPES = [
  { value: 'fixed', label: 'Contrato Fijo' },
  { value: 'renewable', label: 'Renovable' },
  { value: 'ongoing', label: 'Continuo' }
] as const