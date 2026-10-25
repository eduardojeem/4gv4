import { describe, expect, it } from 'vitest';
import { getDevLocalSupabaseOrigins, getExpoWebDevCorsHeaders } from './dev-expo-cors';

describe('Expo Web local CORS headers', () => {
  it('allows only the local Expo Web origin without credentials or wildcard access', () => {
    const headers = getExpoWebDevCorsHeaders('development');
    const values = Object.fromEntries(headers.map(({ key, value }) => [key.toLowerCase(), value]));

    expect(values['access-control-allow-origin']).toBe('http://localhost:8081');
    expect(values['access-control-allow-origin']).not.toBe('*');
    expect(values['access-control-allow-credentials']).toBeUndefined();
    expect(values['access-control-allow-methods']).toContain('POST');
    expect(values['access-control-allow-methods']).toContain('OPTIONS');
    expect(values['access-control-allow-headers'].toLowerCase()).toContain('authorization');
    expect(values['access-control-allow-headers'].toLowerCase()).toContain('x-branch-id');
    expect(values['vary']).toBe('Origin');
  });

  it('emits no Expo Web CORS headers in production', () => {
    expect(getExpoWebDevCorsHeaders('production')).toEqual([]);
  });
});

describe('local DEV Supabase CSP origins', () => {
  it('allows only validated local Supabase origins in development', () => {
    expect(getDevLocalSupabaseOrigins({
      nodeEnvironment: 'development',
      appSupabaseUrl: 'http://127.0.0.1:55321',
      mobileSupabaseUrl: 'http://192.168.0.5:55321',
    })).toEqual(['http://127.0.0.1:55321', 'http://192.168.0.5:55321']);
  });

  it('rejects remote, non-local, and wrong-port image origins', () => {
    expect(getDevLocalSupabaseOrigins({
      nodeEnvironment: 'development',
      appSupabaseUrl: 'https://project.supabase.co',
      mobileSupabaseUrl: 'http://192.168.0.5:3000',
    })).toEqual([]);
  });

  it('never emits local image sources in production', () => {
    expect(getDevLocalSupabaseOrigins({
      nodeEnvironment: 'production',
      appSupabaseUrl: 'http://127.0.0.1:55321',
      mobileSupabaseUrl: 'http://192.168.0.5:55321',
    })).toEqual([]);
  });
});
