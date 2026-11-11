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
  TextInput,
  View,
} from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { OfflineNotice, WebsiteGate } from '@/components/website/website-gate';
import {
  Field,
  Notice,
  ReorderRow,
  SaveBar,
  Section,
  StateView,
  StatusPill,
  ToggleRow,
  WebsiteScreen,
  useUnsavedChangesGuard,
  websiteStyles,
  type WebsiteIconName,
} from '@/components/website/website-ui';
import { palette, usePalette } from '@/lib/palette';
import {
  saveCompanyInfo,
  saveWebsiteSettings,
  websiteErrorMessage,
} from '@/lib/website-admin';
import { useWebsite } from '@/lib/website-context';
import {
  DEFAULT_SERVICES_SECTION,
  SERVICES_SECTION_IDEAS,
  SERVICE_COLORS,
  SERVICE_ICONS,
  SERVICE_PRESETS,
  brandHex,
  carouselLinkShortcuts,
  getServiceSpecialtySuggestions,
  guidanceFamily,
  isDirty,
  moveItem,
  newSlideId,
  serviceIssues,
  type ServiceColor,
  type ServiceIcon,
  type ServiceItem,
  type ServicesSectionSettings,
  type WebsiteSettings,
} from '@/lib/website-model';

const MAX_SERVICES = 10;

const CATEGORY_CHIPS = [
  'Reparaciones',
  'Mantenimiento',
  'Barbería',
  'Belleza & Cuidado',
  'Instalaciones',
  'Asesoría técnica',
];

const BENEFIT_SUGGESTIONS = [
  'Garantía escrita',
  'Diagnóstico rápido',
  'Atención personalizada',
  'Presupuesto sin cargo',
  'Turno sin espera',
];

function emptyService(): ServiceItem {
  return {
    id: newSlideId(),
    title: '',
    description: '',
    icon: 'wrench',
    color: 'blue',
    benefits: ['Atención personalizada'],
    active: true,
    price: '',
    priceNote: '',
    duration: '',
    ctaUrl: '/inicio#contacto',
    featured: false,
    category: '',
  };
}

export default function ServicesScreen() {
  return (
    <WebsiteGate title="Catálogo de servicios">
      {(settings) => <ServicesEditor settings={settings} />}
    </WebsiteGate>
  );
}

