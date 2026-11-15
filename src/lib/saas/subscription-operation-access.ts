import {NextResponse} from 'next/server';
import {getSubscriptionStatus} from './subscription-service';

/** Billing and account reads stay accessible so suspension never traps renewal. */
export async function subscriptionOperationResponse(request:{method:string;url:string},organizationId:string){
 if(!['POST','PUT','PATCH','DELETE'].includes(request.method))return null;
 const pathname=new URL(request.url).pathname;
 if(pathname==='/api/admin/subscriptions'||pathname.startsWith('/api/admin/subscriptions/'))return null;
 const status=await getSubscriptionStatus(organizationId);
 if(!status.isBlocked&&!status.isExpired)return null;
 return NextResponse.json({error:'Las operaciones están suspendidas porque la suscripción venció o está suspendida. Podés consultar tu cuenta y renovar el plan.',code:'SUBSCRIPTION_OPERATIONS_SUSPENDED',renewalPath:'/admin/subscriptions'},{status:402});
}
