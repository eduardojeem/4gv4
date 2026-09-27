# Dashboard Profile Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Secure `/dashboard/profile`, make remote persistence authoritative, and publish intended profile fields through one canonical contract.

**Architecture:** A strict server route becomes the only dashboard profile write boundary. PostgreSQL column grants and tenant-scoped RLS protect privileged fields independently of UI behavior. Small contract/cache/mapping modules keep the client page and public route testable without duplicating profile semantics.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Zod, Supabase/PostgreSQL RLS, Vitest, Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-27-dashboard-profile-hardening-design.md`

## Global Constraints

- Preserve the existing marketplace `username` and `is_public` publication flow.
- Never expose email, phone, role, permissions, status, or organization membership through the public profile.
- Do not add dependencies.
- Do not claim cloud synchronization until the server confirms persistence.
- Keep existing unrelated working-tree changes intact.

## Review Focus

- A valid patch mixed with one privileged/unknown field must reject the whole request, not partially write it; Task 2 route tests pin this.
- A profile row missing optional JSONB objects must load with safe defaults without overwriting the database; Task 2 contract tests pin this.
- Two authenticated users in one browser must never share cached preferences; Task 3 cache tests pin this.
- A database success followed by Auth metadata failure must remain visibly partial and reload canonical data; Tasks 2 and 3 pin this.
- A published profile with malformed social-link values must omit unsafe links rather than render executable or broken URLs; Task 4 mapper tests pin this.

---

### Task 1: Restrict `profiles` privileges and tenant scope

**Files:**
- Create: `supabase/migrations/20260927170000_harden_dashboard_profile_access.sql`
- Create: `src/test/dashboard-profile-security-migration.test.ts`

**Interfaces:**
- Produces: column-limited authenticated UPDATE grants and policies `profiles_select_scoped`, `profiles_update_scoped`, `profiles_insert_self`, and `profiles_delete_scoped`.
- Consumes: `organization_members`, `get_jwt_role()`, `auth.uid()`, and existing `profiles` columns.

- [ ] **Step 1: Write the failing structural security test**

Assert that the migration revokes broad table privileges, grants UPDATE only for `full_name, avatar_url, phone, department, bio, website, job_title, timezone, social_links, preferences, location, updated_at`, drops all four consolidated policies, scopes staff/admin access through a shared active `organization_members` organization, excludes target `role = 'super_admin'`, and retains a `get_jwt_role() = 'super_admin'` override. Assert that UPDATE grants omit `role`, `permissions`, `status`, `email`, `username`, and `is_public`.

- [ ] **Step 2: Run the test and confirm RED**

Run: `npx vitest run src/test/dashboard-profile-security-migration.test.ts --pool=forks --maxWorkers=1 --fileParallelism=false`

Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Create the migration**

Use explicit `REVOKE ALL ON public.profiles FROM anon, authenticated`, column-level SELECT/INSERT/UPDATE grants required by current authenticated flows, guarded policy replacement, and active-membership `EXISTS` predicates that compare the caller and target profile within the same organization. Preserve `service_role` access and the existing public-profile read policy if one exists; do not grant anonymous table-wide access.

- [ ] **Step 4: Verify GREEN and SQL hygiene**

Run: `npx vitest run src/test/dashboard-profile-security-migration.test.ts --pool=forks --maxWorkers=1 --fileParallelism=false`

Run: `git diff --check -- supabase/migrations/20260927170000_harden_dashboard_profile_access.sql src/test/dashboard-profile-security-migration.test.ts`

- [ ] **Step 5: Commit the security slice**

```bash
git add supabase/migrations/20260927170000_harden_dashboard_profile_access.sql src/test/dashboard-profile-security-migration.test.ts
git commit -m "fix: restrict dashboard profile privileges"
```

### Task 2: Add strict profile contract and authenticated API

**Files:**
- Create: `src/lib/profile/dashboard-profile-contract.ts`
- Create: `src/lib/profile/dashboard-profile-contract.test.ts`
- Create: `src/app/api/dashboard/profile/route.ts`
- Create: `src/app/api/dashboard/profile/route.test.ts`

**Interfaces:**
- Produces: `DashboardProfile`, `DashboardPreferences`, `DashboardProfilePatch`, `dashboardProfilePatchSchema`, `toDashboardProfile(row, user)`, and `GET|PATCH /api/dashboard/profile`.
- Consumes: server `createClient()`, Task 1 allowlisted columns, and Supabase Auth `getUser()`/`updateUser()`.

- [ ] **Step 1: Write failing contract tests**

Test safe defaults for null `preferences`/`social_links`, email and `emailVerified` sourced only from Auth, trimming and maximum lengths, URL/timezone/social-link validation, rejection of an empty patch, and strict rejection of privileged or unknown fields even when accompanied by valid fields.

- [ ] **Step 2: Run contract tests and confirm RED**

Run: `npx vitest run src/lib/profile/dashboard-profile-contract.test.ts --pool=forks --maxWorkers=1 --fileParallelism=false`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the contract module**

Define the exact camelCase client types and `toDashboardProfile(row: Record<string, unknown>, user: User): DashboardProfile`. Export `toProfileUpdate(patch: DashboardProfilePatch): Record<string, unknown>` so the route cannot invent additional columns.

- [ ] **Step 4: Verify contract GREEN**

Run: `npx vitest run src/lib/profile/dashboard-profile-contract.test.ts --pool=forks --maxWorkers=1 --fileParallelism=false`

- [ ] **Step 5: Write failing route tests**

Mock the server client and cover: unauthenticated 401; GET own row; strict 400 for `role`, `id`, or mixed unknown input; PATCH filters by authenticated ID; database failure 500 without Auth update; awaited Auth update for changed name/phone/avatar; Auth failure returns `207` with `{ partial: true }`; successful response returns the authoritative reselected row.

- [ ] **Step 6: Run route tests and confirm RED**

Run: `npx vitest run src/app/api/dashboard/profile/route.test.ts --pool=forks --maxWorkers=1 --fileParallelism=false`

- [ ] **Step 7: Implement GET and PATCH**

Use `supabase.auth.getUser()`, strict Zod parsing, `.update(toProfileUpdate(parsed.data)).eq('id', user.id)`, awaited Auth metadata synchronization, and a final SELECT before responding. Never accept a target user ID from the request.

- [ ] **Step 8: Verify API slice and commit**

Run: `npx vitest run src/lib/profile/dashboard-profile-contract.test.ts src/app/api/dashboard/profile/route.test.ts --pool=forks --maxWorkers=1 --fileParallelism=false`

Run: `npx eslint src/lib/profile/dashboard-profile-contract.ts src/app/api/dashboard/profile/route.ts`

```bash
git add src/lib/profile src/app/api/dashboard/profile
git commit -m "feat: add secure dashboard profile API"
```

### Task 3: Make dashboard persistence authoritative and user-scoped

**Files:**
- Create: `src/lib/profile/profile-preferences-cache.ts`
- Create: `src/lib/profile/profile-preferences-cache.test.ts`
- Create: `src/test/dashboard-profile-persistence.test.tsx`
- Modify: `src/app/dashboard/profile/page.tsx`
- Modify: `src/components/profile/dashboard-preferences-form.tsx`
- Modify: `src/components/profile/dashboard-profile-form.tsx`

**Interfaces:**
- Produces: `profilePreferencesCacheKey(userId: string): string`, `readProfilePreferencesCache(userId)`, `writeProfilePreferencesCache(userId, preferences)`, and client calls to Task 2 GET/PATCH.
- Consumes: `DashboardProfile`, `DashboardProfilePatch`, and Task 2 response statuses.

- [ ] **Step 1: Write failing cache tests**

Assert keys equal `dashboard-profile-preferences:<userId>`, malformed JSON returns null, user A cannot read user B's cached object, and writes never use the legacy global `profile-preferences` key.

- [ ] **Step 2: Run cache tests and confirm RED**

Run: `npx vitest run src/lib/profile/profile-preferences-cache.test.ts --pool=forks --maxWorkers=1 --fileParallelism=false`

- [ ] **Step 3: Implement cache helpers and verify GREEN**

Implement browser-safe helpers with injected/default `Storage` and no remote-success semantics.

Run: `npx vitest run src/lib/profile/profile-preferences-cache.test.ts --pool=forks --maxWorkers=1 --fileParallelism=false`

- [ ] **Step 4: Write failing dashboard persistence tests**

Mock `fetch` and assert: initial GET hydrates state; PATCH failure keeps dirty state and shows no cloud-sync badge; 207 shows partial-sync warning and reloads GET; 200 updates initial state and scoped cache; unavailable preferences are disabled with `Próximamente`; `beforeunload` is registered only while dirty; avatar completion focuses the upload control.

- [ ] **Step 5: Run UI tests and confirm RED**

Run: `npx vitest run src/test/dashboard-profile-persistence.test.tsx --pool=forks --maxWorkers=1 --fileParallelism=false`

- [ ] **Step 6: Replace direct Supabase persistence with the API**

Remove client `profiles.upsert()` and `get_profile_summary` dependency from this screen. Fetch the authoritative profile through GET, submit one PATCH for profile/preferences, preserve dirty state on failure, handle 207 explicitly, and show synchronized state only after 200. Keep theme/color behavior immediate. Disable non-consumed controls and remove operational copy that claims they affect reports, email, push, or marketing.

- [ ] **Step 7: Consolidate save/focus/navigation UX**

Keep the header action for desktop and floating action for mobile using responsive visibility classes, add a dirty `beforeunload` guard, and make `AvatarUpload` expose a focusable control ID or ref used by completion shortcuts.

- [ ] **Step 8: Verify and commit dashboard slice**

Run: `npx vitest run src/lib/profile/profile-preferences-cache.test.ts src/test/dashboard-profile-persistence.test.tsx src/test/dashboard-profile-enhanced.test.tsx --pool=forks --maxWorkers=1 --fileParallelism=false`

Run: `npx eslint src/app/dashboard/profile/page.tsx src/components/profile/dashboard-profile-form.tsx src/components/profile/dashboard-preferences-form.tsx src/lib/profile/profile-preferences-cache.ts`

```bash
git add src/app/dashboard/profile/page.tsx src/components/profile/dashboard-profile-form.tsx src/components/profile/dashboard-preferences-form.tsx src/lib/profile/profile-preferences-cache.ts src/lib/profile/profile-preferences-cache.test.ts src/test/dashboard-profile-persistence.test.tsx
git commit -m "fix: make profile saves authoritative"
```

### Task 4: Unify and harden the public profile consumer

**Files:**
- Create: `src/lib/profile/public-profile.ts`
- Create: `src/lib/profile/public-profile.test.ts`
- Create: `src/test/public-profile-client.test.tsx`
- Modify: `src/app/(public)/perfil/[username]/page.tsx`
- Modify: `src/components/public/PublicProfileClient.tsx`

**Interfaces:**
- Produces: `toPublicProfileData(row, content)`, `normalizePublicSocialLinks(value, website)`, and `PublicProfileData` with `verified: boolean` and no implicit contact email.
- Consumes: canonical Task 2 field names and existing `username/is_public` publication state.

- [ ] **Step 1: Write failing mapper tests**

Assert `full_name -> display_name`, `job_title -> title`, JSONB handles/HTTPS URLs normalize to supported platforms, website becomes a website link, `javascript:`/malformed URLs are omitted, and private email/phone/preferences never appear in the returned object.

- [ ] **Step 2: Run mapper tests and confirm RED**

Run: `npx vitest run src/lib/profile/public-profile.test.ts --pool=forks --maxWorkers=1 --fileParallelism=false`

- [ ] **Step 3: Implement the public mapper and canonical query**

Select only `id, username, full_name, job_title, bio, location, avatar_url, website, social_links, updated_at, is_public`. Keep content limited and public. Log operational query errors and render an error state; call `notFound()` only for an absent/non-public row.

- [ ] **Step 4: Write failing client behavior tests**

Assert verification is not hard-coded, contact is absent without an explicit valid destination, Share calls `navigator.share` or clipboard fallback with feedback, and the owner configuration link remains `/marketplace/perfil#datos-personales`.

