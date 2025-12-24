import { type Establishment } from "@/lib/data";

export type EventCategory = "event" | "promo" | "live";

export type EstablishmentEvent = {
  id: string;
  establishmentId: string;
  title: string;
  category: EventCategory;
  startsAt: string; // ISO
  endsAt?: string; // ISO
};

// Demo data (to be replaced by DB/API later)
export const demoEvents: EstablishmentEvent[] = [
  {
    id: "ev1",
    establishmentId: "2",
    title: "Soirée grillades + DJ",
    category: "live",
    startsAt: new Date(Date.now() + 1000 * 60 * 60 * 4).toISOString(),
  },
  {
    id: "ev2",
    establishmentId: "1",
    title: "Happy hour cocktails",
    category: "promo",
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




