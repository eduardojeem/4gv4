# Design Document: Mejoras Técnicas del Módulo de Reparaciones

## Overview

Este documento describe el diseño técnico para implementar mejoras críticas en el módulo de reparaciones. El diseño se enfoca en tres pilares fundamentales:

1. **Resiliencia** - Sistema robusto de manejo de errores con recuperación automática
2. **Validación** - Schemas declarativos con Zod para type-safety y reutilización
3. **Performance** - Optimizaciones de renderizado y memoización estratégica

El diseño mantiene compatibilidad con el código existente mediante migración incremental y feature flags.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Repairs Module                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   UI Layer   │  │ Validation   │  │    Error     │    │
│  │              │  │   Layer      │  │   Handler    │    │
│  │ - Components │  │ - Zod        │  │ - AppError   │    │
│  │ - Forms      │  │ - Schemas    │  │ - Logger     │    │
│  │ - Memoized   │  │ - Resolvers  │  │ - Recovery   │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
│         │                  │                  │            │
│         └──────────────────┴──────────────────┘            │
│                            │                               │
│                   ┌────────▼────────┐                      │
│                   │   Hooks Layer   │                      │
│                   │                 │                      │
│                   │ - use-repairs   │                      │
│                   │ - use-form      │                      │
│                   │ - use-error     │                      │
│                   └────────┬────────┘                      │
│                            │                               │
│                   ┌────────▼────────┐                      │
│                   │  Data Layer     │                      │
│                   │                 │                      │
│                   │ - Supabase      │                      │
│                   │ - SWR Cache     │                      │
│                   │ - Mock Data     │                      │
│                   └─────────────────┘                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Component Hierarchy

```
RepairsPage (Memoized)
├── RepairStats (Memoized)
├── RepairFilters (Memoized)
│   └── FilterPopover
├── ViewModeSelector
└── RepairView (Conditional)
    ├── RepairList (Virtualized)
    │   └── RepairRow (Memoized)
    ├── RepairKanban (Memoized)
    │   └── RepairCard (Memoized)
    └── RepairCalendar
        └── CalendarEvent (Memoized)
```

## Components and Interfaces

### 1. Error Handling System

#### AppError Class

```typescript
// lib/errors/app-error.ts
export enum ErrorCode {
  // Authentication
  AUTH_EXPIRED = 'AUTH_EXPIRED',
  AUTH_INVALID = 'AUTH_INVALID',
  AUTH_MISSING = 'AUTH_MISSING',
  
  // Network
  NETWORK_ERROR = 'NETWORK_ERROR',
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  
  // Validation
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  
  // Server
  SERVER_ERROR = 'SERVER_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  
  // Unknown
  UNKNOWN = 'UNKNOWN'
}

export interface ErrorContext {
  operation?: string
  userId?: string
  repairId?: string
  timestamp?: string
  [key: string]: any
}

export interface ErrorAction {
  label: string
  onClick: () => void
}

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public context?: ErrorContext,
    public action?: ErrorAction,
    public originalError?: Error
  ) {
    super(message)
    this.name = 'AppError'
  }

  static from(error: unknown, context?: ErrorContext): AppError {
    // Implementation in design
  }

  static isAuthError(error: unknown): boolean {
    // Implementation in design
  }

  static isNetworkError(error: unknown): boolean {
    // Implementation in design
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      context: this.context,
      timestamp: new Date().toISOString()
    }
  }
}
```

#### Error Handler Hook

```typescript
// hooks/use-error-handler.ts
export interface UseErrorHandlerOptions {
  onError?: (error: AppError) => void
  showToast?: boolean
  logError?: boolean
}

export function useErrorHandler(options: UseErrorHandlerOptions = {}) {
  const handleError = useCallback((error: unknown, context?: ErrorContext) => {
    const appError = AppError.from(error, context)
    
    // Log error
    if (options.logError !== false) {
      logger.error(appError.message, appError.toJSON())
    }
    
    // Show toast
    if (options.showToast !== false) {
      showErrorToast(appError)
    }
    
    // Custom handler
    options.onError?.(appError)
    
    return appError
  }, [options])

  return { handleError }
}
```

