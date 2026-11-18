/**
 * Datos de ejemplo (tomados de los mockups). Todas las fechas son relativas a "ahora" para que
 * el mock nunca quede obsoleto. Las zonas ya vienen redondeadas (lib/geo.ts → roundToZone).
 */
import type { Badge, Event, Friendship, Plan, User } from '../schemas'
import { MOCK_ORIGIN, offsetMeters, roundToZone, ZONE_RADIUS_M } from '@/lib/geo'

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

const zoneAt = (eastM: number, northM: number) => roundToZone(offsetMeters(MOCK_ORIGIN, eastM, northM))

export const ME_ID = 'me'

export const SEED_USERS: User[] = [
  { id: ME_ID, name: 'Alan', handle: '@alan', level: 7, levelTitle: 'Social de barrio', streakWeeks: 4, hangouts: 9, eventsCount: 6, rankingOptIn: true, weeklyXp: 160 },
  { id: 'sofi', name: 'Sofi', handle: '@sofi', level: 6, streakWeeks: 3, hangouts: 12, eventsCount: 4, rankingOptIn: true, weeklyXp: 120 },
  { id: 'mau', name: 'Mau', handle: '@mau', level: 8, streakWeeks: 6, hangouts: 20, eventsCount: 9, rankingOptIn: true, weeklyXp: 180 },
  { id: 'regina', name: 'Regina', handle: '@regina', level: 4, streakWeeks: 1, hangouts: 7, eventsCount: 2, rankingOptIn: false, weeklyXp: 0 },
  { id: 'dani', name: 'Dani', handle: '@dani', level: 5, streakWeeks: 2, hangouts: 10, eventsCount: 3, rankingOptIn: false, weeklyXp: 0 },
  { id: 'leo', name: 'Leo', handle: '@leo', level: 3, streakWeeks: 0, hangouts: 4, eventsCount: 1, rankingOptIn: false, weeklyXp: 0 },
  {
    id: 'pau', name: 'Pau Martínez', handle: '@pau.mtz', city: 'Zapopan', level: 5, streakWeeks: 2, hangouts: 14, eventsCount: 3,
    pace: 'Corre a 6:30/km', interests: 'Café y retas', rankingOptIn: false, weeklyXp: 0,
    metAt: { eventTitle: 'Social Run 5K en Colomos', whenIso: new Date(now() - 3 * 86_400_000).toISOString() },
  },
  { id: 'beto', name: 'Beto', handle: '@betogdl', city: 'Guadalajara', level: 2, streakWeeks: 0, hangouts: 3, eventsCount: 1, interests: 'Básquet', rankingOptIn: false, weeklyXp: 0 },
  { id: 'karla', name: 'Karla Ruiz', handle: '@karla.r', city: 'Guadalajara', level: 4, streakWeeks: 1, hangouts: 8, eventsCount: 2, pace: 'Corre a 5:30/km', interests: 'Trail y café', rankingOptIn: false, weeklyXp: 0 },
  { id: 'lalo', name: 'Lalo Gómez', handle: '@lalogomez', city: 'Tlaquepaque', level: 3, streakWeeks: 0, hangouts: 5, eventsCount: 1, pace: 'Camina o trota', interests: 'Retas y tacos', rankingOptIn: false, weeklyXp: 0 },
]

export const SEED_FRIENDSHIPS: Friendship[] = [
  { userId: 'sofi', status: 'friends', mutualFriendIds: [], locationPaused: false },
  { userId: 'mau', status: 'friends', mutualFriendIds: [], locationPaused: false },
  { userId: 'regina', status: 'friends', mutualFriendIds: [], locationPaused: false },
  { userId: 'dani', status: 'friends', mutualFriendIds: [], locationPaused: false },
  { userId: 'leo', status: 'friends', mutualFriendIds: [], locationPaused: true },
  { userId: 'pau', status: 'requested_in', mutualFriendIds: ['sofi', 'mau', 'dani'], locationPaused: false },
  { userId: 'beto', status: 'requested_in', mutualFriendIds: ['mau'], locationPaused: false },
  { userId: 'karla', status: 'none', mutualFriendIds: ['mau', 'sofi'], locationPaused: false },
  { userId: 'lalo', status: 'none', mutualFriendIds: ['dani'], locationPaused: false },
]

const radiusM = ZONE_RADIUS_M

