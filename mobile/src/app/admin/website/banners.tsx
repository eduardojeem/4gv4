import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { OfflineNotice, WebsiteGate } from '@/components/website/website-gate';
import { WebsiteImageField } from '@/components/website/website-image-field';
import { Field, Notice, SaveBar, Section, StateView, ToggleRow, WebsiteScreen, useUnsavedChangesGuard, websiteStyles } from '@/components/website/website-ui';
import { palette, usePalette } from '@/lib/palette';
import { saveWebsiteSettings, websiteErrorMessage } from '@/lib/website-admin';
import { useWebsite } from '@/lib/website-context';
import { emptySlide, isDirty, moveItem, slideIssues, type CarouselSlide, type PromotionalCarousel, type WebsiteSettings } from '@/lib/website-model';

const MAX_SLIDES = 6;
const INTERVALS = [5, 6, 7, 10, 15];
const DEFAULT_CAROUSEL: PromotionalCarousel = { enabled: false, autoplay: true, intervalSeconds: 6, slides: [] };

export default function BannersScreen() {
  return <WebsiteGate title="Banners">{(settings) => <BannersEditor settings={settings} />}</WebsiteGate>;
}

function BannersEditor({ settings }: { settings: WebsiteSettings }) {
  const colors = usePalette();
  const { applySaved } = useWebsite();
  const saved = useMemo(() => ({ ...DEFAULT_CAROUSEL, ...(settings.promotional_carousel ?? {}) }), [settings.promotional_carousel]);
  const [carousel, setCarousel] = useState<PromotionalCarousel>(saved);
  const [editing, setEditing] = useState<{ slide: CarouselSlide; index: number | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const dirty = isDirty(saved, carousel);
  const slides = useMemo(() => carousel.slides ?? [], [carousel.slides]);

  const update = (patch: Partial<PromotionalCarousel>) => setCarousel((current) => ({ ...current, ...patch }));
  const setSlides = (next: CarouselSlide[]) => update({ slides: next });

  const save = useCallback(async () => {
    const broken = slides.findIndex((slide) => Object.keys(slideIssues(slide)).length > 0);
    if (broken >= 0) {
      Alert.alert('Revisá el banner', `El banner ${broken + 1} tiene datos incompletos: ${Object.values(slideIssues(slides[broken])).join(' ')}`);
      return false;
    }
    setSaving(true);
    try {
      const persisted = await saveWebsiteSettings({ promotional_carousel: carousel });
      applySaved(persisted as Partial<WebsiteSettings>);
      if (persisted.promotional_carousel) setCarousel(persisted.promotional_carousel as PromotionalCarousel);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return true;
    } catch (error) {
      Alert.alert('No pudimos guardar', websiteErrorMessage(error, 'No pudimos guardar los banners. Revisá tu conexión e intentá nuevamente.'));
      return false;
    } finally {
      setSaving(false);
    }
  }, [slides, carousel, applySaved]);

  useUnsavedChangesGuard(dirty && !saving, save);

  const remove = (index: number) => {
    Alert.alert('¿Eliminar este banner?', 'Se quita de la lista. Recién deja de verse en tu tienda cuando guardes.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => setSlides(slides.filter((_, i) => i !== index)) },
    ]);
  };

  const commitSlide = (slide: CarouselSlide, index: number | null) => {
    const issues = slideIssues(slide);
    if (Object.keys(issues).length) {
      Alert.alert('Faltan datos', Object.values(issues).join('\n'));
      return;
    }
    setSlides(index === null ? [...slides, slide] : slides.map((item, i) => (i === index ? slide : item)));
    setEditing(null);
  };

  return (
    <WebsiteScreen title="Banners" subtitle="Campañas del inicio" footer={<SaveBar dirty={dirty} saving={saving} onSave={() => void save()} />}>
      <OfflineNotice />
      <Section title="Carrusel" icon="albums-outline">
        <ToggleRow label="Mostrar banners en el inicio" value={carousel.enabled} onValueChange={(value) => update({ enabled: value })} />
        <ToggleRow label="Pasar solos" hint="Cambian automáticamente" value={carousel.autoplay} onValueChange={(value) => update({ autoplay: value })} />
        {carousel.autoplay ? (
          <View style={styles.intervals}>
            {[...new Set([...INTERVALS, carousel.intervalSeconds])].filter((seconds) => Number.isFinite(seconds)).sort((a, b) => a - b).map((seconds) => {
              const selected = carousel.intervalSeconds === seconds;
              return (
                <Pressable key={seconds} onPress={() => update({ intervalSeconds: seconds })} accessibilityRole="radio" accessibilityState={{ selected }}
                  style={[websiteStyles.chip, { borderColor: selected ? palette.primary : colors.border, backgroundColor: selected ? `${palette.primary}12` : 'transparent' }]}>
                  <Text style={[websiteStyles.chipText, { color: selected ? palette.primary : colors.text }]}>{seconds} s</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </Section>

      {slides.length === 0 ? (
        <StateView icon="images-outline" title="Todavía no hay banners" text="Sumá una imagen con un mensaje y un botón para destacar una campaña." />
      ) : (
        slides.map((slide, index) => (
          <View key={slide.id} style={[styles.slide, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Pressable onPress={() => setEditing({ slide, index })} accessibilityRole="button" accessibilityLabel={`Editar banner ${index + 1}`} style={styles.slideMain}>
              {slide.imageUrl ? <Image source={{ uri: slide.imageUrl }} style={styles.thumb} contentFit="cover" /> : <View style={[styles.thumb, { backgroundColor: colors.border }]} />}
              <View style={styles.flex}>
                <Text numberOfLines={1} style={[styles.slideTitle, { color: colors.text }]}>{slide.title || slide.imageAlt || `Banner ${index + 1}`}</Text>
                <Text numberOfLines={1} style={[styles.slideHint, { color: colors.muted }]}>{slide.active ? 'Visible' : 'Oculto'}{slide.ctaText ? ` · ${slide.ctaText}` : ''}</Text>
              </View>
              <Switch value={slide.active} onValueChange={(value) => setSlides(slides.map((item, i) => (i === index ? { ...item, active: value } : item)))}
                accessibilityLabel={`Mostrar banner ${index + 1}`} trackColor={{ false: colors.border, true: palette.primary }} />
            </Pressable>
            <View style={[styles.actions, { borderColor: colors.border }]}>
              <IconAction icon="arrow-up" label="Subir" disabled={index === 0} onPress={() => setSlides(moveItem(slides, index, -1))} />
              <IconAction icon="arrow-down" label="Bajar" disabled={index === slides.length - 1} onPress={() => setSlides(moveItem(slides, index, 1))} />
              <IconAction icon="create-outline" label="Editar" onPress={() => setEditing({ slide, index })} />
              <IconAction icon="trash-outline" label="Eliminar" danger onPress={() => remove(index)} />
            </View>
          </View>
        ))
      )}

      {slides.length < MAX_SLIDES ? (
        <Pressable onPress={() => setEditing({ slide: emptySlide(), index: null })} accessibilityRole="button" style={websiteStyles.primaryButton}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={websiteStyles.primaryText}>Agregar banner</Text>
        </Pressable>
      ) : (
        <Notice text={`Llegaste al máximo de ${MAX_SLIDES} banners.`} />
      )}

      {editing ? <SlideSheet key={editing.slide.id} initial={editing.slide} onClose={() => setEditing(null)} onDone={(slide) => commitSlide(slide, editing.index)} /> : null}
    </WebsiteScreen>
  );
}

function IconAction({ icon, label, onPress, disabled, danger }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; disabled?: boolean; danger?: boolean }) {
  const colors = usePalette();
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} hitSlop={6} style={[styles.action, { opacity: disabled ? 0.35 : 1 }]}>
      <Ionicons name={icon} size={17} color={danger ? palette.danger : colors.text} />
      <Text style={[styles.actionText, { color: danger ? palette.danger : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

function SlideSheet({ initial, onClose, onDone }: { initial: CarouselSlide; onClose: () => void; onDone: (slide: CarouselSlide) => void }) {
  const colors = usePalette();
  const [slide, setSlide] = useState<CarouselSlide>(initial);
  const issues = slideIssues(slide);
  const set = (patch: Partial<CarouselSlide>) => setSlide((current) => ({ ...current, ...patch }));

  return (
    <BottomSheet visible title={initial.imageUrl ? 'Editar banner' : 'Nuevo banner'} subtitle="Se guarda en tu tienda con «Guardar cambios»." onClose={onClose} tall
      footer={
        <Pressable onPress={() => onDone(slide)} accessibilityRole="button" style={websiteStyles.primaryButton}>
          <Text style={websiteStyles.primaryText}>Listo</Text>
        </Pressable>
      }>
      <WebsiteImageField label="Imagen" kind="banner" slideId={slide.id} aspect="wide" value={slide.imageUrl} onUploaded={(url) => set({ imageUrl: url })} help="Horizontal (16:9). Hasta 5 MB." />
      <Field label="Descripción de la imagen" value={slide.imageAlt} onChangeText={(value) => set({ imageAlt: value })} placeholder="Ej.: Zapatillas en oferta" maxLength={160} error={issues.imageAlt} help="La usan los lectores de pantalla y Google." />
      <ToggleRow label="Solo imagen" hint="Sin título ni texto encima" value={slide.hideText === true} onValueChange={(value) => set({ hideText: value })} />
      {!slide.hideText ? (
        <>
          <Field label="Título" value={slide.title} onChangeText={(value) => set({ title: value })} placeholder="Semana de ofertas" maxLength={100} />
          <Field label="Mensaje" value={slide.message} onChangeText={(value) => set({ message: value })} placeholder="Hasta 30% en toda la tienda" multiline maxLength={240} />
          <Field label="Texto del botón" value={slide.ctaText ?? ''} onChangeText={(value) => set({ ctaText: value })} placeholder="Ver ofertas" maxLength={50} error={issues.ctaText} />
        </>
      ) : null}
      <Field label="Enlace" value={slide.ctaHref ?? ''} onChangeText={(value) => set({ ctaHref: value.trim() })} placeholder="/ofertas o https://…" autoCapitalize="none" keyboardType="url" maxLength={500} error={issues.ctaHref}
        help="Una página de tu tienda (/ofertas, /productos) o una dirección completa." />
      {!slide.hideText ? (
        <View style={styles.aligns}>
          {(['left', 'center', 'right'] as const).map((align) => {
            const selected = (slide.contentAlign ?? 'left') === align;
            return (
              <Pressable key={align} onPress={() => set({ contentAlign: align })} accessibilityRole="radio" accessibilityState={{ selected }}
                style={[websiteStyles.chip, { borderColor: selected ? palette.primary : colors.border }]}>
                <Text style={[websiteStyles.chipText, { color: selected ? palette.primary : colors.text }]}>{align === 'left' ? 'Izquierda' : align === 'center' ? 'Centro' : 'Derecha'}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <ToggleRow label="Visible" value={slide.active} onValueChange={(value) => set({ active: value })} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  intervals: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slide: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  slideMain: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  thumb: { width: 72, height: 44, borderRadius: 8 },
  slideTitle: { fontSize: 14, fontWeight: '800' },
  slideHint: { fontSize: 12, marginTop: 2 },
  actions: { flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 8 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32, paddingHorizontal: 6 },
  actionText: { fontSize: 12, fontWeight: '700' },
  aligns: { flexDirection: 'row', gap: 8 },
});
