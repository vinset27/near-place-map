import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Image, ActivityIndicator } from 'react-native';
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
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { uploadUserEventPhoto } from '../../services/userEventMedia';

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
  const [ageMin, setAgeMin] = useState('');
  const [lat, setLat] = useState<number>(loc.lat);
  const [lng, setLng] = useState<number>(loc.lng);
  const [pickedPhotos, setPickedPhotos] = useState<Array<{ uri: string; fileName: string; mimeType: string; size?: number | null }>>([]);
  const [uploading, setUploading] = useState(false);

  const startsAt = useMemo(() => {
    // default: +2h
    return new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  }, []);

  const canSubmit = isAuthed && isEmailVerified && title.trim().length >= 3 && !uploading;

  const pickImages = async () => {
    if (!isAuthed) return;
    if (pickedPhotos.length >= 6) {
      Alert.alert('Limite atteinte', 'Maximum 6 photos.');
      return;
    }
    const remaining = 6 - pickedPhotos.length;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.9,
    });
    if (res.canceled) return;
    const assets = (res.assets || []) as any[];
    const next: Array<{ uri: string; fileName: string; mimeType: string; size?: number | null }> = [];
    for (const a of assets) {
      const uri = String(a.uri || '');
      if (!uri) continue;
      const mimeType = String(a.mimeType || 'image/jpeg');
      const fileName = String(a.fileName || `photo-${Date.now()}.jpg`);
      const size = typeof a.fileSize === 'number' ? a.fileSize : (await FileSystem.getInfoAsync(uri, { size: true }).then((i) => (i as any)?.size).catch(() => null));
      if (typeof size === 'number' && size > 10 * 1024 * 1024) {
        Alert.alert('Photo trop lourde', `Chaque photo doit faire maximum 10 Mo.\n\n"${fileName}" fait ${(size / (1024 * 1024)).toFixed(1)} Mo.`);
        continue;
      }
      next.push({ uri, fileName, mimeType, size });
      if (pickedPhotos.length + next.length >= 6) break;
    }
    setPickedPhotos((p) => [...p, ...next].slice(0, 6));
  };

  const removePhoto = (uri: string) => setPickedPhotos((p) => p.filter((x) => x.uri !== uri));

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

    setUploading(true);
    try {
      const urls: string[] = [];
      for (const p of pickedPhotos) {
        const url = await uploadUserEventPhoto({ localUri: p.uri, contentType: p.mimeType, fileName: p.fileName });
        urls.push(url);
      }
      const age = ageMin.trim() ? Number(ageMin.trim()) : undefined;
      if (ageMin.trim() && (!Number.isFinite(age) || age! < 0 || age! > 99)) {
        throw new Error("Âge requis invalide (0–99).");
      }
      await createUserEvent({
        kind,
        title: title.trim(),
        startsAt,
        description: note.trim() || undefined,
        photos: urls.length ? urls : undefined,
        ageMin: typeof age === 'number' ? age : undefined,
        lat,
        lng,
      });
    } catch (e: any) {
      Alert.alert('Soirée', String(e?.response?.data?.message || e?.message || 'Erreur upload'));
      return;
    } finally {
      setUploading(false);
    }
    // Important: refetchOnMount is disabled globally; we must invalidate the specific keys.
    await qc.invalidateQueries({ queryKey: ['user-events'] }).catch(() => {});
    await qc.invalidateQueries({ queryKey: ['user-events-me'] }).catch(() => {});
    await qc.invalidateQueries({ queryKey: ['admin-pending'] }).catch(() => {});
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

          <Text style={[styles.label, { color: t.muted, marginTop: 12 }]}>Âge requis (optionnel)</Text>
          <TextInput
            value={ageMin}
            onChangeText={setAgeMin}
            placeholder="Ex: 18"
            placeholderTextColor={t.muted}
            keyboardType="number-pad"
            style={[styles.input, { backgroundColor: t.input, borderColor: t.border, color: t.text }]}
          />

          <Text style={[styles.label, { color: t.muted, marginTop: 12 }]}>Photos (optionnel)</Text>
          <Text style={{ color: t.muted, fontWeight: '800' }}>Max 6 photos • 10 Mo/photo</Text>
          <TouchableOpacity
            style={[styles.pickBtn, { backgroundColor: t.input, borderColor: t.border }]}
            onPress={pickImages}
            activeOpacity={0.9}
          >
            <Text style={{ color: t.text, fontWeight: '950' }}>Choisir des photos ({pickedPhotos.length}/6)</Text>
          </TouchableOpacity>
          {pickedPhotos.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingTop: 8 }}>
              {pickedPhotos.map((p) => (
                <View key={p.uri} style={{ position: 'relative' }}>
                  <Image source={{ uri: p.uri }} style={styles.thumb} />
                  <TouchableOpacity
                    onPress={() => removePhoto(p.uri)}
                    style={[styles.thumbX, { backgroundColor: 'rgba(0,0,0,0.55)' }]}
                  >
                    <Text style={{ color: '#fff', fontWeight: '950' }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

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
          {uploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Publier</Text>}
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
  pickBtn: { marginTop: 8, borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 12, alignItems: 'center' },
  thumb: { width: 92, height: 92, borderRadius: 18, backgroundColor: '#111827' },
  thumbX: { position: 'absolute', top: 6, right: 6, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  primary: { marginTop: 10, borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '950' },
});


