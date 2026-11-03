# Local testing with real data

Web: http://localhost:3000/login
LAN API and web: http://192.168.0.4:3000
Expo Go: exp://192.168.0.4:8081 (SDK 57, same LAN required).

Both servers run from the mobile-notifications-audit worktree, including the accumulated local changes. No files were copied to the main checkout, no release was published, and no seed or migration was run.

Explicit launch commands (existing credentials stay in the source environment file and server process; Expo receives only the public Supabase URL/key):

node scripts/dev-real-data.mjs web --env-file C:/proyecto/mitiendapy/.env.local --allow-real-data
node scripts/dev-real-data.mjs expo --env-file C:/proyecto/mitiendapy/.env.local --allow-real-data

The ordinary isolated development and smoke guards remain unchanged. The real-data mobile mode requires DEV plus an explicit opt-in, the known real Supabase project and local API on port 3000. It is rejected in release runtime.

Evidence: web login HTTP 200; mobile dashboard without session HTTP 401; Expo manifest/status HTTP 200; Android bundle HTTP 200; real Supabase Auth settings HTTP 200. 22 environment tests passed, mobile TypeScript and changed-file lint passed. Actual authenticated user flows require manual login; no password/session was requested or reused.

Saving through these UIs affects real data. The LAN IP is discovered again on each launch; use the new address printed by the launcher if the network changes.
