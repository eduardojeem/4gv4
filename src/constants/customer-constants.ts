// Customer status constants
export const CUSTOMER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  PENDING: 'pending',
  SUSPENDED: 'suspended',
  VIP: 'vip'
} as const

export type CustomerStatus = typeof CUSTOMER_STATUS[keyof typeof CUSTOMER_STATUS]

// Customer types
export const CUSTOMER_TYPES = {
  INDIVIDUAL: 'individual',
  BUSINESS: 'business',
  ENTERPRISE: 'enterprise',
  GOVERNMENT: 'government'
} as const

export type CustomerType = typeof CUSTOMER_TYPES[keyof typeof CUSTOMER_TYPES]

// View modes
export const VIEW_MODES = {
  TABLE: 'table',
  GRID: 'grid',
  TIMELINE: 'timeline'
} as const

export type ViewMode = typeof VIEW_MODES[keyof typeof VIEW_MODES]

// Filter periods
export const FILTER_PERIODS = {
  TODAY: 'today',
  WEEK: 'week',
  MONTH: 'month',
  QUARTER: 'quarter',
  YEAR: 'year',
  CUSTOM: 'custom'
} as const

export type FilterPeriod = typeof FILTER_PERIODS[keyof typeof FILTER_PERIODS]

// Sort options
export const SORT_OPTIONS = {
  NAME_ASC: 'name_asc',
  NAME_DESC: 'name_desc',
  DATE_ASC: 'date_asc',
  DATE_DESC: 'date_desc',
  VALUE_ASC: 'value_asc',
  VALUE_DESC: 'value_desc',
  STATUS_ASC: 'status_asc',
  STATUS_DESC: 'status_desc'
} as const

export type SortOption = typeof SORT_OPTIONS[keyof typeof SORT_OPTIONS]

// Communication types
export const COMMUNICATION_TYPES = {
  EMAIL: 'email',
  SMS: 'sms',
  WHATSAPP: 'whatsapp',
  CALL: 'call',
  MEETING: 'meeting',
  NOTE: 'note'
} as const

export type CommunicationType = typeof COMMUNICATION_TYPES[keyof typeof COMMUNICATION_TYPES]

// Activity types
export const ACTIVITY_TYPES = {
  PURCHASE: 'purchase',
  PAYMENT: 'payment',
  REFUND: 'refund',
  SUPPORT: 'support',
  LOGIN: 'login',
  PROFILE_UPDATE: 'profile_update',
  COMMUNICATION: 'communication',
  NOTE_ADDED: 'note_added',
  STATUS_CHANGE: 'status_change'
} as const

export type ActivityType = typeof ACTIVITY_TYPES[keyof typeof ACTIVITY_TYPES]

// Notification types
export const NOTIFICATION_TYPES = {
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
  REMINDER: 'reminder'
} as const

export type NotificationType = typeof NOTIFICATION_TYPES[keyof typeof NOTIFICATION_TYPES]

// Notification priorities
export const NOTIFICATION_PRIORITIES = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent'
} as const

export type NotificationPriority = typeof NOTIFICATION_PRIORITIES[keyof typeof NOTIFICATION_PRIORITIES]

// Export formats
export const EXPORT_FORMATS = {
  CSV: 'csv',
  EXCEL: 'excel',
  PDF: 'pdf',
  JSON: 'json'
} as const

export type ExportFormat = typeof EXPORT_FORMATS[keyof typeof EXPORT_FORMATS]

// Pagination constants
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  PAGE_SIZE_OPTIONS: [10, 20, 50, 100],
  MAX_PAGE_SIZE: 100
} as const

// Search constants
export const SEARCH = {
  MIN_SEARCH_LENGTH: 2,
  DEBOUNCE_DELAY: 300,
  MAX_RECENT_SEARCHES: 10
} as const

// Date formats
export const DATE_FORMATS = {
  DISPLAY: 'dd/MM/yyyy',
  DISPLAY_WITH_TIME: 'dd/MM/yyyy HH:mm',
  API: 'yyyy-MM-dd',
  API_WITH_TIME: "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
  RELATIVE_SHORT: 'relative-short',
  RELATIVE_LONG: 'relative-long'
} as const

// Chart configurations
export const CHART_CONFIG = {
  COLORS: {
    PRIMARY: '#3b82f6',
    SUCCESS: '#10b981',
    WARNING: '#f59e0b',
    DANGER: '#ef4444',
    INFO: '#06b6d4',
    MUTED: '#6b7280'
  },
  ANIMATION_DURATION: 300,
  REFRESH_INTERVAL: 30000, // 30 seconds
  CACHE_DURATION: 300000 // 5 minutes
} as const

