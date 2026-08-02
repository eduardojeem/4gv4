'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

type StringState = Record<string, string>

function readState<T extends StringState>(params: URLSearchParams, defaults: T): T {
  return Object.fromEntries(
    Object.entries(defaults).map(([key, fallback]) => [key, params.get(key) || fallback])
  ) as T
}

function statesMatch<T extends StringState>(left: T, right: T) {
  return Object.keys(left).every((key) => left[key] === right[key])
}

export function useUrlListState<T extends StringState>(defaults: T) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const defaultsRef = useRef(defaults)
  const searchKey = searchParams.toString()
  const [state, setState] = useState<T>(() =>
    readState(new URLSearchParams(searchKey), defaults)
  )

  useEffect(() => {
    const next = readState(new URLSearchParams(searchKey), defaultsRef.current)
    setState((current) => statesMatch(current, next) ? current : next)
  }, [searchKey])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams(searchKey)

      Object.entries(state).forEach(([key, value]) => {
        if (!value || value === defaultsRef.current[key]) params.delete(key)
        else params.set(key, value)
      })

      const nextQuery = params.toString()
      if (nextQuery === searchKey) return
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false })
    }, 200)

    return () => window.clearTimeout(timeout)
  }, [pathname, router, searchKey, state])

  const setValue = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setState((current) => ({ ...current, [key]: value }))
  }, [])

  const reset = useCallback(() => {
    setState(defaultsRef.current)
  }, [])

  return { state, setValue, reset }
}
