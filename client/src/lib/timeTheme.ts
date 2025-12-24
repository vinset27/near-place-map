export function shouldUseDarkAt(date: Date): boolean {
  const minutes = date.getHours() * 60 + date.getMinutes();
  const start = 20 * 60 + 27; // 20:27
  const end = 6 * 60 + 27; // 06:27
  return minutes >= start || minutes < end;
}

export function applyTimeTheme(date = new Date()): void {
  const dark = shouldUseDarkAt(date);
  document.documentElement.classList.toggle("dark", dark);
}

/**
 * Keeps the default theme in sync with time while the app stays open.
 * Updates once per minute.
 */
export function startTimeThemeSync(): () => void {
  applyTimeTheme();
  const id = window.setInterval(() => applyTimeTheme(), 60_000);
  return () => window.clearInterval(id);
}


