import { PlatformBrandingForm } from '@/components/superadmin/PlatformBrandingForm'
import { getPlatformBranding } from '@/lib/platform/branding'

export default async function SuperAdminBrandContentPage() {
  const branding = await getPlatformBranding()
  return <PlatformBrandingForm initial={branding} />
}
