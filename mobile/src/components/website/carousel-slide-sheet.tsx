import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { palette, usePalette } from '@/lib/palette';
import {
  TITLE_COLOR_PRESETS,
  carouselExamplesFor,
  carouselLinkShortcuts,
  slideIssues,
  slideLinkProblem,
  type CarouselContext,
  type CarouselSlide,
} from '@/lib/website-model';
import { WebsiteImageField } from './website-image-field';
import {
  ChipSelector,
  Field,
  Notice,
  StatusPill,
  ToggleRow,
  websiteStyles,
} from './website-ui';

const SLIDE_BG_PRESETS = [
  '#0F172A',
  '#1E293B',
  '#2563EB',
  '#7C3AED',
  '#E11D48',
  '#059669',
  '#F59E0B',
  '#F8FAFC',
];

const hexToRgba = (hex: string, alpha: number) => {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return `rgba(15,23,42,${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r},${g},${b},${alpha})`;
};

export function SlidePreviewCard({
  slide,
  brandHex,
  device,
}: {
  slide: CarouselSlide;
  brandHex: string;
  device: 'desktop' | 'mobile';
}) {
  const overlayAlpha =
    slide.overlayIntensity === 'none'
      ? 0
      : slide.overlayIntensity === 'subtle'
        ? 0.28
        : slide.overlayIntensity === 'strong'
          ? 0.72
          : 0.48;
  const overlayHex =
    slide.overlayColor === 'white'
      ? '#FFFFFF'
      : slide.overlayColor === 'brand'
        ? brandHex
        : '#09090B';
  const overlayBg = hexToRgba(overlayHex, overlayAlpha);
  const align =
    slide.contentAlign === 'center'
      ? 'center'
      : slide.contentAlign === 'right'
        ? 'flex-end'
        : 'flex-start';
  const textAlign =
    slide.contentAlign === 'center'
      ? 'center'
      : slide.contentAlign === 'right'
        ? 'right'
        : 'left';
  const defaultText = slide.textTone === 'dark' ? '#09090B' : '#FFFFFF';
  const titleColor = slide.titleColor || defaultText;
  const subColor =
    slide.textTone === 'dark' ? 'rgba(9,9,11,0.82)' : 'rgba(255,255,255,0.88)';
  const titleSize =
    slide.titleSize === 'compact'
      ? 15
      : slide.titleSize === 'large'
        ? 22
        : 18;

  return (
    <View
      style={[
        styles.previewBox,
        {
          aspectRatio: device === 'desktop' ? 16 / 7.5 : 4 / 3,
          backgroundColor: slide.backgroundColor || '#0F172A',
        },
      ]}
    >
      {slide.imageUrl ? (
        <Image
          source={{ uri: slide.imageUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      ) : null}
      {overlayAlpha > 0 ? (
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: overlayBg }]}
        />
      ) : null}
      {!slide.hideText ? (
        <View
          style={[
            styles.previewContent,
            { alignItems: align, justifyContent: 'center' },
          ]}
        >
          {slide.badge?.trim() ? (
            <View style={styles.previewBadge}>
              <Text style={styles.previewBadgeText}>{slide.badge.trim()}</Text>
            </View>
          ) : null}
          {slide.title?.trim() ? (
            <Text
              numberOfLines={2}
              style={[
                styles.previewTitle,
                {
                  color: titleColor,
                  fontSize: titleSize,
                  textAlign,
                  fontFamily:
                    slide.fontFamily === 'serif'
                      ? 'serif'
                      : slide.fontFamily === 'mono'
                        ? 'monospace'
                        : undefined,
                },
              ]}
            >
              {slide.title.trim()}
            </Text>
          ) : null}
          {slide.message?.trim() ? (
            <Text
              numberOfLines={2}
              style={[
                styles.previewMessage,
                { color: subColor, textAlign },
              ]}
            >
              {slide.message.trim()}
            </Text>
          ) : null}
          {slide.ctaText?.trim() ? (
            <View style={[styles.previewCta, { backgroundColor: brandHex }]}>
              <Text style={styles.previewCtaText}>{slide.ctaText.trim()}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function CarouselSlideSheet({
  visible,
  slide,
  isNew,
  brandHex,
  context,
  onClose,
  onSave,
}: {
  visible: boolean;
  slide: CarouselSlide | null;
  isNew: boolean;
  brandHex: string;
  context: CarouselContext;
  onClose: () => void;
  onSave: (slide: CarouselSlide) => void;
}) {
  if (!visible || !slide) return null;
  return (
    <CarouselSlideSheetInner
      key={`${slide.id}-${isNew ? 'new' : 'edit'}`}
      visible={visible}
      slide={slide}
      isNew={isNew}
      brandHex={brandHex}
      context={context}
      onClose={onClose}
      onSave={onSave}
    />
  );
}

function CarouselSlideSheetInner({
  visible,
  slide,
  isNew,
  brandHex,
  context,
  onClose,
  onSave,
}: {
  visible: boolean;
  slide: CarouselSlide;
  isNew: boolean;
  brandHex: string;
  context: CarouselContext;
  onClose: () => void;
  onSave: (slide: CarouselSlide) => void;
}) {
  const colors = usePalette();
  const [draft, setDraft] = useState<CarouselSlide>(() => ({ ...slide }));
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('mobile');
  const [showErrors, setShowErrors] = useState(false);

  const set = (patch: Partial<CarouselSlide>) =>
    setDraft((prev) => ({ ...prev, ...patch }));

  const issues = slideIssues(draft);
  const linkWarning = slideLinkProblem(draft.ctaHref, context);
  const examples = carouselExamplesFor(context);
  const shortcuts = carouselLinkShortcuts(context);

  const commit = () => {
    if (Object.keys(issues).length > 0) {
      setShowErrors(true);
      return;
    }
    onSave(draft);
  };

  return (
    <BottomSheet
      visible={visible}
      tall
      title={isNew ? 'Nuevo banner' : 'Editar banner'}
      subtitle="Vista previa y estilo de la diapositiva"
      onClose={onClose}
      footer={
        <View style={styles.footerRow}>
          <Pressable
            onPress={onClose}
            style={[
              websiteStyles.secondaryButton,
              { borderColor: colors.border, flex: 1 },
            ]}
          >
            <Text style={[websiteStyles.secondaryText, { color: colors.text }]}>
              Cancelar
            </Text>
          </Pressable>
          <Pressable
            onPress={commit}
            style={[websiteStyles.primaryButton, { flex: 1.4 }]}
          >
            <Ionicons name="checkmark" size={17} color="#fff" />
            <Text style={websiteStyles.primaryText}>
              {isNew ? 'Agregar banner' : 'Aplicar cambios'}
            </Text>
          </Pressable>
        </View>
      }
    >
      <View style={styles.previewHeader}>
        <Text style={[styles.blockLabel, { color: colors.text }]}>
          Vista previa
        </Text>
        <View style={styles.deviceTabs}>
          <Pressable
            onPress={() => setPreviewDevice('mobile')}
            style={[
              styles.deviceBtn,
              {
                borderColor:
                  previewDevice === 'mobile' ? palette.primary : colors.border,
                backgroundColor:
                  previewDevice === 'mobile'
                    ? `${palette.primary}15`
                    : colors.background,
              },
            ]}
          >
            <Ionicons
              name="phone-portrait-outline"
              size={13}
              color={previewDevice === 'mobile' ? palette.primary : colors.muted}
            />
            <Text
              style={[
                styles.deviceText,
                {
                  color:
                    previewDevice === 'mobile' ? palette.primary : colors.muted,
                },
              ]}
            >
              Móvil
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setPreviewDevice('desktop')}
            style={[
              styles.deviceBtn,
              {
                borderColor:
                  previewDevice === 'desktop' ? palette.primary : colors.border,
                backgroundColor:
                  previewDevice === 'desktop'
                    ? `${palette.primary}15`
                    : colors.background,
              },
            ]}
          >
            <Ionicons
              name="desktop-outline"
              size={13}
              color={previewDevice === 'desktop' ? palette.primary : colors.muted}
            />
            <Text
              style={[
                styles.deviceText,
                {
                  color:
                    previewDevice === 'desktop' ? palette.primary : colors.muted,
                },
              ]}
            >
              Web
            </Text>
          </Pressable>
        </View>
      </View>

      <SlidePreviewCard
        slide={draft}
        brandHex={brandHex}
        device={previewDevice}
      />

      {examples.length > 0 ? (
        <View style={styles.block}>
          <Text style={[styles.blockLabel, { color: colors.text }]}>
            Ideas rápidas para tu rubro
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.examplesRow}
          >
            {examples.map((ex) => (
              <Pressable
                key={ex.name}
                onPress={() =>
                  set({
                    ...ex.slide,
                    imageUrl: draft.imageUrl || ex.slide.imageUrl,
                    imageAlt: draft.imageAlt || ex.name,
                  })
                }
                style={[
                  styles.exampleCard,
                  {
                    borderColor: ex.recommended
                      ? `${palette.primary}55`
                      : colors.border,
                    backgroundColor: colors.background,
                  },
                ]}
              >
                <View style={styles.exampleTop}>
                  <Text style={[styles.exampleName, { color: colors.text }]}>
                    {ex.name}
                  </Text>
                  {ex.recommended ? (
                    <StatusPill label="Tu rubro" tone="primary" />
                  ) : null}
                </View>
                <Text
                  numberOfLines={2}
                  style={[styles.exampleMsg, { color: colors.muted }]}
                >
                  {ex.slide.title}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <WebsiteImageField
        label="Imagen de fondo"
        kind="banner"
        slideId={draft.id}
        aspect="wide"
        value={draft.imageUrl}
        onUploaded={(url) => set({ imageUrl: url })}
        help="Horizontal (16:9). Hasta 5 MB o elegila del historial."
      />
      {showErrors && issues.imageUrl ? (
        <Text style={styles.errorText}>{issues.imageUrl}</Text>
      ) : null}

      <Field
        label="Descripción de la imagen (accesibilidad)"
        value={draft.imageAlt}
        onChangeText={(value) => set({ imageAlt: value })}
        placeholder="Ej: Auriculares en oferta de la semana"
        maxLength={120}
        error={showErrors ? issues.imageAlt : undefined}
      />

      <View style={styles.block}>
        <Text style={[styles.blockLabel, { color: colors.text }]}>
          Color de fondo base
        </Text>
        <View style={styles.swatches}>
          {SLIDE_BG_PRESETS.map((hex) => {
            const active = (draft.backgroundColor || '').toUpperCase() === hex;
            return (
              <Pressable
                key={hex}
                onPress={() => set({ backgroundColor: hex })}
                accessibilityLabel={`Fondo ${hex}`}
                style={[
                  styles.colorDot,
                  {
                    backgroundColor: hex,
                    borderColor: active ? palette.primary : colors.border,
                    borderWidth: active ? 2.5 : 1,
                  },
                ]}
              />
            );
          })}
        </View>
      </View>

      <ToggleRow
        label="Ocultar textos y botones"
        hint="Mostrá solo tu imagen diseñada sin capas de texto encima."
        value={draft.hideText === true}
        onValueChange={(value) => set({ hideText: value })}
      />

      {!draft.hideText ? (
        <View style={styles.textSection}>
          <Field
            label="Etiqueta superior (badge)"
            value={draft.badge ?? ''}
            onChangeText={(value) => set({ badge: value })}
            placeholder="Ej: Oferta flash, Nueva colección"
            maxLength={40}
            showCount
          />
          <Field
            label="Título principal"
            value={draft.title}
            onChangeText={(value) => set({ title: value })}
            placeholder="Ej: Hasta 30% OFF en auriculares"
            maxLength={90}
            showCount
          />
          <Field
            label="Mensaje"
            value={draft.message}
            onChangeText={(value) => set({ message: value })}
            placeholder="Frase corta que acompaña el título"
            multiline
            maxLength={220}
            showCount
          />

          <View style={styles.block}>
            <Text style={[styles.blockLabel, { color: colors.text }]}>
              Color del título
            </Text>
            <View style={styles.swatches}>
              {TITLE_COLOR_PRESETS.map((preset) => {
                const active =
                  (draft.titleColor || '#ffffff').toLowerCase() ===
                  preset.value.toLowerCase();
                return (
                  <Pressable
                    key={preset.value}
                    onPress={() => set({ titleColor: preset.value })}
                    accessibilityLabel={preset.label}
                    style={[
                      styles.colorDot,
                      {
                        backgroundColor: preset.value,
                        borderColor: active ? palette.primary : colors.border,
                        borderWidth: active ? 2.5 : 1,
                      },
                    ]}
                  />
                );
              })}
            </View>
          </View>

          <View style={styles.block}>
            <Text style={[styles.blockLabel, { color: colors.text }]}>
              Tamaño del título
            </Text>
            <ChipSelector
              options={[
                { value: 'compact', label: 'Compacto' },
                { value: 'normal', label: 'Normal' },
                { value: 'large', label: 'Grande' },
              ]}
              selected={draft.titleSize ?? 'normal'}
              onSelect={(value) => set({ titleSize: value })}
            />
          </View>

          <View style={styles.block}>
            <Text style={[styles.blockLabel, { color: colors.text }]}>
              Tipografía
            </Text>
            <ChipSelector
              options={[
                { value: 'sans', label: 'Moderna' },
                { value: 'display', label: 'Impacto' },
                { value: 'serif', label: 'Editorial' },
                { value: 'mono', label: 'Técnica' },
              ]}
              selected={draft.fontFamily ?? 'sans'}
              onSelect={(value) => set({ fontFamily: value })}
            />
          </View>

          <View style={styles.block}>
            <Text style={[styles.blockLabel, { color: colors.text }]}>
              Alineación y tono del texto
            </Text>
            <ChipSelector
              options={[
                { value: 'left', label: 'Izquierda' },
                { value: 'center', label: 'Centro' },
                { value: 'right', label: 'Derecha' },
              ]}
              selected={draft.contentAlign ?? 'left'}
              onSelect={(value) => set({ contentAlign: value })}
            />
            <ChipSelector
              options={[
                { value: 'light', label: 'Texto claro' },
                { value: 'dark', label: 'Texto oscuro' },
              ]}
              selected={draft.textTone ?? 'light'}
              onSelect={(value) => set({ textTone: value })}
            />
          </View>

          <View style={styles.block}>
            <Text style={[styles.blockLabel, { color: colors.text }]}>
              Velo sobre la foto (mejora legibilidad)
            </Text>
            <ChipSelector
              options={[
                { value: 'black', label: 'Negro' },
                { value: 'brand', label: 'Marca' },
                { value: 'white', label: 'Blanco' },
              ]}
              selected={draft.overlayColor ?? 'black'}
              onSelect={(value) => set({ overlayColor: value })}
            />
            <ChipSelector
              options={[
                { value: 'none', label: 'Sin velo' },
                { value: 'subtle', label: 'Suave' },
                { value: 'medium', label: 'Medio' },
                { value: 'strong', label: 'Fuerte' },
              ]}
              selected={draft.overlayIntensity ?? 'medium'}
              onSelect={(value) => set({ overlayIntensity: value })}
            />
          </View>

          <Field
            label="Texto del botón (opcional)"
            value={draft.ctaText ?? ''}
            onChangeText={(value) => set({ ctaText: value })}
            placeholder="Ej: Ver ofertas"
            maxLength={40}
            error={showErrors ? issues.ctaText : undefined}
          />
          <Field
            label="Enlace del botón (opcional)"
            value={draft.ctaHref ?? ''}
            onChangeText={(value) => set({ ctaHref: value })}
            placeholder="/productos, /ofertas o https://…"
            autoCapitalize="none"
            error={showErrors ? issues.ctaHref : undefined}
          />

          {shortcuts.length > 0 ? (
            <View style={styles.shortcutsWrap}>
              {shortcuts.map((sc) => (
                <Pressable
                  key={sc.href}
                  onPress={() =>
                    set({
                      ctaHref: sc.href,
                      ctaText: draft.ctaText?.trim()
                        ? draft.ctaText
                        : sc.label.split(' ')[0],
                    })
                  }
                  style={[
                    websiteStyles.chip,
                    {
                      borderColor:
                        draft.ctaHref === sc.href
                          ? palette.primary
                          : colors.border,
                      backgroundColor: colors.background,
                    },
                  ]}
                >
                  <Text
                    style={[
                      websiteStyles.chipText,
                      {
                        color:
                          draft.ctaHref === sc.href
                            ? palette.primary
                            : colors.text,
                      },
                    ]}
                  >
                    {sc.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {linkWarning ? <Notice tone="warning" text={linkWarning} /> : null}
        </View>
      ) : null}

      <ToggleRow
        label="Banner visible"
        hint="Desactivalo si querés guardarlo sin mostrarlo todavía."
        value={draft.active}
        onValueChange={(value) => set({ active: value })}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  deviceTabs: { flexDirection: 'row', gap: 6 },
  deviceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  deviceText: { fontSize: 11, fontWeight: '800' },
  previewBox: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  previewContent: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    padding: 14,
    gap: 6,
  },
  previewBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  previewBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  previewTitle: { fontWeight: '900' },
  previewMessage: { fontSize: 12, lineHeight: 16 },
  previewCta: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 2,
  },
  previewCtaText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  block: { gap: 7 },
  blockLabel: { fontSize: 13, fontWeight: '700' },
  examplesRow: { gap: 8, paddingVertical: 2 },
  exampleCard: {
    width: 176,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 5,
  },
  exampleTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  exampleName: { fontSize: 12, fontWeight: '800', flexShrink: 1 },
  exampleMsg: { fontSize: 11 },
  errorText: { color: palette.danger, fontSize: 12, fontWeight: '600' },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  colorDot: { width: 30, height: 30, borderRadius: 15 },
  textSection: { gap: 12 },
  shortcutsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  footerRow: { flexDirection: 'row', gap: 10, paddingTop: 6 },
});
