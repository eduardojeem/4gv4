'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { 
  AlertTriangle, 
  RefreshCw, 
  Users, 
  Database, 
  Wifi, 
  Shield,
  ExternalLink 
} from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  context?: 'list' | 'modal' | 'filters' | 'analytics' | 'timeline' | 'notifications'
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorType: 'network' | 'data' | 'permission' | 'unknown'
}

export class CustomerErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      errorType: 'unknown'
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    const errorType = CustomerErrorBoundary.categorizeError(error)
    return { 
      hasError: true, 
      error,
      errorType
    }
  }

  static categorizeError(error: Error): 'network' | 'data' | 'permission' | 'unknown' {
    const message = error.message.toLowerCase()
    
    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      return 'network'
    }
    
    if (message.includes('permission') || message.includes('unauthorized') || message.includes('forbidden')) {
      return 'permission'
    }
    
    if (message.includes('data') || message.includes('parse') || message.includes('invalid')) {
      return 'data'
    }
    
    return 'unknown'
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('CustomerErrorBoundary caught an error:', error, errorInfo)
    
    this.setState({
      error,
      errorInfo,
      errorType: CustomerErrorBoundary.categorizeError(error)
    })

    // Call the onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // Log customer-specific error context
    this.logCustomerError(error, errorInfo)
  }

  logCustomerError = (error: Error, errorInfo: ErrorInfo) => {
    const errorData = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      context: this.props.context || 'unknown',
      errorType: this.state.errorType,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    }

    console.error('Customer module error logged:', errorData)
    
    // Here you would send to your error tracking service
    // Example: Sentry.captureException(error, { extra: errorData })
  }

  handleRetry = () => {
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null,
      errorType: 'unknown'
    })
  }

  handleRefreshData = () => {
    // Trigger a data refresh if possible
    window.location.reload()
  }

  getErrorIcon = () => {
    switch (this.state.errorType) {
      case 'network':
        return Wifi
      case 'data':
        return Database
      case 'permission':
        return Shield
      default:
        return AlertTriangle
    }
  }

  getErrorMessage = () => {
    switch (this.state.errorType) {
      case 'network':
        return {
          title: 'Error de conexión',
          description: 'No se pudo conectar con el servidor. Verifica tu conexión a internet.',
          action: 'Reintentar conexión'
        }
      case 'data':
        return {
          title: 'Error de datos',
          description: 'Los datos de clientes no se pudieron procesar correctamente.',
          action: 'Recargar datos'
        }
      case 'permission':
        return {
          title: 'Sin permisos',
          description: 'No tienes permisos para acceder a esta información de clientes.',
          action: 'Contactar administrador'
        }
      default:
        return {
          title: 'Error inesperado',
          description: 'Se produjo un error inesperado en el módulo de clientes.',
          action: 'Intentar de nuevo'
        }
    }
  }

  getContextualMessage = () => {
    switch (this.props.context) {
      case 'list':
        return 'Error al cargar la lista de clientes'
      case 'modal':
        return 'Error al mostrar los detalles del cliente'
      case 'filters':
        return 'Error en los filtros de búsqueda'
      case 'analytics':
        return 'Error al cargar las analíticas'
      case 'timeline':
        return 'Error al cargar el timeline de actividad'
      case 'notifications':
        return 'Error al cargar las notificaciones'
      default:
        return 'Error en el módulo de clientes'
    }
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback
      }

      const errorMessage = this.getErrorMessage()
      const ErrorIcon = this.getErrorIcon()

      // Compact error UI for smaller contexts
      if (this.props.context === 'modal' || this.props.context === 'filters') {
        return (
          <div className="p-6 text-center">
            <ErrorIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">{errorMessage.title}</h3>
            <p className="text-muted-foreground mb-4">{errorMessage.description}</p>
            <Button onClick={this.handleRetry} size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              {errorMessage.action}
            </Button>
          </div>
        )
      }

      // Full error UI for main contexts
      return (
        <div className="min-h-[300px] flex items-center justify-center p-4">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <ErrorIcon className="h-6 w-6" />
                {errorMessage.title}
              </CardTitle>
              <div className="flex gap-2">
                <Badge variant="outline">{this.getContextualMessage()}</Badge>
                <Badge variant="secondary">{this.state.errorType}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Módulo de Clientes</AlertTitle>
                <AlertDescription>
                  {errorMessage.description}
                </AlertDescription>
              </Alert>

              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="space-y-2">
                  <summary className="cursor-pointer text-sm font-semibold">
                    Detalles técnicos (desarrollo)
                  </summary>
                  <div className="bg-gray-100 p-3 rounded-md text-xs font-mono overflow-auto max-h-32">
                    <div className="text-red-600 font-semibold mb-1">
                      {this.state.error.message}
                    </div>
                    <div className="text-gray-600 whitespace-pre-wrap text-xs">
                      {this.state.error.stack?.slice(0, 500)}...
                    </div>
                  </div>
                </details>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={this.handleRetry} className="flex-1">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {errorMessage.action}
                </Button>
                
                {this.state.errorType === 'data' && (
                  <Button variant="outline" onClick={this.handleRefreshData} className="flex-1">
                    <Database className="h-4 w-4 mr-2" />
                    Recargar página
                  </Button>
                )}
                
                {this.state.errorType === 'permission' && (
                  <Button variant="outline" asChild className="flex-1">
                    <a href="/support" target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Soporte
                    </a>
                  </Button>
                )}
              </div>

              <div className="text-xs text-muted-foreground text-center">
                Error ID: {Date.now().toString(36)} • {new Date().toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

// Wrapper component for easier usage
export const withCustomerErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  context?: Props['context']
) => {
  const WrappedComponent = (props: P) => (
    <CustomerErrorBoundary context={context}>
      <Component {...props} />
    </CustomerErrorBoundary>
  )
  
  WrappedComponent.displayName = `withCustomerErrorBoundary(${Component.displayName || Component.name})`
  
  return WrappedComponent
}