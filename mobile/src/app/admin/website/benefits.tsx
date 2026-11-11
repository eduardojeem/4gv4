import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { OfflineNotice, WebsiteGate } from '@/components/website/website-gate';
import {
  Field,
  Notice,
  ReorderRow,
  SaveBar,
  Section,
  StatusPill,
  ToggleRow,
  WebsiteScreen,
  useUnsavedChangesGuard,
  websiteStyles,
} from '@/components/website/website-ui';
import { palette, usePalette } from '@/lib/palette';
import { saveWebsiteSettings, websiteErrorMessage } from '@/lib/website-admin';
import { useWebsite } from '@/lib/website-context';
import {
  DEFAULT_TRUST_BAR,
  TRUST_BAR_ICONS,
  TRUST_BAR_IDEAS,
  TRUST_BAR_POSITIONS,
  brandHex,
  guidanceFamily,
  isDirty,
  moveItem,
  newSlideId,
  trustBarIssues,
  type TrustBarItem,
  type TrustBarSettings,
  type WebsiteSettings,
} from '@/lib/website-model';

const MAX_BENEFITS = 6;

export default function BenefitsScreen() {
  return (
    <WebsiteGate title="Beneficios y garantías">
      {(settings) => <BenefitsEditor settings={settings} />}
    </WebsiteGate>
  );
}

