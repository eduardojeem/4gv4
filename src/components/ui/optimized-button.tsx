'use client'

import React, { forwardRef, useState, useCallback } from 'react'
import { Loader2, Check, AlertTriangle, Info } from 'lucide-react'
import { Button, ButtonProps } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useButtonNotifications, NotificationOptions } from '@/hooks/use-optimized-notifications'

export interface OptimizedButtonProps extends Omit<ButtonProps, 'onClick'> {
  // Configuración de notificaciones
  notificationMessages?: {
    loading?: string
    success?: string | ((data: any) => string)
    error?: string | ((error: any) => string)
  }
  notificationOptions?: NotificationOptions
  
  // Configuración de comportamiento
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void | Promise<void>
  onAsyncClick?: () => Promise<any>
  preventDoubleClick?: boolean
  showLoadingState?: boolean
  showSuccessState?: boolean
  showErrorState?: boolean
  successStateDuration?: number
  notificationDuration?: number
  
  // Configuración de caché y rendimiento
  enableCache?: boolean
  cacheDuration?: number
  optimizePerformance?: boolean
  
  // Configuración visual
  loadingIcon?: React.ReactNode
  successIcon?: React.ReactNode
  errorIcon?: React.ReactNode
  
  // Estados personalizados
  isProcessing?: boolean
  processingText?: string
  
  // Identificador único para el botón
  buttonId?: string
  
  // Configuración de accesibilidad
  ariaLabel?: string
  ariaDescription?: string
}

export type ButtonState = 'idle' | 'loading' | 'success' | 'error'

