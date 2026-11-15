import {NextRequest,NextResponse} from 'next/server'
import {withAdminAuth,type AdminAuthContext} from '@/lib/api/withAdminAuth'
import {resolveFinanceOrganizationId,getFinanceBusinessCalendar,toFinanceApiError,FinanceApiError} from '@/lib/finance/server'
async function get(request:NextRequest,context:AdminAuthContext){try{const header=request.headers.get('x-organization-id'),query=request.nextUrl.searchParams.get('organizationId');if(header&&query&&header!==query)throw new FinanceApiError('La empresa no coincide.',422,'ORGANIZATION_MISMATCH');const organizationId=await resolveFinanceOrganizationId(context,header??query??undefined);return NextResponse.json({organizationId,...await getFinanceBusinessCalendar(organizationId)},{headers:{'Cache-Control':'private, no-store'}})}catch(error){const e=toFinanceApiError(error);return NextResponse.json({error:e.message},{status:e.status})}}
export const GET=withAdminAuth(get)
