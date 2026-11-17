export type RepairLookup = {ticket:string;verify?:string;organizationSlug?:string};
const ticketPattern=/^(?:R-\d{4}-\d+|REP-\d+|R-\d{6}-\d+|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i;
export function parseRepairLookup(input:string,siteUrl:string):RepairLookup|null {
 const value=input.trim();if(ticketPattern.test(value))return {ticket:value.toUpperCase()};
 try{
  const url=new URL(value),site=new URL(siteUrl);
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||!(url.origin===site.origin||['https://mitiendapy.com','https://www.mitiendapy.com'].includes(url.origin)))return null;
  const parts=url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  const marker=parts.indexOf('mis-reparaciones');
  if(marker<0||marker>1||parts.length>marker+2)return null;
  if(url.searchParams.getAll('verify').length!==1||url.searchParams.getAll('ticket').length>1)return null;
  const ticket=parts[marker+1]??url.searchParams.get('ticket')??'',verify=url.searchParams.get('verify')??'';
  if(!ticketPattern.test(ticket)||! /^[a-f0-9]{16}$/i.test(verify))return null;
  const organizationSlug=marker===1?parts[0]:url.searchParams.get('org')??undefined;
  if(organizationSlug&&!/^[a-z0-9][a-z0-9-]{0,63}$/i.test(organizationSlug))return null;
  return {ticket:/^[a-f0-9-]{36}$/i.test(ticket)?ticket.toLowerCase():ticket.toUpperCase(),verify,...organizationSlug?{organizationSlug}:{}};
 }catch{return null;}
}
export function repairLookupError(status:number,qr:boolean):string {
 if(status===429)return 'Hiciste varias consultas seguidas. Esperá unos minutos antes de intentar nuevamente.';
 if(status===404)return 'No encontramos una reparación con estos datos. Revisá el comprobante o consultá al comercio que recibió tu equipo.';
 if(qr&&(status===401||status===403))return 'No pudimos validar este QR. Escaneá el comprobante original o consultá al comercio.';
 if(status===400)return 'Revisá el ticket del comprobante y el teléfono o email ingresado.';
 if(status===401||status===403)return 'No encontramos una reparación con ese ticket y contacto. Revisá el teléfono o email que registraste al dejar el equipo.';
 if(status===0)return 'No pudimos conectar. Revisá tu conexión y volvé a consultar.';
 return 'La consulta no está disponible en este momento. Intentá nuevamente en unos minutos.';
}
export function repairTrackingStatus(status:string):{label:string;step:number|null;tone:'normal'|'warning'|'danger'} {
 const states:Record<string,{label:string;step:number|null;tone:'normal'|'warning'|'danger'}>={recibido:{label:'Recibida',step:0,tone:'normal'},diagnostico:{label:'En diagnóstico',step:1,tone:'normal'},reparacion:{label:'En reparación',step:2,tone:'normal'},pausado:{label:'En pausa',step:2,tone:'warning'},listo:{label:'Lista para retirar',step:3,tone:'normal'},entregado:{label:'Entregada',step:4,tone:'normal'},cancelado:{label:'Cancelada',step:null,tone:'danger'}};
 return states[status.toLowerCase()]??{label:'Estado por confirmar',step:null,tone:'warning'};
}
