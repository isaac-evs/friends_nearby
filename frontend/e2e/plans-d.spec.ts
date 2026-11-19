import { expect, test, type Page } from '@playwright/test'
import { expectNoAxeViolations, fillPlace, signIn } from './helpers'

const tab = (page: Page, name: RegExp) => page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name })
const goPerfil = (page: Page) => tab(page, /^(Perfil|Mi perfil)$/).click()
const goPublicar = (page: Page) => page.getByRole('link', { name: /^Publicar plan/ }).click()
const goMisPlanes = async (page: Page) => { await goPerfil(page); await page.getByRole('link', { name: /^Mis planes Próximos/ }).click(); await expect(page.getByRole('heading', { name: 'Mis planes', level: 1 })).toBeVisible() }
const pasos = async (page: Page, n: number) => { for (let i = 0; i < n; i++) await page.getByRole('button', { name: 'Paso', exact: true }).click() }

async function jpeg(page: Page): Promise<Buffer> {
  const b64 = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 800; c.height = 500
    const g = c.getContext('2d')!; g.fillStyle = '#FF7A45'; g.fillRect(0, 0, 800, 500); g.fillStyle = '#3D3BD4'; g.fillRect(200, 100, 400, 300)
    return c.toDataURL('image/jpeg', 0.9).split(',')[1]!
  })
  return Buffer.from(b64, 'base64')
}

async function publish(page: Page, line: string, opts: { start?: string; dur?: string; place?: string } = {}) {
  await goPublicar(page)
  await page.getByLabel('Cuéntales en una línea').fill(line)
  if (opts.start) await page.getByRole('button', { name: opts.start, exact: true }).click()
  if (opts.dur) await page.getByRole('button', { name: opts.dur, exact: true }).click()
  await fillPlace(page, '¿Dónde es?', opts.place ?? 'Café Ámbar') // el lugar es obligatorio
  await page.getByRole('button', { name: /^Publicar plan/ }).click()
  await expect(page.getByText('Plan publicado')).toBeVisible()
}

