# Onboarding branch and module recommendations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clarify the main branch name and visually mark onboarding preferences recommended for the selected business category and entitled plan modules.

**Architecture:** Keep the shared onboarding state, recommendation helper, and save contract unchanged. Derive recommendation badges from `suggestOnboardingPreferences` and add explanatory copy to the existing wizard.

**Tech Stack:** Next.js, React, TypeScript, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-25-onboarding-branch-and-module-recommendations-design.md`

## Global Constraints

- Do not change subscription entitlements or the meaning of selected module preferences.
- Do not modify API, database, migration, or mobile behavior.
- Preserve current manual selection and disable modules not included in the plan.
- Preserve unrelated working-tree changes and do not commit, push, or deploy.

## Review Focus

- A module recommended by its category but absent from plan entitlements must not be marked recommended or enabled.
- Changing the business category must continue to recalculate default selections without changing the save contract.
- A one-location business may reuse its business name; multi-location branch names should distinguish locations.
- Recommendation badges must not imply that a preference activates a module outside the plan.

---

### Task 1: Verify category and plan recommendation behavior

**Files:**
- Modify: `src/lib/onboarding/shared-setup.test.ts`
- Existing logic: `src/lib/onboarding/shared-setup.ts`

**Interfaces:**
- Consumes: `suggestOnboardingPreferences(businessCategory, entitledModules)`.
- Produces: regression coverage for category-specific recommendation keys filtered by effective plan entitlements.

- [ ] **Step 1: Add tests** named `suggests electronics tools allowed by the plan`, `recalculates recommendations for the selected category`, and `omits category suggestions excluded by plan entitlements`, proving electronics recommends POS/inventory/repairs when entitled and another category yields its own set.
- [ ] **Step 2: Run the focused test** with `node node_modules/vitest/vitest.mjs run src/lib/onboarding/shared-setup.test.ts`; expected: PASS (or a failure that identifies a real mismatch in the existing helper).

### Task 2: Improve branch and module preference guidance

**Files:**
- Modify: `src/components/dashboard/onboarding/SharedOnboardingWizard.tsx`
- Create: `src/components/dashboard/onboarding/SharedOnboardingWizard.test.tsx`

**Interfaces:**
- Consumes: `SharedOnboardingState`, `planName`, `entitledModules`, and `suggestOnboardingPreferences`.
- Produces: accessible copy for branch naming and “Recomendado” markers on eligible preference rows; no new persisted fields or changed save payload.

- [ ] **Step 1: Add component tests** named `explains how to name the main branch`, `marks entitled category preferences as recommended`, and `keeps unentitled preferences disabled and not recommended`, covering branch naming, category-and-plan badges, and unavailable features.
- [ ] **Step 2: Run the component tests** with `node node_modules/vitest/vitest.mjs run src/components/dashboard/onboarding/SharedOnboardingWizard.test.tsx`; expected: FAIL because the guidance and marker do not yet exist.
- [ ] **Step 3: Update the existing wizard** with concise branch-name helper copy and badges driven by `suggestOnboardingPreferences`; keep checkboxes, selection defaults, and save behavior unchanged.
- [ ] **Step 4: Run both focused test files**; expected: PASS.
- [ ] **Step 5: Run TypeScript, ESLint on changed TypeScript files, and `git diff --check`; expected: PASS with no new diagnostics.
