import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { resolveMobileRuntimeConfig } from '../../mobile/src/lib/runtime-config';

const localConfig = {
  apiUrl: 'http://192.168.0.5:3000',
  supabaseUrl: 'http://192.168.0.5:55321',
  supabaseKey: 'local-publishable-key',
  siteUrl: 'http://192.168.0.5:3000',
  development: true,
};

describe('mobile runtime environment separation', () => {
  it('uses explicit, local-only Expo configuration in Vitest', () => {
    expect(process.env.EXPO_PUBLIC_RUNTIME_ENV).toBe('development');
    expect(process.env.EXPO_PUBLIC_API_URL).toBe('http://127.0.0.1:3000');
    expect(process.env.EXPO_PUBLIC_SUPABASE_URL).toBe('http://127.0.0.1:55321');
    expect(process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY).toBe('vitest-publishable-placeholder');
    expect(process.env.EXPO_PUBLIC_SITE_URL).toBe('http://127.0.0.1:3000');
  });

  it('keeps EAS backend values in their named environments, not in eas.json', () => {
    const eas = JSON.parse(readFileSync(resolve(process.cwd(), 'mobile/eas.json'), 'utf8'));

    for (const name of ['development', 'preview', 'production']) {
      expect(eas.build[name].environment).toBe(name);
      expect(eas.build[name].env).toEqual({ EXPO_PUBLIC_RUNTIME_ENV: name });
    }
  });

  it('accepts LAN endpoints for the local Expo development build', () => {
    expect(resolveMobileRuntimeConfig(localConfig).supabaseUrl).toBe('http://192.168.0.5:55321');
  });

  it('rejects production API and Supabase URLs in development', () => {
    expect(() => resolveMobileRuntimeConfig({
      ...localConfig,
      apiUrl: 'https://www.mitiendapy.com',
    })).toThrow(/Expo DEV/i);
    expect(() => resolveMobileRuntimeConfig({
      ...localConfig,
      supabaseUrl: 'https://production.supabase.co',
    })).toThrow(/Expo DEV/i);
  });

  it('allows the production profile to use HTTPS endpoints', () => {
    expect(resolveMobileRuntimeConfig({
      apiUrl: 'https://www.mitiendapy.com',
      supabaseUrl: 'https://cswtugmwazxdktntndpy.supabase.co',
      supabaseKey: 'production-publishable-key',
      development: false,
    }).apiUrl).toBe('https://www.mitiendapy.com');
  });

  it('rejects local or non-production HTTPS endpoints in the production profile', () => {
    const base = {
      apiUrl: 'https://www.mitiendapy.com',
      supabaseUrl: 'https://cswtugmwazxdktntndpy.supabase.co',
      supabaseKey: 'production-publishable-key',
      development: false,
      runtimeEnvironment: 'production',
    };

    expect(() => resolveMobileRuntimeConfig({ ...base, apiUrl: 'http://localhost:3000' })).toThrow(/PRODUCTION/i);
    expect(() => resolveMobileRuntimeConfig({ ...base, apiUrl: 'https://preview.mitiendapy.com' })).toThrow(/PRODUCTION/i);
    expect(() => resolveMobileRuntimeConfig({ ...base, supabaseUrl: 'https://preview.supabase.co' })).toThrow(/PRODUCTION/i);
  });

  it('does not fall back when a required URL or key is missing', () => {
    expect(() => resolveMobileRuntimeConfig({ ...localConfig, apiUrl: undefined })).toThrow(/EXPO_PUBLIC_API_URL/);
    expect(() => resolveMobileRuntimeConfig({ ...localConfig, supabaseKey: '' })).toThrow(/PUBLISHABLE_KEY/);
  });

  it('rejects EAS preview endpoints that point to production', () => {
    expect(() => resolveMobileRuntimeConfig({
      apiUrl: 'https://www.mitiendapy.com',
      supabaseUrl: 'https://cswtugmwazxdktntndpy.supabase.co',
      supabaseKey: 'preview-publishable-key',
      runtimeEnvironment: 'preview',
      development: false,
    })).toThrow(/PREVIEW/i);
  });
});
