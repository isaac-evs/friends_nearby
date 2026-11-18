/**
 * Contratos del frontend (Zod). Mientras no haya backend los datos salen de `api/mock/seed.ts`
 * y se validan contra estos esquemas. Ver README → "Contratos propuestos".
 */
import { z } from 'zod'

export const PlanCategory = z.enum(['cafe', 'comer', 'correr', 'estudiar', 'gym', 'chill', 'antro', 'juegos'])
export type PlanCategory = z.infer<typeof PlanCategory>

export const EventType = z.enum(['correr', 'deporte', 'juegos', 'comida', 'clase', 'musica', 'arte', 'otro'])
export type EventType = z.infer<typeof EventType>

export const Audience = z.enum(['amigos', 'roomies', 'abierto'])
export type Audience = z.infer<typeof Audience>

export const EventAudience = z.enum(['amigos', 'amigos+', 'abierto'])
export type EventAudience = z.infer<typeof EventAudience>

export const LatLng = z.object({ lat: z.number(), lng: z.number() })

/** Zona aproximada. El centro ya viene redondeado (ver lib/geo.ts). */
export const Zone = z.object({
  name: z.string(),
  center: LatLng,
  radiusM: z.number(),
  approxDistanceM: z.number(),
})
export type Zone = z.infer<typeof Zone>

export const User = z.object({
  id: z.string(),
  name: z.string(),
  handle: z.string(),
  city: z.string().optional(),
  level: z.number().int(),
  levelTitle: z.string().optional(),
  streakWeeks: z.number().int(),
  hangouts: z.number().int(),
  eventsCount: z.number().int(),
  pace: z.string().optional(),
  interests: z.string().optional(),
  /** Si hay alguien más con ranking opt-in. */
  rankingOptIn: z.boolean().default(false),
  weeklyXp: z.number().int().default(0),
  /** Contexto de "se conocieron en…" (solo perfiles de otras personas). */
  metAt: z.object({ eventTitle: z.string(), whenIso: z.string() }).optional(),
})
export type User = z.infer<typeof User>

export const FriendshipStatus = z.enum(['none', 'requested_out', 'requested_in', 'friends'])
export type FriendshipStatus = z.infer<typeof FriendshipStatus>

export const Friendship = z.object({
  userId: z.string(),
  status: FriendshipStatus,
  mutualFriendIds: z.array(z.string()),
  /** Pausa de ubicación del amigo: no se ve su zona. */
  locationPaused: z.boolean().default(false),
})
export type Friendship = z.infer<typeof Friendship>

/** Card de amigo. */
export const Plan = z.object({
  id: z.string(),
  authorId: z.string(),
  category: PlanCategory,
  line: z.string(),
  startsAt: z.string().optional(),
  expiresAt: z.string(),
  audience: Audience,
  zone: Zone,
  joinedCount: z.number().int(),
  /** Última vez que su zona se actualizó (antigüedad "hace 3 min"). */
  zoneUpdatedAt: z.string(),
  meetPoint: z.string(),
})
export type Plan = z.infer<typeof Plan>

export const Event = z.object({
  id: z.string(),
  type: EventType,
  subtype: z.string(),
  title: z.string(),
  startsAt: z.string(),
  placeName: z.string(),
  placeNote: z.string().optional(),
  center: LatLng,
  approxDistanceM: z.number(),
  capacity: z.number().int(),
  going: z.number().int(),
  organizer: z.object({ name: z.string(), verified: z.boolean(), eventsCount: z.number().int() }),
  audience: EventAudience,
  requiresApproval: z.boolean(),
  paces: z.array(z.string()).optional(),
  friendsGoingIds: z.array(z.string()),
  xp: z.number().int(),
  audienceNote: z.string().optional(),
})
export type Event = z.infer<typeof Event>

export const SwipeAction = z.enum(['pass', 'later', 'join'])
export type SwipeAction = z.infer<typeof SwipeAction>
export const Swipe = z.object({ targetId: z.string(), kind: z.enum(['plan', 'event']), action: SwipeAction })
export type Swipe = z.infer<typeof Swipe>

/** `exactShareUntil`: hasta cuándo ambos ven la ubicación exacta del otro. */
export const Match = z.object({
  id: z.string(),
  planId: z.string(),
  friendId: z.string(),
  createdAt: z.string(),
  exactShareUntil: z.string(),
  meetPoint: z.string(),
  quickMessage: z.string().nullable(),
  myConfirmed: z.boolean(),
  theirConfirmed: z.boolean(),
  rewarded: z.boolean(),
})
export type Match = z.infer<typeof Match>

export const Attendance = z.object({
  eventId: z.string(),
  pace: z.string().optional(),
  joinedAt: z.string(),
  /** `pending` cuando el evento pide aprobación del organizador. */
  status: z.enum(['going', 'pending']),
})
export type Attendance = z.infer<typeof Attendance>

export const XpEvent = z.object({ id: z.string(), amount: z.number().int(), reason: z.string(), at: z.string() })
export type XpEvent = z.infer<typeof XpEvent>

export const Badge = z.object({
  id: z.string(),
  label: z.string(),
  icon: z.enum(['star', 'sun', 'compass', 'users', 'activity', 'flame']),
  tile: z.string(),
  progress: z.object({ current: z.number(), goal: z.number() }).optional(),
  earned: z.boolean(),
})
export type Badge = z.infer<typeof Badge>

export const Block = z.object({ userId: z.string(), at: z.string() })
export const Report = z.object({ userId: z.string(), reason: z.string(), at: z.string() })
