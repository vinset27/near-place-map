export function isNearPlaceDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("debug") === "1") return true;
  } catch {
    // ignore
  }
  try {
    return window.localStorage.getItem("NEARPLACE_DEBUG") === "1";
  } catch {
    return false;
  }
}

export function debugLog(...args: any[]) {
  if (!isNearPlaceDebugEnabled()) return;
  // eslint-disable-next-line no-console
  console.log("[NearPlace]", ...args);
}


