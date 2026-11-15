import {rateLimiter} from '@/lib/rate-limiter'
import {NextResponse} from 'next/server'
import {withTenantAuth} from '@/lib/api/withTenantAuth'
import {exportOrganizationBusinessData} from '@/lib/saas/business-data-export'
export const maxDuration=60
export const GET=withTenantAuth({},async(request,{organization,user})=>{
 if(organization.role!=='owner'&&user.role!=='super_admin')return NextResponse.json({error:'Solo el titular puede descargar estos datos comerciales.'},{status:403})
 // Caller must bind the download to the organization visible when it clicked.
 if(request.headers.get('x-export-organization-id')!==organization.id)return NextResponse.json({error:'La empresa cambió. Volvé a iniciar la descarga.'},{status:409})
 if(!(await rateLimiter.check('business-export:'+user.id+':'+organization.id,2,60000)))return NextResponse.json({error:'Esperá un minuto antes de volver a descargar.'},{status:429});
 try{
  const data=await exportOrganizationBusinessData(organization.id)
  return new NextResponse(JSON.stringify(data),{headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, private','Content-Disposition':`attachment; filename="datos-comerciales-${organization.id}.json"`,'X-Content-Type-Options':'nosniff'}})
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'No se pudo completar la exportación.'},{status:503,headers:{'Cache-Control':'no-store'}})}
})