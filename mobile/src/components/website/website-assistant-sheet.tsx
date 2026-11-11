import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { palette, usePalette } from '@/lib/palette';
import { usePanel } from '@/lib/panel';
import {
  saveCompanyInfo,
  saveWebsiteSettings,
  websiteErrorMessage,
} from '@/lib/website-admin';
import { useWebsite } from '@/lib/website-context';
import {
  DEFAULT_TRUST_BAR,
  TRUST_BAR_ICONS,
  generateMobileWebsiteSuggestion,
  mergeSetting,
  resolveWebsiteFocus,
  type AssistantTone,
  type WebsiteSuggestion,
} from '@/lib/website-model';
import {
  ChipSelector,
  Field,
  Notice,
  StatusPill,
  websiteStyles,
} from './website-ui';

const TONES: { value: AssistantTone; label: string }[] = [
  { value: 'cercano', label: 'Cercano' },
  { value: 'profesional', label: 'Profesional' },
  { value: 'premium', label: 'Premium' },
  { value: 'juvenil', label: 'Juvenil' },
];

export function WebsiteAssistantSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const colors = usePalette();
  const { settings, capabilities, checklist, applySaved } = useWebsite();
  const { reload: reloadPanel } = usePanel();

  const [about, setAbout] = useState('');
  const [tone, setTone] = useState<AssistantTone>('cercano');
  const [variant, setVariant] = useState(0);
  const [suggestion, setSuggestion] = useState<WebsiteSuggestion | null>(null);
  const [applyHero, setApplyHero] = useState(true);
  const [applyIdentity, setApplyIdentity] = useState(true);
  const [applyBenefits, setApplyBenefits] = useState(true);
  const [saving, setSaving] = useState(false);

  const generate = (nextVariant = 0) => {
    if (!settings) return;
    if (about.trim().length < 8) {
      Alert.alert(
        'Contanos un poco más',
        'Escribí al menos una frase sobre lo que hacés o vendés (por ejemplo: "Vendemos celulares y hacemos envíos en Asunción").',
      );
      return;
    }
    const focus = resolveWebsiteFocus(capabilities);
    const serviceTitles = (settings.services ?? [])
      .filter((s) => s.active !== false)
      .map((s) => s.title);
    const pending = [...(checklist?.essentials ?? []), ...(checklist?.recommended ?? [])]
      .filter((step) => !step.done)
      .map((step) => ({ section: step.section }));

    const next = generateMobileWebsiteSuggestion({
      about: about.trim(),
      tone,
      variant: nextVariant,
      name: settings.company_info.name?.trim() || '',
      vertical: capabilities.businessVertical,
      focus,
      services: serviceTitles,
      bookingAvailable: capabilities.hasServices,
      commerceMode: settings.checkout?.commerceMode ?? 'cart',
      pending,
    });
    setVariant(nextVariant);
    setSuggestion(next);
  };

  const applySelected = async () => {
    if (!settings || !suggestion) return;
    if (!applyHero && !applyIdentity && !applyBenefits) {
      Alert.alert('Elegí al menos un bloque', 'Marcá qué textos querés aplicar a tu tienda.');
      return;
    }
    setSaving(true);
    try {
      if (applyIdentity) {
        const savedCompany = await saveCompanyInfo(settings.company_info, {
          slogan: suggestion.slogan,
          description: suggestion.description,
        });
        applySaved({
          company_info: savedCompany ?? {
            ...settings.company_info,
            slogan: suggestion.slogan,
            description: suggestion.description,
          },
        });
        reloadPanel();
      }

      const settingsPatch: Record<string, unknown> = {};
      if (applyHero) {
        settingsPatch.hero_content = mergeSetting(
          (settings.hero_content ?? {}) as Record<string, unknown>,
          {
            enabled: true,
            badge: suggestion.hero.badge,
            title: suggestion.hero.title,
            subtitle: suggestion.hero.subtitle,
            ctaPrimaryText: suggestion.hero.ctaPrimaryText,
            ctaSecondaryText: suggestion.hero.ctaSecondaryText,
          },
        );
      }
      if (applyBenefits) {
        const baseTrust = settings.trust_bar ?? DEFAULT_TRUST_BAR;
        settingsPatch.trust_bar = {
          ...baseTrust,
          enabled: true,
          items: suggestion.trustBar.map((item, idx) => ({
            id: `ai-${idx + 1}`,
            icon: item.icon,
            title: item.title,
            description: item.description,
            active: true,
          })),
        };
      }
      if (Object.keys(settingsPatch).length > 0) {
        const saved = await saveWebsiteSettings(settingsPatch);
        applySaved(saved);
      }

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        '¡Propuesta aplicada!',
        'Los textos seleccionados ya quedaron guardados en tu sitio web.',
      );
      onClose();
    } catch (error) {
      Alert.alert(
        'No pudimos guardar',
        websiteErrorMessage(
          error,
          'No pudimos guardar la propuesta. Revisá tu conexión e intentá nuevamente.',
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  const closeAndReset = () => {
    if (saving) return;
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      tall
      title="Asistente de textos"
      subtitle="Generá portada, slogan y beneficios a partir de tu negocio"
      onClose={closeAndReset}
      footer={
        suggestion ? (
          <View style={styles.footerRow}>
            <Pressable
              onPress={() => generate(variant + 1)}
              disabled={saving}
              style={[
                websiteStyles.secondaryButton,
                { borderColor: colors.border, flex: 1 },
              ]}
            >
              <Ionicons name="sparkles-outline" size={16} color={palette.primary} />
              <Text style={[websiteStyles.secondaryText, { color: palette.primary }]}>
                Otra variante
              </Text>
            </Pressable>
            <Pressable
              onPress={() => void applySelected()}
              disabled={saving}
              style={[websiteStyles.primaryButton, { flex: 1.3 }]}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={17} color="#fff" />
                  <Text style={websiteStyles.primaryText}>Aplicar elegidos</Text>
                </>
              )}
            </Pressable>
          </View>
        ) : undefined
      }
    >
      <Field
        label="Contanos qué hacés en 2 o 3 líneas"
        value={about}
        onChangeText={setAbout}
        multiline
        maxLength={320}
        showCount
        placeholder="Ej: Vendemos celulares, fundas y hacemos servicio técnico con envíos en Asunción y cuotas sin interés."
      />

      <View style={styles.toneWrap}>
        <Text style={[styles.sectionLabel, { color: colors.text }]}>
          Tono de comunicación
        </Text>
        <ChipSelector options={TONES} selected={tone} onSelect={setTone} />
      </View>

      <Pressable
        onPress={() => generate(0)}
        disabled={saving}
        style={websiteStyles.primaryButton}
      >
        <Ionicons name="sparkles" size={17} color="#fff" />
        <Text style={websiteStyles.primaryText}>
          {suggestion ? 'Regenerar desde este texto' : 'Generar propuesta'}
        </Text>
      </Pressable>

      {suggestion ? (
        <View style={styles.results}>
          <CheckCard
            checked={applyHero}
            onToggle={() => setApplyHero((v) => !v)}
            title="Portada principal"
            badge="Hero"
          >
            <StatusPill label={suggestion.hero.badge} tone="primary" />
            <Text style={[styles.previewTitle, { color: colors.text }]}>
              {suggestion.hero.title}
            </Text>
            <Text style={[styles.previewSub, { color: colors.muted }]}>
              {suggestion.hero.subtitle}
            </Text>
            <Text style={[styles.ctaNote, { color: palette.primary }]}>
              Botones: «{suggestion.hero.ctaPrimaryText}» / «
              {suggestion.hero.ctaSecondaryText}»
            </Text>
          </CheckCard>

          <CheckCard
            checked={applyIdentity}
            onToggle={() => setApplyIdentity((v) => !v)}
            title="Slogan y descripción"
            badge="Negocio"
          >
            <Text style={[styles.previewTitle, { color: colors.text }]}>
              “{suggestion.slogan}”
            </Text>
            <Text style={[styles.previewSub, { color: colors.muted }]}>
              {suggestion.description}
            </Text>
          </CheckCard>

          <CheckCard
            checked={applyBenefits}
            onToggle={() => setApplyBenefits((v) => !v)}
            title="Beneficios destacados"
            badge={`${suggestion.trustBar.length} ítems`}
          >
            <View style={styles.benefitsList}>
              {suggestion.trustBar.map((item, idx) => {
                const iconMeta = TRUST_BAR_ICONS.find((i) => i.value === item.icon);
                return (
                  <View key={idx} style={styles.benefitItem}>
                    <Ionicons
                      name={(iconMeta?.ionicon as never) ?? 'checkmark-circle-outline'}
                      size={16}
                      color={palette.primary}
                    />
                    <View style={styles.flex}>
                      <Text style={[styles.benefitTitle, { color: colors.text }]}>
                        {item.title}
                      </Text>
                      <Text style={[styles.benefitDesc, { color: colors.muted }]}>
                        {item.description}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </CheckCard>

          {suggestion.tips.length > 0 ? (
            <Notice
              tone="info"
              text={`Próximos consejos: ${suggestion.tips
                .map((t) => t.advice)
                .join(' · ')}`}
            />
          ) : null}
        </View>
      ) : null}
    </BottomSheet>
  );
}

function CheckCard({
  checked,
  onToggle,
  title,
  badge,
  children,
}: {
  checked: boolean;
  onToggle: () => void;
  title: string;
  badge: string;
  children: React.ReactNode;
}) {
  const colors = usePalette();
  return (
    <View
      style={[
        styles.checkCard,
        {
          borderColor: checked ? palette.primary : colors.border,
          backgroundColor: colors.background,
        },
      ]}
    >
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        style={styles.checkHead}
      >
        <Ionicons
          name={checked ? 'checkbox' : 'square-outline'}
          size={21}
          color={checked ? palette.primary : colors.muted}
        />
        <Text style={[styles.checkTitle, { color: colors.text }]}>{title}</Text>
        <StatusPill label={badge} tone={checked ? 'primary' : 'neutral'} />
      </Pressable>
      <View style={styles.checkBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  toneWrap: { gap: 6 },
  sectionLabel: { fontSize: 13, fontWeight: '700' },
  results: { gap: 10, marginTop: 4 },
  checkCard: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  checkHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkTitle: { flex: 1, fontSize: 14, fontWeight: '800' },
  checkBody: { gap: 5, paddingLeft: 29 },
  previewTitle: { fontSize: 14, fontWeight: '800' },
  previewSub: { fontSize: 12, lineHeight: 17 },
  ctaNote: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  benefitsList: { gap: 6 },
  benefitItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  benefitTitle: { fontSize: 13, fontWeight: '700' },
  benefitDesc: { fontSize: 11 },
  footerRow: { flexDirection: 'row', gap: 10, paddingTop: 6 },
});
