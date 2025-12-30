/**
 * Sistema específico de manejo de errores para hooks compuestos de productos
 * Extiende el sistema base de error-handling.ts
 */

import { NotificationError, ErrorType, createError } from './error-handling';

// Códigos de error específicos para productos
export const PRODUCT_ERROR_CODES = {
  // Errores de datos de productos
  INVALID_PRODUCT_DATA: 'PRODUCT_INVALID_DATA',
  PRODUCT_NOT_FOUND: 'PRODUCT_NOT_FOUND',
  DUPLICATE_PRODUCT_ID: 'PRODUCT_DUPLICATE_ID',
  PRODUCT_VALIDATION_FAILED: 'PRODUCT_VALIDATION_FAILED',
  
  // Errores de filtrado
  INVALID_FILTER_VALUE: 'FILTER_INVALID_VALUE',
  FILTER_PARSE_ERROR: 'FILTER_PARSE_ERROR',
  FILTER_COMBINATION_ERROR: 'FILTER_COMBINATION_ERROR',
  FILTER_RANGE_ERROR: 'FILTER_RANGE_ERROR',
  
  // Errores de analytics
  ANALYTICS_CALCULATION_ERROR: 'ANALYTICS_CALCULATION_ERROR',
  INVALID_DATE_RANGE: 'ANALYTICS_INVALID_DATE_RANGE',
  INSUFFICIENT_DATA: 'ANALYTICS_INSUFFICIENT_DATA',
  METRICS_OVERFLOW: 'ANALYTICS_METRICS_OVERFLOW',
  
  // Errores de operaciones
  BULK_OPERATION_FAILED: 'OPERATION_BULK_FAILED',
  OPERATION_TIMEOUT: 'OPERATION_TIMEOUT',
  CONCURRENT_MODIFICATION: 'OPERATION_CONCURRENT_MODIFICATION',
  OPERATION_CANCELLED: 'OPERATION_CANCELLED',
  
  // Errores de estado
  INVALID_HOOK_STATE: 'STATE_INVALID_HOOK',
  STATE_SYNCHRONIZATION_ERROR: 'STATE_SYNC_ERROR',
  MEMORY_LIMIT_EXCEEDED: 'STATE_MEMORY_LIMIT',
  
  // Errores de performance
  LARGE_DATASET_WARNING: 'PERFORMANCE_LARGE_DATASET',
  SLOW_OPERATION_WARNING: 'PERFORMANCE_SLOW_OPERATION',
} as const;

export type ProductErrorCode = typeof PRODUCT_ERROR_CODES[keyof typeof PRODUCT_ERROR_CODES];

// Clase específica para errores de productos
export class ProductError extends NotificationError {
  public readonly productErrorCode: ProductErrorCode;
  public readonly affectedProducts?: string[];
  public readonly operation?: string;

  constructor(
    message: string,
    productErrorCode: ProductErrorCode,
    type: ErrorType = ErrorType.CLIENT,
    options?: {
      code?: string;
      context?: Record<string, any>;
      retryable?: boolean;
      cause?: Error;
      affectedProducts?: string[];
      operation?: string;
    }
  ) {
    super(message, type, {
      code: options?.code || productErrorCode,
      context: options?.context,
      retryable: options?.retryable,
      cause: options?.cause,
    });
    
    this.name = 'ProductError';
    this.productErrorCode = productErrorCode;
    this.affectedProducts = options?.affectedProducts;
    this.operation = options?.operation;
  }
}

