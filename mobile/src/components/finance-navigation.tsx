import {useState} from 'react';
import {Ionicons} from '@expo/vector-icons';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {BottomSheet} from './bottom-sheet';
import {usePalette} from '../lib/palette';
import type {FinanceTab} from './finance-operations';
type Icon=keyof typeof Ionicons.glyphMap;
export type FinanceViewOption<T extends string>={key:T;label:string;description:string;icon:Icon};
export const FINANCE_SECTIONS:FinanceViewOption<FinanceTab>[]=[
 {key:'summary',label:'Resumen',description:'Resultado, dinero que se movió y cuentas pendientes.',icon:'pie-chart-outline'},
 {key:'expenses',label:'Gastos',description:'Registrá gastos y consultá lo que ya pagaste.',icon:'receipt-outline'},
 {key:'payables',label:'Por pagar',description:'Vencimientos y pagos parciales de tus cuentas.',icon:'calendar-outline'},
 {key:'team',label:'Equipo',description:'Sueldos, comisiones y saldos de liquidaciones.',icon:'people-outline'},
 {key:'profitability',label:'Rentabilidad',description:'Qué productos y servicios dejan más margen.',icon:'trending-up-outline'},
 {key:'control',label:'Control',description:'Proyección, conciliación, presupuestos y cierres.',icon:'options-outline'},
];
export function FinanceViewPicker<T extends string>({options,value,onChange,title,accent,primary=false}:{options:readonly FinanceViewOption<T>[];value:T;onChange:(value:T)=>void;title:string;accent:string;primary?:boolean}){
 const colors=usePalette(),[open,setOpen]=useState(false);
 const selected=options.find(option=>option.key===value);
 const moreSelected=primary&&!options.slice(0,3).some(option=>option.key===value);
 const tile=(key:string,label:string,icon:Icon,active:boolean,onPress:()=>void)=><Pressable key={key} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{selected:active}} onPress={onPress} style={[styles.tab,{backgroundColor:active?accent+'16':colors.card,borderColor:active?accent+'55':colors.border}]}><Ionicons name={icon} size={20} color={active?accent:colors.muted}/><Text style={{color:active?accent:colors.text,fontSize:12,fontWeight:active?'800':'600',textAlign:'center',flexShrink:1}}>{label}</Text></Pressable>;
 return <>
  {primary?<View style={styles.tabs}>{options.slice(0,3).map(option=>tile(option.key,option.label,option.icon,option.key===value,()=>onChange(option.key)))}{tile('more','Más vistas','grid-outline',moreSelected,()=>setOpen(true))}</View>:<Pressable accessibilityRole="button" accessibilityLabel={title+': '+selected?.label} onPress={()=>setOpen(true)} style={[styles.selector,{backgroundColor:colors.card,borderColor:colors.border}]}><View style={[styles.icon,{backgroundColor:accent+'16'}]}><Ionicons name={selected?.icon??'grid-outline'} size={21} color={accent}/></View><View style={styles.grow}><Text style={{color:colors.muted,fontSize:11,fontWeight:'700'}}>{title}</Text><Text style={{color:colors.text,fontSize:16,fontWeight:'800'}}>{selected?.label}</Text></View><Ionicons name="chevron-down" size={18} color={colors.muted}/></Pressable>}
  <BottomSheet visible={open} title={title} subtitle="Elegí qué querés consultar o administrar." onClose={()=>setOpen(false)}>
   {options.map(option=><Pressable key={option.key} accessibilityRole="button" accessibilityState={{selected:option.key===value}} onPress={()=>{onChange(option.key);setOpen(false)}} style={[styles.option,{borderColor:option.key===value?accent+'55':colors.border,backgroundColor:option.key===value?accent+'12':colors.card}]}><View style={[styles.icon,{backgroundColor:accent+'16'}]}><Ionicons name={option.icon} size={22} color={accent}/></View><View style={styles.grow}><Text style={{color:colors.text,fontSize:16,fontWeight:'700'}}>{option.label}</Text><Text style={{color:colors.muted,fontSize:13,lineHeight:18,marginTop:3}}>{option.description}</Text></View><Ionicons name={option.key===value?'checkmark-circle':'chevron-forward'} size={20} color={option.key===value?accent:colors.muted}/></Pressable>)}
  </BottomSheet>
 </>;
}
export function FinanceMobileToolbar({tab,onTabChange,periodLabel,branchLabel,dateLabel,onFilters,onShare,sharing,canShare,accent}:{tab:FinanceTab;onTabChange:(tab:FinanceTab)=>void;periodLabel:string;branchLabel:string;dateLabel:string;onFilters:()=>void;onShare:()=>void;sharing:boolean;canShare:boolean;accent:string}){
 const colors=usePalette();return <View style={[styles.toolbar,{borderBottomColor:colors.border,backgroundColor:colors.background}]}>
  <View style={styles.heading}><View style={styles.grow}><Text accessibilityRole="header" style={{fontSize:27,fontWeight:'800',letterSpacing:-0.6,color:colors.text}}>Finanzas</Text><Text style={{color:colors.muted,fontSize:13,marginTop:3}}>Resultados, cobros y pagos</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Compartir resumen financiero en CSV" disabled={sharing||!canShare} onPress={onShare} style={[styles.share,{borderColor:colors.border,backgroundColor:colors.card,opacity:sharing||!canShare?0.4:1}]}><Ionicons name={sharing?'hourglass-outline':'share-outline'} size={21} color={colors.text}/></Pressable></View>
  <Pressable accessibilityRole="button" accessibilityLabel={'Cambiar filtros. '+periodLabel+'. '+branchLabel} onPress={onFilters} style={[styles.filter,{borderColor:colors.border,backgroundColor:colors.card}]}><Ionicons name="calendar-clear-outline" size={18} color={accent}/><View style={styles.grow}><Text numberOfLines={1} style={{color:colors.text,fontSize:13,fontWeight:'700'}}>{periodLabel} · {branchLabel}</Text><Text numberOfLines={1} style={{color:colors.muted,fontSize:11,marginTop:2}}>{dateLabel}</Text></View><Ionicons name="options-outline" size={20} color={colors.muted}/></Pressable>
  <FinanceViewPicker options={FINANCE_SECTIONS} value={tab} onChange={onTabChange} title="Vistas de Finanzas" accent={accent} primary/>
 </View>;
}
const styles=StyleSheet.create({toolbar:{paddingHorizontal:16,paddingTop:12,paddingBottom:12,gap:12,borderBottomWidth:StyleSheet.hairlineWidth},heading:{flexDirection:'row',alignItems:'center',gap:12},grow:{flex:1,minWidth:0},share:{width:44,height:44,borderWidth:1,borderRadius:14,alignItems:'center',justifyContent:'center'},filter:{flexDirection:'row',alignItems:'center',gap:10,borderWidth:1,borderRadius:14,paddingHorizontal:12,paddingVertical:10},tabs:{flexDirection:'row',gap:6},tab:{flex:1,minWidth:0,minHeight:62,borderWidth:1,borderRadius:14,alignItems:'center',justifyContent:'center',gap:5,paddingHorizontal:3,paddingVertical:8},selector:{flexDirection:'row',gap:12,alignItems:'center',borderWidth:1,borderRadius:16,padding:12},icon:{width:42,height:42,borderRadius:13,alignItems:'center',justifyContent:'center'},option:{flexDirection:'row',gap:12,alignItems:'center',borderWidth:1,borderRadius:16,padding:14}});
