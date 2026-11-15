import {evaluateSubscriptionStatus} from './subscription-status';
export const NONRENEWAL_ARCHIVE_DAYS = 90;
export const NONRENEWAL_RETENTION_DAYS = 180;
export const NONRENEWAL_WARNING = 'Al vencer, las operaciones se suspenden. Desde el día 91 sin renovar, la empresa se archiva y deja de estar publicada. Podés reactivarla con su historial antes de la baja definitiva a los 180 días. Después se eliminarán o anonimizarán sus datos, salvo los registros legalmente exigibles. El plazo se informa antes de su aplicación.';
export type NonrenewalSubscription = {status?:string|null;payment_status?:string|null;current_period_ends_at?:string|null;trial_ends_at?:string|null};
function time(value?:string|null){if(!value)return null;const result=Date.parse(value);return Number.isFinite(result)?result:null;}
export function nonrenewalExpiry(subscription:NonrenewalSubscription){
 return subscription.status==='trialing' ? time(subscription.trial_ends_at) : time(subscription.current_period_ends_at)??time(subscription.trial_ends_at);
}
/** Eligibility never executes deletion. Only a verified notice for this expiry may start the clock. */
export function nonrenewalState(subscription:NonrenewalSubscription,now=new Date(),policyNoticeAt?:string|null){
 const evaluated=evaluateSubscriptionStatus({status:subscription.status,paymentStatus:subscription.payment_status,periodEndsAt:subscription.current_period_ends_at,trialEndsAt:subscription.trial_ends_at},now);
 const expiry=nonrenewalExpiry(subscription),notice=time(policyNoticeAt);
 const hasDeadline=evaluated.isBlocked&&expiry!==null&&expiry<=now.getTime()&&notice!==null&&notice<=now.getTime();
 const start=hasDeadline?Math.max(expiry!,notice!):null;
 const archive=start===null?null:start+NONRENEWAL_ARCHIVE_DAYS*86400000;
 const deadline=start===null?null:start+NONRENEWAL_RETENTION_DAYS*86400000;
 const eligibleForDeletion=deadline!==null&&now.getTime()>=deadline;
 const phase=!evaluated.isBlocked?'active':eligibleForDeletion?'pending_deletion':archive!==null&&now.getTime()>=archive?'archived':'suspended';
 return {blocked:evaluated.isBlocked,phase,title:phase==='archived'||phase==='pending_deletion'?'Tu empresa está archivada. Renovala para reactivarla':'Tu plan venció. Renovalo para volver a operar',message:'Podés entrar y consultar tu cuenta. No podés registrar nuevas operaciones hasta renovar.',warning:NONRENEWAL_WARNING,archiveDueAt:archive===null?null:new Date(archive).toISOString(),deletionDueAt:deadline===null?null:new Date(deadline).toISOString(),eligibleForDeletion,canRecover:true};
}
