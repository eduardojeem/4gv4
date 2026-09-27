# Customer dashboard hardening design

**Date:** 2026-09-14
**Scope:** `/dashboard/customers` and its customer APIs.

## Goal

Make the customer area trustworthy across the UI, API, and database without changing existing tenant routes or removing historical data.

## Contract

- The UI uses canonical statuses `active`, `inactive`, `suspended`, and `pending`.
- Database aliases in Spanish are normalized at the application boundary.
- A customer identity keeps `name`, `first_name`, and `last_name` synchronized on create and update.
- Business customers keep both legacy `company` and current `company_name` fields synchronized.
- `customer_type` is canonical (`regular`, `premium`, `empresa`, `wholesale`) and the UI type cards also set the compatible segment.
- Every customer subresource is checked against the active organization, even when the admin Supabase client bypasses RLS.
- Customer deletion fails closed when any history lookup fails.

## User experience

- One search field controls the list.
- Mobile uses customer cards; desktop keeps the information-dense table.
- Row actions remain visible on touch devices and icon-only controls have accessible names.
- Expensive credit data is loaded only when the credit view is requested.

## Validation

Unit tests cover normalization and payload construction. Route contract tests cover organization scoping and fail-closed deletion. Existing focused customer tests, TypeScript, lint, and a production build provide regression evidence.