// API endpoints
export const API_ENDPOINTS = {
  CUSTOMERS: '/api/customers',
  CUSTOMER_DETAIL: (id: string) => `/api/customers/${id}`,
  CUSTOMER_ACTIVITIES: (id: string) => `/api/customers/${id}/activities`,
  CUSTOMER_COMMUNICATIONS: (id: string) => `/api/customers/${id}/communications`,
  CUSTOMER_ANALYTICS: '/api/customers/analytics',
  CUSTOMER_EXPORT: '/api/customers/export',
  CUSTOMER_IMPORT: '/api/customers/import',
  CUSTOMER_BULK_UPDATE: '/api/customers/bulk-update',
  NOTIFICATIONS: '/api/notifications'
} as const

// Error messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Error de conexión. Verifica tu conexión a internet.',
  PERMISSION_DENIED: 'No tienes permisos para realizar esta acción.',
  CUSTOMER_NOT_FOUND: 'Cliente no encontrado.',
  INVALID_DATA: 'Los datos proporcionados no son válidos.',
  EXPORT_FAILED: 'Error al exportar los datos.',
  IMPORT_FAILED: 'Error al importar los datos.',
  SAVE_FAILED: 'Error al guardar los cambios.',
  DELETE_FAILED: 'Error al eliminar el cliente.',
  GENERIC_ERROR: 'Se produjo un error inesperado.'
} as const

// Success messages
export const SUCCESS_MESSAGES = {
  CUSTOMER_CREATED: 'Cliente creado exitosamente.',
  CUSTOMER_UPDATED: 'Cliente actualizado exitosamente.',
  CUSTOMER_DELETED: 'Cliente eliminado exitosamente.',
  EXPORT_COMPLETED: 'Exportación completada exitosamente.',
  IMPORT_COMPLETED: 'Importación completada exitosamente.',
  BULK_UPDATE_COMPLETED: 'Actualización masiva completada.',
  MESSAGE_SENT: 'Mensaje enviado exitosamente.',
  NOTE_ADDED: 'Nota agregada exitosamente.'
} as const

// Validation rules
export const VALIDATION_RULES = {
  NAME: {
    MIN_LENGTH: 2,
    MAX_LENGTH: 100
  },
  EMAIL: {
    PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  PHONE: {
    PATTERN: /^[\+]?[1-9][\d]{0,15}$/
  },
  SEARCH: {
    MIN_LENGTH: 2,
    MAX_LENGTH: 100
  },
  NOTE: {
    MAX_LENGTH: 1000
  }
} as const

// Feature flags
export const FEATURE_FLAGS = {
  ENABLE_BULK_OPERATIONS: true,
  ENABLE_EXPORT: true,
  ENABLE_IMPORT: true,
  ENABLE_ANALYTICS: true,
  ENABLE_TIMELINE: true,
  ENABLE_NOTIFICATIONS: true,
  ENABLE_COMMUNICATION_CENTER: true,
  ENABLE_ADVANCED_FILTERS: true,
  ENABLE_REAL_TIME_UPDATES: true
} as const

// UI constants
export const UI_CONSTANTS = {
  SIDEBAR_WIDTH: 280,
  HEADER_HEIGHT: 64,
  MOBILE_BREAKPOINT: 768,
  TABLET_BREAKPOINT: 1024,
  ANIMATION_DURATION: 200,
  TOAST_DURATION: 5000,
  MODAL_Z_INDEX: 1000,
  DROPDOWN_Z_INDEX: 100
} as const

// Local storage keys
export const STORAGE_KEYS = {
  CUSTOMER_FILTERS: 'customer_filters',
  CUSTOMER_VIEW_MODE: 'customer_view_mode',
  CUSTOMER_SORT: 'customer_sort',
  RECENT_SEARCHES: 'customer_recent_searches',
  CHART_CACHE: 'chart_cache',
  USER_PREFERENCES: 'user_preferences'
} as const

// Performance constants
export const PERFORMANCE = {
  VIRTUAL_LIST_THRESHOLD: 100,
  DEBOUNCE_DELAY: 300,
  THROTTLE_DELAY: 100,
  CACHE_SIZE: 50,
  MAX_CONCURRENT_REQUESTS: 5
} as const

// Accessibility constants
export const A11Y = {
  ARIA_LABELS: {
    CUSTOMER_LIST: 'Lista de clientes',
    CUSTOMER_FILTERS: 'Filtros de clientes',
    CUSTOMER_ACTIONS: 'Acciones de cliente',
    SEARCH_INPUT: 'Buscar clientes',
    SORT_BUTTON: 'Ordenar clientes',
    VIEW_MODE_TOGGLE: 'Cambiar modo de vista',
    EXPORT_BUTTON: 'Exportar clientes',
    IMPORT_BUTTON: 'Importar clientes'
  },
  KEYBOARD_SHORTCUTS: {
    SEARCH: 'Ctrl+K',
    NEW_CUSTOMER: 'Ctrl+N',
    EXPORT: 'Ctrl+E',
    REFRESH: 'F5'
  }
} as const