import { useApp } from '@/app/store'

/** Lo que espera tu respuesta: invitaciones a planes/eventos, solicitudes de amigo cercano y solicitudes de amistad. */
export function useNotifications() {
  const { state } = useApp()
  const visible = (id: string) => !state.blocks.includes(id)
  const invites = state.invites.filter((i) => i.toId === 'me' && i.status === 'pending' && visible(i.fromId))
  const closeReq = Object.values(state.friendships).filter((f) => f.status === 'friends' && f.close === 'requested_in' && visible(f.userId))
  const friendReq = Object.values(state.friendships).filter((f) => f.status === 'requested_in' && visible(f.userId))
  const replies = state.invites.filter((i) => i.fromId === 'me' && i.status !== 'pending' && visible(i.toId)).sort((a, b) => b.at.localeCompare(a.at))
  const encounters = state.matches.filter(m => !m.myConfirmed && state.plans.some(p => p.id === m.planId && p.authorId === 'me'))
  const exactRequests = state.exactRequests.filter(visible)
  return { invites, closeReq, friendReq, replies, encounters, exactRequests, count: invites.length + closeReq.length + friendReq.length + encounters.length + exactRequests.length }
}