test.describe('bloque D · planes con hora, duración y lugar exacto', () => {
  test('publicar con hora, duración y lugar exacto; avisa que se acerca y se puede ocultar', async ({ page }) => {
    await signIn(page)
    await goPublicar(page)
    await expect(page.getByRole('button', { name: 'Ahora', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('button', { name: '1 h', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText('Puedes unirte a un plan mientras está en curso, hasta que termina.')).toBeVisible()
    await page.getByLabel('Cuéntales en una línea').fill('Tacos en el centro')
    await page.getByRole('button', { name: 'En 30 min', exact: true }).click()
    await page.getByRole('button', { name: '2 h', exact: true }).click()
    await expect(page.getByRole('button', { name: /^Publicar plan · 2 h/ })).toBeVisible()
    // Lugar exacto (obligatorio): se escribe el nombre y se marca en el mapa.
    await fillPlace(page, '¿Dónde es?', 'Café Ámbar')
    await expect(page.getByText(/Lugar exacto marcado en el mapa · a /)).toBeVisible()
    await expectNoAxeViolations(page)
    await page.getByRole('button', { name: /^Publicar plan/ }).click()
    await expect(page.getByText('Plan publicado')).toBeVisible()

    // Aviso dentro de la app: "empieza en 30 min", con cómo llegar (app de mapas, lugar público) y Mis planes.
    const banner = page.getByText(/Tu plan «Tacos en el centro» empieza en 30 min\./)
    await expect(banner).toBeVisible()
    const way = page.getByRole('link', { name: /^Cómo llegar/ })
    await expect(way).toHaveAttribute('href', /google\.com\/maps\/dir\/\?api=1&destination=-?\d+\.\d+,-?\d+\.\d+/)
    await expect(way).toHaveAttribute('target', '_blank')
    await expect(way).toHaveAttribute('rel', /noopener/)
    await expectNoAxeViolations(page)
    await page.getByRole('button', { name: 'Ocultar aviso' }).click()
    await expect(banner).toHaveCount(0)
  })

  test('validaciones: duración fuera de rango, hora pasada y lugar sin marcar en el mapa', async ({ page }) => {
    await signIn(page)
    await goPublicar(page)
    await page.getByLabel('Cuéntales en una línea').fill('Plan con errores')
    await page.getByRole('button', { name: 'Otra', exact: true }).click()
    await page.getByLabel('Duración en minutos').fill('10')
    await page.getByRole('button', { name: 'Otra hora', exact: true }).click()
    await page.getByLabel('Hora de inicio (hoy)').fill('00:00')
    await page.getByLabel('¿Dónde es?').fill('Mi casa')
    await page.getByRole('button', { name: /^Publicar plan/ }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'La duración va de 15 minutos a 8 horas.' })).toBeVisible()
    await expect(page.getByRole('alert').filter({ hasText: 'Elige una hora de hoy que no haya pasado.' })).toBeVisible()
    await expect(page.getByRole('alert').filter({ hasText: 'Márcalo en el mapa para que tus amigos sepan dónde es.' })).toBeVisible()
    await expectNoAxeViolations(page)
    // Se corrige todo y publica (duración 90 → "1 h 30 min").
    await page.getByLabel('Duración en minutos').fill('90')
    await page.getByRole('button', { name: 'Ahora', exact: true }).click()
    await fillPlace(page, '¿Dónde es?', 'Mi casa')
    await expect(page.getByRole('button', { name: /^Publicar plan · 1 h 30 min/ })).toBeVisible()
    await page.getByRole('button', { name: /^Publicar plan/ }).click()
    await expect(page.getByText('Plan publicado')).toBeVisible()
  })

  test('foto del plan: opcional, con vista previa', async ({ page }) => {
    await signIn(page)
    await goPublicar(page)
    await page.locator('input[type=file][data-kind=plan]').setInputFiles({ name: 'plan.jpg', mimeType: 'image/jpeg', buffer: await jpeg(page) })
    await expect(page.getByRole('button', { name: 'Cambiar foto del plan' })).toBeVisible()
    await expect(page.locator('img[src^="blob:"]')).toHaveCount(1)
    await page.getByRole('button', { name: 'Quitar foto del plan' }).click()
    await expect(page.getByRole('button', { name: 'Subir foto del plan' })).toBeVisible()
  })
})

test.describe('bloque D · Mis planes', () => {
  test('próximos: detalle, editar la hora y cancelar (sin penalización al organizador)', async ({ page }) => {
    await signIn(page)
    await publish(page, 'Tacos en el centro', { start: 'En 30 min', dur: '1 h' })
    await goMisPlanes(page)
    await expect(page.getByRole('tablist', { name: 'Mis planes' }).getByRole('tab')).toHaveText(['Próximos', 'En curso', 'Pasados'])
    const card = page.getByRole('list', { name: 'Planes próximos' }).getByRole('listitem')
    await expect(card).toHaveCount(1)
    await expect(card).toContainText('Tacos en el centro')
    await expect(card).toContainText('Tú organizas')
    await expect(card).toContainText('dura 1 h')
    await expect(card).toContainText('Empieza en 30 min')
    await expectNoAxeViolations(page)

    // Editar la hora y la duración.
    await page.getByRole('button', { name: 'Editar hora de Tacos en el centro' }).click()
    const dlg = page.getByRole('dialog', { name: 'Editar hora' })
    await dlg.getByRole('button', { name: 'En 1 h', exact: true }).click()
    await dlg.getByRole('button', { name: '3 h', exact: true }).click()
    await dlg.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(page.getByText('Plan actualizado')).toBeVisible()
    await expect(card).toContainText('dura 3 h')
    await expect(card).toContainText('Empieza en 1 h')

    // Cancelar: confirmación; "Mantener" no cancela.
    await page.getByRole('button', { name: 'Cancelar plan Tacos en el centro' }).click()
    const conf = page.getByRole('dialog', { name: '¿Cancelar este plan?' })
    await expect(conf).toContainText('no pierdes XP')
    await expectNoAxeViolations(page)
    await conf.getByRole('button', { name: 'Mantener' }).click()
    await expect(card).toHaveCount(1)
    await page.getByRole('button', { name: 'Cancelar plan Tacos en el centro' }).click()
    await page.getByRole('dialog', { name: '¿Cancelar este plan?' }).getByRole('button', { name: 'Cancelar plan', exact: true }).click()
    await expect(page.getByText('Plan cancelado')).toBeVisible()
    await expect(page.getByText('No tienes planes próximos.')).toBeVisible()
  })

  test('en curso (un plan al que te uniste) y pasados (historial con quién fue)', async ({ page }) => {
    await signIn(page)
    await page.getByRole('button', { name: 'Jalo', exact: true }).click() // plan de Sofi, que ya está en curso
    await expect(page.getByRole('heading', { name: '¡Se armó!' })).toBeVisible()
    await page.goBack()
    await goMisPlanes(page)
    await expect(page.getByText('No tienes planes próximos.')).toBeVisible()
    await page.getByRole('tab', { name: 'En curso' }).click()
    const live = page.getByRole('list', { name: 'Planes en curso' }).getByRole('listitem')
    await expect(live).toHaveCount(1)
    await expect(live).toContainText('Por un café en Providencia, ¿alguien?')
    await expect(live).toContainText('Vas')
    await expect(live).toContainText(/En curso · termina en \d+ min/)
    await expect(live.getByRole('link', { name: 'Cómo llegar' })).toHaveAttribute('href', /google\.com\/maps\/dir\/\?api=1&destination=-?\d+\.\d+,-?\d+\.\d+/) // todo plan tiene lugar exacto: abre tu app de mapas
    await expectNoAxeViolations(page)
    await live.getByRole('link', { name: 'Ver', exact: true }).click()
    await expect(page.getByRole('heading', { name: '¡Se armó!' })).toBeVisible()
    await page.goBack()
    await page.getByRole('tab', { name: 'Pasados' }).click()
    await expect(page.getByText('6 planes en tu historial')).toBeVisible()
    await expect(page.getByRole('list', { name: 'Planes pasados' }).getByRole('listitem')).toHaveCount(6)
    await expect(page.getByRole('list', { name: 'Planes pasados' })).toContainText('Con Sofi y Mau')
  })

  test('acceso desde Publicar y enlace directo a una pestaña', async ({ page }) => {
    await signIn(page)
    await goPublicar(page)
    await page.getByRole('link', { name: 'Mis planes' }).click()
    await expect(page.getByRole('heading', { name: 'Mis planes', level: 1 })).toBeVisible()
    await page.goto('/planes?tab=pasados')
    await expect(page.getByRole('tab', { name: 'Pasados' })).toHaveAttribute('aria-selected', 'true')
  })
})

test.describe('bloque D · "Ya se armó", unirse en curso y verificar', () => {
  test('unirse a un plan EN CURSO: hora, cuenta regresiva, quiénes van y cómo llegar', async ({ page }) => {
    await signIn(page)
    await page.getByRole('button', { name: 'Jalo', exact: true }).click()
    await expect(page.getByRole('heading', { name: '¡Se armó!' })).toBeVisible()
    await expect(page.getByText(/^Hoy \d{1,2}:\d{2} [ap]m · dura 1 h$/)).toBeVisible()
    await expect(page.getByText(/en curso · termina en \d+ min/)).toBeVisible()
    await expect(page.getByRole('region', { name: 'Quiénes van' })).toContainText('Van: tú y Sofi y 2 más')
    await expect(page.getByRole('button', { name: 'Verificar que estoy aquí' })).not.toHaveAttribute('aria-disabled', 'true') // ya está en curso
    await expect(page.getByRole('link', { name: 'Cómo llegar' })).toHaveAttribute('href', /google\.com\/maps\/dir\/\?api=1&destination=-?\d+\.\d+,-?\d+\.\d+/)
    await expectNoAxeViolations(page)
  })

  test('un plan que aún no empieza: la verificación se activa 30 min antes (y dice por qué)', async ({ page }) => {
    await signIn(page)
    await pasos(page, 1) // el segundo plan es el de Mau, que empieza en 1 h
    await page.getByRole('button', { name: 'Jalo', exact: true }).click()
    await expect(page.getByRole('heading', { name: '¡Se armó!' })).toBeVisible()
    await expect(page.getByText(/empieza en 1 h/)).toBeVisible()
    const verify = page.getByRole('button', { name: 'Verificar que estoy aquí' })
    await expect(verify).toHaveAttribute('aria-disabled', 'true')
    await expect(verify).toHaveAccessibleDescription(/Se activa 30 min antes del inicio \(/)
    await verify.click({ force: true })
    await expect(page.getByText(/Se activa 30 min antes del inicio \(/).first()).toBeVisible()
    await expect(page.getByText('Verificado: llegaste al punto de encuentro.')).toHaveCount(0)
    await expectNoAxeViolations(page)
  })

  test('un plan con lugar exacto abre la app de mapas con ese lugar público', async ({ page }) => {
    await signIn(page)
    await pasos(page, 2) // el tercero es el de Regina (Biblioteca del ITESO)
    await page.getByRole('button', { name: 'Jalo', exact: true }).click()
    await expect(page.getByRole('heading', { name: '¡Se armó!' })).toBeVisible()
    await expect(page.getByText('Biblioteca del ITESO').first()).toBeVisible()
    const way = page.getByRole('link', { name: /^Cómo llegar/ })
    await expect(way).toHaveAttribute('href', /google\.com\/maps\/dir\/\?api=1&destination=-?\d+\.\d+,-?\d+\.\d+/)
    await expect(way).toHaveAttribute('target', '_blank')
    await expect(way).toContainText('abre tu app de mapas en otra pestaña')
  })

  test('todo plan tiene lugar exacto: su pin se ve en el mapa', async ({ page }) => {
    await signIn(page)
    await tab(page, /^(Mapa|Explorar y mapa)$/).click()
    await expect(page.getByRole('button', { name: /Regina: plan en Biblioteca del ITESO, lugar exacto/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Sofi: plan en Café Ámbar/ })).toBeVisible() // el lugar siempre es exacto
  })
})

test.describe('bloque D · eventos: hora de fin, foto y alias', () => {
  test('crear un evento con alias (el nombre real siempre se ve), hora de fin y foto', async ({ page }) => {
    await signIn(page)
    await page.getByRole('link', { name: /^Publicar plan/ }).click()
    await page.getByRole('link', { name: /^Evento/ }).click()
    await page.getByLabel('Nombre del evento').fill('Reta dominguera')
    await fillPlace(page, '¿Dónde?', 'Parque Rojo')
    await page.getByLabel('Hora de fin').fill('20:00') // 17:00 a 20:00
    await page.getByLabel('Alias del organizador (opcional)').fill('Club Domingueros')
    await expect(page.getByText('Tu nombre real, Alan, siempre se muestra.')).toBeVisible()
    await page.locator('input[type=file][data-kind=plan]').setInputFiles({ name: 'evento.jpg', mimeType: 'image/jpeg', buffer: await jpeg(page) })
    await expect(page.getByRole('button', { name: 'Cambiar foto del evento' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Vista previa' })).toContainText('Club Domingueros · por Alan')
    await expect(page.getByRole('region', { name: 'Vista previa' })).toContainText('17:00–20:00 h')
    await expectNoAxeViolations(page)
    await page.getByRole('button', { name: 'Publicar evento' }).click()

    await expect(page.getByRole('heading', { name: 'Reta dominguera' })).toBeVisible()
    await expect(page.getByText(/5:00 pm – 8:00 pm/).first()).toBeVisible() // inicio y fin, no duración
    await expect(page.getByText('Club Domingueros', { exact: true })).toBeVisible() // el alias es el título del organizador…
    await expect(page.getByText(/por Alan/)).toBeVisible() // …y el nombre real siempre aparece
    await expect(page.getByRole('img', { name: 'Foto del evento' })).toBeVisible()
    await expectNoAxeViolations(page)
    // El evento que organizas aparece en Mis planes (próximos).
    await page.getByRole('button', { name: 'Volver' }).click()
  })
})
