import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  StorefrontLivePreview,
  TemplateWireframeThumb,
} from '@/components/website/storefront-preview';
import { OfflineNotice, WebsiteGate } from '@/components/website/website-gate';
import { WebsiteImageField } from '@/components/website/website-image-field';
import {
  ChipSelector,
  Field,
  SaveBar,
  Section,
  StatusPill,
  ToggleRow,
  WebsiteScreen,
  useUnsavedChangesGuard,
} from '@/components/website/website-ui';
import { palette, usePalette } from '@/lib/palette';
import { usePanel } from '@/lib/panel';
import { saveCompanyInfo, websiteErrorMessage } from '@/lib/website-admin';
import { useWebsite } from '@/lib/website-context';
import {
  BRAND_COLORS,
  EXTRA_BRAND_COLORS,
  HEADER_STYLES,
  SERVICE_SPECIALTIES_LIST,
  SERVICE_SPECIALTY_LABELS,
  SERVICE_VARIANT_PRESETS,
  SERVICE_WEBSITE_VARIANTS,
  STOREFRONT_TEMPLATES_META,
  TEMPLATE_TIER_LABEL,
  brandHex,
  buildMobileTemplateCatalog,
  companyIssues,
  findExtraBrandColor,
  isDirty,
  mergeSetting,
  resolveStorefrontStyle,
  suggestStorefrontAppearance,
  type CompanyInfo,
  type ServiceSpecialty,
  type ServiceWebsiteVariant,
  type StorefrontStylePreference,
  type StorefrontTemplateGroupId,
  type WebsiteSettings,
} from '@/lib/website-model';

export default function AppearanceScreen() {
  return (
    <WebsiteGate title="Apariencia y plantillas">
      {(settings) => <AppearanceEditor settings={settings} />}
    </WebsiteGate>
  );
}