- [ ] **Step 5: Run client tests and confirm RED**

Run: `npx vitest run src/test/public-profile-client.test.tsx --pool=forks --maxWorkers=1 --fileParallelism=false`

- [ ] **Step 6: Implement public client behavior**

Remove `recipientEmail={displayName}`, hide the contact form until a public-contact field exists, derive the verification badge from returned evidence, and implement share/fallback without reading credentials or private browser storage.

- [ ] **Step 7: Verify and commit public slice**

Run: `npx vitest run src/lib/profile/public-profile.test.ts src/test/public-profile-client.test.tsx src/app/api/marketplace/profile/preferences/route.test.ts --pool=forks --maxWorkers=1 --fileParallelism=false`

Run: `npx eslint src/lib/profile/public-profile.ts 'src/app/(public)/perfil/[username]/page.tsx' src/components/public/PublicProfileClient.tsx`

```bash
git add src/lib/profile/public-profile.ts src/lib/profile/public-profile.test.ts src/app/'(public)'/perfil/'[username]'/page.tsx src/components/public/PublicProfileClient.tsx src/test/public-profile-client.test.tsx
git commit -m "fix: unify public profile data"
```

### Task 5: End-to-end verification and operational proof

**Files:**
- Create: `tests/e2e/dashboard-profile.spec.ts`
- Modify: only files with defects reproduced by this task's tests.

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: authenticated browser evidence for profile persistence and public rendering.

