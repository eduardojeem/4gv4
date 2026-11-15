'use client';
import {WhatsAppIcon} from './SocialIcons';
import {cn} from '@/lib/utils';
export function ProductWhatsAppButton({href,productName,className,tabIndex,compact=false}:{href:string|null;productName:string;className?:string;tabIndex?:number;compact?:boolean}){
 if(!href)return null;
 return <a href={href} target="_blank" rel="noopener noreferrer" tabIndex={tabIndex} onClick={event=>event.stopPropagation()} onKeyDown={event=>event.stopPropagation()} aria-label={'Consultar por WhatsApp sobre '+productName} className={cn('relative z-20 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-600/25 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-600 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:text-emerald-300',className)}><WhatsAppIcon className="h-4 w-4 shrink-0"/><span>{compact?'WhatsApp':'Consultar por WhatsApp'}</span></a>;
}
