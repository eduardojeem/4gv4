import { useCallback, useState, type Dispatch, type SetStateAction } from 'react'
/** Hide old organization data during render and discard late replies, including A to B to A. */
export function useOrganizationScopedState<T>(organizationId: string | null | undefined, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [initialValue] = useState(() => initial)
  const [snapshot, setSnapshot] = useState(() => ({ organizationId, epoch: {}, value: initial }))
  if (snapshot.organizationId !== organizationId) {
    setSnapshot({ organizationId, epoch: {}, value: initialValue })
  }
  const epoch = snapshot.epoch
  const setValue: Dispatch<SetStateAction<T>> = useCallback(next => {
    setSnapshot(previous => {
      if (!organizationId || previous.epoch !== epoch) return previous
      return { ...previous, value: typeof next === 'function' ? (next as (previous: T) => T)(previous.value) : next }
    })
  }, [epoch, organizationId])
  return [snapshot.organizationId === organizationId ? snapshot.value : initialValue, setValue]
}
