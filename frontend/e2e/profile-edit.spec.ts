import { expect, test, type Page } from '@playwright/test'
import { expectNoAxeViolations, signIn } from './helpers'

/** Genera un JPEG real (600×400) en el navegador y le inyecta un segmento EXIF con una marca de "GPS". */
async function jpegWithExif(page: Page): Promise<Buffer> {
  const b64 = await page.evaluate(() => {
    const c = document.createElement('canvas')
    c.width = 600; c.height = 400
    const g = c.getContext('2d')!
    g.fillStyle = '#3D3BD4'; g.fillRect(0, 0, 600, 400)
    g.fillStyle = '#FF7A45'; g.fillRect(200, 100, 200, 200)
    return c.toDataURL('image/jpeg', 0.9).split(',')[1]!
  })
  const jpeg = Buffer.from(b64, 'base64')
  const payload = Buffer.concat([Buffer.from('Exif\0\0MM\0*', 'latin1'), Buffer.from('GPSLatitude-20.67 GPSLongitude-103.35', 'latin1')])
  const seg = Buffer.concat([Buffer.from([0xff, 0xe1, (payload.length + 2) >> 8, (payload.length + 2) & 0xff]), payload])
  return Buffer.concat([jpeg.subarray(0, 2), seg, jpeg.subarray(2)])
}

async function openEdit(page: Page) {
  await signIn(page)
  // Navegación del lado del cliente: el estado del mock vive en memoria.
  await page.getByRole('link', { name: /^Perfil$|Mi perfil/ }).click()
  await page.getByRole('link', { name: 'Editar perfil' }).click()
  await expect(page.getByRole('heading', { name: 'Editar perfil', level: 1 })).toBeVisible()
}

