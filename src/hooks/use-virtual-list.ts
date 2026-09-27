"use client"

import { useState, useMemo, useCallback } from 'react'

interface UseVirtualListProps<T> {
  items: T[]
  itemHeight: number
  containerHeight: number
  overscan?: number
  enabled?: boolean
}

interface VirtualListResult<T> {
  virtualItems: Array<{
    index: number
    item: T
    offsetTop: number
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

export function useVirtualList<T>({
  items,
  itemHeight,
  containerHeight,
  overscan = 5,
  enabled = true
}: UseVirtualListProps<T>): VirtualListResult<T> {
  const [scrollTop, setScrollTop] = useState(0)

  const totalHeight = items.length * itemHeight

  const virtualItems = useMemo(() => {
    if (!enabled) {
      // If virtualization is disabled, return all items
      return items.map((item, index) => ({
        index,
        item,
        offsetTop: index * itemHeight
      }))
    }

    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    )

    const virtualItems = []
    for (let i = startIndex; i <= endIndex; i++) {
      virtualItems.push({
        index: i,
        item: items[i],
        offsetTop: i * itemHeight
      })
    }

    return virtualItems
  }, [items, itemHeight, scrollTop, containerHeight, overscan, enabled])

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  const scrollToIndex = useCallback((index: number) => {
    const element = document.querySelector('[data-virtual-container]') as HTMLDivElement
    if (element) {
      element.scrollTop = index * itemHeight
    }
  }, [itemHeight])

  const containerProps = {
    style: {
      height: containerHeight,
      overflow: 'auto' as const
    },
    onScroll: handleScroll,
    'data-virtual-container': true
  }

  const innerProps = {
    style: {
      height: totalHeight,
      position: 'relative' as const
    }
  }

  return {
    virtualItems,
    totalHeight,
    scrollToIndex,
    containerProps,
    innerProps
  }
}

// Hook for infinite scroll
interface UseInfiniteScrollProps {
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => void
  threshold?: number
}

export function useInfiniteScroll({
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  threshold = 100
}: UseInfiniteScrollProps) {
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
    
    if (
      scrollHeight - scrollTop - clientHeight < threshold &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage()
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, threshold])

  return { onScroll: handleScroll }
}

// Performance monitoring hook
export function usePerformanceMonitor(_componentName: string) {
  return { renderCount: 0, lastRenderTime: 0 }
}
