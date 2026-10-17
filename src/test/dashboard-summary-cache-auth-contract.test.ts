import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
it('invalidates summaries before logout awaits network and on auth/permission lifecycle events',()=>{
 const auth=readFileSync('src/contexts/auth-context.tsx','utf8')
 const signOut=auth.slice(auth.indexOf('const signOut = useCallback'),auth.indexOf('const signOut = useCallback')+1000)
 expect(signOut.indexOf('clearDashboardSummaryCache()')).toBeGreaterThan(0)
 expect(signOut.indexOf('clearDashboardSummaryCache()')).toBeLessThan(signOut.indexOf('await '))
 const handler=auth.slice(auth.indexOf('(event, nextSession) => {'),auth.indexOf('(event, nextSession) => {')+400)
 for(const event of ['SIGNED_OUT','USER_UPDATED','SIGNED_IN']) expect(handler).toContain(event)
 expect(handler.indexOf('clearDashboardSummaryCache()')).toBeLessThan(handler.indexOf('if (!isMounted)'))
})