function AppearanceEditor({ settings }: { settings: WebsiteSettings }) {
  const colors = usePalette();
  const { applySaved, templateAccess, capabilities } = useWebsite();
  const { reload: reloadPanel } = usePanel();
  const saved = settings.company_info;
  const [patch, setPatch] = useState<Partial<CompanyInfo>>({});
  const [saving, setSaving] = useState(false);
  const [showExtraColors, setShowExtraColors] = useState(false);
  const [activeGroupTab, setActiveGroupTab] = useState<'all' | StorefrontTemplateGroupId>('all');

  const company = useMemo(
    () => mergeSetting<CompanyInfo>(saved, patch),
    [saved, patch],
  );
  const dirty = isDirty(saved, company);
  const issues = companyIssues(company);

  const set = (next: Partial<CompanyInfo>) =>
    setPatch((current) => ({ ...current, ...next }));

  const resolvedStyle = useMemo(
    () =>
      resolveStorefrontStyle(
        company.storefrontStyle,
        capabilities.businessVertical,
        {
          servicesAvailable: capabilities.hasServices,
          catalogAvailable: capabilities.hasCatalog,
          commerceMode: settings.checkout?.commerceMode,
        },
      ),
    [
      company.storefrontStyle,
      capabilities.businessVertical,
      capabilities.hasServices,
      capabilities.hasCatalog,
      settings.checkout?.commerceMode,
    ],
  );

  const suggestion = useMemo(
    () =>
      suggestStorefrontAppearance({
        businessVertical: capabilities.businessVertical,
        name: company.name,
        slogan: company.slogan,
        description: company.description,
        servicesAvailable: capabilities.hasServices,
        catalogAvailable: capabilities.hasCatalog,
        commerceMode: settings.checkout?.commerceMode,
      }),
    [
      capabilities.businessVertical,
      capabilities.hasServices,
      capabilities.hasCatalog,
      company.name,
      company.slogan,
      company.description,
      settings.checkout?.commerceMode,
    ],
  );

  const templateGroups = useMemo(
    () =>
      buildMobileTemplateCatalog({
        businessVertical: capabilities.businessVertical,
        context: {
          servicesAvailable: capabilities.hasServices,
          catalogAvailable: capabilities.hasCatalog,
          commerceMode: settings.checkout?.commerceMode,
        },
        savedValue: (saved.storefrontStyle as StorefrontStylePreference) || 'auto',
        suggestedStyle: suggestion.style,
        access: templateAccess,
      }),
    [
      capabilities.businessVertical,
      capabilities.hasServices,
      capabilities.hasCatalog,
      settings.checkout?.commerceMode,
      saved.storefrontStyle,
      suggestion.style,
      templateAccess,
    ],
  );

  const currentHeader =
    company.headerStyle && company.headerStyle !== 'glass'
      ? company.headerStyle
      : 'solid';

  const suggestionDiffers =
    resolvedStyle !== suggestion.style ||
    (company.brandColor || 'blue') !== suggestion.brandColor ||
    currentHeader !== suggestion.headerStyle;

  const save = useCallback(async () => {
    if (issues.customBrandColor) {
      Alert.alert('Revisá el color', issues.customBrandColor);
      return false;
    }
    setSaving(true);
    try {
      const result = await saveCompanyInfo(saved, patch);
      applySaved({ company_info: result ?? company });
      reloadPanel();
      setPatch({});
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
  }, [issues.customBrandColor, saved, patch, company, applySaved, reloadPanel]);

  useUnsavedChangesGuard(dirty, save, saving);

  const accent = brandHex(company);
  const templateMeta = STOREFRONT_TEMPLATES_META[resolvedStyle];
  const currentVariants = templateMeta.variants ?? [];
  const totalAvailable = templateGroups.reduce(
    (sum, g) => sum + g.availableCount,
    0,
  );
  const shownGroups =
    activeGroupTab === 'all'
      ? templateGroups
      : templateGroups.filter((g) => g.id === activeGroupTab);

  const showServiceAppearance =
    capabilities.hasServices ||
    resolvedStyle === 'services' ||
    resolvedStyle === 'barber';
  const currentSpecialties = (company.serviceSpecialties ?? []) as ServiceSpecialty[];

  const toggleSpecialty = (spec: ServiceSpecialty) => {
    const exists = currentSpecialties.includes(spec);
    const next = exists
      ? currentSpecialties.filter((s) => s !== spec)
      : [...currentSpecialties, spec];
    set({ serviceSpecialties: next });
  };

  return (
    <WebsiteScreen
      saving={saving}
      title="Apariencia y plantillas"
      subtitle="Logo, colores, encabezado y estilo"
      footer={
        <SaveBar
          dirty={dirty}
          saving={saving}
          onSave={() => void save()}
          onDiscard={() => setPatch({})}
        />
      }
    >
      <OfflineNotice />

      {/* Vista previa interactiva completa */}
      <StorefrontLivePreview
        company={company}
        hero={settings.hero_content}
        resolvedStyle={resolvedStyle}
      />

      {/* Sugerencia inteligente según rubro */}
      {suggestionDiffers ? (
        <View
          style={[
            styles.suggestionCard,
            {
              backgroundColor: `${palette.primary}0E`,
              borderColor: `${palette.primary}38`,
            },
          ]}
        >
          <View style={styles.suggestionHead}>
            <Ionicons name="sparkles" size={18} color={palette.primary} />
            <Text style={[styles.suggestionTitle, { color: colors.text }]}>
              Sugerencia para tu negocio
            </Text>
          </View>
          <Text style={[styles.suggestionBody, { color: colors.muted }]}>
            {suggestion.reason} Te recomendamos la plantilla «
            {STOREFRONT_TEMPLATES_META[suggestion.style].name}», encabezado «
            {HEADER_STYLES.find((h) => h.value === suggestion.headerStyle)?.label}
            » y acento{' '}
            {BRAND_COLORS.find((c) => c.key === suggestion.brandColor)?.name ??
              suggestion.brandColor}
            .
          </Text>
          <Pressable
            onPress={() => {
              set({
                storefrontStyle: suggestion.style,
                storefrontVariant: undefined,
                brandColor: suggestion.brandColor,
                headerStyle: suggestion.headerStyle,
              });
              void Haptics.selectionAsync();
            }}
            style={styles.suggestionBtn}
          >
            <Text style={styles.suggestionBtnText}>
              Aplicar diseño recomendado
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* Logo */}
      <Section title="Logo de la marca" icon="image-outline">
        <WebsiteImageField
          label="Logo de la tienda"
          kind="logo"
          value={company.logoUrl}
          onUploaded={(url) => set({ logoUrl: url })}
          onClear={() => set({ logoUrl: '' })}
          help="Cuadrado o horizontal con fondo transparente (PNG/WebP). Hasta 2 MB."
        />
      </Section>

      {/* Color de marca: 12 estándar + 20 curados extra + HEX personalizado */}
      <Section
        title="Color de marca"
        icon="color-fill-outline"
        hint="Botones, enlaces, precios destacados y acentos visuales."
        right={
          <StatusPill
            label={
              company.brandColor === 'custom'
                ? findExtraBrandColor(company.customBrandColor)?.name ??
                  (company.customBrandColor || '#HEX')
                : BRAND_COLORS.find((c) => c.key === (company.brandColor || 'blue'))
                    ?.name ?? 'Azul'
            }
            tone="primary"
          />
        }
      >
        <View style={styles.swatches}>
          {BRAND_COLORS.map((color) => {
            const selected =
              company.brandColor === color.key ||
              (!company.brandColor && color.key === 'blue');
            return (
              <Pressable
                key={color.key}
                onPress={() => set({ brandColor: color.key })}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={color.name}
                style={[
                  styles.swatch,
                  {
                    backgroundColor: color.hex,
                    borderColor: selected ? colors.text : 'transparent',
                  },
                ]}
              >
                {selected ? (
                  <Ionicons name="checkmark" size={16} color="#fff" />
                ) : null}
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => {
              setShowExtraColors((v) => !v);
              if (company.brandColor !== 'custom') {
                set({
                  brandColor: 'custom',
                  customBrandColor: company.customBrandColor || '#8B1E3F',
                });
              }
            }}
            accessibilityRole="button"
            accessibilityLabel="Más colores y código HEX personalizado"
            style={[
              styles.swatch,
              styles.customSwatch,
              {
                borderColor:
                  company.brandColor === 'custom' ? colors.text : colors.border,
                backgroundColor:
                  company.brandColor === 'custom' &&
                  /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(
                    company.customBrandColor ?? '',
                  )
                    ? company.customBrandColor
                    : colors.background,
              },
            ]}
          >
            <Text
              style={[
                styles.customText,
                {
                  color:
                    company.brandColor === 'custom' ? '#FFFFFF' : colors.text,
                },
              ]}
            >
              #
            </Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => setShowExtraColors((v) => !v)}
          style={styles.expandLink}
        >
          <Ionicons
            name={showExtraColors ? 'chevron-up' : 'color-palette-outline'}
            size={15}
            color={palette.primary}
          />
          <Text style={styles.expandLinkText}>
            {showExtraColors
              ? 'Ocultar paleta curada (20 tonos)'
              : 'Ver 20 tonos curados y código HEX'}
          </Text>
        </Pressable>

        {showExtraColors || company.brandColor === 'custom' ? (
          <View style={styles.extraColorsBox}>
            <View style={styles.swatches}>
              {EXTRA_BRAND_COLORS.map((color) => {
                const selected =
                  company.brandColor === 'custom' &&
                  (company.customBrandColor ?? '').toUpperCase() === color.hex;
                return (
                  <Pressable
                    key={color.hex}
                    onPress={() =>
                      set({
                        brandColor: 'custom',
                        customBrandColor: color.hex,
                      })
                    }
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={color.name}
                    style={[
                      styles.smallSwatch,
                      {
                        backgroundColor: color.hex,
                        borderColor: selected ? colors.text : colors.border,
                        borderWidth: selected ? 2.5 : 1,
                      },
                    ]}
                  >
                    {selected ? (
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
            <Field
              label="Código HEX personalizado"
              value={company.customBrandColor ?? ''}
              onChangeText={(value) =>
                set({
                  brandColor: 'custom',
                  customBrandColor: value.trim().toUpperCase(),
                })
              }
              placeholder="#2563EB"
              autoCapitalize="none"
              maxLength={7}
              error={issues.customBrandColor}
              help="Ingresá cualquier código de 6 dígitos (#RRGGBB)."
            />
          </View>
        ) : null}
      </Section>

      {/* Encabezado y barra superior */}
      <Section title="Encabezado y barra superior" icon="browsers-outline">
        <View style={styles.options}>
          {HEADER_STYLES.map((option) => {
            const selected = currentHeader === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => set({ headerStyle: option.value })}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={[
                  styles.option,
                  {
                    borderColor: selected ? palette.primary : colors.border,
                    backgroundColor: selected
                      ? `${palette.primary}10`
                      : 'transparent',
                  },
                ]}
              >
                <View style={styles.optionHead}>
                  <View
                    style={[
                      styles.headerPreviewChip,
                      {
                        backgroundColor:
                          option.value === 'dark'
                            ? '#0B0F19'
                            : option.value === 'accent'
                              ? accent
                              : '#FFFFFF',
                        borderColor: colors.border,
                      },
                    ]}
                  />
                  <Text style={[styles.optionTitle, { color: colors.text }]}>
                    {option.label}
                  </Text>
                  {selected ? (
                    <StatusPill label="Elegido" tone="primary" />
                  ) : null}
                </View>
                <Text style={[styles.optionHint, { color: colors.muted }]}>
                  {option.description}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <ToggleRow
          label="Mostrar barra superior (TopBar)"
          hint="Franja superior con teléfono, horario y avisos"
          value={company.showTopBar !== false}
          onValueChange={(value) => set({ showTopBar: value })}
        />
      </Section>

      {/* Plantilla de tienda agrupada y con wireframes */}
      <Section
        title="Plantilla de diseño"
        icon="grid-outline"
        hint="Elegí cómo se organiza visualmente tu catálogo y portada."
        right={
          templateAccess ? (
            <StatusPill
              label={`${totalAvailable} en ${templateAccess.planName}`}
              tone="primary"
            />
          ) : undefined
        }
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.groupTabsRow}
        >
          {[
            { id: 'all' as const, label: 'Todas' },
            ...templateGroups.map((g) => ({ id: g.id, label: g.label })),
          ].map((tab) => {
            const active = activeGroupTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => setActiveGroupTab(tab.id)}
                style={[
                  styles.tabChip,
                  {
                    borderColor: active ? palette.primary : colors.border,
                    backgroundColor: active
                      ? `${palette.primary}14`
                      : colors.background,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tabChipText,
                    { color: active ? palette.primary : colors.text },
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.groupsStack}>
          {shownGroups.map((group) => (
            <View key={group.id} style={styles.groupBlock}>
              <View style={styles.groupHeader}>
                <Text style={[styles.groupName, { color: colors.text }]}>
                  {group.title}
                </Text>
                <Text style={[styles.groupBadge, { color: colors.muted }]}>
                  {group.badge}
                </Text>
              </View>

              <View style={styles.options}>
                {group.options.map((opt) => {
                  const selected =
                    (company.storefrontStyle || 'auto') === opt.value;
                  const disabled = opt.status !== 'available';

                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => {
                        if (opt.status === 'locked_plan') {
                          Alert.alert(
                            'Plantilla de un plan superior',
                            opt.reason ||
                              'Esta plantilla no está incluida en tu plan actual.',
                          );
                          return;
                        }
                        if (opt.status === 'unavailable') {
                          Alert.alert(
                            'No aplica a este negocio',
                            opt.reason || 'Esta plantilla no encaja con tu rubro.',
                          );
                          return;
                        }
                        const nextMeta =
                          STOREFRONT_TEMPLATES_META[opt.resolvedStyle];
                        set({
                          storefrontStyle: opt.value,
                          storefrontVariant:
                            nextMeta.variants[0]?.id ?? undefined,
                        });
                        void Haptics.selectionAsync();
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected, disabled }}
                      style={[
                        styles.templateCard,
                        {
                          borderColor: selected
                            ? palette.primary
                            : colors.border,
                          backgroundColor: selected
                            ? `${palette.primary}0D`
                            : colors.background,
                          opacity: disabled ? 0.65 : 1,
                        },
                      ]}
                    >
                      <TemplateWireframeThumb
                        styleId={opt.resolvedStyle}
                        accent={accent}
                        active={selected}
                      />
                      <View style={styles.templateBody}>
                        <View style={styles.templateTitleRow}>
                          <Text
                            style={[styles.optionTitle, { color: colors.text }]}
                          >
                            {opt.label}
                          </Text>
                          {selected ? (
                            <StatusPill label="Elegida" tone="primary" />
                          ) : opt.isSuggested ? (
                            <StatusPill label="Sugerida" tone="success" />
                          ) : opt.isRecommended ? (
                            <StatusPill label="Recomendada" tone="success" />
                          ) : (
                            <StatusPill
                              label={TEMPLATE_TIER_LABEL[opt.tier]}
                              tone="neutral"
                            />
                          )}
                        </View>
                        <Text
                          style={[styles.optionHint, { color: colors.muted }]}
                        >
                          {opt.description}
                        </Text>
                        {opt.reason ? (
                          <View style={styles.lockRow}>
                            <Ionicons
                              name="lock-closed-outline"
                              size={12}
                              color="#B45309"
                            />
                            <Text style={styles.lockText}>{opt.reason}</Text>
                          </View>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      </Section>

      {/* Sub-variantes de la plantilla elegida */}
      {currentVariants.length > 0 ? (
        <Section
          title={`Variante visual de ${templateMeta.name}`}
          icon="layers-outline"
          hint="Ajustá la atmósfera y los detalles tipográficos de esta plantilla."
        >
          <View style={styles.options}>
            {currentVariants.map((variant, index) => {
              const selected =
                company.storefrontVariant === variant.id ||
                (!company.storefrontVariant && index === 0);
              return (
                <Pressable
                  key={variant.id}
                  onPress={() => set({ storefrontVariant: variant.id })}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={[
                    styles.option,
                    {
                      borderColor: selected ? palette.primary : colors.border,
                      backgroundColor: selected
                        ? `${palette.primary}10`
                        : 'transparent',
                    },
                  ]}
                >
                  <View style={styles.optionHead}>
                    <Text style={[styles.optionTitle, { color: colors.text }]}>
                      {variant.name}
                    </Text>
                    <StatusPill
                      label={variant.badgeText}
                      tone={selected ? 'primary' : 'neutral'}
                    />
                  </View>
                  <Text style={[styles.optionHint, { color: colors.muted }]}>
                    {variant.tagline}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Section>
      ) : null}

      {/* Apariencia y especialidades para negocios con servicios */}
      {showServiceAppearance ? (
        <Section
          title="Estilo de página de servicios"
          icon="cut-outline"
          hint="Personaliza textos por defecto y especialidades visibles en tu agenda."
        >
          <ChipSelector
            options={SERVICE_WEBSITE_VARIANTS.map((v) => ({
              value: v,
              label: SERVICE_VARIANT_PRESETS[v].label,
            }))}
            selected={
              (company.serviceWebsiteVariant as ServiceWebsiteVariant) ||
              (capabilities.businessVertical === 'barbershop'
                ? 'barber'
                : 'salon')
            }
            onSelect={(value) => set({ serviceWebsiteVariant: value })}
          />

          <Text style={[styles.subLabel, { color: colors.text }]}>
            Especialidades del negocio
          </Text>
          <View style={styles.specWrap}>
            {SERVICE_SPECIALTIES_LIST.map((spec) => {
              const active = currentSpecialties.includes(spec);
              return (
                <Pressable
                  key={spec}
                  onPress={() => toggleSpecialty(spec)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                  style={[
                    styles.tabChip,
                    {
                      borderColor: active ? palette.primary : colors.border,
                      backgroundColor: active
                        ? `${palette.primary}15`
                        : colors.background,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tabChipText,
                      { color: active ? palette.primary : colors.text },
                    ]}
                  >
                    {SERVICE_SPECIALTY_LABELS[spec]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Section>
      ) : null}
    </WebsiteScreen>
  );
}

const styles = StyleSheet.create({
  suggestionCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  suggestionHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  suggestionTitle: { fontSize: 14, fontWeight: '800' },
  suggestionBody: { fontSize: 12, lineHeight: 17 },
  suggestionBtn: {
    alignSelf: 'flex-start',
    backgroundColor: palette.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 2,
  },
  suggestionBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallSwatch: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customSwatch: { borderWidth: 2 },
  customText: { fontSize: 15, fontWeight: '800' },
  expandLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 2,
  },
  expandLinkText: { color: palette.primary, fontSize: 13, fontWeight: '700' },
  extraColorsBox: { gap: 12, paddingTop: 4 },
  options: { gap: 8 },
  option: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 4 },
  optionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerPreviewChip: {
    width: 18,
    height: 18,
    borderRadius: 6,
    borderWidth: 1,
  },
  optionTitle: { fontSize: 14, fontWeight: '800', flexShrink: 1 },
  optionHint: { fontSize: 12 },
  groupTabsRow: { gap: 8, paddingVertical: 2 },
  tabChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  tabChipText: { fontSize: 12, fontWeight: '700' },
  groupsStack: { gap: 14 },
  groupBlock: { gap: 8 },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  groupName: { fontSize: 13, fontWeight: '800' },
  groupBadge: { fontSize: 11, fontWeight: '600' },
  templateCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    borderWidth: 1,
    borderRadius: 14,
    padding: 11,
  },
  templateBody: { flex: 1, gap: 4 },
  templateTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    flexWrap: 'wrap',
  },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  lockText: { fontSize: 11, color: '#B45309', fontWeight: '600', flex: 1 },
  subLabel: { fontSize: 13, fontWeight: '700', marginTop: 4 },
  specWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
