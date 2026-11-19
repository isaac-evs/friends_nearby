/**
 * Datos de ejemplo (tomados de los mockups). Todas las fechas son relativas a "ahora" para que
 * el mock nunca quede obsoleto. Las celdas de ubicación ya vienen redondeadas (lib/geo.ts → roundToCell).
 * MOCK: nada de esto vive en pantallas; entra solo por `api/client.ts`.
 */
import type { Badge, Event, Friendship, Invite, Plan, PlanHistoryItem, Presence, User } from '../schemas'
import { MOCK_ORIGIN, offsetMeters, roundToCell } from '@/lib/geo'
import { ME_ID } from '../me'

const MIN = 60_000
const now = () => Date.now()
const inMin = (m: number) => new Date(now() + m * MIN).toISOString()

/** Próxima ocurrencia de un día de la semana (0 = domingo) a cierta hora. */
function nextWeekday(dow: number, hour: number, minute = 0): string {
  const d = new Date()
  d.setHours(hour, minute, 0, 0)
  let add = (dow - d.getDay() + 7) % 7
  if (add === 0 && d.getTime() < now()) add = 7
  d.setDate(d.getDate() + add)
  return d.toISOString()
}

const cellAt = (eastM: number, northM: number) => roundToCell(offsetMeters(MOCK_ORIGIN, eastM, northM))

const placeAt = (eastM: number, northM: number) => offsetMeters(MOCK_ORIGIN, eastM, northM)
const endsAfter = (startIso: string, min: number) => new Date(new Date(startIso).getTime() + min * MIN).toISOString()

