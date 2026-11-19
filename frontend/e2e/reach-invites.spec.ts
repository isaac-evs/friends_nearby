import { expect, test, type Page } from '@playwright/test'
import { expectNoAxeViolations, fillPlace, signIn } from './helpers'

const tab = (page: Page, name: RegExp) => page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name })
const goMapa = (page: Page) => tab(page, /^(Mapa|Explorar y mapa)$/).click()
const goInicio = (page: Page) => tab(page, /^Explorar/).click()
const goPublicar = (page: Page) => page.getByRole('link', { name: /^Publicar plan/ }).click()
const goNotif = (page: Page) => page.getByRole('link', { name: /^Notificaciones/ }).first().click()
const pasos = async (page: Page, n: number) => { for (let i = 0; i < n; i++) await page.getByRole('button', { name: 'Paso', exact: true }).click() }
const rango = (page: Page) => page.getByRole('button', { name: /^Rango · / }).first()
const setRango = async (page: Page, km: string) => { await rango(page).click(); await page.getByRole('dialog', { name: 'Rango de búsqueda' }).getByRole('radio', { name: km, exact: true }).click() }
const mobileOnly = () => test.skip(test.info().project.name === 'desktop', 'Esta vista es móvil')
const regionSel = (page: Page) => page.getByRole('region', { name: 'Seleccionado en el mapa' })

test.describe('rango de búsqueda (planes, eventos y amigos)', () => {
  test('en el mapa: ampliar muestra más y reducir oculta lo lejano; es global y accesible', async ({ page }) => {
    mobileOnly()
    await signIn(page)
    await goMapa(page)
    await page.getByRole('button', { name: 'Lista', exact: true }).click()
    const items = page.getByRole('list', { name: /en lista/ }).getByRole('listitem')
    await expect(rango(page)).toContainText('5 km')
    await expect(items).toHaveCount(5) // Sofi, Mau, Regina, Dani (con plan) y Nico sin plan; Karla no es amiga
    await setRango(page, '1 km')
    await expect(rango(page)).toContainText('1 km')
    await expect(items).toHaveCount(4) // Mau (~1.6 km) queda fuera
    await expect(items.filter({ hasText: 'Mau' })).toHaveCount(0)
    await setRango(page, '25 km')
    await expect(items).toHaveCount(5)
    const h = await rango(page).evaluate((e) => e.getBoundingClientRect().height)
    expect(h).toBeGreaterThanOrEqual(44)
    await rango(page).click()
    await expect(page.getByRole('radiogroup', { name: 'Rango' }).getByRole('radio')).toHaveCount(5)
    await expectNoAxeViolations(page)
  })

  test('en Explorar: solo cuenta lo que está en tu rango y sugiere ampliarlo cuando se acaba', async ({ page }) => {
    mobileOnly()
    await signIn(page)
    await expect(page.getByText(/de 4 planes/)).toBeVisible()
    await setRango(page, '1 km')
    await expect(page.getByText(/de 3 planes/)).toBeVisible() // Sofi, Regina y Dani; el de Mau (~1.6 km) no
    await pasos(page, 3)
    await expect(page.getByText('Hay 1 plan más fuera de 1 km. Amplía el rango para verlos.')).toBeVisible()
    await expect(page.getByRole('button', { name: /^Rango · 1 km/ })).toHaveCount(2) // el de arriba y el del aviso
    await setRango(page, '5 km')
  })

  test('el rango se conserva al recargar', async ({ page }) => {
    mobileOnly()
    await signIn(page)
    await setRango(page, '10 km')
    await page.reload()
    await expect(rango(page)).toContainText('10 km')
  })
})

