# Atomic Repair Credit Payment Design

## Objective

Make repair financing auditable and safe under retries or concurrent requests. A repair payment made with customer credit must create the credit header, installments, immutable repair payment, and repair balance update in one PostgreSQL transaction.

## Chosen approach

Extend `public.close_repair_and_register_payment` instead of adding a parallel endpoint or a second RPC. The API continues resolving authenticated organization, branch, actor, repair, and cash session context; it passes credit terms rather than creating a credit in TypeScript.

For credit payments, the function locks the repair and the organization-scoped customer row, calculates the authoritative repair balance, calculates the financed total, checks the customer's currently outstanding installments, creates the credit and installments, records the repair payment with the generated `credit_id`, and updates the repair. Any exception rolls back every write.

## Contract

- Existing cash, card, transfer, delivery, and POS callers remain compatible through new optional RPC parameters.
- Credit continues to require the complete remaining repair balance.
- `interest_rate` is between 0 and 1000, installment count between 1 and 60, and frequency is `weekly`, `biweekly`, or `monthly`.
- The customer's credit limit applies to the financed total, including interest.
- The customer row is locked before calculating available credit so concurrent financing cannot oversubscribe the limit.
- A repeated idempotency key returns the original payment and original `credit_id`; it never creates another credit.
- Card and transfer require a non-empty reference in the request schema and in SQL.
- Unexpected server errors return a generic message while stable financial codes remain actionable.

## Data flow

1. The modal sends method, amount, reference, credit terms, and idempotency key.
2. The API validates the request and performs fast user-facing balance checks.
3. The API calls the closure RPC without creating or rolling back credit records itself.
4. PostgreSQL locks and revalidates all authoritative data, writes the complete operation, and returns payment and credit identifiers.
5. The API reloads the repair and returns the persisted result to the modal.

## Error handling

Stable errors cover missing payment reference, missing customer, disabled or exceeded credit limit, and invalid credit terms. They are mapped to HTTP 4xx responses. Unexpected database details are logged server-side and returned as a generic 500 response.

## Verification

- Schema tests reject card/transfer without reference.
- Route tests prove the API delegates credit creation to the RPC and performs no standalone credit inserts.
- RPC adapter tests prove credit terms are passed and the created credit identifier is returned.
- Migration contract tests prove customer locking, credit/instalment creation inside the RPC, reference validation, and idempotent credit return.
- Focused repair financial tests, TypeScript, ESLint, and `git diff --check` must pass.

## Scope exclusions

This change does not redesign the modal, alter POS credit creation, deploy the migration remotely, or modify unrelated finance and customer work already present in the working tree.
