import { expect, test, type Page } from '@playwright/test'
import { signIn } from './helpers'

const tab = (page: Page, name: RegExp) => page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name })
const goMapa = (page: Page) => tab(page, /^(Mapa|Explorar y mapa)$/).click()
const goPerfil = (page: Page) => tab(page, /^(Perfil|Mi perfil)$/).click()
const chill = (page: Page, name: string) => page.getByRole('button', { name: new RegExp(`${name}: sin plan`) })

test.describe('mapa · amigos cercanos sin plan', () => {
  test('un amigo cercano sin plan aparece con su nombre y el aro parpadeando (sin la palabra "Chilling"); con plan se ve su plan', async ({ page }) => {
    await signIn(page)
    await goMapa(page)
    const nico = chill(page, 'Nico')
    await expect(nico).toBeVisible()
    // En el mapa va su nombre, no la palabra "Chilling"; el estado "sin plan" lo dice el nombre accesible, la hoja, la lista y la leyenda.
    await expect(nico).toContainText('Nico')
    await expect(page.getByText('Chilling')).toHaveCount(0)
    const ring = nico.locator('span.animate-chill').first()
    expect(await ring.evaluate((el) => getComputedStyle(el).animationName)).toBe('chill-blink')
    expect(await ring.evaluate((el) => getComputedStyle(el).animationIterationCount)).toBe('infinite')
    // Sofi (cercana) tiene un plan activo: se ve su plan, no "chilling".
    await expect(page.getByRole('button', { name: /Sofi: plan en Café Ámbar/ })).toBeVisible()
    await expect(chill(page, 'Sofi')).toHaveCount(0)
    // Un amigo que no es cercano solo aparece con plan.
    await expect(page.getByRole('button', { name: /Dani: plan en Tortas ahogadas/ })).toBeVisible()
    await expect(chill(page, 'Dani')).toHaveCount(0)
  })

  test('con movimiento reducido el marcador queda fijo (no parpadea)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await signIn(page)
    await goMapa(page)
    const ring = chill(page, 'Nico').locator('span.animate-chill').first()
    await expect(ring).toBeVisible()
    expect(await ring.evaluate((el) => getComputedStyle(el).animationName)).toBe('none')
  })

  test('solo los cercanos (de los dos): si dejas de serlo Nico desaparece; Leo tiene la ubicación en pausa y no se ve', async ({ page }) => {
    await signIn(page)
    await goPerfil(page)
    await page.getByRole('link', { name: /^Amigos cercanos/ }).click()
    await page.getByRole('button', { name: 'Invitar a Leo a ser amigo cercano' }).click() // Leo acepta, pero su ubicación está en pausa
    await expect(page.getByRole('heading', { name: 'Cercanos (4)' })).toBeVisible({ timeout: 8000 })
    await page.getByRole('button', { name: 'Ubicación exacta con Nico' }).click()
    await page.getByRole('dialog', { name: 'Ubicación exacta · Nico' }).getByRole('button', { name: 'Quitar de amigos cercanos' }).click()
    await page.getByRole('button', { name: 'Volver al perfil' }).click()
    await goMapa(page)
    await expect(page.getByRole('button', { name: /Dani: plan en Tortas ahogadas/ })).toBeVisible() // el mapa ya cargó
    await expect(chill(page, 'Nico')).toHaveCount(0)
    await expect(chill(page, 'Leo')).toHaveCount(0)
  })

  test('lista equivalente, hoja del seleccionado y perfil (móvil)', async ({ page }) => {
    test.skip(test.info().project.name === 'desktop', 'La lista en cajón de desktop se cubre en desktop.spec')
    await signIn(page)
    await page.goto('/mapa?sel=chill-nico') // el sheet del plan de Sofi tapa a Nico: se abre ya seleccionado
    const sheet = page.getByRole('region', { name: 'Seleccionado en el mapa' })
    await expect(sheet).toContainText('Nico · sin plan')
    await expect(sheet).toContainText('Sin plan por ahora')
    // Filtros: "Eventos" lo oculta; "Amigos" lo muestra.
    await page.getByRole('button', { name: 'Eventos', exact: true }).click()
    await expect(chill(page, 'Nico')).toHaveCount(0)
    await page.getByRole('button', { name: 'Amigos', exact: true }).click()
    await expect(chill(page, 'Nico')).toBeVisible()
    // Lista equivalente.
    await page.getByRole('button', { name: 'Lista', exact: true }).click()
    const row = page.getByRole('list', { name: /en lista/ }).getByRole('listitem').filter({ hasText: 'Nico · sin plan' })
    await expect(row).toContainText('Sin plan por ahora.')
    await row.getByRole('link', { name: 'Ver perfil' }).click()
    await expect(page.getByRole('heading', { name: 'Nico', level: 1 })).toBeVisible()
    await expect(page.getByText('Siempre cerca de la cancha. Cuando no hay plan, estoy chilling.')).toBeVisible()
  })
})
