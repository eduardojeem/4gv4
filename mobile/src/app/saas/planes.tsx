import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { SaasButton, SaasCard, SaasHeading, SaasPage, saasStyles, useSaasAccent } from '@/components/saas/ui';
import { formatGs } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';
import { openSaasLink, useSaas, type SaasPlan } from '@/lib/saas';

export default function SaasPlans() {
  const colors = usePalette();
  const { catalog, loading, error, updatedAt, refresh } = useSaas();
  return <SaasPage>
    <SaasHeading eyebrow="Planes" title="Elegí con información clara."
      description="Precios mensuales, límites y funciones del catálogo vigente. La creación de la cuenta continúa en la web con el plan seleccionado." />
    {loading && !catalog && <View accessibilityRole="progressbar" accessibilityLabel="Cargando planes" style={styles.loading}>
      <ActivityIndicator color={palette.primary} /><Text style={{ color: colors.muted }}>Consultando planes disponibles…</Text>
    </View>}
    {error && <SaasCard>
      <Text accessibilityRole="alert" style={[saasStyles.body, { color: colors.text }]}>{catalog ? 'No se pudo actualizar el catálogo. Los datos que ves pueden haber cambiado.' : error}</Text>
      {updatedAt && <Text style={[saasStyles.note, { color: colors.muted }]}>Última consulta: {updatedAt.toLocaleString('es-PY')}</Text>}
      <SaasButton label="Volver a consultar" secondary disabled={loading} onPress={() => void refresh()} />
    </SaasCard>}
    {!loading && !error && catalog?.plans.length === 0 && <SaasCard>
      <Text style={[saasStyles.body, { color: colors.text }]}>No hay planes publicados en este momento.</Text>
      <Text style={[saasStyles.note, { color: colors.muted }]}>Volvé a consultar más tarde para ver las opciones disponibles.</Text>
      <SaasButton label="Actualizar" secondary onPress={() => void refresh()} />
    </SaasCard>}
    {catalog?.plans.map((plan) => <PlanCard key={plan.id} plan={plan} disabled={loading || Boolean(error)} />)}
    {catalog?.branding.secondaryCtaHref && <SaasButton label={catalog.branding.secondaryCtaLabel || 'Consultar opciones'} secondary icon="open-outline"
      onPress={() => void openSaasLink(catalog.branding.secondaryCtaHref)} />}
    <Text style={[saasStyles.note, { color: colors.muted }]}>El registro se abre en la web. Al terminar, volvé a la aplicación e ingresá con tu cuenta. Las funciones disponibles también dependen de los permisos asignados a cada usuario.</Text>
  </SaasPage>;
}

function PlanCard({ plan, disabled }: { plan: SaasPlan; disabled: boolean }) {
  const colors = usePalette();
  const accent = useSaasAccent();
  const priceLabel = plan.price === 0 ? 'Gratis' : formatGs(plan.price);
  return <SaasCard>
    {plan.is_popular && <Text style={[styles.badge, { color: accent }]}>Destacado</Text>}
    <Text accessibilityRole="header" style={[styles.planName, { color: colors.text }]}>{plan.name}</Text>
    {Boolean(plan.description) && <Text style={[saasStyles.body, { color: colors.muted }]}>{plan.description}</Text>}
    <View style={styles.priceRow}>
      <Text style={[styles.price, { color: colors.text }]}>{priceLabel}</Text>
      {plan.price > 0 && <Text style={[saasStyles.note, { color: colors.muted }]}>/ mes</Text>}
    </View>
    {Boolean(plan.price_note) && <Text style={[saasStyles.note, { color: colors.muted }]}>{plan.price_note}</Text>}
    {plan.trial_days > 0 && <Text style={[saasStyles.body, { color: colors.text }]}>{plan.trial_days} días de prueba</Text>}
    <View style={[styles.limits, { borderColor: colors.border }]}>
      {plan.limits.map((limit) => <View key={limit.key} style={styles.limitRow}>
        <Text style={[styles.limitLabel, { color: colors.muted }]}>{limit.label}</Text>
        <Text style={[styles.limitValue, { color: colors.text }]}>{limit.value}</Text>
      </View>)}
    </View>
    {plan.features.length > 0 && <>
      <Text style={[styles.featuresTitle, { color: colors.text }]}>Funciones incluidas</Text>
      {plan.features.map((feature) => <View key={feature.key} style={styles.feature}>
        <Ionicons name="checkmark-circle-outline" color={accent} size={19} accessible={false} />
        <Text style={[styles.featureLabel, { color: colors.text }]}>{feature.label}</Text>
      </View>)}
    </>}
    <SaasButton label={plan.trial_days > 0 ? `Probar ${plan.trial_days} días gratis` : plan.price === 0 ? 'Crear cuenta gratis' : 'Elegir este plan'}
      icon="open-outline" disabled={disabled} onPress={() => void openSaasLink(plan.ctaHref)} />
  </SaasCard>;
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', gap: 12, paddingVertical: 32 },
  badge: { fontSize: 12, lineHeight: 18, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  planName: { fontSize: 24, lineHeight: 31, fontWeight: '800' },
  priceRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 8, paddingTop: 8 },
  price: { fontSize: 30, lineHeight: 39, fontWeight: '800', fontVariant: ['tabular-nums'] },
  limits: { borderTopWidth: 1, paddingTop: 14, gap: 12 },
  limitRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  limitLabel: { fontSize: 14, lineHeight: 21, flexShrink: 1 },
  limitValue: { fontSize: 14, lineHeight: 21, fontWeight: '600', flexShrink: 1 },
  featuresTitle: { fontSize: 15, lineHeight: 23, fontWeight: '700', marginTop: 4 },
  feature: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  featureLabel: { flex: 1, fontSize: 14, lineHeight: 21 },
});
