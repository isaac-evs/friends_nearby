export const ME_ID = 'me'
export const ZONES = ['Chapultepec', 'Providencia', 'Colomos', 'ITESO', 'Centro', 'Andares'] as const
const CENTERS: Record<string, { lat: number; lng: number }> = {
  Chapultepec: { lat: 20.675, lng: -103.365 }, Providencia: { lat: 20.700, lng: -103.380 },
  Colomos: { lat: 20.706, lng: -103.392 }, ITESO: { lat: 20.608, lng: -103.416 },
  Centro: { lat: 20.677, lng: -103.347 }, Andares: { lat: 20.710, lng: -103.412 },
}
export const zoneCenter = (name: string) => CENTERS[name]
