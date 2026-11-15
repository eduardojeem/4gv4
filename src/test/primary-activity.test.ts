import {expect,it} from 'vitest';
import {businessExperience} from '@/lib/organization/business-experience';
import {BusinessProfileInputSchema} from '@/lib/organization/business-profile';
it('prioritizes chosen activity in mixed businesses',()=>{expect(businessExperience({primaryActivity:'agenda',operatingModel:'mixed',effectiveModules:['services','repairs','pos']}).focus).toBe('agenda');expect(businessExperience({primaryActivity:'pos',effectiveModules:['services','repairs','pos']}).focus).toBeNull()});
it('cannot select an unavailable module',()=>{expect(businessExperience({primaryActivity:'agenda',effectiveModules:['repairs']}).focus).toBe('repairs');expect(BusinessProfileInputSchema.safeParse({businessVertical:'general',operatingModel:'mixed',enabledModules:['pos'],primaryActivity:'admin'}).success).toBe(false)});
