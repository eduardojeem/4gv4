'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { 
  notificationCache, 
  useCachedOperation, 
  createCacheKey, 
  CACHE_TTL 
} from '@/lib/notification-cache'
import { 
  useDebounce, 
  useThrottle, 
  measurePerformance, 
  notificationQueue, 
  notificationBatcher, 
  PERFORMANCE_CONFIG 
} from '@/lib/notification-performance'
import {
  useErrorHandler,
  ErrorClassifier,
  ErrorMessageGenerator,
  globalRetryHandler,
  NotificationError,
  ErrorType,
  createError
} from '@/lib/error-handling'

export type NotificationVariant = 'success' | 'error' | 'warning' | 'info' | 'loading'

export interface NotificationOptions {
  title?: string
  description?: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
  dismissible?: boolean
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center'
  icon?: React.ReactNode
  className?: string
  style?: React.CSSProperties
  onDismiss?: () => void
  onAutoClose?: () => void
  richColors?: boolean
  closeButton?: boolean
  important?: boolean
  cancel?: {
    label: string
    onClick: () => void
  }
  promise?: Promise<any>
  loading?: string
  success?: string | ((data: any) => string)
  error?: string | ((error: any) => string)
}

export interface ButtonNotificationState {
  isLoading: boolean
  lastNotificationId: string | number | null
  pendingActions: Set<string>
}

export interface ButtonState {
  status: 'idle' | 'loading' | 'success' | 'error'
  message: string | null
  isLoading: boolean
}

