export function normalizePhone(raw?: string | null): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  // Keep digits, keep a leading '+' if present.
  let cleaned = trimmed.replace(/[^\d+]/g, "");
  cleaned = cleaned.replace(/(?!^\+)\+/g, ""); // remove '+' not at start

  if (cleaned.startsWith("+")) {
    const digits = cleaned.slice(1).replace(/[^\d]/g, "");
    if (digits.length < 6) return null;
    return `+${digits}`;
  }

  const digits = cleaned.replace(/[^\d]/g, "");
  if (digits.length < 6) return null;
  return digits;
}

export function telHref(phone?: string | null): string | null {
  const p = normalizePhone(phone);
  return p ? `tel:${p}` : null;
}

export function googleMapsLatLngUrl(lat: number, lng: number): string {
  // Works on mobile & desktop; opens in Google Maps app when available.
  const q = `${lat},${lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function telegramShareUrl(params: { text: string; url?: string }): string {
  const u = new URL("https://t.me/share/url");
  if (params.url) u.searchParams.set("url", params.url);
  if (params.text) u.searchParams.set("text", params.text);
  return u.toString();
}

export function smsShareHref(body: string): string {
  // iOS/Android generally support this form.
  return `sms:?&body=${encodeURIComponent(body)}`;
}

export function buildPlaceShareText(input: {
  name: string;
  address?: string | null;
  commune?: string | null;
  lat: number;
  lng: number;
}): string {
  const whereParts = [input.address, input.commune].filter(Boolean);
  const where = whereParts.length ? `\n${whereParts.join(" • ")}` : "";
  const maps = googleMapsLatLngUrl(input.lat, input.lng);
  return `Position: ${input.name}${where}\n${maps}`;
}

export function openExternal(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}


