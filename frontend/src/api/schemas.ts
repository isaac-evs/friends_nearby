/**
 * Contratos del frontend (Zod). Las pantallas leen SIEMPRE a través de `api/client.ts`; mientras no haya backend, el
 * cliente usa `api/mock/` y valida contra estos esquemas. Ver docs/especificacion.md §7.
 */
import { z } from 'zod'
import { passwordRules } from '@/lib/password'

export const PlanCategory = z.enum(['cafe', 'comer', 'correr', 'estudiar', 'gym', 'chill', 'fiesta', 'juegos'])
export type PlanCategory = z.infer<typeof PlanCategory>

export const EventType = z.enum(['correr', 'deporte', 'juegos', 'comida', 'clase', 'musica', 'arte', 'otro'])
export type EventType = z.infer<typeof EventType>

/**
 * Quién se puede UNIR a un plan. Un plan solo lo ven tus amigos; `friends_and_guests` además deja que quienes ya van
 * inviten a sus propios amigos (aunque no sean amigos de quien organiza). Esos invitados entran por la invitación y
 * NO aparecen en el mapa de nadie: el mapa solo muestra amigos.
 */
export const JoinPolicy = z.enum(['friends', 'friends_and_guests'])
export type JoinPolicy = z.infer<typeof JoinPolicy>

/** Los EVENTOS son siempre públicos (con el modo abierto); lo local y entre amigos son los planes. Se puede invitar a amigos. */

/** Disponibilidad (opcional): independiente de la cercanía y de los permisos de ubicación. */
/** Disponible (por defecto) u ocupado. */
export const Availability = z.enum(['available', 'busy'])
export type Availability = z.infer<typeof Availability>

export const LatLng = z.object({ lat: z.number(), lng: z.number() })

export const User = z.object({
  id: z.string(),
  name: z.string(),
  handle: z.string(),
  city: z.string().optional(),
  /** 1–100. El nombre, color y diseño salen de `lib/levels.ts`. */
  level: z.number().int().min(1).max(100),
  /** Descripción del perfil (hasta 160 caracteres). */
  bio: z.string().max(160).optional(),
  /** Cómo está (opcional). No cambia quién ve tu ubicación. */
  availability: Availability.optional(),
  streakWeeks: z.number().int(),
  /** Cuántos amigos tiene (público en su perfil). Tuyo: sale de tus amistades. */
  friendsCount: z.number().int().optional(),
  hangouts: z.number().int(),
  eventsCount: z.number().int(),
  pace: z.string().optional(),
  interests: z.string().optional(),
  /** Si hay alguien más con ranking opt-in. */
  /** XP de siempre (para el ranking, que es obligatorio). Tuyo: sale de tu nivel y tu XP actual. */
  totalXp: z.number().int().default(0),
  /** Contexto de "se conocieron en…" (solo perfiles de otras personas). */
  metAt: z.object({ eventTitle: z.string(), whenIso: z.string() }).optional(),
  /** Foto de perfil y portada. Mock: URL de objeto local. Real: URL de CloudFront (propuesta). */
  avatarUrl: z.string().optional(),
  coverUrl: z.string().optional(),
})
export type User = z.infer<typeof User>

/** Editar perfil → descripción. */
export const ProfileBioInput = z.object({ bio: z.string().trim().max(160, 'Máximo 160 caracteres.') })

/** Editar perfil → nombre. */
export const ProfileNameInput = z.object({
  name: z.string().trim().min(2, 'Dinos cómo te llamas (mínimo 2 letras).').max(40, 'Máximo 40 caracteres.'),
})

/** Editar perfil → cambiar contraseña. Las reglas visibles salen de `lib/password.ts`. */
export const PasswordChangeInput = z
  .object({
    current: z.string().min(1, 'Escribe tu contraseña actual.'),
    next: z.string(),
    confirm: z.string(),
  })
  .superRefine((v, ctx) => {
    const failed = passwordRules(v.next).find((r) => !r.ok)
    if (failed) ctx.addIssue({ code: 'custom', path: ['next'], message: `La contraseña nueva debe tener ${failed.label.toLowerCase()}.` })
    else if (v.next === v.current) ctx.addIssue({ code: 'custom', path: ['next'], message: 'La nueva contraseña debe ser distinta de la actual.' })
    if (v.confirm !== v.next) ctx.addIssue({ code: 'custom', path: ['confirm'], message: 'Las contraseñas no coinciden.' })
  })
export type PasswordChangeInput = z.infer<typeof PasswordChangeInput>

export const FriendshipStatus = z.enum(['none', 'requested_out', 'requested_in', 'friends'])
export type FriendshipStatus = z.infer<typeof FriendshipStatus>

/**
 * Amigo cercano: relación de DOS vías con solicitud aparte (los dos tienen que aceptar).
 * Solo `mutual` se ven la ubicación aproximada (regla en lib/privacy.ts). La ubicación exacta no sale de aquí:
 * se comparte aparte, por un rato y quien comparte decide (`ExactShare`).
 */
export const CloseStatus = z.enum(['none', 'requested_out', 'requested_in', 'mutual'])
export type CloseStatus = z.infer<typeof CloseStatus>

export const Friendship = z.object({
  userId: z.string(),
  status: FriendshipStatus,
  mutualFriendIds: z.array(z.string()),
  /** Pausa de ubicación del amigo: no se ve su ubicación. */
  locationPaused: z.boolean().default(false),
  /** Amigo cercano: solicitud aparte y mutua. Un amigo nuevo empieza en `none`. */
  close: CloseStatus.default('none'),
})
export type Friendship = z.infer<typeof Friendship>

