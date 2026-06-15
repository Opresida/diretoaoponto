// Flags antifraude — PROMPT §5 (sync, passo 3) + regra de negócio #6 + §13.2.
// duration_sec < 90 → "short_duration"
// GPS fora do polígono do estrato → "gps_outside"
// consentPhoto=true e photos.length===0 → "missing_photos"
// hash divergente (§13.2) → "hash_mismatch"

export type FraudFlag = "short_duration" | "gps_outside" | "missing_photos" | "hash_mismatch";

interface FraudInput {
  durationSec: number;
  consentPhoto: boolean;
  photoCount: number;
  gpsStart: { lat: number; lng: number };
  censusPolygon: unknown | null; // GeoJSON do estrato (null = sem checagem de GPS)
  hashMismatch: boolean;
}

/** Ray casting sobre o primeiro anel do polígono (GeoJSON [lng,lat]). */
function pointInPolygon(lng: number, lat: number, polygon: unknown): boolean {
  const ring = extractRing(polygon);
  if (!ring || ring.length < 3) return true; // sem polígono utilizável → não flaga
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]![0]!,
      yi = ring[i]![1]!;
    const xj = ring[j]![0]!,
      yj = ring[j]![1]!;
    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function extractRing(polygon: unknown): number[][] | null {
  if (!polygon || typeof polygon !== "object") return null;
  const p = polygon as Record<string, unknown>;
  // GeoJSON Polygon {type:'Polygon', coordinates:[ring,...]}
  if (Array.isArray(p.coordinates)) return (p.coordinates as number[][][])[0] ?? null;
  // GeoJSON Feature {geometry:{coordinates}}
  if (p.geometry && typeof p.geometry === "object") {
    const g = p.geometry as Record<string, unknown>;
    if (Array.isArray(g.coordinates)) return (g.coordinates as number[][][])[0] ?? null;
  }
  // Já um anel cru [[lng,lat],...]
  if (Array.isArray(polygon)) return polygon as unknown as number[][];
  return null;
}

export function computeFraudFlags(input: FraudInput): FraudFlag[] {
  const flags: FraudFlag[] = [];
  if (input.durationSec < 90) flags.push("short_duration");
  if (input.censusPolygon && !pointInPolygon(input.gpsStart.lng, input.gpsStart.lat, input.censusPolygon)) {
    flags.push("gps_outside");
  }
  if (input.consentPhoto && input.photoCount === 0) flags.push("missing_photos");
  if (input.hashMismatch) flags.push("hash_mismatch");
  return flags;
}
