export function withBranchFilter<T>(query: T, branchId?: string | null, column = 'branch_id') {
  if (!branchId || branchId === 'all') {
    return query
  }

  const queryWithEq = query as T & { eq?: (field: string, value: string) => T }
  if (typeof queryWithEq.eq !== 'function') {
    return query
  }

  return queryWithEq.eq(column, branchId)
}

export function branchHeaders(branchId?: string | null) {
  return branchId ? { 'x-branch-id': branchId } : {}
}
