/**
 * Configuration Axios pour l'API backend
 * ⚠️ NE PAS MODIFIER LES ROUTES API - elles correspondent au backend existant
 */

import axios from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

function getHostFromExpo(): string | null {
  // SDK 54 (Expo Go / dev): hostUri is usually "192.168.x.x:8081"
  const hostUri =
    Constants.expoConfig?.hostUri ??
    // Legacy fallbacks:
    (Constants as any).manifest?.debuggerHost ??
    (Constants as any).manifest2?.extra?.expoClient?.hostUri ??
    null;
  if (typeof hostUri !== 'string' || !hostUri) return null;
  const host = hostUri.split(':')[0];
  return host || null;
}

function resolveApiBaseUrl(): string {
  // Preferred: explicit config via EXPO_PUBLIC_API_BASE_URL
  const envBase = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (typeof envBase === 'string' && envBase.trim()) return envBase.trim();

  // Next: value injected from repo-root .env via app.config.ts
  const fromExtra = (Constants.expoConfig as any)?.extra?.api?.baseUrl as string | null | undefined;
  // If you configured a backend base URL in the repo root env (VITE_API_BASE_URL),
  // the mobile app must respect it (same source of truth).
  if (typeof fromExtra === 'string' && fromExtra.trim()) return fromExtra.trim();

  const portFromExtra = (Constants.expoConfig as any)?.extra?.api?.port as number | null | undefined;
  const port = Number.isFinite(portFromExtra) ? Number(portFromExtra) : 5000;

  if (!__DEV__) {
    // TODO: set your production API URL via EXPO_PUBLIC_API_BASE_URL at build time.
    return 'https://votre-api-production.com';
  }

  const expoHost = getHostFromExpo();
  // Android emulator supports 10.0.2.2 for host machine localhost, but LAN host also works.
  if (Platform.OS === 'android') return expoHost ? `http://${expoHost}:${port}` : `http://10.0.2.2:${port}`;
  // iOS device must use LAN host (never localhost/10.0.2.2)
  return expoHost ? `http://${expoHost}:${port}` : `http://localhost:${port}`;
}

// URL de base de l'API (backend existant)
export const API_BASE_URL = resolveApiBaseUrl();

function resolveDevFallbackBaseUrl(): string {
  // Opt-in only: if not set, we won't retry/fallback to LAN at all.
  const envFallback = process.env.EXPO_PUBLIC_DEV_FALLBACK_BASE_URL;
  if (typeof envFallback === 'string' && envFallback.trim()) return envFallback.trim().replace(/\/+$/, '');

  const fromExtra = (Constants.expoConfig as any)?.extra?.api?.devFallbackBaseUrl as string | null | undefined;
  if (typeof fromExtra === 'string' && fromExtra.trim()) return fromExtra.trim().replace(/\/+$/, '');

  // Backwards compatible inferred fallback (LAN host) - only used if explicitly enabled via EXPO_PUBLIC_DEV_FALLBACK_BASE_URL.
  // Returning empty string means "disabled".
  return '';
}

function looksLikeHtml(data: any): boolean {
  if (typeof data !== 'string') return false;
  const s = data.trim().slice(0, 80).toLowerCase();
  return s.startsWith('<!doctype html') || s.startsWith('<html') || s.includes('just a moment') || s.includes('service suspended');
}

