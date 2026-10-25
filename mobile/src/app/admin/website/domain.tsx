import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';

import { OfflineNotice, WebsiteGate } from '@/components/website/website-gate';
import { Field, Notice, SaveBar, Section, ToggleRow, WebsiteScreen, useUnsavedChangesGuard } from '@/components/website/website-ui';
import { SITE_URL } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';
import { saveCompanyInfo, websiteErrorMessage } from '@/lib/website-admin';
import { useWebsite } from '@/lib/website-context';
import {
  isActivatingPublication,
  isDirty,
  mergeSetting,
  publicStoreUrl,
  publicationIssues,
  slugIssue,
  type CompanyInfo,
  type WebsiteSettings,
} from '@/lib/website-model';

const confirm = (title: string, message: string, action: string) =>
  new Promise<boolean>((resolve) =>
    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: action, onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) }),
  );

export default function DomainScreen() {
  return <WebsiteGate title="Dirección y publicación">{(settings) => <DomainEditor settings={settings} />}</WebsiteGate>;
}

function DomainEditor({ settings }: { settings: WebsiteSettings }) {
  const colors = usePalette();
  const { applySaved } = useWebsite();
  const saved = settings.company_info;
  const [patch, setPatch] = useState<Partial<CompanyInfo>>({});
  const [saving, setSaving] = useState(false);
  const company = useMemo(() => mergeSetting<CompanyInfo>(saved, patch), [saved, patch]);
  const dirty = isDirty(saved, company);
  const slug = company.slug ?? '';
  const slugError = slug !== (saved.slug ?? '') ? slugIssue(slug) ?? undefined : undefined;
  const set = (next: Partial<CompanyInfo>) => setPatch((current) => ({ ...current, ...next }));
  const published = company.storefrontPublic === true;

  const save = useCallback(async () => {
    if (slugError) {
      Alert.alert('Revisá la dirección', slugError);
      return false;
    }
    const slugChanged = (patch.slug ?? saved.slug) !== saved.slug;
    if (slugChanged && !(await confirm('¿Cambiar la dirección?', `Tu tienda va a pasar a ${publicStoreUrl(SITE_URL, slug)?.replace(/^https?:\/\//, '')}. Los enlaces viejos redirigen a la nueva, pero conviene actualizar los que compartiste.`, 'Cambiar'))) return false;

    const activating = isActivatingPublication(saved, company);
    if (activating) {
      const issues = publicationIssues(company, settings.checkout?.commerceMode ?? 'cart');
      if (issues.length) {
        Alert.alert('Antes de publicar', issues.join('\n'));
        return false;
      }
      if (!(await confirm('¿Publicar tu tienda?', 'Cualquier persona con el enlace va a poder verla y hacer pedidos.', 'Publicar'))) return false;
    }
    setSaving(true);
    try {
      const result = await saveCompanyInfo(saved, patch, activating);
      // La publicación vive en la organización: se refleja lo que quedó.
      applySaved({ company_info: { ...(result ?? company), storefrontPublic: company.storefrontPublic, marketplacePublic: company.storefrontPublic === true && company.marketplacePublic === true } });
      setPatch({});
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return true;
    } catch (error) {
      Alert.alert('No pudimos guardar', websiteErrorMessage(error, 'No pudimos guardar los cambios. Revisá tu conexión e intentá nuevamente.'));
      return false;
    } finally {
      setSaving(false);
    }
  }, [slugError, patch, saved, slug, company, settings.checkout?.commerceMode, applySaved]);

  useUnsavedChangesGuard(dirty && !saving, save);

  const preview = publicStoreUrl(SITE_URL, slug);
  return (
    <WebsiteScreen title="Dirección y publicación" subtitle="Dónde y para quién está tu tienda" footer={<SaveBar dirty={dirty} saving={saving} onSave={() => void save()} />}>
      <OfflineNotice />
      <Section title="Dirección de tu tienda" icon="link-outline">
        <Text style={[styles.url, { color: palette.primary }]}>{preview ? preview.replace(/^https?:\/\//, '') : 'Sin dirección'}</Text>
        <Field label="Dirección (ruta)" value={slug} onChangeText={(value) => set({ slug: value.trim().toLowerCase() })} placeholder="mi-tienda" autoCapitalize="none" maxLength={50} error={slugError}
          help="Letras minúsculas, números y guiones. Algunas palabras están reservadas por la plataforma." />
      </Section>

      <Section title="Publicación" icon="eye-outline">
        <ToggleRow label="Tienda publicada" hint="Visible para cualquier persona con el enlace" value={published} onValueChange={(value) => set({ storefrontPublic: value, ...(value ? {} : { marketplacePublic: false }) })} />
        <ToggleRow label="Aparecer en el marketplace" hint="Tu tienda en el directorio de comercios" value={published && company.marketplacePublic === true} disabled={!published} onValueChange={(value) => set({ marketplacePublic: value })} />
        {!published ? <Notice tone="warning" text="Con la tienda sin publicar, quien abra el enlace ve un aviso de tienda cerrada." /> : null}
      </Section>

      <Section title="Dominio propio" icon="globe-outline">
        <Text style={[styles.muted, { color: colors.muted }]}>Usar un dominio propio (por ejemplo tutienda.com.py) todavía no está disponible. Tu tienda funciona con la dirección de arriba.</Text>
      </Section>
    </WebsiteScreen>
  );
}

const styles = StyleSheet.create({
  url: { fontSize: 15, fontWeight: '800' },
  muted: { fontSize: 13 },
});
