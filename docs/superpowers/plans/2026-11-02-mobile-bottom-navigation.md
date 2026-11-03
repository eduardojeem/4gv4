# Mobile bottom navigation implementation plan
Goal: contextual floating navigation and organization Appearance colors.
Architecture: pure contrast/navigation model, shared native surface, optional branding fields in tenant dashboard.
Constraints: local only, preserve dirty work; no dependencies, commits, deploys or database writes.
1. Resolve branding and capabilities; refresh after Appearance save.
2. Integrate Panel and Admin, keyboard hiding and contextual action sheet.
3. Verify models, types, lint and fresh-context review.
Ruling: saved organization Appearance is the existing color preference. Both agenda and repairs visible means mixed creation menu. Agenda create follows existing POST guard pos.sales.read, without changing authorization.
