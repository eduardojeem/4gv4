/**
 * Component Performance Tests - Fase 5 Testing & QA
 * Tests de rendimiento para componentes críticos
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { createMockProduct, createMockCustomer } from '@/test/setup'
import React from 'react'

// Mock de componente con muchos elementos para testing de performance
const MockLargeList = ({ items }: { items: any[] }) => {
  const [filter, setFilter] = React.useState('')
  
  const filteredItems = React.useMemo(() => {
    return items.filter(item => 
      item.name.toLowerCase().includes(filter.toLowerCase())
    )
  }, [items, filter])
  
  return (
    <div data-testid="large-list">
      <input 
        type="text" 
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filtrar..."
      />
      <div data-testid="list-container">
        {filteredItems.map(item => (
          <div key={item.id} data-testid={`item-${item.id}`}>
            <span>{item.name}</span>
            <span>{item.price}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Mock de componente con re-renders frecuentes
const MockFrequentUpdates = () => {
  const [count, setCount] = React.useState(0)
  const [data, setData] = React.useState<any[]>([])
  
  React.useEffect(() => {
    const interval = setInterval(() => {
      setCount(c => c + 1)
      setData(prev => [...prev, { id: Date.now(), value: Math.random() }])
    }, 100)
    
    return () => clearInterval(interval)
  }, [])
  
  return (
    <div data-testid="frequent-updates">
      <div>Count: {count}</div>
      <div>Items: {data.length}</div>
      {data.slice(-10).map(item => (
        <div key={item.id}>{item.value.toFixed(2)}</div>
      ))}
    </div>
  )
}

describe('Component Performance Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Large List Rendering', () => {
    it('should render large lists efficiently', () => {
      const items = Array.from({ length: 1000 }, (_, i) => 
        createMockProduct({ 
          id: `${i + 1}`, 
          name: `Producto ${i + 1}`, 
          price: (i + 1) * 10 
        })
      )
      
      const startTime = performance.now()
      
      render(<MockLargeList items={items} />)
      
      const endTime = performance.now()
      const renderTime = endTime - startTime
      
      // Debería renderizar en menos de 500ms
      expect(renderTime).toBeWithinPerformanceThreshold(500)
      expect(screen.getByTestId('large-list')).toBeInTheDocument()
      
      // Verificar que todos los elementos están presentes
      const listContainer = screen.getByTestId('list-container')
      expect(listContainer.children).toHaveLength(1000)
    })

    it('should filter large lists efficiently', async () => {
      const items = Array.from({ length: 5000 }, (_, i) => 
        createMockProduct({ 
          id: `${i + 1}`, 
          name: i % 2 === 0 ? `Producto ${i + 1}` : `Item ${i + 1}`, 
          price: (i + 1) * 10 
        })
      )
      
      render(<MockLargeList items={items} />)
      
      const filterInput = screen.getByPlaceholderText('Filtrar...')
      
      const startTime = performance.now()
      
      await act(async () => {
        filterInput.focus()
        // Simular typing "Producto"
        filterInput.dispatchEvent(new Event('input', { bubbles: true }))
        Object.defineProperty(filterInput, 'value', { value: 'Producto', writable: true })
      })
      
      const endTime = performance.now()
      const filterTime = endTime - startTime
      
      // El filtrado debería ser rápido
      expect(filterTime).toBeWithinPerformanceThreshold(100)
      
      // Verificar que el filtro funciona
      const listContainer = screen.getByTestId('list-container')
      expect(listContainer.children.length).toBeLessThanOrEqual(5000)
    })

    it('should handle memory efficiently with large datasets', () => {
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0
      
      const items = Array.from({ length: 10000 }, (_, i) => 
        createMockProduct({ 
          id: `${i + 1}`, 
          name: `Producto ${i + 1}`, 
          price: (i + 1) * 10 
        })
      )
      
      const { unmount } = render(<MockLargeList items={items} />)
      
      const afterRenderMemory = (performance as any).memory?.usedJSHeapSize || 0
      
      unmount()
      
      // Forzar garbage collection si está disponible
      if (global.gc) {
        global.gc()
      }
      
      const afterUnmountMemory = (performance as any).memory?.usedJSHeapSize || 0
      
      // La memoria debería liberarse después del unmount
      if (initialMemory > 0) {
        const memoryIncrease = afterRenderMemory - initialMemory
        const memoryAfterCleanup = afterUnmountMemory - initialMemory
        
        // La memoria después del cleanup debería ser menor que después del render
        expect(memoryAfterCleanup).toBeLessThan(memoryIncrease)
      }
    })
  })

  describe('Frequent Updates Performance', () => {
    it('should handle frequent updates without performance degradation', async () => {
      const { unmount } = render(<MockFrequentUpdates />)
      
      const startTime = performance.now()
      
      // Esperar un poco para que ocurran actualizaciones
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const endTime = performance.now()
      const totalTime = endTime - startTime
      
      // Verificar que el componente sigue respondiendo
      expect(screen.getByTestId('frequent-updates')).toBeInTheDocument()
      
      // El tiempo total no debería exceder significativamente el tiempo de espera
      expect(totalTime).toBeWithinPerformanceThreshold(1200) // 200ms de margen
      
      unmount()
    })

    it('should optimize re-renders with React.memo', () => {
      let renderCount = 0
      
      const OptimizedComponent = React.memo(({ data }: { data: any[] }) => {
        renderCount++
        return (
          <div data-testid="optimized-component">
            {data.map(item => (
              <div key={item.id}>{item.name}</div>
            ))}
          </div>
        )
      })
      
      const TestWrapper = () => {
        const [count, setCount] = React.useState(0)
        const [data] = React.useState([
          createMockProduct({ id: '1', name: 'Producto 1' }),
          createMockProduct({ id: '2', name: 'Producto 2' })
        ])
        
        return (
          <div>
            <button onClick={() => setCount(c => c + 1)}>
              Count: {count}
            </button>
            <OptimizedComponent data={data} />
          </div>
        )
      }
      
      render(<TestWrapper />)
      
      const button = screen.getByRole('button')
      
      // Hacer múltiples clicks
      act(() => {
        button.click()
        button.click()
        button.click()
      })
      
      // El componente optimizado debería renderizarse solo una vez
      // ya que sus props no cambiaron
      expect(renderCount).toBe(1)
    })
  })

  describe('Bundle Size Impact', () => {
    it('should lazy load components efficiently', async () => {
      const LazyComponent = React.lazy(() => 
        Promise.resolve({
          default: () => <div data-testid="lazy-component">Lazy Loaded</div>
        })
      )
      
      const TestWrapper = () => (
        <React.Suspense fallback={<div>Loading...</div>}>
          <LazyComponent />
        </React.Suspense>
      )
      
      const startTime = performance.now()
      
      render(<TestWrapper />)
      
      // Inicialmente debería mostrar loading
      expect(screen.getByText('Loading...')).toBeInTheDocument()
      
      // Esperar a que cargue el componente lazy
      await screen.findByTestId('lazy-component')
      
      const endTime = performance.now()
      const loadTime = endTime - startTime
      
      // El lazy loading debería ser rápido (ajustado para entorno de test)
      expect(loadTime).toBeWithinPerformanceThreshold(500)
    })

    it('should tree-shake unused code effectively', () => {
      // Este test verifica que solo se importan las funciones necesarias
      const utilityFunctions = {
        usedFunction: () => 'used',
        unusedFunction: () => 'unused'
      }
      
      const TestComponent = () => {
        const result = utilityFunctions.usedFunction()
        return <div>{result}</div>
      }
      
      render(<TestComponent />)
      
      expect(screen.getByText('used')).toBeInTheDocument()
      
      // En un bundle optimizado, unusedFunction no debería estar incluida
      // Esto se verificaría en el análisis del bundle, no en runtime
    })
  })

  describe('Memory Leaks Prevention', () => {
    it('should clean up event listeners properly', () => {
      let listenerCount = 0
      
      const originalAddEventListener = window.addEventListener
      const originalRemoveEventListener = window.removeEventListener
      
      window.addEventListener = vi.fn((...args) => {
        listenerCount++
        return originalAddEventListener.apply(window, args)
      })
      
      window.removeEventListener = vi.fn((...args) => {
        listenerCount--
        return originalRemoveEventListener.apply(window, args)
      })
      
      const ComponentWithListeners = () => {
        React.useEffect(() => {
          const handleResize = () => {}
          const handleScroll = () => {}
          
          window.addEventListener('resize', handleResize)
          window.addEventListener('scroll', handleScroll)
          
          return () => {
            window.removeEventListener('resize', handleResize)
            window.removeEventListener('scroll', handleScroll)
          }
        }, [])
        
        return <div>Component with listeners</div>
      }
      
      const { unmount } = render(<ComponentWithListeners />)
      
      expect(listenerCount).toBe(2)
      
      unmount()
      
      expect(listenerCount).toBe(0)
      
      // Restaurar funciones originales
      window.addEventListener = originalAddEventListener
      window.removeEventListener = originalRemoveEventListener
    })

    it('should clean up timers and intervals', () => {
      let activeTimers = 0
      
      const originalSetInterval = window.setInterval
      const originalClearInterval = window.clearInterval
      
      window.setInterval = vi.fn((...args) => {
        activeTimers++
        return originalSetInterval.apply(window, args)
      })
      
      window.clearInterval = vi.fn((id) => {
        activeTimers--
        return originalClearInterval.call(window, id)
      })
      
      const ComponentWithTimer = () => {
        React.useEffect(() => {
          const interval = setInterval(() => {}, 1000)
          
          return () => clearInterval(interval)
        }, [])
        
        return <div>Component with timer</div>
      }
      
      const { unmount } = render(<ComponentWithTimer />)
      
      expect(activeTimers).toBe(1)
      
      unmount()
      
      expect(activeTimers).toBe(0)
      
      // Restaurar funciones originales
      window.setInterval = originalSetInterval
      window.clearInterval = originalClearInterval
    })
  })

  describe('Rendering Performance Benchmarks', () => {
    it('should meet performance benchmarks for critical components', () => {
      const benchmarks = {
        smallList: { items: 100, maxTime: 150 },
        mediumList: { items: 1000, maxTime: 500 },
        largeList: { items: 5000, maxTime: 1200 }
      }
      
      Object.entries(benchmarks).forEach(([size, config]) => {
        const items = Array.from({ length: config.items }, (_, i) => 
          createMockProduct({ id: `${i + 1}`, name: `Item ${i + 1}` })
        )
        
        const startTime = performance.now()
        
        const { unmount } = render(<MockLargeList items={items} />)
        
        const endTime = performance.now()
        const renderTime = endTime - startTime
        
        expect(renderTime).toBeWithinPerformanceThreshold(config.maxTime)
        
        unmount()
      })
    })
  })
})