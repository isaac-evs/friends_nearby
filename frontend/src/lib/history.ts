import type { PlanHistoryItem } from '@/api/schemas'

/** Más reciente primero. */
export const byRecent = (h: PlanHistoryItem[]): PlanHistoryItem[] => [...h].sort((a, b) => b.at.localeCompare(a.at))

export const historyDates = (h: PlanHistoryItem[]): string[] => h.map((x) => x.at)

/** "Con Sofi" / "Con Sofi y Mau" / "Con Sofi, Mau y Dani": siempre TODOS los nombres (los íconos se limitan, los nombres no). */
export function attendeesLabel(names: string[]): string {
  if (names.length === 0) return 'Fuiste tú solo'
  if (names.length === 1) return `Con ${names[0]}`
  return `Con ${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`
}