### 2. Validation System

#### Zod Schemas

```typescript
// schemas/repair.schema.ts
import { z } from 'zod'

export const CustomerSchema = z.object({
  name: z.string()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(100, 'El nombre es demasiado largo'),
  phone: z.string()
    .regex(/^\+?[0-9\s-]{7,}$/, 'Formato de teléfono inválido'),
  email: z.string()
    .email('Email inválido')
    .optional()
    .or(z.literal('')),
  address: z.string().optional(),
  document: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional()
})

export const DeviceSchema = z.object({
  deviceType: z.enum(['smartphone', 'laptop', 'tablet', 'desktop', 'accessory'], {
    errorMap: () => ({ message: 'Selecciona un tipo de dispositivo' })
  }),
  brand: z.string()
    .min(2, 'La marca debe tener al menos 2 caracteres'),
  model: z.string()
    .min(1, 'El modelo es obligatorio'),
  issue: z.string()
    .min(4, 'Describe el problema (mínimo 4 caracteres)'),
  description: z.string()
    .min(10, 'Proporciona más detalles (mínimo 10 caracteres)'),
  technician: z.string()
    .min(1, 'Selecciona un técnico'),
  estimatedCost: z.number()
    .positive('El costo debe ser positivo')
    .optional()
})

export const RepairFormSchema = z.object({
  customerName: CustomerSchema.shape.name,
  customerPhone: CustomerSchema.shape.phone,
  customerEmail: CustomerSchema.shape.email,
  customerAddress: CustomerSchema.shape.address,
  customerDocument: CustomerSchema.shape.document,
  customerCity: CustomerSchema.shape.city,
  customerCountry: CustomerSchema.shape.country,
  existingCustomerId: z.string().optional(),
  isNewCustomer: z.boolean().default(false),
  priority: z.enum(['low', 'medium', 'high']),
  urgency: z.enum(['low', 'medium', 'high']),
  devices: z.array(DeviceSchema)
    .min(1, 'Agrega al menos un dispositivo')
    .max(10, 'Máximo 10 dispositivos por reparación')
})

// Quick mode schema (relaxed validation)
export const RepairFormQuickSchema = RepairFormSchema.extend({
  devices: z.array(
    DeviceSchema.omit({ description: true }).extend({
      description: z.string().optional()
    })
  ).min(1)
})

// Type inference
export type RepairFormData = z.infer<typeof RepairFormSchema>
export type DeviceFormData = z.infer<typeof DeviceSchema>
```


#### Form Integration

```typescript
// components/dashboard/repair-form-dialog-v2.tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

export function RepairFormDialog({ open, mode, onSubmit, onClose }: Props) {
  const [quickMode, setQuickMode] = useState(false)
  
  const schema = quickMode ? RepairFormQuickSchema : RepairFormSchema
  
  const {
    register,
    handleSubmit,
    formState: { errors, isValid, isSubmitting },
    watch,
    setValue,
    control
  } = useForm<RepairFormData>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: initialData
  })

  const onSubmitForm = async (data: RepairFormData) => {
    try {
      await onSubmit(data)
      toast.success('Reparación guardada exitosamente')
      onClose()
    } catch (error) {
      const appError = AppError.from(error)
      toast.error(appError.message, {
        action: appError.action
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <form onSubmit={handleSubmit(onSubmitForm)}>
        {/* Form fields with automatic validation */}
        <Input
          {...register('customerName')}
          error={errors.customerName?.message}
        />
        {/* ... */}
      </form>
    </Dialog>
  )
}
```

### 3. Performance Optimization

#### Memoized Components

```typescript
// components/dashboard/repairs/RepairRow.tsx
import React from 'react'

interface RepairRowProps {
  repair: Repair
  onEdit: (repair: Repair) => void
  onDelete: (id: string) => void
  onStatusChange: (id: string, status: RepairStatus) => void
}

export const RepairRow = React.memo<RepairRowProps>(
  ({ repair, onEdit, onDelete, onStatusChange }) => {
    // Component implementation
    return (
      <TableRow onClick={() => onEdit(repair)}>
        {/* Row content */}
      </TableRow>
    )
  },
  // Custom comparison function
  (prevProps, nextProps) => {
    return (
      prevProps.repair.id === nextProps.repair.id &&
      prevProps.repair.status === nextProps.repair.status &&
      prevProps.repair.lastUpdate === nextProps.repair.lastUpdate
    )
  }
)

RepairRow.displayName = 'RepairRow'
```

