# Dashboard summary reads

`getCachedDashboardSummary<T>(key, load, { signal?, force?, ttlMs? })` is browser memory only, defaults to 30 seconds and retains at most 25 LRU entries. Payloads are cloned on store and return. Errors and aborted loads are never stored; each consumer owns its signal. No promise/controller is shared. A newer load prevents an older completion from replacing its snapshot. Server calls execute the loader without storing a snapshot.

Keys must identify user, organization, branch (or explicit assigned-active/legacy-branchless scope), stable period/time zone, and effective role/permissions. `force: true` bypasses a valid value for explicit refresh. Organization changes, committed tenant scope changes, logout, sign-in and user updates clear pending and settled cache state. No localStorage or server cache is used.

## Customer monthly summary

Migration `20261017213719_dashboard_customer_monthly_summary.sql` adds `dashboard_customer_monthly_summary(p_organization_id uuid, p_start timestamptz, p_end timestamptz, p_time_zone text)`, returning `year`, zero-based `month_index`, `revenue`, and `sale_count`. It is STABLE SECURITY INVOKER: sales RLS remains in force. Assigned active branches in the organization are computed once and filtered explicitly; legacy sales with null branch_id remain tenant-scoped. Explicit organization and customer-read permission are required. The input window is bounded to 400 days (the UI asks at most 12 months). Cancelled/cancelada/cancelado sales are excluded, while pending sales retain their existing treatment. The hook preserves the browser's month boundaries and timezone. Valid empty results become zero months; RPC errors remain unavailable data. No fallback downloads the sales ledger when the RPC is unavailable.

The migration is prepared locally and must be applied before the new monthly hook can return data. Verification: `node scripts/test-customer-monthly-summary-sql.cjs` exercises 1,250 sales, cancellation aliases, zero periods, local month boundaries, org-only sales RLS plus assigned/active branch isolation and legacy branchless rows, invalid timezone/budget and missing permissions using local PGlite.

References checked during implementation: [Supabase database functions](https://supabase.com/docs/guides/database/functions), [JavaScript RPC](https://supabase.com/docs/reference/javascript/rpc), and [Supabase changelog](https://supabase.com/changelog). No relevant RPC breaking change was present in the checked changelog.
