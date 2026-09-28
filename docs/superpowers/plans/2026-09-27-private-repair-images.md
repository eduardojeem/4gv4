# Private Repair Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every repair photograph private while preserving upload, staff viewing, customer tracking, deletion, and the five existing remote objects.

**Architecture:** Store only a normalized `repair-images` object path in `repair_images.image_url`; server-only helpers accept that path or the historical public URL and issue five-minute signed URLs. Deploy dual-read code before applying the migration that converts stored values and makes the bucket private.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase Storage/Postgres/RLS, Vitest, Docker Supabase.

**Spec:** `docs/superpowers/specs/2026-09-27-private-repair-images-design.md`

## Global Constraints

- Do not change the privacy model of `product-images` or `avatars`.
- Signed URLs expire after exactly 300 seconds and are never persisted or logged.
- Never sign or delete a client-supplied arbitrary URL; authorize the repair row first and use its stored reference.
- Preserve compatibility with historical `/storage/v1/object/public/repair-images/` URLs until the database migration succeeds.
- Use the existing service-role client only in server code.
- Do not move or delete existing objects during migration.

## Review Focus

- Percent-encoded historical object names must decode to the exact Storage path; Task 1 tests spaces and Unicode.
- An external URL or traversal string must never be signed; Task 1 tests both.
- A valid public token for one ticket must not expose another ticket's images; Task 4 tests cross-ticket denial.
- A database delete must not permit deleting an object referenced by a different repair; Task 3 tests row-first lookup by image ID and repair ID.
- A signing failure must produce a controlled unavailable-image result, not leak the historical public URL; Tasks 2 and 4 test this error path.

---

### Task 1: Storage reference boundary

**Files:**
- Create: `src/lib/repairs/repair-image-storage.ts`
- Test: `src/lib/repairs/repair-image-storage.test.ts`

**Interfaces:**
- Produces: `repairImagePath(value: string): string | null`
- Produces: `signRepairImagePath(admin: SupabaseClient, path: string): Promise<string | null>`
- Produces: `REPAIR_IMAGE_BUCKET = 'repair-images'` and `REPAIR_IMAGE_URL_TTL_SECONDS = 300`

- [ ] Write failing tests for a plain path, historical public URL, encoded Unicode/space, foreign bucket URL, external URL, and `../` traversal.
- [ ] Run `npx vitest run src/lib/repairs/repair-image-storage.test.ts`; expect failures because the module does not exist.
- [ ] Implement strict normalization and signing with `createSignedUrl(path, 300)`; return `null` on invalid input or Storage error.
- [ ] Run the focused test; expect all cases to pass.
- [ ] Commit with `feat(storage): add private repair image references`.

### Task 2: Private upload contract

**Files:**
- Modify: `src/app/api/upload/route.ts`
- Modify: `src/lib/supabase-storage.ts`
- Test: `src/app/api/upload/repair-image-upload.test.ts`

**Interfaces:**
- Consumes: Task 1 constants and signer.
- Produces for `repair-images`: `{ success: true, path: string, url: string }`, where `url` is a temporary preview and `path` is authoritative.
- Public buckets continue returning their permanent public URL.

- [ ] Write failing route tests asserting private uploads use `createSignedUrl`, never `getPublicUrl`, and reject a signing failure without exposing a fallback URL.
- [ ] Run the focused test and confirm the current public-URL behavior fails it.
- [ ] Implement the bucket-specific response and set `REQUIRED_BUCKETS.repair-images.public` to `false`.
- [ ] Update client fallback utilities so `repair-images` never calls `getPublicUrl`.
- [ ] Run the focused upload test plus existing storage/upload tests.
- [ ] Commit with `fix(storage): stop publishing repair upload URLs`.

### Task 3: Staff attachment and deletion

**Files:**
- Modify: `src/app/api/repairs/[id]/images/route.ts`
- Modify: `src/app/api/repairs/route.ts`
- Modify: `src/components/dashboard/repairs/RepairDetailDialog.tsx`
- Modify: `src/components/dashboard/repair-form-dialog-v2.tsx`
- Modify: `src/hooks/useImageUpload.ts`
- Test: `src/app/api/repairs/[id]/images/private-images.test.ts`

**Interfaces:**
- Consumes: upload `{ path, url }` and Task 1 normalizer/signer.
- The image endpoint accepts `images: Array<{ storagePath: string; description?: string; imageType?: string }>`; repair creation accepts `images: string[]` containing normalized object paths.
- DELETE accepts only `imageId`; the server loads the row using both `id` and `repair_id` before deleting its normalized object path.