export function useOptimizedNotifications() {
  const [state, setState] = useState<ButtonNotificationState>({
    isLoading: false,
    lastNotificationId: null,
    pendingActions: new Set()
  })

  
  const timeoutRef = useRef<NodeJS.Timeout>(undefined)
  
  // Función principal para mostrar notificaciones optimizadas
  const showNotification = useCallback((
    variant: NotificationVariant,
    message: string,
    options: NotificationOptions = {}
  ) => {
    const {
      title,
      description,
      duration = variant === 'error' ? 6000 : 4000,
      action,
      dismissible = true,
      icon,
      className,
      onDismiss,
      onAutoClose,
      richColors = true,
      closeButton = true,
      important = false,
      cancel
    } = options

    const notificationFn = () => {
      let toastId: string | number

      const toastOptions = {
        description: description || title,
        duration: important ? 8000 : duration,
        dismissible,
        className,
        onDismiss,
        onAutoClose,
        richColors,
        closeButton,
        action: action ? {
          label: action.label,
          onClick: action.onClick
        } : undefined,
        cancel: cancel ? {
          label: cancel.label,
          onClick: cancel.onClick
        } : undefined,
        icon
      }

      switch (variant) {
        case 'success':
          toastId = toast.success(message, toastOptions)
          break
        case 'error':
          toastId = toast.error(message, toastOptions)
          break
        case 'warning':
          toastId = toast.warning(message, toastOptions)
          break
        case 'info':
          toastId = toast.info(message, toastOptions)
          break
        case 'loading':
          toastId = toast.loading(message, toastOptions)
          break
        default:
          toastId = toast(message, toastOptions)
      }

      setState(prev => ({
        ...prev,
        lastNotificationId: toastId
      }))

      return toastId
    }

    // Agregar a la cola global o procesar inmediatamente
    if (important) {
      return notificationFn()
    } else {
      notificationQueue.enqueue(notificationFn)
    }
  }, [])

  // Notificación para acciones de botones con loading state
  const notifyButtonAction = useCallback(async <T>(
    buttonId: string,
    action: () => Promise<T>,
    messages: {
      loading?: string
      success?: string | ((data: T) => string)
      error?: string | ((error: Error) => string)
    },
    options: NotificationOptions & { 
      useCache?: boolean
      cacheTTL?: number
      cacheKey?: string
    } = {}
  ): Promise<T> => {
    const toastId = `${buttonId}-${Date.now()}`
    const cacheKey = options.cacheKey || createCacheKey('button-action', buttonId)
    
    try {
      // Verificar caché si está habilitado
      if (options.useCache) {
        const cached = notificationCache.get<T>(cacheKey)
        if (cached !== null) {
          // Mostrar notificación de éxito inmediata desde caché
          if (messages.success) {
            const successMessage = typeof messages.success === 'function' 
              ? messages.success(cached) 
              : messages.success
            
            notificationQueue.enqueue(() => {
              showNotification('success', `${successMessage} (caché)`, { 
                duration: options.duration || 2000,
                ...options 
              })
            })
          }
          return cached
        }
      }

      // Mostrar notificación de carga con debounce para evitar spam
      if (messages.loading) {
        notificationBatcher.batch(`loading-${buttonId}`, () => {
          showNotification('loading', messages.loading!, { 
            duration: Infinity,
            ...options 
          })
        })
      }

      // Ejecutar acción con medición de performance
      const result = await measurePerformance(action, `Button Action: ${buttonId}`)

      // Guardar en caché si está habilitado
      if (options.useCache && result) {
        notificationCache.set(cacheKey, result, options.cacheTTL || CACHE_TTL.USER_ACTIONS)
      }

      // Mostrar notificación de éxito
      if (messages.success) {
        const successMessage = typeof messages.success === 'function' 
          ? messages.success(result) 
          : messages.success
        
        notificationQueue.enqueue(() => {
          showNotification('success', successMessage, { 
            duration: options.duration || 3000,
            ...options 
          })
        })
      }

      return result
    } catch (error) {
      // Mostrar notificación de error
      if (messages.error) {
        const errorMessage = typeof messages.error === 'function' 
          ? messages.error(error as Error) 
          : messages.error
        
        notificationQueue.enqueue(() => {
          showNotification('error', errorMessage, { 
            duration: options.duration || 5000,
            ...options 
          })
        })
      }

      throw error
    }
  }, [showNotification])

  // Crear versión con debounce para acciones rápidas
  const debouncedNotify = useDebounce(showNotification, PERFORMANCE_CONFIG.DEBOUNCE_DELAYS.VALIDATION)

  // Notificación rápida para acciones inmediatas
  const notifyQuickAction = useCallback((
    variant: NotificationVariant,
    message: string,
    options: NotificationOptions & { 
      useDebounce?: boolean
      batchKey?: string 
    } = {}
  ) => {
    const notificationFn = () => {
      showNotification(variant, message, {
        duration: 2000,
        important: false,
        ...options
      })
    }

    if (options.useDebounce) {
      debouncedNotify(variant, message, options)
    } else if (options.batchKey) {
      notificationBatcher.batch(options.batchKey, notificationFn)
    } else {
      notificationQueue.enqueue(notificationFn)
    }
  }, [showNotification, debouncedNotify])

  // Notificación con confirmación
  const notifyWithConfirmation = useCallback((
    message: string,
    onConfirm: () => void | Promise<void>,
    options: NotificationOptions = {}
  ) => {
    return showNotification('warning', message, {
      ...options,
      duration: Infinity,
      action: {
        label: options.action?.label || 'Confirmar',
        onClick: async () => {
          try {
            await onConfirm()
          } catch (error) {
            showNotification('error', 'Error al ejecutar la acción', { important: true })
          }
        }
      },
      cancel: {
        label: options.cancel?.label || 'Cancelar',
        onClick: () => {
          // Toast se cierra automáticamente
        }
      }
    })
  }, [showNotification])

  // Limpiar notificaciones
  const clearNotifications = useCallback(() => {
    toast.dismiss()
    setState(prev => ({
      ...prev,
      lastNotificationId: null
    }))
  }, [])

  // Limpiar timeouts al desmontar
  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
  }, [])

  return {
    // Estado
    isLoading: state.isLoading,
    hasPendingActions: state.pendingActions.size > 0,
    pendingActionsCount: state.pendingActions.size,
    
    // Métodos principales
    showNotification,
    notifyButtonAction,
    notifyQuickAction,
    notifyWithConfirmation,
    clearNotifications,
    cleanup,
    
    // Métodos de conveniencia
    success: (message: string, options?: NotificationOptions) => 
      showNotification('success', message, options),
    error: (message: string, options?: NotificationOptions) => 
      showNotification('error', message, options),
    warning: (message: string, options?: NotificationOptions) => 
      showNotification('warning', message, options),
    info: (message: string, options?: NotificationOptions) => 
      showNotification('info', message, options),
    loading: (message: string, options?: NotificationOptions) => 
      showNotification('loading', message, options),
  }
}

