# Finance Tables Design

## Goal

Make the Gastos and Rentabilidad tables faster to scan on desktop and readable without horizontal scrolling on mobile, without changing financial calculations or actions.

## Scope

- Preserve current data loading, filters, export, payment and void behavior.
- Add a compact table summary with record count and visible totals.
- Use semantic status badges and clear, right-aligned monetary values.
- Keep the desktop table; render equivalent stacked rows on small screens.
- Keep all existing row actions and keyboard-accessible controls.

## Design

The desktop table uses a muted header, stronger primary row labels, and secondary metadata below the main label. Amounts are aligned consistently so differences are immediately visible. The current status text becomes a readable badge with text as well as color.

On small screens, desktop columns are hidden and each item is presented as a bordered compact card. Each card shows its label, status, due date or coverage status, the important amounts, and existing actions. This avoids forced horizontal scrolling while preserving all information.

## Verification

- Component tests assert the descriptive status and amount labels are present for each table.
- Existing finance operation tests continue to pass.
- Typecheck, focused lint, and diff check remain clean.