// Factory para crear errores específicos de productos
export const createProductError = {
  // Errores de datos
  invalidProductData: (details?: Record<string, unknown>, affectedProducts?: string[]) =>
    new ProductError(
      'Los datos del producto son inválidos',
      PRODUCT_ERROR_CODES.INVALID_PRODUCT_DATA,
      ErrorType.VALIDATION,
      {
        context: { details },
        affectedProducts,
        retryable: false,
      }
    ),

  productNotFound: (productId: string) =>
    new ProductError(
      `Producto con ID ${productId} no encontrado`,
      PRODUCT_ERROR_CODES.PRODUCT_NOT_FOUND,
      ErrorType.CLIENT,
      {
        context: { productId },
        affectedProducts: [productId],
        retryable: false,
      }
    ),

  duplicateProductId: (productId: string) =>
    new ProductError(
      `Ya existe un producto con ID ${productId}`,
      PRODUCT_ERROR_CODES.DUPLICATE_PRODUCT_ID,
      ErrorType.VALIDATION,
      {
        context: { productId },
        affectedProducts: [productId],
        retryable: false,
      }
    ),

  productValidationFailed: (validationErrors: Record<string, string>, productId?: string) =>
    new ProductError(
      'La validación del producto falló',
      PRODUCT_ERROR_CODES.PRODUCT_VALIDATION_FAILED,
      ErrorType.VALIDATION,
      {
        context: { validationErrors },
        affectedProducts: productId ? [productId] : undefined,
        retryable: false,
      }
    ),

  // Errores de filtrado
  invalidFilterValue: (filterName: string, value: unknown, expectedType?: string) =>
    new ProductError(
      `Valor inválido para el filtro ${filterName}`,
      PRODUCT_ERROR_CODES.INVALID_FILTER_VALUE,
      ErrorType.VALIDATION,
      {
        context: { filterName, value, expectedType },
        retryable: false,
      }
    ),

  filterParseError: (filterData: Record<string, unknown>, parseError?: string) =>
    new ProductError(
      'Error al procesar los filtros',
      PRODUCT_ERROR_CODES.FILTER_PARSE_ERROR,
      ErrorType.CLIENT,
      {
        context: { filterData, parseError },
        retryable: false,
      }
    ),

  filterCombinationError: (conflictingFilters: string[]) =>
    new ProductError(
      'Combinación de filtros incompatible',
      PRODUCT_ERROR_CODES.FILTER_COMBINATION_ERROR,
      ErrorType.VALIDATION,
      {
        context: { conflictingFilters },
        retryable: false,
      }
    ),

  filterRangeError: (filterName: string, min: number, max: number) =>
    new ProductError(
      `Rango inválido para ${filterName}: mínimo debe ser menor que máximo`,
      PRODUCT_ERROR_CODES.FILTER_RANGE_ERROR,
      ErrorType.VALIDATION,
      {
        context: { filterName, min, max },
        retryable: false,
      }
    ),

  // Errores de analytics
  analyticsCalculationError: (operation: string, details?: Record<string, unknown>) =>
    new ProductError(
      `Error en cálculo de analytics: ${operation}`,
      PRODUCT_ERROR_CODES.ANALYTICS_CALCULATION_ERROR,
      ErrorType.CLIENT,
      {
        context: { operation, details },
        operation,
        retryable: true,
      }
    ),

  invalidDateRange: (startDate: Date, endDate: Date) =>
    new ProductError(
      'Rango de fechas inválido para analytics',
      PRODUCT_ERROR_CODES.INVALID_DATE_RANGE,
      ErrorType.VALIDATION,
      {
        context: { 
          startDate: startDate.toISOString(), 
          endDate: endDate.toISOString() 
        },
        retryable: false,
      }
    ),

  insufficientData: (requiredCount: number, actualCount: number) =>
    new ProductError(
      'Datos insuficientes para generar analytics',
      PRODUCT_ERROR_CODES.INSUFFICIENT_DATA,
      ErrorType.CLIENT,
      {
        context: { requiredCount, actualCount },
        retryable: false,
      }
    ),

  metricsOverflow: (metric: string, value: number, limit: number) =>
    new ProductError(
      `Valor de métrica ${metric} excede el límite`,
      PRODUCT_ERROR_CODES.METRICS_OVERFLOW,
      ErrorType.CLIENT,
      {
        context: { metric, value, limit },
        retryable: false,
      }
    ),

  // Errores de operaciones
  bulkOperationFailed: (operation: string, failedProducts: string[], totalProducts: number) =>
    new ProductError(
      `Operación masiva ${operation} falló para ${failedProducts.length}/${totalProducts} productos`,
      PRODUCT_ERROR_CODES.BULK_OPERATION_FAILED,
      ErrorType.CLIENT,
      {
        context: { operation, failedCount: failedProducts.length, totalProducts },
        affectedProducts: failedProducts,
        operation,
        retryable: true,
      }
    ),

  operationTimeout: (operation: string, timeout: number) =>
    new ProductError(
      `Operación ${operation} excedió el tiempo límite de ${timeout}ms`,
      PRODUCT_ERROR_CODES.OPERATION_TIMEOUT,
      ErrorType.TIMEOUT,
      {
        context: { operation, timeout },
        operation,
        retryable: true,
      }
    ),

  concurrentModification: (productId: string, operation: string) =>
    new ProductError(
      `Modificación concurrente detectada para producto ${productId}`,
      PRODUCT_ERROR_CODES.CONCURRENT_MODIFICATION,
      ErrorType.CLIENT,
      {
        context: { productId, operation },
        affectedProducts: [productId],
        operation,
        retryable: true,
      }
    ),

  operationCancelled: (operation: string, reason?: string) =>
    new ProductError(
      `Operación ${operation} fue cancelada`,
      PRODUCT_ERROR_CODES.OPERATION_CANCELLED,
      ErrorType.CLIENT,
      {
        context: { operation, reason },
        operation,
        retryable: false,
      }
    ),

  // Errores de estado
  invalidHookState: (hookName: string, expectedState: string, currentState: string) =>
    new ProductError(
      `Estado inválido en hook ${hookName}`,
      PRODUCT_ERROR_CODES.INVALID_HOOK_STATE,
      ErrorType.CLIENT,
      {
        context: { hookName, expectedState, currentState },
        retryable: false,
      }
    ),

  stateSynchronizationError: (hookName: string, details?: Record<string, unknown>) =>
    new ProductError(
      `Error de sincronización en hook ${hookName}`,
      PRODUCT_ERROR_CODES.STATE_SYNCHRONIZATION_ERROR,
      ErrorType.CLIENT,
      {
        context: { hookName, details },
        retryable: true,
      }
    ),

  memoryLimitExceeded: (operation: string, currentUsage: number, limit: number) =>
    new ProductError(
      `Límite de memoria excedido en ${operation}`,
      PRODUCT_ERROR_CODES.MEMORY_LIMIT_EXCEEDED,
      ErrorType.CLIENT,
      {
        context: { operation, currentUsage, limit },
        operation,
        retryable: false,
      }
    ),

  // Warnings de performance
  largeDatasetWarning: (itemCount: number, recommendedLimit: number) =>
    new ProductError(
      `Dataset grande detectado: ${itemCount} elementos (recomendado: ${recommendedLimit})`,
      PRODUCT_ERROR_CODES.LARGE_DATASET_WARNING,
      ErrorType.CLIENT,
      {
        context: { itemCount, recommendedLimit },
        retryable: false,
      }
    ),

  slowOperationWarning: (operation: string, duration: number, threshold: number) =>
    new ProductError(
      `Operación lenta detectada: ${operation} tardó ${duration}ms (umbral: ${threshold}ms)`,
      PRODUCT_ERROR_CODES.SLOW_OPERATION_WARNING,
      ErrorType.CLIENT,
      {
        context: { operation, duration, threshold },
        operation,
        retryable: false,
      }
    ),
};

