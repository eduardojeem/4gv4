import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { newerPublishedRelease } from '@/lib/mobile/system-news'

export const GET = withTenantAuth({}, async () => {
  const getRelease=(platform:'ios'|'android')=>{
    const prefix=platform==='ios'?'MOBILE_IOS':'MOBILE_ANDROID'
    const version=process.env[prefix+'_RELEASE_VERSION']?.trim()??''
    const storeUrl=process.env[prefix+'_STORE_URL']?.trim()??''
    return newerPublishedRelease('0.0.0',{version,storeUrl},platform)
  }
  return NextResponse.json({ios:getRelease('ios'),android:getRelease('android')},{headers:{'Cache-Control':'private, no-store'}})
})