#### Optimized Filtering

```typescript
// hooks/use-repairs-optimized.ts
export function useRepairs() {
  const [repairs, setRepairs] = useState<Repair[]>([])
  const [filters, setFilters] = useState<RepairFilters>({
    status: 'all',
    priority: 'all',
    technician: 'all',
    search: '',
    dateRange: undefined
  })

  // Memoize each filter step separately
  const filteredByStatus = useMemo(() => {
    if (filters.status === 'all') return repairs
    return repairs.filter(r => r.status === filters.status)
  }, [repairs, filters.status])

  const filteredByPriority = useMemo(() => {
    if (filters.priority === 'all') return filteredByStatus
    return filteredByStatus.filter(r => r.priority === filters.priority)
  }, [filteredByStatus, filters.priority])

  const filteredByTechnician = useMemo(() => {
    if (filters.technician === 'all') return filteredByPriority
    return filteredByPriority.filter(r => r.technician?.id === filters.technician)
  }, [filteredByPriority, filters.technician])

  const filteredByDate = useMemo(() => {
    if (!filters.dateRange?.from && !filters.dateRange?.to) {
      return filteredByTechnician
    }
    return filteredByTechnician.filter(r => {
      const date = new Date(r.createdAt)
      const fromOk = !filters.dateRange?.from || date >= filters.dateRange.from
      const toOk = !filters.dateRange?.to || date <= filters.dateRange.to
      return fromOk && toOk
    })
  }, [filteredByTechnician, filters.dateRange])

  // Debounced search
  const debouncedSearch = useDebouncedValue(filters.search, 300)
  
  const filteredBySearch = useMemo(() => {
    if (!debouncedSearch) return filteredByDate
    const lower = debouncedSearch.toLowerCase()
    return filteredByDate.filter(r =>
      r.customer.name.toLowerCase().includes(lower) ||
      r.device.toLowerCase().includes(lower) ||
      r.id.toLowerCase().includes(lower) ||
      r.issue.toLowerCase().includes(lower)
    )
  }, [filteredByDate, debouncedSearch])

  return {
    repairs,
    filteredRepairs: filteredBySearch,
    filters,
    setFilters,
    // ... other methods
  }
}
```

#### Virtualization for Large Lists

```typescript
// components/dashboard/repairs/RepairListVirtualized.tsx
import { useVirtualizer } from '@tanstack/react-virtual'

export function RepairListVirtualized({ repairs, onEdit }: Props) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: repairs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72, // Row height in pixels
    overscan: 5 // Render 5 extra items above/below viewport
  })

  return (
    <div ref={parentRef} className="h-[600px] overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative'
        }}
      >
        {virtualizer.getVirtualItems().map(virtualRow => {
          const repair = repairs[virtualRow.index]
          return (
            <div
              key={repair.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`
              }}
            >
              <RepairRow repair={repair} onEdit={onEdit} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

## Data Models

### Error Models

```typescript
// types/errors.ts
export interface ErrorLog {
  id: string
  code: ErrorCode
  message: string
  context: ErrorContext
  timestamp: string
  userId?: string
  resolved: boolean
}

export interface ErrorMetrics {
  totalErrors: number
  errorsByCode: Record<ErrorCode, number>
  errorRate: number
  avgResolutionTime: number
}
```

### Validation Models

