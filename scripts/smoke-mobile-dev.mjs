import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { withSafeMobileSmokeTarget } from './dev-env-guard.mjs';

const root = process.cwd();
const base = 'http://127.0.0.1:3000';
const branchId = 'a1000000-0000-4000-8000-000000000011';
const allowLocalWrites = process.argv.includes('--allow-local-writes');

async function runSmoke(env, mobileEnv) {
  let failed = false;

  const loginResponse = await fetch(`${base}/api/mobile/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: env.MOBILE_DEV_OWNER_EMAIL, password: env.MOBILE_DEV_TEST_PASSWORD }),
  });
  const login = await loginResponse.json().catch(() => null);
  const accessToken = typeof login?.access_token === 'string' ? login.access_token : null;
  const refreshToken = typeof login?.refresh_token === 'string' ? login.refresh_token : null;
  if (!accessToken || !refreshToken) {
    const safeCode = typeof login?.code === 'string' ? login.code : 'NO_TOKEN';
    console.log(`login POST /api/mobile/auth/login status=${loginResponse.status} user=no code=${safeCode}`);
    process.exitCode = 1;
    return;
  }
  console.log(`login POST /api/mobile/auth/login status=${loginResponse.status} user=yes org=yes branch=yes`);

  const mobileSupabase = createClient(mobileEnv.EXPO_PUBLIC_SUPABASE_URL, mobileEnv.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: restored, error: restoreError } = await mobileSupabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  const sessionUser = restoreError ? null : restored.session?.user;
  if (!sessionUser?.id) {
    console.log('session setSession Supabase local status=FAIL user=no');
    process.exitCode = 1;
    return;
  }
  console.log('session setSession Supabase local status=PASS user=yes');

  const headers = { Authorization: `Bearer ${accessToken}`, 'x-branch-id': branchId };
  const dashboardResponse = await fetch(`${base}/api/mobile/dashboard`, { headers });
  const dashboard = await dashboardResponse.json().catch(() => null);
  const organizationPresent = Boolean(dashboard?.organization?.id);
  const branchPresent = Boolean(organizationPresent);
  console.log(`dashboard /api/mobile/dashboard status=${dashboardResponse.status} user=yes org=${organizationPresent ? 'yes' : 'no'} branch=${branchPresent ? 'yes' : 'no'} count=${Array.isArray(dashboard?.groups) ? dashboard.groups.length : 0}`);

  const initialPosResponse = await fetch(`${base}/api/mobile/pos/session`, { headers });
  const initialPos = await initialPosResponse.json().catch(() => null);
  const localRegister = initialPos?.data?.registers?.[0];
  if (allowLocalWrites && initialPosResponse.ok && localRegister && !initialPos?.data?.session) {
    const opened = await fetch(`${base}/api/pos/cash-register`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ registerId: localRegister.id, branchId, openingBalance: 100000, note: 'Prueba sintética local DEV' }),
    });
    console.log(`POS abrir caja /api/pos/cash-register status=${opened.status} user=yes org=${organizationPresent ? 'yes' : 'no'} branch=${branchPresent ? 'yes' : 'no'} count=1`);
    if (!opened.ok) failed = true;
  } else if (!allowLocalWrites) {
    console.log('POS abrir caja status=SKIPPED writes=disabled');
  }

  const checks = [
    ['productos', '/api/products?limit=20', true],
    ['variantes', '/api/variants?product_id=a1000000-0000-4000-8000-000000000031', true],
    ['inventario', '/api/inventory/stats', true],
    ['clientes', '/api/customers?limit=20', true],
    ['POS', '/api/mobile/pos/session', true],
    ['reparaciones', '/api/repairs?limit=20', true],
    ['ventas', '/api/sales?per_page=20', true],
    ['marketplace', '/api/mobile/marketplace', false],
  ];

  for (const [label, path, authenticated] of checks) {
    const response = await fetch(`${base}${path}`, {
      headers: {
        ...(authenticated ? { Authorization: `Bearer ${accessToken}`, 'x-branch-id': branchId } : {}),
      },
    });
    const body = await response.json().catch(() => null);
    const orgPresent = authenticated && organizationPresent;
    const hasBranchHeader = authenticated && branchPresent;
    const arrays = body && typeof body === 'object'
      ? Object.values(body).filter(Array.isArray)
      : [];
    const nestedArrays = body?.data && typeof body.data === 'object'
      ? Object.values(body.data).filter(Array.isArray)
      : [];
    const count = arrays[0]?.length
      ?? body?.data?.length
      ?? nestedArrays[0]?.length
      ?? body?.data?.totalProducts
      ?? body?.data?.registers?.length
      ?? (body?.data?.session ? 1 : 0)
      ?? 0;
    const errorCode = typeof body?.code === 'string' ? ` code=${body.code}` : '';
    console.log(`${label} ${path} status=${response.status} user=${authenticated ? 'yes' : 'no'} org=${orgPresent ? 'yes' : 'no'} branch=${hasBranchHeader ? 'yes' : 'no'} count=${count}${errorCode}`);
    if (!response.ok) failed = true;
  }

  if (!dashboardResponse.ok) failed = true;
  process.exitCode = failed ? 1 : 0;
}

async function main() {
  let env;
  let mobileEnv;
  try {
    env = dotenv.parse(readFileSync(join(root, '.env.development.local')));
    mobileEnv = dotenv.parse(readFileSync(join(root, 'mobile', '.env.local')));
  } catch {
    throw new Error('Mobile DEV smoke rejected: required local configuration is missing.');
  }

  await withSafeMobileSmokeTarget({
    appEnv: env,
    mobileEnv,
    verifyEffectiveTarget: async ({ expectedSiteOrigin, expectedSupabaseOrigin }) => {
      let response;
      try {
        response = await fetch(`${base}/api/dev/runtime-target`, {
          headers: {
            'x-dev-expected-site-origin': expectedSiteOrigin,
            'x-dev-expected-supabase-origin': expectedSupabaseOrigin,
          },
          cache: 'no-store',
        });
      } catch {
        return false;
      }
      if (!response.ok) return false;
      const result = await response.json().catch(() => null);
      return result?.safe === true;
    },
    run: () => runSmoke(env, mobileEnv),
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Mobile DEV smoke rejected by the local safety guard.');
  process.exitCode = 1;
});