export const SEED_PLANS: Plan[] = [
  {
    id: 'plan-sofi', authorId: 'sofi', category: 'cafe', line: 'Por un café en Providencia, ¿alguien?',
    expiresAt: inMin(40), audience: 'amigos', joinedCount: 2, zoneUpdatedAt: inMin(-5),
    meetPoint: 'Av. Providencia y Rubén Darío',
    zone: { name: 'Providencia', center: zoneAt(424, 680), radiusM, approxDistanceM: 800 },
  },
  {
    id: 'plan-mau', authorId: 'mau', category: 'correr', line: '5 km suavecito en el Metropolitano',
    startsAt: inMin(60), expiresAt: inMin(180), audience: 'amigos', joinedCount: 4, zoneUpdatedAt: inMin(-12),
    meetPoint: 'Entrada del Parque Metropolitano',
    zone: { name: 'Colomos', center: zoneAt(-1008, 1256), radiusM, approxDistanceM: 3000 },
  },
  {
    id: 'plan-regina', authorId: 'regina', category: 'estudiar', line: 'Repaso para el parcial en la biblio',
    expiresAt: inMin(120), audience: 'amigos', joinedCount: 1, zoneUpdatedAt: inMin(-9),
    meetPoint: 'Biblioteca del ITESO',
    zone: { name: 'ITESO', center: zoneAt(800, -552), radiusM, approxDistanceM: 1500 },
  },
  {
    id: 'plan-dani', authorId: 'dani', category: 'comer', line: 'Tortas ahogadas, voy saliendo',
    expiresAt: inMin(25), audience: 'amigos', joinedCount: 3, zoneUpdatedAt: inMin(-2),
    meetPoint: 'Tortas ahogadas de Av. Chapultepec',
    zone: { name: 'Chapultepec', center: zoneAt(-760, 424), radiusM, approxDistanceM: 1000 },
  },
]

export const SEED_EVENTS: Event[] = [
  {
    id: 'evt-run', type: 'correr', subtype: 'Correr', title: 'Social Run 5K en Colomos', startsAt: nextWeekday(6, 7),
    placeName: 'Bosque Los Colomos', placeNote: 'Entrada principal de Bosque Los Colomos', center: zoneAt(960, 1528), approxDistanceM: 3000,
    capacity: 50, going: 34, organizer: { name: 'Club de corredores', verified: true, eventsCount: 12 }, audience: 'abierto',
    requiresApproval: false, paces: ['Caminar', '6:30/km', '5:30/km', '5:00/km'], friendsGoingIds: ['sofi', 'mau', 'dani'], xp: 50,
    audienceNote: 'todos los ritmos',
  },
  {
    id: 'evt-basket', type: 'deporte', subtype: 'Básquet', title: 'Reta de básquet 3x3', startsAt: nextWeekday(0, 11),
    placeName: 'Parque Revolución', center: zoneAt(-300, -1500), approxDistanceM: 2000,
    capacity: 20, going: 12, organizer: { name: 'Ligas de barrio', verified: true, eventsCount: 8 }, audience: 'abierto',
    requiresApproval: false, friendsGoingIds: ['beto'], xp: 50,
  },
  {
    id: 'evt-picnic', type: 'juegos', subtype: 'Juegos', title: 'Picnic y juegos de mesa', startsAt: nextWeekday(6, 17),
    placeName: 'Parque Metropolitano', center: zoneAt(4800, 1200), approxDistanceM: 6000,
    capacity: 30, going: 18, organizer: { name: 'Juegos GDL', verified: true, eventsCount: 5 }, audience: 'abierto',
    requiresApproval: true, friendsGoingIds: [], xp: 40,
  },
  {
    id: 'evt-trivia', type: 'comida', subtype: 'Trivia', title: 'Tacos y trivia en equipo', startsAt: nextWeekday(4, 21),
    placeName: 'Taquería en Providencia', center: zoneAt(1500, -150), approxDistanceM: 1000,
    capacity: 16, going: 9, organizer: { name: 'Trivia Night', verified: true, eventsCount: 21 }, audience: 'abierto',
    requiresApproval: false, friendsGoingIds: ['dani'], xp: 40,
  },
  {
    id: 'evt-salsa', type: 'clase', subtype: 'Baile', title: 'Clase abierta de salsa', startsAt: nextWeekday(5, 20),
    placeName: 'Av. Chapultepec', center: zoneAt(-150, 1000), approxDistanceM: 1000,
    capacity: 40, going: 22, organizer: { name: 'Escuela de baile', verified: true, eventsCount: 30 }, audience: 'abierto',
    requiresApproval: false, friendsGoingIds: ['regina'], xp: 40,
  },
]

/** Quién más va a cada evento (solo nombre y avatar son visibles para gente nueva). */
export const SEED_ATTENDEES: Record<string, string[]> = {
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

export const ZONES = ['Chapultepec', 'Providencia', 'Colomos', 'ITESO', 'Centro', 'Andares'] as const
