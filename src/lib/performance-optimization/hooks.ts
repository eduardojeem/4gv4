import { useEffect, useRef } from 'react'

export function usePerformanceMark(name: string) {
  const label = useRef<string>(name)
  useEffect(() => {
    if (typeof performance !== 'undefined' && 'mark' in performance) {
      performance.mark(`${label.current}-start`)
    }
    return () => {
      if (typeof performance !== 'undefined' && 'mark' in performance) {
        performance.mark(`${label.current}-end`)
      }
      if (typeof performance !== 'undefined' && 'measure' in performance) {
        try {
          performance.measure(label.current, `${label.current}-start`, `${label.current}-end`)
        } catch {}
      }
    }
  }, [])
}

export function useMeasureRender(label: string) {
  useEffect(() => {
    const start = typeof performance !== 'undefined' ? performance.now() : Date.now()
    return () => {
      const end = typeof performance !== 'undefined' ? performance.now() : Date.now()
      const duration = end - start
      if (typeof console !== 'undefined') {
        console.debug(`[perf] ${label} render ${duration.toFixed(2)}ms`)
      }
    }
  }, [])
}
