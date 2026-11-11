import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text } from 'react-native';
import { Field, Notice, Section, WebsiteScreen, websiteStyles } from '@/components/website/website-ui';
import { apiFetch } from '@/lib/api';
import { customerIssues, customerPayload, type CustomerForm } from '@/lib/customer-registration-model';
import { palette } from '@/lib/palette';
import { requestCaptchaToken } from '@/lib/registration';
import { useSession } from '@/lib/session';
export default function CustomerRegistration() {
  const { signIn } = useSession();
  const [form,setForm]=useState<CustomerForm>({fullName:'',email:'',password:'',confirmPassword:''});
  const [busy,setBusy]=useState(false);
  const [submitted,setSubmitted]=useState(false);
  const [showPassword,setShowPassword]=useState(false);
  const pending=useRef(false);
  const issues=submitted ? customerIssues(form) : {};
  const set=(key:keyof CustomerForm,value:string)=>setForm(current=>({...current,[key]:value}));
  const submit=async()=>{
    if(pending.current)return;
    setSubmitted(true);
    if(Object.keys(customerIssues(form)).length)return;
    pending.current=true;setBusy(true);
    try {
      const token=await requestCaptchaToken('customer');
      if(!token)return;
      const result=await apiFetch<{success:boolean;data:{requiresEmailConfirmation:boolean}}>('/api/public/customer-register',{method:'POST',auth:false,body:JSON.stringify(customerPayload(form,token))});
      if(!result.success || !result.data)throw new Error('No pudimos confirmar la creación de tu cuenta. Probá ingresar antes de repetir el registro.');
      if(result.data.requiresEmailConfirmation){
        router.replace({pathname:'/sign-in',params:{registered:'1',confirmar:'1',account:'customer',email:form.email.trim()}} as never);
        return;
      }
      const message=await signIn(form.email.trim(),form.password);
      router.replace((message ? {pathname:'/sign-in',params:{registered:'1',account:'customer',email:form.email.trim()}} : '/') as never);
    }catch(cause){Alert.alert('No pudimos crear tu cuenta',cause instanceof Error ? cause.message : 'Revisá tu conexión e intentá nuevamente.');}
    finally{pending.current=false;setBusy(false);}
  };
  return <WebsiteScreen title="Tu cuenta personal" subtitle="Comprá y gestioná tus pedidos" saving={busy} footer={<Pressable accessibilityRole="button" accessibilityState={{disabled:busy,busy}} disabled={busy} onPress={()=>void submit()} style={[websiteStyles.primaryButton,{opacity:busy?0.6:1}]}>{busy?<ActivityIndicator color="#fff"/>:null}<Text style={websiteStyles.primaryText}>{busy?'Creando tu cuenta…':'Crear mi cuenta'}</Text></Pressable>}>
    <Notice text="No necesitás un comercio ni un plan. Esta cuenta no habilita herramientas de administración." />
    <Section title="Tus datos" icon="person-outline">
      <Field label="Nombre y apellido" value={form.fullName} onChangeText={value=>set('fullName',value)} maxLength={160} autoCapitalize="words" error={issues.fullName}/>
      <Field label="Correo electrónico" value={form.email} onChangeText={value=>set('email',value)} maxLength={254} keyboardType="email-address" autoCapitalize="none" error={issues.email}/>
      <Field label="Contraseña" value={form.password} onChangeText={value=>set('password',value)} maxLength={72} autoCapitalize="none" secure={!showPassword} help="Al menos 8 caracteres, una mayúscula, una minúscula y un número." error={issues.password}/>
      <Field label="Repetí la contraseña" value={form.confirmPassword} onChangeText={value=>set('confirmPassword',value)} maxLength={72} autoCapitalize="none" secure={!showPassword} error={issues.confirmPassword}/>
      <Pressable accessibilityRole="button" disabled={busy} onPress={()=>setShowPassword(value=>!value)}><Text style={{color:palette.primary,fontWeight:'700'}}>{showPassword?'Ocultar contraseña':'Mostrar contraseña'}</Text></Pressable>
    </Section>
    <Notice text="Vamos a abrir una verificación de seguridad en el navegador. Si te pedimos confirmar el email, después volvé a la app e ingresá."/>
    <Pressable accessibilityRole="button" disabled={busy} onPress={()=>router.replace('/sign-in' as never)} style={{padding:12,alignItems:'center'}}><Text style={{color:palette.primary}}>¿Ya tenés cuenta? Ingresá</Text></Pressable>
  </WebsiteScreen>;
}