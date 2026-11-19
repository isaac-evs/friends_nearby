import type { User } from '@/api/schemas'
import { useApp } from '@/app/store'

export type RankScope = 'global' | 'amigos'
export type RankRow = User & { rank: number; mine: boolean }

/**
 * Ranking de siempre (XP total acumulado), OBLIGATORIO: todas las personas participan (no hay opt-in).
 * `global`: toda la gente que tiene el MODO ABIERTO activo (solo se ve su nombre, nivel y XP; si tú no lo activaste, no
 * ves el global ni apareces en él); `amigos`: solo tus amigos aceptados.
 * Quien bloqueaste no sale. Tu XP total sale de tu nivel y tu XP actual: (nivel − 1) × meta + XP.
 * [PROPUESTA] backend: Redis sorted set global (`ZINCRBY` al sumar XP, `ZREVRANGE` top, `ZREVRANK` tu lugar).
 */
export function useRanking(scope: RankScope): RankRow[] { return useApp().state.rankings[scope] }
