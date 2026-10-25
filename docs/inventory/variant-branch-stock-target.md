# Variant branch stock target RPC

`save_product_with_variants` persists product and variant metadata; for existing variant IDs the API sends `stock_quantity: 0` to that metadata RPC so it cannot initialize a missing branch row from a stale form value. New variants still use the existing initial-stock path. After metadata saves, `set_variant_branch_stock_target` sets each existing variant's absolute target for the selected organization and branch.

The target RPC creates a missing inventory row at zero with `ON CONFLICT DO NOTHING`, locks the scoped row with `FOR UPDATE`, calculates `target - current` inside PostgreSQL, writes the stock and movement together, and records the request in a private RLS-enabled idempotency ledger. No-op targets are recorded for retries and create no zero-quantity movement. The RPC is executable only by `service_role`; the private request table has no direct role grants.

`useProductsSupabase.updateProduct` sends one `Idempotency-Key` per update. The API namespaces it by variant and supplies a random key for non-UI callers that omit the header. Same-key/same-payload retries return the original result; reusing a key with a different target or scope is rejected. Separate keys serialize as absolute targets on the inventory row.

Product metadata and branch-stock targets are still separate RPC transactions. If metadata saves but a target RPC fails, the endpoint returns a stock warning and the UI displays it; users can retry the same target safely. This change does not make the entire product form save one transaction.

## Local verification

Apply only this migration to the named disposable PostgreSQL test database, then run:

```powershell
node scripts/test-variant-branch-stock-target-local.mjs
```

The harness refuses any database name other than `mitiendapy_variant_race_test` and uses independent `docker exec psql` sessions. It resets only the synthetic organization/branch/product/variant fixture in that disposable container. It does not use mobile-dev, remote Supabase, or production.