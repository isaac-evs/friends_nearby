/**
 * Genera las capturas de `docs/evidence/app/` contra un backend local con datos de demostración.
 *
 *   # backend aislado (no toca tus datos) y web apuntando a él
 *   PORT=8081 USERS_TABLE=shots-users FRIENDSHIPS_TABLE=shots-friendships CONNECTIONS_TABLE=shots-connections \
 *     SOCIAL_TABLE=shots-social go run ./cmd/local                       # desde backend/
 *   VITE_API_URL=http://localhost:8081 VITE_WS_URL=ws://localhost:8081/ws npx vite --port 5174   # desde frontend/
 *   node scripts/capture-evidence.mjs                                    # desde frontend/
 *
 * Crea cuentas nuevas en cada corrida (sufijo aleatorio). Todo en hora de México. Sin coordenadas exactas de personas:
 * las ubicaciones de la demo son puntos de Guadalajara inventados para la prueba.
 */
import { chromium, devices } from '@playwright/test'
import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const API = process.env.API_URL ?? 'http://localhost:8081'
const WS = process.env.WS_URL ?? 'ws://localhost:8081/ws'
const WEB = process.env.WEB_URL ?? 'http://localhost:5174'
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/evidence')
const TZ = 'America/Mexico_City'
const SUFFIX = Math.random().toString(36).slice(2, 7)
const PASSWORD = 'password123'

// ---- puntos de la demo (Guadalajara) ----
const HOME = { lat: 20.6736, lng: -103.344 }
const PLACES = {
  cafe: { name: 'Café Ámbar, Chapultepec', center: { lat: 20.676, lng: -103.369 } },
  colomos: { name: 'Parque Agua Azul', center: { lat: 20.6577, lng: -103.3436 } },
  biblio: { name: 'Biblioteca Iberoamericana', center: { lat: 20.6762, lng: -103.3474 } },
  tacos: { name: 'Tacos de la Plaza', center: { lat: 20.6745, lng: -103.3452 } },
  parque: { name: 'Parque Revolución', center: { lat: 20.6728, lng: -103.3631 } },
  karaoke: { name: 'Foro Independencia', center: { lat: 20.6771, lng: -103.3391 } },
}
const near = (p, dLat, dLng) => ({ lat: p.lat + dLat, lng: p.lng + dLng })

