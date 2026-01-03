# 🔧 Guide de Configuration - O'Show Mobile

## Étapes de Configuration Détaillées

### 1️⃣ Configuration du Backend API

#### Option A : Backend Local (Développement)

1. Assurez-vous que le backend est démarré sur `http://localhost:5000`

2. Modifiez `services/api.ts` selon votre plateforme :

**Pour émulateur Android :**
```typescript
const API_BASE_URL = 'http://10.0.2.2:5000';
```

**Pour appareil physique Android :**
```typescript
// Remplacez 192.168.1.10 par l'IP de votre machine
const API_BASE_URL = 'http://192.168.1.10:5000';
```

**Pour iOS (simulateur ou appareil) :**
```typescript
const API_BASE_URL = 'http://localhost:5000';
```

**Trouver votre IP locale :**
- Windows : `ipconfig` dans CMD → chercher "IPv4"
- Mac/Linux : `ifconfig` dans Terminal → chercher "inet"

#### Option B : Backend en Production

```typescript
const API_BASE_URL = 'https://votre-domaine.com';
```

### 2️⃣ Configuration Google Maps API

#### A. Créer un Projet Google Cloud

1. Aller sur [Google Cloud Console](https://console.cloud.google.com/)
2. Cliquer sur "Sélectionner un projet" → "Nouveau projet"
3. Nommer le projet (ex: "OShow Mobile")
4. Créer le projet

#### B. Activer les APIs

1. Dans le menu, aller sur "APIs et Services" → "Bibliothèque"
2. Rechercher et activer :
   - **Maps SDK for Android**
   - **Maps SDK for iOS**
   - **Directions API** (pour les itinéraires, optionnel)
   - **Places API** (si vous voulez ajouter l'autocomplete, optionnel)

#### C. Créer les Clés API

##### Pour Android :

1. Aller sur "APIs et Services" → "Identifiants"
2. Cliquer sur "Créer des identifiants" → "Clé API"
3. Une fois créée, cliquer sur "Restreindre la clé"
4. Nom : "O'Show Android"
5. Restrictions d'API : Sélectionner "Maps SDK for Android"
6. Restrictions d'application :
   - Sélectionner "Applications Android"
   - Ajouter votre package : `com.nearplace.oshow`
   - Obtenir l'empreinte SHA-1 :
   
   ```bash
   # Debug keystore
   keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
   
   # Production keystore (quand vous buildez pour le Play Store)
   keytool -list -v -keystore /path/to/your-release-key.keystore -alias your-key-alias
   ```
   
   - Copier l'empreinte SHA-1 et l'ajouter dans Google Cloud Console
7. Enregistrer

##### Pour iOS :

1. Créer une nouvelle clé API (même processus)
2. Nom : "O'Show iOS"
3. Restrictions d'API : Sélectionner "Maps SDK for iOS"
4. Restrictions d'application :
   - Sélectionner "Applications iOS"
   - Ajouter l'identifiant de bundle : `com.nearplace.oshow`
5. Enregistrer

#### D. Configurer app.json

Ouvrir `app.json` et remplacer les placeholders :

```json
{
  "expo": {
    "ios": {
      "config": {
        "googleMapsApiKey": "AIzaSy...VOTRE_CLE_IOS"
      }
    },
    "android": {
      "config": {
        "googleMaps": {
          "apiKey": "AIzaSy...VOTRE_CLE_ANDROID"
        }
      }
    }
  }
}
```

### 3️⃣ Configuration des Permissions

Les permissions sont déjà configurées dans `app.json`, mais vérifiez-les :

#### Android (app.json)
```json
"android": {
  "permissions": [
    "ACCESS_FINE_LOCATION",
    "ACCESS_COARSE_LOCATION",
    "ACCESS_BACKGROUND_LOCATION"
  ]
}
```

#### iOS (app.json)
```json
"ios": {
  "infoPlist": {
    "NSLocationWhenInUseUsageDescription": "O'Show utilise votre position pour vous montrer les établissements à proximité.",
    "NSLocationAlwaysUsageDescription": "O'Show utilise votre position pour vous guider vers votre destination."
  }
}
```

### 4️⃣ Configuration EAS (Expo Application Services) - Pour les Builds

1. Installer EAS CLI :
```bash
npm install -g eas-cli
```

2. Se connecter à Expo :
```bash
eas login
```

3. Configurer le projet :
```bash
eas build:configure
```

4. Modifier `app.json` pour ajouter l'ID du projet :
```json
{
  "expo": {
    "extra": {
      "eas": {
        "projectId": "votre-project-id-eas"
      }
    }
  }
}
```

5. Créer un fichier `eas.json` (généré automatiquement) :
```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {}
  }
}
```

### 5️⃣ Test de l'Application

#### A. Test sur Simulateur/Émulateur

```bash
# Android
npm run android

# iOS (macOS uniquement)
npm run ios
```

#### B. Test sur Appareil Physique avec Expo Go

1. Installer **Expo Go** sur votre appareil :
   - [Android](https://play.google.com/store/apps/details?id=host.exp.exponent)
   - [iOS](https://apps.apple.com/app/expo-go/id982107779)

2. Lancer le serveur :
```bash
npm start
```

3. Scanner le QR code :
   - Android : Scanner avec l'app Expo Go
   - iOS : Scanner avec l'appareil photo natif

**⚠️ Limitation Expo Go :** Google Maps ne fonctionnera PAS dans Expo Go car il nécessite des builds natifs. Pour tester Maps, vous devez builder l'app.

#### C. Build de Développement (pour tester avec Maps)

```bash
# Android
eas build --profile development --platform android

# iOS
eas build --profile development --platform ios
```

Une fois le build terminé, téléchargez et installez l'APK/IPA sur votre appareil.

### 6️⃣ Variables d'Environnement (Optionnel)

Pour mieux gérer les configurations, vous pouvez utiliser `expo-constants` :

1. Installer :
```bash
npm install expo-constants
```

2. Créer `app.config.js` (au lieu de `app.json`) :
```javascript
export default {
  expo: {
    name: "O'Show",
    // ... autres configs
    extra: {
      apiBaseUrl: process.env.API_BASE_URL || 'http://10.0.2.2:5000',
    }
  }
}
```

3. Utiliser dans le code :
```typescript
import Constants from 'expo-constants';
const API_BASE_URL = Constants.expoConfig?.extra?.apiBaseUrl;
```

### 7️⃣ Checklist de Configuration

- [ ] Backend API démarré et accessible
- [ ] URL de l'API configurée dans `services/api.ts`
- [ ] Compte Google Cloud créé
- [ ] APIs Google Maps activées (Android + iOS)
- [ ] Clés API Google Maps créées et restreintes
- [ ] Clés ajoutées dans `app.json`
- [ ] Permissions GPS configurées
- [ ] Application testée sur émulateur/simulateur
- [ ] (Optionnel) Application buildée et testée sur appareil physique

### 🚨 Problèmes Fréquents

#### La carte Google Maps est grise ou vide

**Cause :** Clés API incorrectes ou non configurées

**Solution :**
1. Vérifier que les clés sont bien dans `app.json`
2. Vérifier que les APIs sont activées dans Google Cloud
3. Rebuild l'application complètement :
```bash
# Nettoyer le cache
rm -rf node_modules
npm install

# Rebuild
npm run android
# ou
npm run ios
```

#### Erreur "Network request failed" lors des appels API

**Cause :** Backend non accessible

**Solution :**
1. Vérifier que le backend est démarré
2. Tester l'URL dans un navigateur : `http://10.0.2.2:5000/api/establishments?lat=5.3261&lng=-4.0200&radiusKm=10`
3. Sur appareil physique, utiliser l'IP locale au lieu de localhost

#### Permission GPS refusée

**Solution :**
- Désinstaller et réinstaller l'app
- Sur Android : Paramètres > Apps > O'Show > Autorisations > Localisation > Autoriser
- Sur iOS : Réglages > O'Show > Localisation > Lors de l'utilisation de l'app

---

## 📞 Support

Pour toute question ou problème, consultez :
- [Documentation Expo](https://docs.expo.dev/)
- [React Native Maps](https://github.com/react-native-maps/react-native-maps)
- [Google Maps Platform](https://developers.google.com/maps)












