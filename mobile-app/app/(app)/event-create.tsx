import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentLocation } from '../../stores/useLocationStore';
import { useStableQueryOrigin } from '../../services/queryOrigin';
import type { Establishment } from '../../types/establishment';
import type { EventCategory } from '../../services/events';
import { createEvent } from '../../services/events';
import { PlaceImage } from '../../components/UI/PlaceImage';
import { authMe } from '../../services/auth';
import { fetchMyEstablishments } from '../../services/pro';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import { uploadEventMedia } from '../../services/eventMedia';
import * as FileSystem from 'expo-file-system';

function presetIso(kind: '2h' | 'tonight' | 'tomorrow'): string {
  const now = new Date();
  if (kind === '2h') return new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
  if (kind === 'tomorrow') return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  // tonight: set to 20:00 local
  const d = new Date(now);
  d.setHours(20, 0, 0, 0);
  if (d.getTime() < now.getTime()) d.setDate(d.getDate() + 1);
  return d.toISOString();
}

export default function EventCreateScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const origin = useStableQueryOrigin(useCurrentLocation());

  const [q, setQ] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<EventCategory>('event');
  const [startsAt, setStartsAt] = useState<string>(() => presetIso('2h'));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [videoUrls, setVideoUrls] = useState<string[]>([]);
  const [eventLat, setEventLat] = useState<number>(origin.lat);
  const [eventLng, setEventLng] = useState<number>(origin.lng);

  const { data: me } = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => authMe(),
    staleTime: 1000 * 20,
    retry: false,
  });
  const isEstablishment = !!me && (me as any)?.role === 'establishment' && !!(me as any)?.profileCompleted;

  const { data: establishments, isLoading } = useQuery({
    queryKey: ['event-create-my-establishments', q],
    enabled: isEstablishment,
    queryFn: async () => {
      const rows = await fetchMyEstablishments();
      const filtered = String(q || '').trim()
        ? rows.filter((e: any) => `${e.name || ''} ${e.address || ''} ${e.commune || ''}`.toLowerCase().includes(String(q).toLowerCase()))
        : rows;
      return filtered as any[];
    },
    staleTime: 1000 * 20,
    retry: false,
  });

  const selected = useMemo(
    () => (establishments || []).find((e) => String(e.id) === String(selectedId)) || null,
    [establishments, selectedId],
  );

  const canSubmit = !!selected && title.trim().length >= 3 && !saving;
  const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB

  const submit = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await createEvent({
        establishmentId: selected.id,
        title: title.trim(),
        category,
        startsAt,
        coverUrl: photoUrls[0] || undefined,
        photos: photoUrls.length ? photoUrls : undefined,
        videos: videoUrls.length ? videoUrls : undefined,
        lat: eventLat,
        lng: eventLng,
      });
      await qc.invalidateQueries({ queryKey: ['pro-my-events'] });
      Alert.alert('En attente', 'Ton événement est en attente de validation admin avant publication.', [{ text: 'OK' }]);
      router.replace('/business-dashboard');
    } finally {
      setSaving(false);
    }
  };

  const rows = (establishments || []) as any[];

  const isExpoGo = (Constants as any)?.appOwnership === 'expo';
  const useGoogleProvider = Platform.OS === 'android' || (Platform.OS === 'ios' && !isExpoGo);
  const selectedLat = Number((selected as any)?.lat);
  const selectedLng = Number((selected as any)?.lng);
  const canShowMap = Number.isFinite(selectedLat) && Number.isFinite(selectedLng);

  // When user selects an establishment, default the event pin to that location.
  useEffect(() => {
    if (!Number.isFinite(selectedLat) || !Number.isFinite(selectedLng)) return;
    setEventLat(selectedLat);
    setEventLng(selectedLng);
  }, [selectedLat, selectedLng]);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Créer un événement</Text>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
        >
          <View style={styles.card}>
            <Text style={styles.label}>Titre</Text>
            <TextInput value={title} onChangeText={setTitle} placeholder="Ex: Soirée grillades + DJ" placeholderTextColor="#94a3b8" style={styles.input} />

            <Text style={[styles.label, { marginTop: 12 }]}>Type</Text>
            <View style={styles.row}>
              {(['event', 'promo', 'live'] as EventCategory[]).map((c) => (
                <TouchableOpacity key={c} onPress={() => setCategory(c)} style={[styles.chip, category === c && styles.chipActive]}>
                  <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { marginTop: 12 }]}>Quand</Text>
            <View style={styles.row}>
              <TouchableOpacity onPress={() => setStartsAt(presetIso('2h'))} style={styles.chip}>
                <Text style={styles.chipText}>Dans 2h</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setStartsAt(presetIso('tonight'))} style={styles.chip}>
                <Text style={styles.chipText}>Ce soir</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setStartsAt(presetIso('tomorrow'))} style={styles.chip}>
                <Text style={styles.chipText}>Demain</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.hint}>Début: {new Date(startsAt).toLocaleString()}</Text>

            <Text style={[styles.label, { marginTop: 12 }]}>Médias</Text>
            <Text style={styles.hint}>Ajoute plusieurs photos/vidéos (upload sur ton bucket R2).</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <TouchableOpacity
                activeOpacity={0.9}
                disabled={!isEstablishment || mediaUploading}
                onPress={async () => {
                  if (!isEstablishment) return;
                  setMediaUploading(true);
                  try {
                    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                    if (!perm.granted) {
                      Alert.alert('Permission', 'Autorise l’accès à la galerie pour ajouter des médias.');
                      return;
                    }
                    const picked = await ImagePicker.launchImageLibraryAsync({
                      mediaTypes: ImagePicker.MediaTypeOptions.All,
                      allowsMultipleSelection: true,
                      quality: 0.92,
                      videoMaxDuration: 60,
                    });
                    if (picked.canceled) return;
                    const tooLarge: string[] = [];
                    for (const a of picked.assets) {
                      const uri = String((a as any).uri || '');
                      if (!uri) continue;
                      const fileName =
                        String((a as any).fileName || '').trim() ||
                        uri.split('/').pop() ||
                        (String((a as any).type || 'media') === 'video' ? 'video.mp4' : 'photo.jpg');
                      const mime =
                        String((a as any).mimeType || '').trim() ||
                        (String((a as any).type || '') === 'video' ? 'video/mp4' : 'image/jpeg');

                      const isVideo = String((a as any).type || '').toLowerCase() === 'video' || mime.startsWith('video/');
                      let sizeBytes = Number((a as any).fileSize);
                      if (!Number.isFinite(sizeBytes)) {
                        const info = await FileSystem.getInfoAsync(uri, { size: true }).catch(() => null as any);
                        const s = Number(info?.size);
                        if (Number.isFinite(s)) sizeBytes = s;
                      }
                      if (isVideo && Number.isFinite(sizeBytes) && sizeBytes > MAX_VIDEO_BYTES) {
                        tooLarge.push(`${fileName} (${Math.ceil(sizeBytes / (1024 * 1024))}MB)`);
                        continue;
                      }

                      const url = await uploadEventMedia({ localUri: uri, contentType: mime, fileName });
                      if (mime.startsWith('video')) setVideoUrls((s) => [...s, url]);
                      else setPhotoUrls((s) => [...s, url]);
                    }

                    if (tooLarge.length) {
                      Alert.alert(
                        'Vidéo trop lourde',
                        `Max 100MB par vidéo.\n\nRefusées:\n- ${tooLarge.slice(0, 6).join('\n- ')}${tooLarge.length > 6 ? `\n… +${tooLarge.length - 6}` : ''}`,
                      );
                    }
                  } catch (e: any) {
                    Alert.alert('Upload', String(e?.message || 'Erreur upload'));
                  } finally {
                    setMediaUploading(false);
                  }
                }}
                style={[styles.chip, { alignSelf: 'flex-start' }, (mediaUploading || !isEstablishment) && { opacity: 0.6 }]}
              >
                <Text style={styles.chipText}>{mediaUploading ? 'Upload…' : 'Ajouter médias'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.9}
                disabled={mediaUploading || (!photoUrls.length && !videoUrls.length)}
                onPress={() => {
                  setPhotoUrls([]);
                  setVideoUrls([]);
                }}
                style={[styles.chip, { alignSelf: 'flex-start' }, (!photoUrls.length && !videoUrls.length) && { opacity: 0.6 }]}
              >
                <Text style={styles.chipText}>Vider</Text>
              </TouchableOpacity>
            </View>

            {(photoUrls.length > 0 || videoUrls.length > 0) && (
              <View style={{ marginTop: 10 }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 16 }}>
                  {photoUrls.map((u) => (
                    <View key={u} style={{ width: 86, height: 86, borderRadius: 16, overflow: 'hidden', backgroundColor: '#e2e8f0' }}>
                      <Image source={{ uri: u }} style={{ width: '100%', height: '100%' }} />
                    </View>
                  ))}
                  {videoUrls.map((u) => (
                    <View
                      key={u}
                      style={{
                        width: 86,
                        height: 86,
                        borderRadius: 16,
                        overflow: 'hidden',
                        backgroundColor: '#0b1220',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: '#fff', fontWeight: '900' }}>VIDEO</Text>
                    </View>
                  ))}
                </ScrollView>
                <Text style={styles.hint}>
                  {photoUrls.length} photo(s) • {videoUrls.length} vidéo(s)
                </Text>
              </View>
            )}
          </View>

          {canShowMap && (
            <View style={[styles.card, { marginTop: 0 }]}>
              <Text style={styles.label}>Localisation (carte)</Text>
              <Text style={styles.hint}>Choisis un point sur la carte (par défaut: établissement). Appuie sur la carte pour déplacer le pin.</Text>
              <View style={styles.mapWrap}>
                <MapView
                  provider={useGoogleProvider ? PROVIDER_GOOGLE : undefined}
                  style={StyleSheet.absoluteFill}
                  initialRegion={{
                    latitude: selectedLat,
                    longitude: selectedLng,
                    latitudeDelta: 0.02,
                    longitudeDelta: 0.02,
                  }}
                  rotateEnabled={false}
                  pitchEnabled={false}
                  onPress={(e) => {
                    const c = e.nativeEvent.coordinate;
                    setEventLat(c.latitude);
                    setEventLng(c.longitude);
                  }}
                >
                  <Marker
                    coordinate={{ latitude: eventLat, longitude: eventLng }}
                    draggable
                    onDragEnd={(e) => {
                      const c = e.nativeEvent.coordinate;
                      setEventLat(c.latitude);
                      setEventLng(c.longitude);
                    }}
                    title={String((selected as any)?.name || 'Événement')}
                    pinColor="#8b5cf6"
                  />
                  {Number.isFinite(origin?.lat) && Number.isFinite(origin?.lng) && (
                    <Marker coordinate={{ latitude: Number(origin.lat), longitude: Number(origin.lng) }} title="Vous" />
                  )}
                </MapView>
              </View>
            </View>
          )}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Choisir un établissement</Text>
            <View style={styles.searchBar}>
              <Text style={{ marginRight: 8 }}>🔎</Text>
              <TextInput value={q} onChangeText={setQ} placeholder="Rechercher..." placeholderTextColor="#94a3b8" style={styles.searchInput} />
            </View>
          </View>

          {!isEstablishment && (
            <View style={{ paddingVertical: 10 }}>
              <Text style={{ color: '#64748b', fontWeight: '700' }}>Profil Pro requis (onglet Pro).</Text>
            </View>
          )}

          {isEstablishment && isLoading && (
            <View style={{ paddingVertical: 10 }}>
              <Text style={{ color: '#64748b', fontWeight: '700' }}>Chargement…</Text>
            </View>
          )}

          {isEstablishment && !isLoading && rows.length === 0 && (
            <View style={{ paddingVertical: 10 }}>
              <Text style={{ color: '#64748b', fontWeight: '700' }}>Aucun établissement trouvé.</Text>
            </View>
          )}

          {rows.map((item: any) => {
            const active = String(item.id) === String(selectedId);
            const cover = (item.photos && item.photos.length ? item.photos[0] : null) || item.imageUrl;
            return (
              <TouchableOpacity
                key={String(item.id)}
                activeOpacity={0.9}
                onPress={() => setSelectedId(item.id)}
                style={[styles.pickRow, active && styles.pickRowActive, { marginBottom: 10 }]}
              >
                <PlaceImage uri={cover} id={item.id} name={item.name} category={item.category} style={styles.pickImg} textSize={20} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.pickTitle} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.pickSub} numberOfLines={1}>
                    {item.commune ? item.commune : item.address || '—'}
                  </Text>
                </View>
                <View style={[styles.radio, active && styles.radioActive]} />
              </TouchableOpacity>
            );
          })}

          <View style={styles.footerCard}>
            <View style={{ flex: 1 }}>
              {!!selected && <Text style={styles.footerHint}>Pour: {selected.name}</Text>}
              {!selected && <Text style={styles.footerHint}>Sélectionnez un établissement.</Text>}
            </View>
            <TouchableOpacity disabled={!canSubmit} onPress={submit} style={[styles.submit, !canSubmit && styles.submitDisabled]}>
              <Text style={[styles.submitText, !canSubmit && styles.submitTextDisabled]}>{saving ? '...' : 'Publier'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', gap: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 20, fontWeight: '900', color: '#0b1220' },
  headerTitle: { fontSize: 18, fontWeight: '950', color: '#0b1220' },
  card: { margin: 16, backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#e2e8f0', padding: 14 },
  label: { color: '#0b1220', fontWeight: '900', fontSize: 12, textTransform: 'uppercase' },
  input: { marginTop: 8, backgroundColor: '#f1f5f9', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: '#e2e8f0', color: '#0b1220', fontWeight: '800' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  chipActive: { backgroundColor: '#0b1220', borderColor: '#0b1220' },
  chipText: { color: '#475569', fontWeight: '900', fontSize: 12 },
  chipTextActive: { color: '#fff' },
  hint: { marginTop: 8, color: '#64748b', fontWeight: '700', fontSize: 12 },
  sectionHeader: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '950', color: '#0b1220', marginBottom: 10 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  searchInput: { flex: 1, color: '#0b1220', fontWeight: '800' },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  pickRowActive: { borderColor: 'rgba(37,99,235,0.5)', shadowColor: '#2563eb', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 8 }, elevation: 2 },
  pickImg: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#e2e8f0' },
  pickTitle: { color: '#0b1220', fontWeight: '950', fontSize: 14 },
  pickSub: { marginTop: 4, color: '#64748b', fontWeight: '800', fontSize: 12 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#cbd5e1' },
  radioActive: { borderColor: '#2563eb', backgroundColor: '#2563eb' },
  footerCard: { marginTop: 12, marginBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 },
  footerHint: { color: '#64748b', fontWeight: '800' },
  submit: { backgroundColor: '#2563eb', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  submitDisabled: { backgroundColor: '#cbd5e1' },
  submitText: { color: '#fff', fontWeight: '950' },
  submitTextDisabled: { color: '#475569' },
  mapWrap: { height: 180, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0', marginTop: 10 },
});



