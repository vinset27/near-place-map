/**
 * Centralized API base URL for deployments where the frontend (Cloudflare Pages)
 * and backend (Render) are on different origins.
 *
 * - In dev (same-origin), leave VITE_API_BASE_URL empty and we use relative `/api/...`.
 * - In prod (split-origin), set VITE_API_BASE_URL, e.g. https://near-place-map.onrender.com
 */
export function getApiBase(): string {
  const raw = (import.meta as any).env?.VITE_API_BASE_URL as string | undefined;
  if (!raw) return "";
  return String(raw).trim().replace(/\/+$/, "");
}

export function apiUrl(path: string): string {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path;
  const base = getApiBase();
  if (!base) return path;
  if (path.startsWith("/")) return `${base}${path}`;
  return `${base}/${path}`;
}


