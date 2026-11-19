import { expect, test, type Page } from '@playwright/test'
import { expectNoAxeViolations, signIn } from './helpers'

const tab = (page: Page, name: RegExp) => page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name })
const goPerfil = (page: Page) => tab(page, /^(Perfil|Mi perfil)$/).click()
const goAmigos = (page: Page) => tab(page, /^Amigos/).click()

test.describe('perfil · descripción y niveles', () => {
  test('mi perfil: la racha va junto al nombre (fuego + semanas), solo "Nivel 7" y sin zonas', async ({ page }) => {
    await signIn(page)
    await goPerfil(page)
    await expect(page.getByText('Corro en las mañanas y tomo café en las tardes. Siempre con ganas de jalar.')).toBeVisible()
    // Racha junto al nombre.
    const header = page.getByRole('heading', { name: 'Alan', level: 1 }).locator('xpath=..')
    await expect(header).toContainText('4 sem')
    await expect(header.locator('svg')).toHaveCount(1) // el fuego
    await expect(header).toContainText('de racha') // texto para lector de pantalla
    // Nivel: solo "Nivel 7".
    const lvl = page.getByRole('link', { name: 'Nivel 7', exact: true })
    await expect(lvl).toBeVisible()
    await expect(lvl).not.toContainText('Social')
    await expect(page.getByText('Nivel 7 de 100')).toHaveCount(0)
    await expect(page.getByText(/jales más para nivel/)).toHaveCount(0)
    // Nombre de usuario visible; sin zonas, ni "jales este mes", ni "eventos".
    await expect(page.getByText('@alan', { exact: true })).toBeVisible()
    await expect(page.getByText(/zonas/i)).toHaveCount(0)
    await expect(page.getByText('jales este mes')).toHaveCount(0)
    await expect(page.getByText('eventos', { exact: true })).toHaveCount(0)
    await expectNoAxeViolations(page)

    // La información de la racha solo aparece al tocarla.
    await expect(page.getByText('Se mantiene con al menos un plan o evento cada semana')).toHaveCount(0)
    await page.getByRole('button', { name: /4 sem de racha/ }).click()
    const dlg = page.getByRole('dialog', { name: 'Tu racha' })
    await expect(dlg).toContainText('4 semanas de racha')
    await expect(dlg).toContainText('Se mantiene con al menos un plan o evento cada semana (de lunes a domingo).')
    await expect(dlg).toContainText('Esta semana aún no cuenta')
    await expectNoAxeViolations(page)
    await page.keyboard.press('Escape')
    await expect(dlg).toHaveCount(0)

    await lvl.click()
    await expect(page.getByRole('heading', { name: 'Nivel 7', level: 1 })).toBeVisible()
  })

  test('desktop: abajo en la barra lateral van el nombre, "Nivel 7" y la insignia de racha, sin el nombre del nivel', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'La barra lateral solo existe en desktop')
    await signIn(page)
    const card = page.getByRole('complementary', { name: 'Menú' })
    await expect(card).toContainText('Alan')
    await expect(card).toContainText('Nivel 7')
    await expect(card).toContainText('4 sem')
    await expect(card).not.toContainText('Social de barrio')
    await expect(card).not.toContainText('Modo abierto')
    // Orden y orden visual: foto + nombre + racha arriba; "Nivel 7" arriba de la barra de nivel; todo dentro de la barra lateral.
    const box = async (loc: ReturnType<typeof card.locator>) => (await loc.boundingBox())!
    const side = await box(card)
    const name = await box(card.getByText('Alan', { exact: true }))
    const streak = await box(card.getByText('4 sem'))
    const lvl = await box(card.getByText('Nivel 7', { exact: true }))
    const bar = await box(card.getByRole('progressbar'))
    expect(name.y).toBeLessThan(lvl.y)
    expect(streak.y).toBeGreaterThanOrEqual(name.y)
    expect(lvl.y + lvl.height).toBeLessThanOrEqual(bar.y)
    for (const b of [name, streak, lvl, bar]) { expect(b.x).toBeGreaterThanOrEqual(side.x); expect(b.x + b.width).toBeLessThanOrEqual(side.x + side.width) }
    await expectNoAxeViolations(page)
  })

  test('editar la descripción: guarda, valida 160 caracteres y se puede quitar', async ({ page }) => {
    await signIn(page)
    await goPerfil(page)
    await page.getByRole('link', { name: 'Editar perfil' }).click()
    const area = page.getByRole('textbox', { name: 'Cuéntale a tu banda quién eres' })
    const save = page.getByRole('button', { name: 'Guardar descripción' })
    await expect(save).toBeDisabled()
    await area.fill('x'.repeat(161))
    await expect(page.getByText('161/160 caracteres')).toBeVisible()
    await save.click()
    await expect(page.getByRole('alert').filter({ hasText: 'Máximo 160 caracteres.' })).toBeVisible()
    await area.fill('  Ciclista de domingo y fan de las tortas.  ')
    await save.click()
    await expect(page.getByText('Descripción actualizada')).toBeVisible()
    await page.getByRole('button', { name: 'Volver al perfil' }).click()
    await expect(page.getByText('Ciclista de domingo y fan de las tortas.')).toBeVisible()
    // Quitarla deja una invitación a agregarla.
    await page.getByRole('link', { name: 'Editar perfil' }).click()
    await area.fill('')
    await save.click()
    await expect(page.getByText('Descripción quitada')).toBeVisible()
    await page.getByRole('button', { name: 'Volver al perfil' }).click()
    await expect(page.getByRole('link', { name: 'Agrega una descripción' })).toBeVisible()
    await expectNoAxeViolations(page)
  })

  test('el perfil de otra persona muestra su descripción y su nivel con color', async ({ page }) => {
    await signIn(page)
    await goAmigos(page)
    await page.getByPlaceholder('Busca por @usuario').fill('@sofi')
    await page.getByRole('region', { name: 'Resultados de búsqueda' }).getByRole('link', { name: 'Sofi' }).click()
    await expect(page.getByText('Café, brunch y conversaciones largas.')).toBeVisible()
    await expect(page.getByText('Nivel 6 · Compa', { exact: true })).toBeVisible()
    await expect(page.getByText('Nivel 6 · Compa', { exact: true })).toHaveAttribute('style', /background/)
    await expect(page.getByRole('heading', { name: 'Sofi', level: 1 }).locator('xpath=..')).toContainText('3 sem') // su racha, junto al nombre
  })

  test('página de nivel: racha, progreso, últimos planes, los 100 niveles e historial', async ({ page }) => {
    await signIn(page)
    await goPerfil(page)
    await page.getByRole('link', { name: 'Nivel 7', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Nivel 7', level: 1 })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Social de barrio' })).toBeVisible()
    const tabs = page.getByRole('tablist', { name: 'Tu nivel' }).getByRole('tab')
    await expect(tabs).toHaveCount(3)
    await expect(tabs.nth(2)).toHaveText('Historial')

    // Progreso (por defecto): sin información de racha (esa va al tocarla en el perfil), siguiente nivel, actividad, últimos planes.
    await expect(page.getByRole('tab', { name: 'Progreso' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('region', { name: 'Racha' })).toHaveCount(0)
    await expect(page.getByText(/semanas de racha/)).toHaveCount(0)
    await expect(page.getByText('Nivel 8 · Cuate')).toBeVisible()
    await expect(page.getByText('340 / 500 XP')).toBeVisible()
    await expect(page.getByRole('progressbar', { name: 'Progreso al nivel 8' }).last()).toBeVisible() // en desktop la barra lateral trae otra
    const activity = page.getByRole('list', { name: 'Tu actividad' })
    await expect(activity).toContainText('Jales')
    await expect(activity).toContainText('Eventos')
    await expect(page.getByText(/zonas/i)).toHaveCount(0)
    const latest = page.getByRole('region', { name: 'Últimos planes' }).getByRole('listitem')
    await expect(latest).toHaveCount(3)
    await expect(latest.nth(0)).toContainText('Café y plática en Providencia')
    await expect(latest.nth(0)).toContainText('Con Sofi y Mau') // quién fue
    await expect(latest.nth(0)).toContainText('Café Ámbar')
    await expectNoAxeViolations(page)

    // "Ver historial" lleva a la pestaña Historial con todos los planes.
    await page.getByRole('button', { name: 'Ver historial (6)' }).click()
    await expect(page.getByRole('tab', { name: 'Historial' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByText('6 planes en tu historial')).toBeVisible()
    const hist = page.getByRole('list', { name: 'Historial de planes' }).getByRole('listitem')
    await expect(hist).toHaveCount(6)
    await expect(hist.filter({ hasText: 'Social Run 5K en Colomos' })).toContainText('Evento · Correr')
    // Más de 5 personas: solo 5 íconos + un "+3", y TODOS los nombres en texto.
    const run = hist.filter({ hasText: 'Social Run 5K en Colomos' })
    await expect(run.locator('span[aria-hidden="true"].flex > span.relative')).toHaveCount(5)
    await expect(run.getByTestId('avatar-more')).toHaveText('+3')
    await expect(run).toContainText('Con Mau, Dani, Pau Martínez, Sofi, Regina, Ximena Torres, Rodri Peña y Paola Ríos')
    // Con 5 o menos: sin "+N".
    await expect(hist.filter({ hasText: 'Café y plática en Providencia' }).getByTestId('avatar-more')).toHaveCount(0)
    await expect(hist.filter({ hasText: 'Café y plática en Providencia' }).locator('span[aria-hidden="true"].flex > span.relative')).toHaveCount(2)
    await expect(hist.filter({ hasText: 'Repaso para el parcial' })).toContainText('Con Regina')
    await expect(hist.filter({ hasText: 'Picnic y juegos de mesa' })).toContainText('Con Sofi y Nico')
    await expect(page.getByText('Solo tú ves este historial.')).toBeVisible()
    await expectNoAxeViolations(page)

    // Niveles
    await page.getByRole('tab', { name: 'Historial' }).focus()
    await page.keyboard.press('ArrowLeft')
    await expect(page.getByRole('tab', { name: 'Niveles' })).toHaveAttribute('aria-selected', 'true')
    const items = page.locator('section ul > li')
    await expect(items).toHaveCount(100)
    await expect(page.locator('section h2')).toHaveCount(10)
    await expect(page.locator('li[aria-current="true"]')).toContainText('Nivel 7')
    await expect(items.filter({ hasText: '(alcanzado)' })).toHaveCount(6)
    await expect(items.filter({ hasText: '(por alcanzar)' })).toHaveCount(93)
    await expect(items.filter({ hasText: 'Nivel 100 · máximo' })).toContainText('Máxima leyenda')
    await expect(items.locator('svg')).toHaveCount(100)
    await expectNoAxeViolations(page)

    // Enlace directo y volver.
    await page.goto('/perfil/nivel?tab=historial')
    await expect(page.getByRole('tab', { name: 'Historial' })).toHaveAttribute('aria-selected', 'true')
    await page.getByRole('button', { name: 'Volver al perfil' }).click()
    await expect(page.getByRole('heading', { name: 'Alan', level: 1 })).toBeVisible()
  })

  test('un "Ya nos vimos" confirmado entre los dos suma el plan al historial y una semana de racha', async ({ page }) => {
    await signIn(page)
    await page.getByRole('button', { name: 'Jalo', exact: true }).click()
    await expect(page.getByRole('heading', { name: '¡Se armó!' })).toBeVisible()
    await page.getByRole('button', { name: 'Ya nos vimos' }).click()
    await expect(page.getByText(/Los dos confirmaron/)).toBeVisible({ timeout: 6000 })
    await expect(page.getByText(/racha de 5 semanas/)).toBeVisible()
    await page.goBack()
    await goPerfil(page)
    await expect(page.getByRole('heading', { name: 'Alan', level: 1 }).locator('xpath=..')).toContainText('5 sem')
    // La racha se consulta tocándola en el perfil.
    await page.getByRole('button', { name: /5 sem de racha/ }).click()
    await expect(page.getByRole('dialog', { name: 'Tu racha' })).toContainText('5 semanas de racha')
    await expect(page.getByRole('dialog', { name: 'Tu racha' })).toContainText('Esta semana ya cuenta.')
    await page.keyboard.press('Escape')
    await page.getByRole('link', { name: 'Nivel 7', exact: true }).click()
    await expect(page.getByText('360 / 500 XP')).toBeVisible()
    await page.getByRole('tab', { name: 'Historial' }).click()
    await expect(page.getByText('7 planes en tu historial')).toBeVisible()
    const first = page.getByRole('list', { name: 'Historial de planes' }).getByRole('listitem').first()
    await expect(first).toContainText('Por un café en Providencia, ¿alguien?')
    await expect(first).toContainText('Café Ámbar')
    await expect(first).toContainText('Con Sofi')
    await expect(first).toContainText('hoy')
  })

  test('Amigos tiene dos pestañas (Amigos y Ranking) con teclado y enlace directo', async ({ page }) => {
    await signIn(page)
    await goAmigos(page)
    const tabs = page.getByRole('tablist', { name: 'Tu banda' }).getByRole('tab')
    await expect(tabs).toHaveCount(2)
    await expect(page.getByRole('tab', { name: 'Amigos' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('tabpanel')).toContainText('Mi link')
    await expect(page.getByRole('heading', { name: 'Ranking de siempre' })).toHaveCount(0)
    await page.getByRole('tab', { name: 'Amigos' }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('tab', { name: 'Ranking' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('tab', { name: 'Ranking' })).toBeFocused()
    await expect(page.getByRole('heading', { name: 'Ranking de siempre' })).toBeVisible()
    await expect(page.getByRole('tabpanel')).not.toContainText('Mi link')
    await expectNoAxeViolations(page)
    await page.keyboard.press('ArrowLeft')
    await expect(page.getByRole('tab', { name: 'Amigos' })).toHaveAttribute('aria-selected', 'true')
    // Enlace directo a la pestaña.
    await page.goto('/amigos?tab=ranking')
    await expect(page.getByRole('tab', { name: 'Ranking' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('heading', { name: 'Ranking de siempre' })).toBeVisible()
  })

  test('las filas de privacidad llevan ícono sin recuadro (solo trazo negro al lado) y amigos cercanos solo dice cuántos', async ({ page }) => {
    await signIn(page)
    await goPerfil(page)
    const region = page.getByRole('region', { name: 'Privacidad' })
    const icons = region.locator('span[aria-hidden="true"].size-6')
    await expect(icons).toHaveCount(4)
    for (let i = 0; i < 4; i++) {
      const icon = icons.nth(i)
      await expect(icon.locator('svg')).toHaveCount(1)
      await expect(icon).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)') // sin fondo
      await expect(icon).toHaveCSS('border-top-width', '0px') // sin borde
      await expect(icon).toHaveCSS('color', 'rgb(17, 17, 20)') // negro (token ink)
    }
    for (const label of ['Modo fantasma', 'Amigos cercanos', 'Mis planes', 'Modo abierto']) await expect(region).toContainText(label)
    await expect(region).not.toContainText('ranking') // el ranking es obligatorio: ya no es un ajuste
    const close = page.getByRole('link', { name: /^Amigos cercanos/ })
    await expect(close).toContainText('3 cercanos')
    await expect(close).not.toContainText('solo ellos')
    await expectNoAxeViolations(page)
  })

  test('el modo abierto solo se enlaza desde el perfil', async ({ page }) => {
    await signIn(page)
    const link = page.locator('a[href="/modo-abierto"]')
    for (const url of ['/', '/mapa', '/amigos', '/publicar', '/publicar/evento', '/guardados']) {
      await page.goto(url)
      await expect(page.getByRole('heading').first()).toBeVisible()
      await expect(link).toHaveCount(0)
    }
    await page.goto('/')
    await page.getByRole('button', { name: /^Abierto/ }).click()
    await expect(page.getByRole('heading', { name: 'El modo abierto está apagado' })).toBeVisible()
    await expect(link).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Ir a mi perfil' })).toHaveAttribute('href', '/perfil')
    await page.goto('/perfil')
    await expect(link).toHaveCount(1)
    await expect(link).toContainText('Modo abierto')
  })
})
