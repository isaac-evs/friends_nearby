/**
 * Geo y privacidad de ubicación.
 *
 * PRECISIÓN DOCUMENTADA:
 *  - Nunca hay coordenadas exactas de una persona salvo que ella las comparta, por un rato, con un amigo cercano.
 *  - La ubicación de una persona se redondea a una celda de `CELL_GRID_DEG` (0.002° ≈ 220 m) y se dibuja como un
 *    círculo difuso de `APPROX_RADIUS_M` (500 m). No hay zonas ni colonias: solo esa celda.
 *  - Los planes y eventos SÍ tienen lugar exacto: es un punto de encuentro, no la ubicación de nadie.
 *  - Tu propia ubicación se redondea antes de guardarla o mostrarla; nunca va a analítica ni a logs.
 */

export const CELL_GRID_DEG = 0.002
export const APPROX_RADIUS_M = 500

export interface LatLng {
  lat: number
  lng: number
}

/** MOCK: centro de referencia (Chapultepec, Guadalajara). Solo lo usan `api/mock/*` y las pruebas. */
export const MOCK_ORIGIN: LatLng = { lat: 20.675, lng: -103.365 }

const M_PER_DEG_LAT = 110_574
const mPerDegLng = (lat: number) => 111_320 * Math.cos((lat * Math.PI) / 180)

/** Redondea una coordenada a la celda aproximada (nunca persistas el valor sin redondear). */
export function roundToCell(p: LatLng): LatLng {
  const snap = (v: number) => Math.round(v / CELL_GRID_DEG) * CELL_GRID_DEG
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
