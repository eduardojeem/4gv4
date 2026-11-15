export const PRIMARY_ACTIVITIES = ['auto','pos','agenda','repairs'] as const;
export type PrimaryActivity = typeof PRIMARY_ACTIVITIES[number];
export const PRIMARY_ACTIVITY_LABELS: Record<PrimaryActivity,string> = {auto:'Automático según el rubro',pos:'Ventas y caja',agenda:'Agenda y servicios',repairs:'Taller y reparaciones'};
export function readPrimaryActivity(value:unknown):PrimaryActivity{return PRIMARY_ACTIVITIES.includes(value as PrimaryActivity)?value as PrimaryActivity:'auto'}
export function primaryActivityModule(value:PrimaryActivity){return value==='agenda'?'services':value==='auto'?null:value}
