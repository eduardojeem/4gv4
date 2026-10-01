# Image Delivery Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize new public raster uploads before storage, cache them immutably in Supabase, and avoid unnecessary Vercel image transformations while keeping every existing image URL valid.

**Architecture:** A shared profile module defines the product, banner, and logo contracts. Browser product uploads use the existing `browser-image-compression`; authenticated server upload routes use an explicit `sharp@0.35.5` dependency. Storage always receives the final MIME, immutable path, and one-year cache metadata, while rendering bypasses Vercel only for sources already known to be normalized or intrinsically unsuitable for transformation.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase Storage, `browser-image-compression`, `sharp@0.35.5`, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-01-image-delivery-optimization-design.md`

## Global Constraints

- Product profile: WebP, maximum 1280 px, target 200 KB.
- Banner profile: WebP, maximum 1920 px, target 400 KB.
- Logo profile: WebP, maximum 512 px, target 100 KB.
- Preserve admitted SVG and animated GIF instead of rasterizing them.
- New public objects use unique paths, `cacheControl: '31536000'`, the final MIME type, and `upsert: false`.
- Do not migrate, delete, or rewrite existing image URLs or database columns.
- Never expose `service_role`; existing route guards and tenant resolution remain mandatory.
- Private repair images are outside this plan.

## Review Focus

- Corrupt files with a plausible MIME must be rejected before Storage upload; Task 4 tests decoder failure.
- Transparent PNG logos must preserve useful alpha in WebP output; Task 4 tests an alpha fixture.
- Animated GIF must not silently become a static WebP; Task 4 tests pass-through behavior.
- A failed product optimization must not fall back to uploading a multi-megabyte original; Task 2 tests rejection.
- Existing JPG/PNG URLs and external validated URLs must render unchanged; Task 7 tests legacy compatibility.

---

### Task 1: Shared upload profiles

**Files:**
- Create: `src/lib/images/upload-profiles.ts`
- Test: `src/lib/images/upload-profiles.test.ts`

**Interfaces:**
- Produces: `ImageUploadProfileName = 'product' | 'banner' | 'logo'`, `IMAGE_UPLOAD_PROFILES`, `PUBLIC_IMAGE_CACHE_CONTROL = '31536000'`, and `replaceImageExtension(name: string, extension: string): string`.

- [ ] **Step 1: Write failing profile tests** asserting the three exact dimensions/byte targets, cache value, and filename conversion for `.jpg`, `.PNG`, names without extensions, and unsafe repeated extensions.
- [ ] **Step 2: Run** `npx vitest run src/lib/images/upload-profiles.test.ts`; expect failure because the module does not exist.
- [ ] **Step 3: Implement the constants, readonly profile type, and filename helper** in `src/lib/images/upload-profiles.ts`.
- [ ] **Step 4: Re-run the test** and expect all assertions to pass.
- [ ] **Step 5: Commit** with `feat(images): define upload optimization profiles`.

### Task 2: Browser product normalization

**Files:**
- Create: `src/lib/images/client-upload-optimizer.ts`
- Create: `src/lib/images/client-upload-optimizer.test.ts`
- Modify: `src/components/dashboard/products/ImageUploader.tsx`
- Modify: `src/components/dashboard/product-modal.tsx`
- Test: `src/components/dashboard/products/ImageUploader.test.tsx`

**Interfaces:**
- Consumes: `IMAGE_UPLOAD_PROFILES.product`, `replaceImageExtension()`.
- Produces: `optimizeImageFile(file: File, profileName: ImageUploadProfileName, onProgress?: (percent: number) => void): Promise<File>` returning `image/webp` with a `.webp` name for raster input.

- [ ] **Step 1: Write failing optimizer tests** mocking `browser-image-compression`; assert `maxSizeMB: 0.2`, `maxWidthOrHeight: 1280`, `fileType: 'image/webp'`, progress forwarding, `.webp` output, and rejection when compression throws.
- [ ] **Step 2: Run** `npx vitest run src/lib/images/client-upload-optimizer.test.ts`; expect failure because the function is absent.
- [ ] **Step 3: Implement `optimizeImageFile()`** without an original-file fallback and with exact output MIME/name normalization.
- [ ] **Step 4: Add a failing `ImageUploader` test** proving `onUploadFiles` receives the normalized WebP and that an optimizer failure produces no upload.
- [ ] **Step 5: Replace the component-local compression function** with `optimizeImageFile(file, 'product', progressCallback)` and make `product-modal.tsx` derive its storage extension from the normalized file.
- [ ] **Step 6: Run both tests** and expect pass.
- [ ] **Step 7: Commit** with `feat(images): normalize product uploads to webp`.

### Task 3: Supabase upload cache metadata

**Files:**
- Modify: `src/lib/supabase-storage.ts`
- Create: `src/lib/supabase-storage.test.ts`
- Modify: `src/components/dashboard/product-modal.tsx`

**Interfaces:**
- Consumes: `PUBLIC_IMAGE_CACHE_CONTROL`.
- Produces: `UploadFileOptions = { upsert?: boolean; cacheControl?: string; contentType?: string }`; `uploadFile()` forwards the options to Supabase and the server fallback form.

- [ ] **Step 1: Write failing Storage tests** asserting product uploads call `.upload(path, file, { upsert: false, cacheControl: '31536000', contentType: 'image/webp' })` and preserve explicit caller values.
- [ ] **Step 2: Run** `npx vitest run src/lib/supabase-storage.test.ts`; expect mismatch with the current options.
- [ ] **Step 3: Extend `uploadFile()` options and fallback form fields**; keep the repair-only server fallback restriction unchanged.
- [ ] **Step 4: Update product upload call** to pass the immutable cache value, normalized MIME, and `upsert: false`.
- [ ] **Step 5: Run Storage and product uploader tests** and expect pass.
- [ ] **Step 6: Commit** with `perf(storage): cache normalized product images immutably`.

### Task 4: Server-side raster normalization

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/lib/images/server-upload-optimizer.ts`
- Create: `src/lib/images/server-upload-optimizer.test.ts`

