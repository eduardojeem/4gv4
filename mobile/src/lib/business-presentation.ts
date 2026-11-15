import { businessExperience } from '../../../src/lib/organization/business-experience';
export type MobileBusinessProfile = Parameters<typeof businessExperience>[0];
/** Same presentation policy as web; authorization remains on the server. */
export function mobileBusinessPresentation(profile: MobileBusinessProfile = {}) {
 return {...businessExperience(profile), showInventory: profile.effectiveModules?.includes('inventory') === true};
}
