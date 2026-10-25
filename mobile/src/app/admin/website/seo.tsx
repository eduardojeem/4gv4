import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { OfflineNotice, WebsiteGate } from '@/components/website/website-gate';
import { Field, Notice, SaveBar, Section, WebsiteScreen, useUnsavedChangesGuard } from '@/components/website/website-ui';
import { palette, usePalette } from '@/lib/palette';
import { saveCompanyInfo, saveWebsiteSettings, storeUrl, websiteErrorMessage } from '@/lib/website-admin';
import { useWebsite } from '@/lib/website-context';
import { heroIssues, isDirty, mergeSetting, type CompanyInfo, type HeroContent, type WebsiteSettings } from '@/lib/website-model';

/**
 * La tienda arma su título con el nombre del comercio y su descripción con el
 * subtítulo de la portada ([organizationSlug]/layout.tsx). No hay campos de SEO
 * aparte: acá se editan esos dos, que son los que de verdad usa Google.
 */
export default function SeoScreen() {
  return <WebsiteGate title="SEO">{(settings) => <SeoEditor settings={settings} />}</WebsiteGate>;
}

function SeoEditor({ settings }: { settings: WebsiteSettings }) {
  const colors = usePalette();
  const { applySaved } = useWebsite();
  const [name, setName] = useState<string | undefined>(undefined);
  const [subtitle, setSubtitle] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const company = useMemo(() => mergeSetting<CompanyInfo>(settings.company_info, { name }), [settings.company_info, name]);
  const hero = useMemo(() => mergeSetting<HeroContent>(settings.hero_content ?? {}, { subtitle }), [settings.hero_content, subtitle]);
  const companyDirty = isDirty(settings.company_info, company);
  const heroDirty = isDirty(settings.hero_content ?? {}, hero);
  const dirty = companyDirty || heroDirty;
  const title = company.name?.trim() || 'Tu tienda';
  const description = hero.subtitle?.trim() || `Conocé ${title} y lo que ofrece.`;
  const nameIssue = !company.name || company.name.trim().length < 2 ? 'El nombre debe tener al menos 2 caracteres.' : undefined;
  const subtitleIssue = heroIssues(hero).subtitle;

  const save = useCallback(async () => {
    if (nameIssue || subtitleIssue) {
      Alert.alert('Revisá los datos', [nameIssue, subtitleIssue].filter(Boolean).join('\n'));
      return false;
    }
    setSaving(true);
    try {
      if (heroDirty) {
        const persisted = await saveWebsiteSettings({ hero_content: hero });
        applySaved(persisted as Partial<WebsiteSettings>);
        setSubtitle(undefined);
      }
      if (companyDirty) {
        const result = await saveCompanyInfo(settings.company_info, { name });
        applySaved({ company_info: result ?? company });
        setName(undefined);
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return true;
    } catch (error) {
      Alert.alert('No pudimos guardar', websiteErrorMessage(error, 'No pudimos guardar los cambios. Revisá tu conexión e intentá nuevamente.'));
      return false;
    } finally {
      setSaving(false);
    }
  }, [nameIssue, subtitleIssue, heroDirty, hero, companyDirty, settings.company_info, name, company, applySaved]);

  useUnsavedChangesGuard(dirty && !saving, save);

  const url = storeUrl(company) ?? 'tu-tienda';
  return (
    <WebsiteScreen title="SEO" subtitle="Cómo aparece en buscadores" footer={<SaveBar dirty={dirty} saving={saving} onSave={() => void save()} />}>
      <OfflineNotice />
      <View style={[styles.google, { backgroundColor: colors.card, borderColor: colors.border }]} accessible accessibilityLabel="Vista previa en Google">
        <Text style={[styles.googleLabel, { color: colors.muted }]}>Así podría verse en Google</Text>
        <Text numberOfLines={1} style={styles.googleUrl}>{url.replace(/^https?:\/\//, '')}</Text>
        <Text numberOfLines={1} style={[styles.googleTitle, { color: palette.primary }]}>{title}</Text>
        <Text numberOfLines={2} style={[styles.googleText, { color: colors.muted }]}>{description}</Text>
      </View>
      <Notice text="Es una vista aproximada: cada buscador decide qué mostrar y no hay forma de asegurar una posición." />

      <Section title="Título" icon="text-outline">
        <Field label="Nombre comercial" value={company.name ?? ''} onChangeText={setName} maxLength={100} error={nameIssue} help="Es el título de tu tienda en buscadores y al compartir el enlace." />
      </Section>
      <Section title="Descripción" icon="document-text-outline">
        <Field label="Subtítulo de la portada" value={hero.subtitle ?? ''} onChangeText={setSubtitle} multiline maxLength={300} error={subtitleIssue}
          help="Se muestra en tu portada y es la descripción para Google. Ideal: una o dos frases (hasta 160 caracteres)." />
        <Text style={[styles.count, { color: (hero.subtitle?.length ?? 0) > 160 ? '#B45309' : colors.muted }]}>{hero.subtitle?.length ?? 0} / 160 recomendados</Text>
      </Section>
    </WebsiteScreen>
  );
}

const styles = StyleSheet.create({
  google: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 3 },
  googleLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  googleUrl: { fontSize: 12, color: '#15803D' },
  googleTitle: { fontSize: 18, fontWeight: '600' },
  googleText: { fontSize: 13 },
  count: { fontSize: 12, textAlign: 'right' },
});
