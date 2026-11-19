# ¿Jalas? — frontend integrado

Interfaz G1–G4 de Alan Varela (`e054728`) conectada al backend Go del repositorio.
La especificación de producto vigente está en [docs/especificacion.md](docs/especificacion.md).

## Ejecutar

En una terminal, desde `backend/`:

```powershell
docker compose up -d
go run ./cmd/local
```

En otra terminal, desde `frontend/`:

```powershell
Copy-Item .env.example .env
npm ci
npm run dev
```

Abrir http://localhost:5173 y registrar una cuenta real. La sesión usa un JWT en
sessionStorage; los perfiles, amistad, planes, eventos y progreso se guardan en
backend. No hay cuentas de ejemplo, aceptaciones ni confirmaciones automáticas.
El cliente usa `VITE_API_URL` y `VITE_WS_URL`; los valores locales están en
`.env.example`. Ningún secreto debe ir en variables `VITE_*`.

La ubicación personal solo aparece entre cercanos mutuos. Planes y eventos
requieren un lugar público explícito seleccionado en el mapa. Se puede usar
ubicación manual para descubrir/publicar; el check-in exige permiso de GPS.
Apagar modo abierto conserva las asistencias existentes en Mis planes.

## Pruebas

```powershell
npm run typecheck
npm test
npm run build
npm run test:e2e
```

E2E requiere backend local, DynamoDB, Redis y Chromium de Playwright instalado
(`npx playwright install chromium`). La suite `e2e/integration` crea cuentas reales
y prueba iPhone, Pixel y escritorio. Cubre descubrimiento manual, ruta del
anfitrión al encuentro, cancelación sin resurrección, asistencia con modo abierto
apagado y éxito de escritura aunque falle el refresco posterior. Los E2E anteriores
basados en seed/mock permanecen fuera de esta suite como referencia de diseño.
Las pruebas unitarias del antiguo reducer usan `src/api/mock/store.tsx`, aislado
de producción; no sustituyen las pruebas contra el servidor.

MapLibre carga el mapa base CARTO por internet. La carga de imágenes necesita
S3/CloudFront configurados; el runner local genera URLs pero no emula S3. La
recuperación local imprime el enlace en consola; AWS requiere SES y salida HTTPS.
No hay recordatorios programados ni edición/cancelación de eventos en esta UI.

Contrato, migración y límites: [FRONTEND_INTEGRATION.md](../backend/docs/FRONTEND_INTEGRATION.md).
Cambios que debe aplicar el responsable de infra: [INFRA_REQUESTS.md](../backend/docs/INFRA_REQUESTS.md).