let didSwitchToDevFallback = false;
function switchApiToDevFallback(baseUrl: string) {
  if (didSwitchToDevFallback) return;
  didSwitchToDevFallback = true;
  api.defaults.baseURL = baseUrl;
  console.warn(`[API] ✅ Switched api.defaults.baseURL to dev fallback: ${baseUrl}`);
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  // 25s is often too short for cold starts on some hosts; we still keep it bounded and
  // perform a single longer retry for GET timeouts.
  timeout: 35000,
  // IMPORTANT: backend auth uses session cookies.
  // React Native axios must enable credentials to send/receive them.
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercepteur pour logger les requêtes en dev
if (__DEV__) {
  api.interceptors.request.use(
    (config) => {
      console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
      return config;
    },
    (error) => {
      console.error('[API] Request error:', error);
      return Promise.reject(error);
    }
  );

  api.interceptors.response.use(
    (response) => {
      console.log(`[API] ✓ ${response.config.url} (${response.status})`);
      return response;
    },
    async (error) => {
      // If the API domain is behind Cloudflare Managed Challenge or suspended hosting,
      // we often get HTML instead of JSON. Provide a clearer error and (in dev) retry on LAN backend.
      const status = error.response?.status;
      const data = error.response?.data;
      const isHtml = looksLikeHtml(data);

      // Dev-only fallback retry: if user set EXPO_PUBLIC_API_BASE_URL to a blocked public domain,
      // retry once against the local dev server inferred from Expo host.
      const cfg = error.config as any;
      const url = String(cfg?.url || '');
      const silent =
        cfg?.__npSilent === true ||
        String(cfg?.headers?.['X-NP-SILENT'] || cfg?.headers?.['x-np-silent'] || '').trim() === '1';

      // One-time retry for GET timeouts (cold start / waking up dyno)
      if (cfg && !cfg.__npTimeoutRetried && error?.code === 'ECONNABORTED') {
        const method = String(cfg.method || 'get').toLowerCase();
        if (method === 'get') {
          cfg.__npTimeoutRetried = true;
          const prevTimeout = Number(cfg.timeout || api.defaults.timeout || 0);
          cfg.timeout = Math.max(60_000, prevTimeout);
          console.warn(`[API] ⚠ timeout (${prevTimeout}ms). Retrying once with ${cfg.timeout}ms...`);
          try {
            return await api.request(cfg);
          } catch (e) {
            error = e;
          }
        }
      }

      // One-time retry for transient gateway errors (Render/Cloudflare cold start)
      if (cfg && !cfg.__npGatewayRetried && (status === 502 || status === 503 || status === 504)) {
        const method = String(cfg.method || 'get').toLowerCase();
        if (method === 'get') {
          cfg.__npGatewayRetried = true;
          const waitMs = 1200;
          console.warn(`[API] ⚠ gateway (${status}). Retrying once in ${waitMs}ms...`);
          await new Promise((r) => setTimeout(r, waitMs));
          try {
            return await api.request(cfg);
          } catch (e) {
            error = e;
          }
        }
      }
      const shouldFallback =
        isHtml && (status === 429 || status === 503 || status === 403) ||
        // Network timeouts against the public domain are common on mobile networks / WAF.
        (error?.code === 'ECONNABORTED' && String(cfg?.baseURL || '').startsWith('https://'));

      const fallbackBase = resolveDevFallbackBaseUrl();
      const fallbackEnabled = __DEV__ && typeof fallbackBase === 'string' && fallbackBase.trim().length > 0;

      if (fallbackEnabled && cfg && !cfg.__npRetried && shouldFallback) {
        cfg.__npRetried = true;
        console.warn(`[API] ⚠ HTML response (${status}). Retrying once using dev fallback base URL: ${fallbackBase}`);
        cfg.baseURL = fallbackBase;
        try {
          const res = await api.request(cfg);
          // If fallback works once, switch the whole session to local dev API to avoid flip-flopping.
          switchApiToDevFallback(fallbackBase);
          return res;
        } catch (e) {
          // fallthrough to regular logging
          error = e;
        }
      }

      const isAuthMe401 = status === 401 && (url === '/api/auth/me' || url.endsWith('/api/auth/me'));
      const isProfile401 = status === 401 && (url === '/api/profile' || url.endsWith('/api/profile'));
      const isLogout = url === '/api/auth/logout' || url.endsWith('/api/auth/logout');
      // Logout can time out when backend is cold; we still clear local session in UI.
      const suppressLogoutError = isLogout && (error?.code === 'ECONNABORTED' || status === 502 || status === 503 || status === 504);

      if (!isAuthMe401 && !isProfile401 && !suppressLogoutError) {
        if (!silent) {
          console.error(
            `[API] ✗ ${error.config?.method?.toUpperCase?.() || 'GET'} ${error.config?.baseURL || ''}${error.config?.url || ''}`,
            {
              message: error?.message,
              status: error.response?.status,
              data: error.response?.data,
              code: error.code,
            }
          );
        }
      }

      if (isHtml) {
        const friendly =
          status === 429
            ? 'API bloquée (Cloudflare challenge). Désactive le challenge sur /api/* ou utilise un domaine/API sans protection anti-bot pour l’app mobile.'
            : status === 503
              ? 'API indisponible (service suspendu). Vérifie l’hébergeur/DNS du backend.'
              : 'API renvoie du HTML (proxy/anti-bot).';
        const wrapped = new Error(friendly);
        (wrapped as any).cause = error;
        return Promise.reject(wrapped);
      }
      return Promise.reject(error);
    }
  );
}

export default api;


