# Main sections menu audit and improvements

Scope: panel section drawer opened by hamburger and More. Preserve Profile menu, role filtering, routes, financial logic and previous dirty work. Local only; no publication or backend mutations.

Audit: exact-route selection missed details; search missed accents, mobile names and category labels; rows hid descriptions; keyboard did not resize drawer. Brand colors were hardcoded and repeated taps could start overlapping close animations.

Implementation: pure search/route model tested against authorized input; wider drawer with quick shortcuts from existing permitted bottom navigation, visible descriptions, web indicators, clear active state, saved organization color, keyboard avoidance, safe close then navigate, loading/error/retry states.

Validation: model tests plus bottom navigation tests; mobile TypeScript and changed-file lint. Native device visual verification remains pending.
