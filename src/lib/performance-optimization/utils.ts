export function mark(name: string) {
  if (typeof performance !== 'undefined' && 'mark' in performance) {
    performance.mark(name)
  }
}

export function measure(name: string, startMark: string, endMark: string) {
  if (typeof performance !== 'undefined' && 'measure' in performance) {
    try {
      performance.measure(name, startMark, endMark)
    } catch {}
  }
}

export function time<T>(fn: () => T, label = 'operation') {
  const start = typeof performance !== 'undefined' ? performance.now() : Date.now()
  const result = fn()
  const end = typeof performance !== 'undefined' ? performance.now() : Date.now()
  return { result, duration: end - start }
}
