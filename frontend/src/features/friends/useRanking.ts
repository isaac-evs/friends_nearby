import { useMemo } from 'react'
import type { User } from '@/api/schemas'
import { ME_ID } from '@/api/me'
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
export function useRanking(scope: RankScope): RankRow[] {
  const { state } = useApp()
  return useMemo(() => {
    const me = state.users[ME_ID]!
    const myTotal = (me.level - 1) * state.xpGoal + state.xp
    return Object.values(state.users)
      .filter((u) => (u.id === ME_ID ? scope === 'amigos' || state.openMode.enabled : !state.blocks.includes(u.id) && (scope === 'global' || state.friendships[u.id]?.status === 'friends')))
      .map((u) => ({ ...u, totalXp: u.id === ME_ID ? myTotal : u.totalXp }))
      .sort((a, b) => b.totalXp - a.totalXp)
      .map((u, i) => ({ ...u, rank: i + 1, mine: u.id === ME_ID }))
  }, [scope, state.users, state.friendships, state.blocks, state.openMode.enabled, state.xp, state.xpGoal])
}
