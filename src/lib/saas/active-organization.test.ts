import {afterEach,expect,it} from 'vitest'
import {getBrowserOrganizationId,setBrowserOrganizationId} from './active-organization'
afterEach(()=>setBrowserOrganizationId(null))
it('starts and clears without a previous organization; switches A to B to A',()=>{
 setBrowserOrganizationId(null);expect(getBrowserOrganizationId()).toBeNull()
 for(const id of ['A','B','A']){setBrowserOrganizationId(id);expect(getBrowserOrganizationId()).toBe(id)}
 setBrowserOrganizationId(null);expect(getBrowserOrganizationId()).toBeNull()
})
