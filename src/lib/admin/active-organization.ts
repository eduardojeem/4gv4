import { getCurrentOrganizationContext } from '@/lib/saas/context';

type AdminOrganizationContext = {
  organizationId: string | null;
  user: { id: string; role: string };
};

/** Resolve the active tenant for organization-scoped admin screens, including super_admin. */
export async function resolveActiveAdminOrganizationId(context: AdminOrganizationContext) {
  if (context.organizationId) return context.organizationId;
  if (context.user.role !== 'super_admin') return null;
  return (await getCurrentOrganizationContext(context.user.id).catch(() => null))?.id ?? null;
}
