import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { OfflineNotice, WebsiteGate } from '@/components/website/website-gate';
import {
  ChipSelector,
  Field,
  Notice,
  SaveBar,
  Section,
  StatusPill,
  ToggleRow,
  WebsiteScreen,
  useUnsavedChangesGuard,
  websiteStyles,
} from '@/components/website/website-ui';
import { palette, usePalette } from '@/lib/palette';
import {
  saveCompanyInfo,
  saveWebsiteSettings,
  websiteErrorMessage,
} from '@/lib/website-admin';
import { useWebsite } from '@/lib/website-context';
import {
  HOME_SECTIONS,
  brandHex,
  compatibleHeroPresets,
  heroFieldsForStyle,
  heroIssues,
  heroStatsIssues,
  isDirty,
  mergeSetting,
  sectionEnabled,
  type EditableSettingKey,
  type HeroContent,
  type HeroStats,
  type WebsiteSettings,
} from '@/lib/website-model';
import { remainingWebsiteEdits } from '@/lib/website-save-state';

type Edits = Partial<
  Record<'company_info' | EditableSettingKey, Record<string, unknown>>
>;

export default function HomeScreen() {
  return (
    <WebsiteGate title="Página de inicio">
      {(settings) => <HomeEditor settings={settings} />}
    </WebsiteGate>
  );
}

