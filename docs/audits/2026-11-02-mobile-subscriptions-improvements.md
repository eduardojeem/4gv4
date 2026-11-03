# Mobile subscriptions improvements

Policy: monthly repair creation quota, no carryover. The configured plan limit remains authoritative; no plan value was changed or hardcoded. History remains intact. Calendar boundary: first day at 00:00 America/Asuncion. The server reports monthly repairUsage separately from historical usage, and the creation gate uses the same count/window. No migration or remote write was executed.

Mobile: monthly usage and renewal date, unknown-data distinction, shared expiry model, refresh when app becomes active, visible stale-data errors, organization brand accent, prioritized business quota, collapsed module/coupon lists, 25-payment truncation notice. Billing edits use the shared keyboard-aware sheet, prevent double submission, validate against server rules and protect unsaved edits/navigation. Successful writes only update compatible private scope.

Checks: 16 focused model/API tests plus 39 related subscription regressions passed. Root/mobile TypeScript and changed-file ESLint passed. No commit, push or deploy. Native physical-device visual validation remains pending.
