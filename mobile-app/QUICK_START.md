# 🚀 QUICK START - O'Show Mobile

## ⚡ Démarrage Rapide (5 minutes)

### Étape 1 : Installation
```bash
cd mobile-app
npm install
```

### Étape 2 : Configuration Minimale

**A. Configurer l'URL du backend**

Éditez `services/api.ts` ligne 10 :

```typescript
// Pour émulateur Android
const API_BASE_URL = 'http://10.0.2.2:5000';

// Pour appareil Android physique (remplacez par votre IP)
// const API_BASE_URL = 'http://192.168.1.10:5000';
```

**Trouver votre IP locale :**
- Windows : `ipconfig` → IPv4
- Mac/Linux : `ifconfig` → inet

**B. Google Maps API Keys (OBLIGATOIRE)**

1. Aller sur https://console.cloud.google.com/
2. Créer un projet
3. Activer "Maps SDK for Android" et "Maps SDK for iOS"
4. Créer 2 clés API (Android + iOS)
5. Éditer `app.json` :

```json
{
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
```

### Étape 3 : Lancer l'App

```bash
npm start
```

Puis choisir :
- `a` pour Android
- `i` pour iOS
- Scanner le QR code avec Expo Go (⚠️ Maps ne marchera pas dans Expo Go)

---

## 🔧 Configuration Complète

### Option A : Test avec Expo Go (sans Maps)

**Avantage :** Rapide, pas de build  
**Inconvénient :** Google Maps ne fonctionne pas

```bash
npm start
# Scanner le QR code avec l'app Expo Go
```

### Option B : Build Development (avec Maps) ⭐ RECOMMANDÉ

**Avantage :** Maps fonctionne  
**Inconvénient :** Build ~10-30 min

```bash
# Installer EAS CLI
npm install -g eas-cli

# Se connecter
eas login

# Build Android
eas build --profile development --platform android

# Télécharger l'APK généré et l'installer sur votre appareil
```

### Option C : Émulateur Local (avec Maps)

**Android :**
```bash
npm run android
```

**iOS (macOS uniquement) :**
```bash
npm run ios
```

---

## 📱 Structure des Écrans

| Route | Fichier | Description |
|-------|---------|-------------|
| `/` | `app/index.tsx` | Onboarding (3 étapes) |
| `/map` | `app/map.tsx` | Carte principale |
| `/list` | `app/list.tsx` | Liste des établissements |
| `/establishment/[id]` | `app/establishment/[id].tsx` | Détails |

---

## 🐛 Résolution Rapide de Problèmes

### ❌ Erreur : "Network request failed"

**Cause :** Backend non accessible

**Solutions :**
```bash
# 1. Vérifier que le backend tourne
cd ../server
npm run dev

# 2. Tester l'URL dans un navigateur
http://localhost:5000/api/establishments?lat=5.3261&lng=-4.0200&radiusKm=10

# 3. Vérifier l'URL dans services/api.ts
```

### ❌ Google Maps est grise/vide

**Cause :** Clés API manquantes ou incorrectes

**Solutions :**
1. Vérifier que les clés sont dans `app.json`
2. Vérifier que les APIs sont activées dans Google Cloud Console
3. Rebuild complètement :
```bash
rm -rf node_modules
npm install
npm run android
```

### ❌ Permission GPS refusée

**Solutions :**
- Désinstaller et réinstaller l'app
- Android : Paramètres > Apps > O'Show > Autorisations
- iOS : Réglages > O'Show > Localisation

---

## 📦 Commandes Utiles

```bash
# Installer les dépendances
npm install

# Démarrer le serveur de développement
npm start

# Lancer sur Android
npm run android

# Lancer sur iOS (macOS uniquement)
npm run ios

# Nettoyer le cache
npx expo start -c

# Build development (EAS)
eas build --profile development --platform android

# Build production (EAS)
eas build --profile production --platform android

# Vérifier les erreurs TypeScript
npx tsc --noEmit

# Voir les logs
npx expo start --dev-client
```

---

## 📖 Documentation Complète

- `README.md` - Vue d'ensemble et architecture
- `CONFIGURATION.md` - Guide de configuration détaillé (Google Maps, etc.)
- `LIVRABLE.md` - Document récapitulatif complet

---

## ✅ Checklist Pré-Test

Avant de tester l'app, vérifiez :

- [ ] Backend démarré sur http://localhost:5000
- [ ] URL backend configurée dans `services/api.ts`
- [ ] Clés Google Maps ajoutées dans `app.json`
- [ ] `npm install` exécuté sans erreur
- [ ] Émulateur/appareil prêt

---

## 🎯 Test Rapide

Une fois l'app lancée, testez :

1. ✅ Onboarding s'affiche
2. ✅ Permission GPS demandée
3. ✅ Carte Google Maps s'affiche
4. ✅ Marqueurs des établissements visibles
5. ✅ Clic sur un marqueur affiche les détails
6. ✅ Bouton "Liste" fonctionne
7. ✅ Filtres par catégorie fonctionnent
8. ✅ Recherche texte fonctionne
9. ✅ Clic sur un établissement ouvre la fiche détaillée
10. ✅ Boutons "Appeler", "Partager", "Itinéraire" fonctionnent

---

## 🚀 Prochaines Étapes

Une fois l'app testée en local :

1. **Build de production**
```bash
eas build --profile production --platform all
```

2. **Soumission aux stores**
   - Android : https://play.google.com/console
   - iOS : https://appstoreconnect.apple.com

3. **CI/CD** (optionnel)
   - GitHub Actions + EAS
   - Auto-build sur chaque push

---

## 📞 Besoin d'Aide ?

1. Consulter `CONFIGURATION.md` pour les détails
2. Consulter `LIVRABLE.md` pour le récapitulatif complet
3. Documentation Expo : https://docs.expo.dev/
4. Documentation React Native Maps : https://github.com/react-native-maps/react-native-maps

---

**🎉 Bonne chance avec votre app mobile O'Show !**






