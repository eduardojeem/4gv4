declare module 'xlsx'

declare module 'react-window' {
  import type { ComponentType, CSSProperties } from 'react'

  export interface ListChildComponentProps {
    index: number
    style: CSSProperties
  }

  export interface ListProps {
    height: number
    itemCount: number
    itemSize: number
    width: number | string
    overscanCount?: number
    children: ComponentType<ListChildComponentProps>
  }

  export const List: ComponentType<ListProps>
}
