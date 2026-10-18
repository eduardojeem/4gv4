/** Reject completions from a prior filter/page generation, including unmounts. */
export function createListRequestScope() {
  let generation = 0
  return {
    invalidate() { generation += 1 },
    capture() { const own = generation; return () => own === generation },
  }
}
