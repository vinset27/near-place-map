import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppTheme } from '../../services/settingsTheme';
import { authMe } from '../../services/auth';
import { useCurrentLocation } from '../../stores/useLocationStore';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { createUserEvent } from '../../services/userEventsApi';

export default function UserEventCreateScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const t = useAppTheme();
  const params = useLocalSearchParams<{ kind?: string }>();
  const kind = (params.kind === 'meet' ? 'meet' : 'party') as 'party' | 'meet';
  const loc = useCurrentLocation();

  const { data: me } = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => authMe(),
    staleTime: 1000 * 20,
    retry: false,
  });
  const isAuthed = !!me;
  const isEmailVerified = !!me && (me as any)?.emailVerified !== false;

  // Centralize verification UI on /verify-email only.
  useEffect(() => {
    if (isAuthed && !isEmailVerified) {
      router.replace('/verify-email');
    }
  }, [isAuthed, isEmailVerified, router]);

  const titlePreset = kind === 'party' ? 'Soirée' : 'Point de rencontre';
  const [title, setTitle] = useState(titlePreset);
  const [note, setNote] = useState('');
  const [lat, setLat] = useState<number>(loc.lat);
  const [lng, setLng] = useState<number>(loc.lng);

  const startsAt = useMemo(() => {
    // default: +2h
    return new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  }, []);

  const canSubmit = isAuthed && isEmailVerified && title.trim().length >= 3;

  const submit = async () => {
    if (!isAuthed) {
      router.replace('/login');
      return;
    }
    if (!canSubmit) return;
    const ok = await new Promise<boolean>((resolve) => {
      Alert.alert('Publier', 'Publier cette annonce ?', [
        { text: 'Annuler', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Publier', style: 'default', onPress: () => resolve(true) },
      ]);
    });
    if (!ok) return;

    // NOTE: pour le moment c'est un "user event" local (AsyncStorage).
    // ✅ Maintenant: publication backend (visible sur la carte).
    await createUserEvent({
      kind,
      title: title.trim(),
      startsAt,
      description: note.trim() || undefined,
      lat,
      lng,
    });
    await qc.invalidateQueries({ queryKey: ['user-events'] }).catch(() => {});
    Alert.alert('En attente', 'Ta soirée est en attente de validation admin avant d’apparaître sur la carte.', [
      { text: 'OK', onPress: () => router.replace('/user-events-my') },
    ]);
  };

  const isExpoGo = (Constants as any)?.appOwnership === 'expo';
  const useGoogleProvider = Platform.OS === 'android' || (Platform.OS === 'ios' && !isExpoGo);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]}>
      <View style={[styles.header, { backgroundColor: t.card, borderBottomColor: t.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: t.input, borderColor: t.border }]}>
          <Text style={[styles.backText, { color: t.text }]}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: t.text, transform: [{ scale: t.textScale }] }]}>
            {kind === 'party' ? 'Organiser une soirée' : 'Créer un point de rencontre'}
          </Text>
          <Text style={[styles.sub, { color: t.muted, transform: [{ scale: t.textScale }] }]}>
            Connexion requise • position: {loc.lat.toFixed(3)}, {loc.lng.toFixed(3)}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        {!isAuthed && (
          <View style={[styles.box, { backgroundColor: t.card, borderColor: t.border }]}>
            <Text style={[styles.boxTitle, { color: t.text }]}>Compte requis</Text>
            <Text style={[styles.boxText, { color: t.muted }]}>Inscris-toi / connecte-toi pour publier une soirée.</Text>
            <TouchableOpacity style={[styles.primary, { backgroundColor: t.primary }]} onPress={() => router.replace('/login')}>
              <Text style={styles.primaryText}>Se connecter</Text>
            </TouchableOpacity>
          </View>
        )}

        {isAuthed && !isEmailVerified && (
          <View style={[styles.box, { backgroundColor: t.card, borderColor: t.border }]}>
            <Text style={[styles.boxTitle, { color: t.text }]}>Email non vérifié</Text>
            <Text style={[styles.boxText, { color: t.muted }]}>Redirection vers la page de vérification…</Text>
          </View>
        )}

        <View style={[styles.box, { backgroundColor: t.card, borderColor: t.border }]}>
          <Text style={[styles.label, { color: t.muted }]}>Titre</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Ex: Soirée Afrobeat ce soir"
            placeholderTextColor={t.muted}
            style={[styles.input, { backgroundColor: t.input, borderColor: t.border, color: t.text }]}
          />

          <Text style={[styles.label, { color: t.muted, marginTop: 12 }]}>Note (optionnel)</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Dress code, heure, consignes..."
            placeholderTextColor={t.muted}
            style={[styles.input, { backgroundColor: t.input, borderColor: t.border, color: t.text, height: 90 }]}
            multiline
          />

          <Text style={[styles.label, { color: t.muted, marginTop: 12 }]}>Localisation (obligatoire)</Text>
          <View style={[styles.mapWrap, { borderColor: t.border }]}>
            <MapView
              provider={useGoogleProvider ? PROVIDER_GOOGLE : undefined}
              style={StyleSheet.absoluteFill}
              initialRegion={{
                latitude: lat,
                longitude: lng,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              onPress={(e) => {
                const c = e.nativeEvent.coordinate;
                setLat(c.latitude);
                setLng(c.longitude);
              }}
              rotateEnabled={false}
              pitchEnabled={false}
            >
              <Marker coordinate={{ latitude: lat, longitude: lng }} draggable onDragEnd={(e) => {
                const c = e.nativeEvent.coordinate;
                setLat(c.latitude);
                setLng(c.longitude);
              }} />
            </MapView>
          </View>
          <Text style={{ color: t.muted, fontWeight: '800' }}>
            {lat.toFixed(5)}, {lng.toFixed(5)}
          </Text>
        </View>

        <TouchableOpacity disabled={!canSubmit} style={[styles.primary, { backgroundColor: t.primary }, !canSubmit && { opacity: 0.5 }]} onPress={submit}>
          <Text style={styles.primaryText}>Publier</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, flexDirection: 'row', gap: 12, borderBottomWidth: 1 },
  backBtn: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  backText: { fontWeight: '900', fontSize: 18 },
  title: { fontWeight: '950', fontSize: 16 },
  sub: { marginTop: 4, fontWeight: '800', fontSize: 12 },
  box: { borderRadius: 18, borderWidth: 1, padding: 14, marginBottom: 12, gap: 10 },
  boxTitle: { fontWeight: '950', fontSize: 14 },
  boxText: { fontWeight: '800', fontSize: 12, lineHeight: 16 },
  label: { fontWeight: '900', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.3 },
  input: { marginTop: 8, borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 12, fontWeight: '800' },
  mapWrap: { height: 170, borderRadius: 18, overflow: 'hidden', borderWidth: 1, marginTop: 10, marginBottom: 10 },
  primary: { marginTop: 10, borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '950' },
});


