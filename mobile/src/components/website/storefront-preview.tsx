import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { usePalette } from '@/lib/palette';
import {
  STOREFRONT_TEMPLATES_META,
  brandHex,
  type CompanyInfo,
  type HeroContent,
  type StorefrontStyle,
} from '@/lib/website-model';

const darkThemeStyles = new Set<StorefrontStyle>([
  'tech',
  'barber',
  'sport',
]);

export function StorefrontLivePreview({
  company,
  hero,
  resolvedStyle,
  compact = false,
}: {
  company: CompanyInfo;
  hero?: HeroContent;
  resolvedStyle: StorefrontStyle;
  compact?: boolean;
}) {
  const colors = usePalette();
  const accent = brandHex(company);
  const templateMeta = STOREFRONT_TEMPLATES_META[resolvedStyle];

  const headerMode =
    company.headerStyle && company.headerStyle !== 'glass'
      ? company.headerStyle
      : 'solid';
  const headerBg =
    headerMode === 'dark'
      ? '#0B0F19'
      : headerMode === 'accent'
        ? accent
        : '#FFFFFF';
  const headerText = headerMode === 'solid' ? '#0F172A' : '#FFFFFF';

  const isDarkCanvas = darkThemeStyles.has(resolvedStyle);
  const isCatalogOnly = resolvedStyle === 'catalog-basic';
  const isServiceFocus =
    resolvedStyle === 'services' || resolvedStyle === 'barber';
  const isPortrait =
    resolvedStyle === 'fashion' || resolvedStyle === 'beauty';
  const isMarket =
    resolvedStyle === 'market' || resolvedStyle === 'wholesale-pro';

  const canvasBg = isDarkCanvas ? '#0F172A' : '#F8FAFC';
  const cardBg = isDarkCanvas ? '#1E293B' : '#FFFFFF';
  const ink = isDarkCanvas ? '#F8FAFC' : '#0F172A';
  const mutedInk = isDarkCanvas ? '#94A3B8' : '#64748B';
  const radius =
    resolvedStyle === 'modern' || resolvedStyle === 'beauty'
      ? 14
      : resolvedStyle === 'sport'
        ? 4
        : 10;

  const badgeText =
    hero?.badge?.trim() ||
    (isServiceFocus ? 'Turnos online' : templateMeta.badge);
  const titleText =
    hero?.title?.trim() ||
    (company.name
      ? `Bienvenido a ${company.name}`
      : 'Tu tienda online lista para vender');
  const ctaText =
    hero?.ctaPrimaryText?.trim() ||
    (isServiceFocus ? 'Reservar turno' : isCatalogOnly ? 'Ver vitrina' : 'Comprar ahora');

  return (
    <View
      style={[
        styles.frame,
        { borderColor: colors.border, backgroundColor: canvasBg },
      ]}
      accessible
      accessibilityLabel={`Vista previa del diseño ${templateMeta.name}`}
    >
      {!compact ? (
        <View
          style={[
            styles.browserBar,
            { backgroundColor: colors.background, borderColor: colors.border },
          ]}
        >
          <View style={styles.dotsRow}>
            <View style={[styles.chromeDot, { backgroundColor: '#EF4444' }]} />
            <View style={[styles.chromeDot, { backgroundColor: '#F59E0B' }]} />
            <View style={[styles.chromeDot, { backgroundColor: '#10B981' }]} />
          </View>
          <View
            style={[
              styles.addressPill,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <Ionicons
              name={
                company.storefrontPublic
                  ? 'lock-closed-outline'
                  : 'eye-off-outline'
              }
              size={10}
              color={colors.muted}
            />
            <Text
              numberOfLines={1}
              style={[styles.addressText, { color: colors.muted }]}
            >
              {company.slug ? `/${company.slug}` : '/tu-tienda'}
            </Text>
          </View>
          <Text style={[styles.styleTag, { color: accent }]}>
            {templateMeta.name}
          </Text>
        </View>
      ) : null}

      {company.showTopBar !== false ? (
        <View style={[styles.topStrip, { backgroundColor: accent }]}>
          <Text numberOfLines={1} style={styles.topStripText}>
            {company.phone?.trim()
              ? `Tel. ${company.phone.trim()}`
              : 'Atención online'}{' '}
            ·{' '}
            {company.hours?.weekdays?.trim() || 'Envíos y retiro en el local'}
          </Text>
        </View>
      ) : null}

      <View
        style={[
          styles.navBar,
          {
            backgroundColor: headerBg,
            borderBottomColor:
              headerMode === 'solid' ? '#E2E8F0' : 'rgba(255,255,255,0.1)',
          },
        ]}
      >
        {company.logoUrl ? (
          <Image
            source={{ uri: company.logoUrl }}
            style={[styles.logoImg, { borderRadius: radius === 4 ? 4 : 8 }]}
            contentFit="contain"
          />
        ) : (
          <View
            style={[
              styles.logoFallback,
              {
                backgroundColor: headerMode === 'accent' ? '#FFFFFF' : accent,
                borderRadius: radius === 4 ? 4 : 8,
              },
            ]}
          >
            <Text
              style={[
                styles.logoLetter,
                { color: headerMode === 'accent' ? accent : '#FFFFFF' },
              ]}
            >
              {(company.name || 'T').charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.flex}>
          <Text
            numberOfLines={1}
            style={[styles.brandName, { color: headerText }]}
          >
            {company.name || 'Tu negocio'}
          </Text>
          {company.slogan?.trim() && !compact ? (
            <Text
              numberOfLines={1}
              style={[
                styles.brandSlogan,
                {
                  color:
                    headerMode === 'solid'
                      ? '#64748B'
                      : 'rgba(255,255,255,0.78)',
                },
              ]}
            >
              {company.slogan.trim()}
            </Text>
          ) : null}
        </View>
        <View style={styles.headerIcons}>
          <Ionicons name="search-outline" size={14} color={headerText} />
          {!isCatalogOnly ? (
            <Ionicons
              name={isServiceFocus ? 'calendar-outline' : 'cart-outline'}
              size={14}
              color={headerText}
            />
          ) : null}
        </View>
      </View>

      <View style={styles.heroArea}>
        <View
          style={[
            styles.badgePill,
            {
              backgroundColor: `${accent}20`,
              borderRadius: radius === 4 ? 3 : 999,
            },
          ]}
        >
          <Text style={[styles.badgeText, { color: accent }]}>{badgeText}</Text>
        </View>
        <Text
          numberOfLines={2}
          style={[
            styles.heroTitle,
            {
              color: ink,
              fontStyle: resolvedStyle === 'sport' ? 'italic' : 'normal',
            },
          ]}
        >
          {titleText}
        </Text>
        {!compact && hero?.subtitle?.trim() ? (
          <Text
            numberOfLines={2}
            style={[styles.heroSubtitle, { color: mutedInk }]}
          >
            {hero.subtitle.trim()}
          </Text>
        ) : null}
        <View style={styles.ctaRow}>
          <View
            style={[
              styles.ctaPrimary,
              {
                backgroundColor: accent,
                borderRadius: radius === 4 ? 4 : 9,
              },
            ]}
          >
            <Text style={styles.ctaPrimaryText}>{ctaText}</Text>
          </View>
          {!compact && hero?.ctaSecondaryText?.trim() ? (
            <View
              style={[
                styles.ctaSecondary,
                {
                  borderColor: isDarkCanvas ? '#475569' : '#CBD5E1',
                  borderRadius: radius === 4 ? 4 : 9,
                },
              ]}
            >
              <Text style={[styles.ctaSecondaryText, { color: ink }]}>
                {hero.ctaSecondaryText.trim()}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {!compact ? (
        <View style={styles.cardsGrid}>
          {[0, 1, 2].map((idx) => (
            <View
              key={idx}
              style={[
                styles.mockCard,
                {
                  backgroundColor: cardBg,
                  borderColor: isDarkCanvas ? '#334155' : '#E2E8F0',
                  borderRadius: radius,
                },
              ]}
            >
              <View
                style={[
                  styles.mockThumb,
                  {
                    aspectRatio: isPortrait ? 3 / 4 : 4 / 3,
                    backgroundColor: isDarkCanvas ? '#0F172A' : '#F1F5F9',
                    borderRadius: Math.max(4, radius - 4),
                  },
                ]}
              >
                {isMarket && idx === 0 ? (
                  <View
                    style={[styles.offerTag, { backgroundColor: '#EF4444' }]}
                  >
                    <Text style={styles.offerTagText}>-20%</Text>
                  </View>
                ) : isServiceFocus ? (
                  <Ionicons name="cut-outline" size={14} color={accent} />
                ) : (
                  <Ionicons
                    name={
                      resolvedStyle === 'beauty'
                        ? 'sparkles-outline'
                        : 'cube-outline'
                    }
                    size={14}
                    color={mutedInk}
                  />
                )}
              </View>
              <View
                style={[
                  styles.mockLineLg,
                  { backgroundColor: isDarkCanvas ? '#334155' : '#E2E8F0' },
                ]}
              />
              <View style={styles.mockPriceRow}>
                <View
                  style={[styles.mockPrice, { backgroundColor: `${accent}88` }]}
                />
                {!isCatalogOnly ? (
                  <View
                    style={[styles.mockAdd, { backgroundColor: accent }]}
                  >
                    <Ionicons
                      name={isServiceFocus ? 'calendar' : 'add'}
                      size={10}
                      color="#fff"
                    />
                  </View>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Miniatura visual tipo wireframe para distinguir cada plantilla en Apariencia. */
export function TemplateWireframeThumb({
  styleId,
  accent,
  active,
}: {
  styleId: StorefrontStyle;
  accent: string;
  active?: boolean;
}) {
  const dark = darkThemeStyles.has(styleId);
  const portrait = styleId === 'fashion' || styleId === 'beauty';
  const service = styleId === 'services' || styleId === 'barber';
  const catalogOnly = styleId === 'catalog-basic';
  const bg = dark ? '#0F172A' : '#F8FAFC';
  const line = dark ? '#334155' : '#CBD5E1';

  return (
    <View
      style={[
        thumbStyles.box,
        {
          backgroundColor: bg,
          borderColor: active ? accent : dark ? '#334155' : '#E2E8F0',
        },
      ]}
    >
      <View
        style={[
          thumbStyles.header,
          { backgroundColor: dark ? '#1E293B' : '#FFFFFF' },
        ]}
      >
        <View style={[thumbStyles.dot, { backgroundColor: accent }]} />
        <View style={[thumbStyles.bar, { backgroundColor: line }]} />
      </View>
      <View style={thumbStyles.hero}>
        <View
          style={[
            thumbStyles.pill,
            { backgroundColor: accent },
          ]}
        />
        <View style={[thumbStyles.titleBar, { backgroundColor: dark ? '#E2E8F0' : '#475569' }]} />
      </View>
      <View style={thumbStyles.row}>
        {[0, 1].map((i) => (
          <View
            key={i}
            style={[
              thumbStyles.card,
              {
                height: portrait ? 24 : 18,
                backgroundColor: dark ? '#1E293B' : '#FFFFFF',
                borderColor: line,
              },
            ]}
          >
            <View
              style={[
                thumbStyles.miniAccent,
                {
                  backgroundColor: service
                    ? accent
                    : catalogOnly
                      ? line
                      : `${accent}55`,
                },
              ]}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  frame: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  browserBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dotsRow: { flexDirection: 'row', gap: 4 },
  chromeDot: { width: 7, height: 7, borderRadius: 4 },
  addressPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  addressText: { fontSize: 10, fontWeight: '600', flex: 1 },
  styleTag: { fontSize: 10, fontWeight: '800' },
  topStrip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignItems: 'center',
  },
  topStripText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  logoImg: { width: 28, height: 28 },
  logoFallback: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLetter: { fontSize: 13, fontWeight: '900' },
  brandName: { fontSize: 13, fontWeight: '800' },
  brandSlogan: { fontSize: 10 },
  headerIcons: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  heroArea: { padding: 12, gap: 6 },
  badgePill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '800' },
  heroTitle: { fontSize: 15, fontWeight: '800', lineHeight: 20 },
  heroSubtitle: { fontSize: 11, lineHeight: 15 },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  ctaPrimary: { paddingHorizontal: 12, paddingVertical: 7 },
  ctaPrimaryText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  ctaSecondary: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  ctaSecondaryText: { fontSize: 11, fontWeight: '700' },
  cardsGrid: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  mockCard: {
    flex: 1,
    borderWidth: 1,
    padding: 6,
    gap: 5,
  },
  mockThumb: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  offerTag: {
    position: 'absolute',
    top: 3,
    left: 3,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  offerTagText: { color: '#fff', fontSize: 8, fontWeight: '900' },
  mockLineLg: { height: 6, width: '78%', borderRadius: 3 },
  mockPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mockPrice: { height: 7, width: '50%', borderRadius: 3 },
  mockAdd: {
    width: 16,
    height: 16,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const thumbStyles = StyleSheet.create({
  box: {
    width: 68,
    height: 58,
    borderRadius: 10,
    borderWidth: 1.5,
    overflow: 'hidden',
    padding: 4,
    gap: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    padding: 2,
    borderRadius: 4,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  bar: { flex: 1, height: 3, borderRadius: 2 },
  hero: { gap: 2, paddingHorizontal: 1 },
  pill: { width: 16, height: 3, borderRadius: 2 },
  titleBar: { width: '75%', height: 4, borderRadius: 2 },
  row: { flexDirection: 'row', gap: 3, marginTop: 'auto' },
  card: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 4,
    padding: 2,
    justifyContent: 'flex-end',
  },
  miniAccent: { width: '100%', height: 4, borderRadius: 2 },
});