function BenefitsEditor({ settings }: { settings: WebsiteSettings }) {
  const colors = usePalette();
  const { applySaved, capabilities } = useWebsite();

  const saved = useMemo<TrustBarSettings>(
    () => ({
      ...DEFAULT_TRUST_BAR,
      ...(settings.trust_bar ?? {}),
      items: settings.trust_bar?.items ?? DEFAULT_TRUST_BAR.items,
    }),
    [settings.trust_bar],
  );
  const [trustBar, setTrustBar] = useState<TrustBarSettings>(saved);
  const [saving, setSaving] = useState(false);

  const dirty = isDirty(saved, trustBar);
  const issues = trustBarIssues(trustBar);
  const accent = brandHex(settings.company_info);
  const family = guidanceFamily(capabilities);
  const ideas = TRUST_BAR_IDEAS[family] ?? TRUST_BAR_IDEAS.general;

  const setItems = (next: TrustBarItem[]) =>
    setTrustBar((prev) => ({ ...prev, items: next }));

  const updateItem = (idx: number, patch: Partial<TrustBarItem>) =>
    setItems(
      trustBar.items.map((item, i) => (i === idx ? { ...item, ...patch } : item)),
    );

  const addBenefit = (seed?: { icon: string; title: string; description: string }) => {
    if (trustBar.items.length >= MAX_BENEFITS) {
      Alert.alert('Máximo 6 beneficios', 'Podés mostrar hasta 6 beneficios.');
      return;
    }
    setItems([
      ...trustBar.items,
      {
        id: newSlideId(),
        icon: seed?.icon ?? 'check',
        title: seed?.title ?? '',
        description: seed?.description ?? '',
        active: true,
      },
    ]);
    void Haptics.selectionAsync();
  };

  const applyIdeaBundle = () => {
    setItems(
      ideas.slice(0, MAX_BENEFITS).map((idea, idx) => ({
        id: `idea-${idx + 1}`,
        icon: idea.icon,
        title: idea.title,
        description: idea.description,
        active: true,
      })),
    );
    setTrustBar((prev) => ({ ...prev, enabled: true }));
    void Haptics.selectionAsync();
  };

  const save = useCallback(async () => {
    const msgs = Object.values(issues);
    if (msgs.length > 0) {
      Alert.alert('Revisá los beneficios', msgs.join('\n'));
      return false;
    }
    setSaving(true);
    try {
      const persisted = await saveWebsiteSettings({ trust_bar: trustBar });
      applySaved(persisted as Partial<WebsiteSettings>);
      if (persisted.trust_bar)
        setTrustBar(persisted.trust_bar as TrustBarSettings);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return true;
    } catch (error) {
      Alert.alert(
        'No pudimos guardar',
        websiteErrorMessage(error, 'No pudimos guardar los beneficios.'),
      );
      return false;
    } finally {
      setSaving(false);
    }
  }, [issues, trustBar, applySaved]);

  useUnsavedChangesGuard(dirty, save, saving);

  const activeItems = trustBar.items.filter((i) => i.active !== false);

  return (
    <WebsiteScreen
      saving={saving}
      title="Beneficios y garantías"
      subtitle="Barra de confianza en el inicio"
      footer={
        <SaveBar
          dirty={dirty}
          saving={saving}
          onSave={() => void save()}
          onDiscard={() => setTrustBar(saved)}
        />
      }
    >
      <OfflineNotice />

      {/* Vista previa horizontal de la Trust Bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.previewStrip}
      >
        {activeItems.length === 0 ? (
          <View
            style={[
              styles.previewEmpty,
              { borderColor: colors.border, backgroundColor: colors.card },
            ]}
          >
            <Text style={[styles.previewDesc, { color: colors.muted }]}>
              No hay beneficios visibles activos
            </Text>
          </View>
        ) : (
          activeItems.map((item, idx) => {
            const meta =
              TRUST_BAR_ICONS.find((ic) => ic.value === item.icon) ??
              TRUST_BAR_ICONS[0];
            return (
              <View
                key={item.id || idx}
                style={[
                  styles.previewTile,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View
                  style={[styles.previewIcon, { backgroundColor: `${accent}18` }]}
                >
                  <Ionicons
                    name={meta.ionicon as never}
                    size={16}
                    color={accent}
                  />
                </View>
                <Text
                  numberOfLines={1}
                  style={[styles.previewTitle, { color: colors.text }]}
                >
                  {item.title || 'Sin título'}
                </Text>
                {item.description ? (
                  <Text
                    numberOfLines={2}
                    style={[styles.previewDesc, { color: colors.muted }]}
                  >
                    {item.description}
                  </Text>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>

      <Section
        title="Visibilidad y ubicación"
        icon="shield-checkmark-outline"
        right={<StatusPill label={`${trustBar.items.length}/${MAX_BENEFITS}`} />}
      >
        <ToggleRow
          label="Mostrar barra de beneficios"
          value={trustBar.enabled}
          onValueChange={(val) => setTrustBar((p) => ({ ...p, enabled: val }))}
        />

        <View style={styles.posList}>
          <Text style={[styles.blockLabel, { color: colors.text }]}>
            Posición en la portada (plantilla Clásica)
          </Text>
          {TRUST_BAR_POSITIONS.map((pos) => {
            const active = (trustBar.position ?? 'above_carousel') === pos.value;
            return (
              <Pressable
                key={pos.value}
                onPress={() =>
                  setTrustBar((p) => ({ ...p, position: pos.value }))
                }
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={[
                  styles.posCard,
                  {
                    borderColor: active ? palette.primary : colors.border,
                    backgroundColor: active
                      ? `${palette.primary}10`
                      : colors.background,
                  },
                ]}
              >
                <Text style={[styles.posTitle, { color: colors.text }]}>
                  {pos.label}
                </Text>
                <Text style={[styles.posDesc, { color: colors.muted }]}>
                  {pos.description}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Section>

      {/* Ideas para tu rubro */}
      <Section
        title="Ideas para tu rubro"
        icon="sparkles-outline"
        right={
          <Pressable onPress={applyIdeaBundle} hitSlop={6}>
            <Text style={styles.bundleLink}>Usar sugeridos</Text>
          </Pressable>
        }
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.ideasRow}
        >
          {ideas.map((idea, idx) => {
            const meta = TRUST_BAR_ICONS.find((i) => i.value === idea.icon);
            return (
              <Pressable
                key={idx}
                onPress={() => addBenefit(idea)}
                style={[
                  styles.ideaChip,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                  },
                ]}
              >
                <Ionicons
                  name={(meta?.ionicon as never) ?? 'add'}
                  size={15}
                  color={palette.primary}
                />
                <Text style={[styles.ideaText, { color: colors.text }]}>
                  + {idea.title}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </Section>

      {/* Lista de beneficios */}
      {trustBar.items.map((item, idx) => (
        <View
          key={item.id || idx}
          style={[
            styles.itemCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.itemHead}>
            <Text style={[styles.itemNum, { color: colors.text }]}>
              Beneficio #{idx + 1}
            </Text>
            <Switch
              value={item.active !== false}
              onValueChange={(val) => updateItem(idx, { active: val })}
              trackColor={{ false: colors.border, true: palette.primary }}
            />
            <ReorderRow
              disableUp={idx === 0}
              disableDown={idx === trustBar.items.length - 1}
              onUp={() => setItems(moveItem(trustBar.items, idx, -1))}
              onDown={() => setItems(moveItem(trustBar.items, idx, 1))}
              onRemove={() =>
                setItems(trustBar.items.filter((_, i) => i !== idx))
              }
            />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.iconRow}
          >
            {TRUST_BAR_ICONS.map((iconOpt) => {
              const selected = item.icon === iconOpt.value;
              return (
                <Pressable
                  key={iconOpt.value}
                  onPress={() => updateItem(idx, { icon: iconOpt.value })}
                  accessibilityLabel={iconOpt.label}
                  style={[
                    styles.iconOption,
                    {
                      borderColor: selected ? palette.primary : colors.border,
                      backgroundColor: selected
                        ? `${palette.primary}18`
                        : colors.background,
                    },
                  ]}
                >
                  <Ionicons
                    name={iconOpt.ionicon as never}
                    size={17}
                    color={selected ? palette.primary : colors.muted}
                  />
                </Pressable>
              );
            })}
          </ScrollView>

          <Field
            label="Título"
            value={item.title}
            onChangeText={(val) => updateItem(idx, { title: val })}
            placeholder="Ej: Envíos a domicilio"
            maxLength={60}
            error={issues[`item_${idx}`]}
          />
          <Field
            label="Detalle corto (opcional)"
            value={item.description ?? ''}
            onChangeText={(val) => updateItem(idx, { description: val })}
            placeholder="Ej: Recibí tu pedido el mismo día"
            maxLength={120}
          />
        </View>
      ))}

      {trustBar.items.length < MAX_BENEFITS ? (
        <Pressable
          onPress={() => addBenefit()}
          style={websiteStyles.primaryButton}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={websiteStyles.primaryText}>Agregar beneficio</Text>
        </Pressable>
      ) : (
        <Notice text={`Llegaste al límite de ${MAX_BENEFITS} beneficios.`} />
      )}
    </WebsiteScreen>
  );
}

const styles = StyleSheet.create({
  previewStrip: { gap: 10, paddingVertical: 2 },
  previewEmpty: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    minWidth: 260,
    alignItems: 'center',
  },
  previewTile: {
    width: 155,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 5,
  },
  previewIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewTitle: { fontSize: 13, fontWeight: '800' },
  previewDesc: { fontSize: 11, lineHeight: 15 },
  posList: { gap: 7 },
  blockLabel: { fontSize: 13, fontWeight: '700' },
  posCard: { borderWidth: 1, borderRadius: 11, padding: 10, gap: 2 },
  posTitle: { fontSize: 13, fontWeight: '800' },
  posDesc: { fontSize: 11 },
  bundleLink: { color: palette.primary, fontSize: 12, fontWeight: '800' },
  ideasRow: { gap: 8 },
  ideaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  ideaText: { fontSize: 12, fontWeight: '700' },
  itemCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 10,
  },
  itemHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemNum: { flex: 1, fontSize: 14, fontWeight: '800' },
  iconRow: { gap: 6, paddingVertical: 2 },
  iconOption: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
