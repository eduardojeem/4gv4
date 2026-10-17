# Supabase usage optimization

Approved scope: implement the recommendations from the Supabase/Docker cost review. Base: production merge `8d9d7557`. Preserve the 32 unrelated files in the primary checkout.

- [x] Replace Home row downloads with an invoker/RLS aggregate, retaining tenant, branch, module and business-timezone semantics.
- [x] Replace POS KPI row downloads with aggregates; load complete detail only on demand, including exports. Count only completed after-sales refunds.
- [x] Replace monthly customer sales downloads with grouped sums/counts.
- [x] Add a bounded 30-second browser-memory cache keyed by actor, organization, branch, period and authorization; force-refresh, logout/change invalidation and cancellation.
- [x] Stop the unused local Docker stack with backup, preserving its database/storage volumes. Disable optional local analytics/log collector on future start and add explicit start/stop commands.
- [x] Verify arithmetic, zero amounts, more than 1,000 records, RLS, branch scope, period boundaries, cache isolation and complete exports. Run focused tests, SQL fixtures, TypeScript, lint and final production build sequentially.
- [x] Review and integrate only this scope in the real checkout; document migration order and evidence.

No remote project/branch deletion, pause, new paid resource, remote SQL application or production publication belongs to this implementation step. A smaller JSON payload is measurable locally; actual invoice savings require the organization's Usage/Billing panel.

Docker evidence: the app points to `cswtugmwazxdktntndpy.supabase.co`; no established Windows connections to the local ports were found, and database clients were idle internal services. `supabase stop --project-id 4gv4` returned `backup:true`; the three labeled volumes remain and no containers are running. No volume/image pruning was executed.

Local integration: implementation commit `fde14956` fast-forwarded into `C:\proyecto\mitiendapy`. The 32 pre-existing dirty files retain their original SHA-256 hashes. A post-integration run of 16 cache/Home/POS hook tests passed in the primary checkout. Production build completed with exit code 0 in the isolated checkout; all three new migrations and production publication remain pending.
