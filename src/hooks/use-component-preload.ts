/**
 * Hook para precargar componentes dinámicos
 * Mejora la experiencia de usuario al anticipar la carga de componentes
 */

import { useEffect, useRef } from 'react'

type PreloadFunction = () => Promise<any>

interface PreloadConfig {
  [key: string]: PreloadFunction
}

/**
 * Hook que precarga componentes cuando el usuario interactúa con elementos relacionados
 * 
 * @example
 * const preloadKanban = useComponentPreload({
 *   kanban: () => import('@/components/dashboard/repairs/RepairKanban')
 * })
 * 
 * // Precargar al hacer hover sobre el botón
 * <Button onMouseEnter={() => preloadKanban('kanban')}>
 *   Vista Kanban
 * </Button>
 */
export function useComponentPreload(config: PreloadConfig) {
  const preloadedRef = useRef<Set<string>>(new Set())

  const preload = (key: string) => {
    // Solo precargar una vez
    if (preloadedRef.current.has(key)) {
      return
    }

    const preloadFn = config[key]
    if (preloadFn) {
      preloadedRef.current.add(key)
      preloadFn().catch((error) => {
        console.warn(`Failed to preload component: ${key}`, error)
        // Permitir reintentar en caso de error
        preloadedRef.current.delete(key)
      })
    }
  }

  return preload
}

/**
 * Hook que precarga componentes automáticamente después de un delay
 * Útil para precargar componentes que probablemente se usarán pronto
 * 
 * @example
 * useAutoPreload({
 *   kanban: () => import('@/components/dashboard/repairs/RepairKanban')
 * }, 2000) // Precargar después de 2 segundos
 */
export function useAutoPreload(config: PreloadConfig, delay: number = 2000) {
  useEffect(() => {
    const timer = setTimeout(() => {
      Object.entries(config).forEach(([key, preloadFn]) => {
        preloadFn().catch((error) => {
          console.warn(`Failed to auto-preload component: ${key}`, error)
        })
      })
    }, delay)

    return () => clearTimeout(timer)
  }, [config, delay])
}

/**
 * Hook que precarga componentes cuando están cerca del viewport
 * Usa Intersection Observer para detectar cuando el usuario se acerca
 * 
 * @example
 * const ref = useIntersectionPreload(() => 
 *   import('@/components/dashboard/repairs/RepairKanban')
 * )
* 
* <div ref={ref}>
*   // Componente se precargará cuando esté cerca del viewport
* </div>
 */
export function useIntersectionPreload(
  preloadFn: PreloadFunction,
  options?: IntersectionObserverInit
) {
  const ref = useRef<HTMLDivElement>(null)
  const preloadedRef = useRef(false)

  useEffect(() => {
    const element = ref.current
    if (!element || preloadedRef.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !preloadedRef.current) {
            preloadedRef.current = true
            preloadFn().catch((error) => {
              console.warn('Failed to preload component on intersection', error)
              preloadedRef.current = false
            })
          }
        })
      },
      {
        rootMargin: '50px', // Precargar 50px antes de que sea visible
        ...options,
      }
    )

    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [preloadFn, options])

  return ref
}
