import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View, Text, Switch, TouchableOpacity } from 'react-native';
import { useAppTheme } from '../../services/settingsTheme';
import { Divider, InlineToast, SettingsRow, SettingsScreenShell, SettingsSection } from '../../components/Settings/SettingsPrimitives';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { getNotificationPermissions, openOsNotificationSettings, registerForExpoPushToken, scheduleTestNotification } from '../../services/notifications';

export default function SettingsNotifications() {
  const t = useAppTheme();
  const prefs = useSettingsStore((s) => s.notifications);
  const setNotif = useSettingsStore((s) => s.setNotification);
  const [toast, setToast] = useState<string | null>(null);
  const [perm, setPerm] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 1400);
    return () => clearTimeout(id);
  }, [toast]);

  const toggle = (key: keyof typeof prefs) => (v: boolean) => {
    setNotif(key, v);
    setToast('Sauvegardé.');
  };

  useEffect(() => {
    let alive = true;
    getNotificationPermissions().then((p) => {
      if (!alive) return;
      setPerm(p);
    });
    return () => {
      alive = false;
    };
  }, []);

  const permLabel = useMemo(() => {
    if (!perm) return '—';
    if (perm?.granted) return 'Autorisé';
    // iOS can be 'denied' or 'undetermined'
    const s = String(perm?.status || '').toLowerCase();
    if (s.includes('denied')) return 'Refusé';
    if (s.includes('undetermined')) return 'Non demandé';
    return 'Non autorisé';
  }, [perm]);

  return (
    <SettingsScreenShell title="Notifications">
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {!!toast && <InlineToast text={toast} />}

        <SettingsSection title="Configuration (build)">
          <SettingsRow
            icon="✅"
            title="Statut permissions"
            subtitle={`Système: ${permLabel}`}
            onPress={openOsNotificationSettings}
          />
          <Divider />
          <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
            <Text style={{ color: t.muted, fontWeight: '800', lineHeight: 18 }}>
              Pour le build: Android 13 nécessite une permission runtime. Si c’est refusé, ouvre les réglages.
            </Text>
          </View>
        </SettingsSection>

        <SettingsSection title="Général">
          <SettingsRow
            icon="🔔"
            title="Notifications générales"
            subtitle="Activer ou désactiver toutes les notifications"
            right={<Switch value={prefs.enabled} onValueChange={toggle('enabled')} />}
          />
          <Divider />
          <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
            <Text style={{ color: t.muted, fontWeight: '800', lineHeight: 18 }}>
              Astuce: vous pouvez aussi gérer les permissions dans “Privacy & Security”.
            </Text>
          </View>
        </SettingsSection>

        <SettingsSection title="Détails">
          <SettingsRow
            icon="📈"
            title="Activité établissement"
            subtitle="Vues, interactions, nouveautés"
            right={<Switch value={prefs.establishmentActivity && prefs.enabled} onValueChange={toggle('establishmentActivity')} disabled={!prefs.enabled} />}
            disabled={!prefs.enabled}
          />
          <Divider />
          <SettingsRow
            icon="🛠️"
            title="Mises à jour système"
            subtitle="Infos importantes de l’application"
            right={<Switch value={prefs.systemUpdates && prefs.enabled} onValueChange={toggle('systemUpdates')} disabled={!prefs.enabled} />}
            disabled={!prefs.enabled}
          />
          <Divider />
          <SettingsRow
            icon="✨"
            title="Conseils & recommandations"
            subtitle="Astuces pour mieux utiliser le dashboard"
            right={<Switch value={prefs.tips && prefs.enabled} onValueChange={toggle('tips')} disabled={!prefs.enabled} />}
            disabled={!prefs.enabled}
          />
        </SettingsSection>

        <SettingsSection title="Tester">
          <SettingsRow
            icon="🧪"
            title="Envoyer une notification test"
            subtitle="Vérifie que le téléphone reçoit bien les notifications"
            onPress={async () => {
              if (!prefs.enabled) {
                setToast('Activez d’abord “Notifications générales”.');
                return;
              }
              setBusy(true);
              try {
                await scheduleTestNotification();
                const tkn = await registerForExpoPushToken().catch(() => null);
                if (tkn) setToken(tkn);
                setToast('Notification envoyée.');
              } catch (e: any) {
                setToast(String(e?.message || 'Impossible'));
              } finally {
                setBusy(false);
              }
            }}
            disabled={!prefs.enabled || busy}
          />
          {!!token && (
            <>
              <Divider />
              <View style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
                <Text style={{ color: t.muted, fontWeight: '900', marginBottom: 6 }}>Expo push token</Text>
                <Text style={{ color: t.text, fontWeight: '800' }} selectable>
                  {token}
                </Text>
                <TouchableOpacity onPress={openOsNotificationSettings} style={{ marginTop: 10 }}>
                  <Text style={{ color: t.primary, fontWeight: '900' }}>Ouvrir les réglages notifications</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </SettingsSection>
      </ScrollView>
    </SettingsScreenShell>
  );
}