export const SEED_USERS: User[] = [
  { id: ME_ID, name: 'Alan', handle: '@alan', level: 7, bio: 'Corro en las mañanas y tomo café en las tardes. Siempre con ganas de jalar.', streakWeeks: 4, hangouts: 9, eventsCount: 6, totalXp: 3340 },
  { id: 'sofi', name: 'Sofi', availability: 'available', handle: '@sofi', level: 6, bio: 'Café, brunch y conversaciones largas.', streakWeeks: 3, friendsCount: 24, hangouts: 12, eventsCount: 4, totalXp: 2860 },
  { id: 'mau', name: 'Mau', availability: 'busy', handle: '@mau', level: 8, bio: 'Fondista de fin de semana. Pregunta por el próximo 5K.', streakWeeks: 6, friendsCount: 31, hangouts: 20, eventsCount: 9, totalXp: 3990 },
  { id: 'regina', name: 'Regina', handle: '@regina', level: 4, streakWeeks: 1, friendsCount: 12, hangouts: 7, eventsCount: 2, totalXp: 1720 },
  { id: 'dani', name: 'Dani', availability: 'busy', handle: '@dani', level: 5, streakWeeks: 2, friendsCount: 18, hangouts: 10, eventsCount: 3, totalXp: 2310 },
  { id: 'leo', name: 'Leo', handle: '@leo', level: 3, streakWeeks: 0, friendsCount: 9, hangouts: 4, eventsCount: 1, totalXp: 1240 },
  { id: 'nico', name: 'Nico', availability: 'available', handle: '@nico', level: 9, bio: 'Siempre cerca de la cancha. Cuando no hay plan, estoy chilling.', streakWeeks: 1, friendsCount: 27, hangouts: 11, eventsCount: 3, totalXp: 4120 },
  // Gente que no es tu amiga y activó el ranking: solo se ve su nombre, su nivel y su XP.
  { id: 'ximena', name: 'Ximena Torres', handle: '@xime.t', level: 21, streakWeeks: 9, friendsCount: 64, hangouts: 30, eventsCount: 12, totalXp: 10350 },
  { id: 'rodri', name: 'Rodri Peña', handle: '@rodri.p', level: 18, streakWeeks: 7, friendsCount: 48, hangouts: 26, eventsCount: 8, totalXp: 8980 },
  { id: 'paola', name: 'Paola Ríos', handle: '@paola.r', level: 15, streakWeeks: 6, friendsCount: 41, hangouts: 22, eventsCount: 7, totalXp: 7420 },
  { id: 'chema', name: 'Chema Ortiz', handle: '@chema.o', level: 14, streakWeeks: 5, friendsCount: 37, hangouts: 19, eventsCount: 6, totalXp: 6860 },
  { id: 'vale', name: 'Vale Núñez', handle: '@vale.n', level: 12, streakWeeks: 4, friendsCount: 33, hangouts: 17, eventsCount: 5, totalXp: 5730 },
  { id: 'lucia', name: 'Lucía Méndez', handle: '@lucia.m', level: 11, streakWeeks: 3, friendsCount: 29, hangouts: 15, eventsCount: 4, totalXp: 5240 },
  { id: 'tomas', name: 'Tomás Vega', handle: '@tomas.v', level: 10, streakWeeks: 3, friendsCount: 26, hangouts: 13, eventsCount: 4, totalXp: 4710 },
  { id: 'fer', name: 'Fer Salazar', handle: '@fer.s', level: 9, streakWeeks: 2, friendsCount: 22, hangouts: 12, eventsCount: 3, totalXp: 4380 },
  { id: 'ale', name: 'Ale Campos', handle: '@ale.c', level: 8, streakWeeks: 2, friendsCount: 20, hangouts: 11, eventsCount: 3, totalXp: 3640 },
  { id: 'majo', name: 'Majo Lara', handle: '@majo.l', level: 5, streakWeeks: 1, friendsCount: 14, hangouts: 6, eventsCount: 2, totalXp: 2090 },
  {
    id: 'pau', name: 'Pau Martínez', handle: '@pau.mtz', city: 'Zapopan', level: 5, streakWeeks: 2, friendsCount: 19, hangouts: 14, eventsCount: 3,
    pace: 'Corre a 6:30/km', interests: 'Café y retas', totalXp: 2150,
    metAt: { eventTitle: 'Social Run 5K en Colomos', whenIso: new Date(now() - 3 * 86_400_000).toISOString() },
  },
  { id: 'beto', name: 'Beto', handle: '@betogdl', city: 'Guadalajara', level: 2, streakWeeks: 0, friendsCount: 8, hangouts: 3, eventsCount: 1, interests: 'Básquet', totalXp: 810 },
  { id: 'karla', name: 'Karla Ruiz', handle: '@karla.r', city: 'Guadalajara', level: 4, streakWeeks: 1, friendsCount: 16, hangouts: 8, eventsCount: 2, pace: 'Corre a 5:30/km', interests: 'Trail y café', totalXp: 1900 },
  { id: 'lalo', name: 'Lalo Gómez', handle: '@lalogomez', city: 'Tlaquepaque', level: 3, streakWeeks: 0, friendsCount: 11, hangouts: 5, eventsCount: 1, pace: 'Camina o trota', interests: 'Retas y tacos', totalXp: 1350 },
]

export const SEED_FRIENDSHIPS: Friendship[] = [
  { userId: 'sofi', status: 'friends', mutualFriendIds: [], locationPaused: false, close: 'mutual' },
  { userId: 'mau', status: 'friends', mutualFriendIds: [], locationPaused: false, close: 'mutual' },
  { userId: 'regina', status: 'friends', mutualFriendIds: [], locationPaused: false, close: 'none' },
  { userId: 'dani', status: 'friends', mutualFriendIds: [], locationPaused: false, close: 'requested_in' },
  { userId: 'leo', status: 'friends', mutualFriendIds: [], locationPaused: true, close: 'none' },
  { userId: 'nico', status: 'friends', mutualFriendIds: [], locationPaused: false, close: 'mutual' },
  { userId: 'pau', status: 'requested_in', mutualFriendIds: ['sofi', 'mau', 'dani'], locationPaused: false, close: 'none' },
  { userId: 'beto', status: 'requested_in', mutualFriendIds: ['mau'], locationPaused: false, close: 'none' },
  { userId: 'karla', status: 'none', mutualFriendIds: ['mau', 'sofi'], locationPaused: false, close: 'none' },
  { userId: 'lalo', status: 'none', mutualFriendIds: ['dani'], locationPaused: false, close: 'none' },
]

