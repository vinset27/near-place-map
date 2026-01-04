import type { Establishment } from '../types/establishment';
import api from './api';

export type EventCategory = 'event' | 'promo' | 'live';

export type EstablishmentEvent = {
  id: string;
  establishmentId: string;
  title: string;
  category: EventCategory;
  startsAt: string; // ISO
  endsAt?: string; // ISO
};

export type ApiEvent = {
  id: string;
  createdAt: string;
  userId: string;
  establishmentId: string;
  title: string;
  category: string;
  startsAt: string;
  endsAt?: string | null;
  description?: string | null;
  coverUrl?: string | null;
  photos?: string[] | null;
  videos?: string[] | null;
  moderationStatus?: 'pending' | 'approved' | 'rejected' | string;
  moderationReason?: string | null;
  moderatedAt?: string | null;
  // Optional rich media (for Lives / videos)
  liveUrl?: string | null;
  videoUrl?: string | null;
  published?: boolean;
  distanceMeters?: number;
  establishment?: any;
  organizer?: { userId: string; name: string; avatarUrl?: string | null };
};

export async function fetchEventsNearby(params: {
  lat: number;
  lng: number;
  radiusKm: number;
  withinHours?: number;
  limit?: number;
}): Promise<ApiEvent[]> {
  const res = await api.get<{ events?: ApiEvent[] }>('/api/events', { params });
  return (res.data?.events || []) as ApiEvent[];
}

export async function fetchMyEvents(): Promise<ApiEvent[]> {
  const res = await api.get<{ events?: ApiEvent[] }>('/api/events/me');
  return (res.data?.events || []) as ApiEvent[];
}

export async function createEvent(input: {
  establishmentId: string;
  title: string;
  category: EventCategory;
  startsAt: string; // ISO
  endsAt?: string;
  description?: string;
  coverUrl?: string;
  photos?: string[];
  videos?: string[];
  liveUrl?: string;
  videoUrl?: string;
}): Promise<ApiEvent> {
  const res = await api.post<{ event: ApiEvent }>('/api/events', input);
  return res.data.event as ApiEvent;
}

// Same idea as web: demo data (fallback if backend is offline).
export const demoEvents: EstablishmentEvent[] = [
  {
    id: 'ev1',
    establishmentId: '2',
    title: 'Soirée grillades + DJ',
    category: 'live',
    startsAt: new Date(Date.now() + 1000 * 60 * 60 * 4).toISOString(),
  },
  {
    id: 'ev2',
    establishmentId: '1',
    title: 'Happy hour cocktails',
    category: 'promo',
    startsAt: new Date(Date.now() + 1000 * 60 * 60 * 2).toISOString(),
  },
];

export function getUpcomingEventsForEstablishments(
  establishments: Establishment[],
  allEvents: EstablishmentEvent[] = demoEvents,
  withinHours = 48,
): Array<EstablishmentEvent & { establishment: Establishment }> {
  const map = new Map(establishments.map((e) => [e.id, e]));
  const now = Date.now();
  const max = now + withinHours * 60 * 60 * 1000;

  return allEvents
    .map((ev) => {
      const est = map.get(ev.establishmentId);
      if (!est) return null;
      return { ...ev, establishment: est };
    })
    .filter(Boolean)
    .filter((ev) => {
      const t = Date.parse((ev as any).startsAt);
      return t >= now && t <= max;
    }) as any;
}


