import { expect, test } from '@playwright/test'
import { expectNoAxeViolations, signIn } from './helpers'

test.describe('desktop (≥ 1024 px)', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'solo desktop'))

  test('lista en cajón lateral: se abre y se pliega sin tapar el mapa; controles alineados', async ({ page }) => {
    await signIn(page)
    const map = page.getByRole('region', { name: 'Mapa de amigos y eventos' })
    const drawer = page.locator('#map-list-drawer')
    const toggle = page.getByRole('button', { name: 'Ver como lista' })

    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await toggle.click()
    await expect(drawer.getByRole('heading', { name: /En lista/ })).toBeVisible()
    // El mapa sigue ahí: el cajón solo ocupa la columna izquierda.
    const mapBox = (await map.boundingBox())!
    const drawerBox = (await drawer.boundingBox())!
    expect(drawerBox.width).toBeLessThan(mapBox.width / 2)
    await expect(page.getByRole('button', { name: 'Acercar' })).toBeVisible()

    await page.getByRole('button', { name: 'Ocultar lista' }).click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(drawer.getByRole('heading', { name: /En lista/ })).toBeHidden()

    // "Ubicarme" comparte columna (mismo centro horizontal y mismo ancho) con acercar / alejar.
    const boxes = await Promise.all(['Centrar en mi ubicación', 'Acercar', 'Alejar'].map((n) => page.getByRole('button', { name: n }).boundingBox()))
    const centers = boxes.map((b) => Math.round(b!.x + b!.width / 2))
    expect(new Set(centers).size).toBe(1)
    expect(new Set(boxes.map((b) => b!.width)).size).toBe(1)
  })

  test('las pantallas usan el ancho disponible (sin columna angosta de 480 px)', async ({ page }) => {
    await signIn(page)
    for (const url of ['/amigos', '/perfil', '/publicar', '/modo-abierto']) {
      await page.goto(url)
      const main = page.locator('main > div').first()
      expect((await main.boundingBox())!.width).toBeGreaterThan(900)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    }
  })

  test('axe en auth y permiso (layout dividido)', async ({ page }) => {
    await page.goto('/entrar'); await expectNoAxeViolations(page)
  })
})