/** Miércoles 19:00 de hace `k` semanas (relativo a la semana actual, para que la racha del mock no dependa del día). */
function wedWeeksAgo(k: number, hour = 19): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)) // lunes de esta semana
  d.setDate(d.getDate() - 7 * k + 2)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}
/**
 * Planes y eventos a los que ya fue `me`: uno por semana en las últimas 4 semanas (racha de 4) y otro 6 semanas atrás
 * (la semana 5 quedó vacía y cortó la racha anterior).
 */
export const SEED_HISTORY: PlanHistoryItem[] = [
  { id: 'hist-cafe', kind: 'plan', title: 'Café y plática en Providencia', categoryLabel: 'Café', placeName: 'Café Ámbar', at: wedWeeksAgo(1), attendeeIds: ['sofi', 'mau'] },
  { id: 'hist-run', kind: 'evento', title: 'Social Run 5K en Colomos', categoryLabel: 'Correr', placeName: 'Bosque Los Colomos', at: wedWeeksAgo(2, 7), attendeeIds: ['mau', 'dani', 'pau', 'sofi', 'regina', 'ximena', 'rodri', 'paola'] },
  { id: 'hist-estudio', kind: 'plan', title: 'Repaso para el parcial', categoryLabel: 'Estudiar', placeName: 'Biblioteca del ITESO', at: wedWeeksAgo(3), attendeeIds: ['regina'] },
  { id: 'hist-tortas', kind: 'plan', title: 'Tortas ahogadas', categoryLabel: 'Comer', placeName: 'Av. Chapultepec', at: wedWeeksAgo(4), attendeeIds: ['dani', 'leo'] },
  { id: 'hist-basket', kind: 'evento', title: 'Reta de básquet 3x3', categoryLabel: 'Deporte', placeName: 'Cancha del Parque Revolución', at: wedWeeksAgo(4, 11), attendeeIds: ['mau', 'nico'] },
  { id: 'hist-picnic', kind: 'plan', title: 'Picnic y juegos de mesa', categoryLabel: 'Juegos', placeName: 'Parque Rojo', at: wedWeeksAgo(6, 17), attendeeIds: ['sofi', 'nico'] },
]

/** Invitaciones que ya te mandaron (las ves en Notificaciones). */
export const SEED_INVITES: Invite[] = [
  { id: 'inv-sofi', kind: 'plan', targetId: 'plan-sofi', title: 'Por un café en Providencia, ¿alguien?', fromId: 'sofi', toId: 'me', status: 'pending', at: inMin(-8) },
  // Mau ya va al plan de Karla (que no es tu amiga) y te invitó: entras como invitado y no sales en el mapa de nadie.
  { id: 'inv-karla', kind: 'plan', targetId: 'plan-karla', title: 'Trote suave en el Parque Rojo', fromId: 'mau', toId: 'me', status: 'pending', at: inMin(-12) },
  { id: 'inv-mau', kind: 'plan', targetId: 'plan-mau', title: '5 km suavecito en el Metropolitano', fromId: 'mau', toId: 'me', status: 'pending', at: inMin(-35) },
]

/**
 * Dónde está cada amigo ahora, aunque no tenga plan (celda aproximada). Se usa solo para quien es cercano,
 * no está en pausa y no tiene un plan activo: en el mapa aparece como "chilling".
 */
