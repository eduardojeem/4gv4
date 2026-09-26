import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useRealTimeSync } from './useRealTimeSync'

type StatusCallback = (status: string) => void

const statusCallbacks: StatusCallback[] = []
const limit = vi.fn(() => Promise.resolve({ data: [], error: null }))
const channelMock = vi.fn(() => {
  const channel = {
    on: vi.fn(() => channel),
    subscribe: vi.fn((cb: StatusCallback) => {
      statusCallbacks.push(cb)
      return channel
    }),
  }
  return channel
})
const removeChannel = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    channel: channelMock,
    removeChannel,
    from: () => ({ select: () => ({ limit }) }),
  }),
}))

vi.mock('@/lib/config', () => ({
  config: { supabase: { isConfigured: true } },
}))

const options = { tables: ['products', 'product_movements'] }

describe('useRealTimeSync', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    statusCallbacks.length = 0
    channelMock.mockClear()
    removeChannel.mockClear()
    limit.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps a single heartbeat when several channels report SUBSCRIBED', async () => {
    const { result, unmount } = renderHook(() => useRealTimeSync(options))

    act(() => result.current.subscribe())
    act(() => statusCallbacks.forEach((cb) => cb('SUBSCRIBED')))
    act(() => statusCallbacks.forEach((cb) => cb('SUBSCRIBED')))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(limit).toHaveBeenCalledTimes(1)

    unmount()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    expect(limit).toHaveBeenCalledTimes(1)
  })

  it('stops reconnecting after a bounded number of failed attempts', async () => {
    const { result } = renderHook(() => useRealTimeSync(options))

    act(() => result.current.subscribe())
    const initialSubscriptions = channelMock.mock.calls.length

    // Cada ciclo: el canal falla y el hook agenda un reintento con espera creciente.
    for (let i = 0; i < 10; i += 1) {
      act(() => statusCallbacks.at(-1)?.('CHANNEL_ERROR'))
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10 * 60 * 1000)
      })
    }

    const reconnects = (channelMock.mock.calls.length - initialSubscriptions) / options.tables.length
    expect(reconnects).toBe(5)
  })
})