**Interfaces:**
- Consumes: profile constants and filename helper from Task 1.
- Produces: `optimizeServerImage(input: Buffer, inputMime: string, originalName: string, profileName: ImageUploadProfileName): Promise<{ buffer: Buffer; mimeType: string; extension: string; fileName: string; width?: number; height?: number }>`.

- [ ] **Step 1: Install and pin** `sharp@0.35.5` with `npm install --save-exact sharp@0.35.5`.
- [ ] **Step 2: Write failing tests** using tiny PNG/JPEG fixtures; assert WebP output, maximum dimensions, alpha preservation, SVG/GIF pass-through, and corrupt raster rejection.
- [ ] **Step 3: Run** `npx vitest run src/lib/images/server-upload-optimizer.test.ts`; expect failure because the module does not exist.
- [ ] **Step 4: Implement the server-only optimizer** with metadata-based validation, fit-inside resize without enlargement, bounded quality attempts, and no catch-and-upload-original fallback.
- [ ] **Step 5: Re-run tests** and expect pass.
- [ ] **Step 6: Commit** with `feat(images): add server upload normalization`.

### Task 5: Website media routes

**Files:**
- Modify: `src/app/api/admin/website/media/route.ts`
- Modify: `src/app/api/admin/website/logo/route.ts`
- Modify: `src/app/api/admin/website/brand-logo/route.ts`
- Modify: `src/app/api/admin/website/promotion-image/route.ts`
- Create: `src/test/website-image-upload-routes.test.ts`

**Interfaces:**
- Consumes: `optimizeServerImage()`, profile constants, and `PUBLIC_IMAGE_CACHE_CONTROL`.
- Produces: existing response JSON shapes and paths, with normalized raster extension/MIME/size.

- [ ] **Step 1: Write failing route contract tests** asserting banners use `banner`, logos use `logo`, raster paths end in `.webp`, upload options include immutable cache metadata, SVG remains SVG, and auth/organization failures still short-circuit before processing.
- [ ] **Step 2: Run** `npx vitest run src/test/website-image-upload-routes.test.ts`; expect failure on original MIME/path behavior.
- [ ] **Step 3: Integrate the shared optimizer in each route** after input-size/type validation and before path construction; record optimized byte size in the media library.
- [ ] **Step 4: Remove timestamp query strings for new immutable paths** while keeping URL parsing compatible with existing `?v=` URLs.
- [ ] **Step 5: Run route and media-library tests** and expect pass.
- [ ] **Step 6: Commit** with `perf(images): normalize website media before storage`.

