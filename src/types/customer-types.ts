import {
  CustomerStatus,
  CustomerType,
  ViewMode,
  FilterPeriod,
  SortOption,
  CommunicationType,
  ActivityType,
  NotificationType,
  NotificationPriority,
  ExportFormat
} from '@/constants/customer-constants'

// Base interfaces
export interface BaseEntity {
  id: string
  createdAt: Date
  updatedAt: Date
}

export interface Address {
  street: string
  city: string
  state: string
  postalCode: string
  country: string
  isDefault?: boolean
}

export interface ContactInfo {
  email: string
  phone?: string
  mobile?: string
  website?: string
  socialMedia?: {
    linkedin?: string
    twitter?: string
    facebook?: string
    instagram?: string
  }
}

export interface CustomerTag {
  id: string
  name: string
  color: string
  description?: string
}

export interface CustomerNote {
  id: string
  content: string
  authorId: string
  authorName: string
  createdAt: Date
  isPrivate: boolean
  attachments?: string[]
}

// Main Customer interface
export interface Customer extends BaseEntity {
  // Basic information
  firstName: string
  lastName: string
  fullName: string
  email: string
  phone?: string
  avatar?: string

  // Business information
  company?: string
  jobTitle?: string
  department?: string

  // Classification
  type: CustomerType
  status: CustomerStatus
  segment?: string
  priority?: 'low' | 'medium' | 'high' | 'vip'

  // Contact information
  contactInfo: ContactInfo
  addresses: Address[]

  // Metadata
  tags: CustomerTag[]
  notes: CustomerNote[]
  customFields: Record<string, any>

  // Business metrics
  totalOrders: number
  totalSpent: number
  averageOrderValue: number
  lastOrderDate?: Date
  firstOrderDate?: Date
  lifetimeValue: number

  // Engagement
  lastContactDate?: Date
  lastLoginDate?: Date
  communicationPreferences: {
    email: boolean
    sms: boolean
    phone: boolean
    whatsapp: boolean
  }

  // Financial information
  creditLimit?: number
  currentBalance?: number
  paymentTerms?: string

  // System fields
  assignedTo?: string
  source?: string
  referredBy?: string
  isDeleted: boolean
}

// Customer filters
export interface CustomerFilters {
  search: string
  status: CustomerStatus[]
  type: CustomerType[]
  segment: string[]
  tags: string[]
  dateRange: {
    start?: Date
    end?: Date
    period?: FilterPeriod
  }
  valueRange: {
    min?: number
    max?: number
  }
  assignedTo: string[]
  source: string[]
  hasOrders: boolean | null
  isActive: boolean | null
}

