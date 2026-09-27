import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRepairsRealtime } from './useRepairsRealtime'

const subscribe = vi.fn()
const unsubscribe = vi.fn()
interface MockChain {
  on: ReturnType<typeof vi.fn>
  subscribe: ReturnType<typeof vi.fn>
  unsubscribe: ReturnType<typeof vi.fn>
}
const chain: MockChain = { on: vi.fn(() => chain), subscribe, unsubscribe }
const channelMock = vi.fn(() => chain)

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ channel: channelMock })
}))
vi.mock('../../lib/supabase/client', () => ({
  createClient: () => ({ channel: channelMock })
}))
vi.mock('../lib/supabase/client', () => ({
  createClient: () => ({ channel: channelMock })
}))

describe('useRepairsRealtime', () => {
  beforeEach(() => {
    subscribe.mockClear()
    unsubscribe.mockClear()
    channelMock.mockClear()
    chain.on.mockClear()
  })

  it('subscribes on mount and unsubscribes on unmount', () => {
    const onInsert = vi.fn()
    const { unmount } = renderHook(() => useRepairsRealtime({ onInsert }))
    expect(channelMock).toHaveBeenCalledTimes(1)
    expect(chain.on).toHaveBeenCalled()
    expect(subscribe).toHaveBeenCalledTimes(1)
    unmount()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })
})