```typescript
// types/validation.ts
export interface ValidationResult<T> {
  success: boolean
  data?: T
  errors?: Record<string, string[]>
}

export interface FieldError {
  field: string
  message: string
  code: string
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Error Classification Consistency
*For any* error thrown in the system, when classified by AppError.from(), the resulting error code should match the error type consistently across all invocations with the same error type.
**Validates: Requirements 1.2**

### Property 2: Schema Validation Idempotence
*For any* valid data that passes schema validation, validating it multiple times should always produce the same result (success with same data).
**Validates: Requirements 2.1, 2.2**

### Property 3: Memoization Consistency
*For any* memoized component receiving identical props, it should not re-render, and when props change, it should re-render exactly once.
**Validates: Requirements 3.3, 3.9**

### Property 4: Filter Composition Associativity
*For any* set of filters applied in different orders, the final filtered result should be the same (filter order independence).
**Validates: Requirements 3.1, 3.4**

### Property 5: Error Recovery Idempotence
*For any* recoverable error, attempting recovery multiple times should not cause side effects beyond the first successful recovery.
**Validates: Requirements 7.1, 7.4**

### Property 6: Validation Error Messages Completeness
*For any* invalid form data, the validation should return error messages for all invalid fields, not just the first one encountered.
**Validates: Requirements 2.4, 2.9**

### Property 7: Debounce Timing Guarantee
*For any* rapid sequence of search inputs, only the last input after 300ms of inactivity should trigger a search operation.
**Validates: Requirements 3.7**

### Property 8: Type Safety Preservation
*For any* data validated by a Zod schema, the TypeScript type of the validated data should exactly match the inferred type from the schema.
**Validates: Requirements 8.1, 8.3**

### Property 9: Log Sanitization Completeness
*For any* log entry containing sensitive data (email, phone), the sanitized version should not contain any recognizable personal information.
**Validates: Requirements 4.6**

### Property 10: Toast Deduplication
*For any* sequence of identical errors occurring within 5 seconds, only one toast notification should be shown to the user.
**Validates: Requirements 1.7**

## Error Handling

### Error Classification

```typescript
// lib/errors/classifier.ts
export function classifyError(error: unknown): ErrorCode {
  if (error instanceof AppError) {
    return error.code
  }

  const message = error instanceof Error ? error.message : String(error)
  const errorString = message.toLowerCase()

  // Authentication errors
  if (errorString.includes('jwt') || 
      errorString.includes('token') || 
      errorString.includes('unauthorized')) {
    return ErrorCode.AUTH_EXPIRED
  }

  // Network errors
  if (errorString.includes('network') || 
      errorString.includes('fetch') ||
      errorString.includes('timeout')) {
    return ErrorCode.NETWORK_ERROR
  }

  // Validation errors
  if (errorString.includes('validation') || 
      errorString.includes('invalid')) {
    return ErrorCode.VALIDATION_FAILED
  }

  // Server errors
  if (errorString.includes('500') || 
      errorString.includes('server error')) {
    return ErrorCode.SERVER_ERROR
  }

  return ErrorCode.UNKNOWN
}
```

### Retry Logic

```typescript
// lib/errors/retry.ts
export interface RetryOptions {
  maxAttempts: number
  baseDelay: number
  maxDelay: number
  backoffMultiplier: number
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2
  }
): Promise<T> {
  let lastError: Error
  
  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      
      // Don't retry on validation or auth errors
      const appError = AppError.from(error)
      if (appError.code === ErrorCode.VALIDATION_FAILED ||
          appError.code === ErrorCode.AUTH_INVALID) {
        throw appError
      }
      
      if (attempt < options.maxAttempts) {
        const delay = Math.min(
          options.baseDelay * Math.pow(options.backoffMultiplier, attempt - 1),
          options.maxDelay
        )
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  throw lastError!
}
```

## Testing Strategy

### Unit Tests

```typescript
// tests/lib/errors/app-error.test.ts
describe('AppError', () => {
  describe('from()', () => {
    it('should classify JWT errors as AUTH_EXPIRED', () => {
      const error = new Error('JWT token expired')
      const appError = AppError.from(error)
      expect(appError.code).toBe(ErrorCode.AUTH_EXPIRED)
    })

    it('should classify network errors as NETWORK_ERROR', () => {
      const error = new Error('Network request failed')
      const appError = AppError.from(error)
      expect(appError.code).toBe(ErrorCode.NETWORK_ERROR)
    })

    it('should preserve context', () => {
      const error = new Error('Test error')
      const context = { userId: '123', operation: 'fetchRepairs' }
      const appError = AppError.from(error, context)
      expect(appError.context).toEqual(context)
    })
  })
})

// tests/schemas/repair.schema.test.ts
describe('RepairFormSchema', () => {
  it('should validate correct data', () => {
    const validData = {
      customerName: 'John Doe',
      customerPhone: '+1234567890',
      customerEmail: 'john@example.com',
      priority: 'medium',
      urgency: 'high',
      devices: [{
        deviceType: 'smartphone',
        brand: 'Apple',
        model: 'iPhone 13',
        issue: 'Screen broken',
        description: 'Screen completely shattered',
        technician: 'TECH-001'
      }]
    }
    
    const result = RepairFormSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  it('should reject invalid phone', () => {
    const invalidData = {
      customerName: 'John Doe',
      customerPhone: 'invalid',
      // ... rest of data
    }
    
    const result = RepairFormSchema.safeParse(invalidData)
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].path).toContain('customerPhone')
  })
})
```

### Integration Tests

```typescript
// tests/hooks/use-repairs.integration.test.ts
describe('useRepairs with error handling', () => {
  it('should retry on network error', async () => {
    const mockFetch = jest.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ data: mockRepairs })

    const { result } = renderHook(() => useRepairs())
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    
    expect(mockFetch).toHaveBeenCalledTimes(3)
    expect(result.current.repairs).toEqual(mockRepairs)
  })

  it('should show demo mode toast when falling back to mock', async () => {
    const mockFetch = jest.fn().mockRejectedValue(new Error('Table not found'))
    
    const { result } = renderHook(() => useRepairs())
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    
    expect(toast.info).toHaveBeenCalledWith(
      expect.stringContaining('demostración')
    )
  })
})
```

### Property-Based Tests

```typescript
// tests/properties/validation.property.test.ts
import fc from 'fast-check'

