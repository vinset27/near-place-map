import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Establishment } from '../types/establishment';

export type FavoriteSnapshot = Pick<
  Establishment,
  'id' | 'name' | 'category' | 'imageUrl' | 'address' | 'commune' | 'coordinates'
> & { savedAt: number };

type FavoritesState = {
  items: Record<string, FavoriteSnapshot>;
  isFavorite: (id: string) => boolean;
  toggle: (est: Establishment) => void;
  remove: (id: string) => void;
  clear: () => void;
};

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      items: {},
      isFavorite: (id) => !!get().items[id],
      toggle: (est) =>
        set((state) => {
          const exists = !!state.items[est.id];
          if (exists) {
            const { [est.id]: _removed, ...rest } = state.items;
            return { items: rest };
          }
          return {
            items: {
              ...state.items,
              [est.id]: {
                id: est.id,
                name: est.name,
                category: est.category,
                imageUrl: est.imageUrl,
                address: est.address,
                commune: est.commune,
                coordinates: est.coordinates,
                savedAt: Date.now(),
              },
            },
          };
        }),
      remove: (id) =>
        set((state) => {
          const { [id]: _removed, ...rest } = state.items;
          return { items: rest };
        }),
      clear: () => set({ items: {} }),
    }),
    {
      name: 'nearplace:favorites',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);












