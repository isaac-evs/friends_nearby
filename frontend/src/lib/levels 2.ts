/**
 * Niveles 1–100: cada uno con su nombre, su color y su diseño de insignia. El 100 es el máximo.
 *
 *  - 10 tramos ("tiers") de 10 niveles. Cada tramo tiene su tono y su forma de insignia.
 *  - Dentro del tramo, la posición (1–10) cambia la luminosidad (de claro a profundo) y cuántos puntos
 *    de la corona de 10 puntos están encendidos. Así no hay dos niveles iguales.
 *  - Los parámetros de color viven en tokens.json → `level` (no son colores sueltos fuera de los tokens).
 */
import tokens from '../../docs/design/tokens.json'

export const MAX_LEVEL = 100
export const TIER_SIZE = 10

export type BadgeShape = 'circle' | 'square' | 'hexagon' | 'shield' | 'diamond' | 'octagon' | 'burst8' | 'star5' | 'scallop' | 'burst16'

export const TIERS: { name: string; blurb: string; shape: BadgeShape }[] = [
  { name: 'Barrio', blurb: 'Estás conociendo a tu gente y tu cuadra.', shape: 'circle' },
  { name: 'Colonia', blurb: 'Ya eres de los que arman el plan.', shape: 'square' },
  { name: 'Ruta', blurb: 'Descubres lugares y los compartes.', shape: 'hexagon' },
  { name: 'Pista', blurb: 'Lo tuyo es moverte: correr, rodar, competir.', shape: 'shield' },
  { name: 'Escena', blurb: 'Organizas y la banda te sigue.', shape: 'diamond' },
  { name: 'Sabiduría', blurb: 'Tu experiencia guía a los demás.', shape: 'octagon' },
  { name: 'Cielo', blurb: 'Brillas lo suficiente para verse de lejos.', shape: 'burst8' },
  { name: 'Titanes', blurb: 'Pocos llegan aquí. Muy pocos se quedan.', shape: 'star5' },
  { name: 'Realeza', blurb: 'La banda te reconoce como autoridad.', shape: 'scallop' },
  { name: 'Mito', blurb: 'Una leyenda que se cuenta en todas las mesas.', shape: 'burst16' },
]

/** Un nombre distinto por nivel (índice = nivel − 1). */
export const LEVEL_NAMES: readonly string[] = [
  // 1–10 · Barrio
  'Recién llegado', 'Curioso', 'Paseante', 'Caminante', 'Vecino', 'Compa', 'Social de barrio', 'Cuate', 'Amigo de la cuadra', 'Líder de la cuadra',
  // 11–20 · Colonia
  'Jalador', 'Jalador estrella', 'Cafetero', 'Tertuliano', 'Anfitrión', 'Anfitrión de barrio', 'Pregonero', 'Conector', 'Alma de la colonia', 'Mero mero de la colonia',
  // 21–30 · Ruta
  'Explorador urbano', 'Rutero', 'Mapeador', 'Brújula', 'Cazaplanes', 'Guía local', 'Descubridor', 'Pionero', 'Cartógrafo', 'Trotamundos',
  // 31–40 · Pista
  'Corredor', 'Fondista', 'Ciclista social', 'Montañista', 'Capitán de equipo', 'Retador', 'Competidor', 'Campeón de barrio', 'Atleta del jale', 'Leyenda local',
  // 41–50 · Escena
  'Organizador', 'Promotor', 'Productor', 'Curador de planes', 'Maestro de ceremonias', 'Estratega', 'Mecenas de jales', 'Embajador', 'Patrono', 'Pilar de la banda',
  // 51–60 · Sabiduría
  'Veterano', 'Veterano de mil jales', 'Sabio del barrio', 'Consejero', 'Mentor', 'Maestro', 'Gran maestro', 'Oráculo de planes', 'Guardián de la banda', 'Faro social',
  // 61–70 · Cielo
  'Estrella naciente', 'Estrella', 'Estrella fugaz', 'Constelación', 'Nebulosa', 'Cometa', 'Aurora', 'Eclipse', 'Supernova', 'Galaxia social',
  // 71–80 · Titanes
  'Titán', 'Coloso', 'Gigante', 'Centinela', 'Paladín', 'Caballero del jale', 'Señor de la banda', 'Barón', 'Conde', 'Duque',
  // 81–90 · Realeza
  'Príncipe', 'Rey del barrio', 'Emperador', 'Semidiós del jale', 'Dios de la tarde', 'Inmortal', 'Eterno', 'Celestial', 'Arcano', 'Soberano',
  // 91–100 · Mito
  'Mítico', 'Épico', 'Legendario', 'Ancestral', 'Primordial', 'Cósmico', 'Universal', 'Infinito', 'Trascendente', 'Máxima leyenda',
]

