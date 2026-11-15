import {FinanceExpenseCard} from './finance-expense-card';
import type { ControlMetric } from '../../../src/lib/finance/control-model';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { FinanceControl } from './finance-control';
import { DateField } from './date-field';
import { BottomSheet } from './bottom-sheet';
import { approvePayrollRun, assertExpensePage, assertFinanceScope, financeAttemptContext, parseFinanceAmount, readFinance, sendFinanceAttempt, voidExpense, type CashSession, type Expense, type ExpensePage, type FinanceCategory, type FinanceScope, type PayrollEntry, type PayrollRun, type ProfitabilityRow } from '../lib/finance-admin';
import { readPendingFinanceAttempt, submitFinanceAttempt, type FinanceAttempt, type PendingFinanceAttempt } from '../lib/finance-attempt';
import { secureStorage } from '../lib/secure-storage';
import { financePeriodDates } from '../lib/finance-model';
import { validateFinanceDates } from '../../../src/lib/finance/summary-integrity';
import { usePalette, palette } from '../lib/palette';
import type { BranchItem } from '../lib/admin';
export type FinanceTab = 'summary' | 'expenses' | 'payables' | 'team' | 'profitability' | 'control';
export const FINANCE_TABS: {key:FinanceTab;label:string}[] = [{key:'summary',label:'Resumen'},{key:'expenses',label:'Gastos'},{key:'payables',label:'Por pagar'},{key:'team',label:'Equipo'},{key:'profitability',label:'Rentabilidad'},{key:'control',label:'Control'}];
/** Pago de un sueldo ya liquidado y aprobado. La caja, si es en efectivo, es de la sucursal de la liquidación. */
type PayrollTarget={kind:'payroll';entry:PayrollEntry;branchId:string|null};
const isPayroll=(target:unknown):target is PayrollTarget=>Boolean(target)&&typeof target==='object'&&(target as PayrollTarget).kind==='payroll';
const STATUS:Record<string,string>={pending:'Pendiente',partially_paid:'Pago parcial',paid:'Pagado',overdue:'Vencido',voided:'Anulado',draft:'Borrador',approved:'Aprobada'};
export function FinanceOperations({scope,mode,branches,onChanged,initialControlMetric}:{initialControlMetric?:ControlMetric;scope:FinanceScope;mode:Exclude<FinanceTab,'summary'>;branches:BranchItem[];onChanged:()=>Promise<void>}) {
  const colors=usePalette();
  const [page,setPage]=useState(1),[query,setQuery]=useState(''),[search,setSearch]=useState(''),[status,setStatus]=useState(''),[group,setGroup]=useState('product');
  const [version,setVersion]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState<string|null>(null);
  const [expenses,setExpenses]=useState<ExpensePage|null>(null),[runs,setRuns]=useState<PayrollRun[]>([]),[profits,setProfits]=useState<ProfitabilityRow[]>([]);
  const [editor,setEditor]=useState<'expense'|Expense|PayrollTarget|null>(null),[categories,setCategories]=useState<FinanceCategory[]>([]),[sessions,setSessions]=useState<CashSession[]>([]);
  const [pending,setPending]=useState<PendingFinanceAttempt|null>(null),[storageError,setStorageError]=useState<string|null>(null);
  const [busy,setBusy]=useState(false),[formError,setFormError]=useState<string|null>(null),[lookupsLoading,setLookupsLoading]=useState(false);
  const [amount,setAmount]=useState(''),[concept,setConcept]=useState(''),[vendor,setVendor]=useState(''),[category,setCategory]=useState(''),[branch,setBranch]=useState(scope.branchId??'');
  const [method,setMethod]=useState('bank_transfer'),[session,setSession]=useState(''),[reference,setReference]=useState('');
  const [date,setDate]=useState(financePeriodDates('today',scope.timeZone).startDate),[dueDate,setDueDate]=useState('');
  const [voiding,setVoiding]=useState<Expense|null>(null),[voidReason,setVoidReason]=useState(''),[voidSession,setVoidSession]=useState(''),[voidSessions,setVoidSessions]=useState<CashSession[]>([]),[voidError,setVoidError]=useState<string|null>(null);
  const today=financePeriodDates('today',scope.timeZone).startDate;
  const lock=useRef(false),request=useRef(0);
  const money=(value:number|string,currency=scope.currency)=>{const number=Number(value);return Number.isFinite(number)?new Intl.NumberFormat(undefined,{style:'currency',currency,maximumFractionDigits:2}).format(number):'No disponible';};
  useEffect(()=>{const timer=setTimeout(()=>{setSearch(query.trim());setPage(1);},300);return()=>clearTimeout(timer);},[query]);
  const reload=useCallback(async()=>{
    const generation=++request.current;setLoading(true);setError(null);setExpenses(null);setRuns([]);setProfits([]);
    try {
      if(mode==='control'){return;}else if(mode==='expenses'||mode==='payables'){
        const result=await readFinance<ExpensePage>('obligations',scope,{page:String(page),pageSize:'25',...(search?{search}:{}),...(mode==='payables'?{dueView:status==='upcoming'?'upcoming':'overdue'}:status?{status}:{})});
        assertExpensePage(result);if(generation===request.current)setExpenses(result);
      }else if(mode==='team'){
        const result=await readFinance<{runs:PayrollRun[]}>('payroll/runs',scope,{periodFrom:scope.startDate,periodTo:scope.endDate});
        if(!Array.isArray(result.runs))throw new Error('La lista de liquidaciones llegó incompleta.');
        for(const run of result.runs)for(const entry of run.entries){if(![entry.base_amount,entry.commission_amount,entry.net_amount,entry.paid_amount,entry.outstanding_amount].every(value=>Number.isFinite(Number(value))))throw new Error('Hay una liquidación con importes no verificables.');}
        if(generation===request.current)setRuns(result.runs);
      }else{
        const result=await readFinance<{rows:ProfitabilityRow[]}>('profitability',scope,{group});
        if(!Array.isArray(result.rows))throw new Error('El detalle de rentabilidad llegó incompleto.');
        for(const row of result.rows)if(!Number.isFinite(row.revenue)||(row.grossProfit!==null&&!Number.isFinite(row.grossProfit)))throw new Error('Hay importes inválidos en la rentabilidad.');
        if(generation===request.current)setProfits(result.rows);
      }
    }catch(cause){if(generation===request.current)setError(cause instanceof Error?cause.message:'No pudimos cargar el detalle.');}
    finally{if(generation===request.current)setLoading(false);}
  },[scope,mode,page,search,status,group]);
  useEffect(()=>{let active=true;const requests=request;void Promise.resolve().then(()=>{if(active)void reload();});return()=>{active=false;requests.current++;};},[reload,version]);
  useEffect(()=>{let active=true;readPendingFinanceAttempt(financeAttemptContext(scope),secureStorage).then(value=>{if(active)setPending(value);}).catch(cause=>{if(active)setStorageError(cause.message);});return()=>{active=false;};},[scope,version]);
  useEffect(()=>{
    if(!editor)return;
    let active=true;
    const sessionBranch=isPayroll(editor)?editor.branchId:editor==='expense'?null:editor.branch_id;
    const load:Promise<{categories:FinanceCategory[]}|{sessions:CashSession[]}>=editor==='expense'?readFinance<{categories:FinanceCategory[]}>('categories',scope):sessionBranch?readFinance<{sessions:CashSession[]}>('cash-sessions',{...scope,branchId:sessionBranch}):Promise.resolve({sessions:[]});
    load.then(result=>{if(!active)return;if('categories'in result){setCategories(result.categories);setCategory(result.categories[0]?.id??'');}else setSessions(result.sessions);})
      .catch(cause=>{if(active)setFormError(cause.message);}).finally(()=>{if(active)setLookupsLoading(false);});
    return()=>{active=false;};
  },[editor,scope]);
  const openEditor=(target:'expense'|Expense|PayrollTarget)=>{
    if(pending||storageError){Alert.alert('Hay una operación por revisar','Recuperá la operación pendiente antes de iniciar otra.');return;}
    setLookupsLoading(true);setEditor(target);setAmount('');setConcept('');setVendor('');setDueDate('');setMethod('bank_transfer');setSession('');setReference('');setFormError(null);setSessions([]);
    setBranch(target==='expense'?scope.branchId??(branches.length===1?branches[0].id:''):isPayroll(target)?target.branchId??'':target.branch_id);setDate(financePeriodDates('today',scope.timeZone).startDate);
  };
  const execute=async(attempt:FinanceAttempt)=>{
    if(lock.current)return;
    lock.current=true;setBusy(true);setFormError(null);
    try{
      assertFinanceScope(scope);
      await submitFinanceAttempt(financeAttemptContext(scope),attempt,secureStorage,(input,key)=>sendFinanceAttempt(scope,input,key));
      setPending(null);setEditor(null);setVersion(value=>value+1);await onChanged();
      Alert.alert('Operación registrada',attempt.kind==='expense'?'El gasto quedó registrado. Todavía no es un pago.':attempt.kind==='payroll_payment'?'El pago del sueldo quedó registrado.':'El pago quedó registrado en el sistema.');
    }catch(cause){
      const message=cause instanceof Error?cause.message:'No se pudo confirmar el resultado.';setFormError(message);
      try{setPending(await readPendingFinanceAttempt(financeAttemptContext(scope),secureStorage));}catch(problem){setStorageError(problem instanceof Error?problem.message:'No se pudo leer el estado pendiente.');}
      Alert.alert('Revisá la operación',message);
    }finally{lock.current=false;setBusy(false);}
  };
  const save=()=>{
    try{
      const value=parseFinanceAmount(amount);validateFinanceDates({startDate:date,endDate:date});
      if(isPayroll(editor)){
        if(value>Number(editor.entry.outstanding_amount)+0.001)throw new Error('El pago supera lo pendiente de este sueldo.');
        if(method==='cash'&&!session)throw new Error('Seleccioná una caja abierta para pagar en efectivo.');
        void execute({kind:'payroll_payment',targetId:editor.entry.id,payload:{amount:value,paymentMethod:method,paymentDate:date,...(method==='cash'?{cashSessionId:session}:{}),...(reference.trim()?{reference:reference.trim()}:{})}});
        return;
      }
      if(!branch)throw new Error('Seleccioná la sucursal del gasto.');
      if(editor==='expense'){
        if(!category||!concept.trim())throw new Error('Completá la categoría y el concepto.');
        if(dueDate)validateFinanceDates({startDate:dueDate,endDate:dueDate});
        void execute({kind:'expense',payload:{branchId:branch,categoryId:category,amount:value,concept:concept.trim(),accountingDate:date,...(vendor.trim()?{vendor:vendor.trim()}:{}),...(dueDate?{dueDate}:{})}});
      }else if(editor){
        if(value>Number(editor.outstanding_amount)+0.001)throw new Error('El pago supera el saldo pendiente.');
        if(method==='cash'&&!session)throw new Error('Seleccioná una caja abierta de esta sucursal.');
        void execute({kind:'payment',targetId:editor.id,payload:{branchId:branch,amount:value,paymentMethod:method,paymentDate:date,...(method==='cash'?{cashSessionId:session}:{}),...(reference.trim()?{reference:reference.trim()}:{})}});
      }
    }catch(cause){setFormError(cause instanceof Error?cause.message:'Revisá los datos.');}
  };
  const openVoid=(expense:Expense)=>{
    if(pending||storageError||busy)return;
    setVoiding(expense);setVoidReason('');setVoidSession('');setVoidSessions([]);setVoidError(null);
    if(expense.requires_cash_session_on_void)readFinance<{sessions:CashSession[]}>('cash-sessions',{...scope,branchId:expense.branch_id}).then(result=>setVoidSessions(result.sessions)).catch(cause=>setVoidError(cause.message));
  };
  const confirmVoid=async()=>{
    if(!voiding||lock.current)return;
    if(!voidReason.trim()){setVoidError('Escribí el motivo de la anulación.');return;}
    if(voiding.requires_cash_session_on_void&&!voidSession){setVoidError('Este gasto tuvo pagos en efectivo: elegí la caja abierta donde vuelve el dinero.');return;}
    lock.current=true;setBusy(true);setVoidError(null);
    try{await voidExpense(scope,voiding,voidReason,voiding.requires_cash_session_on_void?voidSession:undefined);setVoiding(null);setVersion(value=>value+1);await onChanged();Alert.alert('Gasto anulado','Quedó registrado como anulado, con su motivo.');}
    catch(cause){setVoidError(cause instanceof Error?cause.message:'No se pudo anular el gasto.');}
    finally{lock.current=false;setBusy(false);}
  };
  const approve=(run:PayrollRun)=>{
    if(busy)return;
    Alert.alert('¿Aprobar la liquidación?',`${run.period_from} a ${run.period_to}. Después de aprobarla ya no se recalcula y se pueden registrar los pagos.`,[{text:'Cancelar',style:'cancel'},{text:'Aprobar',onPress:()=>{
      setBusy(true);
      approvePayrollRun(scope,run.id).then(async()=>{setVersion(value=>value+1);await onChanged();Alert.alert('Liquidación aprobada','Ya podés registrar los pagos de cada persona.');})
        .catch(cause=>Alert.alert('No se pudo aprobar',cause instanceof Error?cause.message:'Reintentá.'))
        .finally(()=>setBusy(false));
    }}]);
  };
  const button=(label:string,onPress:()=>void,disabled=false)=><Pressable key={label} accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.button,{borderColor:label.startsWith('✓ ')?palette.primary+'55':colors.border,backgroundColor:label.startsWith('✓ ')?palette.primary+'12':colors.card,opacity:disabled?0.45:1}]}><Text style={{color:palette.primary,fontWeight:'700'}}>{label}</Text></Pressable>;
  const field=(label:string,value:string,set:(value:string)=>void,numeric=false)=><View style={{gap:5}}><Text style={{color:colors.text,fontWeight:'600'}}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={set} editable={!busy&&!pending} keyboardType={numeric?'decimal-pad':'default'} autoCapitalize="none" style={[styles.input,{color:colors.text,borderColor:colors.border}]} maxLength={label.includes('Concepto')?200:label.includes('Monto')?15:200}/></View>;
  if(mode==='control')return <FinanceControl scope={scope} initialMetric={initialControlMetric}/>;
  return <>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text accessibilityRole="header" style={[styles.title,{color:colors.text}]}>{FINANCE_TABS.find(tab=>tab.key===mode)?.label}</Text>
      <Text style={{color:colors.muted}}>{mode==='payables'?'Vencimientos de todas las fechas; respetan la sucursal seleccionada.':`${scope.startDate} a ${scope.endDate} · ${scope.branchId?'Sucursal seleccionada':'Todas las sucursales'}`}</Text>
      {storageError?<Text accessibilityRole="alert" style={{color:palette.danger}}>{storageError}</Text>:null}
      {pending?<View style={[styles.card,{borderColor:'#B45309'}]}><Text style={{color:colors.text,fontWeight:'700'}}>Hay una operación pendiente de confirmar</Text><Text style={{color:colors.muted}}>No cambies el monto ni registres otra operación. Recuperá el resultado con la misma clave.</Text><Pressable accessibilityRole="button" disabled={busy} onPress={()=>{void execute(pending);}} style={[styles.button,{borderColor:colors.border}]}><Text style={{color:palette.primary}}>Recuperar operación</Text></Pressable></View>:null}
      {(mode==='expenses'||mode==='payables')&&<>
        {button('Nuevo gasto',()=>openEditor('expense'),busy||Boolean(pending)||Boolean(storageError))}
        <TextInput accessibilityLabel="Buscar gastos" placeholder="Concepto o proveedor" placeholderTextColor={colors.muted} value={query} onChangeText={setQuery} maxLength={120} style={[styles.input,{color:colors.text,borderColor:colors.border}]}/>
        <View style={styles.wrap}>{(mode==='payables'?[['','Vencidos'],['upcoming','Próximos']]:[['','Todos'],['pending','Pendientes'],['partially_paid','Pago parcial'],['paid','Pagados'],['voided','Anulados']]).map(([value,label])=>button((status===value?'✓ ':'')+label,()=>{setStatus(value);setPage(1);}))}</View>
      </>}
      {mode==='profitability'&&<View style={styles.wrap}>{[['product','Productos'],['sale','Ventas'],['repair','Reparaciones'],['employee','Equipo'],['branch','Sucursales']].map(([value,label])=>button((group===value?'✓ ':'')+label,()=>setGroup(value)))}</View>}
      {loading?<ActivityIndicator color={palette.primary}/>:error?<View accessibilityRole="alert" style={styles.card}><Text style={{color:palette.danger}}>{error}</Text>{button('Reintentar',()=>setVersion(value=>value+1))}</View>:<>
        {expenses&&<><Text style={{color:colors.muted}}>{expenses.pagination.totalItems} registros · página {page}</Text>{!expenses.obligations.length?<Text style={{color:colors.muted}}>No hay gastos con estos filtros.</Text>:expenses.obligations.map(row=><FinanceExpenseCard key={row.id} expense={row} currency={scope.currency} disabled={busy||Boolean(pending)||Boolean(storageError)} onPay={()=>openEditor(row)} onVoid={()=>openVoid(row)}/>)}<View style={styles.wrap}>{button('Anterior',()=>setPage(value=>value-1),page<=1)}{button('Siguiente',()=>setPage(value=>value+1),page>=expenses.pagination.totalPages)}</View></>}
        {mode==='team'&&<><Text style={{color:colors.muted}}>Hasta las 25 liquidaciones más recientes que intersectan el período. Un borrador no es un pago.</Text>{!runs.length?<Text style={{color:colors.muted}}>No hay liquidaciones en este período.</Text>:runs.map(run=><View key={run.id} style={[styles.card,{borderColor:colors.border}]}><Text style={[styles.bold,{color:colors.text}]}>{run.period_from} a {run.period_to} · {STATUS[run.status]??run.status}</Text>{run.status==='draft'?<>{button('Aprobar liquidación',()=>approve(run),busy||Boolean(pending)||Boolean(storageError))}<Text style={{color:colors.muted,fontSize:12}}>Revisá los importes: después de aprobarla se pueden registrar los pagos.</Text></>:null}{run.entries.map(entry=><View key={entry.id} style={{gap:5,borderTopWidth:1,borderColor:colors.border,paddingTop:10}}><Text style={{color:colors.text,fontWeight:'700'}}>{entry.employee_display_name}</Text><Text style={{color:colors.muted}}>Base: {money(entry.base_amount)} · Comisiones: {money(entry.commission_amount)}</Text><Text style={{color:colors.text}}>Liquidado: {money(entry.net_amount)} · Pagado: {money(entry.paid_amount)}</Text><Text style={{color:colors.text}}>Pendiente: {money(entry.outstanding_amount)}</Text>{run.status==='approved'&&Number(entry.outstanding_amount)>0?button('Registrar pago de '+entry.employee_display_name,()=>openEditor({kind:'payroll',entry,branchId:run.branch_id??scope.branchId??null}),busy||Boolean(pending)||Boolean(storageError)):null}</View>)}</View>)}</>}
        {mode==='profitability'&&(!profits.length?<Text style={{color:colors.muted}}>No hay registros con estos filtros.</Text>:profits.map(row=><View key={row.id} style={[styles.card,{borderColor:colors.border}]}><Text style={[styles.bold,{color:colors.text}]}>{row.label}</Text><Text style={{color:colors.text}}>Ingresos: {money(row.revenue)}</Text><Text style={{color:colors.text}}>Costo directo: {row.directCosts===null?'No disponible':money(row.directCosts)}</Text><Text style={{color:colors.text}}>Resultado bruto: {row.complete&&row.grossProfit!==null?money(row.grossProfit):'Incompleto: faltan costos'}</Text></View>))}
      </>}
      {button('Ver deudas de clientes',()=>router.push('/panel/credits' as never))}
    </ScrollView>
    <BottomSheet visible={Boolean(editor)} title={editor==='expense'?'Registrar gasto':isPayroll(editor)?'Pagar sueldo':'Registrar pago'} subtitle="El resultado se guarda en el mismo sistema que la web." onClose={()=>{if(!busy)setEditor(null);}} footer={<Pressable accessibilityRole="button" disabled={busy||lookupsLoading||Boolean(pending)} onPress={()=>{save();}} style={[styles.button,{borderColor:colors.border,opacity:busy||lookupsLoading||pending?0.45:1}]}><Text style={{color:palette.primary}}>{busy?'Registrando…':pending?'Recuperá la operación pendiente':'Confirmar'}</Text></Pressable>}>
      {lookupsLoading?<ActivityIndicator color={palette.primary}/>:null}
      {formError?<Text accessibilityRole="alert" style={{color:palette.danger}}>{formError}</Text>:null}
      <View pointerEvents={busy?'none':'auto'} style={{gap:14}}>
        {editor==='expense'?<><Text style={{color:colors.text}}>Sucursal</Text><View style={styles.wrap}>{branches.map(item=>button((branch===item.id?'✓ ':'')+item.name,()=>setBranch(item.id),Boolean(scope.branchId&&scope.branchId!==item.id)))}</View><Text style={{color:colors.text}}>Categoría</Text><View style={styles.wrap}>{categories.map(item=>button((category===item.id?'✓ ':'')+item.name,()=>setCategory(item.id)))}</View>{field('Concepto',concept,setConcept)}{field('Proveedor (opcional)',vendor,setVendor)}</>:<Text style={{color:colors.text}}>{isPayroll(editor)?editor.entry.employee_display_name+' · ':''}Pendiente: {isPayroll(editor)?money(editor.entry.outstanding_amount):editor?money(editor.outstanding_amount):''}. Podés registrar un pago parcial.</Text>}
        {field('Monto (ej.: 150.000)',amount,setAmount,true)}<DateField label={editor==='expense'?'Fecha del gasto':'Fecha del pago'} value={date} onChange={setDate} today={today} disabled={busy||Boolean(pending)}/>
        {editor==='expense'?<DateField label="Vencimiento (opcional)" value={dueDate} onChange={setDueDate} today={today} optional disabled={busy||Boolean(pending)}/>:<><Text style={{color:colors.text}}>Medio de pago</Text><View style={styles.wrap}>{[['bank_transfer','Transferencia'],['cash','Efectivo'],['other','Otro']].map(([value,label])=>button((method===value?'✓ ':'')+label,()=>setMethod(value)))}</View>{method==='cash'?<><Text style={{color:colors.muted}}>{isPayroll(editor)&&!editor.branchId?'Elegí una sucursal arriba en Finanzas para pagar en efectivo desde su caja.':'El efectivo requiere una caja abierta de la sucursal.'}</Text>{sessions.map(item=>button((session===item.id?'✓ ':'')+item.registerName,()=>setSession(item.id)))}{!sessions.length?button('Abrir o revisar caja',()=>{setEditor(null);router.push('/panel/cash-register' as never);}):null}</>:null}{field('Referencia (opcional)',reference,setReference)}</>}
      </View>
    </BottomSheet>
    <BottomSheet visible={Boolean(voiding)} title="Anular gasto" subtitle="Queda registrado como anulado con su motivo; no se borra." onClose={()=>{if(!busy)setVoiding(null);}} footer={<Pressable accessibilityRole="button" disabled={busy} onPress={()=>{void confirmVoid();}} style={[styles.button,{borderColor:palette.danger+'66',opacity:busy?0.45:1}]}><Text style={{color:palette.danger,fontWeight:'700'}}>{busy?'Anulando…':'Anular gasto'}</Text></Pressable>}>
      {voiding?<View style={{gap:12}}>
        <Text style={{color:colors.text,fontWeight:'700'}}>{voiding.concept||'Gasto'} · {money(voiding.amount,voiding.currency)}</Text>
        {Number(voiding.paid_amount)>0?<Text style={{color:colors.muted}}>Ya tiene pagos por {money(voiding.paid_amount,voiding.currency)}: al anularlo, esos pagos también se revierten.</Text>:null}
        {voidError?<Text accessibilityRole="alert" style={{color:palette.danger}}>{voidError}</Text>:null}
        {field('Motivo de la anulación',voidReason,setVoidReason)}
        {voiding.requires_cash_session_on_void?<><Text style={{color:colors.text}}>Caja donde vuelve el efectivo</Text>{voidSessions.map(item=>button((voidSession===item.id?'✓ ':'')+item.registerName,()=>setVoidSession(item.id)))}{!voidSessions.length?button('Abrir o revisar caja',()=>{setVoiding(null);router.push('/panel/cash-register' as never);}):null}</>:null}
      </View>:null}
    </BottomSheet>
  </>;
}
const styles=StyleSheet.create({content:{padding:16,gap:14,paddingBottom:40},title:{fontSize:21,fontWeight:'800'},bold:{fontSize:16,fontWeight:'700'},card:{borderWidth:1,borderRadius:20,padding:18,gap:10},wrap:{flexDirection:'row',flexWrap:'wrap',gap:8},button:{borderWidth:1,borderRadius:11,paddingHorizontal:12,paddingVertical:11,alignItems:'center'},input:{borderWidth:1,borderRadius:12,padding:12,fontSize:15}});