describe('Validation Properties', () => {
  it('Property: Schema validation is idempotent', () => {
    fc.assert(
      fc.property(
        fc.record({
          customerName: fc.string({ minLength: 3, maxLength: 100 }),
          customerPhone: fc.string().filter(s => /^\+?[0-9\s-]{7,}$/.test(s)),
          customerEmail: fc.emailAddress(),
          priority: fc.constantFrom('low', 'medium', 'high'),
          urgency: fc.constantFrom('low', 'medium', 'high'),
          devices: fc.array(fc.record({
            deviceType: fc.constantFrom('smartphone', 'laptop', 'tablet'),
            brand: fc.string({ minLength: 2 }),
            model: fc.string({ minLength: 1 }),
            issue: fc.string({ minLength: 4 }),
            description: fc.string({ minLength: 10 }),
            technician: fc.string({ minLength: 1 })
          }), { minLength: 1, maxLength: 5 })
        }),
        (data) => {
          const result1 = RepairFormSchema.safeParse(data)
          const result2 = RepairFormSchema.safeParse(data)
          
          expect(result1.success).toBe(result2.success)
          if (result1.success && result2.success) {
            expect(result1.data).toEqual(result2.data)
          }
        }
      )
    )
  })

  it('Property: Memoized components do not re-render with same props', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.string(),
          status: fc.constantFrom('pending', 'in_progress', 'completed'),
          lastUpdate: fc.date().map(d => d.toISOString())
        }),
        (repair) => {
          const renderSpy = jest.fn()
          const TestComponent = React.memo(() => {
            renderSpy()
            return <div>{repair.id}</div>
          })
          
          const { rerender } = render(<TestComponent />)
          rerender(<TestComponent />)
          
          expect(renderSpy).toHaveBeenCalledTimes(1)
        }
      )
    )
  })
})
```

## Performance Considerations

### Bundle Size Optimization

```typescript
// Dynamic imports for heavy components
const RepairKanban = dynamic(() => import('./RepairKanban'), {
  loading: () => <Skeleton />,
  ssr: false
})