// Customer list state
export interface CustomerListState {
  customers: Customer[]
  filteredCustomers: Customer[]
  selectedCustomers: string[]
  filters: CustomerFilters
  viewMode: ViewMode
  sortBy: SortOption
  isLoading: boolean
  error: string | null
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

// Customer activity
export interface CustomerActivity extends BaseEntity {
  customerId: string
  type: ActivityType
  title: string
  description: string
  metadata: Record<string, any>
  performedBy?: string
  performedByName?: string
  relatedEntityId?: string
  relatedEntityType?: string
}

// Communication record
export interface CommunicationRecord extends BaseEntity {
  customerId: string
  type: CommunicationType
  subject: string
  content: string
  direction: 'inbound' | 'outbound'
  status: 'sent' | 'delivered' | 'read' | 'failed'
  sentBy?: string
  sentByName?: string
  attachments: string[]
  metadata: Record<string, any>
}

// Customer notification
export interface CustomerNotification extends BaseEntity {
  customerId?: string
  type: NotificationType
  priority: NotificationPriority
  title: string
  message: string
  category: string
  isRead: boolean
  isArchived: boolean
  actionUrl?: string
  actionLabel?: string
  expiresAt?: Date
  metadata: Record<string, any>
}

// Analytics interfaces
export interface CustomerMetrics {
  totalCustomers: number
  activeCustomers: number
  newCustomers: number
  churnedCustomers: number
  averageLifetimeValue: number
  averageOrderValue: number
  totalRevenue: number
  conversionRate: number
}

export interface CustomerSegmentData {
  segment: string
  count: number
  percentage: number
  revenue: number
  averageValue: number
}

export interface CustomerGrowthData {
  date: string
  newCustomers: number
  totalCustomers: number
  churnedCustomers: number
  netGrowth: number
}

export interface CustomerRevenueData {
  date: string
  revenue: number
  orders: number
  averageOrderValue: number
}

export interface CustomerSatisfactionData {
  date: string
  score: number
  responses: number
  category: string
}

// Form interfaces
export interface CustomerFormData {
  firstName: string
  lastName: string
  email: string
  phone?: string
  company?: string
  jobTitle?: string
  type: CustomerType
  status: CustomerStatus
  tags: string[]
  notes: string
  customFields: Record<string, any>
  addresses: Omit<Address, 'isDefault'>[]
  communicationPreferences: {
    email: boolean
    sms: boolean
    phone: boolean
    whatsapp: boolean
  }
  creditLimit?: string
  paymentTerms?: string
}

export interface CustomerFormErrors {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  company?: string
  general?: string
}

// API interfaces
export interface CustomerListResponse {
  customers: Customer[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  filters: CustomerFilters
}

export interface CustomerDetailResponse {
  customer: Customer
  activities: CustomerActivity[]
  communications: CommunicationRecord[]
  relatedCustomers: Customer[]
}

export interface CustomerAnalyticsResponse {
  metrics: CustomerMetrics
  segments: CustomerSegmentData[]
  growth: CustomerGrowthData[]
  revenue: CustomerRevenueData[]
  satisfaction: CustomerSatisfactionData[]
  trends: {
    customersGrowth: number
    revenueGrowth: number
    satisfactionTrend: number
  }
}

// Export interfaces
export interface ExportOptions {
  format: ExportFormat
  fields: string[]
  filters: Partial<CustomerFilters>
  includeActivities: boolean
  includeCommunications: boolean
  dateRange?: {
    start: Date
    end: Date
  }
}

export interface ExportResult {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  format: ExportFormat
  fileName: string
  downloadUrl?: string
  recordCount: number
  createdAt: Date
  completedAt?: Date
  error?: string
}

// Import interfaces
export interface ImportOptions {
  format: ExportFormat
  file: File
  mapping: Record<string, string>
  skipDuplicates: boolean
  updateExisting: boolean
  validateOnly: boolean
}

export interface ImportResult {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  totalRecords: number
  processedRecords: number
  successfulRecords: number
  failedRecords: number
  errors: ImportError[]
  createdAt: Date
  completedAt?: Date
}

export interface ImportError {
  row: number
  field: string
  value: string | number | boolean | null
  message: string
}

// Bulk operations
export interface BulkOperation {
  id: string
  type: 'update' | 'delete' | 'tag' | 'status_change' | 'assign'
  customerIds: string[]
  data: Record<string, any>
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  results?: BulkOperationResult[]
  createdAt: Date
  completedAt?: Date
}

export interface BulkOperationResult {
  customerId: string
  success: boolean
  error?: string
}

// Search interfaces
export interface SearchResult {
  customers: Customer[]
  total: number
  query: string
  suggestions: string[]
  facets: {
    status: Array<{ value: CustomerStatus; count: number }>
    type: Array<{ value: CustomerType; count: number }>
    segment: Array<{ value: string; count: number }>
    tags: Array<{ value: string; count: number }>
  }
}

export interface SearchOptions {
  query: string
  filters: Partial<CustomerFilters>
  facets: string[]
  page: number
  pageSize: number
  sortBy: SortOption
}

// Component prop interfaces
export interface CustomerListProps {
  customers: Customer[]
  isLoading: boolean
  error: string | null
  viewMode: ViewMode
  selectedCustomers: string[]
  onCustomerSelect: (customerId: string) => void
  onCustomerSelectAll: (selected: boolean) => void
  onCustomerView: (customer: Customer) => void
  onCustomerEdit: (customer: Customer) => void
  onCustomerDelete: (customer: Customer) => void
}

export interface CustomerFiltersProps {
  filters: CustomerFilters
  onFiltersChange: (filters: Partial<CustomerFilters>) => void
  onFiltersReset: () => void
  availableSegments: string[]
  availableTags: CustomerTag[]
  availableUsers: Array<{ id: string; name: string }>
}

export interface CustomerModalProps {
  customer?: Customer
  isOpen: boolean
  mode: 'view' | 'edit' | 'create'
  onClose: () => void
  onSave: (customer: CustomerFormData) => Promise<void>
  onDelete?: (customer: Customer) => Promise<void>
}

// Hook return types
export interface UseCustomerStateReturn {
  customers: Customer[]
  filteredCustomers: Customer[]
  selectedCustomers: string[]
  filters: CustomerFilters
  viewMode: ViewMode
  sortBy: SortOption
  isLoading: boolean
  error: string | null
  pagination: CustomerListState['pagination']
}

export interface UseCustomerActionsReturn {
  loadCustomers: () => Promise<void>
  refreshCustomers: () => Promise<void>
  updateFilters: (filters: Partial<CustomerFilters>) => void
  resetFilters: () => void
  setViewMode: (mode: ViewMode) => void
  setSortBy: (sort: SortOption) => void
  selectCustomer: (customerId: string) => void
  selectAllCustomers: (selected: boolean) => void
  createCustomer: (data: CustomerFormData) => Promise<Customer>
  updateCustomer: (id: string, data: Partial<CustomerFormData>) => Promise<Customer>
  deleteCustomer: (id: string) => Promise<void>
  bulkUpdateCustomers: (customerIds: string[], data: Record<string, any>) => Promise<void>
  exportCustomers: (options: ExportOptions) => Promise<ExportResult>
  importCustomers: (options: ImportOptions) => Promise<ImportResult>
}

// Utility types
export type CustomerField = keyof Customer
export type CustomerSortField = 'firstName' | 'lastName' | 'email' | 'company' | 'createdAt' | 'lastOrderDate' | 'totalSpent'
export type CustomerFilterField = keyof CustomerFilters

// Event types
export interface CustomerEvent {
  type: 'created' | 'updated' | 'deleted' | 'status_changed' | 'tagged' | 'note_added'
  customerId: string
  data: Record<string, unknown>
  timestamp: Date
  userId?: string
}

// Permission types
export interface CustomerPermissions {
  canView: boolean
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
  canExport: boolean
  canImport: boolean
  canBulkUpdate: boolean
  canViewAnalytics: boolean
  canManageTags: boolean
  canViewNotes: boolean
  canAddNotes: boolean
}

// Configuration types
export interface CustomerModuleConfig {
  features: {
    enableAnalytics: boolean
    enableTimeline: boolean
    enableCommunications: boolean
    enableBulkOperations: boolean
    enableExport: boolean
    enableImport: boolean
    enableNotifications: boolean
  }
  limits: {
    maxCustomersPerPage: number
    maxExportRecords: number
    maxImportRecords: number
    maxBulkOperationRecords: number
  }
  defaults: {
    viewMode: ViewMode
    pageSize: number
    sortBy: SortOption
  }
}