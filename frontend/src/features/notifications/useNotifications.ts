import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { api, ME_ID } from '@/api/client'
import { useApp } from '@/app/store'
import { useNow } from '@/app/hooks'
import { applyPrefs, badgeOf, buildFeed, withoutDismissed, DEFAULT_PREFS, groupFeed, needsAction, type NotificationItem, type NotificationPrefs, type PrefKey } from '@/lib/notifications'

// Preferencias y "leído hasta": se comparten entre la campana, la pantalla y el menú.
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }
let version = 0
const snapshot = () => version
const bump = () => { version++; emit() }

/**
 * Centro de notificaciones: lo que espera tu respuesta (`count`, el badge numérico), lo nuevo que no pide nada (`dot`)
 * y la lista agrupada. Las preferencias apagan tipos; in-app siempre para lo que pide respuesta.
 */
export function useNotifications() {
  const { state } = useApp()
  useSyncExternalStore(subscribe, snapshot)
  const now = useNow(30_000)
  const userId = state.session?.userId ?? ME_ID
  const prefs: NotificationPrefs = { ...DEFAULT_PREFS, ...api.notifications.prefs(userId) }
  const readAt = api.notifications.readAt(userId)
  const dismissed = api.notifications.dismissed(userId)

  const items = useMemo<NotificationItem[]>(() => withoutDismissed(applyPrefs(buildFeed({
    me: ME_ID, now, blocks: state.blocks, plans: state.plans, events: state.events, invites: state.invites,
    friendships: state.friendships, exactRequests: state.exactRequests, friendDistances: state.friendDistances,
  }), prefs), dismissed), [now, state.blocks, state.plans, state.events, state.invites, state.friendships, state.exactRequests, state.friendDistances, JSON.stringify(prefs), dismissed.join()]) // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => groupFeed(items), [items])
  const badge = badgeOf(items, readAt)
  const setPref = useCallback((key: PrefKey, on: boolean) => { api.notifications.savePrefs(userId, { ...api.notifications.prefs(userId), [key]: on }); bump() }, [userId])
  const markAllRead = useCallback(() => { api.notifications.markRead(userId, Date.now()); bump() }, [userId])

  const dismiss = useCallback((ids: string[]) => { api.notifications.setDismissed(userId, [...new Set([...api.notifications.dismissed(userId), ...ids])]); bump() }, [userId])
  const restore = useCallback((ids: string[]) => { api.notifications.setDismissed(userId, api.notifications.dismissed(userId).filter((x) => !ids.includes(x))); bump() }, [userId])
  return { items, groups, prefs, setPref, readAt, markAllRead, dismiss, restore, count: badge.count, unread: badge.unread, total: badge.total, dot: badge.dot, pending: items.filter(needsAction).length }
}
