import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { ESTABLISHMENT_CATEGORIES } from '../../types/establishment';
import { presignBusinessPhoto, uploadToPresignedPutUrl } from '../../services/businessPhotos';
import { fetchProProfile, upsertProProfile } from '../../services/pro';
import { useQuery } from '@tanstack/react-query';
import { PlaceImage } from '../../components/UI/PlaceImage';
import { authMe } from '../../services/auth';
import { useCurrentLocation, useLocationStore } from '../../stores/useLocationStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useAppTheme } from '../../services/settingsTheme';
import Constants from 'expo-constants';

export default function ProfileEstablishmentScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const t = useAppTheme();

  const { data: me } = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => authMe(),
    staleTime: 1000 * 20,
    retry: false,
  });
  const isAuthed = !!me;

  const { data: existing } = useQuery({
    queryKey: ['pro-profile'],
    enabled: isAuthed,
    queryFn: () => fetchProProfile(),
    staleTime: 1000 * 30,
    retry: false,
  });

  const [name, setName] = useState('');
  const [category, setCategory] = useState('restaurant');
  const [ownerFirstName, setOwnerFirstName] = useState('');
  const [ownerLastName, setOwnerLastName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const hasPermission = useLocationStore((s) => s.hasPermission);
  const rawUserLocation = useLocationStore((s) => s.userLocation);
  const fallbackLocation = useCurrentLocation();
  const base = rawUserLocation || fallbackLocation;
  const [lat, setLat] = useState<number>(() => base.lat);
  const [lng, setLng] = useState<number>(() => base.lng);
  const defaultTravelMode = useSettingsStore((s) => s.defaultTravelMode);
  const setDefaultTravelMode = useSettingsStore((s) => s.setDefaultTravelMode);
  const GIF_WALK = useMemo(() => require('../../assets/walk.gif'), []);
  const GIF_CAR = useMemo(() => require('../../assets/voiture.gif'), []);
  const GIF_BIKE = useMemo(() => require('../../assets/velo.gif'), []);
  const [description, setDescription] = useState('');
  const [instagram, setInstagram] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [website, setWebsite] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isExpoGo = (Constants as any)?.appOwnership === 'expo';
  const useGoogleProvider = Platform.OS === 'android' || (Platform.OS === 'ios' && !isExpoGo);
  const mapType = t.isDark ? 'satellite' : 'standard';

  useEffect(() => {
    if (!existing) return;
    setOwnerFirstName((v) => (v ? v : (existing as any).ownerFirstName || ''));
    setOwnerLastName((v) => (v ? v : (existing as any).ownerLastName || ''));
    setName((v) => (v ? v : existing.name || ''));
    setCategory((v) => (v && v !== 'restaurant' ? v : existing.category || 'restaurant'));
    setAddress((v) => (v ? v : existing.address || ''));
    setPhone((v) => (v ? v : existing.phone || ''));
    setLat((v) => (Number.isFinite(v) ? v : (existing as any).lat || base.lat));
    setLng((v) => (Number.isFinite(v) ? v : (existing as any).lng || base.lng));
    setDescription((v) => (v ? v : existing.description || ''));
    setAvatarUrl((v) => (v ? v : existing.avatarUrl || null));
    setInstagram((v) => (v ? v : (existing as any).instagram || ''));
    setWhatsapp((v) => (v ? v : (existing as any).whatsapp || ''));
    setWebsite((v) => (v ? v : (existing as any).website || ''));
  }, [existing]);

  const canSubmit =
    ownerFirstName.trim().length >= 2 &&
    ownerLastName.trim().length >= 2 &&
    name.trim().length >= 2 &&
    category.trim().length >= 2 &&
    phone.trim().length >= 6 &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !loading;

  const pickAvatar = async () => {
    setError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      setError('Permission photos refusée.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 0.85,
    });
    if (res.canceled) return;
    const a = res.assets?.[0];
    if (!a?.uri) return;
    try {
      setLoading(true);
      const presign = await presignBusinessPhoto({
        fileName: a.fileName || `avatar-${Date.now()}.jpg`,
        contentType: a.mimeType || 'image/jpeg',
      });
      await uploadToPresignedPutUrl({
        putUrl: presign.putUrl,
        localUri: a.uri,
        contentType: a.mimeType || 'image/jpeg',
      });
      setAvatarUrl(presign.publicUrl);
    } catch (e: any) {
      setError(String(e?.message || 'Upload impossible'));
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      await upsertProProfile({
        ownerFirstName: ownerFirstName.trim() || undefined,
        ownerLastName: ownerLastName.trim() || undefined,
        name: name.trim(),
        category,
        address: address.trim() || undefined,
        phone: phone.trim(),
        lat,
        lng,
        description: description.trim() || undefined,
        avatarUrl: avatarUrl || undefined,
        instagram: instagram.trim() || undefined,
        whatsapp: whatsapp.trim() || undefined,
        website: website.trim() || undefined,
      });
      await qc.invalidateQueries({ queryKey: ['auth-me'] });
      await qc.invalidateQueries({ queryKey: ['pro-profile'] });
      router.replace('/business');
    } catch (e: any) {
      const status = Number(e?.response?.status);
      if (status === 401) {
        setError('Session expirée. Reconnecte-toi puis réessaie.');
        router.replace('/login');
        return;
      }
      setError(String(e?.response?.data?.message || e?.message || 'Erreur'));
    } finally {
      setLoading(false);
    }
  };

  const categoryLabel = useMemo(() => {
    const c = ESTABLISHMENT_CATEGORIES.find((x) => x.id === (category as any));
    return c?.label || category;
  }, [category]);

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Profil établissement</Text>
            <Text style={styles.subtitle}>Complétez votre vitrine Pro.</Text>
          </View>
          <TouchableOpacity style={[styles.savePill, !canSubmit && { opacity: 0.55 }]} disabled={!canSubmit} onPress={submit}>
            <Text style={styles.savePillText}>{loading ? '…' : 'Enregistrer'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          {!isAuthed && (
            <View style={styles.error}>
              <Text style={styles.errorTitle}>Connexion requise</Text>
              <Text style={styles.errorText}>Connectez-vous pour compléter votre profil établissement.</Text>
              <View style={{ height: 10 }} />
              <TouchableOpacity style={[styles.savePill, { alignSelf: 'flex-start' }]} onPress={() => router.replace('/login')}>
                <Text style={styles.savePillText}>Se connecter</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.heroCard}>
            <View style={styles.avatarRow}>
              <View style={styles.avatar}>
                <PlaceImage uri={avatarUrl} id="pro-avatar" name={name || 'O'} category={category} style={styles.avatarImg} textSize={18} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroTitle}>{name?.trim() ? name.trim() : 'Votre établissement'}</Text>
                <Text style={styles.heroMeta}>{categoryLabel}</Text>
                <TouchableOpacity style={styles.secondary} onPress={pickAvatar} disabled={loading}>
                  <Text style={styles.secondaryText}>Choisir une photo</Text>
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.hint}>
              Astuce: ajoutez WhatsApp / Instagram / site pour améliorer la conversion des visiteurs.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.section}>Identité</Text>

            <Text style={styles.label}>Nom (propriétaire)</Text>
            <TextInput value={ownerLastName} onChangeText={setOwnerLastName} placeholder="Ex: Koné" placeholderTextColor="#94a3b8" style={styles.input} />

            <Text style={[styles.label, { marginTop: 12 }]}>Prénom (propriétaire)</Text>
            <TextInput value={ownerFirstName} onChangeText={setOwnerFirstName} placeholder="Ex: Aïcha" placeholderTextColor="#94a3b8" style={styles.input} />

            <Text style={styles.label}>Nom de l’établissement</Text>
            <TextInput value={name} onChangeText={setName} placeholder="Ex: Les Délices de O'zoua" placeholderTextColor="#94a3b8" style={styles.input} />

            <Text style={[styles.label, { marginTop: 12 }]}>Catégorie</Text>
            <View style={styles.catWrap}>
              {ESTABLISHMENT_CATEGORIES.slice(0, 10).map((c) => (
                <TouchableOpacity key={c.id} style={[styles.chip, category === c.id && styles.chipActive]} onPress={() => setCategory(c.id)}>
                  <Text style={[styles.chipText, category === c.id && styles.chipTextActive]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.section}>Localisation</Text>
            <Text style={styles.label}>Position sur la carte (obligatoire)</Text>
            <Text style={[styles.hint, { marginBottom: 10 }]}>
              Zoomez puis appuyez sur la carte (ou glissez le marqueur) pour une précision maximale.
            </Text>
            <View style={styles.miniMapWrap}>
              <MapView
                provider={useGoogleProvider ? PROVIDER_GOOGLE : undefined}
                style={styles.miniMap}
                initialRegion={{
                  latitude: lat,
                  longitude: lng,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
                mapType={mapType as any}
                onPress={(e) => {
                  const c = e.nativeEvent.coordinate;
                  setLat(c.latitude);
                  setLng(c.longitude);
                }}
                showsUserLocation={hasPermission}
                showsMyLocationButton={false}
                rotateEnabled={false}
                pitchEnabled={false}
              >
                <Marker
                  coordinate={{ latitude: lat, longitude: lng }}
                  draggable
                  onDragEnd={(e) => {
                    const c = e.nativeEvent.coordinate;
                    setLat(c.latitude);
                    setLng(c.longitude);
                  }}
                  pinColor="#111827"
                />
              </MapView>
            </View>
            <Text style={styles.coords}>
              {Number(lat).toFixed(5)}, {Number(lng).toFixed(5)}
            </Text>

            <Text style={[styles.label, { marginTop: 12 }]}>Adresse (optionnel)</Text>
            <TextInput value={address} onChangeText={setAddress} placeholder="Rue / quartier" placeholderTextColor="#94a3b8" style={styles.input} />
          </View>

          <View style={styles.card}>
            <Text style={styles.section}>Contact</Text>
            <Text style={styles.label}>Téléphone (obligatoire)</Text>
            <TextInput value={phone} onChangeText={setPhone} placeholder="+225 ..." placeholderTextColor="#94a3b8" style={styles.input} />

            <Text style={[styles.label, { marginTop: 12 }]}>WhatsApp (optionnel)</Text>
            <TextInput value={whatsapp} onChangeText={setWhatsapp} placeholder="+225 07..." placeholderTextColor="#94a3b8" style={styles.input} />

            <Text style={[styles.label, { marginTop: 12 }]}>Instagram (optionnel)</Text>
            <TextInput value={instagram} onChangeText={setInstagram} placeholder="@monetablissement" placeholderTextColor="#94a3b8" style={styles.input} autoCapitalize="none" />

            <Text style={[styles.label, { marginTop: 12 }]}>Site web (optionnel)</Text>
            <TextInput value={website} onChangeText={setWebsite} placeholder="https://..." placeholderTextColor="#94a3b8" style={styles.input} autoCapitalize="none" />
          </View>

          <View style={styles.card}>
            <Text style={styles.section}>Navigation</Text>
            <Text style={styles.label}>Mode de déplacement par défaut</Text>
            <Text style={[styles.hint, { marginBottom: 12 }]}>
              Ce choix sera utilisé quand vous lancez un itinéraire (modifiable à tout moment).
            </Text>
            <View style={styles.modeRow}>
              <TouchableOpacity
                style={[styles.modeBtn, defaultTravelMode === 'driving' && styles.modeBtnActive]}
                onPress={() => setDefaultTravelMode('driving')}
                activeOpacity={0.92}
              >
                <Image source={GIF_CAR} style={styles.modeGif} />
                <Text style={[styles.modeText, defaultTravelMode === 'driving' && styles.modeTextActive]}>Voiture</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, defaultTravelMode === 'walking' && styles.modeBtnActive]}
                onPress={() => setDefaultTravelMode('walking')}
                activeOpacity={0.92}
              >
                <Image source={GIF_WALK} style={styles.modeGif} />
                <Text style={[styles.modeText, defaultTravelMode === 'walking' && styles.modeTextActive]}>À pied</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, defaultTravelMode === 'bicycling' && styles.modeBtnActive]}
                onPress={() => setDefaultTravelMode('bicycling')}
                activeOpacity={0.92}
              >
                <Image source={GIF_BIKE} style={styles.modeGif} />
                <Text style={[styles.modeText, defaultTravelMode === 'bicycling' && styles.modeTextActive]}>Vélo</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.section}>Description</Text>
            <Text style={styles.label}>À propos (optionnel)</Text>
            <TextInput value={description} onChangeText={setDescription} placeholder="Ambiance, horaires…" placeholderTextColor="#94a3b8" style={[styles.input, { minHeight: 110 }]} multiline />
          </View>

          {!!error && (
            <View style={styles.error}>
              <Text style={styles.errorTitle}>Impossible</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={{ height: 8 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  backBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 20, fontWeight: '900', color: '#0b1220' },
  title: { fontSize: 16, fontWeight: '950', color: '#0b1220' },
  subtitle: { marginTop: 2, color: '#64748b', fontWeight: '700', fontSize: 12 },
  savePill: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999, backgroundColor: '#0b1220' },
  savePillText: { color: '#fff', fontWeight: '950' },
  content: { paddingHorizontal: 16, paddingVertical: 14, paddingBottom: 28, gap: 12 },
  heroCard: { backgroundColor: '#0b1220', borderRadius: 20, padding: 14 },
  hint: { color: '#64748b', fontWeight: '700', fontSize: 12, lineHeight: 16, marginBottom: 12 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 54, height: 54, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.08)' },
  avatarImg: { width: 54, height: 54, borderRadius: 18 },
  heroTitle: { color: '#fff', fontWeight: '950', fontSize: 18 },
  heroMeta: { marginTop: 2, color: 'rgba(255,255,255,0.72)', fontWeight: '800', fontSize: 12 },
  label: { color: '#0b1220', fontWeight: '900', fontSize: 12 },
  section: { color: '#0b1220', fontWeight: '950', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6 },
  card: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#e2e8f0', padding: 14 },
  input: { marginTop: 8, backgroundColor: '#f1f5f9', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: '#e2e8f0', color: '#0b1220', fontWeight: '800' },
  miniMapWrap: { height: 220, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#e2e8f0' },
  miniMap: { width: '100%', height: '100%' },
  coords: { marginTop: 10, color: '#0b1220', fontWeight: '800', fontSize: 12 },
  modeRow: { flexDirection: 'row', gap: 10 },
  modeBtn: { flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: 'center', backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0', gap: 6 },
  modeBtnActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  modeGif: { width: 44, height: 30, borderRadius: 10 },
  modeText: { color: '#475569', fontWeight: '900', fontSize: 12 },
  modeTextActive: { color: '#fff' },
  secondary: { marginTop: 10, borderRadius: 14, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(255,255,255,0.10)' },
  secondaryText: { color: '#fff', fontWeight: '900' },
  error: { backgroundColor: 'rgba(239,68,68,0.10)', borderColor: 'rgba(239,68,68,0.30)', borderWidth: 1, borderRadius: 16, padding: 12 },
  errorTitle: { color: '#991b1b', fontWeight: '950', marginBottom: 4 },
  errorText: { color: '#991b1b', fontWeight: '700', fontSize: 12, lineHeight: 16 },
  catWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  chipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  chipText: { color: '#475569', fontWeight: '900', fontSize: 12 },
  chipTextActive: { color: '#fff' },
});



