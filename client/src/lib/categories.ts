import type { LucideIcon } from "lucide-react";
import { Calendar, Hotel, Hospital, LifeBuoy, MapPin, Pill, Shield, Martini, UtensilsCrossed, Wine } from "lucide-react";
import type { Establishment } from "@/lib/data";

export type EstablishmentCategory = Establishment["category"];

export const ESTABLISHMENT_CATEGORIES: Array<{ id: EstablishmentCategory; label: string }> = [
  { id: "maquis", label: "Maquis" },
  { id: "bar", label: "Bars" },
  { id: "lounge", label: "Lounges" },
  { id: "cave", label: "Caves" },
  { id: "restaurant", label: "Restaurants" },
  { id: "hotel", label: "Hôtels" },
  { id: "pharmacy", label: "Pharmacies" },
  { id: "police", label: "Postes de police" },
  { id: "hospital", label: "Hôpitaux / Cliniques" },
  { id: "emergency", label: "Secours" },
  { id: "organizer", label: "Viganisateur" },
  { id: "other", label: "Autres" },
];

export function getCategoryIcon(category: EstablishmentCategory): LucideIcon {
  switch (category) {
    case "restaurant":
    case "maquis":
      return UtensilsCrossed;
    case "bar":
      return Martini;
    case "cave":
      return Wine;
    case "hotel":
      return Hotel;
    case "pharmacy":
      return Pill;
    case "police":
      return Shield;
    case "hospital":
      return Hospital;
    case "emergency":
      return LifeBuoy;
    case "organizer":
      return Calendar;
    case "lounge":
    case "other":
    default:
      return MapPin;
  }
}


