// Flags antifraude — PROMPT §5 (lógica do sync, passo 3) + regra de negócio #6.
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
  censusPolygon: unknown | null; // GeoJSON do estrato
  hashMismatch: boolean;
}

export function computeFraudFlags(_input: FraudInput): FraudFlag[] {
  // TODO §5.3: implementar as 4 regras. point-in-polygon p/ gps_outside
  // (usar census_polygon do estrato; se null, não flagar GPS).
  throw new Error("not implemented — PROMPT §5.3");
}
