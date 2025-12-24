export const MAPBOX_TOKEN =
  // Prefer env at build-time for deployment. Keep fallback for local dev.
  (import.meta as any).env?.VITE_MAPBOX_TOKEN ||
  "pk.eyJ1IjoidHJvdXZlcmNoYXAiLCJhIjoiY21qZzk4ZHExMTE2cjNkc2R5YnhvYnRqYyJ9.kLaJ7Fd3pBs8NzF6vOTwcA";



