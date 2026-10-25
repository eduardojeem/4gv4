function isPrivateIpv4(hostname) {
  const octets = hostname.split('.').map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;

  return octets[0] === 10
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    || (octets[0] === 192 && octets[1] === 168);
}

function localUrl(value) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    const isLocalHost = hostname === 'localhost'
      || hostname === '::1'
      || hostname.startsWith('127.')
      || isPrivateIpv4(hostname);
    return url.protocol === 'http:' && isLocalHost ? url : null;
  } catch {
    return null;
  }
}

function jwtProjectReference(key) {
  if (!key || typeof key !== 'string') return null;
  const parts = key.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return typeof payload.ref === 'string' ? payload.ref : null;
  } catch {
    return null;
  }
}

const PRODUCTION_PROJECT_REF = 'cswtugmwazxdktntndpy';
const LOCAL_SUPABASE_PORT = '55321';

function normalizedLocalUrl(value, { kind, allowPrivateLan = false }) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    const localLoopback = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
    const localLan = allowPrivateLan && isPrivateIpv4(hostname);
    const expectedPort = kind === 'site' ? '3000' : LOCAL_SUPABASE_PORT;

    if (url.protocol !== 'http:' || (!localLoopback && !localLan)
      || url.port !== expectedPort || url.username || url.password
      || url.search || url.hash || (url.pathname !== '' && url.pathname !== '/')) {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}

function hasProductionProjectReference(...environments) {
  return environments.some((environment) => Object.values(environment ?? {}).some((value) =>
    typeof value === 'string' && value.toLowerCase().includes(PRODUCTION_PROJECT_REF)));
}

function requireConfiguredValue(environment, key) {
  return typeof environment?.[key] === 'string' && environment[key].trim().length >= 10;
}

function assertSafeSmokeAppEnvironment(appEnv) {
  if (hasProductionProjectReference(appEnv)) {
    throw new Error('Mobile DEV smoke write rejected: Production Supabase target is forbidden.');
  }

  const siteUrl = normalizedLocalUrl(appEnv?.NEXT_PUBLIC_SITE_URL, { kind: 'site' });
  if (!siteUrl) {
    throw new Error('Mobile DEV smoke write rejected: NEXT_PUBLIC_SITE_URL must be a local application URL.');
  }

  const supabaseUrl = normalizedLocalUrl(appEnv?.NEXT_PUBLIC_SUPABASE_URL, { kind: 'supabase' });
  if (!supabaseUrl) {
    throw new Error('Mobile DEV smoke write rejected: Next.js must target the isolated local Supabase instance.');
  }

  for (const key of ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
    if (!requireConfiguredValue(appEnv, key)) {
      throw new Error('Mobile DEV smoke write rejected: application configuration is incomplete.');
    }
  }

  for (const key of ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
    const keyRef = jwtProjectReference(appEnv[key]);
    if (keyRef === PRODUCTION_PROJECT_REF) {
      throw new Error('Mobile DEV smoke write rejected: Production Supabase credentials are forbidden.');
    }
  }

  return { siteUrl, supabaseUrl };
}

export function assertSafeMobileSmokeEnvironment({ appEnv, mobileEnv }) {
  if (hasProductionProjectReference(appEnv, mobileEnv)) {
    throw new Error('Mobile DEV smoke write rejected: Production Supabase target is forbidden.');
  }

  const { siteUrl, supabaseUrl } = assertSafeSmokeAppEnvironment(appEnv);
  const mobileSupabaseUrl = normalizedLocalUrl(mobileEnv?.EXPO_PUBLIC_SUPABASE_URL, {
    kind: 'supabase',
    allowPrivateLan: true,
  });
  if (!mobileSupabaseUrl || !requireConfiguredValue(mobileEnv, 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY')) {
    throw new Error('Mobile DEV smoke write rejected: mobile Supabase configuration is incomplete or not local.');
  }

  return {
    siteHost: siteUrl.hostname,
    supabasePort: supabaseUrl.port,
    expectedSiteOrigin: siteUrl.origin,
    expectedSupabaseOrigin: supabaseUrl.origin,
  };
}

export function assertSafeEffectiveSmokeRuntime({ appEnv, expectedSiteOrigin, expectedSupabaseOrigin }) {
  const { siteUrl, supabaseUrl } = assertSafeSmokeAppEnvironment(appEnv);
  if (siteUrl.origin !== expectedSiteOrigin || supabaseUrl.origin !== expectedSupabaseOrigin) {
    throw new Error('Mobile DEV smoke write rejected: effective local runtime does not match the validated configuration.');
  }
  return true;
}

export async function withSafeMobileSmokeTarget({ appEnv, mobileEnv, verifyEffectiveTarget, run }) {
  const expectedTarget = assertSafeMobileSmokeEnvironment({ appEnv, mobileEnv });
  let targetVerified = false;
  try {
    targetVerified = await verifyEffectiveTarget(expectedTarget) === true;
  } catch {
    targetVerified = false;
  }
  if (!targetVerified) {
    throw new Error('Mobile DEV smoke write rejected: effective local runtime could not be verified.');
  }
  return run();
}

export function assertSafeDevelopmentEnvironment(env) {
  const urlValue = env.NEXT_PUBLIC_SUPABASE_URL;
  const url = localUrl(urlValue);
  if (!url) {
    throw new Error('Refusing to start Next.js DEV: NEXT_PUBLIC_SUPABASE_URL must point to a local Supabase instance over HTTP.');
  }

  for (const keyName of ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
    if (typeof env[keyName] !== 'string' || env[keyName].trim().length < 10) {
      throw new Error(`Refusing to start Next.js DEV: ${keyName} is missing or invalid; production fallback is disabled.`);
    }
  }

  const expectedRef = url.hostname.split('.')[0];
  for (const keyName of ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
    const keyRef = jwtProjectReference(env[keyName]);
    if (keyRef && keyRef !== expectedRef) {
      throw new Error(`Refusing to start Next.js DEV: ${keyName} does not match the local Supabase URL.`);
    }
  }

  return url;
}
