// Convert any Google Maps URL into an iframe-safe embed URL.
// Regular google.com/maps URLs cannot be iframed (X-Frame-Options: SAMEORIGIN),
// but `https://www.google.com/maps?...&output=embed` can.
export function toEmbedUrl(url: string, fallbackQuery?: string): string {
  if (url) {
    if (/\/maps\/embed/i.test(url)) return url;
    if (/output=embed/i.test(url)) return url;

    // Pattern 1: !3d<lat>!4d<lng>
    let m = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    // Pattern 2: @lat,lng
    if (!m) m = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    // Pattern 3: q=lat,lng
    if (!m) m = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);

    if (m) {
      const [, lat, lng] = m;
      return `https://www.google.com/maps?q=${lat},${lng}&hl=en&z=17&output=embed`;
    }

    // Try place name from /place/<name>/
    const placeMatch = url.match(/\/place\/([^/@]+)/);
    if (placeMatch) {
      return `https://www.google.com/maps?q=${encodeURIComponent(decodeURIComponent(placeMatch[1]))}&output=embed`;
    }
  }

  if (fallbackQuery) {
    return `https://www.google.com/maps?q=${encodeURIComponent(fallbackQuery)}&output=embed`;
  }
  return "";
}