function ServicesEditor({ settings }: { settings: WebsiteSettings }) {
  const colors = usePalette();
  const { applySaved, availability, capabilities } = useWebsite();

  const savedServices = useMemo<ServiceItem[]>(
    () => settings.services ?? [],
    [settings.services],
  );
  const savedSection = useMemo<ServicesSectionSettings>(
    () => ({
      ...DEFAULT_SERVICES_SECTION,
      ...(settings.services_section ?? {}),
    }),
    [settings.services_section],
  );
  const savedPageEnabled = settings.company_info.servicesPageEnabled !== false;

  const [services, setServices] = useState<ServiceItem[]>(savedServices);
  const [section, setSection] = useState<ServicesSectionSettings>(savedSection);
  const [pageEnabled, setPageEnabled] = useState<boolean>(savedPageEnabled);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<{
    item: ServiceItem;
    index: number | null;
  } | null>(null);
  const [headerExpanded, setHeaderExpanded] = useState(false);
  const [saving, setSaving] = useState(false);

  const servicesDirty = isDirty(savedServices, services);
  const sectionDirty = isDirty(savedSection, section);
  const pageDirty = pageEnabled !== savedPageEnabled;
  const dirty = servicesDirty || sectionDirty || pageDirty;

  const family = guidanceFamily(capabilities);
  const sectionIdeas =
    SERVICES_SECTION_IDEAS[family] ?? SERVICES_SECTION_IDEAS.general;
  const specialtySuggestions = useMemo(
    () => getServiceSpecialtySuggestions(capabilities.serviceSpecialties),
    [capabilities.serviceSpecialties],
  );
  const shortcuts = useMemo(
    () => carouselLinkShortcuts(capabilities),
    [capabilities],
  );
  const accent = brandHex(settings.company_info);
  const activeCount = services.filter((s) => s.active !== false).length;

  const filteredServices = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return services;
    return services.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        (s.category ?? '').toLowerCase().includes(q),
    );
  }, [services, search]);

  const openAdd = () => {
    if (services.length >= MAX_SERVICES) {
      Alert.alert(
        'Límite alcanzado',
        `Podés publicar hasta ${MAX_SERVICES} servicios en el catálogo.`,
      );
      return;
    }
    setEditing({ item: emptyService(), index: null });
  };

  const addPreset = (preset: (typeof SERVICE_PRESETS)[number]) => {
    if (services.length >= MAX_SERVICES) {
      Alert.alert(
        'Límite alcanzado',
        `Podés publicar hasta ${MAX_SERVICES} servicios en el catálogo.`,
      );
      return;
    }
    setServices((prev) => [
      ...prev,
      {
        ...preset,
        id: newSlideId(),
        benefits: [...preset.benefits],
      },
    ]);
    void Haptics.selectionAsync();
  };

  const addSpecialtySeed = (seed: { title: string; category: string }) => {
    if (services.length >= MAX_SERVICES) {
      Alert.alert(
        'Límite alcanzado',
        `Podés publicar hasta ${MAX_SERVICES} servicios en el catálogo.`,
      );
      return;
    }
    setEditing({
      item: {
        ...emptyService(),
        title: seed.title,
        category: seed.category,
        icon: 'sparkles',
        color: 'indigo',
        benefits: ['Atención personalizada', 'Turno coordinado'],
        ctaUrl: '/turnos',
      },
      index: null,
    });
  };

  const duplicateService = (index: number) => {
    if (services.length >= MAX_SERVICES) {
      Alert.alert('Límite alcanzado', `Máximo ${MAX_SERVICES} servicios.`);
      return;
    }
    const base = services[index];
    if (!base) return;
    const copy: ServiceItem = {
      ...base,
      id: newSlideId(),
      title: `${base.title} (copia)`.slice(0, 100),
      benefits: [...base.benefits],
    };
    const next = [...services];
    next.splice(index + 1, 0, copy);
    setServices(next);
    void Haptics.selectionAsync();
  };

  const confirmRemove = (index: number) => {
    const target = services[index];
    if (!target) return;
    Alert.alert(
      '¿Eliminar servicio?',
      `Se quitará "${target.title || 'Servicio'}" del catálogo.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () =>
            setServices((prev) => prev.filter((_, i) => i !== index)),
        },
      ],
    );
  };

  const save = useCallback(async () => {
    for (let i = 0; i < services.length; i += 1) {
      const issues = serviceIssues(services[i]);
      const msgs = Object.values(issues);
      if (msgs.length > 0) {
        Alert.alert(
          `Revisá "${services[i].title || `Servicio ${i + 1}`}"`,
          msgs.join('\n'),
        );
        setEditing({ item: services[i], index: i });
        return false;
      }
    }

    const cleanServices: ServiceItem[] = services.map((s) => ({
      ...s,
      title: s.title.trim(),
      description: s.description.trim(),
      benefits: s.benefits.map((b) => b.trim()).filter(Boolean),
      price:
        typeof s.price === 'string'
          ? s.price.trim().slice(0, 60) || undefined
          : s.price ?? undefined,
      priceNote: s.priceNote?.trim().slice(0, 60) ?? '',
      duration: s.duration?.trim().slice(0, 60) ?? '',
      category: s.category?.trim().slice(0, 80) ?? '',
      ctaUrl: s.ctaUrl?.trim().slice(0, 200) ?? '',
      active: s.active !== false,
    }));

    setSaving(true);
    try {
      if (servicesDirty || sectionDirty) {
        const persisted = await saveWebsiteSettings({
          ...(servicesDirty ? { services: cleanServices } : {}),
          ...(sectionDirty ? { services_section: section } : {}),
        });
        applySaved(persisted as Partial<WebsiteSettings>);
        if (Array.isArray(persisted.services)) {
          setServices(persisted.services as ServiceItem[]);
        } else if (servicesDirty) {
          setServices(cleanServices);
        }
        if (persisted.services_section) {
          setSection(persisted.services_section as ServicesSectionSettings);
        }
      }
      if (pageDirty) {
        const companyRes = await saveCompanyInfo(settings.company_info, {
          servicesPageEnabled: pageEnabled,
        });
        applySaved({
          company_info:
            companyRes ?? {
              ...settings.company_info,
              servicesPageEnabled: pageEnabled,
            },
        });
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return true;
    } catch (error) {
      Alert.alert(
        'No pudimos guardar',
        websiteErrorMessage(
          error,
          'No pudimos guardar el catálogo de servicios.',
        ),
      );
      return false;
    } finally {
      setSaving(false);
    }
  }, [
    services,
    section,
    pageEnabled,
    servicesDirty,
    sectionDirty,
    pageDirty,
    settings.company_info,
    applySaved,
  ]);

  useUnsavedChangesGuard(dirty, save, saving);

  return (
    <WebsiteScreen
      saving={saving}
      title="Catálogo de servicios"
      subtitle={`${services.length}/${MAX_SERVICES} cargados · ${activeCount} visibles`}
      right={
        services.length < MAX_SERVICES ? (
          <Pressable
            onPress={openAdd}
            accessibilityRole="button"
            accessibilityLabel="Agregar servicio"
            style={styles.headerAddBtn}
          >
            <Ionicons name="add" size={20} color="#fff" />
          </Pressable>
        ) : undefined
      }
      footer={
        <SaveBar
          dirty={dirty}
          saving={saving}
          onSave={() => void save()}
          onDiscard={() => {
            setServices(savedServices);
            setSection(savedSection);
            setPageEnabled(savedPageEnabled);
          }}
        />
      }
    >
      <OfflineNotice />

      {!availability.services.available ? (
        <Notice
          tone="warning"
          text={`Esta sección requiere ${availability.services.requires} para publicarse en la web.`}
        />
      ) : null}

      <Section
        title="Visibilidad pública"
        icon="briefcase-outline"
        right={
          <StatusPill
            label={pageEnabled ? 'Habilitada' : 'Oculta'}
            tone={pageEnabled ? 'success' : 'neutral'}
          />
        }
      >
        <ToggleRow
          label="Habilitar sección de servicios"
          hint="Muestra tu carta en el inicio y en /servicios de tu tienda"
          value={pageEnabled}
          onValueChange={setPageEnabled}
        />

        {/* Vista previa rápida del encabezado público */}
        <View
          style={[
            styles.headerPreview,
            { borderColor: colors.border, backgroundColor: colors.background },
          ]}
        >
          {section.badge ? (
            <View
              style={[
                styles.eyebrowPill,
                { backgroundColor: `${accent}16`, borderColor: `${accent}35` },
              ]}
            >
              <Text style={[styles.eyebrowText, { color: accent }]}>
                {section.badge}
              </Text>
            </View>
          ) : null}
          <Text style={[styles.previewTitle, { color: colors.text }]}>
            {section.title || DEFAULT_SERVICES_SECTION.title}
          </Text>
          <Text style={[styles.previewSub, { color: colors.muted }]}>
            {section.subtitle || DEFAULT_SERVICES_SECTION.subtitle}
          </Text>
        </View>

        <Pressable
          onPress={() => setHeaderExpanded((v) => !v)}
          style={styles.expandBtn}
        >
          <Ionicons name="create-outline" size={15} color={palette.primary} />
          <Text style={styles.expandBtnText}>
            {headerExpanded
              ? 'Ocultar edición del encabezado'
              : 'Personalizar título y encabezado'}
          </Text>
        </Pressable>

        {headerExpanded ? (
          <View style={styles.headerEditBox}>
            <View style={styles.ideasRow}>
              {sectionIdeas.map((idea) => (
                <Pressable
                  key={idea.label}
                  onPress={() => {
                    setSection({
                      badge: idea.badge,
                      title: idea.title,
                      subtitle: idea.subtitle,
                    });
                    void Haptics.selectionAsync();
                  }}
                  style={[
                    websiteStyles.chip,
                    {
                      borderColor: `${palette.primary}45`,
                      backgroundColor: `${palette.primary}10`,
                    },
                  ]}
                >
                  <Text
                    style={[websiteStyles.chipText, { color: palette.primary }]}
                  >
                    ✨ {idea.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Field
              label="Insignia superior"
              value={section.badge ?? ''}
              onChangeText={(badge) => setSection((p) => ({ ...p, badge }))}
              placeholder="Ej: Servicios profesionales"
              maxLength={60}
              showCount
            />
            <Field
              label="Título principal"
              value={section.title ?? ''}
              onChangeText={(title) => setSection((p) => ({ ...p, title }))}
              placeholder="Nuestros servicios"
              maxLength={100}
              showCount
            />
            <Field
              label="Subtítulo descriptivo"
              value={section.subtitle ?? ''}
              onChangeText={(subtitle) =>
                setSection((p) => ({ ...p, subtitle }))
              }
              placeholder="Conocé nuestras opciones y consultá por WhatsApp."
              multiline
              maxLength={200}
              showCount
            />
          </View>
        ) : null}
      </Section>

      {/* Presets y sugerencias */}
      {services.length < MAX_SERVICES ? (
        <Section
          title="Agregar rápido"
          icon="sparkles-outline"
          hint="Sumá un servicio base con 1 toque y ajustá su precio o duración:"
        >
          {specialtySuggestions.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.presetScroll}
            >
              {specialtySuggestions.map((s) => (
                <Pressable
                  key={`${s.category}-${s.title}`}
                  onPress={() => addSpecialtySeed(s)}
                  style={[
                    websiteStyles.chip,
                    {
                      borderColor: `${palette.primary}55`,
                      backgroundColor: `${palette.primary}12`,
                    },
                  ]}
                >
                  <Text
                    style={[websiteStyles.chipText, { color: palette.primary }]}
                  >
                    + {s.title}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.presetScroll}
          >
            {SERVICE_PRESETS.map((preset) => (
              <Pressable
                key={preset.title}
                onPress={() => addPreset(preset)}
                style={[
                  styles.presetPill,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                  },
                ]}
              >
                <Text style={[styles.presetCat, { color: palette.primary }]}>
                  {preset.verticalCategory}
                </Text>
                <Text style={[styles.presetTitle, { color: colors.text }]}>
                  + {preset.title}
                </Text>
                {preset.price ? (
                  <Text style={[styles.presetMeta, { color: colors.muted }]}>
                    {String(preset.price)}
                    {preset.duration ? ` · ${preset.duration}` : ''}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
        </Section>
      ) : null}

      {services.length >= 3 ? (
        <View
          style={[
            styles.searchWrap,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Ionicons name="search-outline" size={16} color={colors.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar servicio por nombre o categoría…"
            placeholderTextColor={colors.muted}
            style={[styles.searchInput, { color: colors.text }]}
          />
          {search ? (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={17} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {filteredServices.length === 0 ? (
        <StateView
          icon="briefcase-outline"
          title={
            services.length === 0
              ? 'Todavía no cargaste servicios'
              : 'Sin coincidencias'
          }
          text={
            services.length === 0
              ? 'Cargá tu carta de servicios con precio, duración y beneficios.'
              : 'Probá con otra palabra clave.'
          }
          action={services.length === 0 ? 'Agregar servicio' : undefined}
          onAction={services.length === 0 ? openAdd : undefined}
        />
      ) : (
        <View style={styles.list}>
          {filteredServices.map((service) => {
            const realIndex = services.findIndex((s) => s.id === service.id);
            const colorMeta =
              SERVICE_COLORS.find((c) => c.value === service.color) ??
              SERVICE_COLORS[0];
            const iconMeta =
              SERVICE_ICONS.find((ic) => ic.value === service.icon) ??
              SERVICE_ICONS[0];

            return (
              <View
                key={service.id}
                style={[
                  styles.serviceCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    opacity: service.active === false ? 0.65 : 1,
                  },
                ]}
              >
                <View style={styles.serviceTop}>
                  <View
                    style={[
                      styles.iconTile,
                      { backgroundColor: colorMeta.tint },
                    ]}
                  >
                    <Ionicons
                      name={iconMeta.ionicon as WebsiteIconName}
                      size={20}
                      color={colorMeta.hex}
                    />
                  </View>
                  <View style={styles.flex}>
                    <View style={styles.titleRow}>
                      <Text
                        numberOfLines={1}
                        style={[styles.serviceTitle, { color: colors.text }]}
                      >
                        {service.title || 'Servicio sin título'}
                      </Text>
                      {service.featured ? (
                        <StatusPill
                          label="Destacado"
                          tone="warning"
                          icon="star"
                        />
                      ) : null}
                    </View>
                    <View style={styles.metaPills}>
                      {service.price ? (
                        <Text
                          style={[
                            styles.priceText,
                            { color: colorMeta.hex },
                          ]}
                        >
                          {String(service.price)}
                          {service.priceNote ? ` (${service.priceNote})` : ''}
                        </Text>
                      ) : null}
                      {service.duration ? (
                        <Text
                          style={[styles.durationText, { color: colors.muted }]}
                        >
                          · {service.duration}
                        </Text>
                      ) : null}
                      {service.category ? (
                        <Text
                          style={[styles.durationText, { color: colors.muted }]}
                        >
                          · {service.category}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <Switch
                    value={service.active !== false}
                    onValueChange={(active) =>
                      setServices((prev) =>
                        prev.map((item, idx) =>
                          idx === realIndex ? { ...item, active } : item,
                        ),
                      )
                    }
                    disabled={saving}
                    trackColor={{ false: colors.border, true: palette.primary }}
                  />
                </View>

                <Text
                  numberOfLines={2}
                  style={[styles.serviceDesc, { color: colors.muted }]}
                >
                  {service.description}
                </Text>

                <View style={styles.benefitsPreview}>
                  {service.benefits.slice(0, 3).map((b, bi) => (
                    <View key={bi} style={styles.benefitLine}>
                      <Ionicons
                        name="checkmark-circle"
                        size={13}
                        color={palette.success}
                      />
                      <Text
                        numberOfLines={1}
                        style={[styles.benefitText, { color: colors.text }]}
                      >
                        {b}
                      </Text>
                    </View>
                  ))}
                </View>

                <View
                  style={[
                    styles.cardActions,
                    { borderTopColor: colors.border },
                  ]}
                >
                  <ReorderRow
                    onUp={() =>
                      setServices((prev) => moveItem(prev, realIndex, -1))
                    }
                    onDown={() =>
                      setServices((prev) => moveItem(prev, realIndex, 1))
                    }
                    onDuplicate={
                      services.length < MAX_SERVICES
                        ? () => duplicateService(realIndex)
                        : undefined
                    }
                    onRemove={() => confirmRemove(realIndex)}
                    disableUp={realIndex === 0}
                    disableDown={realIndex === services.length - 1}
                  />
                  <Pressable
                    onPress={() => setEditing({ item: service, index: realIndex })}
                    style={[
                      styles.editBtn,
                      {
                        borderColor: `${palette.primary}45`,
                        backgroundColor: `${palette.primary}12`,
                      },
                    ]}
                  >
                    <Ionicons
                      name="create-outline"
                      size={14}
                      color={palette.primary}
                    />
                    <Text style={styles.editBtnText}>Editar</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {services.length > 0 && services.length < MAX_SERVICES ? (
        <Pressable
          onPress={openAdd}
          style={[
            websiteStyles.secondaryButton,
            { borderColor: colors.border },
          ]}
        >
          <Ionicons name="add-circle-outline" size={18} color={palette.primary} />
          <Text style={[websiteStyles.secondaryText, { color: palette.primary }]}>
            Agregar otro servicio ({services.length}/{MAX_SERVICES})
          </Text>
        </Pressable>
      ) : null}

      <ServiceEditSheet
        editing={editing}
        shortcuts={shortcuts}
        onClose={() => setEditing(null)}
        onApply={(savedItem, targetIndex) => {
          setServices((prev) => {
            if (targetIndex === null) return [...prev, savedItem];
            return prev.map((s, i) => (i === targetIndex ? savedItem : s));
          });
          setEditing(null);
          void Haptics.selectionAsync();
        }}
      />
    </WebsiteScreen>
  );
}

function ServiceEditSheet({
  editing,
  shortcuts,
  onClose,
  onApply,
}: {
  editing: { item: ServiceItem; index: number | null } | null;
  shortcuts: { label: string; href: string }[];
  onClose: () => void;
  onApply: (item: ServiceItem, index: number | null) => void;
}) {
  const colors = usePalette();
  const [draft, setDraft] = useState<ServiceItem | null>(
    editing ? editing.item : null,
  );
  const [trackedId, setTrackedId] = useState<string | null>(
    editing?.item.id ?? null,
  );

  if (editing && editing.item.id !== trackedId) {
    setTrackedId(editing.item.id);
    setDraft({
      ...editing.item,
      benefits: editing.item.benefits.length
        ? [...editing.item.benefits]
        : [''],
    });
  } else if (!editing && trackedId !== null) {
    setTrackedId(null);
    setDraft(null);
  }

  if (!editing || !draft) {
    return (
      <BottomSheet visible={false} title="Servicio" onClose={onClose}>
        <View />
      </BottomSheet>
    );
  }

  const update = (patch: Partial<ServiceItem>) =>
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));

  const issues = serviceIssues(draft);

  const handleSaveSheet = () => {
    const msgs = Object.values(issues);
    if (msgs.length > 0) {
      Alert.alert('Revisá el servicio', msgs.join('\n'));
      return;
    }
    onApply(
      {
        ...draft,
        benefits: draft.benefits.map((b) => b.trim()).filter(Boolean),
      },
      editing.index,
    );
  };

  return (
    <BottomSheet
      visible={Boolean(editing)}
      tall
      title={editing.index === null ? 'Nuevo servicio' : 'Editar servicio'}
      subtitle="Mostrá qué incluye, cuánto cuesta y cuánto dura"
      onClose={onClose}
      footer={
        <Pressable
          onPress={handleSaveSheet}
          style={websiteStyles.primaryButton}
        >
          <Ionicons name="checkmark" size={18} color="#fff" />
          <Text style={websiteStyles.primaryText}>
            {editing.index === null ? 'Agregar al catálogo' : 'Guardar servicio'}
          </Text>
        </Pressable>
      }
    >
      <Field
        label="Nombre del servicio"
        value={draft.title}
        onChangeText={(title) => update({ title })}
        placeholder="Ej: Cambio de pantalla, Corte + Barba"
        maxLength={100}
        showCount
        error={issues.title}
      />

      <Field
        label="Descripción"
        value={draft.description}
        onChangeText={(description) => update({ description })}
        placeholder="Detallá qué incluye este servicio para convencer al cliente..."
        multiline
        maxLength={500}
        showCount
        error={issues.description}
      />

      <View style={styles.twoCols}>
        <View style={styles.flex}>
          <Field
            label="Precio (opcional)"
            value={draft.price ? String(draft.price) : ''}
            onChangeText={(price) => update({ price })}
            placeholder="Ej: Desde Gs. 80.000"
            maxLength={60}
          />
        </View>
        <View style={styles.flex}>
          <Field
            label="Duración (opcional)"
            value={draft.duration ?? ''}
            onChangeText={(duration) => update({ duration })}
            placeholder="Ej: 45 min"
            maxLength={60}
          />
        </View>
      </View>

      <View style={styles.twoCols}>
        <View style={styles.flex}>
          <Field
            label="Nota de precio"
            value={draft.priceNote ?? ''}
            onChangeText={(priceNote) => update({ priceNote })}
            placeholder="Ej: según modelo"
            maxLength={60}
          />
        </View>
        <View style={styles.flex}>
          <Field
            label="Categoría"
            value={draft.category ?? ''}
            onChangeText={(category) => update({ category })}
            placeholder="Ej: Reparaciones"
            maxLength={80}
          />
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.presetScroll}
      >
        {CATEGORY_CHIPS.map((cat) => (
          <Pressable
            key={cat}
            onPress={() => update({ category: cat })}
            style={[
              websiteStyles.chip,
              {
                borderColor:
                  draft.category === cat ? palette.primary : colors.border,
                backgroundColor: colors.background,
              },
            ]}
          >
            <Text style={[websiteStyles.chipText, { color: colors.text }]}>
              {cat}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <Text style={[styles.subLabel, { color: colors.text }]}>
        Ícono del servicio
      </Text>
      <View style={styles.iconGrid}>
        {SERVICE_ICONS.map((ic) => {
          const active = draft.icon === ic.value;
          return (
            <Pressable
              key={ic.value}
              onPress={() => update({ icon: ic.value as ServiceIcon })}
              style={[
                styles.iconChoice,
                {
                  borderColor: active ? palette.primary : colors.border,
                  backgroundColor: active
                    ? `${palette.primary}16`
                    : colors.background,
                },
              ]}
            >
              <Ionicons
                name={ic.ionicon as WebsiteIconName}
                size={18}
                color={active ? palette.primary : colors.text}
              />
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.subLabel, { color: colors.text }]}>
        Color de tarjeta
      </Text>
      <View style={styles.colorRow}>
        {SERVICE_COLORS.map((col) => {
          const active = draft.color === col.value;
          return (
            <Pressable
              key={col.value}
              onPress={() => update({ color: col.value as ServiceColor })}
              accessibilityLabel={`Color ${col.label}`}
              style={[
                styles.colorCircle,
                {
                  backgroundColor: col.hex,
                  borderColor: active ? colors.text : 'transparent',
                },
              ]}
            >
              {active ? (
                <Ionicons name="checkmark" size={14} color="#fff" />
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <View
        style={[
          styles.benefitsBox,
          { borderColor: colors.border, backgroundColor: colors.background },
        ]}
      >
        <Text style={[styles.subLabel, { color: colors.text }]}>
          ¿Qué incluye? ({draft.benefits.length}/10)
        </Text>
        {issues.benefits ? (
          <Text style={styles.errorText}>{issues.benefits}</Text>
        ) : null}
        {draft.benefits.map((b, bi) => (
          <View key={bi} style={styles.benefitEditRow}>
            <TextInput
              value={b}
              onChangeText={(txt) =>
                update({
                  benefits: draft.benefits.map((old, i) =>
                    i === bi ? txt : old,
                  ),
                })
              }
              placeholder={`Beneficio ${bi + 1}`}
              placeholderTextColor={colors.muted}
              maxLength={200}
              style={[
                styles.benefitInput,
                {
                  borderColor: colors.border,
                  color: colors.text,
                  backgroundColor: colors.card,
                },
              ]}
            />
            {draft.benefits.length > 1 ? (
              <Pressable
                onPress={() =>
                  update({
                    benefits: draft.benefits.filter((_, i) => i !== bi),
                  })
                }
                hitSlop={6}
              >
                <Ionicons name="trash-outline" size={18} color={palette.danger} />
              </Pressable>
            ) : null}
          </View>
        ))}

        {draft.benefits.length < 10 ? (
          <Pressable
            onPress={() => update({ benefits: [...draft.benefits, ''] })}
            style={styles.addBenefitBtn}
          >
            <Ionicons name="add-circle-outline" size={16} color={palette.primary} />
            <Text style={styles.addBenefitText}>Agregar ítem incluido</Text>
          </Pressable>
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.presetScroll}
        >
          {BENEFIT_SUGGESTIONS.map((sug) => (
            <Pressable
              key={sug}
              onPress={() => {
                if (draft.benefits.includes(sug) || draft.benefits.length >= 10)
                  return;
                const emptyIdx = draft.benefits.findIndex((x) => !x.trim());
                if (emptyIdx >= 0) {
                  update({
                    benefits: draft.benefits.map((old, i) =>
                      i === emptyIdx ? sug : old,
                    ),
                  });
                } else {
                  update({ benefits: [...draft.benefits, sug] });
                }
              }}
              style={[
                websiteStyles.chip,
                { borderColor: colors.border, backgroundColor: colors.card },
              ]}
            >
              <Text style={[websiteStyles.chipText, { color: colors.text }]}>
                + {sug}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <Field
        label="Enlace del botón (opcional)"
        value={draft.ctaUrl ?? ''}
        onChangeText={(ctaUrl) => update({ ctaUrl })}
        placeholder="/turnos o /inicio#contacto"
        autoCapitalize="none"
        maxLength={200}
        error={issues.ctaUrl}
      />

      {shortcuts.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.presetScroll}
        >
          {shortcuts.map((s) => (
            <Pressable
              key={s.href}
              onPress={() => update({ ctaUrl: s.href })}
              style={[
                websiteStyles.chip,
                { borderColor: colors.border, backgroundColor: colors.background },
              ]}
            >
              <Text style={[websiteStyles.chipText, { color: colors.text }]}>
                {s.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <ToggleRow
        label="Destacar servicio"
        hint="Aparece con insignia especial y prioridad en la web"
        value={draft.featured === true}
        onValueChange={(featured) => update({ featured })}
      />
      <ToggleRow
        label="Servicio visible"
        value={draft.active !== false}
        onValueChange={(active) => update({ active })}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerAddBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerPreview: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 5,
  },
  eyebrowPill: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 2,
  },
  eyebrowText: { fontSize: 11, fontWeight: '800' },
  previewTitle: { fontSize: 16, fontWeight: '900' },
  previewSub: { fontSize: 12, lineHeight: 17 },
  expandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  expandBtnText: { color: palette.primary, fontSize: 13, fontWeight: '800' },
  headerEditBox: { gap: 10, paddingTop: 4 },
  ideasRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  presetScroll: { gap: 8, paddingVertical: 2 },
  presetPill: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 8,
    gap: 2,
    minWidth: 155,
  },
  presetCat: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  presetTitle: { fontSize: 12, fontWeight: '800' },
  presetMeta: { fontSize: 11 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 8 },
  list: { gap: 12 },
  serviceCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 13,
    gap: 8,
  },
  serviceTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  serviceTitle: { fontSize: 15, fontWeight: '800', flexShrink: 1 },
  metaPills: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  priceText: { fontSize: 12, fontWeight: '800' },
  durationText: { fontSize: 11 },
  serviceDesc: { fontSize: 12, lineHeight: 17 },
  benefitsPreview: { gap: 3 },
  benefitLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  benefitText: { fontSize: 12, flex: 1 },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    marginTop: 2,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  editBtnText: { color: palette.primary, fontSize: 12, fontWeight: '800' },
  twoCols: { flexDirection: 'row', gap: 10 },
  subLabel: { fontSize: 13, fontWeight: '700' },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconChoice: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  colorCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitsBox: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  benefitEditRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  benefitInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  addBenefitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
  },
  addBenefitText: { color: palette.primary, fontSize: 13, fontWeight: '800' },
  errorText: { color: palette.danger, fontSize: 12, fontWeight: '600' },
});
