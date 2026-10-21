import {act,render,waitFor} from '@testing-library/react'
import {afterEach,expect,it,vi} from 'vitest'
import {ActiveOrganizationProvider} from './ActiveOrganizationContext'
import {getBrowserOrganizationId,setBrowserOrganizationId} from '@/lib/saas/active-organization'
afterEach(()=>{vi.unstubAllGlobals();setBrowserOrganizationId(null)})
it('clears previous selectors while resolving and rejects late replies after a switch',async()=>{
 const replies:Array<(response:Response)=>void>=[]
 vi.stubGlobal('fetch',vi.fn(()=>new Promise<Response>(resolve=>replies.push(resolve))))
 setBrowserOrganizationId('previous-user-org')
 const view=render(<ActiveOrganizationProvider><span>child</span></ActiveOrganizationProvider>)
 expect(getBrowserOrganizationId()).toBeNull()
 await act(async()=>{window.dispatchEvent(new CustomEvent('organization:changed',{detail:{organizationId:'B'}}))})
 await act(async()=>{replies[0](new Response(JSON.stringify({activeOrganization:{id:'A'}})))})
 expect(getBrowserOrganizationId()).toBeNull()
 await act(async()=>{replies[1](new Response(JSON.stringify({activeOrganization:{id:'B'}})))})
 await waitFor(()=>expect(getBrowserOrganizationId()).toBe('B'))
 view.unmount();expect(getBrowserOrganizationId()).toBeNull()
})
