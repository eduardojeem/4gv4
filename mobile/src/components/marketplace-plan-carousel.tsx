import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { AccessibilityInfo, ActivityIndicator, AppState, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { apiFetch } from '../lib/api';
import { palette, usePalette } from '../lib/palette';
import { openRegistration } from '../lib/registration';
import { planAudiences, planPrice, planRegistrationPath, type MarketplacePlan } from '../../../src/lib/public/marketplace-plan';

export function MarketplacePlanCarousel() {
  const colors = usePalette();
  const [plans, setPlans] = useState<MarketplacePlan[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [width, setWidth] = useState(280);
  const [active, setActive] = useState(0);
  const track = useRef<ScrollView>(null);
  const region = useRef<View>(null);
  const { height: screenHeight } = useWindowDimensions();
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [screenReader, setScreenReader] = useState(true);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (alive) setReducedMotion(value); });
    void AccessibilityInfo.isScreenReaderEnabled().then(value => { if (alive) setScreenReader(value); });
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    const reader = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader);
    return () => { alive = false; motion.remove(); reader.remove(); };
  }, []);
  useEffect(() => {
    if (paused || reducedMotion || screenReader || plans.length < 2) return;
    const timer = setInterval(() => {
      if (AppState.currentState !== 'active') return;
      region.current?.measureInWindow((_x, y, _width, height) => {
        if (y < screenHeight && y + height > 0) track.current?.scrollTo({ x: ((active + 1) % plans.length) * (width + 12), animated: true });
      });
    }, 8000);
    return () => clearInterval(timer);
  }, [active, paused, reducedMotion, screenReader, plans.length, width, screenHeight]);
  useEffect(() => {
    let alive = true;
    apiFetch<{ plans: MarketplacePlan[] }>('/api/mobile/saas', { auth: false }).then(data => {
      if (!Array.isArray(data.plans)) throw new Error('catalog');
      if (alive) { setPlans(data.plans); setStatus('ready'); }
    }).catch(() => { if (alive) setStatus('error'); });
    return () => { alive = false; };
  }, [attempt]);
  function goTo(index: number) {
    setPaused(true);
    track.current?.scrollTo({ x: index * (width + 12), animated: !reducedMotion });
    setActive(index);
  }
  return <View ref={region} collapsable={false} style={[styles.root, { borderColor: colors.border }]}>
    <View style={styles.heading}><Text style={[styles.eyebrow, { color: palette.primary }]}>UN PLAN PARA TU PRÓXIMO PASO</Text><Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Tu empresa empieza acá.</Text><Text style={[styles.note, { color: colors.muted }]}>Deslizá y elegí cómo querés crecer.</Text></View>
    {status === 'loading' && <View style={styles.heading}><ActivityIndicator color={palette.primary}/><Text accessibilityLiveRegion="polite" style={{ color: colors.muted }}>Consultando planes…</Text></View>}
    {status === 'error' && <View style={styles.heading}><Text accessibilityRole="alert" style={{ color: colors.text }}>No pudimos consultar los planes.</Text><Pressable accessibilityRole="button" style={styles.control} onPress={() => { setStatus('loading'); setAttempt(value => value + 1); }}><Text style={{ color: palette.primary, fontWeight: '700' }}>Volver a intentar</Text></Pressable></View>}
    {status === 'ready' && !plans.length && <Text style={[styles.heading, { color: colors.muted }]}>No hay planes publicados en este momento.</Text>}
    <View onLayout={event => {
      const next = event.nativeEvent.layout.width;
      if (next > 0 && next !== width) { setWidth(next); track.current?.scrollTo({ x: active * (next + 12), animated: false }); }
    }} style={styles.viewport}>
      <ScrollView ref={track} onScrollBeginDrag={() => setPaused(true)} horizontal snapToInterval={width + 12} decelerationRate="fast" showsHorizontalScrollIndicator={false} contentContainerStyle={styles.track} accessibilityLabel="Planes disponibles" scrollEventThrottle={32} onScroll={event => setActive(Math.min(Math.max(0, plans.length - 1), Math.max(0, Math.round(event.nativeEvent.contentOffset.x / (width + 12)))))}>
        {plans.map((plan, index) => <View key={plan.id} style={[styles.card, { width, borderColor: colors.border, backgroundColor: colors.card }]}>
          <View style={styles.hero}>
            <View style={styles.heroTop}><Text style={styles.heroLabel}>PARA TU EMPRESA</Text><Text style={styles.heroLabel}>{plan.is_popular ? 'DESTACADO' : 'PLAN ' + String(index + 1).padStart(2, '0')}</Text></View>
            <Text accessibilityRole="header" style={styles.name}>{plan.name}</Text><Text style={[styles.note, styles.heroNote]}>{plan.description || 'Herramientas para gestionar tu negocio.'}</Text>
            <Text style={[styles.eyebrow, styles.audienceTitle]}>PARA QUÉ NEGOCIOS SIRVE</Text><View style={styles.badges}>{planAudiences(plan).map(label => <Text key={label} style={styles.badge}>{label}</Text>)}{planAudiences(plan).length === 0 && <Text style={[styles.note, styles.heroNote]}>Consultá las funciones incluidas.</Text>}</View>
            <View style={styles.priceBlock}><Text style={styles.price}>{planPrice(plan)}</Text>{Boolean(plan.price_note) && <Text style={[styles.note, styles.heroNote]}>{plan.price_note}</Text>}{plan.trial_days > 0 && <Text style={styles.trial}>{plan.trial_days} días de prueba</Text>}</View>
          </View>
          <View style={styles.details}><Text style={[styles.eyebrow, { color: colors.muted }]}>LO QUE INCLUYE TU PLAN</Text><View style={styles.limits}>{plan.limits.slice(0, 4).map(limit => <View key={limit.key} style={[styles.limit, { backgroundColor: colors.background, borderColor: colors.border }]}><Text style={[styles.note, { color: colors.muted }]}>{limit.label}</Text><Text style={[styles.limitValue, { color: colors.text }]}>{limit.value}</Text></View>)}</View>
            {plan.features.slice(0, 3).map(feature => <Text key={feature.key} style={[styles.note, { color: colors.text }]}>✓ {feature.label}</Text>)}<View style={{ flex: 1 }}/>
            <Pressable accessibilityRole="button" accessibilityLabel={'Registrar mi empresa con ' + plan.name} onPress={() => void openRegistration(planRegistrationPath(plan))} style={({ pressed }) => [styles.button, { backgroundColor: palette.primary, opacity: pressed ? .8 : 1 }]}><Text style={styles.buttonText}>Registrar mi empresa →</Text></Pressable><Text style={[styles.caption, { color: colors.muted }]}>Empezás con el plan {plan.name} seleccionado.</Text>
          </View>
        </View>)}
      </ScrollView>
    </View>
    {plans.length > 0 && <View style={styles.navigation}><Pressable accessibilityRole="button" accessibilityLabel="Plan anterior" disabled={active === 0} accessibilityState={{ disabled: active === 0 }} style={[styles.arrow, { borderColor: colors.border, opacity: active === 0 ? .3 : 1 }]} onPress={() => goTo(active - 1)}><Text style={{ color: colors.text, fontSize: 22 }}>←</Text></Pressable><View style={styles.dots}>{plans.map((plan, index) => <Pressable key={plan.id} accessibilityRole="button" accessibilityLabel={'Ver plan ' + plan.name} accessibilityState={{ selected: active === index }} style={styles.dotTarget} onPress={() => goTo(index)}><View style={[styles.dot, { width: active === index ? 22 : 7, backgroundColor: active === index ? palette.primary : colors.border }]}/></Pressable>)}</View><Pressable accessibilityRole="button" accessibilityLabel="Plan siguiente" disabled={active === plans.length - 1} accessibilityState={{ disabled: active === plans.length - 1 }} style={[styles.arrow, { borderColor: colors.border, opacity: active === plans.length - 1 ? .3 : 1 }]} onPress={() => goTo(active + 1)}><Text style={{ color: colors.text, fontSize: 22 }}>→</Text></Pressable></View>}
    {plans.length > 1 && !reducedMotion && !screenReader && <Pressable accessibilityRole="button" accessibilityState={{ selected: !paused }} onPress={() => setPaused(value => !value)} style={styles.compare}><Text style={{ color: colors.muted, fontSize: 12, fontWeight: '600' }}>{paused ? '▶ Reanudar movimiento' : 'Ⅱ Pausar movimiento'}</Text></Pressable>}
    <Pressable accessibilityRole="button" onPress={() => router.push('/saas/planes' as never)} style={styles.compare}><Text style={{ color: palette.primary, fontSize: 13, fontWeight: '700' }}>Comparar todas las funciones →</Text></Pressable>
    <View style={[styles.existing, { backgroundColor: colors.background, borderColor: colors.border }]}><Text style={[styles.existingTitle, { color: colors.text }]}>¿Ya tenés una empresa registrada?</Text><Text style={[styles.note, { color: colors.muted }]}>Ingresá con tu cuenta para seguir gestionándola.</Text><Pressable accessibilityRole="button" style={styles.control} onPress={() => router.push('/sign-in' as never)}><Text style={{ color: palette.primary, fontWeight: '700', fontSize: 13 }}>Ya tengo una empresa · Ingresar →</Text></Pressable></View>
  </View>;
}
const styles = StyleSheet.create({
  root: { borderTopWidth: 1, paddingVertical: 22 }, heading: { paddingHorizontal: 18, gap: 9, marginBottom: 20 }, eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1 }, title: { fontSize: 25, lineHeight: 31, fontWeight: '800', letterSpacing: -.5 }, note: { fontSize: 12, lineHeight: 19 }, viewport: { marginHorizontal: 14 }, track: { gap: 12 }, card: { borderRadius: 22, borderWidth: 1, overflow: 'hidden' }, hero: { backgroundColor: '#0F172A', padding: 22, gap: 12 }, heroTop: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }, heroLabel: { color: '#CBD5E1', fontSize: 9, fontWeight: '700', letterSpacing: .8 }, name: { color: '#FFFFFF', fontSize: 36, lineHeight: 43, fontWeight: '800', marginTop: 8, letterSpacing: -.6 }, heroNote: { color: '#CBD5E1' }, audienceTitle: { color: '#94A3B8', marginTop: 8 }, badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, badge: { color: '#DBEAFE', backgroundColor: '#1E3A5F', fontSize: 11, fontWeight: '600', paddingVertical: 6, paddingHorizontal: 9, borderRadius: 8 }, priceBlock: { borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 18, marginTop: 6, gap: 8 }, price: { color: '#FFFFFF', fontSize: 34, fontWeight: '800', letterSpacing: -.6 }, trial: { color: '#DBEAFE', fontSize: 12, fontWeight: '700' }, details: { padding: 20, gap: 12, flex: 1 }, limits: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 4 }, limit: { width: '48%', flexGrow: 1, borderWidth: 1, padding: 10, borderRadius: 12, gap: 4 }, limitValue: { fontSize: 20, fontWeight: '800' }, button: { minHeight: 48, borderRadius: 12, padding: 12, alignItems: 'center', justifyContent: 'center', marginTop: 10 }, buttonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', textAlign: 'center' }, caption: { fontSize: 10, lineHeight: 16, textAlign: 'center' }, navigation: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 18, marginTop: 12, gap: 4 }, arrow: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, dots: { flexDirection: 'row', flexShrink: 1, flexWrap: 'wrap', justifyContent: 'center' }, dotTarget: { minWidth: 40, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, dot: { height: 7, borderRadius: 6 }, compare: { alignItems: 'center', justifyContent: 'center', minHeight: 44, marginHorizontal: 18, marginVertical: 6 }, existing: { marginHorizontal: 14, padding: 18, borderWidth: 1, borderRadius: 16, gap: 7 }, existingTitle: { fontSize: 13, fontWeight: '700' }, control: { minHeight: 44, justifyContent: 'center' },
});
