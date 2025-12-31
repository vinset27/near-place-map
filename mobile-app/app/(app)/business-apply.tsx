import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as ImagePicker from 'expo-image-picker';
import { useLocationStore, useCurrentLocation } from '../../stores/useLocationStore';
import { ESTABLISHMENT_CATEGORIES } from '../../types/establishment';
import { presignBusinessPhoto, uploadToPresignedPutUrl } from '../../services/businessPhotos';
import { submitBusinessApplication } from '../../services/establishments';
import { PlaceImage } from '../../components/UI/PlaceImage';
import { authMe } from '../../services/auth';
import { useAppTheme } from '../../services/settingsTheme';
import Constants from 'expo-constants';

type PickedPhoto = { uri: string; fileName: string; mimeType: string };

export default function BusinessApplyScreen() {
  const router = useRouter();
  const t = useAppTheme();
  // Pro requirement: account required before submitting
  // (backend enforces it too; we redirect early for UX)
  const { data: me, error: meError, isLoading: meLoading } = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => authMe(),
    staleTime: 1000 * 20,
    retry: false,
  });
  const isAuthed = !!me && !meError;
  const isEstablishment = !!me && (me as any)?.role === 'establishment' && !!(me as any)?.profileCompleted;
  const hasPermission = useLocationStore((s) => s.hasPermission);
  const rawUserLocation = useLocationStore((s) => s.userLocation);
  const fallbackLocation = useCurrentLocation();

  const base = rawUserLocation || fallbackLocation;

  const [draft, setDraft] = useState(() => ({
    name: '',
    category: 'restaurant',
    phone: '',
    address: '',
    commune: '',
    description: '',
    lat: base.lat,
    lng: base.lng,
    // Optional "pro" extras (not yet persisted server-side)
    instagram: '',
    whatsapp: '',
  }));

  const [pickedPhotos, setPickedPhotos] = useState<PickedPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ id: string; createdAt: string } | null>(null);

  const region = useMemo(
    () => ({
      latitude: draft.lat,
      longitude: draft.lng,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    }),
    [draft.lat, draft.lng],
  );

  // Satellite preview when app is in dark mode.
  // Note: PROVIDER_GOOGLE on iOS requires a dev build/standalone; in Expo Go, fall back to Apple Maps.
  const isExpoGo = (Constants as any)?.appOwnership === 'expo';
  const useGoogleProvider = Platform.OS === 'android' || (Platform.OS === 'ios' && !isExpoGo);
  const mapType = t.isDark ? 'satellite' : 'standard';

  const pick = async () => {
    setError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      setError('Permission photos refusée.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 8,
      quality: 0.85,
    });
    if (res.canceled) return;
    const next = (res.assets || [])
      .filter((a) => !!a.uri)
      .map((a) => ({
        uri: a.uri,
        fileName: a.fileName || `photo-${Date.now()}.jpg`,
        mimeType: a.mimeType || 'image/jpeg',
      }));
    setPickedPhotos(next);
  };

  const submit = async () => {
    setError(null);
    setSuccess(null);

    if (!isAuthed) {
      router.replace('/login');
      return;
    }
    if (!isEstablishment) {
      router.replace('/profile-establishment');
      return;
    }

    if (!draft.name.trim()) {
      setError("Le nom de l'établissement est requis.");
      return;
    }
    if (!draft.category) {
      setError('La catégorie est requise.');
      return;
    }

    if (!draft.phone.trim() || draft.phone.trim().length < 6) {
      setError('Le téléphone est requis.');
      return;
    }
    if (!Number.isFinite(draft.lat) || !Number.isFinite(draft.lng)) {
      setError('La localisation est requise.');
      return;
    }

    setLoading(true);
    try {
      const uploadedUrls: string[] = [];
      for (const p of pickedPhotos) {
        const presign = await presignBusinessPhoto({ fileName: p.fileName, contentType: p.mimeType });
        if (!presign.publicUrl) {
          throw new Error("Upload indisponible (R2 non configuré côté serveur).");
        }
        await uploadToPresignedPutUrl({
          putUrl: presign.putUrl,
          localUri: p.uri,
          contentType: p.mimeType,
        });
        uploadedUrls.push(presign.publicUrl);
      }

      const res = await submitBusinessApplication({
        name: draft.name.trim(),
        category: draft.category,
        phone: draft.phone.trim(),
        address: draft.address.trim() || undefined,
        commune: draft.commune.trim() || undefined,
        description: draft.description.trim() || undefined,
        photos: uploadedUrls.length ? uploadedUrls : undefined,
        lat: draft.lat,
        lng: draft.lng,
      });

      setSuccess({ id: res.id, createdAt: res.createdAt });
    } catch (e: any) {
      setError(String(e?.response?.data?.message || e?.message || 'Erreur réseau'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Déclarer mon établissement</Text>
          <Text style={styles.headerSub}>
            Validation admin obligatoire. Placez le point précisément.
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {meLoading && (
          <View style={styles.okBox}>
            <Text style={styles.okTitle}>Vérification du compte…</Text>
            <Text style={styles.okText}>Un instant.</Text>
          </View>
        )}
        {!meLoading && !isAuthed && (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Connexion requise</Text>
            <Text style={styles.errorText}>Connectez-vous pour soumettre un établissement.</Text>
            <TouchableOpacity style={[styles.submit, { marginTop: 12 }]} onPress={() => router.replace('/login')}>
              <Text style={styles.submitText}>Se connecter</Text>
            </TouchableOpacity>
          </View>
        )}
        {!meLoading && isAuthed && !isEstablishment && (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Profil Pro requis</Text>
            <Text style={styles.errorText}>Complétez le profil établissement avant de soumettre.</Text>
            <TouchableOpacity style={[styles.submit, { marginTop: 12 }]} onPress={() => router.replace('/profile-establishment')}>
              <Text style={styles.submitText}>Configurer</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Informations</Text>

          <Text style={styles.label}>Nom de l’établissement</Text>
          <TextInput
            value={draft.name}
            onChangeText={(v) => setDraft((d) => ({ ...d, name: v }))}
            placeholder="Ex: Chez Tante Awa"
            placeholderTextColor="#94a3b8"
            style={styles.input}
          />

          <Text style={[styles.label, { marginTop: 12 }]}>Type / Catégorie</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 8 }}>
            {ESTABLISHMENT_CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.chip, draft.category === c.id && styles.chipActive]}
                onPress={() => setDraft((d) => ({ ...d, category: c.id }))}
              >
                <Text style={[styles.chipText, draft.category === c.id && styles.chipTextActive]}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[styles.label, { marginTop: 12 }]}>Téléphone (obligatoire)</Text>
          <TextInput
            value={draft.phone}
            onChangeText={(v) => setDraft((d) => ({ ...d, phone: v }))}
            placeholder="+225 ..."
            placeholderTextColor="#94a3b8"
            style={styles.input}
          />

          <Text style={[styles.label, { marginTop: 12 }]}>Adresse (optionnel)</Text>
          <TextInput
            value={draft.address}
            onChangeText={(v) => setDraft((d) => ({ ...d, address: v }))}
            placeholder="Rue / quartier"
            placeholderTextColor="#94a3b8"
            style={styles.input}
          />

          <Text style={[styles.label, { marginTop: 12 }]}>Commune (optionnel)</Text>
          <TextInput
            value={draft.commune}
            onChangeText={(v) => setDraft((d) => ({ ...d, commune: v }))}
            placeholder="Cocody, Marcory…"
            placeholderTextColor="#94a3b8"
            style={styles.input}
          />

          <Text style={[styles.label, { marginTop: 12 }]}>Description (optionnel)</Text>
          <TextInput
            value={draft.description}
            onChangeText={(v) => setDraft((d) => ({ ...d, description: v }))}
            placeholder="Ambiance, spécialités, horaires…"
            placeholderTextColor="#94a3b8"
            style={[styles.input, { minHeight: 96 }]}
            multiline
          />

          <Text style={[styles.label, { marginTop: 12 }]}>WhatsApp (optionnel)</Text>
          <TextInput
            value={draft.whatsapp}
            onChangeText={(v) => setDraft((d) => ({ ...d, whatsapp: v }))}
            placeholder="+225 ..."
            placeholderTextColor="#94a3b8"
            style={styles.input}
          />

          <Text style={[styles.label, { marginTop: 12 }]}>Instagram (optionnel)</Text>
          <TextInput
            value={draft.instagram}
            onChangeText={(v) => setDraft((d) => ({ ...d, instagram: v }))}
            placeholder="@mon_etablissement"
            placeholderTextColor="#94a3b8"
            style={styles.input}
          />
        </View>

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>Localisation</Text>
            <TouchableOpacity
              style={styles.smallBtn}
              onPress={() => setDraft((d) => ({ ...d, lat: base.lat, lng: base.lng }))}
            >
              <Text style={styles.smallBtnText}>{hasPermission ? 'Ma position' : 'Position par défaut'}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>
            Précision: zoomez, puis appuyez sur la carte (ou faites glisser le marqueur) pour placer le point exactement.
          </Text>

          <View style={styles.miniMapWrap}>
            <MapView
              provider={useGoogleProvider ? PROVIDER_GOOGLE : undefined}
              style={styles.miniMap}
              initialRegion={region as any}
              mapType={mapType as any}
              onPress={(e) => {
                const c = e.nativeEvent.coordinate;
                setDraft((d) => ({ ...d, lat: c.latitude, lng: c.longitude }));
              }}
              onLongPress={(e) => {
                const c = e.nativeEvent.coordinate;
                setDraft((d) => ({ ...d, lat: c.latitude, lng: c.longitude }));
              }}
              showsUserLocation={hasPermission}
              showsMyLocationButton={false}
              rotateEnabled={false}
              pitchEnabled={false}
            >
              <Marker
                coordinate={{ latitude: draft.lat, longitude: draft.lng }}
                draggable
                onDragEnd={(e) => {
                  const c = e.nativeEvent.coordinate;
                  setDraft((d) => ({ ...d, lat: c.latitude, lng: c.longitude }));
                }}
                pinColor="#111827"
              />
            </MapView>
          </View>

          <Text style={styles.coords}>
            {draft.lat.toFixed(5)}, {draft.lng.toFixed(5)}
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>Photos</Text>
            <TouchableOpacity style={styles.smallBtn} onPress={pick}>
              <Text style={styles.smallBtnText}>Choisir</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>La 1ère photo servira de couverture dans les listes.</Text>

          {pickedPhotos.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 8, gap: 10 }}>
              {pickedPhotos.map((p) => (
                <TouchableOpacity
                  key={p.uri}
                  activeOpacity={0.9}
                  onPress={() => setPickedPhotos((arr) => arr.filter((x) => x.uri !== p.uri))}
                >
                  <PlaceImage uri={p.uri} id={p.uri} name={draft.name || 'Photo'} category={draft.category} style={styles.photo} textSize={18} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Impossible d’envoyer</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {!!success && (
          <View style={styles.okBox}>
            <Text style={styles.okTitle}>Demande envoyée</Text>
            <Text style={styles.okText}>Référence: {success.id}</Text>
          </View>
        )}

        <TouchableOpacity
          disabled={loading}
          style={[styles.submit, loading && { opacity: 0.75 }]}
          onPress={submit}
        >
          {loading ? <ActivityIndicator color="#0b1220" /> : <Text style={styles.submitText}>Envoyer la demande</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  backBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 20, fontWeight: '900', color: '#0b1220' },
  headerTitle: { fontSize: 16, fontWeight: '950', color: '#0b1220' },
  headerSub: { marginTop: 2, color: '#64748b', fontWeight: '700', fontSize: 12 },
  content: { padding: 16, paddingBottom: 120, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#e2e8f0', padding: 14 },
  sectionTitle: { color: '#0b1220', fontWeight: '950', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 10 },
  label: { color: '#0b1220', fontWeight: '900', fontSize: 12 },
  input: { marginTop: 8, backgroundColor: '#f1f5f9', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: '#e2e8f0', color: '#0b1220', fontWeight: '800' },
  chip: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0', marginRight: 8 },
  chipActive: { backgroundColor: '#0b1220', borderColor: '#0b1220' },
  chipText: { color: '#475569', fontWeight: '900', fontSize: 12 },
  chipTextActive: { color: '#fff' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  smallBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#0b1220' },
  smallBtnText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  hint: { color: '#64748b', fontWeight: '700', fontSize: 12, lineHeight: 16, marginBottom: 10 },
  miniMapWrap: { height: 220, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#e2e8f0' },
  miniMap: { width: '100%', height: '100%' },
  coords: { marginTop: 10, color: '#0b1220', fontWeight: '800', fontSize: 12 },
  photo: { width: 92, height: 92, borderRadius: 18, backgroundColor: '#e2e8f0' },
  errorBox: { backgroundColor: 'rgba(239,68,68,0.10)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.30)', borderRadius: 18, padding: 14 },
  errorTitle: { color: '#0b1220', fontWeight: '950', marginBottom: 6 },
  errorText: { color: '#0b1220', opacity: 0.8, fontWeight: '700' },
  okBox: { backgroundColor: 'rgba(16,185,129,0.10)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.30)', borderRadius: 18, padding: 14 },
  okTitle: { color: '#0b1220', fontWeight: '950', marginBottom: 6 },
  okText: { color: '#0b1220', opacity: 0.85, fontWeight: '800' },
  submit: { backgroundColor: '#fff', borderRadius: 18, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  submitText: { color: '#0b1220', fontWeight: '950' },
});


