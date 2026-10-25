import { describe, expect, it } from 'vitest';
import {
  assertSafeDevelopmentEnvironment,
  assertSafeMobileSmokeEnvironment,
  assertSafeEffectiveSmokeRuntime,
  withSafeMobileSmokeTarget,
} from '../../scripts/dev-env-guard.mjs';

const localEnvironment = {
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:55321',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'local-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'local-service-key',
};

const localSmokeAppEnvironment = {
  NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:55321',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'local-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'local-service-key',
};

const localSmokeMobileEnvironment = {
  EXPO_PUBLIC_SUPABASE_URL: 'http://192.168.1.10:55321',
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'local-publishable-key',
};

describe('development Supabase guard', () => {
  it('allows a complete local Supabase environment', () => {
    expect(assertSafeDevelopmentEnvironment(localEnvironment)).toMatchObject({
      hostname: '127.0.0.1',
      port: '55321',
    });
  });

  it('rejects a cloud Supabase URL even when keys are present', () => {
    expect(() => assertSafeDevelopmentEnvironment({
      ...localEnvironment,
      NEXT_PUBLIC_SUPABASE_URL: 'https://production.supabase.co',
    })).toThrow(/local Supabase/i);
  });

  it('rejects an incomplete local environment instead of falling back', () => {
    expect(() => assertSafeDevelopmentEnvironment({
      NEXT_PUBLIC_SUPABASE_URL: localEnvironment.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: localEnvironment.SUPABASE_SERVICE_ROLE_KEY,
    })).toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/i);
  });

  it('rejects a JWT key whose project reference does not match the local URL', () => {
    const payload = Buffer.from(JSON.stringify({ ref: 'productionref' })).toString('base64url');
    expect(() => assertSafeDevelopmentEnvironment({
      ...localEnvironment,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: `header.${payload}.signature`,
    })).toThrow(/does not match/i);
  });
});

describe('mobile DEV smoke write guard', () => {
  it('allows localhost with the local Supabase stack', () => {
    expect(assertSafeMobileSmokeEnvironment({
      appEnv: localSmokeAppEnvironment,
      mobileEnv: localSmokeMobileEnvironment,
    })).toMatchObject({ siteHost: 'localhost', supabasePort: '55321' });
  });

  it('hard-fails when the Production project ref is configured', () => {
    expect(() => assertSafeMobileSmokeEnvironment({
      appEnv: {
        ...localSmokeAppEnvironment,
        NEXT_PUBLIC_SUPABASE_URL: 'https://cswtugmwazxdktntndpy.supabase.co',
      },
      mobileEnv: localSmokeMobileEnvironment,
    })).toThrow(/production supabase target/i);
  });

  it('fails closed for an unknown hosted Supabase target', () => {
    expect(() => assertSafeMobileSmokeEnvironment({
      appEnv: {
        ...localSmokeAppEnvironment,
        NEXT_PUBLIC_SUPABASE_URL: 'https://unknown-project.supabase.co',
      },
      mobileEnv: localSmokeMobileEnvironment,
    })).toThrow(/local Supabase/i);
  });

  it('fails closed for a public application URL', () => {
    expect(() => assertSafeMobileSmokeEnvironment({
      appEnv: { ...localSmokeAppEnvironment, NEXT_PUBLIC_SITE_URL: 'https://mitiendapy.com' },
      mobileEnv: localSmokeMobileEnvironment,
    })).toThrow(/local application URL/i);
  });

  it('fails closed when any required config is missing', () => {
    expect(() => assertSafeMobileSmokeEnvironment({
      appEnv: { ...localSmokeAppEnvironment, SUPABASE_SERVICE_ROLE_KEY: '' },
      mobileEnv: localSmokeMobileEnvironment,
    })).toThrow(/configuration is incomplete/i);
  });

  it('never includes configured secrets in guard errors', () => {
    const secretFixture = 'do-not-echo-secret-fixture';
    try {
      assertSafeMobileSmokeEnvironment({
        appEnv: {
          ...localSmokeAppEnvironment,
          NEXT_PUBLIC_SUPABASE_URL: 'https://unknown-project.supabase.co',
          SUPABASE_SERVICE_ROLE_KEY: secretFixture,
        },
        mobileEnv: localSmokeMobileEnvironment,
      });
      throw new Error('Expected the smoke guard to reject the target.');
    } catch (error) {
      expect(String(error)).not.toContain(secretFixture);
    }
  });

  it('rejects an effective Next runtime that differs from the validated local target', () => {
    expect(() => assertSafeEffectiveSmokeRuntime({
      appEnv: localSmokeAppEnvironment,
      expectedSiteOrigin: 'http://localhost:3000',
      expectedSupabaseOrigin: 'https://unknown-project.supabase.co',
    })).toThrow(/effective local runtime/i);
  });

  it('does not reach the write callback when target verification fails', async () => {
    const write = vi.fn();
    await expect(withSafeMobileSmokeTarget({
      appEnv: localSmokeAppEnvironment,
      mobileEnv: localSmokeMobileEnvironment,
      verifyEffectiveTarget: async () => false,
      run: write,
    })).rejects.toThrow(/effective local runtime/i);

    expect(write).not.toHaveBeenCalled();
  });
});
