import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { BottomSheet } from '../bottom-sheet';
import { useUnsavedChangesGuard } from '../website/website-ui';
import { BILLING_FIELDS, type BillingProfile } from '@/lib/subscription-model';
import { saveBillingProfile } from '@/lib/admin';
import { usePalette } from '@/lib/palette';
import { getPrivateCacheContext, isPrivateCacheSnapshotCompatible } from '@/lib/private-cache-context';

const draftOf = (profile: BillingProfile | null) => Object.fromEntries(BILLING_FIELDS.map(field => [field.key, profile?.[field.key] ?? ''])) as Record<keyof BillingProfile, string>;
export function BillingCard({ profile, onSaved, onEditingChange }: { profile: BillingProfile | null; onSaved: (profile: BillingProfile) => void; onEditingChange: (editing: boolean) => void }) {
  const colors = usePalette();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => draftOf(profile));
  const [baseline, setBaseline] = useState(() => draftOf(profile));
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = editing && JSON.stringify(draft) !== JSON.stringify(baseline);
  const finish = () => { setEditing(false); onEditingChange(false); };
  const save = async () => {
    if (busy.current) return false;
    const blank = BILLING_FIELDS.find(field => !draft[field.key].trim());
    if (blank) { setError('Completá ' + blank.label.toLowerCase() + '.'); return false; }
    busy.current = true; setSaving(true); setError(null);
    const scope = getPrivateCacheContext();
    try {
      const next = await saveBillingProfile(Object.fromEntries(BILLING_FIELDS.map(field => [field.key,draft[field.key].trim()])) as BillingProfile);
      if (!isPrivateCacheSnapshotCompatible(scope)) return false;
      onSaved(next); finish(); return true;
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudieron guardar los datos.'); return false; }
    finally { busy.current = false; setSaving(false); }
  };
  useUnsavedChangesGuard(dirty, save, saving);
  const close = () => {
    if (busy.current) return;
    if (!dirty) { finish(); return; }
    if (Platform.OS === 'web') { if (window.confirm('¿Descartar los cambios de facturación?')) finish(); return; }
    Alert.alert('Cambios sin guardar', '¿Querés descartar los cambios de facturación?', [{text:'Seguir editando',style:'cancel'},{text:'Descartar',style:'destructive',onPress:finish}]);
  };
  return <>
    <View style={{ padding: 16, gap: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }}>
      <View style={{ flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12 }}>
        <Text style={{ color:colors.text,fontSize:16,fontWeight:'800',flex:1 }}>Datos de facturación</Text>
        <Pressable accessibilityRole="button" onPress={() => {const next=draftOf(profile);setDraft(next);setBaseline(next);setError(null);setEditing(true);onEditingChange(true);}} style={{minHeight:44,justifyContent:'center',paddingHorizontal:8}}><Text style={{color:colors.text,fontWeight:'700'}}>Editar</Text></Pressable>
      </View>
      {BILLING_FIELDS.map(field => <View key={field.key} style={{gap:3}}><Text style={{color:colors.muted,fontSize:12}}>{field.label}</Text><Text selectable style={{color:colors.text,fontSize:14}}>{profile?.[field.key] || 'Sin completar'}</Text></View>)}
    </View>
    <BottomSheet visible={editing} title="Datos de facturación" subtitle="Estos datos se usan para las facturas de tu suscripción." onClose={close} footer={<View style={{flexDirection:'row',gap:12,paddingTop:12}}><Pressable accessibilityRole="button" disabled={saving} onPress={close} style={{flex:1,padding:15,alignItems:'center'}}><Text style={{color:colors.text}}>Cancelar</Text></Pressable><Pressable accessibilityRole="button" disabled={saving} onPress={() => void save()} style={{flex:1,padding:15,alignItems:'center',backgroundColor:colors.text,borderRadius:12,opacity:saving ? 0.6 : 1}}>{saving?<ActivityIndicator color={colors.card}/>:<Text style={{color:colors.card,fontWeight:'700'}}>Guardar</Text>}</Pressable></View>}>
      {BILLING_FIELDS.map(field => <View key={field.key} style={{gap:6}}><Text style={{color:colors.muted}}>{field.label}</Text><TextInput value={draft[field.key]} editable={!saving} onChangeText={value => {setDraft(prev=>({...prev,[field.key]:value}));setError(null);}} accessibilityLabel={field.label} placeholder={field.placeholder} placeholderTextColor={colors.muted} keyboardType={field.keyboard??'default'} autoCapitalize={field.keyboard==='email-address'?'none':'sentences'} autoCorrect={false} style={{color:colors.text,borderWidth:1,borderColor:colors.border,borderRadius:12,padding:12,minHeight:48}}/></View>)}
      {error&&<Text accessibilityRole="alert" style={{color:'#DC2626'}}>{error}</Text>}
    </BottomSheet>
  </>;
}
