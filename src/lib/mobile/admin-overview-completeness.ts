export type AdminOverviewReadCheck = {
  query: string;
  error: unknown;
  count: number | null;
  returnedRows?: number;
  limit?: number;
};

export type AdminOverviewReadIssue = {
  query: string;
  reason: 'query_error' | 'count_unavailable' | 'row_limit_exceeded' | 'result_truncated';
};

/** Avoid presenting a bounded or failed read as a complete business summary. */
export function findAdminOverviewReadIssue(checks: AdminOverviewReadCheck[]): AdminOverviewReadIssue | null {
  for (const check of checks) {
    if (check.error) return { query: check.query, reason: 'query_error' };
    if (check.count === null) return { query: check.query, reason: 'count_unavailable' };
    if (check.limit !== undefined && check.count > check.limit) {
      return { query: check.query, reason: 'row_limit_exceeded' };
    }
    if (check.returnedRows !== undefined && check.returnedRows < check.count) {
      return { query: check.query, reason: 'result_truncated' };
    }
  }

  return null;
}
