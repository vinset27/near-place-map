import React, { useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFavoritesStore } from '../../stores/useFavoritesStore';
import { EstablishmentCard } from '../../components/Cards/EstablishmentCard';
import { useAppTheme } from '../../services/settingsTheme';

export default function FavoritesScreen() {
  const router = useRouter();
  const t = useAppTheme();
  const items = useFavoritesStore((s) => s.items);
  const toggle = useFavoritesStore((s) => s.toggle);
  const clear = useFavoritesStore((s) => s.clear);

  const data = useMemo(() => Object.values(items).sort((a, b) => b.savedAt - a.savedAt), [items]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]}>
      <View style={[styles.header, { backgroundColor: t.card, borderBottomColor: t.border }]}>
        <Text style={[styles.title, { color: t.text, transform: [{ scale: t.textScale }] }]}>Favoris</Text>
        {data.length > 0 && (
          <TouchableOpacity style={[styles.clearBtn, { backgroundColor: t.input, borderColor: t.border }]} onPress={clear}>
            <Text style={[styles.clearText, { color: t.text, transform: [{ scale: t.textScale }] }]}>Tout supprimer</Text>
          </TouchableOpacity>
        )}
      </View>

      {data.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyIcon, { color: t.text, transform: [{ scale: t.textScale }] }]}>♡</Text>
          <Text style={[styles.emptyTitle, { color: t.text, transform: [{ scale: t.textScale }] }]}>Aucun favori</Text>
          <Text style={[styles.emptyText, { color: t.muted, transform: [{ scale: t.textScale }] }]}>Ajoute des lieux depuis la liste ou la carte.</Text>
        </View>
      ) : (
        <FlatList
          data={data as any}
          keyExtractor={(i: any) => i.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          renderItem={({ item }: any) => (
            <EstablishmentCard
              item={item}
              onPress={() => router.push(`/establishment/${item.id}`)}
              favorite={{ active: true, onToggle: () => toggle(item) }}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  title: { fontSize: 24, fontWeight: '900', color: '#0b1220' },
  clearBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  clearText: { color: '#0b1220', fontWeight: '900', fontSize: 12 },
  list: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 110 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyIcon: { fontSize: 56, marginBottom: 16, color: '#0b1220' },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: '#0b1220', marginBottom: 6, textAlign: 'center' },
  emptyText: { fontSize: 14, color: '#64748b', textAlign: 'center' },
});






