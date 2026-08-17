# Customer Credit And Store Credit Design

## Scope

Keep purchase financing and customer store credit as separate accounting concepts. A purchase limit controls how much debt a customer may open. Store credit is an immutable ledger of money owed to the customer and is used as a payment tender, never as a discount.

## Sale flow

The POS sends the store-credit amount together with the sale request. A new database RPC wraps the existing atomic sale RPC, validates the organization, customer, available ledger balance and sale total, and records the negative ledger entry in the same PostgreSQL transaction. A synthetic payment exists only while the existing sale RPC validates totals and is removed before commit, so cash and electronic movements contain only money actually collected.

Store credit cannot be applied without a customer. Concurrent redemptions serialize by locking the customer row. The sale/customer relationship is checked in the database, and the sale id is the idempotency key for the ledger debit.

## Return flow

Completing an after-sales return will be moved to a transactional database boundary in a later isolated increment. Until that database contract is introduced, the existing return UI remains available and the customer ledger continues to record its source case. This implementation does not pretend the current sequential return effects are atomic.

## Customer experience

The customer detail keeps purchase credit and store credit visually separate. Store credit exposes balance, full paginated history, origin, date, and signed amount, with explicit loading, empty, error and retry states.

## Security and audit

The RPC verifies active organization membership and uses organization/customer predicates internally. Execute is revoked from public and granted only to authenticated users. Ledger entries remain append-only; corrections require compensating entries.

## Verification

Regression tests cover request normalization and the customer store-credit history states. SQL contract tests assert locking, customer matching, idempotency, restricted execution, and removal of synthetic cash movements.
