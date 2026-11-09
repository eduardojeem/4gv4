'use client'
import { RotateCcw, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { SortValue } from './types'
import { SUBSCRIPTION_STATUS_LABELS, SUBSCRIPTION_PROVIDER_LABELS } from './subscription-edit'
type Props={hasActiveFilters?:boolean;query:string;plan:string;status:string;provider:string;sort:SortValue;planOptions:string[];statusOptions:string[];providerOptions:string[];planLabels?:Record<string,string>;filteredCount:number;totalCount:number;onQueryChange(value:string):void;onPlanChange(value:string):void;onStatusChange(value:string):void;onProviderChange(value:string):void;onSortChange(value:SortValue):void;onClear():void}
export function SubscriptionFilters(props:Props){
 const {query,plan,status,provider,sort,planOptions,statusOptions,providerOptions,planLabels={},onQueryChange,onPlanChange,onStatusChange,onProviderChange,onSortChange,onClear}=props
 const active=props.hasActiveFilters ?? Boolean(query||plan!=='ALL'||status!=='ALL'||provider!=='ALL'||sort!=='attention')
 const selectClass='h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-normal'
 return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,2fr)_1fr_1fr_1fr_1fr_auto]">
  <label className="space-y-2 text-xs font-semibold text-foreground">Buscar empresa<div className="relative"><Search aria-hidden className="absolute left-3 top-3.5 size-4 text-muted-foreground"/><Input className="h-11 rounded-xl pl-10 text-sm font-normal" placeholder="Buscar tenant, owner, ID…" value={query} onChange={event=>onQueryChange(event.target.value)}/></div></label>
  <label className="space-y-2 text-xs font-semibold">Plan<select className={selectClass} value={plan} onChange={event=>onPlanChange(event.target.value)}><option value="ALL">Todos los planes</option>{planOptions.map(value=><option key={value} value={value}>{planLabels[value]||value}</option>)}</select></label>
  <label className="space-y-2 text-xs font-semibold">Estado<select className={selectClass} value={status} onChange={event=>onStatusChange(event.target.value)}><option value="ALL">Todos los estados</option>{statusOptions.map(value=><option key={value} value={value}>{SUBSCRIPTION_STATUS_LABELS[value]||value}</option>)}</select></label>
  <label className="space-y-2 text-xs font-semibold">Medio de gestión<select className={selectClass} value={provider} onChange={event=>onProviderChange(event.target.value)}><option value="ALL">Todos los medios</option>{providerOptions.map(value=><option key={value} value={value}>{SUBSCRIPTION_PROVIDER_LABELS[value]||value}</option>)}</select></label>
  <label className="space-y-2 text-xs font-semibold">Ordenar<select className={selectClass} value={sort} onChange={event=>onSortChange(event.target.value as SortValue)}><option value="attention">Requiere atención</option><option value="renewal">Próximo vencimiento</option><option value="trial">Fin de prueba</option><option value="plan">Plan</option><option value="name">Nombre: A a Z</option></select></label>
  <Button variant="outline" className="min-h-11 self-end rounded-xl" onClick={onClear} disabled={!active} aria-label="Restablecer búsqueda y filtros" title="Restablecer búsqueda y filtros"><RotateCcw aria-hidden className="size-4"/></Button>
 </div>
}
