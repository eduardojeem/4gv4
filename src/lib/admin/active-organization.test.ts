import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/saas/context', () => ({
  getCurrentOrganizationContext: vi.fn(),
}));

import { getCurrentOrganizationContext } from '@/lib/saas/context';
import { resolveActiveAdminOrganizationId } from './active-organization';

const getCurrentOrganization = vi.mocked(getCurrentOrganizationContext);

describe('resolveActiveAdminOrganizationId', () => {
  beforeEach(() => vi.clearAllMocks());

  it('keeps a regular admin scoped to the organization authorized by middleware', async () => {
    await expect(resolveActiveAdminOrganizationId({
      organizationId: 'org-admin',
      user: { id: 'user-1', role: 'admin' },
    })).resolves.toBe('org-admin');
    expect(getCurrentOrganization).not.toHaveBeenCalled();
  });

  it('uses the active organization for an organization-scoped superadmin screen', async () => {
    getCurrentOrganization.mockResolvedValue({ id: 'org-active' } as Awaited<ReturnType<typeof getCurrentOrganizationContext>>);
    await expect(resolveActiveAdminOrganizationId({
      organizationId: null,
      user: { id: 'super-1', role: 'super_admin' },
    })).resolves.toBe('org-active');
    expect(getCurrentOrganization).toHaveBeenCalledWith('super-1');
  });

  it('fails closed when a superadmin has no active organization', async () => {
    getCurrentOrganization.mockResolvedValue(null);
    await expect(resolveActiveAdminOrganizationId({
      organizationId: null,
      user: { id: 'super-1', role: 'super_admin' },
    })).resolves.toBeNull();
  });
});