function HomeEditor({ settings }: { settings: WebsiteSettings }) {
  const colors = usePalette();
  const { applySaved, capabilities, resolvedStyle, availability } = useWebsite();
  const [edits, setEdits] = useState<Edits>({});
  const [saving, setSaving] = useState(false);
  const [newBadgeText, setNewBadgeText] = useState('');

  const edited = useMemo(() => {
    const next: WebsiteSettings = { ...settings };
    for (const [key, patch] of Object.entries(edits)) {
      next[key] = mergeSetting(
        (settings[key] as Record<string, unknown>) ?? {},
        patch ?? {},
      );
    }
    return next;
  }, [settings, edits]);

  const changedKeys = (Object.keys(edits) as (keyof Edits)[]).filter((key) =>
    isDirty(settings[key], edited[key]),
  );
  const dirty = changedKeys.length > 0;
  const hero = useMemo(
    () => (edited.hero_content ?? {}) as HeroContent,
    [edited.hero_content],
  );
  const stats = useMemo(
    () => (edited.hero_stats ?? {}) as HeroStats,
    [edited.hero_stats],
  );
  const hIssues = useMemo(() => heroIssues(hero), [hero]);
  const sIssues = useMemo(() => heroStatsIssues(stats), [stats]);
  const allIssues = useMemo(() => ({ ...hIssues, ...sIssues }), [hIssues, sIssues]);

  const edit = (key: keyof Edits, patch: Record<string, unknown>) =>
    setEdits((current) => ({
      ...current,
      [key]: { ...(current[key] ?? {}), ...patch },
    }));

  const presets = useMemo(
    () => compatibleHeroPresets(capabilities),
    [capabilities],
  );
  const styleFlags = useMemo(
    () => heroFieldsForStyle(resolvedStyle, capabilities),
    [resolvedStyle, capabilities],
  );

  const trustBadges = Array.isArray(hero.trustBadges) ? hero.trustBadges : [];
  const accent = brandHex(edited.company_info);

  const fillFromBusiness = () => {
    const company = edited.company_info;
    const preset = presets[0];
    edit('hero_content', {
      enabled: true,
      badge: hero.badge?.trim() || preset.badge,
      title:
        hero.title?.trim() ||
        (company.slogan?.trim() && company.slogan.trim().length >= 10
          ? company.slogan.trim()
          : preset.title),
      subtitle:
        hero.subtitle?.trim() ||
        (company.description?.trim() && company.description.trim().length >= 10
          ? company.description.trim().slice(0, 220)
          : preset.subtitle),
      ctaPrimaryText: hero.ctaPrimaryText?.trim() || preset.ctaPrimaryText,
      ctaSecondaryText:
        hero.ctaSecondaryText?.trim() || preset.ctaSecondaryText,
      trustBadges: trustBadges.length ? trustBadges : [...preset.trustBadges],
    });
    void Haptics.selectionAsync();
  };

  const addTrustBadge = () => {
    const val = newBadgeText.trim();
    if (!val || trustBadges.length >= 6) return;
    if (trustBadges.includes(val)) {
      setNewBadgeText('');
      return;
    }
    edit('hero_content', { trustBadges: [...trustBadges, val] });
    setNewBadgeText('');
  };

  const removeTrustBadge = (index: number) => {
    edit('hero_content', {
      trustBadges: trustBadges.filter((_, i) => i !== index),
    });
  };

  const save = useCallback(async () => {
    const msgs = Object.values(allIssues);
    if (msgs.length) {
      Alert.alert('Revisá la portada', msgs.join('\n'));
      return false;
    }
    setSaving(true);
    try {
      const settingKeys = changedKeys.filter(
        (key): key is EditableSettingKey => key !== 'company_info',
      );
      if (settingKeys.length) {
        const persisted = await saveWebsiteSettings(
          Object.fromEntries(settingKeys.map((key) => [key, edited[key]])),
        );
        applySaved(persisted as Partial<WebsiteSettings>);
      }
      if (changedKeys.includes('company_info')) {
        const result = await saveCompanyInfo(
          settings.company_info,
          edits.company_info ?? {},
        );
        applySaved({ company_info: result ?? edited.company_info });
      }
      setEdits((current) => remainingWebsiteEdits(current, edits));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return true;
    } catch (error) {
      Alert.alert(
        'No pudimos guardar',
        websiteErrorMessage(
          error,
          'No pudimos guardar los cambios. Revisá tu conexión e intentá nuevamente.',
        ),
      );
      return false;
    } finally {
      setSaving(false);
    }
  }, [allIssues, changedKeys, edited, edits, settings.company_info, applySaved]);

  useUnsavedChangesGuard(dirty, save, saving);

  const heroOn = hero.enabled !== false;
  const statsOn = stats.enabled !== false;
  const displayMode = stats.displayMode ?? 'stats';
  const metricLabels = capabilities.metricLabels;

  const visibleHomeSections = HOME_SECTIONS.filter(
    (s) =>
      s.id !== 'hero' &&
      (!s.availabilityKey || availability[s.availabilityKey].available),
  );

  return (
    <WebsiteScreen
      saving={saving}
      title="Página de inicio"
      subtitle="Portada, cifras y secciones"
      footer={
        <SaveBar
          dirty={dirty}
          saving={saving}
          onSave={() => void save()}
          onDiscard={() => setEdits({})}
        />
      }
    >
      <OfflineNotice />

      {/* Vista previa de portada Hero */}
      {heroOn ? (
        <View
          style={[
            styles.heroPreview,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View
            style={[styles.heroBadge, { backgroundColor: `${accent}1A` }]}
          >
            <Text style={[styles.heroBadgeText, { color: accent }]}>
              {hero.badge?.trim() || 'Etiqueta superior'}
            </Text>
          </View>
          <Text style={[styles.heroTitlePreview, { color: colors.text }]}>
            {hero.title?.trim() || 'Título principal de tu portada'}
          </Text>
          <Text style={[styles.heroSubPreview, { color: colors.muted }]}>
            {hero.subtitle?.trim() ||
              'Contá en una o dos líneas qué ofrecés y cómo te compran o reservan.'}
          </Text>
          {styleFlags.buttons ? (
            <View style={styles.ctaPreviewRow}>
              <View style={[styles.ctaBtnPrimary, { backgroundColor: accent }]}>
                <Text style={styles.ctaPrimaryLabel}>
                  {hero.ctaPrimaryText?.trim() || 'Ver catálogo'}
                </Text>
              </View>
              {hero.ctaSecondaryText?.trim() ? (
                <View
                  style={[
                    styles.ctaBtnSec,
                    { borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.ctaSecLabel, { color: colors.text }]}>
                    {hero.ctaSecondaryText.trim()}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
          {trustBadges.length > 0 ? (
            <View style={styles.previewBadgesRow}>
              {trustBadges.map((item) => (
                <View key={item} style={styles.previewTrustChip}>
                  <Ionicons
                    name="checkmark-circle"
                    size={12}
                    color={palette.success}
                  />
                  <Text
                    style={[styles.previewTrustText, { color: colors.muted }]}
                  >
                    {item}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Acciones rápidas + presets de Hero */}
      <Section
        title="Plantillas para tu portada"
        icon="sparkles-outline"
        hint="Elegí una base recomendada para tu rubro o completá con tus datos."
        right={
          <Pressable
            onPress={fillFromBusiness}
            hitSlop={6}
            style={[styles.quickFillBtn, { borderColor: palette.primary }]}
          >
            <Text style={styles.quickFillText}>Usar mis datos</Text>
          </Pressable>
        }
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.presetsScroll}
        >
          {presets.slice(0, 6).map((preset, idx) => (
            <Pressable
              key={preset.id}
              onPress={() => {
                edit('hero_content', {
                  enabled: true,
                  badge: preset.badge,
                  title: preset.title,
                  subtitle: preset.subtitle,
                  ctaPrimaryText: preset.ctaPrimaryText,
                  ctaSecondaryText: preset.ctaSecondaryText,
                  trustBadges: [...preset.trustBadges],
                });
                void Haptics.selectionAsync();
              }}
              style={[
                styles.presetCard,
                {
                  borderColor:
                    idx === 0 ? `${palette.primary}66` : colors.border,
                  backgroundColor: colors.background,
                },
              ]}
            >
              <View style={styles.presetTop}>
                <Text style={[styles.presetLabel, { color: colors.text }]}>
                  {preset.label}
                </Text>
                {idx === 0 ? (
                  <StatusPill label="Tu rubro" tone="primary" />
                ) : null}
              </View>
              <Text
                numberOfLines={2}
                style={[styles.presetPreview, { color: colors.muted }]}
              >
                {preset.title}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </Section>

      {/* Campos de Portada Hero */}
      <Section
        title="Textos de la portada"
        icon="text-outline"
        hint="Lo primero que ven tus clientes al entrar."
      >
        <ToggleRow
          label="Mostrar portada principal"
          value={heroOn}
          onValueChange={(value) => edit('hero_content', { enabled: value })}
        />
        {heroOn ? (
          <>
            <Field
              label="Etiqueta superior"
              value={hero.badge ?? ''}
              onChangeText={(value) => edit('hero_content', { badge: value })}
              placeholder="Envíos a todo el país"
              maxLength={100}
              showCount
              error={hIssues.badge}
            />
            <Field
              label="Título"
              value={hero.title ?? ''}
              onChangeText={(value) => edit('hero_content', { title: value })}
              placeholder="Todo lo que necesitás, en un solo lugar"
              maxLength={150}
              showCount
              error={hIssues.title}
            />
            <Field
              label="Subtítulo"
              value={hero.subtitle ?? ''}
              onChangeText={(value) =>
                edit('hero_content', { subtitle: value })
              }
              placeholder="Contá en una frase qué ofrecés"
              multiline
              maxLength={300}
              showCount
              error={hIssues.subtitle}
              help="También se usa como descripción al compartir y en Google."
            />

            {styleFlags.buttons ? (
              <>
                <Field
                  label="Texto del botón principal"
                  value={hero.ctaPrimaryText ?? ''}
                  onChangeText={(value) =>
                    edit('hero_content', { ctaPrimaryText: value })
                  }
                  placeholder="Ver productos"
                  maxLength={50}
                />
                <Field
                  label="Texto del botón secundario"
                  value={hero.ctaSecondaryText ?? ''}
                  onChangeText={(value) =>
                    edit('hero_content', { ctaSecondaryText: value })
                  }
                  placeholder="Escribinos"
                  maxLength={50}
                />
              </>
            ) : (
              <Notice text="Tu plantilla Supermercado muestra el buscador directo en vez de botones en la portada." />
            )}

            {styleFlags.tracking ? (
              <Field
                label="Botón seguir reparación"
                value={hero.trackRepairText ?? ''}
                onChangeText={(value) =>
                  edit('hero_content', { trackRepairText: value })
                }
                placeholder="Consultar reparación"
                maxLength={50}
                help="Visible para talleres y servicios técnicos."
              />
            ) : null}

            {/* Sellos cortos de confianza */}
            <View style={styles.trustBadgesWrap}>
              <Text style={[styles.subFieldLabel, { color: colors.text }]}>
                Sellos rápidos bajo los botones ({trustBadges.length}/6)
              </Text>
              <View style={styles.badgesList}>
                {trustBadges.map((item, idx) => (
                  <View
                    key={`${item}-${idx}`}
                    style={[
                      styles.badgeChip,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.background,
                      },
                    ]}
                  >
                    <Text style={[styles.badgeChipText, { color: colors.text }]}>
                      {item}
                    </Text>
                    <Pressable
                      onPress={() => removeTrustBadge(idx)}
                      hitSlop={6}
                    >
                      <Ionicons
                        name="close-circle"
                        size={16}
                        color={colors.muted}
                      />
                    </Pressable>
                  </View>
                ))}
              </View>
              {trustBadges.length < 6 ? (
                <View style={styles.addBadgeRow}>
                  <TextInput
                    value={newBadgeText}
                    onChangeText={setNewBadgeText}
                    placeholder="Ej: Envíos en el día"
                    placeholderTextColor={colors.muted}
                    maxLength={40}
                    onSubmitEditing={addTrustBadge}
                    style={[
                      styles.addBadgeInput,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.background,
                        color: colors.text,
                      },
                    ]}
                  />
                  <Pressable
                    onPress={addTrustBadge}
                    style={[
                      websiteStyles.primaryButton,
                      styles.addBadgeBtn,
                    ]}
                  >
                    <Ionicons name="add" size={18} color="#fff" />
                  </Pressable>
                </View>
              ) : null}
            </View>
          </>
        ) : null}
      </Section>

      {/* Cifras y redes en portada (HeroStats) */}
      <Section
        title="Cifras y redes en portada"
        icon="stats-chart-outline"
        hint="Números de respaldo o accesos rápidos debajo del título."
      >
        <ToggleRow
          label="Mostrar bloque de cifras / redes"
          value={statsOn}
          onValueChange={(value) => edit('hero_stats', { enabled: value })}
        />
        {statsOn ? (
          <>
            <View style={styles.subBlock}>
              <Text style={[styles.subFieldLabel, { color: colors.text }]}>
                Qué mostrar
              </Text>
              <ChipSelector
                options={[
                  { value: 'stats', label: 'Solo cifras' },
                  { value: 'social', label: 'Solo redes' },
                  { value: 'both', label: 'Cifras y redes' },
                ]}
                selected={displayMode}
                onSelect={(value) =>
                  edit('hero_stats', {
                    displayMode: value,
                    showSocial: value !== 'stats',
                  })
                }
              />
            </View>

            {displayMode !== 'social' ? (
              <View style={styles.statsFields}>
                <View style={styles.statRow}>
                  <View style={styles.flex}>
                    <Field
                      label="Dato 1 (valor)"
                      value={stats.repairs ?? ''}
                      onChangeText={(val) =>
                        edit('hero_stats', { repairs: val })
                      }
                      placeholder="500+"
                      maxLength={20}
                      error={sIssues.repairs}
                    />
                  </View>
                  <View style={styles.flex}>
                    <Field
                      label="Etiqueta 1"
                      value={stats.labels?.repairs ?? ''}
                      onChangeText={(val) =>
                        edit('hero_stats', {
                          labels: { ...(stats.labels ?? {}), repairs: val },
                        })
                      }
                      placeholder={metricLabels[0]}
                      maxLength={30}
                    />
                  </View>
                </View>

                <View style={styles.statRow}>
                  <View style={styles.flex}>
                    <Field
                      label="Dato 2 (valor)"
                      value={stats.satisfaction ?? ''}
                      onChangeText={(val) =>
                        edit('hero_stats', { satisfaction: val })
                      }
                      placeholder="98%"
                      maxLength={20}
                      error={sIssues.satisfaction}
                    />
                  </View>
                  <View style={styles.flex}>
                    <Field
                      label="Etiqueta 2"
                      value={stats.labels?.satisfaction ?? ''}
                      onChangeText={(val) =>
                        edit('hero_stats', {
                          labels: {
                            ...(stats.labels ?? {}),
                            satisfaction: val,
                          },
                        })
                      }
                      placeholder={metricLabels[1]}
                      maxLength={30}
                    />
                  </View>
                </View>

                <View style={styles.statRow}>
                  <View style={styles.flex}>
                    <Field
                      label="Dato 3 (valor)"
                      value={stats.avgTime ?? ''}
                      onChangeText={(val) =>
                        edit('hero_stats', { avgTime: val })
                      }
                      placeholder="24h"
                      maxLength={20}
                      error={sIssues.avgTime}
                    />
                  </View>
                  <View style={styles.flex}>
                    <Field
                      label="Etiqueta 3"
                      value={stats.labels?.avgTime ?? ''}
                      onChangeText={(val) =>
                        edit('hero_stats', {
                          labels: { ...(stats.labels ?? {}), avgTime: val },
                        })
                      }
                      placeholder={metricLabels[2]}
                      maxLength={30}
                    />
                  </View>
                </View>
              </View>
            ) : null}
          </>
        ) : null}
      </Section>

      {/* Secciones visibles del inicio + links a configurar cada una */}
      <Section
        title="Secciones visibles en el inicio"
        icon="layers-outline"
        hint="Prendé o apagá bloques de tu portada y entrá a editarlos."
      >
        {visibleHomeSections.map((section) => (
          <View key={section.id} style={styles.sectionItem}>
            <ToggleRow
              label={section.label}
              hint={section.hint}
              value={sectionEnabled(edited, section)}
              onValueChange={(value) =>
                edit(section.setting, { [section.field]: value })
              }
            />
            {section.editRoute ? (
              <Pressable
                onPress={() => router.push(section.editRoute as never)}
                hitSlop={6}
                style={styles.configLink}
              >
                <Text style={styles.configLinkText}>
                  Configurar contenido →
                </Text>
              </Pressable>
            ) : null}
          </View>
        ))}
      </Section>

      {edited.promotional_carousel?.enabled &&
      !edited.promotional_carousel?.slides?.length ? (
        <Notice
          tone="warning"
          text="Prendiste los banners pero todavía no hay ninguno."
          actionLabel="Agregar banners ahora"
          onAction={() => router.push('/admin/website/banners' as never)}
        />
      ) : null}
    </WebsiteScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  heroPreview: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  heroBadgeText: { fontSize: 11, fontWeight: '800' },
  heroTitlePreview: { fontSize: 18, fontWeight: '800', lineHeight: 23 },
  heroSubPreview: { fontSize: 13, lineHeight: 18 },
  ctaPreviewRow: { flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  ctaBtnPrimary: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  ctaPrimaryLabel: { color: '#fff', fontSize: 12, fontWeight: '800' },
  ctaBtnSec: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  ctaSecLabel: { fontSize: 12, fontWeight: '700' },
  previewBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  previewTrustChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  previewTrustText: { fontSize: 11, fontWeight: '600' },
  quickFillBtn: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  quickFillText: { color: palette.primary, fontSize: 11, fontWeight: '800' },
  presetsScroll: { gap: 8, paddingVertical: 2 },
  presetCard: {
    width: 190,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 6,
  },
  presetTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  presetLabel: { fontSize: 12, fontWeight: '800', flexShrink: 1 },
  presetPreview: { fontSize: 11 },
  trustBadgesWrap: { gap: 8, paddingTop: 4 },
  subFieldLabel: { fontSize: 13, fontWeight: '700' },
  badgesList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badgeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeChipText: { fontSize: 12, fontWeight: '600' },
  addBadgeRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  addBadgeInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    fontSize: 14,
  },
  addBadgeBtn: { paddingVertical: 10, paddingHorizontal: 14, minHeight: 42 },
  subBlock: { gap: 6 },
  statsFields: { gap: 10 },
  statRow: { flexDirection: 'row', gap: 8 },
  sectionItem: { gap: 4 },
  configLink: { alignSelf: 'flex-start', paddingLeft: 2, paddingBottom: 6 },
  configLinkText: { color: palette.primary, fontSize: 12, fontWeight: '800' },
});
