# Cloudflare Turnstile Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Protect every public password login and registration flow with Cloudflare Turnstile validated natively by Supabase Auth.

**Architecture:** A reusable client challenge owns Turnstile lifecycle and reports a short-lived token to each form. Login forms pass that token directly to `signInWithPassword`; registration pages send it to the existing API routes, which validate its shape and pass it once to Supabase `signUp`. Supabase remains the single server-side verifier so tokens are not consumed twice.

**Tech Stack:** Next.js 16.3, React 19.1, TypeScript 5.9, Supabase JS 2.75, `@marsidev/react-turnstile` 1.6, Vitest 4.

**Spec:** User-approved Turnstile design in the current task.

## Global Constraints

- Never hardcode or log the production secret.
- Preserve existing Supabase sessions, callbacks, roles, tenant routing, redirects, rate limits, and provisioning.
- Use Cloudflare's official always-pass site key only outside production when no local site key exists.
- Consume each Turnstile token exactly once and reset after every authentication attempt.
- Do not push changes.

---

### Task 1: Reusable challenge and configuration

**Files:**
- Create: `src/components/security/TurnstileChallenge.tsx`
- Create: `src/components/security/TurnstileChallenge.test.tsx`
- Modify: `.env.example`

**Interfaces:**
- Produces: `TurnstileChallenge({ onTokenChange, resetKey, action, theme?, disabled? })`.

- [ ] Write component tests for success, expiration, error, reset, missing production configuration, and accessible status messages.
- [ ] Run the focused test and verify it fails because the component does not exist.
- [ ] Implement explicit, responsive Turnstile rendering with the documented callbacks and development test site key fallback.
- [ ] Run the focused test and verify it passes.
- [ ] Add documented environment placeholders without modifying `.env.local`.

### Task 2: Protect login flows

**Files:**
- Modify: `src/app/login/page.tsx`
- Modify: `src/components/public/AuthModal.tsx`
- Modify: `src/app/[organizationSlug]/cliente/login/page.tsx`
- Test: focused component/auth contract tests created for this task.

**Interfaces:**
- Consumes: `TurnstileChallenge` token and reset lifecycle.
- Produces: `signInWithPassword({ email, password, options: { captchaToken } })`.

- [ ] Write failing tests proving submit stays disabled without a token and that login receives `captchaToken`.
- [ ] Run the focused tests and confirm the expected failures.
- [ ] Integrate the challenge in all three login surfaces, including pending/error/expired states and duplicate-submit protection.
- [ ] Reset the challenge after failed or completed attempts without exposing token data.
- [ ] Run the focused tests and confirm they pass.

### Task 3: Protect company and customer registration

**Files:**
- Modify: `src/app/register/page.tsx`
- Modify: `src/app/cliente/registro/page.tsx`
- Modify: `src/app/[organizationSlug]/cliente/registro/page.tsx`
- Modify: `src/app/api/auth/register-company/route.ts`
- Modify: `src/app/api/public/customer-register/route.ts`
- Modify: `src/lib/validation/saas.ts`
- Test: `src/app/api/auth/register-company/provisioning.test.ts`
- Test: new focused customer registration route test.

**Interfaces:**
- Consumes API JSON field: `captchaToken: string`.
- Produces Supabase signup option: `options.captchaToken` while preserving existing metadata.

- [ ] Write failing route tests proving a missing token is rejected before Supabase signup and a valid token is forwarded.
- [ ] Run the focused tests and confirm the expected failures.
- [ ] Add the token to client payloads and server validation schemas.
- [ ] Forward the token once to Supabase Auth and preserve provisioning behavior.
- [ ] Run the focused tests and confirm they pass.

### Task 4: Documentation and verification

**Files:**
- Create: `docs/security/cloudflare-turnstile.md`

- [ ] Document Cloudflare hostname configuration, Supabase Bot and Abuse Protection, Vercel variables, local dummy keys, token lifecycle, and troubleshooting.
- [ ] Run focused Vitest suites for the widget and auth routes.
- [ ] Run ESLint on changed source files, `npm run typecheck`, `git diff --check`, and `npm audit --omit=dev`.
- [ ] Review the final diff for secrets, unrelated edits, and preservation of user-owned package changes.
