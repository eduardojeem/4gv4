import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { OfflineNotice, WebsiteGate } from '@/components/website/website-gate';
import { WebsiteImageField } from '@/components/website/website-image-field';
import {
  ChipSelector,
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
  type PillTone,
} from '@/components/website/website-ui';
import { palette, usePalette } from '@/lib/palette';
import { saveWebsiteSettings, websiteErrorMessage } from '@/lib/website-admin';
import { useWebsite } from '@/lib/website-context';
import {
  ANNOUNCEMENT_BACKDROPS,
  ANNOUNCEMENT_BADGE_PRESETS,
  ANNOUNCEMENT_BADGE_VARIANTS,
  ANNOUNCEMENT_DURATIONS,
  ANNOUNCEMENT_EFFECTS,
  ANNOUNCEMENT_FITS,
  ANNOUNCEMENT_FREQUENCIES,
  ANNOUNCEMENT_IDEAS,
  EMPTY_ANNOUNCEMENT,
  MAX_ANNOUNCEMENT_IMAGES,
  MAX_STORE_ANNOUNCEMENTS,
  announcementDayStamp,
  announcementIssues,
  announcementStatus,
  brandHex,
  carouselLinkShortcuts,
  guidanceFamily,
  isAnnouncementLive,
  moveItem,
  newSlideId,
  normalizeAnnouncementList,
  sameValue,
  type Announcement,
  type AnnouncementStatus,
  type WebsiteSettings,
} from '@/lib/website-model';

const CAROUSEL_ANIMATION_OPTIONS = [
  { value: 'slide', label: 'Deslizar' },
  { value: 'fade', label: 'Desvanecer' },
  { value: 'zoom', label: 'Zoom' },
] as const;

const CAROUSEL_SPEED_OPTIONS = [
  { value: '3', label: '3 seg' },
  { value: '5', label: '5 seg' },
  { value: '0', label: 'Manual' },
] as const;

const STATUS_META: Record<AnnouncementStatus, { label: string; tone: PillTone }> = {
  activo: { label: 'Se está mostrando', tone: 'success' },
  programado: { label: 'Programado', tone: 'primary' },
  vencido: { label: 'Vencido', tone: 'danger' },
  incompleto: { label: 'Falta texto', tone: 'warning' },
  apagado: { label: 'Apagado', tone: 'neutral' },
};

function contentOf(announcement: Announcement) {
  const { updatedAt: _u, ...rest } = announcement;
  return rest;
}

function describeFrequency(freq?: Announcement['frequency']) {
  if (freq === 'always') return 'Cada visita';
  if (freq === 'once_per_session') return 'Por sesión';
  return '1 vez/día';
}

function describeDates(a: Announcement) {
  if (a.startsAt && a.endsAt) return `Del ${a.startsAt} al ${a.endsAt}`;
  if (a.startsAt) return `Desde ${a.startsAt}`;
  if (a.endsAt) return `Hasta ${a.endsAt}`;
  return 'Sin fechas límite';
}

function createDraftAnnouncement(seed?: Partial<Announcement>): Announcement {
  return {
    ...EMPTY_ANNOUNCEMENT,
    ...seed,
    id: newSlideId(),
    images: seed?.images ? [...seed.images] : [],
  };
}

export default function AnnouncementsScreen() {
  return (
    <WebsiteGate title="Avisos emergentes">
      {(settings) => <AnnouncementsEditor settings={settings} />}
    </WebsiteGate>
  );
}