- [ ] Write failing API tests for authorized path attachment, arbitrary URL rejection, row-scoped deletion, and cross-repair image ID denial.
- [ ] Run the focused test and confirm it fails against the URL-based contract.
- [ ] Implement POST/DELETE, update repair creation to normalize every `images[]` entry, and remove URL-authoritative deletion.
- [ ] Update both upload UIs and the hook to persist `path` while showing the temporary `url` preview.
- [ ] Run the API tests and focused component/type tests.
- [ ] Commit with `fix(repairs): persist private image paths`.

### Task 4: Authorized signed reads

**Files:**
- Create: `src/lib/repairs/sign-repair-images.ts`
- Modify: `src/app/api/repairs/_lib.ts`
- Modify: `src/app/api/repairs/route.ts`
- Modify: `src/app/api/repairs/[id]/route.ts`
- Modify: `src/app/api/repairs/[id]/images/route.ts`
- Modify: `src/app/api/public/repairs/[ticketId]/images/route.ts`
- Test: `src/lib/repairs/sign-repair-images.test.ts`
- Test: `src/app/api/public/repairs/[ticketId]/private-images.test.ts`

**Interfaces:**
- Produces: `signRepairImages(admin, rows): Promise<Array<Row & { image_url: string | null }>>`
- All outward repair image payloads expose a temporary signed URL in `image_url`; stored paths remain server-only.

- [ ] Write failing helper tests for mixed legacy/path rows and signing failure without public-URL fallback.
- [ ] Write failing public-route tests for valid token signing and cross-ticket denial.
- [ ] Implement the signer and call it only after each route's existing staff/tenant or public-token authorization succeeds.
- [ ] Ensure list/detail responses that embed `repair_images` pass through the signer before serialization.
- [ ] Run both focused suites and the existing public repair/status tests.
- [ ] Commit with `feat(repairs): sign authorized repair images`.

### Task 5: Database and bucket cutover

**Files:**
- Create: `supabase/migrations/20260928012000_make_repair_images_private.sql`
- Create: `src/lib/repairs/private-repair-images-migration.test.ts`

**Interfaces:**
- Consumes: dual-read code from Tasks 1–4.
- Produces: private `repair-images`, internal paths in `image_url`, and tenant-scoped `repair_images` policies.

- [ ] Write a failing SQL contract test requiring: preflight rejection of unrecognized values, URL-to-path conversion, `storage.buckets.public = false`, removal of public Storage SELECT policies, and repair-parent organization checks in every client policy.
- [ ] Run the focused test and confirm the migration is absent.
- [ ] Implement an idempotent migration that aborts before privacy cutover if any row cannot be normalized.
- [ ] Apply it to Docker with `npx supabase migration up --local` and verify all local migration tests.
- [ ] Query Docker to confirm the bucket is private and no `repair_images` client policy relies only on a global role.
- [ ] Commit with `fix(db): make repair images tenant private`.

### Task 6: Health diagnostics and release gate

**Files:**
- Modify: `src/lib/health/checks/supabase.ts`
- Create: `src/lib/health/public-bucket-audit.ts`
- Test: `src/lib/health/public-bucket-audit.test.ts`

**Interfaces:**
- Produces: bounded bucket inspection that classifies `repair-images` public as HIGH, permits known public asset buckets, and reports counts/MIME without object names.

- [ ] Write failing classification tests for public repair images, public product/avatar images, unknown public buckets, pagination cap, and list failure.
- [ ] Run the focused test and confirm the name-only check fails the contract.
- [ ] Implement bounded inspection and integrate it into `storage.public_buckets`.
- [ ] Run focused tests, `npm run typecheck:fast`, `npm run lint`, and `git diff --check`.
- [ ] Build the Docker production image and exercise upload, staff read, public-token read, and deletion locally.
- [ ] Commit with `fix(health): inspect public bucket exposure`.

### Task 7: Ordered production rollout

**Files:**
- No new source files; deployment and verification only.

**Interfaces:**
- Consumes: commits from Tasks 1–6 and the reversible migration from Task 5.

- [ ] Push the dual-read code and deploy it while `repair-images` remains public.
- [ ] Verify an existing staff repair image and a valid public tracking image still load.
- [ ] Apply the private-bucket migration remotely only after that deployment is healthy.
- [ ] Verify all five existing objects remain reachable only through authorized application flows; direct public object URLs must return denial.
- [ ] Run `/superadmin/system-health` and confirm `repair-images` is private, while `product-images` and `avatars` are classified as intentional public assets.
- [ ] If authorized flows fail, revert only the bucket flag to public and retain all objects and normalized paths for investigation.