// ---- cliente mínimo del API ----
async function call(method, url, token, body) {
  const res = await fetch(API + url, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  const json = text ? JSON.parse(text) : null
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status} ${text}`)
  return json
}
const act = async (u, body) => (await call('POST', '/app/actions', u.token, { ...body, requestId: crypto.randomUUID() })).result
async function user(name, handle) {
  const username = `${handle}${SUFFIX}`
  const r = await call('POST', '/auth/register', null, { email: `${username}@example.com`, username, password: PASSWORD, display_name: name })
  return { name, username, email: `${username}@example.com`, token: r.token, id: r.user.user_id }
}
const befriend = async (a, b) => {
  await call('POST', '/friends/requests', a.token, { username: b.username })
  await call('POST', `/friends/${a.id}/accept`, b.token, {})
}
const closeFriends = async (a, b) => {
  await act(a, { type: 'requestClose', userId: b.id })
  await act(b, { type: 'acceptClose', userId: a.id })
}
const minutes = (n) => new Date(Date.now() + n * 60_000).toISOString()
const setLoc = (u, c) => act(u, { type: 'setLocation', location: { status: 'granted', center: c } })
const open = (u) => act(u, { type: 'setOpenMode', openMode: { enabled: true, adult: true, bigEvents: true, smallPlans: true } })

// ---- presencia en el mapa: websockets abiertos mientras dura la captura ----
const sockets = []
function presence(u, c) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`${WS}?token=${u.token}`)
    const send = () => ws.readyState === 1 && ws.send(JSON.stringify({ action: 'location', lat: c.lat, lng: c.lng }))
    ws.onopen = () => { send(); setInterval(send, 25_000); resolve() }
    ws.onerror = () => resolve()
    sockets.push(ws)
  })
}

// ---- datos de demostración ----
async function seed() {
  const me = await user('Alan', 'alan')
  const sofi = await user('Sofi', 'sofi')
  const mau = await user('Mau', 'mau')
  const regina = await user('Regina', 'regina')
  const dani = await user('Dani', 'dani')
  const pau = await user('Pau', 'pau')
  const fresh = await user('Nuevo', 'nuevo') // sin decidir ubicación: sirve para la pantalla de permiso
  const everyone = [me, sofi, mau, regina, dani, pau]

  const spots = { [me.id]: HOME, [sofi.id]: near(HOME, 0.004, -0.003), [mau.id]: near(HOME, -0.006, 0.005), [regina.id]: near(HOME, 0.012, 0.01), [dani.id]: near(HOME, -0.01, -0.012), [pau.id]: near(HOME, 0.02, 0.02) }
  for (const u of everyone) { await setLoc(u, spots[u.id]); await open(u) }
  await act(me, { type: 'updateBio', bio: 'Corro en las mañanas y tomo café en las tardes. Siempre con ganas de jalar.' })

  for (const f of [sofi, mau, regina, dani]) await befriend(me, f)
  await befriend(sofi, mau)
  await closeFriends(me, sofi)
  await closeFriends(me, mau)

  // Presencia (amigos cercanos en el mapa y distancia de los amigos normales)
  for (const u of [me, sofi, mau, regina, dani]) await presence(u, spots[u.id])

  // Planes de otras personas
  const planCafe = await act(sofi, { type: 'publishPlan', category: 'cafe', line: 'Café y plática en Chapultepec', startsAt: minutes(95), durationMin: 90, joinPolicy: 'friends_and_guests', lateJoin: true, place: PLACES.cafe, inviteIds: [me.id] })
  const planRun = await act(mau, { type: 'publishPlan', category: 'correr', line: 'Rodada suave en Agua Azul', startsAt: minutes(100), durationMin: 60, joinPolicy: 'friends', lateJoin: true, place: PLACES.colomos })
  await act(regina, { type: 'publishPlan', category: 'estudiar', line: 'Estudiar para el parcial en la biblioteca', startsAt: minutes(135), durationMin: 90, joinPolicy: 'friends', lateJoin: false, place: PLACES.biblio })

  // Plan mío con lobby abierto (empieza en 6 min), con mensajes y gente dentro
  const planMine = await act(me, { type: 'publishPlan', category: 'comer', line: 'Tacos después de clase', startsAt: minutes(6), durationMin: 75, joinPolicy: 'friends_and_guests', lateJoin: true, place: PLACES.tacos })
  await act(sofi, { type: 'jalo', id: planMine.id })
  await act(mau, { type: 'jalo', id: planMine.id })
  await act(sofi, { type: 'planMessage', id: planMine.id, message: '¡Ya casi llego! Guarden lugar' })
  await new Promise((r) => setTimeout(r, 1200))
  await act(mau, { type: 'quickMessage', id: planMine.id, message: 'Llego en 5' }).catch(() => {})
  await act(mau, { type: 'planMessage', id: planMine.id, message: 'Pido la mesa de la esquina' })
  // Quienes ya llegaron al lobby (Alan todavía no: ve el botón "Ya llegué")
  for (const u of [sofi, mau]) await act(u, { type: 'checkIn', id: planMine.id, center: near(PLACES.tacos.center, 0.0003, 0.0002), accuracy: 10 })

  // Eventos
  const evGames = await act(dani, { type: 'publishEvent', eventType: 'juegos', title: 'Tarde de juegos de mesa en el parque', startsAt: minutes(60 * 26), endsAt: minutes(60 * 29), capacity: 20, placeName: PLACES.parque.name, center: PLACES.parque.center, requiresApproval: false, description: 'Traemos Catán, Dixit y snacks. Todo mundo es bienvenido.', alias: 'Club de juegos', chatEnabled: true })
  const evRun = await act(mau, { type: 'publishEvent', eventType: 'deporte', title: 'Reta de básquet 3x3', startsAt: minutes(60 * 30), endsAt: minutes(60 * 32), capacity: 12, placeName: PLACES.colomos.name, center: PLACES.colomos.center, requiresApproval: false, description: 'Equipos al azar, nivel parejo.' })
  await act(sofi, { type: 'swipe', kind: 'event', id: evRun.id, action: 'later' }).catch(() => {})
  await act(me, { type: 'swipe', kind: 'event', id: evRun.id, action: 'later' })
  await act(me, { type: 'swipe', kind: 'plan', id: planRun.id, action: 'later' })
  await act(me, { type: 'joinEvent', id: evGames.id })
  await act(dani, { type: 'postAnnouncement', id: evGames.id, message: 'Cambiamos la mesa: ahora es junto a la fuente.' })
  await act(me, { type: 'eventMessage', id: evGames.id, message: '¿Llevo algo de tomar?' })
  await new Promise((r) => setTimeout(r, 1200))
  await act(dani, { type: 'eventMessage', id: evGames.id, message: 'Con agua estamos bien, ¡gracias!' })

  // Evento mío, tipo "Otro" con nombre, ícono y color propios
  const evMine = await act(me, { type: 'publishEvent', eventType: 'otro', subtype: 'Karaoke', typeIcon: 'mic', typeColor: 'musica', title: 'Noche de karaoke', startsAt: minutes(60 * 50), endsAt: minutes(60 * 53), capacity: 25, placeName: PLACES.karaoke.name, center: PLACES.karaoke.center, requiresApproval: false, description: 'Canciones de los 2000. Cada quien trae su playlist.', chatEnabled: true })
  await act(sofi, { type: 'joinEvent', id: evMine.id })
  await act(mau, { type: 'joinEvent', id: evMine.id })
  await act(me, { type: 'postAnnouncement', id: evMine.id, message: 'Abrimos puertas 30 min antes. Traigan su playlist.' })

  // Notificaciones pendientes: solicitud de amistad, pedido de ubicación exacta, invitación
  await call('POST', '/friends/requests', pau.token, { username: me.username })
  await act(sofi, { type: 'askExact', userId: me.id }).catch(() => {})
  return { me, sofi, mau, regina, dani, pau, fresh, planCafe, planRun, planMine, evGames, evMine, evRun }
}

// ---- captura ----
const shots = []
async function shoot(page, dir, name, { wait = 1500, full = false, ready } = {}) {
  if (ready) await ready(page).catch(() => {})
  await page.waitForTimeout(wait)
  const file = path.join(OUT, dir, `${name}.png`)
  if (full) {
    // Página completa sin que la barra inferior o el banner fijo floten a la mitad: se agranda el viewport al alto real.
    const vp = page.viewportSize()
    const h = await page.evaluate(() => document.documentElement.scrollHeight)
    await page.setViewportSize({ width: vp.width, height: Math.min(Math.max(h, vp.height), 4500) })
    await page.waitForTimeout(600)
    const h2 = await page.evaluate(() => document.documentElement.scrollHeight)
    if (h2 > h && h2 <= 4500) { await page.setViewportSize({ width: vp.width, height: h2 }); await page.waitForTimeout(400) }
    await page.screenshot({ path: file })
    await page.setViewportSize(vp)
  } else {
    await page.screenshot({ path: file })
  }
  shots.push(path.relative(OUT, file))
  console.log('  ✓', path.relative(OUT, file))
}
async function session(browser, profile, token, extra = {}) {
  const context = await browser.newContext({
    ...profile, timezoneId: TZ, locale: 'es-MX', colorScheme: 'light',
    permissions: ['geolocation'], geolocation: { latitude: HOME.lat, longitude: HOME.lng, accuracy: 20 }, ...extra,
  })
  if (token) await context.addInitScript((t) => sessionStorage.setItem('friends-nearby.token', t), token)
  const page = await context.newPage()
  return { context, page }
}
const go = async (page, url) => { await page.goto(WEB + url, { waitUntil: 'domcontentloaded' }); await page.waitForLoadState('load') }

async function captureApp(browser, kind, profile, d) {
  const dir = `app/${kind}`
  await mkdir(path.join(OUT, dir), { recursive: true })
  console.log(`\n== ${kind} ==`)

  // Sin sesión
  let s = await session(browser, profile)
  await go(s.page, '/entrar'); await shoot(s.page, dir, '01-entrar')
  await s.page.getByRole('button', { name: /crear cuenta|registr/i }).first().click().catch(() => {})
  await shoot(s.page, dir, '02-registro', { wait: 600 })
  await s.context.close()

  // Cuenta nueva sin ubicación → permiso
  s = await session(browser, profile, d.fresh.token)
  await go(s.page, '/permiso'); await shoot(s.page, dir, '03-permiso')
  await s.context.close()

  // Sesión de Alan
  s = await session(browser, profile, d.me.token)
  const { page } = s
  const list = [
    ['04-explorar', '/', { wait: 2500 }],
    ['05-mapa', '/mapa', { wait: 6000 }],
    ['06-publicar-plan', '/publicar', { wait: 1500 }],
    ['07-publicar-evento', '/publicar/evento', { wait: 1500 }],
    ['08-amigos', '/amigos', { wait: 2000, full: true }],
    ['09-ranking', '/amigos?tab=ranking', { wait: 2000 }],
    ['10-mis-planes', '/planes', { wait: 2000 }],
    ['11-plan-detalle', `/plan/${d.planMine.id}`, { wait: 3500, full: true }],
    ['12-evento-detalle', `/evento/${d.evGames.id}`, { wait: 2500, full: true }],
    ['13-evento-propio', `/evento/${d.evMine.id}`, { wait: 2500, full: true }],
    ['14-notificaciones', '/notificaciones', { wait: 2500, full: true }],
    ['15-preferencias-notificaciones', '/notificaciones/preferencias', { wait: 1500 }],
    ['16-perfil', '/perfil', { wait: 2000, full: true }],
    ['17-editar-perfil', '/perfil/editar', { wait: 1500, full: true }],
    ['18-nivel-progreso', '/perfil/nivel', { wait: 1500 }],
    ['19-nivel-niveles', '/perfil/nivel?tab=niveles', { wait: 1500, full: true }],
    ['20-nivel-historial', '/perfil/nivel?tab=historial', { wait: 1500 }],
    ['21-privacidad-amigos-cercanos', '/privacidad', { wait: 2000, full: true }],
    ['22-modo-abierto', '/modo-abierto', { wait: 1500 }],
    ['23-guardados', '/guardados', { wait: 2000 }],
    ['24-perfil-de-otra-persona', `/u/${d.sofi.id}`, { wait: 2000, full: true }],
    ['25-legal', '/legal', { wait: 1000 }],
  ]
  for (const [name, url, opts] of list) { await go(page, url); await shoot(page, dir, name, opts) }
  await s.context.close()
}

// ---- flujos paso a paso ----
async function captureFlows(browser, d) {
  const profile = devices['iPhone 14']
  await mkdir(path.join(OUT, 'flows/plan'), { recursive: true })
  await mkdir(path.join(OUT, 'flows/evento'), { recursive: true })
  console.log('\n== flujo: plan ==')

  // 1. Quien organiza llena el formulario
  let s = await session(browser, profile, d.regina.token)
  await go(s.page, '/publicar')
  await s.page.getByPlaceholder(/Por un café/).fill('Café y tarea en la biblio').catch(() => {})
  await shoot(s.page, 'flows/plan', '01-formulario-plan', { wait: 800 })
  // (el lugar se elige en el mapa; el plan se crea por API para seguir el flujo)
  await befriend(d.regina, d.dani)
  const plan = await act(d.regina, { type: 'publishPlan', category: 'cafe', line: 'Café y tarea en la biblio', startsAt: minutes(8), durationMin: 60, joinPolicy: 'friends', lateJoin: true, place: PLACES.biblio })
  await go(s.page, `/plan/${plan.id}`); await shoot(s.page, 'flows/plan', '02-plan-publicado-organizador', { wait: 2500 })
  await s.context.close()

  // 2. Un amigo lo ve en Explorar y se une
  s = await session(browser, profile, d.dani.token)
  await go(s.page, '/'); await shoot(s.page, 'flows/plan', '03-amigo-lo-ve-en-explorar', { wait: 2500 })
  await act(d.dani, { type: 'jalo', id: plan.id })
  await go(s.page, `/plan/${plan.id}`); await shoot(s.page, 'flows/plan', '04-amigo-se-une', { wait: 3000 })
  await s.context.close()

  // 3. Lobby (10 min antes) y check-in cerca del lugar
  s = await session(browser, profile, d.dani.token, { geolocation: { latitude: PLACES.biblio.center.lat, longitude: PLACES.biblio.center.lng, accuracy: 15 } })
  await go(s.page, `/plan/${plan.id}`)
  await shoot(s.page, 'flows/plan', '05-lobby-ya-llegue', { wait: 3000 })
  await s.page.getByRole('button', { name: /Ya llegué/ }).first().click().catch(() => {})
  await shoot(s.page, 'flows/plan', '06-check-in-hecho', { wait: 2500 })
  await go(s.page, '/perfil/nivel?tab=historial'); await shoot(s.page, 'flows/plan', '07-xp-en-historial', { wait: 2000 })
  await s.context.close()

  console.log('\n== flujo: evento ==')
  s = await session(browser, profile, d.me.token)
  await go(s.page, '/publicar/evento')
  await s.page.getByRole('button', { name: /^Otro$/ }).click().catch(() => {})
  await s.page.getByLabel(/Nombre del tipo/).fill('Karaoke').catch(() => {})
  await s.page.getByLabel('Micrófono').click().catch(() => {})
  await s.page.getByLabel('Menta').click().catch(() => {})
  await s.page.getByLabel('Nombre del evento').fill('Noche de karaoke').catch(() => {})
  await shoot(s.page, 'flows/evento', '01-crear-evento-otro-con-icono-y-color', { wait: 800, full: true })
  await go(s.page, `/evento/${d.evMine.id}`); await shoot(s.page, 'flows/evento', '02-evento-publicado-organizador', { wait: 2500, full: true })
  await s.context.close()

  s = await session(browser, profile, d.dani.token)
  await go(s.page, `/evento/${d.evMine.id}`); await shoot(s.page, 'flows/evento', '03-otra-persona-ve-el-evento', { wait: 2500, full: true })
  await s.context.close()
}

async function main() {
  await rm(path.join(OUT, 'app'), { recursive: true, force: true })
  await rm(path.join(OUT, 'flows'), { recursive: true, force: true })
  console.log('Creando datos de demostración…')
  const d = await seed()
  const browser = await chromium.launch()
  try {
    await captureApp(browser, 'mobile', devices['iPhone 14'], d)
    await captureApp(browser, 'desktop', { viewport: { width: 1440, height: 900 } }, d)
    await captureFlows(browser, d)
  } finally {
    await browser.close()
    sockets.forEach((w) => w.close())
  }
  console.log(`\nListo: ${shots.length} capturas en ${OUT}`)
  process.exit(0)
}
main().catch((e) => { console.error(e); process.exit(1) })