// Hook para botones específicos con estados optimizados
export function useButtonNotifications(buttonId: string) {
  const { notifyButtonAction, notifyQuickAction, notifyWithConfirmation } = useOptimizedNotifications()
  const [buttonState, setButtonState] = useState<ButtonState>({
    status: 'idle',
    message: null,
    isLoading: false
  })

  // Integrar manejo de errores
  const { handleError, handleAsyncError } = useErrorHandler()

  // Throttle state updates para evitar renders excesivos
  const throttledSetState = useThrottle(setButtonState, PERFORMANCE_CONFIG.THROTTLE_DELAYS.RESIZE)

  const executeAction = useCallback(async <T>(
    action: () => Promise<T>,
    messages: {
      loading?: string
      success?: string | ((data: T) => string)
      error?: string | ((error: Error) => string)
    },
    options: NotificationOptions & {
      useCache?: boolean
      cacheTTL?: number
      optimizeStateUpdates?: boolean
    } = {}
  ): Promise<T> => {
    const updateState = options.optimizeStateUpdates ? throttledSetState : setButtonState

    updateState({
      status: 'loading',
      message: messages.loading || 'Procesando...',
      isLoading: true
    })

    try {
      // Ejecutar acción con manejo de errores y reintentos
      const result = await handleAsyncError(
        () => notifyButtonAction(buttonId, action, messages, {
          useCache: options.useCache,
          cacheTTL: options.cacheTTL,
          cacheKey: createCacheKey('button-state', buttonId),
          ...options
        }),
        `ejecutar acción del botón ${buttonId}`
      )
      
      updateState({
        status: 'success',
        message: typeof messages.success === 'function' 
          ? messages.success(result) 
          : messages.success || 'Completado',
        isLoading: false
      })

      // Reset to idle after success display con debounce
      setTimeout(() => {
        updateState({
          status: 'idle',
          message: null,
          isLoading: false
        })
      }, 2000)

      return result
    } catch (error) {
      // Clasificar y manejar el error
      const notificationError = error instanceof NotificationError ? error : ErrorClassifier.classify(error)
      
      // Generar mensaje de error contextual
      const errorMessage = typeof messages.error === 'function' 
        ? messages.error(notificationError) 
        : messages.error || ErrorMessageGenerator.generateWithContext(notificationError, `ejecutar acción del botón ${buttonId}`)

      updateState({
        status: 'error',
        message: errorMessage,
        isLoading: false
      })

      // Reset to idle after error display
      setTimeout(() => {
        updateState({
          status: 'idle',
          message: null,
          isLoading: false
        })
      }, 3000)

      throw notificationError
    }
  }, [buttonId, notifyButtonAction, throttledSetState, handleAsyncError])

  const quickNotify = useCallback((
    variant: NotificationVariant,
    message: string,
    options: NotificationOptions & {
      useDebounce?: boolean
      batchKey?: string
    } = {}
  ) => {
    notifyQuickAction(variant, message, {
      batchKey: options.batchKey || `quick-${buttonId}`,
      ...options
    })
    
    setButtonState({
      status: variant === 'success' ? 'success' : variant === 'error' ? 'error' : 'idle',
      message,
      isLoading: false
    })

    // Reset after display
    setTimeout(() => {
      setButtonState({
        status: 'idle',
        message: null,
        isLoading: false
      })
    }, 2000)
  }, [buttonId, notifyQuickAction])

  const confirmAction = useCallback(<T>(
    action: () => Promise<T>,
    confirmationConfig: {
      title: string
      description: string
      confirmText?: string
      cancelText?: string
    },
    messages: {
      loading?: string
      success?: string | ((data: T) => string)
      error?: string | ((error: Error) => string)
    },
    options: NotificationOptions = {}
  ) => {
    return notifyWithConfirmation(
      confirmationConfig.description || confirmationConfig.title,
      async () => {
        await executeAction(action, messages, options)
      },
      {
        ...options,
        action: {
          label: confirmationConfig.confirmText || 'Confirmar',
          onClick: () => {}
        },
        cancel: {
          label: confirmationConfig.cancelText || 'Cancelar',
          onClick: () => {}
        }
      }
    )
  }, [notifyWithConfirmation, executeAction])

  // Función para limpiar caché específico del botón
  const clearButtonCache = useCallback(() => {
    const cacheKey = createCacheKey('button-state', buttonId)
    notificationCache.delete(cacheKey)
  }, [buttonId])

  // Función para obtener estadísticas de performance
  const getPerformanceStats = useCallback(() => {
    return {
      cacheStats: notificationCache.getStats(),
      queueSize: notificationQueue.size()
    }
  }, [])

  return {
    buttonState,
    executeAction,
    quickNotify,
    confirmAction,
    clearButtonCache,
    getPerformanceStats,
    isLoading: buttonState.isLoading,
    status: buttonState.status,
    message: buttonState.message
  }
}