export const SEED_PRESENCE: Presence[] = [
  { userId: 'nico', cell: cellAt(-320, -240), updatedAt: inMin(-4) },
  { userId: 'sofi', cell: cellAt(424, 680), updatedAt: inMin(-6) },
  { userId: 'mau', cell: cellAt(-1008, 1256), updatedAt: inMin(-9) },
  { userId: 'regina', cell: cellAt(800, -552), updatedAt: inMin(-7) },
  { userId: 'dani', cell: cellAt(-790, 450), updatedAt: inMin(-3) },
]

export const SEED_PLANS: Plan[] = [
  {
    id: 'plan-sofi', authorId: 'sofi', category: 'cafe', line: 'Por un café en Providencia, ¿alguien?',
    startsAt: inMin(-20), durationMin: 60, expiresAt: inMin(40), joinPolicy: 'friends', joinedCount: 2, capacity: 6, lateJoin: true,
    place: { name: 'Café Ámbar', address: 'Av. Providencia y Rubén Darío', center: placeAt(424, 680) },
  },
  {
    id: 'plan-mau', authorId: 'mau', category: 'correr', line: '5 km suavecito en el Metropolitano',
    startsAt: inMin(60), durationMin: 120, expiresAt: inMin(180), joinPolicy: 'friends', joinedCount: 4, lateJoin: true,
    place: { name: 'Entrada del Parque Metropolitano', center: placeAt(-1008, 1256) },
  },
  {
    id: 'plan-regina', authorId: 'regina', category: 'estudiar', line: 'Repaso para el parcial en la biblio',
    startsAt: inMin(-30), durationMin: 150, expiresAt: inMin(120), joinPolicy: 'friends', joinedCount: 1, lateJoin: true,
    place: { name: 'Biblioteca del ITESO', center: placeAt(780, -540) },
  },
  {
    id: 'plan-dani', authorId: 'dani', category: 'comer', line: 'Tortas ahogadas, voy saliendo',
    startsAt: inMin(-35), durationMin: 60, expiresAt: inMin(25), joinPolicy: 'friends', joinedCount: 3, capacity: 4, lateJoin: false,
    place: { name: 'Tortas ahogadas de Av. Chapultepec', center: placeAt(-760, 424) },
  },
  {
    // Karla NO es tu amiga: no sale en tu mapa ni en Explorar. Llegas por una invitación de un amigo que ya va (inv-karla).
    id: 'plan-karla', authorId: 'karla', category: 'correr', line: 'Trote suave en el Parque Rojo',
    startsAt: inMin(20), durationMin: 60, expiresAt: inMin(80), joinPolicy: 'friends_and_guests', joinedCount: 2, lateJoin: true,
    place: { name: 'Parque Rojo', center: placeAt(-640, 380) },
  },
]

