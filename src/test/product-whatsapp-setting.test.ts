import {expect,it,vi} from 'vitest'
vi.mock('server-only',()=>({}))
import {pickOrganizationContact} from '@/lib/public/marketplace'
import {CompanyInfoSchema} from '@/lib/validation/website-settings'
import {buildCompanyPayload} from '../../mobile/src/lib/website-model'
it('keeps disabled product inquiries through web validation, public catalog and mobile save',()=>{
 const company=CompanyInfoSchema.parse({whatsapp:'0981123456',productWhatsappEnabled:false})
 expect(pickOrganizationContact(company)).toMatchObject({whatsapp:'0981123456',productWhatsappEnabled:false})
 expect(buildCompanyPayload({whatsapp:'0981123456',productWhatsappEnabled:true},{productWhatsappEnabled:false})).toMatchObject({productWhatsappEnabled:false})
})
it('preserves the saved setting when editing another company field in Expo',()=>{
 expect(buildCompanyPayload({whatsapp:'0981123456',productWhatsappEnabled:false},{description:'Nuevo texto'})).toMatchObject({productWhatsappEnabled:false,description:'Nuevo texto'})
})