const RepairAnalytics = dynamic(() => import('../analytics/page'), {
  loading: () => <Skeleton />,
  ssr: false
})
```

### Memoization Strategy

1. **Component Level**: Use `React.memo` for leaf components that render frequently
2. **Value Level**: Use `useMemo` for expensive computations (filtering, sorting)
3. **Callback Level**: Use `useCallback` for event handlers passed to memoized children
4. **Selector Level**: Use `useMemo` for derived state from complex objects

### Rendering Optimization

```typescript
// Avoid inline object creation
// ❌ Bad
<RepairRow repair={repair} style={{ color: 'red' }} />

// ✅ Good
const rowStyle = useMemo(() => ({ color: 'red' }), [])
<RepairRow repair={repair} style={rowStyle} />

// Avoid inline function creation
// ❌ Bad
<RepairRow repair={repair} onEdit={() => handleEdit(repair)} />

// ✅ Good
const handleEditCallback = useCallback(() => handleEdit(repair), [repair.id])
<RepairRow repair={repair} onEdit={handleEditCallback} />
```

## Security Considerations

### Input Sanitization

```typescript
// lib/security/sanitize.ts
export function sanitizeLogData(data: any): any {
  const sensitiveFields = ['email', 'phone', 'password', 'token']
  
  if (typeof data !== 'object' || data === null) {
    return data
  }
  
  const sanitized = { ...data }
  
  for (const key of Object.keys(sanitized)) {
    if (sensitiveFields.includes(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]'
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeLogData(sanitized[key])
    }
  }
  
  return sanitized
}
```

### XSS Prevention

All user inputs are validated through Zod schemas before rendering. React's built-in XSS protection handles escaping automatically.

## Migration Path

### Phase 1: Error Handling (Week 1)

1. Create `AppError` class and error codes
2. Implement `useErrorHandler` hook
3. Update `use-repairs` to use new error handling
4. Add error logging
5. Test error scenarios

### Phase 2: Validation (Week 1-2)

1. Define Zod schemas for all forms
2. Create new `RepairFormDialogV2` with React Hook Form
3. Run both versions in parallel with feature flag
4. Migrate users gradually
5. Remove old validation code

### Phase 3: Performance (Week 2)

1. Add `React.memo` to leaf components
2. Optimize filtering with granular memoization
3. Implement virtualization for large lists
4. Add performance monitoring
5. Benchmark and tune

### Phase 4: Testing (Week 2)

1. Write unit tests for new code
2. Add integration tests for critical flows
3. Implement property-based tests
4. Set up CI/CD pipeline
5. Achieve 80% coverage

### Phase 5: Cleanup (Week 3)

1. Remove feature flags
2. Delete old code
3. Update documentation
4. Train team on new patterns
5. Monitor production metrics

## Monitoring and Observability

### Metrics to Track

```typescript
// lib/monitoring/metrics.ts
export interface PerformanceMetrics {
  // Rendering
  avgRenderTime: number
  p95RenderTime: number
  rerenderCount: number
  
  // Filtering
  avgFilterTime: number
  p95FilterTime: number
  
  // Errors
  errorRate: number
  errorsByCode: Record<ErrorCode, number>
  avgRecoveryTime: number
  
  // User Experience
  avgLoadTime: number
  successRate: number
}

export function trackMetric(name: string, value: number, tags?: Record<string, string>) {
  // Send to monitoring service (DataDog, New Relic, etc.)
  if (process.env.NODE_ENV === 'production') {
    // Implementation
  }
}
```

### Error Tracking

```typescript
// lib/monitoring/error-tracker.ts
export function trackError(error: AppError) {
  // Send to error tracking service (Sentry, Rollbar, etc.)
  if (process.env.NODE_ENV === 'production') {
    Sentry.captureException(error, {
      tags: {
        code: error.code,
        operation: error.context?.operation
      },
      extra: error.context
    })
  }
}
```

## Documentation

### Developer Guide

- Error handling patterns and best practices
- Zod schema creation and reuse
- Performance optimization checklist
- Testing strategies and examples

### API Documentation

- AppError class reference
- Zod schemas reference
- Hook APIs
- Component props

### Migration Guide

- Step-by-step migration instructions
- Code examples before/after
- Common pitfalls and solutions
- Rollback procedures

---

**Next Steps:** Review design and proceed to implementation tasks