/**
 * Lugar exacto de un plan: nombre + punto en el mapa. No es la ubicación de nadie: es dónde será el plan.
 * `placeId` solo existe si vino de un proveedor de lugares ([PROPUESTA] Amazon Location); hoy se escribe el nombre y se
 * marca el punto en el mapa.
 */
export const PlanPlace = z.object({ name: z.string(), address: z.string().optional(), placeId: z.string().optional(), center: LatLng })
export type PlanPlace = z.infer<typeof PlanPlace>

/** Plan de un amigo. El lugar es OBLIGATORIO. La distancia no se guarda: se calcula contra tu ubicación aproximada. */
export const Plan = z.object({
  id: z.string(),
  authorId: z.string(),
  category: PlanCategory,
  line: z.string(),
  /** Hora de inicio y cuánto dura. `expiresAt` = `startsAt` + `durationMin`. */
  startsAt: z.string(),
  durationMin: z.number().int().min(5),
  expiresAt: z.string(),
  joinPolicy: JoinPolicy.default('friends'),
  joinedCount: z.number().int(),
  /** Límite de personas (opcional). Sin límite = abierto a quien pueda unirse. */
  capacity: z.number().int().min(2).optional(),
  /** Quiénes van además de quien organiza (ids). Real: `GET /plans/{id}` → members. */
  memberIds: z.array(z.string()).optional(),
  place: PlanPlace,
  photoUrl: z.string().optional(),
  /** ¿Se puede unir gente cuando el plan ya empezó (en curso)? Lo decide quien lo organiza. */
  lateJoin: z.boolean().default(true),
})
export type Plan = z.infer<typeof Plan>

export const Event = z.object({
  id: z.string(),
  type: EventType,
  subtype: z.string(),
  title: z.string(),
  startsAt: z.string(),
  /** Hora de fin (no duración). Si es menor que el inicio, el evento termina al día siguiente. */
  endsAt: z.string(),
  placeName: z.string(),
  placeNote: z.string().optional(),
  center: LatLng,
  capacity: z.number().int(),
  going: z.number().int(),
  /** `alias`: nombre con el que se presenta (un club, un grupo). El nombre real SIEMPRE se muestra aparte. */
  organizer: z.object({ name: z.string(), alias: z.string().optional(), verified: z.boolean(), eventsCount: z.number().int() }),
  /** Quién lo organiza (para saber cuáles son tuyos). */
  organizerId: z.string().optional(),
  photoUrl: z.string().optional(),
  /** ¿Se puede unir gente cuando el evento ya empezó? Lo decide quien lo organiza. */
  lateJoin: z.boolean().default(true),
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

/**
 * `togetherAt`: cuándo el sistema verificó que están juntos. La verificación usa la ubicación una sola vez, solo el
 * sistema la ve (ni la otra persona ni tú ven coordenadas).
 */
export const Match = z.object({
  id: z.string(),
  planId: z.string(),
  friendId: z.string(),
  createdAt: z.string(),
  togetherAt: z.string().nullable(),
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

/**
 * Dónde está un amigo ahora (celda aproximada, ya redondeada) aunque no tenga un plan activo.
 * Solo se muestra de tus amigos cercanos y sin pausa de ubicación. `updatedAt` permite decir "hace 12 min".
 */
export const Presence = z.object({ userId: z.string(), cell: LatLng, updatedAt: z.string() })
export type Presence = z.infer<typeof Presence>

/**
 * Un plan o evento al que fuiste (historial PRIVADO: solo lo ves tú). Guarda el título, el nombre del lugar público,
 * cuándo fue y quiénes fueron (solo nombre y avatar). Nunca coordenadas. Alimenta tu racha.
 */
export const PlanHistoryItem = z.object({
  id: z.string(),
  kind: z.enum(['plan', 'evento']),
  title: z.string(),
  categoryLabel: z.string(),
  placeName: z.string(),
  at: z.string(),
  attendeeIds: z.array(z.string()),
})
export type PlanHistoryItem = z.infer<typeof PlanHistoryItem>

/**
 * Ubicación exacta TEMPORAL entre amigos cercanos. Quien comparte decide a quién y por cuánto; se apaga sola
 * y se puede cortar antes. `userId` es la otra persona; `until` es cuándo termina.
 */
export const ExactShare = z.object({ userId: z.string(), until: z.string() })
export type ExactShare = z.infer<typeof ExactShare>

/** Nombre de usuario: 3–20, minúsculas, números, punto y guion bajo; sin punto al inicio/fin ni dos puntos seguidos. */
export const RESERVED_HANDLES = ['admin', 'jalas', 'soporte', 'ayuda', 'moderacion', 'moderador']
export const UsernameInput = z.object({
  username: z.string().trim().toLowerCase()
    .min(3, 'Mínimo 3 caracteres.').max(20, 'Máximo 20 caracteres.')
    .regex(/^[a-z0-9._]+$/, 'Solo letras minúsculas, números, punto y guion bajo.')
    .refine((v) => !v.startsWith('.') && !v.endsWith('.') && !v.includes('..'), 'No puede empezar ni terminar con punto, ni tener dos puntos seguidos.')
    .refine((v) => !RESERVED_HANDLES.includes(v), 'Ese nombre de usuario no está disponible.'),
})

/** Invitación a un plan o evento. Quien la recibe la ve en Notificaciones y la acepta o rechaza. */
export const Invite = z.object({
  id: z.string(),
  kind: z.enum(['plan', 'evento']),
  targetId: z.string(),
  title: z.string(),
  fromId: z.string(),
  toId: z.string(),
  status: z.enum(['pending', 'accepted', 'declined']),
  at: z.string(),
})
export type Invite = z.infer<typeof Invite>

export const Block = z.object({ userId: z.string(), at: z.string() })
export const Report = z.object({ userId: z.string(), reason: z.string(), at: z.string() })