export const SEED_EVENTS: Event[] = [
  {
    // EN CURSO con un amigo cercano ahí (Mau): en el mapa sus fotos van como círculos en la esquina del evento.
    id: 'evt-tarde-juegos', type: 'juegos', subtype: 'Juegos', title: 'Tarde de juegos en el parque', startsAt: inMin(-30), endsAt: inMin(90), lateJoin: true,
    placeName: 'Parque Rojo', placeNote: 'Junto a la fuente del Parque Rojo', center: placeAt(-300, -240),
    capacity: 24, going: 11, organizer: { name: 'Juegos GDL', verified: true, eventsCount: 5 },
    requiresApproval: false, friendsGoingIds: ['mau'], xp: 40,
  },
  {
    id: 'evt-run', type: 'correr', subtype: 'Correr', title: 'Social Run 5K en Colomos', startsAt: nextWeekday(6, 7), endsAt: endsAfter(nextWeekday(6, 7), 120), lateJoin: true,
    placeName: 'Bosque Los Colomos', placeNote: 'Entrada principal de Bosque Los Colomos', center: placeAt(960, 1528),
    capacity: 50, going: 34, organizer: { name: 'Club de corredores', verified: true, eventsCount: 12 },
    requiresApproval: false, paces: ['Caminar', '6:30/km', '5:30/km', '5:00/km'], friendsGoingIds: ['sofi', 'mau', 'dani'], xp: 50,
    audienceNote: 'todos los ritmos',
  },
  {
    id: 'evt-basket', type: 'deporte', subtype: 'Básquet', title: 'Reta de básquet 3x3', startsAt: nextWeekday(0, 11), endsAt: endsAfter(nextWeekday(0, 11), 120), lateJoin: true,
    placeName: 'Parque Revolución', center: placeAt(-300, -1500),
    capacity: 20, going: 12, organizer: { name: 'Ligas de barrio', verified: true, eventsCount: 8 },
    requiresApproval: false, friendsGoingIds: ['beto'], xp: 50,
  },
  {
    id: 'evt-picnic', type: 'juegos', subtype: 'Juegos', title: 'Picnic y juegos de mesa', startsAt: nextWeekday(6, 17), endsAt: endsAfter(nextWeekday(6, 17), 120), lateJoin: true,
    placeName: 'Parque Metropolitano', center: placeAt(4800, 1200),
    capacity: 30, going: 18, organizer: { name: 'Juegos GDL', verified: true, eventsCount: 5 },
    requiresApproval: true, friendsGoingIds: [], xp: 40,
  },
  {
    id: 'evt-trivia', type: 'comida', subtype: 'Trivia', title: 'Tacos y trivia en equipo', startsAt: nextWeekday(4, 21), endsAt: endsAfter(nextWeekday(4, 21), 120), lateJoin: false,
    placeName: 'Taquería en Providencia', center: placeAt(1500, -150),
    capacity: 16, going: 9, organizer: { name: 'Trivia Night', verified: true, eventsCount: 21 },
    requiresApproval: false, friendsGoingIds: ['dani'], xp: 40,
  },
  {
    id: 'evt-salsa', type: 'clase', subtype: 'Baile', title: 'Clase abierta de salsa', startsAt: nextWeekday(5, 20), endsAt: endsAfter(nextWeekday(5, 20), 120), lateJoin: true,
    placeName: 'Av. Chapultepec', center: placeAt(-150, 1000),
    capacity: 40, going: 22, organizer: { name: 'Escuela de baile', verified: true, eventsCount: 30 },
    requiresApproval: false, friendsGoingIds: ['regina'], xp: 40,
  },
]

/** Quién más va a cada evento (solo nombre y avatar son visibles para gente nueva). */
export const SEED_ATTENDEES: Record<string, string[]> = {
  'evt-tarde-juegos': ['mau', 'karla'],
  'evt-run': ['sofi', 'mau', 'dani', 'pau', 'karla', 'lalo'],
  'evt-basket': ['beto', 'lalo'],
  'evt-picnic': ['karla'],
  'evt-trivia': ['dani', 'lalo'],
  'evt-salsa': ['regina', 'karla'],
}

export const SEED_BADGES: Badge[] = [
  { id: 'primer-jale', label: 'Primer jale', icon: 'star', tile: 'bg-cat-comer', earned: true },
  { id: 'madrugador', label: 'Madrugador', icon: 'sun', tile: 'bg-cat-cafe', earned: true },
  { id: 'explorador', label: 'Explorador', icon: 'compass', tile: 'bg-cat-musica', earned: true },
  { id: 'anfitrion', label: 'Anfitrión', icon: 'users', tile: 'bg-cat-otro', earned: false, progress: { current: 2, goal: 3 } },
  { id: 'social-runner', label: 'Social runner', icon: 'activity', tile: 'bg-cat-otro', earned: false, progress: { current: 0, goal: 1 } },
  { id: 'racha-10', label: 'Racha 10', icon: 'flame', tile: 'bg-cat-otro', earned: false, progress: { current: 4, goal: 10 } },
]