test.describe('bloque A · editar perfil', () => {
  test('cambiar nombre: valida, guarda y se refleja en el perfil', async ({ page }) => {
    await openEdit(page)
    const field = page.getByRole('textbox', { name: 'Nombre', exact: true })
    await expect(page.getByRole('button', { name: 'Guardar nombre' })).toBeDisabled()
    await field.fill('A')
    await page.getByRole('button', { name: 'Guardar nombre' }).click()
    await expect(page.getByRole('alert')).toContainText('mínimo 2 letras')
    await field.fill('  Alan V  ')
    await page.getByRole('button', { name: 'Guardar nombre' }).click()
    await expect(page.getByText('Nombre actualizado')).toBeVisible()
    await page.getByRole('button', { name: 'Volver al perfil' }).click()
    await expect(page.getByRole('heading', { name: 'Alan V', level: 1 })).toBeVisible()
  })

  test('cambiar contraseña: reglas, errores y éxito (la contraseña no se conserva)', async ({ page }) => {
    await openEdit(page)
    const cur = page.getByRole('textbox', { name: 'Contraseña actual', exact: true })
    const next = page.getByRole('textbox', { name: 'Contraseña nueva', exact: true })
    const conf = page.getByRole('textbox', { name: 'Confirma la contraseña nueva', exact: true })
    const submit = page.getByRole('button', { name: 'Cambiar contraseña' })

    await submit.click()
    await expect(page.getByRole('alert').first()).toContainText('contraseña actual')

    await cur.fill('vieja-1234')
    await next.fill('corta')
    await expect(page.getByRole('list', { name: /Requisitos/ })).toContainText('Al menos 8 caracteres (pendiente)')
    await conf.fill('corta')
    await submit.click()
    await expect(page.getByRole('alert')).toContainText('al menos 8 caracteres')

    await next.fill('nueva-1234'); await conf.fill('otra-12345')
    await expect(page.getByRole('list', { name: /Requisitos/ })).toContainText('Un número (cumplido)')
    await submit.click()
    await expect(page.getByRole('alert')).toContainText('no coinciden')

    await next.fill('vieja-1234'); await conf.fill('vieja-1234')
    await submit.click()
    await expect(page.getByRole('alert')).toContainText('distinta de la actual')

    // Error del "servidor": la contraseña actual es incorrecta.
    await cur.fill('incorrecta1'); await next.fill('nueva-1234'); await conf.fill('nueva-1234')
    await submit.click()
    await expect(page.getByRole('alert')).toContainText('actual no es correcta')

    await cur.fill('vieja-1234')
    await submit.click()
    await expect(page.getByText('Listo, tu contraseña cambió.')).toBeVisible()
    await expect(cur).toHaveValue('')
    await expect(next).toHaveValue('')
  })

  test('foto de perfil y portada: vista previa, quitar y errores de archivo', async ({ page }) => {
    await openEdit(page)
    const avatarInput = page.locator('input[type=file][data-kind=avatar]')
    const coverInput = page.locator('input[type=file][data-kind=cover]')
    const jpeg = await jpegWithExif(page)

    await avatarInput.setInputFiles({ name: 'yo.jpg', mimeType: 'image/jpeg', buffer: jpeg })
    await expect(page.getByRole('button', { name: 'Cambiar foto de perfil' })).toBeVisible()
    await coverInput.setInputFiles({ name: 'portada.jpg', mimeType: 'image/jpeg', buffer: jpeg })
    await expect(page.getByRole('button', { name: 'Cambiar portada' })).toBeVisible()
    await expectNoAxeViolations(page)

    // Se ven en Mi perfil.
    await page.getByRole('button', { name: 'Volver al perfil' }).click()
    // Portada + foto en el perfil (en desktop la barra lateral muestra tu foto una vez más).
    await expect(page.locator('img[src^="blob:"]')).toHaveCount(test.info().project.name === 'desktop' ? 3 : 2)
    await page.getByRole('link', { name: 'Editar perfil' }).click()

    await page.getByRole('button', { name: 'Quitar foto de perfil' }).click()
    await expect(page.getByRole('button', { name: 'Subir foto de perfil' })).toBeVisible()

    // Tipo no permitido.
    await avatarInput.setInputFiles({ name: 'nota.txt', mimeType: 'text/plain', buffer: Buffer.from('hola') })
    await expect(page.getByRole('alert')).toContainText('JPG, PNG o WebP')
    // Demasiado pesada.
    await avatarInput.setInputFiles({ name: 'grande.png', mimeType: 'image/png', buffer: Buffer.alloc(5 * 1024 * 1024 + 1) })
    await expect(page.getByRole('alert')).toContainText('5 MB')
    // Dice ser imagen pero no se puede leer.
    await avatarInput.setInputFiles({ name: 'rota.png', mimeType: 'image/png', buffer: Buffer.from('no soy una imagen') })
    await expect(page.getByRole('alert')).toContainText('No pudimos leer esa imagen')
    await expect(page.getByRole('button', { name: 'Subir foto de perfil' })).toBeVisible()
    await expectNoAxeViolations(page)
  })

  test('privacidad: la imagen subida no conserva EXIF ni GPS y sale recortada', async ({ page }) => {
    await openEdit(page)
    const jpeg = await jpegWithExif(page)
    expect(jpeg.includes(Buffer.from('GPSLatitude'))).toBe(true) // el original sí trae el dato
    await page.locator('input[type=file][data-kind=avatar]').setInputFiles({ name: 'yo.jpg', mimeType: 'image/jpeg', buffer: jpeg })
    await expect(page.getByRole('button', { name: 'Cambiar foto de perfil' })).toBeVisible()
    const out = await page.evaluate(async () => {
      const src = document.querySelector<HTMLImageElement>('img[src^="blob:"]')!.src
      const buf = new Uint8Array(await (await fetch(src)).arrayBuffer())
      const text = Array.from(buf, (b) => String.fromCharCode(b)).join('')
      const bmp = await createImageBitmap(new Blob([buf]))
      return { hasExif: text.includes('Exif'), hasGps: text.includes('GPS'), w: bmp.width, h: bmp.height }
    })
    expect(out.hasExif).toBe(false)
    expect(out.hasGps).toBe(false)
    expect({ w: out.w, h: out.h }).toEqual({ w: 400, h: 400 }) // 600×400 → cuadrado centrado
  })

  test('accesibilidad: pantalla sin violaciones de axe, con errores visibles', async ({ page }) => {
    await openEdit(page)
    await expectNoAxeViolations(page)
    await page.getByRole('button', { name: 'Cambiar contraseña' }).click()
    await expect(page.getByRole('alert').first()).toBeVisible()
    await expectNoAxeViolations(page)
  })

  test('nombre de usuario: validación, disponibilidad y se refleja en el perfil', async ({ page }) => {
    await openEdit(page)
    const field = page.getByRole('textbox', { name: 'Usuario', exact: true })
    const save = page.getByRole('button', { name: 'Guardar usuario' })
    await expect(field).toHaveValue('alan')
    await expect(save).toBeDisabled()
    for (const [value, msg] of [
      ['ab', 'Mínimo 3 caracteres.'],
      ['con espacio', 'Solo letras minúsculas, números, punto y guion bajo.'],
      ['.alan', 'No puede empezar ni terminar con punto'],
      ['admin', 'Ese nombre de usuario no está disponible.'],
    ] as const) {
      await field.fill(value)
      await save.click()
      await expect(page.getByRole('alert').filter({ hasText: msg })).toBeVisible()
    }
    // Ya lo tiene otra persona (se compara sin importar mayúsculas).
    await field.fill('MAU')
    await save.click()
    await expect(page.getByRole('alert').filter({ hasText: 'Ese nombre de usuario ya está en uso.' })).toBeVisible()
    // Libre: se guarda (en minúsculas) y se ve en el perfil.
    await field.fill('Alan.V')
    await save.click()
    await expect(page.getByText('Usuario actualizado')).toBeVisible()
    await expect(field).toHaveValue('alan.v')
    await expectNoAxeViolations(page)
    await page.getByRole('button', { name: 'Volver al perfil' }).click()
    await expect(page.getByText('@alan.v', { exact: true })).toBeVisible()
  })
})

