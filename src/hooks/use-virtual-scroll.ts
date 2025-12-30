import { useState, useEffect, useMemo, useCallback } from 'react'

interface UseVirtualScrollOptions<T = unknown> {
  itemHeight: number
  containerHeight: number
  items: T[]
  overscan?: number
}

interface VirtualScrollResult<T = unknown> {
  virtualItems: Array<{
    index: number
    start: number
    end: number
    item: T
  }>
  totalHeight: number
  scrollToIndex: (index: number) => void
  containerProps: {
    style: React.CSSProperties
    onScroll: (e: React.UIEvent<HTMLDivElement>) => void
  }
  innerProps: {
    style: React.CSSProperties
  }
}

export function useVirtualScroll<T = unknown>({
  itemHeight,
  containerHeight,
  items,
  overscan = 5
}: UseVirtualScrollOptions<T>): VirtualScrollResult<T> {
  const [scrollTop, setScrollTop] = useState(0)
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null)

  const totalHeight = items.length * itemHeight

  const visibleRange = useMemo(() => {
    const start = Math.floor(scrollTop / itemHeight)
    const end = Math.min(
      start + Math.ceil(containerHeight / itemHeight),
      items.length - 1
    )

    return {
      start: Math.max(0, start - overscan),
      end: Math.min(items.length - 1, end + overscan)
    }
  }, [scrollTop, itemHeight, containerHeight, items.length, overscan])

  const virtualItems = useMemo(() => {
    const result = []
    for (let i = visibleRange.start; i <= visibleRange.end; i++) {
      result.push({
        index: i,
        start: i * itemHeight,
        end: (i + 1) * itemHeight,
        item: items[i]
      })
    }
    return result
  }, [visibleRange, itemHeight, items])

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  const scrollToIndex = useCallback((index: number) => {
    if (scrollElement) {
      const targetScrollTop = index * itemHeight
      scrollElement.scrollTo({
        top: targetScrollTop,
        behavior: 'smooth'
      })
    }
  }, [scrollElement, itemHeight])

  const containerProps = useMemo(() => ({
    style: {
      height: containerHeight,
      overflow: 'auto' as const,
      position: 'relative' as const
    },
    onScroll: handleScroll,
    ref: (el: HTMLDivElement | null) => setScrollElement(el)
  }), [containerHeight, handleScroll])

  const innerProps = useMemo(() => ({
    style: {
      height: totalHeight,
      position: 'relative' as const
    }
  }), [totalHeight])

  return {
    virtualItems,
    totalHeight,
    scrollToIndex,
    containerProps,
    innerProps
  }
}