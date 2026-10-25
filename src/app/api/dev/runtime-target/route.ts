import { assertSafeEffectiveSmokeRuntime } from '../../../../../scripts/dev-env-guard.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isLoopbackSmokeRequest(request: Request): boolean {
  try {
    const host = request.headers.get('host');
    if (!host) return false;
    const parsed = new URL(`http://${host}`);
    const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    return parsed.port === '3000'
      && (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1');
  } catch {
    return false;
  }
}

export async function GET(request: Request): Promise<Response> {
  if (process.env.NODE_ENV !== 'development' || !isLoopbackSmokeRequest(request)) {
    return new Response(null, { status: 404 });
  }

  try {
    assertSafeEffectiveSmokeRuntime({
      appEnv: process.env,
      expectedSiteOrigin: request.headers.get('x-dev-expected-site-origin') ?? '',
      expectedSupabaseOrigin: request.headers.get('x-dev-expected-supabase-origin') ?? '',
    });
    return Response.json({ safe: true }, { headers: { 'cache-control': 'no-store' } });
  } catch {
    return Response.json({ safe: false }, { status: 503, headers: { 'cache-control': 'no-store' } });
  }
}
