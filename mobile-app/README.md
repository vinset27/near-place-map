# O'Show Mobile - Application Expo

Application mobile native pour découvrir les établissements à proximité en Côte d'Ivoire.

## 📋 Prérequis

- Node.js 18+ installé
- Expo CLI installé globalement: `npm install -g expo-cli`
- Pour Android: Android Studio avec SDK configuré OU un appareil physique
- Pour iOS: Xcode et macOS (ou utiliser Expo Go sur iPhone)

## 🚀 Installation

```bash
# Installer les dépendances
npm install

# Lancer l'application en mode développement
npm start
```

## ⚙️ Configuration

### 1. Backend API

L'application utilise le même backend que le projet web. Modifiez l'URL de l'API dans `services/api.ts` :

```typescript
const API_BASE_URL = __DEV__ 
  ? 'http://10.0.2.2:5000' // Android emulator (localhost:5000 sur votre machine)
  : 'https://votre-api-production.com';
```

**Important :**
- Sur émulateur Android : utiliser `http://10.0.2.2:5000`
- Sur appareil physique Android : utiliser l'IP locale (ex: `http://192.168.1.10:5000`)
- Sur iOS : utiliser `http://localhost:5000`

### 2. Google Maps API Keys

L'application utilise Google Maps pour l'affichage de la carte. Vous devez obtenir des clés API :

1. Aller sur [Google Cloud Console](https://console.cloud.google.com/)
2. Créer un nouveau projet ou sélectionner un projet existant
3. Activer les APIs suivantes :
   - Maps SDK for Android
   - Maps SDK for iOS
4. Créer des clés API (une pour Android, une pour iOS)
5. Configurer les restrictions de clés

Ensuite, mettre à jour `app.json` :

```json
{
  "expo": {
    "ios": {
      "config": {
        "googleMapsApiKey": "VOTRE_CLE_IOS"
      }
    },
    "android": {
      "config": {
        "googleMaps": {
          "apiKey": "VOTRE_CLE_ANDROID"
        }
      }
    }
  }
}
```

## 📱 Commandes

```bash
# Démarrer le serveur de développement
npm start

# Lancer sur Android
npm run android

# Lancer sur iOS (macOS uniquement)
npm run ios

# Lancer sur web (pour test)
npm run web
```

## 🏗️ Architecture du Projet

```
mobile-app/
├── app/                      # Écrans (Expo Router)
│   ├── _layout.tsx          # Layout racine
│   ├── index.tsx            # Écran d'onboarding
│   ├── map.tsx              # Carte principale
│   ├── list.tsx             # Liste des établissements
│   └── establishment/
│       └── [id].tsx         # Détails d'un établissement
├── services/                 # Services API
│   ├── api.ts               # Configuration Axios
│   ├── establishments.ts    # API établissements
│   └── location.ts          # Géolocalisation GPS
├── stores/                   # État global (Zustand)
│   └── useLocationStore.ts  # Store de localisation
├── types/                    # Types TypeScript
│   ├── establishment.ts     # Types d'établissements
│   └── navigation.ts        # Types de navigation
├── components/              # Composants réutilisables (à créer au besoin)
├── assets/                  # Images et ressources
└── app.json                 # Configuration Expo
```

## 🎯 Fonctionnalités

### ✅ Implémentées

- **Onboarding** : Introduction en 3 étapes avec demande de permission GPS
- **Carte interactive** : Google Maps avec marqueurs des établissements
- **Filtres** : Par catégorie, rayon (5/10/25/50/200 km), recherche texte
- **Liste** : Affichage liste triée par distance
- **Détails** : Fiche complète avec photos, infos, actions (appel, partage, itinéraire)
- **Géolocalisation** : Suivi GPS en temps réel
- **API Backend** : Intégration complète avec le backend existant (AUCUNE modification)

### 📋 À Implémenter (Bonus)

- Navigation turn-by-turn (écran Navigation)
- Mode sombre / Thème dynamique
- Favoris et historique
- Système de notation et avis
- Push notifications pour événements
- Cache offline des établissements

## 🔧 Services API Backend (Ne pas modifier)

L'application consomme ces routes API existantes :

```
GET /api/establishments?lat={lat}&lng={lng}&radiusKm={radius}&category={cat}&q={query}&limit={limit}
GET /api/establishments/:id
POST /api/establishments (avec credentials pour création)
```

**⚠️ IMPORTANT :**  
Aucune route backend ne doit être modifiée. L'application s'adapte intégralement au backend existant.

## 📦 Dépendances Principales

- `expo` - Framework de développement mobile
- `expo-router` - Navigation file-based
- `expo-location` - Géolocalisation GPS
- `react-native-maps` - Cartes Google Maps natives
- `axios` - Client HTTP pour l'API
- `zustand` - Gestion d'état légère
- `@tanstack/react-query` - Gestion du cache et des requêtes
- `expo-linear-gradient` - Dégradés pour l'UI

## 🚢 Build et Déploiement

### Build de développement

```bash
# Android APK
npx expo build:android

# iOS IPA (macOS uniquement)
npx expo build:ios
```

### Build avec EAS (Expo Application Services)

```bash
# Installer EAS CLI
npm install -g eas-cli

# Se connecter
eas login

# Configurer le projet
eas build:configure

# Build Android
eas build --platform android

# Build iOS
eas build --platform ios

# Build les deux
eas build --platform all
```

## 🐛 Résolution de Problèmes

### L'API ne répond pas

- Vérifier que le backend est démarré sur `http://localhost:5000`
- Sur appareil physique, utiliser l'IP locale au lieu de localhost
- Vérifier les paramètres CORS côté backend

### Google Maps n'affiche pas la carte

- Vérifier que les clés API sont correctement configurées dans `app.json`
- Vérifier que les APIs Maps SDK sont activées dans Google Cloud Console
- Rebuild l'application après modification des clés

### Permission GPS refusée

- Sur Android : Aller dans Paramètres > Apps > O'Show > Autorisations
- Sur iOS : Aller dans Réglages > O'Show > Localisation
- L'application fonctionne quand même avec une position par défaut (Abidjan)

## 📄 Licence

Ce projet est lié au projet web Near-Place/O'Show existant.

## 👨‍💻 Développement

Cette application a été créée en suivant strictement les spécifications du projet web existant :
- Aucune route API n'a été modifiée
- Les types correspondent exactement aux réponses backend
- L'UX/UI est adaptée au mobile avec une expérience premium
- Toutes les fonctionnalités principales sont implémentées

---

**🎉 Application prête pour la production après configuration des clés API Google Maps !**


















