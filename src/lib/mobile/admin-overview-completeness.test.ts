import { describe, expect, it } from 'vitest';

import { findAdminOverviewReadIssue } from './admin-overview-completeness';

describe('findAdminOverviewReadIssue', () => {
  it('allows complete reads at or below their configured limit', () => {
    expect(findAdminOverviewReadIssue([
      { query: 'sales', error: null, count: 20_000, limit: 20_000 },
      { query: 'products', error: null, count: 4_999, limit: 5_000 },
    ])).toBeNull();
  });

  it('rejects a read whose exact count exceeds the returned row limit', () => {
    expect(findAdminOverviewReadIssue([
      { query: 'sales', error: null, count: 20_001, limit: 20_000 },
    ])).toEqual({ query: 'sales', reason: 'row_limit_exceeded' });
  });

  it('detects PostgREST truncation even when the total is below the application limit', () => {
    expect(findAdminOverviewReadIssue([
      { query: 'sales', error: null, count: 500, returnedRows: 100, limit: 20_000 },
    ])).toEqual({ query: 'sales', reason: 'result_truncated' });
  });

  it('rejects failed reads instead of treating missing rows as zero', () => {
    expect(findAdminOverviewReadIssue([
      { query: 'products', error: new Error('database unavailable'), count: null, limit: 5_000 },
    ])).toEqual({ query: 'products', reason: 'query_error' });
  });

  it('fails closed when an exact count is unavailable', () => {
    expect(findAdminOverviewReadIssue([
      { query: 'members', error: null, count: null, limit: 5_000 },
    ])).toEqual({ query: 'members', reason: 'count_unavailable' });
  });
});