export const OptimizedButton = forwardRef<HTMLButtonElement, OptimizedButtonProps>(
  ({
    children,
    className,
    variant = 'default',
    size = 'default',
    disabled,
    onClick,
    onAsyncClick,
    notificationMessages,
    notificationOptions,
    preventDoubleClick = true,
    showLoadingState = true,
    showSuccessState = true,
    successStateDuration = 2000,
    notificationDuration = 3000,
    enableCache = false,
    cacheDuration = 5000,
    optimizePerformance = true,
    loadingIcon,
    successIcon,
    errorIcon,
    isProcessing = false,
    processingText,
    buttonId,
    ariaLabel,
    ariaDescription,
    ...props
  }, ref) => {
    const [buttonState, setButtonState] = useState<ButtonState>('idle')
    const [isClicked, setIsClicked] = useState(false)
    
    const {
      buttonState: hookButtonState,
      executeAction,
      quickNotify,
      clearButtonCache,
      getPerformanceStats,
      isLoading: hookIsLoading,
      status,
      message
    } = useButtonNotifications(buttonId || 'optimized-button')

    // Iconos por defecto
    const defaultLoadingIcon = <Loader2 className="h-4 w-4 animate-spin" />
    const defaultSuccessIcon = <Check className="h-4 w-4" />
    const defaultErrorIcon = <AlertTriangle className="h-4 w-4" />

    // Determinar el icono actual
    const getCurrentIcon = useCallback(() => {
      switch (buttonState) {
        case 'loading':
          return loadingIcon || defaultLoadingIcon
        case 'success':
          return successIcon || defaultSuccessIcon
        case 'error':
          return errorIcon || defaultErrorIcon
        default:
          return null
      }
    }, [buttonState, loadingIcon, successIcon, errorIcon])

    // Determinar el texto actual
    const getCurrentText = useCallback(() => {
      if (isProcessing && processingText) {
        return processingText
      }
      
      switch (buttonState) {
        case 'loading':
          return notificationMessages?.loading || 'Procesando...'
        case 'success':
          return 'Completado'
        case 'error':
          return 'Error'
        default:
          return children
      }
    }, [buttonState, isProcessing, processingText, notificationMessages, children])

    // Manejar click del botón
    const handleClick = useCallback(async (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault()
      
      // Prevenir doble click
      if (hookIsLoading || isClicked) {
        return
      }

      setIsClicked(true)
      
      try {
        if (onAsyncClick) {
          await executeAction(
            onAsyncClick,
            notificationMessages,
            {
              duration: 3000,
              dismissible: true,
              important: true,
              useCache: true,
              cacheTTL: 5000,
              optimizeStateUpdates: true
            }
          )
        } else if (onClick) {
          onClick(event)
          if (notificationMessages?.success) {
            quickNotify('success', notificationMessages.success as string, {
              batchKey: `click-${buttonId}`,
              useDebounce: false
            })
          }
        }
      } catch (error) {
        console.error('Button action failed:', error)
      } finally {
        // Reset click state after a delay
        setTimeout(() => setIsClicked(false), 1000)
      }
    }, [
      hookIsLoading,
      isClicked,
      onAsyncClick,
      onClick,
      executeAction,
      quickNotify,
      notificationMessages,
      buttonId
    ])

    // Determinar el estado actual del botón
    const currentState = disabled ? 'disabled' : status
    const isCurrentlyLoading = hookIsLoading || isClicked
    const currentIcon = getCurrentIcon(currentState, isCurrentlyLoading)
    const currentMessage = message

    // Determinar si el botón está deshabilitado
    const isDisabled = disabled || hookButtonState === 'loading' || isProcessing || (preventDoubleClick && isClicked)

    // Clases CSS dinámicas
    const buttonClasses = cn(
      'relative transition-all duration-200',
      {
        'cursor-not-allowed opacity-60': isDisabled,
        'bg-green-600 hover:bg-green-700 border-green-600': buttonState === 'success' && variant === 'default',
        'bg-red-600 hover:bg-red-700 border-red-600': buttonState === 'error' && variant === 'default',
        'animate-pulse': buttonState === 'loading',
        'scale-95': isClicked && !isDisabled,
      },
      className
    )

    // Props de accesibilidad
    const accessibilityProps = {
      'aria-label': ariaLabel || (typeof children === 'string' ? children : 'Botón'),
      'aria-description': ariaDescription,
      'aria-busy': buttonState === 'loading' || isProcessing,
      'aria-disabled': isDisabled,
      'data-state': buttonState,
    }

    return (
      <Button
        ref={ref}
        className={buttonClasses}
        variant={variant}
        size={size}
        disabled={isDisabled}
        onClick={handleClick}
        {...accessibilityProps}
        {...props}
      >
        <span className="flex items-center gap-2">
          {getCurrentIcon() && (
            <span className="flex-shrink-0">
              {getCurrentIcon()}
            </span>
          )}
          <span className={cn(
            'transition-opacity duration-200',
            buttonState === 'loading' && 'opacity-80'
          )}>
            {getCurrentText()}
          </span>
        </span>
      </Button>
    )
  }
)

OptimizedButton.displayName = 'OptimizedButton'

// Componente de conveniencia para acciones de confirmación
export interface ConfirmationButtonProps extends OptimizedButtonProps {
  confirmationMessage?: string
  confirmationTitle?: string
  requireConfirmation?: boolean
}

export const ConfirmationButton = forwardRef<HTMLButtonElement, ConfirmationButtonProps>(
  ({
    confirmationMessage = '¿Estás seguro de que quieres realizar esta acción?',
    confirmationTitle = 'Confirmar acción',
    requireConfirmation = true,
    onAsyncClick,
    onClick,
    ...props
  }, ref) => {
    const notifications = useButtonNotifications(props.buttonId || 'confirmation-button')

    const handleConfirmationClick = useCallback(async () => {
      if (!requireConfirmation) {
        if (onAsyncClick) {
          return await onAsyncClick()
        }
        return
      }

      return new Promise<void>((resolve, reject) => {
        notifications.notifyWithConfirmation(
          confirmationMessage,
          async () => {
            try {
              if (onAsyncClick) {
                await onAsyncClick()
              }
              resolve()
            } catch (error) {
              reject(error)
            }
          }
        )
      })
    }, [requireConfirmation, confirmationMessage, onAsyncClick, notifications])

    return (
      <OptimizedButton
        ref={ref}
        {...props}
        onAsyncClick={handleConfirmationClick}
        onClick={onClick}
      />
    )
  }
)

ConfirmationButton.displayName = 'ConfirmationButton'