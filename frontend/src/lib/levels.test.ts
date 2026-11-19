import { describe, expect, it } from 'vitest'
import { clampLevel, contrast, LEVEL_NAMES, levelInfo, MAX_LEVEL, TIERS } from './levels'

const all = Array.from({ length: MAX_LEVEL }, (_, i) => levelInfo(i + 1))

describe('niveles 1–100', () => {
  it('hay exactamente 100 niveles, el 100 es el máximo', () => {
    expect(LEVEL_NAMES).toHaveLength(100)
    expect(TIERS).toHaveLength(10)
    expect(all.filter((l) => l.isMax).map((l) => l.level)).toEqual([100])
  })
  it('cada nivel tiene un nombre distinto', () => {
    expect(new Set(all.map((l) => l.name)).size).toBe(100)
    expect(all.every((l) => l.name.trim().length > 0)).toBe(true)
  })
  it('cada nivel tiene un color distinto', () => {
    expect(new Set(all.map((l) => l.fill)).size).toBe(100)
  })
  it('cada nivel tiene un diseño distinto (forma + puntos encendidos + color)', () => {
    expect(new Set(all.map((l) => `${l.shape}-${l.rank}-${l.fill}`)).size).toBe(100)
    expect(new Set(all.map((l) => l.shape)).size).toBe(10)
  })
  it('el texto sobre el color cumple contraste AA (4.5:1) en los 100 niveles', () => {
    const bad = all.filter((l) => contrast(l.fill, l.ink) < 4.5).map((l) => `${l.level} ${l.fill} ${contrast(l.fill, l.ink).toFixed(2)}`)
    expect(bad).toEqual([])
  })
  it('conserva el nombre del seed y limita el rango', () => {
    expect(levelInfo(7).name).toBe('Social de barrio')
    expect(clampLevel(0)).toBe(0) // easter egg: nivel 0
    expect(clampLevel(-50)).toBe(-9)
    expect(clampLevel(250)).toBe(100)
    expect(clampLevel(Number.NaN)).toBe(1)
    expect(levelInfo(100).name).toBe('Máxima leyenda')
    expect(levelInfo(0).name).toBe('Bajo tierra')
    expect(levelInfo(-3).name).toBe('Bajo cero')
    expect(contrast(levelInfo(0).fill, levelInfo(0).ink)).toBeGreaterThanOrEqual(4.5)
  })
})