function AnnouncementsEditor({ settings }: { settings: WebsiteSettings }) {
  const colors = usePalette();
  const { applySaved, capabilities } = useWebsite();

  const saved = useMemo(
    () =>
      normalizeAnnouncementList(
        settings.announcements ?? settings.announcement,
        MAX_STORE_ANNOUNCEMENTS,
      ),
    [settings.announcements, settings.announcement],
  );
  const [items, setItems] = useState<Announcement[]>(saved);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [previewItem, setPreviewItem] = useState<Announcement | null>(null);
  const [previewImgIndex, setPreviewImgIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  const dirty = !sameValue(saved.map(contentOf), items.map(contentOf));
  const family = guidanceFamily(capabilities);
  const ideas = ANNOUNCEMENT_IDEAS[family] ?? ANNOUNCEMENT_IDEAS.general;
  const shortcuts = useMemo(
    () => carouselLinkShortcuts(capabilities),
    [capabilities],
  );
  const accent = brandHex(settings.company_info);
  const liveCount = items.filter((a) => isAnnouncementLive(a)).length;

  const updateItem = (id: string, patch: Partial<Announcement>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  };

  const addNew = (seed?: { title: string; message: string }) => {
    if (items.length >= MAX_STORE_ANNOUNCEMENTS) {
      Alert.alert(
        'Máximo alcanzado',
        `Podés cargar hasta ${MAX_STORE_ANNOUNCEMENTS} avisos.`,
      );
      return;
    }
    const created = createDraftAnnouncement(
      seed ? { title: seed.title, message: seed.message, enabled: false } : {},
    );
    setItems((prev) => [...prev, created]);
    setEditing(created);
    void Haptics.selectionAsync();
  };

  const confirmRemove = (item: Announcement) => {
    Alert.alert(
      '¿Quitar aviso?',
      `Se quitará "${item.title.trim() || 'Aviso sin título'}" de la lista. Guardá los cambios para confirmar en tu web.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Quitar',
          style: 'destructive',
          onPress: () => {
            setItems((prev) => prev.filter((a) => a.id !== item.id));
            if (editing?.id === item.id) setEditing(null);
          },
        },
      ],
    );
  };

  const save = useCallback(async () => {
    for (let i = 0; i < items.length; i += 1) {
      const issues = announcementIssues(items[i]);
      const msgs = Object.values(issues);
      if (msgs.length > 0) {
        Alert.alert(
          `Revisá el aviso ${i + 1}`,
          msgs.join('\n'),
        );
        setEditing(items[i]);
        return false;
      }
    }

    const stamp = new Date().toISOString();
    const prevById = new Map(saved.map((a) => [a.id, contentOf(a)]));
    const payload: Announcement[] = items.map((item) => {
      const normalizedImages = item.images
        .filter((img) => Boolean(img.url.trim()))
        .slice(0, MAX_ANNOUNCEMENT_IMAGES);
      const clean: Announcement = {
        ...item,
        title: item.title.trim(),
        message: item.message.trim(),
        badgeLabel: item.badgeLabel?.trim() ?? 'Novedad destacada',
        highlightNote: item.highlightNote?.trim() ?? '',
        ctaLabel: item.ctaLabel.trim(),
        ctaHref: item.ctaHref.trim(),
        startsAt: item.startsAt.trim(),
        endsAt: item.endsAt.trim(),
        images: normalizedImages,
        imageUrl: normalizedImages[0]?.url ?? '',
      };
      const prev = prevById.get(clean.id);
      const changed = !prev || !sameValue(prev, contentOf(clean));
      return changed ? { ...clean, updatedAt: stamp } : clean;
    });

    setSaving(true);
    try {
      const persisted = await saveWebsiteSettings({ announcements: payload });
      applySaved(persisted as Partial<WebsiteSettings>);
      if (Array.isArray(persisted.announcements)) {
        setItems(
          normalizeAnnouncementList(
            persisted.announcements,
            MAX_STORE_ANNOUNCEMENTS,
          ),
        );
      } else {
        setItems(payload);
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return true;
    } catch (error) {
      Alert.alert(
        'No pudimos guardar',
        websiteErrorMessage(error, 'No pudimos guardar los avisos.'),
      );
      return false;
    } finally {
      setSaving(false);
    }
  }, [items, saved, applySaved]);

  useUnsavedChangesGuard(dirty, save, saving);

  const openPreview = (item: Announcement) => {
    setPreviewImgIndex(0);
    setPreviewItem(item);
  };

  return (
    <WebsiteScreen
      saving={saving}
      title="Avisos emergentes"
      subtitle={`${items.length}/${MAX_STORE_ANNOUNCEMENTS} cargados · ${liveCount} activo${liveCount === 1 ? '' : 's'}`}
      right={
        items.length < MAX_STORE_ANNOUNCEMENTS ? (
          <Pressable
            onPress={() => addNew()}
            accessibilityRole="button"
            accessibilityLabel="Nuevo aviso"
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
            setItems(saved);
            setEditing(null);
          }}
        />
      }
    >
      <OfflineNotice />

      {liveCount > 1 ? (
        <Notice
          tone="warning"
          text={`Hay ${liveCount} avisos vigentes a la vez: se muestra primero el de arriba de la lista. Ordenalos con las flechas para elegir cuál sale primero.`}
        />
      ) : (
        <Notice text="Carteles emergentes para anunciar campañas, horarios especiales o lanzamientos apenas alguien entra a tu tienda." />
      )}

      {ideas.length > 0 && items.length < MAX_STORE_ANNOUNCEMENTS ? (
        <Section
          title="Ideas rápidas según tu rubro"
          icon="sparkles-outline"
          hint="Tocá una idea para sumarla como borrador y personalizarla:"
        >
          <View style={styles.ideasWrap}>
            {ideas.map((idea) => (
              <Pressable
                key={idea.title}
                onPress={() => addNew(idea)}
                style={[
                  styles.ideaChip,
                  {
                    borderColor: `${palette.primary}35`,
                    backgroundColor: `${palette.primary}0D`,
                  },
                ]}
              >
                <Ionicons name="add-circle-outline" size={14} color={palette.primary} />
                <Text style={styles.ideaText}>{idea.title}</Text>
              </Pressable>
            ))}
          </View>
        </Section>
      ) : null}

      {items.length === 0 ? (
        <StateView
          icon="megaphone-outline"
          title="Sin avisos cargados"
          text="Creá un cartel emergente para destacar una promoción, horario especial o novedad al entrar a tu tienda."
          action="Crear primer aviso"
          onAction={() => addNew()}
        />
      ) : (
        <View style={styles.list}>
          {items.map((item, idx) => {
            const st = announcementStatus(item);
            const meta = STATUS_META[st];
            const badgeTone =
              ANNOUNCEMENT_BADGE_VARIANTS.find(
                (v) => v.value === (item.badgeVariant ?? 'primary'),
              ) ?? ANNOUNCEMENT_BADGE_VARIANTS[0];

            return (
              <View
                key={item.id || idx}
                style={[
                  styles.card,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View style={styles.cardTop}>
                  <View style={styles.cardTitleCol}>
                    <View style={styles.pillRow}>
                      <StatusPill label={meta.label} tone={meta.tone} />
                      {item.badgeLabel ? (
                        <View
                          style={[
                            styles.miniTag,
                            {
                              borderColor: `${badgeTone.hex}40`,
                              backgroundColor: `${badgeTone.hex}14`,
                            },
                          ]}
                        >
                          <View
                            style={[styles.dot, { backgroundColor: badgeTone.hex }]}
                          />
                          <Text
                            numberOfLines={1}
                            style={[styles.miniTagText, { color: badgeTone.hex }]}
                          >
                            {item.badgeLabel}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text
                      numberOfLines={2}
                      style={[styles.cardTitle, { color: colors.text }]}
                    >
                      {item.title.trim() || 'Aviso sin título'}
                    </Text>
                  </View>
                  <Switch
                    value={item.enabled}
                    onValueChange={(val) => updateItem(item.id, { enabled: val })}
                    disabled={saving}
                    trackColor={{ false: colors.border, true: palette.primary }}
                  />
                </View>

                {item.message ? (
                  <Text
                    numberOfLines={2}
                    style={[styles.cardMessage, { color: colors.muted }]}
                  >
                    {item.message}
                  </Text>
                ) : null}

                {item.images.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.thumbStrip}
                  >
                    {item.images.map((img, imgIdx) => (
                      <Image
                        key={`${img.url}-${imgIdx}`}
                        source={{ uri: img.url }}
                        style={styles.cardThumb}
                        contentFit="cover"
                      />
                    ))}
                  </ScrollView>
                ) : null}

                <Text style={[styles.metaLine, { color: colors.muted }]}>
                  {describeDates(item)} · {describeFrequency(item.frequency)} ·{' '}
                  {(item.autoCloseSeconds ?? 5) === 0
                    ? 'Cierre manual'
                    : `${item.autoCloseSeconds ?? 5}s`}{' '}
                  {item.images.length > 0
                    ? `· ${item.images.length} img`
                    : ''}
                </Text>

                <View style={[styles.cardActions, { borderTopColor: colors.border }]}>
                  <ReorderRow
                    onUp={() => setItems(moveItem(items, idx, -1))}
                    onDown={() => setItems(moveItem(items, idx, 1))}
                    onRemove={() => confirmRemove(item)}
                    disableUp={idx === 0}
                    disableDown={idx === items.length - 1}
                  />
                  <View style={styles.rightActions}>
                    <Pressable
                      onPress={() => openPreview(item)}
                      style={[
                        styles.smallActionBtn,
                        { borderColor: colors.border, backgroundColor: colors.background },
                      ]}
                    >
                      <Ionicons name="eye-outline" size={14} color={colors.text} />
                      <Text style={[styles.smallActionText, { color: colors.text }]}>
                        Ver
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setEditing(item)}
                      style={[
                        styles.smallActionBtn,
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
                      <Text
                        style={[styles.smallActionText, { color: palette.primary }]}
                      >
                        Editar
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {items.length > 0 && items.length < MAX_STORE_ANNOUNCEMENTS ? (
        <Pressable
          onPress={() => addNew()}
          style={[
            websiteStyles.secondaryButton,
            { borderColor: colors.border },
          ]}
        >
          <Ionicons name="add-circle-outline" size={18} color={palette.primary} />
          <Text style={[websiteStyles.secondaryText, { color: palette.primary }]}>
            Agregar otro aviso ({items.length}/{MAX_STORE_ANNOUNCEMENTS})
          </Text>
        </Pressable>
      ) : null}

      {/* Modal de vista previa tipo tienda */}
      <Modal
        visible={Boolean(previewItem)}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewItem(null)}
      >
        <View style={styles.previewBackdrop}>
          <View
            style={[
              styles.previewCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Pressable
              onPress={() => setPreviewItem(null)}
              style={[styles.previewClose, { backgroundColor: colors.background }]}
              accessibilityLabel="Cerrar vista previa"
            >
              <Ionicons name="close" size={18} color={colors.text} />
            </Pressable>

            {previewItem ? (
              <>
                {previewItem.images.length > 0 ? (
                  <View
                    style={[
                      styles.previewHeroBox,
                      {
                        backgroundColor:
                          previewItem.imageBackdrop === 'dark'
                            ? '#0F172A'
                            : previewItem.imageBackdrop === 'light'
                              ? '#FFFFFF'
                              : previewItem.imageBackdrop === 'tinted'
                                ? `${accent}18`
                                : '#1E293B',
                      },
                    ]}
                  >
                    <Image
                      source={{
                        uri:
                          previewItem.images[
                            previewImgIndex % previewItem.images.length
                          ]?.url,
                      }}
                      style={StyleSheet.absoluteFill}
                      contentFit={previewItem.imageFit === 'cover' ? 'cover' : 'contain'}
                    />
                    {previewItem.images.length > 1 ? (
                      <View style={styles.previewImgControls}>
                        <Pressable
                          onPress={() =>
                            setPreviewImgIndex((i) =>
                              (i - 1 + previewItem.images.length) %
                              previewItem.images.length,
                            )
                          }
                          style={styles.previewNavArrow}
                        >
                          <Ionicons name="chevron-back" size={16} color="#fff" />
                        </Pressable>
                        <Text style={styles.previewImgCount}>
                          {(previewImgIndex % previewItem.images.length) + 1}/
                          {previewItem.images.length}
                        </Text>
                        <Pressable
                          onPress={() =>
                            setPreviewImgIndex(
                              (i) => (i + 1) % previewItem.images.length,
                            )
                          }
                          style={styles.previewNavArrow}
                        >
                          <Ionicons
                            name="chevron-forward"
                            size={16}
                            color="#fff"
                          />
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                <View style={styles.previewBody}>
                  {(() => {
                    const variant =
                      ANNOUNCEMENT_BADGE_VARIANTS.find(
                        (v) => v.value === (previewItem.badgeVariant ?? 'primary'),
                      ) ?? ANNOUNCEMENT_BADGE_VARIANTS[0];
                    return previewItem.badgeLabel ? (
                      <View
                        style={[
                          styles.miniTag,
                          {
                            alignSelf: 'flex-start',
                            borderColor: `${variant.hex}40`,
                            backgroundColor: `${variant.hex}16`,
                          },
                        ]}
                      >
                        <Text style={[styles.miniTagText, { color: variant.hex }]}>
                          {previewItem.badgeLabel}
                        </Text>
                      </View>
                    ) : null;
                  })()}

                  <Text style={[styles.previewTitle, { color: colors.text }]}>
                    {previewItem.title.trim() || 'Aviso de prueba'}
                  </Text>
                  <Text style={[styles.previewMsg, { color: colors.muted }]}>
                    {previewItem.message.trim() ||
                      'Así verán el cartel emergente los clientes al ingresar a tu tienda.'}
                  </Text>

                  {previewItem.highlightNote ? (
                    <Text style={[styles.previewNote, { color: colors.muted }]}>
                      {previewItem.highlightNote}
                    </Text>
                  ) : null}

                  {previewItem.ctaLabel.trim() ? (
                    <View style={[styles.previewCta, { backgroundColor: accent }]}>
                      <Text style={styles.previewCtaText}>
                        {previewItem.ctaLabel}
                      </Text>
                      <Ionicons name="arrow-forward" size={15} color="#fff" />
                    </View>
                  ) : null}

                  <Text style={[styles.previewFooterHint, { color: colors.muted }]}>
                    Vista previa · {describeFrequency(previewItem.frequency)} ·{' '}
                    {(previewItem.autoCloseSeconds ?? 5) === 0
                      ? 'Solo cierre manual'
                      : `Auto-cierre en ${previewItem.autoCloseSeconds ?? 5}s`}
                  </Text>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* BottomSheet de edición completa */}
      <AnnouncementEditSheet
        announcement={editing}
        shortcuts={shortcuts}
        onClose={() => setEditing(null)}
        onApply={(updated) => {
          setItems((prev) =>
            prev.map((a) => (a.id === updated.id ? updated : a)),
          );
          setEditing(null);
        }}
      />
    </WebsiteScreen>
  );
}

function AnnouncementEditSheet({
  announcement,
  shortcuts,
  onClose,
  onApply,
}: {
  announcement: Announcement | null;
  shortcuts: { label: string; href: string }[];
  onClose: () => void;
  onApply: (next: Announcement) => void;
}) {
  const colors = usePalette();
  const [draft, setDraft] = useState<Announcement | null>(announcement);

  // Sincronizar cuando cambia el aviso seleccionado.
  const active =
    draft && announcement && draft.id === announcement.id ? draft : announcement;

  if (!active && draft !== null) {
    setDraft(null);
  }

  const update = (patch: Partial<Announcement>) => {
    setDraft((curr) => ({ ...(curr ?? active!), ...patch }));
  };

  if (!active) {
    return (
      <BottomSheet visible={false} title="Editar aviso" onClose={onClose}>
        <View />
      </BottomSheet>
    );
  }

  const issues = announcementIssues(active);

  const applyAndClose = () => {
    const msgs = Object.values(issues);
    if (msgs.length > 0) {
      Alert.alert('Revisá el aviso', msgs.join('\n'));
      return;
    }
    onApply(active);
  };

  const today = announcementDayStamp();

  return (
    <BottomSheet
      visible={Boolean(announcement)}
      tall
      title="Editar aviso"
      subtitle="Personalizá textos, etiqueta, imágenes y vigencia"
      onClose={onClose}
      footer={
        <Pressable
          onPress={applyAndClose}
          accessibilityRole="button"
          style={websiteStyles.primaryButton}
        >
          <Ionicons name="checkmark" size={18} color="#fff" />
          <Text style={websiteStyles.primaryText}>Aplicar al borrador</Text>
        </Pressable>
      }
    >
      <ToggleRow
        label="Activar este aviso"
        hint="Solo los avisos activos y dentro de su fecha se muestran en la tienda"
        value={active.enabled}
        onValueChange={(enabled) => update({ enabled })}
      />

      <Field
        label="Título"
        value={active.title}
        onChangeText={(title) => update({ title })}
        placeholder="Ej: Semana de descuentos"
        maxLength={120}
        showCount
        error={issues.title}
      />

      <Field
        label="Mensaje"
        value={active.message}
        onChangeText={(message) => update({ message })}
        placeholder="Contá la promo, el horario especial o la novedad..."
        multiline
        maxLength={600}
        showCount
        error={issues.message}
      />

      <View
        style={[
          styles.sheetBlock,
          { borderColor: colors.border, backgroundColor: colors.background },
        ]}
      >
        <Text style={[styles.blockTitle, { color: colors.text }]}>
          Etiqueta superior y estilo
        </Text>
        <Field
          label="Texto de la insignia"
          value={active.badgeLabel ?? ''}
          onChangeText={(badgeLabel) => update({ badgeLabel })}
          placeholder="✨ Novedad destacada"
          maxLength={40}
          showCount
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.presetRow}
        >
          {ANNOUNCEMENT_BADGE_PRESETS.map((preset) => (
            <Pressable
              key={preset}
              onPress={() => update({ badgeLabel: preset })}
              style={[
                websiteStyles.chip,
                {
                  borderColor:
                    active.badgeLabel === preset ? palette.primary : colors.border,
                  backgroundColor: colors.card,
                },
              ]}
            >
              <Text style={[websiteStyles.chipText, { color: colors.text }]}>
                {preset}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={[styles.subLabel, { color: colors.text }]}>
          Color temático de la etiqueta
        </Text>
        <View style={styles.colorGrid}>
          {ANNOUNCEMENT_BADGE_VARIANTS.map((v) => {
            const selected = (active.badgeVariant ?? 'primary') === v.value;
            return (
              <Pressable
                key={v.value}
                onPress={() => update({ badgeVariant: v.value })}
                style={[
                  styles.colorOption,
                  {
                    borderColor: selected ? palette.primary : colors.border,
                    backgroundColor: selected
                      ? `${palette.primary}12`
                      : colors.card,
                  },
                ]}
              >
                <View style={[styles.dot, { backgroundColor: v.hex }]} />
                <Text
                  numberOfLines={1}
                  style={[styles.colorLabel, { color: colors.text }]}
                >
                  {v.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Field
          label="Aclaración o nota al pie (opcional)"
          value={active.highlightNote ?? ''}
          onChangeText={(highlightNote) => update({ highlightNote })}
          placeholder="Ej: * Válido hasta agotar stock"
          maxLength={120}
          showCount
        />
      </View>

      <View
        style={[
          styles.sheetBlock,
          { borderColor: colors.border, backgroundColor: colors.background },
        ]}
      >
        <Text style={[styles.blockTitle, { color: colors.text }]}>
          Frecuencia y tiempo en pantalla
        </Text>
        <View style={styles.freqList}>
          {ANNOUNCEMENT_FREQUENCIES.map((opt) => {
            const selected = (active.frequency ?? 'once_per_day') === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => update({ frequency: opt.value })}
                style={[
                  styles.freqCard,
                  {
                    borderColor: selected ? palette.primary : colors.border,
                    backgroundColor: selected
                      ? `${palette.primary}10`
                      : colors.card,
                  },
                ]}
              >
                <View style={styles.freqTop}>
                  <Text style={[styles.freqTitle, { color: colors.text }]}>
                    {opt.label}
                  </Text>
                  {selected ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color={palette.primary}
                    />
                  ) : null}
                </View>
                <Text style={[styles.freqDesc, { color: colors.muted }]}>
                  {opt.description}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.subLabel, { color: colors.text }]}>
          Auto-cierre automático
        </Text>
        <ChipSelector
          options={ANNOUNCEMENT_DURATIONS.map((d) => ({
            value: String(d.value),
            label: d.label,
          }))}
          selected={String(active.autoCloseSeconds ?? 5)}
          onSelect={(val) => update({ autoCloseSeconds: Number(val) })}
        />
      </View>

      <View
        style={[
          styles.sheetBlock,
          { borderColor: colors.border, backgroundColor: colors.background },
        ]}
      >
        <View style={styles.imgHeader}>
          <Text style={[styles.blockTitle, { color: colors.text }]}>
            Imágenes ({active.images.length}/{MAX_ANNOUNCEMENT_IMAGES})
          </Text>
        </View>

        {active.images.map((img, idx) => (
          <View
            key={`${img.url}-${idx}`}
            style={[
              styles.imgItem,
              { borderColor: colors.border, backgroundColor: colors.card },
            ]}
          >
            <View style={styles.imgItemTop}>
              <Image
                source={{ uri: img.url }}
                style={styles.imgPreview}
                contentFit="cover"
              />
              <View style={styles.flex}>
                <Text style={[styles.imgNumber, { color: colors.text }]}>
                  Imagen {idx + 1}
                </Text>
                <ReorderRow
                  onUp={() => update({ images: moveItem(active.images, idx, -1) })}
                  onDown={() =>
                    update({ images: moveItem(active.images, idx, 1) })
                  }
                  onRemove={() =>
                    update({
                      images: active.images.filter((_, i) => i !== idx),
                    })
                  }
                  disableUp={idx === 0}
                  disableDown={idx === active.images.length - 1}
                />
              </View>
            </View>
            <Field
              label="Descripción accesibilidad (opcional)"
              value={img.alt}
              onChangeText={(alt) =>
                update({
                  images: active.images.map((entry, i) =>
                    i === idx ? { ...entry, alt } : entry,
                  ),
                })
              }
              placeholder="Ej: Promo 2x1 de verano"
              maxLength={120}
            />
          </View>
        ))}

        {active.images.length < MAX_ANNOUNCEMENT_IMAGES ? (
          <WebsiteImageField
            label={
              active.images.length === 0
                ? 'Subir o elegir imagen'
                : 'Agregar otra imagen'
            }
            value={null}
            kind="aviso"
            slideId="aviso"
            aspect="wide"
            onUploaded={(url) =>
              update({
                images: [
                  ...active.images,
                  { url, alt: active.title.slice(0, 80), href: '' },
                ],
                imageUrl: active.images[0]?.url || url,
              })
            }
          />
        ) : null}

        {active.images.length > 0 ? (
          <>
            <Text style={[styles.subLabel, { color: colors.text }]}>
              Fondo del marco
            </Text>
            <ChipSelector
              options={ANNOUNCEMENT_BACKDROPS}
              selected={active.imageBackdrop ?? 'ambient'}
              onSelect={(imageBackdrop) => update({ imageBackdrop })}
            />
            <Text style={[styles.subLabel, { color: colors.text }]}>
              Encuadre de imagen
            </Text>
            <ChipSelector
              options={ANNOUNCEMENT_FITS}
              selected={active.imageFit ?? 'contain'}
              onSelect={(imageFit) => update({ imageFit })}
            />
            <Text style={[styles.subLabel, { color: colors.text }]}>
              Efecto visual
            </Text>
            <ChipSelector
              options={ANNOUNCEMENT_EFFECTS}
              selected={active.imageEffect ?? 'zoom'}
              onSelect={(imageEffect) => update({ imageEffect })}
            />
          </>
        ) : null}

        {active.images.length > 1 ? (
          <>
            <Text style={[styles.subLabel, { color: colors.text }]}>
              Animación entre fotos
            </Text>
            <ChipSelector
              options={CAROUSEL_ANIMATION_OPTIONS}
              selected={active.carouselAnimation ?? 'slide'}
              onSelect={(carouselAnimation) => update({ carouselAnimation })}
            />
            <Text style={[styles.subLabel, { color: colors.text }]}>
              Velocidad de rotación
            </Text>
            <ChipSelector
              options={CAROUSEL_SPEED_OPTIONS}
              selected={String(active.carouselIntervalSeconds ?? 3)}
              onSelect={(val) =>
                update({ carouselIntervalSeconds: Number(val) })
              }
            />
          </>
        ) : null}
      </View>

      <View
        style={[
          styles.sheetBlock,
          { borderColor: colors.border, backgroundColor: colors.background },
        ]}
      >
        <Text style={[styles.blockTitle, { color: colors.text }]}>
          Botón de acción (opcional)
        </Text>
        <Field
          label="Texto del botón"
          value={active.ctaLabel}
          onChangeText={(ctaLabel) => update({ ctaLabel })}
          placeholder="Ej: Ver ofertas"
          maxLength={60}
        />
        <Field
          label="Enlace del botón"
          value={active.ctaHref}
          onChangeText={(ctaHref) => update({ ctaHref })}
          placeholder="/ofertas o https://..."
          autoCapitalize="none"
          maxLength={500}
          error={issues.ctaHref}
        />
        {shortcuts.length > 0 ? (
          <View style={styles.presetRow}>
            {shortcuts.map((s) => (
              <Pressable
                key={s.href}
                onPress={() => update({ ctaHref: s.href })}
                style={[
                  websiteStyles.chip,
                  {
                    borderColor:
                      active.ctaHref === s.href ? palette.primary : colors.border,
                    backgroundColor: colors.card,
                  },
                ]}
              >
                <Text style={[websiteStyles.chipText, { color: colors.text }]}>
                  {s.label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      <View
        style={[
          styles.sheetBlock,
          { borderColor: colors.border, backgroundColor: colors.background },
        ]}
      >
        <Text style={[styles.blockTitle, { color: colors.text }]}>
          Fechas de vigencia (opcional)
        </Text>
        <View style={styles.dateRow}>
          <View style={styles.flex}>
            <Field
              label="Desde (AAAA-MM-DD)"
              value={active.startsAt}
              onChangeText={(startsAt) => update({ startsAt })}
              placeholder="2026-12-01"
              maxLength={10}
              keyboardType="numbers-and-punctuation"
              error={issues.startsAt}
              right={
                <Pressable onPress={() => update({ startsAt: today })}>
                  <Text style={styles.todayLink}>Hoy</Text>
                </Pressable>
              }
            />
          </View>
          <View style={styles.flex}>
            <Field
              label="Hasta (AAAA-MM-DD)"
              value={active.endsAt}
              onChangeText={(endsAt) => update({ endsAt })}
              placeholder="2026-12-31"
              maxLength={10}
              keyboardType="numbers-and-punctuation"
              error={issues.endsAt}
              right={
                active.endsAt ? (
                  <Pressable onPress={() => update({ endsAt: '' })}>
                    <Text style={styles.todayLink}>Limpiar</Text>
                  </Pressable>
                ) : null
              }
            />
          </View>
        </View>
      </View>
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
  ideasWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ideaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  ideaText: { color: palette.primary, fontSize: 12, fontWeight: '700' },
  list: { gap: 12 },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 13,
    gap: 8,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardTitleCol: { flex: 1, gap: 6 },
  pillRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  miniTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    maxWidth: 180,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  miniTagText: { fontSize: 11, fontWeight: '700' },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  cardMessage: { fontSize: 13, lineHeight: 18 },
  thumbStrip: { gap: 8, paddingVertical: 2 },
  cardThumb: { width: 58, height: 42, borderRadius: 8 },
  metaLine: { fontSize: 11 },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    marginTop: 2,
  },
  rightActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  smallActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  smallActionText: { fontSize: 12, fontWeight: '800' },
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  previewCard: {
    borderWidth: 1,
    borderRadius: 22,
    overflow: 'hidden',
  },
  previewClose: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewHeroBox: { height: 190, width: '100%', justifyContent: 'flex-end' },
  previewImgControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  previewNavArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImgCount: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  previewBody: { padding: 18, gap: 10 },
  previewTitle: { fontSize: 19, fontWeight: '900' },
  previewMsg: { fontSize: 14, lineHeight: 20 },
  previewNote: { fontSize: 11, fontStyle: 'italic' },
  previewCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 4,
  },
  previewCtaText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  previewFooterHint: { fontSize: 11, textAlign: 'center', marginTop: 4 },
  sheetBlock: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  blockTitle: { fontSize: 14, fontWeight: '800' },
  subLabel: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  presetRow: { gap: 8, paddingVertical: 2, flexDirection: 'row', flexWrap: 'wrap' },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  colorOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    minWidth: '47%',
  },
  colorLabel: { fontSize: 12, fontWeight: '700' },
  freqList: { gap: 8 },
  freqCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 11,
    gap: 3,
  },
  freqTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  freqTitle: { fontSize: 13, fontWeight: '800' },
  freqDesc: { fontSize: 11, lineHeight: 16 },
  imgHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  imgItem: { borderWidth: 1, borderRadius: 12, padding: 10, gap: 8 },
  imgItemTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  imgPreview: { width: 64, height: 48, borderRadius: 8 },
  imgNumber: { fontSize: 12, fontWeight: '700', marginBottom: 4 },
  dateRow: { flexDirection: 'row', gap: 10 },
  todayLink: { color: palette.primary, fontSize: 12, fontWeight: '800' },
});
