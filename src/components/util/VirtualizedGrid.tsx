"use client"

import React from 'react'
import { List } from 'react-window'

interface VirtualizedGridProps<T> {
  items: T[]
  width: number
  height: number
  columnWidth: number
  rowHeight: number
  columns: number
  renderItem: (item: T, index: number) => React.ReactNode
  gap?: number
  overscan?: number
}

export function VirtualizedGrid<T>({
  items,
  width,
  height,
  columnWidth,
  rowHeight,
  columns,
  renderItem,
  gap = 8,
  overscan = 2,
}: VirtualizedGridProps<T>) {
  const rowCount = Math.ceil(items.length / columns)

  // Implementación basada en lista: virtualiza filas, cada fila contiene `columns` celdas.
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const start = index * columns
    const end = Math.min(start + columns, items.length)
    const rowItems = items.slice(start, end)
    return (
      <div style={style}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${columns}, ${columnWidth}px)`,
            gap: `${gap}px`,
          }}
        >
          {rowItems.map((item, i) => {
            const actualIndex = start + i
            return (
              <div key={actualIndex} style={{ width: columnWidth, height: rowHeight }}>
                {renderItem(item, actualIndex)}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <List
      height={height}
      itemCount={rowCount}
      itemSize={rowHeight}
      width={width}
      overscanCount={overscan}
    >
      {Row}
    </List>
  )
}