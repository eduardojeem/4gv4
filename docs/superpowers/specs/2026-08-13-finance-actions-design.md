# Finance Action Flow Design

## Goal

Prioritize the next financial action, shorten date filtering, and make payroll progress obvious without changing finance calculations or authorization.

## Scope

- Add a summary action panel for overdue items, upcoming due dates, missing coverage, and pending payroll review.
- Add date shortcuts for today, this week, this month, and previous month.
- Render payroll as explicit prepare, review, approve, and pay stages.
- Keep current APIs, filters, totals, payment rules, approval confirmation, and branch scope unchanged.

## Verification

- Test action-panel navigation to Expenses and Payroll.
- Test a date shortcut sends a bounded DateRange.
- Test payroll text distinguishes draft review from approved payment.
