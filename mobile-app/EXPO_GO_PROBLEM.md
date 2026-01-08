# 🔴 Problème Expo Go + react-native-maps

## ❌ Pourquoi l'App Ne Charge Pas dans Expo Go

**Expo Go ne supporte PAS `react-native-maps`** car cette dépendance nécessite :
- Configuration native (clés API dans Info.plist/AndroidManifest)
- Modules natifs non inclus dans Expo Go

C'est une **limitation normale** d'Expo Go, pas un bug de votre app.

---

## ✅ SOLUTION : Development Build avec EAS

### Étape 1 : Installer EAS CLI

```bash
npm install -g eas-cli
```

### Étape 2 : Se Connecter

```bash
eas login
```

Si vous n'avez pas de compte Expo :
```bash
eas register
```

### Étape 3 : Configurer le Projet

```bash
cd mobile-app
eas build:configure
```

Choisir :
- iOS : Oui
- Android : Oui (optionnel)

Cela crée un fichier `eas.json`.

### Étape 4 : Configurer les Clés Google Maps

**⚠️ IMPORTANT :** Avant de builder, configurez vos clés Google Maps dans `app.json`.

Éditez `app.json` :

```json
{
  "expo": {
    "ios": {
      "config": {
        "googleMapsApiKey": "VOTRE_CLE_IOS"
      }
    }
  }
}
```

**Comment obtenir une clé Google Maps iOS :**
1. Aller sur https://console.cloud.google.com/
2. Créer un projet (ou sélectionner un existant)
3. Activer "Maps SDK for iOS"
4. Créer une clé API :
   - Identifiants > Créer des identifiants > Clé API
   - Restreindre la clé :
     - Type : Applications iOS
     - Bundle ID : `com.nearplace.oshow`
5. Copier la clé et la coller dans `app.json`

### Étape 5 : Créer le Development Build

```bash
eas build --profile development --platform ios
```

**Ce qui va se passer :**
1. EAS va build votre app dans le cloud (~20-30 min)
2. Vous recevrez un lien de téléchargement
3. Ouvrez le lien sur votre iPhone
4. Installez l'app (via TestFlight ou installation directe)

### Étape 6 : Lancer le Dev Server

Une fois l'app installée :

```bash
cd mobile-app
npm start --dev-client
```

Scanner le QR code avec **votre app** (pas Expo Go).

---

## 🚀 ALTERNATIVE RAPIDE : Émulateur Android

Si vous voulez tester immédiatement sans attendre le build iOS :

### Sur Windows (votre machine) :

1. **Installer Android Studio** (si pas déjà fait)
   - Télécharger : https://developer.android.com/studio
   - Installer avec les paramètres par défaut

2. **Créer un émulateur Android**
   ```
   Android Studio > Tools > Device Manager > Create Device
   - Choisir : Pixel 5 (ou autre)
   - System Image : Android 13 (API 33)
   ```

3. **Configurer la clé Google Maps Android**
   
   Éditez `app.json` :
   ```json
   {
     "expo": {
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

   **Comment obtenir une clé Android :**
   - Même processus que iOS
   - Mais choisir "Applications Android" au lieu de iOS
   - Package : `com.nearplace.oshow`
   - Obtenir l'empreinte SHA-1 :
   ```bash
   keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
   ```

4. **Lancer l'app sur Android**
   ```bash
   cd mobile-app
   npm run android
   ```

**Avantages :**
- ✅ Pas besoin de Mac
- ✅ Pas besoin d'attendre un build cloud
- ✅ Google Maps fonctionne immédiatement
- ✅ Plus facile à debugger

---

## 📋 Comparaison des Solutions

| Solution | Temps Setup | Plateforme | Maps Fonctionne |
|----------|-------------|------------|-----------------|
| **Expo Go** | 0 min | iOS/Android | ❌ NON |
| **Development Build iOS** | 30 min | iOS | ✅ OUI |
| **Émulateur Android** | 20 min | Windows/Mac/Linux | ✅ OUI |
| **Simulateur iOS** | 0 min | macOS uniquement | ✅ OUI |

---

## 🎯 Recommandation

**Pour tester immédiatement sur Windows :**
→ Utiliser l'émulateur Android (Solution ci-dessus)

**Pour tester sur votre iPhone :**
→ Créer un Development Build avec EAS (prend 30 min)

**Pour production :**
→ Build de production avec EAS

---

## 🐛 Erreurs Fréquentes

### "Build failed: No valid provisioning profile"

**Solution :** Laisser EAS gérer automatiquement :
```bash
eas build --profile development --platform ios --auto-submit
```

### "Google Maps shows blank/grey screen"

**Cause :** Clé API manquante ou incorrecte

**Solution :**
1. Vérifier que la clé est dans `app.json`
2. Vérifier que l'API Maps SDK for iOS est activée
3. Rebuild l'app

### "This app is not compatible with Expo Go"

**C'est normal !** Utilisez un development build à la place.

---

## 💡 SOLUTION TEMPORAIRE : Version Web

En attendant le build, vous pouvez tester la version web :

```bash
cd mobile-app
npm run web
```

Ouvrir dans le navigateur : http://localhost:8081

**Limitations :**
- Pas de GPS réel (position simulée)
- Maps peut ne pas s'afficher correctement
- UX desktop au lieu de mobile

---

## 📞 Besoin d'Aide ?

**Pour Development Build iOS :**
- Documentation EAS : https://docs.expo.dev/develop/development-builds/create-a-build/

**Pour Émulateur Android :**
- Guide Android Studio : https://developer.android.com/studio/run/emulator

**Pour Google Maps :**
- Guide clés API : https://developers.google.com/maps/documentation/ios-sdk/get-api-key

---

## ✅ Checklist Rapide

### Pour Tester sur iPhone (Development Build)

- [ ] Compte Expo créé (`eas register`)
- [ ] Clé Google Maps iOS créée et ajoutée dans `app.json`
- [ ] EAS CLI installé (`npm install -g eas-cli`)
- [ ] Build lancé (`eas build --profile development --platform ios`)
- [ ] App installée sur iPhone (lien reçu par email)
- [ ] Dev server lancé (`npm start --dev-client`)

### Pour Tester sur Android (Émulateur)

- [ ] Android Studio installé
- [ ] Émulateur Android créé (Pixel 5, API 33)
- [ ] Clé Google Maps Android créée et ajoutée dans `app.json`
- [ ] App lancée (`npm run android`)

---

**🎉 Une fois configuré, le développement redevient aussi fluide qu'avec Expo Go !**


















