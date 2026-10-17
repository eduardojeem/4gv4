# Dashboard audit hardening implementation plan

> For agentic workers: execute with superpowers:subagent-driven-development / dispatching-parallel-agents and focused test-first verification.

Source: dashboard audit 2026-10-16, baseline 9240bec3. This isolated checkout excludes concurrent Brands/Categories and credit-print/customer-file edits in the primary workspace.

- [x] Finance: replace after-sales effect chains with a service-role-only atomic resolution boundary; validate effective refund including stored amounts; preserve actor, tenant, branch, stock and accounting invariants; persist idempotent resolution results. Test rollback, double execution, closed sessions and excess refund.
- [x] Cash: migration removes authenticated direct cash ledger writes and overlapping permissive read policy, retaining restrictive branch scope and financial read separation. Inventory all callers and keep service boundaries working.
- [x] Metrics: use shared physical cash balance; remove invented client comparisons and monthly fallback; preserve confirmed zero debt; align workshop metrics/ranges/zero prices and error states. Add focused regression tests.
- [x] Tenant/state: scope quote drafts and cached lists to user/organization; cancel stale responses; align manager route and page permission checks; fix priorities pagination and partial repairs loading; add paginated lists/counts where capped.
- [x] Catalog/UX: unify catalog with existing database hooks; persist honest technician preferences; consolidate obsolete product route, fix author attribution and supplier currency; implement explicit source/date labels and error handling.
- [x] Integration: inspect all changes, run focused tests, TypeScript, lint and production build. Review security/RLS with local PostgreSQL fixtures; document migration and four manual contract reconciliations. Do not deploy or run remote business mutations for this implementation request.

Ruling: execute independent UI/tenant/catalog blocks concurrently in disjoint owned files; primary agent owns financial SQL and API routes. No agent commits or changes the shared index.
Ruling: no automatic reconciliation of the four historical credit agreements; original agreements are required. Ship visibility and preserve amounts.
Ruling: prepare migration without reapplying existing production migrations or executing remote financial writes. User previously applied migrations manually.

Integration evidence: 257 tests passed in 31 files; TypeScript exit 0; changed-file ESLint exit 0; both local financial SQL scripts PASS. Initial Next.js webpack production build completed (283 static pages). An additional build repetition was stopped to release local memory after worker timeouts; the final test run was isolated and passed. Remote migration, authenticated browser, CI and production verification remain delivery gates, not completed here.
