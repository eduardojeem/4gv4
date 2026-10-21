import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useOrganizationScopedState } from './use-organization-scoped-state'
describe('organization scoped report state', () => {
  it('hides previous data immediately and drops late responses after A to B to A', () => {
    const { result, rerender } = renderHook(({org}) => useOrganizationScopedState<string[]>(org, []), {initialProps: {org: 'A'}})
    const lateA = result.current[1]
    act(() => lateA(['private A']))
    rerender({org:'B'})
    expect(result.current[0]).toEqual([])
    act(() => lateA(['late private A']))
    expect(result.current[0]).toEqual([])
    act(() => result.current[1](['private B']))
    rerender({org:'A'})
    act(() => lateA(['late first A session']))
    expect(result.current[0]).toEqual([])
  })
})
