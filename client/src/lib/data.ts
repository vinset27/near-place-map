export interface Establishment {
  id: string;
  name: string;
  category:
    | "cave"
    | "maquis"
    | "bar"
    | "lounge"
    | "restaurant"
    | "hotel"
    | "pharmacy"
    | "police"
    | "hospital"
    | "emergency"
    | "organizer"
    | "other";
  description: string;
  address: string;
  commune: "Cocody" | "Marcory" | "Plateau" | "Yopougon" | "Biétry" | string;
  phone?: string | null;
  coordinates: {
    lat: number;
    lng: number;
  };
  rating: number;
  isOpen: boolean;
  imageUrl: string;
  photos?: string[];
  features: string[];
}

import maquisImage from "@assets/generated_images/lively_maquis_in_abidjan_at_night.png";
import loungeImage from "@assets/generated_images/modern_lounge_bar_interior.png";

export const establishments: Establishment[] = [
  {
    id: "1",
    name: "Le Toit d'Abidjan",
    category: "lounge",
    description: "Vue imprenable sur la lagune Ebrié, ambiance chic et décontractée.",
    address: "Rue du Commerce, Plateau",
    commune: "Plateau",
    coordinates: { lat: 5.3261, lng: -4.0200 },
    rating: 4.8,
    isOpen: true,
    imageUrl: loungeImage,
    features: ["Vue Panoramique", "Cocktails Signature", "Musique Live"]
  },
  {
    id: "2",
    name: "Chez Tante Awa",
    category: "maquis",
    description: "Le meilleur poisson braisé de tout Marcory. Ambiance 100% ivoirienne.",
    address: "Zone 4, Rue Pierre et Marie Curie",
    commune: "Marcory",
    coordinates: { lat: 5.2950, lng: -3.9980 },
    rating: 4.5,
    isOpen: true,
    imageUrl: maquisImage,
    features: ["Poisson Braisé", "Kedjenou", "Parking Gardé"]
  },
  {
    id: "3",
    name: "La Cave des Rois",
    category: "cave",
    description: "Sélection exclusive de vins et champagnes. Cadre intimiste.",
    address: "Cocody Ambassades",
    commune: "Cocody",
    coordinates: { lat: 5.3400, lng: -3.9900 },
    rating: 4.7,
    isOpen: false,
    imageUrl: loungeImage, // Reusing lounge image for now
    features: ["Vins Rares", "Cigares", "Salons Privés"]
  },
  {
    id: "4",
    name: "Vibes Club",
    category: "bar",
    description: "Le rendez-vous de la jeunesse abidjanaise. DJ sets tous les weekends.",
    address: "2 Plateaux Vallons",
    commune: "Cocody",
    coordinates: { lat: 5.3550, lng: -4.0050 },
    rating: 4.2,
    isOpen: true,
    imageUrl: maquisImage, // Placeholder
    features: ["DJ Set", "Piste de Danse", "Hookah"]
  },
  {
    id: "5",
    name: "Maquis du Val",
    category: "maquis",
    description: "Authentique maquis avec orchestre live le dimanche.",
    address: "Yopougon Toits Rouges",
    commune: "Yopougon",
    coordinates: { lat: 5.3300, lng: -4.0700 },
    rating: 4.4,
    isOpen: true,
    imageUrl: maquisImage,
    features: ["Orchestre Live", "Poulet Braisé", "Biétry"]
  }
];
