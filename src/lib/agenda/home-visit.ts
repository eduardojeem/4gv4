export type HomeVisitFields = {attention_mode?:'local'|'home'; service_address?:string|null; arrival_instructions?:string|null; travel_before_minutes?:number; travel_after_minutes?:number};
export const HOME_APPOINTMENT_COLUMNS='attention_mode,service_address,arrival_instructions,travel_before_minutes,travel_after_minutes,occupied_from';
export function homeVisitIssue(value:HomeVisitFields):string|null {
 if(value.attention_mode==='home' && (value.service_address?.trim().length??0)<3)return 'Agregá la dirección para la atención a domicilio.';
 if((value.service_address?.length??0)>500)return 'La dirección puede tener hasta 500 caracteres.';
 if((value.arrival_instructions?.length??0)>1000)return 'Las indicaciones pueden tener hasta 1000 caracteres.';
 for(const minutes of [value.travel_before_minutes,value.travel_after_minutes])if(minutes!==undefined&&(!Number.isInteger(minutes)||minutes<0||minutes>180))return 'El traslado debe ser de 0 a 180 minutos.';
 if(value.attention_mode==='local'&&((value.travel_before_minutes??0)>0||(value.travel_after_minutes??0)>0))return 'En el local no corresponde reservar tiempo de traslado.';
 return null;
}

export function homeVisitDetails(value:HomeVisitFields={}) {const home=value.attention_mode==='home';return {attention_mode:home?'home' as const:'local' as const,service_address:home?value.service_address?.trim()||null:null,arrival_instructions:home?value.arrival_instructions?.trim()||null:null,travel_before_minutes:home?value.travel_before_minutes??0:0,travel_after_minutes:home?value.travel_after_minutes??0:0}}
