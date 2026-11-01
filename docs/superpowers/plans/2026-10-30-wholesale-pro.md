# Wholesale Pro Implementation Plan
Goal: Independent Mayorista & Retail presentation using shared authorized catalog/pricing/cart.
Base: 08dfebc069142193787a401a57a44565ceafd1e2; no dirty integration files copied.
Constraints: local only, no migrations, no commercial logic, no commits/push/deploy.
A: registration/compatibility/thumbnail plus regression tests; keep automatic defaults.
B: dedicated responsive header/search/category navigation plus tests.
C: configured compact hero, real categories, bounded products, shared pricing ProductCard with scoped density, compact footer.
D: reuse organization-scoped wholesale access; no new quantity tiers or SKU order backend.
E: responsive and accessible controls, no global styling.
F: focused regressions, TypeScript, ESLint, safe build and honest visual readiness.

Evidence:
- A: 63/63 registration/style/services tests passed.
- B: 58/58 header and style tests passed.
- C/D: 87/87 bounded catalog, authorization-preserving presentation, empty/network state, default claims and shared-price regressions passed.
- Final regression: 163/163 in 15 suites passed.
- ESLint changed implementation: exit 0, two existing jsx-ast-utils diagnostic messages.
- Manual responsive/keyboard/browser verification pending; no automated visual PASS claimed.
- Canonical defaults already returned Tech for electronics and Beauty for cosmetics in base; two stale tests were aligned without changing those mappings. Availability expectations now include Wholesale Pro for every vertical.
- Wholesale visibility remains controlled by organization-scoped wholesale access on existing API. No public/authenticated/approved policy added. No volume tiers or SKU bulk ordering backend found/reimplemented.
- Limits: existing newest-products request is 32; home renders at most 20, with full catalog through existing pagination. No N+1 calls added.
- Claim safety: exact inherited hero/default benefits are suppressed only within Wholesale Pro. Custom settings remain unchanged in storage.

Final validation: Web TypeScript PASS; Next Webpack production build PASS, 306/306 pages; postbuild 12 PASS, 0 FAIL, 1 optional missing route-stats warning. git diff --check PASS. No source, env, package or lockfile changes imported from the dirty integration. No commit/push/deploy/migration. Visual checks at requested widths remain pending manual review.
