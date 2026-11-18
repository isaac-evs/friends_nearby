/**
 * Geo y privacidad de ubicación.
 *
 * PRECISIÓN DOCUMENTADA (regla de privacidad del brief):
 *  - El cliente nunca recibe ni calcula el punto exacto de otra persona fuera de un match activo.
 *  - Las zonas se entregan con el centro redondeado a `ZONE_GRID_DEG` (0.002° ≈ 220 m) y un radio
 *    `ZONE_RADIUS_M` (500 m). Es decir, una zona es un círculo de ~1 km de diámetro.
 *  - Tu propia ubicación se redondea con `roundToZone` antes de guardarla o mostrarla; nunca se
 *    envía a analítica ni a logs.
 */

export const ZONE_GRID_DEG = 0.002
export const ZONE_RADIUS_M = 500

export interface LatLng {
  lat: number
  lng: number
}

/** Centro de referencia del mock (Chapultepec, Guadalajara). */
export const MOCK_ORIGIN: LatLng = { lat: 20.675, lng: -103.365 }

const M_PER_DEG_LAT = 110_574
const mPerDegLng = (lat: number) => 111_320 * Math.cos((lat * Math.PI) / 180)

/** Redondea una coordenada a la cuadrícula de zona (nunca persistas el valor sin redondear). */
export function roundToZone(p: LatLng): LatLng {
  const snap = (v: number) => Math.round(v / ZONE_GRID_DEG) * ZONE_GRID_DEG
  return { lat: Number(snap(p.lat).toFixed(4)), lng: Number(snap(p.lng).toFixed(4)) }
}

/** Desplazamiento en metros (este, norte) respecto a un origen → coordenada. Solo para el mock. */
export function offsetMeters(origin: LatLng, eastM: number, northM: number): LatLng {
  return {
    lat: origin.lat + northM / M_PER_DEG_LAT,
    lng: origin.lng + eastM / mPerDegLng(origin.lat),
  }
}

/** Distancia en metros entre dos coordenadas (aprox. plana, suficiente para el mock). */
export function distanceM(a: LatLng, b: LatLng): number {
  const dx = (b.lng - a.lng) * mPerDegLng(a.lat)
  const dy = (b.lat - a.lat) * M_PER_DEG_LAT
  return Math.hypot(dx, dy)
}

/** Polígono (GeoJSON) que aproxima un círculo de `radiusM` metros alrededor de `center`. */
export function circlePolygon(center: LatLng, radiusM: number, steps = 64): { type: 'Polygon'; coordinates: [number, number][][] } {
  const ring: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI
    const p = offsetMeters(center, Math.cos(a) * radiusM, Math.sin(a) * radiusM)
    ring.push([p.lng, p.lat])
  }
  return { type: 'Polygon', coordinates: [ring] }
}
