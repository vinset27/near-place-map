/**
 * Centralized API base URL for deployments where the frontend (Cloudflare Pages)
 * and backend (Render) are on different origins.
 *
 * - In dev (same-origin), leave VITE_API_BASE_URL empty and we use relative `/api/...`.
 * - In prod (split-origin), set VITE_API_BASE_URL, e.g. https://near-place-map.onrender.com
 */
export function getApiBase(): string {
  const raw = (import.meta as any).env?.VITE_API_BASE_URL as string | undefined;
  const fromEnv = raw ? String(raw).trim().replace(/\/+$/, "") : "";

  // Fallback for custom-domain deployments where the API is hosted on `api.<domain>`.
  // This makes the app resilient even if the build-time env var wasn't injected (common with direct uploads).
  let fromHost = "";
  if (typeof window !== "undefined") {
    const host = String(window.location.hostname || "").trim();
    const isLocal = host === "localhost" || host === "127.0.0.1";

    // Runtime override for debugging (handy in local dev without rebuilding):
    // - /app?apiBase=http://localhost:5000
    // - /app?apiBase=https://api.binary-security.com
    const readParam = (key: string) => {
      const search = String(window.location.search || "");
      try {
        const sp = new URLSearchParams(search);
        const direct = sp.get(key);
        if (direct) return String(direct);
        // Handle weirdly encoded query where the whole "key=value" becomes the key.
        for (const k of Array.from(sp.keys())) {
          if (k.startsWith(`${key}=`)) return k.slice(key.length + 1);
        }
        const rawQ = search.startsWith("?") ? search.slice(1) : search;
        if (rawQ.includes("%3D")) {
          const decoded = decodeURIComponent(rawQ);
          const sp2 = new URLSearchParams(decoded);
          const v2 = sp2.get(key);
          if (v2) return String(v2);
          for (const k of Array.from(sp2.keys())) {
            if (k.startsWith(`${key}=`)) return k.slice(key.length + 1);
          }
        }
      } catch {
        // ignore
      }
      return "";
    };
    const runtime = readParam("apiBase").trim().replace(/\/+$/, "");

    // Local dev default: keep same-origin API to avoid CORS issues
    // (many users set VITE_API_BASE_URL for prod and forget to unset it locally).
    if (isLocal && !runtime) {
      (window as any).__NEARPLACE_DIAG__ = {
        apiBase: "",
        apiBaseFromEnv: fromEnv || null,
        apiBaseFromHost: null,
        apiBaseFromRuntime: null,
        host,
      };
      return "";
    }

    // Avoid guessing on localhost or on Cloudflare Pages default domains.
    if (host && host !== "localhost" && host !== "127.0.0.1" && !host.endsWith(".pages.dev")) {
      fromHost = `https://api.${host}`;
    }

    // Lightweight runtime diagnostics (helps debug "HTML instead of JSON" issues quickly).
    const base = runtime || fromEnv || fromHost || "";
    (window as any).__NEARPLACE_DIAG__ = {
      apiBase: base,
      apiBaseFromEnv: fromEnv || null,
      apiBaseFromHost: fromHost || null,
      apiBaseFromRuntime: runtime || null,
      host,
    };

    if (!base && host && host !== "localhost" && host !== "127.0.0.1") {
      // eslint-disable-next-line no-console
      console.warn(
        "[NearPlace] API base is empty; requests to '/api/...' will hit the frontend origin. " +
          "Set VITE_API_BASE_URL at build time (Cloudflare Pages) or use a custom domain with api.<domain>.",
        { host },
      );
    }
  }

  return fromEnv || fromHost || "";
}

export function apiUrl(path: string): string {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path;
  const base = getApiBase();
  if (!base) return path;
  if (path.startsWith("/")) return `${base}${path}`;
  return `${base}/${path}`;
}


