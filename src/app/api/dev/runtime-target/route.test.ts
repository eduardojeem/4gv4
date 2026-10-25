import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

function localRequest(host = '127.0.0.1:3000') {
  return new Request('http://127.0.0.1:3000/api/dev/runtime-target', {
    headers: {
      host,
      'x-dev-expected-site-origin': 'http://localhost:3000',
      'x-dev-expected-supabase-origin': 'http://127.0.0.1:55321',
    },
  });
}

function setSafeLocalEnvironment() {
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:55321');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'local-anon-fixture');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'local-service-fixture');
}

afterEach(() => vi.unstubAllEnvs());

describe('GET /api/dev/runtime-target', () => {
  it('is unavailable outside the local development runtime', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const response = await GET(localRequest());

    expect(response.status).toBe(404);
  });

  it('confirms only a matching local runtime without returning configuration values', async () => {
    setSafeLocalEnvironment();

    const response = await GET(localRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ safe: true });
  });

  it('rejects a runtime targeting Production without disclosing its URL or keys', async () => {
    setSafeLocalEnvironment();
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://cswtugmwazxdktntndpy.supabase.co');

    const response = await GET(localRequest());
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(body).toBe('{"safe":false}');
    expect(body).not.toContain('cswtugmwazxdktntndpy');
  });

  it('rejects requests addressed to a public host', async () => {
    setSafeLocalEnvironment();

    const response = await GET(localRequest('mitiendapy.com'));

    expect(response.status).toBe(404);
  });
});