// Utilidades específicas para errores de productos
export const productErrorUtils = {
  /**
   * Verifica si un error es específico de productos
   */
  isProductError: (error: unknown): error is ProductError => {
    return error instanceof ProductError;
  },

  /**
   * Verifica si un error es de un tipo específico de producto
   */
  isProductErrorType: (error: unknown, code: ProductErrorCode): boolean => {
    return error instanceof ProductError && error.productErrorCode === code;
  },

  /**
   * Obtiene los productos afectados por un error
   */
  getAffectedProducts: (error: ProductError): string[] => {
    return error.affectedProducts || [];
  },

  /**
   * Verifica si un error afecta a un producto específico
   */
  affectsProduct: (error: ProductError, productId: string): boolean => {
    return error.affectedProducts?.includes(productId) || false;
  },

  /**
   * Agrupa errores por tipo
   */
  groupErrorsByType: (errors: ProductError[]): Record<ProductErrorCode, ProductError[]> => {
    return errors.reduce((groups, error) => {
      const code = error.productErrorCode;
      if (!groups[code]) {
        groups[code] = [];
      }
      groups[code].push(error);
      return groups;
    }, {} as Record<ProductErrorCode, ProductError[]>);
  },

  /**
   * Obtiene estadísticas de errores
   */
  getErrorStats: (errors: ProductError[]) => {
    const stats = {
      total: errors.length,
      byType: {} as Record<ProductErrorCode, number>,
      retryable: 0,
      affectedProducts: new Set<string>(),
      operations: new Set<string>(),
    };

    errors.forEach(error => {
      // Contar por tipo
      stats.byType[error.productErrorCode] = (stats.byType[error.productErrorCode] || 0) + 1;
      
      // Contar reintentables
      if (error.retryable) {
        stats.retryable++;
      }
      
      // Productos afectados
      error.affectedProducts?.forEach(productId => {
        stats.affectedProducts.add(productId);
      });
      
      // Operaciones
      if (error.operation) {
        stats.operations.add(error.operation);
      }
    });

    return {
      ...stats,
      affectedProducts: Array.from(stats.affectedProducts),
      operations: Array.from(stats.operations),
    };
  },

  /**
   * Crea un resumen de errores para logging
   */
  createErrorSummary: (errors: ProductError[]): string => {
    const stats = productErrorUtils.getErrorStats(errors);
    
    return `
Error Summary:
- Total errors: ${stats.total}
- Retryable errors: ${stats.retryable}
- Affected products: ${stats.affectedProducts.length}
- Operations with errors: ${stats.operations.length}
- Error types: ${Object.keys(stats.byType).join(', ')}
    `.trim();
  },
};

// Hook específico para manejo de errores de productos
export const useProductErrorHandler = () => {
  const handleProductError = (error: unknown, context?: string): ProductError => {
    if (error instanceof ProductError) {
      return error;
    }

    // Convertir errores genéricos a ProductError
    if (error instanceof NotificationError) {
      return new ProductError(
        error.message,
        PRODUCT_ERROR_CODES.INVALID_HOOK_STATE,
        error.type,
        {
          context: { originalError: error.toJSON(), context },
          retryable: error.retryable,
        }
      );
    }

    if (error instanceof Error) {
      return new ProductError(
        error.message,
        PRODUCT_ERROR_CODES.INVALID_HOOK_STATE,
        ErrorType.CLIENT,
        {
          context: { originalError: error.message, context },
          cause: error,
          retryable: false,
        }
      );
    }

    return new ProductError(
      'Error desconocido en operación de productos',
      PRODUCT_ERROR_CODES.INVALID_HOOK_STATE,
      ErrorType.UNKNOWN,
      {
        context: { originalError: error, context },
        retryable: false,
      }
    );
  };

  return {
    handleProductError,
    createProductError,
    productErrorUtils,
    PRODUCT_ERROR_CODES,
  };
};