- [ ] **Step 1: Write E2E scenarios**

Cover desktop and 375px mobile: load authoritative data, edit/save/reload, forced PATCH failure retains dirty state, unavailable preference labeling, unsaved reload warning, publication disabled state, and a published fixture whose canonical name/title/social links render without email or phone.

- [ ] **Step 2: Run E2E and fix only reproduced defects**

Run: `npx playwright test tests/e2e/dashboard-profile.spec.ts`

Expected: all scenarios pass with zero page console errors attributable to this flow.

- [ ] **Step 3: Verify database state when Supabase tooling is available**

Run `supabase --version`, discover supported advisor/migration commands with `--help`, then run the applicable advisors and migration-status command. If CLI authentication is unavailable, record `SUPABASE_CLI_NOT_FOUND` or the exact authentication blocker; do not claim live RLS verification.

- [ ] **Step 4: Run final automated verification**

Run: `npx vitest run src/test/dashboard-profile-security-migration.test.ts src/lib/profile/dashboard-profile-contract.test.ts src/app/api/dashboard/profile/route.test.ts src/lib/profile/profile-preferences-cache.test.ts src/test/dashboard-profile-persistence.test.tsx src/test/dashboard-profile-enhanced.test.tsx src/lib/profile/public-profile.test.ts src/test/public-profile-client.test.tsx src/app/api/marketplace/profile/preferences/route.test.ts --pool=forks --maxWorkers=1 --fileParallelism=false`

Run: `npm run lint`

Run: `npm run typecheck`

Run: `npm test`

Run: `git diff --check`

- [ ] **Step 5: Review the complete diff and commit QA**

Confirm no secrets, no unrelated files, no broad role/status grants, and no public query includes email or phone.

```bash
git add tests/e2e/dashboard-profile.spec.ts
git commit -m "test: verify dashboard profile hardening"
```
