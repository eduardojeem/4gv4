# Onboarding branch name and module recommendations

## Intent

Make the shared onboarding clearer for a new business owner: distinguish the business name from the name of its main branch, and show which setup preferences are recommended for the selected business category and subscription plan.

## Goals

- Explain that the branch field names a physical location or point of service; a single-location business may reuse its business name, while multiple locations should use a distinguishing branch name.
- Mark category-based module preferences as recommended only when the current plan entitles that module.
- Preserve the current checkbox list, defaults, manual selection, plan restrictions, save payload, and mobile-compatible shared state.

## Non-goals and constraints

- Do not change subscription entitlements, module activation, API/database contracts, migrations, mobile layout, or onboarding persistence.
- A recommendation is a user preference only; it must never grant a plan capability.
- Keep unavailable plan modules disabled and identified as not included.

## Approaches

- **Selected: keep the current list and mark recommendations.** Add concise branch guidance and a “Recomendado” marker to the existing preference rows based on the current category and effective entitlements. This preserves the flow and selection behavior while making the guidance visible.
- **Not selected: split the list into recommended and other groups.** This adds layout and navigation weight without changing the underlying recommendations; the user chose to keep the current list.

## Implementation calls

- The branch field keeps the label “Nombre de la sucursal” and explains when it may match the business name.
- Recommended module keys come from `suggestOnboardingPreferences(businessCategory, entitledModules)`.
- Tests must prove category-specific recommendations, plan filtering, and the rendered branch explanation and recommendation marker.