### Task 6: Platform and global-brand routes

**Files:**
- Modify: `src/app/api/superadmin/platform-branding/logo/route.ts`
- Modify: `src/app/api/superadmin/global-brands/logo/route.ts`
- Create: `src/test/superadmin-image-upload-routes.test.ts`

**Interfaces:**
- Consumes: `optimizeServerImage(..., 'logo')` and immutable cache metadata.
- Produces: unchanged authorization and response contracts with normalized raster files.

- [ ] **Step 1: Write failing route tests** for unauthorized access, WebP normalization, SVG preservation where admitted, final MIME, immutable path, and audit-log continuity.
- [ ] **Step 2: Run** `npx vitest run src/test/superadmin-image-upload-routes.test.ts`; expect original upload options to fail assertions.
- [ ] **Step 3: Integrate logo normalization and cache metadata** without moving or weakening `getSuperAdminUser()` checks.
- [ ] **Step 4: Run new tests plus existing superadmin security tests** and expect pass.
- [ ] **Step 5: Commit** with `perf(images): normalize platform branding uploads`.

### Task 7: Selective delivery policy and width budget

**Files:**
- Modify: `src/lib/images.ts`
- Modify: `src/lib/image-url-policy.test.ts`
- Modify: `next.config.ts`
- Modify only where needed: public image components that currently force a contradictory `unoptimized` value.

**Interfaces:**
- Produces: `shouldBypassImageOptimization()` returns true for normalized `.webp` objects in the Supabase `product-images` bucket, SVG/GIF/data/blob, and existing already-optimized hosts; legacy Supabase JPG/PNG and validated external URLs remain compatible.

- [ ] **Step 1: Extend failing policy tests** for normalized Supabase WebP, legacy Supabase JPG/PNG, query strings, external URLs, SVG/GIF, and local static assets.
- [ ] **Step 2: Run** `npx vitest run src/lib/image-url-policy.test.ts src/components/ui/app-image.test.tsx`; expect the normalized WebP assertion to fail.
- [ ] **Step 3: Implement the selective bypass rule** without globally setting `images.unoptimized`.
- [ ] **Step 4: Reduce Next width allowlists** to `deviceSizes: [640, 768, 1280, 1536]` and `imageSizes: [32, 64, 128, 256, 384]`; retain `formats: ['image/webp']`, `qualities: [75]`, and one-year `minimumCacheTTL` for the few optimized assets.
- [ ] **Step 5: Update only components whose explicit prop overrides the central policy**, retaining accurate `sizes` values and layout dimensions.
- [ ] **Step 6: Run policy, component, and public-page performance tests** and expect pass.
- [ ] **Step 7: Commit** with `perf(images): bypass transformations for normalized storage assets`.

### Task 8: End-to-end verification and operational proof

**Files:**
- Modify if generated: `src/lib/health/generated/code-audit.json`
- Modify only if behavior changed: `src/test/public-page-performance-contract.test.ts`

**Interfaces:**
- Consumes all previous task contracts.
- Produces verification evidence; no new public API.

- [ ] **Step 1: Run focused suites** for upload profiles, client/server optimizers, Storage, affected routes, image policy, AppImage, and System Health; require zero failures.
- [ ] **Step 2: Run** `npm run typecheck`, focused ESLint on every changed TypeScript file, and `git diff --check`; require exit code 0.
- [ ] **Step 3: Run** `npm run build`; require final exit code 0. If Turbopack stalls again, stop it, record build as unverified, and do not claim success.
- [ ] **Step 4: In a local or preview environment, upload one JPG product, one transparent PNG logo, and one banner**; assert stored extension/MIME/dimensions/size and that legacy images still render.
- [ ] **Step 5: After an authorized deployment, inspect one new public object**; require `Cache-Control` reflecting one-year TTL and verify no `/_next/image` request for normalized Supabase WebP.
- [ ] **Step 6: Check Vercel Observability and System Health**; record the baseline and post-deploy Image Optimization counts rather than claiming savings from static analysis.
- [ ] **Step 7: Commit any generated manifest change separately** with `chore(health): refresh code audit manifest`.