test.describe('plan: solo amigos lo ven; quién se puede unir; lugar y límite obligatorios', () => {
  test('ya no hay "Roomies", "Abierto" ni "amigos de amigos"; el lugar es obligatorio', async ({ page }) => {
    await signIn(page)
    await goPublicar(page)
    const policy = page.getByRole('group').filter({ has: page.getByRole('button', { name: 'Amigos e invitados', exact: true }) })
    await expect(page.getByRole('button', { name: 'Roomies' })).toHaveCount(0)
    await expect(policy.getByRole('button', { name: 'Abierto' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Amigos de amigos' })).toHaveCount(0)
    await expect(page.getByText('Solo tus amigos ven el plan y se pueden unir.')).toBeVisible()
    await page.getByRole('button', { name: 'Amigos e invitados', exact: true }).click()
    await expect(page.getByText(/no salen en el mapa/)).toBeVisible()
    await page.getByLabel('Cuéntales en una línea').fill('Trote en el parque')
    await page.getByRole('button', { name: /^Publicar plan/ }).click()
    await expect(page.getByText('Escribe cómo se llama el lugar')).toBeVisible()
    await fillPlace(page, '¿Dónde es?', 'Parque Rojo')
    await page.getByLabel('Límite de personas (opcional)').fill('1')
    await page.getByRole('button', { name: /^Publicar plan/ }).click()
    await expect(page.getByText('El límite va de 2 a 100 personas')).toBeVisible()
    await page.getByLabel('Límite de personas (opcional)').fill('6')
    await page.getByRole('button', { name: /^Publicar plan/ }).click()
    await expect(page.getByText('Plan publicado')).toBeVisible()
  })

  test('el plan de alguien que no es tu amigo no sale en el mapa; llega por la invitación de un amigo', async ({ page }) => {
    await signIn(page)
    await page.goto('/mapa?sel=plan-karla')
    await expect(page.getByRole('button', { name: /Karla Ruiz/ })).toHaveCount(0) // el mapa solo muestra amigos
    await page.goto('/notificaciones')
    await expect(page.getByText('Trote suave en el Parque Rojo').first()).toBeVisible()
    await expect(page.getByText(/Mau te invitó/).first()).toBeVisible()
  })
})

test.describe('hora, "Ver plan" sobre el mapa y unirse en curso', () => {
  test('el plan se ve con su hora y duración (tarjeta, hoja y lista)', async ({ page }) => {
    await signIn(page)
    if (test.info().project.name !== 'desktop') await expect(page.getByText(/En curso · hasta \d{1,2}:\d{2} [ap]m/).first()).toBeVisible() // tarjeta de Explorar
    await page.goto('/mapa?sel=plan-sofi')
    await expect(regionSel(page)).toContainText(/Hoy \d{1,2}:\d{2} [ap]m · dura 1 h · en curso · termina en \d+ min/)
    await page.goto('/mapa?sel=plan-mau')
    await expect(regionSel(page)).toContainText(/Hoy \d{1,2}:\d{2} [ap]m · dura 2 h · empieza en 1 h/)
  })

  test('"Ver plan" abre el detalle SIN salir del mapa', async ({ page }) => {
    await signIn(page)
    await page.goto('/mapa?sel=plan-sofi')
    await regionSel(page).getByRole('button', { name: 'Ver plan' }).click()
    const dlg = page.getByRole('dialog', { name: 'Plan de Sofi' })
    await expect(dlg).toContainText('Por un café en Providencia, ¿alguien?')
    await expect(dlg).toContainText(/Hoy \d{1,2}:\d{2} [ap]m · dura 1 h/)
    await expect(dlg).toContainText('2 ya jalaron')
    await expect(dlg).toContainText('Se puede unir aunque ya haya empezado.')
    await expectNoAxeViolations(page)
    expect(new URL(page.url()).pathname).toMatch(/^\/(mapa)?$/) // sigue en el mapa
    await dlg.getByRole('button', { name: 'Cerrar' }).click()
    await expect(dlg).toHaveCount(0)
    await expect(regionSel(page)).toBeVisible()
  })

  test('un plan en curso que no admite más gente: no se puede jalar y dice por qué', async ({ page }) => {
    await signIn(page)
    await page.goto('/mapa?sel=plan-dani')
    const sheet = regionSel(page)
    const jalo = sheet.getByRole('button', { name: 'Jalo', exact: true })
    await expect(jalo).toHaveAttribute('aria-disabled', 'true')
    await expect(sheet).toContainText('Ya empezó y no admite más gente.')
    await jalo.click({ force: true })
    await expect(page.getByText('Ya empezó y no admite más gente.').first()).toBeVisible()
    await expect(page.getByRole('heading', { name: '¡Se armó!' })).toHaveCount(0)
    await sheet.getByRole('button', { name: 'Ver plan' }).click()
    await expect(page.getByRole('dialog', { name: 'Plan de Dani' })).toContainText('Cuando empiece, ya no admite más gente.')
    await expectNoAxeViolations(page)
  })

  test('"Ver dónde es en el mapa" desde el match abre el mapa con ese plan seleccionado', async ({ page }) => {
    await signIn(page)
    await page.getByRole('button', { name: 'Jalo', exact: true }).click()
    await expect(page.getByRole('heading', { name: '¡Se armó!' })).toBeVisible()
    await page.getByRole('link', { name: 'Ver dónde es en el mapa' }).click()
    await expect(regionSel(page)).toContainText('Sofi')
  })
})

test.describe('solo un plan o evento a la vez', () => {
  test('jalar uno que se traslapa con otro al que ya vas: no se puede y dice cuál', async ({ page }) => {
    mobileOnly()
    await signIn(page)
    await page.getByRole('button', { name: 'Jalo', exact: true }).click() // Sofi, en curso
    await expect(page.getByRole('heading', { name: '¡Se armó!' })).toBeVisible()
    await page.goBack()
    // "En curso": se ve primero y se puede tocar para verlo.
    const live = page.getByText(/En curso: «Por un café en Providencia, ¿alguien\?» · termina en \d+ min\./)
    await expect(live).toBeVisible()
    await expect(page.getByRole('link', { name: 'Ver', exact: true })).toHaveAttribute('href', '/match/match-plan-sofi')
    await expectNoAxeViolations(page)
    await pasos(page, 1) // Mau (empieza en 1 h: no se traslapa)…
    await page.getByRole('button', { name: 'Jalo', exact: true }).click() // …y Regina (en curso, hasta +2 h): se traslapa
    await expect(page.getByText('Ya tienes «Por un café en Providencia, ¿alguien?» a esa hora. Solo puedes tener un plan a la vez.')).toBeVisible()
    await expect(page.getByRole('heading', { name: '¡Se armó!' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Ocultar aviso' }).click()
    await expect(live).toHaveCount(0)
  })

  test('no puedes publicar un plan que se traslapa con uno al que ya vas', async ({ page }) => {
    await signIn(page)
    await page.getByRole('button', { name: 'Jalo', exact: true }).click()
    await expect(page.getByRole('heading', { name: '¡Se armó!' })).toBeVisible()
    await page.goBack()
    await goPublicar(page)
    await page.getByLabel('Cuéntales en una línea').fill('Otro plan encima')
    await fillPlace(page, '¿Dónde es?', 'Café de la esquina')
    await page.getByRole('button', { name: /^Publicar plan/ }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Ya tienes «Por un café en Providencia, ¿alguien?» a esa hora' })).toBeVisible()
    // Después de que termine el otro (empieza en 2 h): sí.
    await page.getByRole('button', { name: 'Otra hora', exact: true }).click()
    const later = await page.evaluate(() => { const d = new Date(Date.now() + 2 * 3_600_000); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` })
    const sameDay = await page.evaluate(() => new Date(Date.now() + 2 * 3_600_000).getDate() === new Date().getDate())
    test.skip(!sameDay, 'Cruzaría la medianoche')
    await page.getByLabel('Hora de inicio (hoy)').fill(later)
    await page.getByRole('button', { name: /^Publicar plan/ }).click()
    await expect(page.getByText('Plan publicado')).toBeVisible()
  })
})

test.describe('invitar a amigos y Notificaciones', () => {
  test('al crear un plan se elige a amigos (cerca de ti primero) y sus respuestas llegan a Notificaciones', async ({ page }) => {
    await signIn(page)
    await goPublicar(page)
    const near = page.getByRole('list', { name: 'Amigos cerca de ti' })
    await expect(near.getByRole('checkbox')).toHaveCount(3) // solo cercanos mutuos con su ubicación aproximada: Nico, Sofi y Mau
    await expect(near.getByRole('checkbox').first()).toContainText('Nico') // el más cerca primero
    await expect(page.getByRole('list', { name: 'Otros amigos' })).toContainText('Leo') // sin ubicación a la vista (Regina y Dani tampoco son cercanos mutuos)
    await page.getByRole('checkbox', { name: 'Invitar a Nico' }).click()
    await page.getByRole('checkbox', { name: 'Invitar a Regina' }).click()
    await expect(page.getByRole('checkbox', { name: 'Invitar a Nico' })).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByText('Invitar a amigos (opcional) · 2')).toBeVisible()
    await expectNoAxeViolations(page)
    await page.getByLabel('Cuéntales en una línea').fill('Pizza en la noche')
    await fillPlace(page, '¿Dónde es?', 'Pizzería del centro')
    await page.getByRole('button', { name: /^Publicar plan/ }).click()
    await expect(page.getByText('Plan publicado · invitaste a 2')).toBeVisible()
    await goNotif(page)
    const resp = page.getByRole('region').filter({ has: page.getByRole('heading', { name: 'Respuestas a tus invitaciones' }) })
    await expect(resp).toContainText('Nico aceptó tu invitación a «Pizza en la noche»', { timeout: 10_000 })
    await expect(resp).toContainText('Regina no puede ir a «Pizza en la noche»', { timeout: 10_000 })
  })

  test('te invitan a un plan: se ve en Notificaciones y se acepta o se rechaza', async ({ page }) => {
    await signIn(page)
    await expect(page.getByRole('link', { name: /^Notificaciones/ }).first()).toContainText('6')
    await goNotif(page)
    await expect(page.getByRole('heading', { name: 'Notificaciones', level: 1 })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Invitaciones (3)' })).toBeVisible()
    await expect(page.getByText('Sofi te invitó a un plan')).toBeVisible()
    await expect(page.getByText('Mau te invitó a un plan')).toHaveCount(2) // al de él y al de Karla (invitado)
    await expect(page.getByRole('heading', { name: 'Amigo cercano (1)' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Solicitudes de amistad (2)' })).toBeVisible()
    await expectNoAxeViolations(page)
    await page.getByRole('button', { name: 'Ahora no: invitación de Mau' }).first().click()
    await expect(page.getByRole('heading', { name: 'Invitaciones (2)' })).toBeVisible()
    await page.getByRole('button', { name: 'Aceptar la invitación de Sofi' }).click()
    await expect(page.getByRole('heading', { name: '¡Se armó!' })).toBeVisible() // aceptar te une al plan
  })

  test('aceptar una invitación que choca con otro plan tuyo: no se puede y dice por qué', async ({ page }) => {
    await signIn(page)
    await goPublicar(page)
    await page.getByLabel('Cuéntales en una línea').fill('Mi plan de hoy')
    await page.getByRole('button', { name: '2 h', exact: true }).click()
    await fillPlace(page, '¿Dónde es?', 'Mi café')
    await page.getByRole('button', { name: /^Publicar plan/ }).click()
    await expect(page.getByText('Plan publicado')).toBeVisible()
    await goNotif(page)
    await page.getByRole('button', { name: 'Aceptar la invitación de Sofi' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Ya tienes «Mi plan de hoy» a esa hora' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Invitaciones (3)' })).toBeVisible() // sigue pendiente
  })

  test('también llegan las solicitudes de amigo cercano y de amistad, y se responden aquí', async ({ page }) => {
    await signIn(page)
    await goNotif(page)
    await page.getByRole('button', { name: 'Aceptar a Dani como amigo cercano' }).click()
    await expect(page.getByText('Dani ya es amigo cercano')).toBeVisible()
    await page.getByRole('button', { name: 'Aceptar la solicitud de Pau Martínez' }).click()
    await expect(page.getByText('Pau Martínez ya es tu amigo')).toBeVisible()
    await page.getByRole('button', { name: 'Rechazar la solicitud de Beto' }).click()
    await expect(page.getByRole('heading', { name: /Solicitudes de amistad/ })).toHaveCount(0)
  })
})

test.describe('elegir dónde es en el mapa', () => {
  test('con los botones de flecha (teclado) y con el mapa; sin zonas: solo distancia a ti', async ({ page }) => {
    await signIn(page)
    await goPublicar(page)
    await page.getByRole('button', { name: 'Elegir en el mapa' }).click()
    const dlg = page.getByRole('dialog', { name: 'Elegir en el mapa' })
    await expect(dlg).toContainText('Lugar elegido · a ')
    await expect(dlg).not.toContainText(/Chapultepec|ITESO|colonia|zona/i)
    const before1 = await dlg.getByText(/^Lugar elegido/).innerText()
    for (let i = 0; i < 15; i++) await dlg.getByRole('button', { name: 'Mover 100 m al este' }).click() // 1.5 km al este
    await expect(dlg.getByText(/^Lugar elegido/)).not.toHaveText(before1)
    await expectNoAxeViolations(page)
    // Tocar el mapa también mueve el pin.
    const before = await dlg.getByText(/^Lugar elegido/).innerText()
    await dlg.locator('canvas').first().click({ position: { x: 40, y: 40 }, force: true })
    await expect(dlg.getByText(/^Lugar elegido/)).not.toHaveText(before)
    await dlg.getByRole('button', { name: 'Usar este lugar' }).click()
    await expect(page.getByText(/Lugar exacto marcado en el mapa/)).toBeVisible()
    await page.getByLabel('¿Dónde es?').fill('Esquina de la plaza')
    await page.getByLabel('Cuéntales en una línea').fill('Nos vemos aquí')
    await page.getByRole('button', { name: /^Publicar plan/ }).click()
    await expect(page.getByText('Plan publicado')).toBeVisible()
  })
})

test.describe('publicar evento: fecha, hora de inicio y de fin', () => {
  const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

  async function openEvent(page: Page) {
    await signIn(page)
    await goPublicar(page)
    await page.getByRole('link', { name: /^Evento/ }).click()
    await page.getByLabel('Nombre del evento').fill('Reta de fin de semana')
    await fillPlace(page, '¿Dónde?', 'Parque Rojo')
  }

  test('se elige la fecha y la hora; valida pasado; hora de fin (incluso al día siguiente); unirse en curso sí/no; invitar', async ({ page }) => {
    await openEvent(page)
    await page.getByLabel('Fecha').fill('2020-01-01')
    await page.getByLabel('Hora de inicio').fill('10:00')
    await page.getByRole('button', { name: 'Publicar evento' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Elige una fecha y hora que no hayan pasado.' })).toBeVisible()
    await page.getByLabel('Fecha').fill(tomorrow())
    await page.getByLabel('Hora de inicio').fill('18:30')
    await page.getByLabel('Hora de fin').fill('')
    await page.getByRole('button', { name: 'Publicar evento' }).click()
    await expect(page.getByText('Elige a qué hora termina.')).toBeVisible()
    await page.getByLabel('Hora de fin').fill('21:00')
    await expect(page.getByRole('region', { name: 'Vista previa' })).toContainText('18:30–21:00 h')
    await expect(page.getByText('Si es antes de la hora de inicio, el evento termina al día siguiente.')).toBeVisible()
    // Unirse con el evento en curso: sí o no.
    const sw = page.getByRole('switch', { name: 'Se puede unir con el evento en curso' })
    await expect(sw).toHaveAttribute('aria-checked', 'true')
    await sw.click()
    await expect(sw).toHaveAttribute('aria-checked', 'false')
    await expect(page.getByText('Cuando el evento empiece, ya no entra nadie más.')).toBeVisible()
    await page.getByRole('checkbox', { name: 'Invitar a Sofi' }).click()
    await expectNoAxeViolations(page)
    await page.getByRole('button', { name: 'Publicar evento' }).click()
    await expect(page.getByText('Evento publicado · invitaste a 1')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Reta de fin de semana' })).toBeVisible()
    await expect(page.getByText(/6:30 pm – 9:00 pm/).first()).toBeVisible() // hora de inicio y de fin
  })

  test('no puedes crear un evento que se traslape con un plan tuyo', async ({ page }) => {
    await signIn(page)
    await goPublicar(page)
    await page.getByLabel('Cuéntales en una línea').fill('Plan de ahora')
    await fillPlace(page, '¿Dónde es?', 'Café de la esquina')
    await page.getByRole('button', { name: /^Publicar plan/ }).click()
    await expect(page.getByText('Plan publicado')).toBeVisible()
    const t = await page.evaluate(() => { const d = new Date(Date.now() + 10 * 60_000); return { day: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`, same: d.getDate() === new Date().getDate() } })
    test.skip(!t.same, 'Cruzaría la medianoche')
    await goPublicar(page)
    await page.getByRole('link', { name: /^Evento/ }).click()
    await page.getByLabel('Nombre del evento').fill('Evento encimado')
    await fillPlace(page, '¿Dónde?', 'Parque Rojo')
    await page.getByLabel('Fecha').fill(t.day)
    await page.getByLabel('Hora de inicio').fill(t.time)
    await page.getByRole('button', { name: 'Publicar evento' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Ya tienes «Plan de ahora» a esa hora' })).toBeVisible()
  })
})
