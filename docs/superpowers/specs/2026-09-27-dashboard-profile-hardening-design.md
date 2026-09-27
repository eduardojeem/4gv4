# Dashboard Profile Hardening Design

## Objective

Make `/dashboard/profile` trustworthy: users edit only personal fields, receive accurate persistence feedback, and public data comes from the same canonical fields.

## Scope

This covers the profile UI, server API, `profiles` grants and RLS, preferences, `/perfil/[username]`, public verification/contact/share behavior, and focused tests. It does not create notification delivery, localization, follower, or publishing systems. Controls without consumers are labeled unavailable.

## Security Model

The API accepts only `fullName`, `avatarUrl`, `phone`, `department`, `jobTitle`, `location`, `bio`, `website`, `timezone`, `socialLinks`, and `preferences`. A strict schema rejects `id`, `email`, `role`, `permissions`, `status`, organization identifiers, publication state, usernames, and unknown properties.

Email is read-only and comes from Auth. Publication stays in the marketplace flow because it requires `username` and `is_public`.

`GET /api/dashboard/profile` authenticates server-side and returns the caller's profile plus Auth email and verification state. `PATCH` authenticates, validates a strict patch, and updates only allowlisted columns for the caller. The browser no longer writes directly to `profiles`.

Database and Auth failures are reported. State is not marked saved until the authoritative write succeeds. Auth synchronization for name, phone, and avatar is awaited. A database success followed by Auth failure is reported as partial synchronization and triggers an authoritative reload.

A migration revokes broad `ALL` access from `anon` and `authenticated`, grants required SELECT/INSERT access, grants UPDATE only on non-privileged columns, preserves service-role access, and replaces consolidated policies with explicit self, same-organization, and super-admin rules.

Self-service authorizes only `id = auth.uid()`. Staff can read profiles only when both users share an active organization. Organization administrators can update another profile only in that shared organization and never a super-admin. Only super-admin has global administration. Column grants protect `role`, `permissions`, and `status`; RLS supplies row isolation.

## Canonical Profile Contract

`profiles` remains canonical:

| Dashboard field | Canonical column | Public output |
| --- | --- | --- |
| name | `full_name` | display name |
| job title | `job_title` | title |
| avatar | `avatar_url` | avatar |
| bio | `bio` | biography |
| location | `location` | location |
| website | `website` | website link |
| social networks | `social_links` JSONB | normalized links |

The public page reads these columns directly instead of duplicate `display_name`, `title`, or relational social links for dashboard-managed data. Existing creator tables may remain for compatibility.

## Preferences

Preferences remain in `profiles.preferences` as an allowlisted object saved through the API. The cache key includes the user ID. Local storage is cache only and cannot turn a failed remote save into success. Cloud-sync status requires a successful remote load or write.

Theme and color scheme remain active through `ThemeContext`; timezone remains canonical. Controls without consumers—language, compact mode, autosave scheduling, notification delivery, marketing subscription, and dark-mode scheduling—are removed or disabled with `Próximamente` and make no operational claims.

## Public Profile

The route requires `username` and `is_public = true`. Verification comes from real data. Contact appears only with a valid, intentionally public destination; a display name is never used as an email. Share uses Web Share with clipboard fallback. Operational query failures are distinct from a genuine 404.

No email, phone, or private field becomes public merely because a profile is published. Until an explicit public-contact contract exists, the email contact form is hidden.

## UI States

The dashboard distinguishes loading, synchronized, dirty, saving, saved, partial Auth failure, database failure, and unavailable features. There is one primary save action per viewport. Navigation with unsaved changes receives a confirmation guard. Completion shortcuts target focusable controls, including the avatar upload control.

## Testing

Route tests cover authentication, strict rejection of privileged fields, column mapping, database failure, partial Auth failure, and authoritative preferences. Database contract tests cover protected columns, self-update, cross-organization denial, scoped admin access, super-admin access, and anonymous public reads. UI tests cover user-scoped caches, dirty state on failure, sync labels, unavailable controls, focus targets, canonical public mapping, verification, contact, and sharing.

## Rollout

The migration ships before or with the API. No profile is automatically published and no private field is newly exposed. Because the baseline does not fully represent the connected database's public columns, the migration uses guarded policy replacement, explicit grants, and existing-column checks. It is validated locally and, when credentials permit, with Supabase advisors and live metadata.

## Success Criteria

- Browser clients cannot self-assign roles or permissions.
- Profile access respects organization boundaries.
- Success is reported only after authoritative persistence.
- Users sharing a browser do not reuse preference caches.
- Publishable fields use one canonical contract.
- Verification and contact claims are evidence-based.
- Focused route, UI, and database tests pass, followed by lint, typecheck, and the applicable full suite.
