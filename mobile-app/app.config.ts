import fs from 'fs';
import path from 'path';

function parseDotEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function readRootEnv(): Record<string, string> {
  try {
    const rootEnvPath = path.resolve(__dirname, '..', '.env');
    if (!fs.existsSync(rootEnvPath)) return {};
    const text = fs.readFileSync(rootEnvPath, 'utf8');
    return parseDotEnv(text);
  } catch {
    return {};
  }
}

export default ({ config }: any) => {
  const rootEnv = readRootEnv();

  const port = rootEnv.PORT ? Number(rootEnv.PORT) : undefined;
  const viteApiBase = (rootEnv.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');
  const mapboxToken = (rootEnv.VITE_MAPBOX_TOKEN || '').trim();

  // Allow a dedicated variable for mobile if present.
  const mobileApiBase =
    (rootEnv.EXPO_PUBLIC_API_BASE_URL || '').trim().replace(/\/+$/, '') ||
    (rootEnv.API_BASE_URL || '').trim().replace(/\/+$/, '') ||
    viteApiBase;

  const googleMapsKey =
    (rootEnv.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '').trim() ||
    (rootEnv.GOOGLE_MAPS_API_KEY || '').trim() ||
    // In some setups there is only GOOGLE_PLACES_API_KEY; it can also authorize Directions API if enabled.
    (rootEnv.GOOGLE_PLACES_API_KEY || '').trim();

  return {
    ...config,
    extra: {
      ...(config.extra || {}),
      // Expose backend settings computed from repo root .env
      api: {
        baseUrl: mobileApiBase || null,
        port: Number.isFinite(port) ? port : null,
        // Keep reference to the web env var for debugging
        viteApiBase: viteApiBase || null,
      },
      // Expose optional Google key for Directions (navigation screen)
      google: {
        mapsApiKey: googleMapsKey || null,
      },
      mapbox: {
        token: mapboxToken || null,
      },
    },
  };
};


