import { useEffect, useRef } from 'react'
import { trackRender, getRenderCount } from '@/lib/performance'

/**
 * Hook para trackear renders de un componente
 * 
 * @param componentName - Nombre del componente a trackear
 * @param logThreshold - Número de renders después del cual se logea (default: 10)
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   useRenderTracker('MyComponent')
 *   // ... resto del componente
 * }
 * ```
 */
export function useRenderTracker(
  componentName: string,
  logThreshold: number = 10
): void {
  const renderCount = useRef(0)

  useEffect(() => {
    renderCount.current += 1
    trackRender(componentName)

    const totalCount = getRenderCount(componentName)

    // Log cada N renders
    if (totalCount % logThreshold === 0 && process.env.NODE_ENV === 'development') {
      console.log(
        `🔄 ${componentName} ha renderizado ${totalCount} veces`,
        `(${renderCount.current} en esta instancia)`
      )
    }
  })
}

/**
 * Hook para medir el tiempo de renderizado de un componente
 * 
 * @param componentName - Nombre del componente
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   useRenderTime('MyComponent')
 *   // ... resto del componente
 * }
 * ```
 */
export function useRenderTime(componentName: string): void {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') trackRender(`${componentName}:committed`)
  }, [componentName])
}