export interface LevelInfo {
  level: number
  name: string
  /** Tramo 0–9. */
  tier: number
  tierName: string
  blurb: string
  /** Posición dentro del tramo, 1–10 (= puntos encendidos de la corona). */
  rank: number
  shape: BadgeShape
  /** Color de relleno de la insignia y color de texto sobre él (el de mejor contraste). */
  fill: string
  ink: string
  /** Fondo suave del mismo tono. */
  soft: string
  isMax: boolean
}

/** Easter egg: sin XP el nivel 1 baja al 0 y las fallas siguientes a niveles negativos (hasta −9). Con ganar 10 XP vuelves al 1. */
export const MIN_LEVEL = -9
export const clampLevel = (n: number) => Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.round(Number.isFinite(n) ? n : 1)))

// ---- color ----
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const S = s / 100
  const L = l / 100
  const k = (n: number) => (n + h / 30) % 12
  const a = S * Math.min(L, 1 - L)
  const f = (n: number) => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)]
}
const hex = ([r, g, b]: [number, number, number]) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`
const parseHex = (h: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number]

export function luminance(color: string): number {
  const [r, g, b] = parseHex(color).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}

const INK = tokens.color.ink
const WHITE = tokens.color.surface

export function levelInfo(levelIn: number): LevelInfo {
  const level = clampLevel(levelIn)
  if (level <= 0) {
    return {
      level, name: level === 0 ? 'Bajo tierra' : 'Bajo cero', tier: 0, tierName: 'Subsuelo',
      blurb: 'Debes XP. Gana 10 XP y vuelves al nivel 1.', rank: 1, shape: 'circle',
      fill: INK, ink: WHITE, soft: tokens.color['surface-sunken'], isMax: false,
    }
  }
  const tier = Math.floor((level - 1) / TIER_SIZE)
  const rank = ((level - 1) % TIER_SIZE) + 1
  const T = tokens.level
  const hue = T.tierHues[tier]!
  let lightness = T.lightnessFirst + ((T.lightnessLast - T.lightnessFirst) * (rank - 1)) / (TIER_SIZE - 1)
  let fill = hex(hslToRgb(hue, T.saturation, lightness))
  // Zona intermedia: si ni el texto oscuro ni el blanco llegan a AA (4.5:1), se oscurece el color de a un punto.
  while (Math.max(contrast(fill, INK), contrast(fill, WHITE)) < 4.5 && lightness > 10) {
    lightness -= 1
    fill = hex(hslToRgb(hue, T.saturation, lightness))
  }
  return {
    level,
    name: LEVEL_NAMES[level - 1]!,
    tier,
    tierName: TIERS[tier]!.name,
    blurb: TIERS[tier]!.blurb,
    rank,
    shape: TIERS[tier]!.shape,
    fill,
    ink: contrast(fill, INK) >= contrast(fill, WHITE) ? INK : WHITE,
    soft: hex(hslToRgb(hue, T.softSaturation, T.softLightness)),
    isMax: level === MAX_LEVEL,
  }
}
