export const NONRENEWAL_TERMS_MARKER='## Suspensión, renovación y baja por falta de renovación';
export const NONRENEWAL_TERMS_CLAUSE=NONRENEWAL_TERMS_MARKER+`

Al finalizar el período contratado o de prueba sin renovación, se suspenden las operaciones de la organización. El usuario puede iniciar sesión y consultar su cuenta; el propietario o administrador puede gestionar la renovación. La suspensión no habilita un plan pago sin cobro ni elimina inmediatamente el historial.

Durante los primeros **90 días** sin renovación, la organización permanece suspendida y sus datos se conservan para consulta y renovación. Desde el día **91**, se archiva y deja de estar publicada; hasta la baja definitiva puede solicitarse su reactivación y renovarse conservando el historial.

Después de **180 días** sin renovación se dará de baja definitivamente y se eliminarán o anonimizarán sus datos operativos, conservando únicamente los registros cuya conservación resulte legalmente exigible. Esos registros se conservarán durante el plazo aplicable y con acceso restringido. La baja de una organización no elimina la cuenta personal ni los datos de otras organizaciones del mismo usuario.

El plazo se comunicará antes de su aplicación. Las organizaciones ya vencidas al entrar en vigencia esta política dispondrán de 180 días completos desde la notificación de esta política. No se aplicarán eliminaciones retroactivas inmediatas. Una renovación confirmada antes de la baja cancela el proceso pendiente.

Antes de la baja, el titular puede consultar o solicitar una copia de sus datos mediante los canales de soporte. Los datos eliminados definitivamente no podrán recuperarse desde la aplicación. La información retenida por obligación legal permanecerá restringida y no habilitará operaciones comerciales.
`;
export function appendNonrenewalTerms(content:string){
 const start=content.indexOf(NONRENEWAL_TERMS_MARKER);
 if(start<0)return content.trim()+'\n\n'+NONRENEWAL_TERMS_CLAUSE;
 const end=content.indexOf('\n## ',start+NONRENEWAL_TERMS_MARKER.length);
 return content.slice(0,start)+NONRENEWAL_TERMS_CLAUSE+(end<0?'':content.slice(end));
}
