# Friends Nearby / ¿Jalas? — frontend integrado

React, TypeScript y Vite, conectado al backend Go real. No hay login simulado ni
datos de ejemplo en los flujos. `src/api/mock/` se conserva como referencia del
diseño y no se importa en la aplicación.

## Desarrollo local

Primera terminal, desde `backend/`:

```powershell
docker compose up -d
go run ./cmd/local
```

Segunda terminal, desde `frontend/`:

```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```

Abre http://localhost:5173 y crea una cuenta. Usa dos cuentas en perfiles de
navegador independientes para probar amistad y matches. La ubicación necesita
HTTPS o localhost. Elegir zona manual permite explorar y publicar, pero no envía
una posición en vivo ni permite validar encuentros.

## AWS

Variables de **build** (Vite las incorpora al bundle):

```dotenv
VITE_API_URL=https://<http-api>.execute-api.<region>.amazonaws.com
VITE_WS_URL=wss://<websocket-api>.execute-api.<region>.amazonaws.com/<stage>
```

Usar los outputs Terraform `http_api_url` y `websocket_url`. No usar el endpoint
interno `WS_MANAGEMENT_URL` ni exponer JWT_SECRET o credenciales en `VITE_*`.
El hosting debe resolver rutas SPA como `/evento/<id>` a `index.html`.

## Contrato y estado

- `api/client.ts`: HTTP autenticado y validación Zod de respuestas.
- `GET /app/state`: proyección de las pantallas, filtrada por el servidor.
- `POST /app/actions`: acciones sociales persistentes y autorizadas.
- Auth, amistad, perfil y fotos usan también los endpoints REST anteriores.
- WebSocket con reconexión; refresco cada 10 s como recuperación de avisos perdidos.
- JWT en `sessionStorage`; preferencias y datos sociales en DynamoDB.
- `me` es un alias visual; el backend identifica siempre al usuario por su JWT.

La ubicación exacta se envía al servidor autenticado solo con permiso y pestaña
visible. No se guarda en storage del navegador. Los amigos reciben zonas de
500 m con centros redondeados a 0.002°. El punto exacto se entrega únicamente
a participantes de un match vigente, con amistad, sin bloqueos ni ghost mode.

El registro solicita username único. Las solicitudes, planes, eventos,
asistencias, mensajes rápidos, confirmaciones, progreso, bloqueos, reportes,
modo abierto, roomies y borradores se guardan en el servidor. El backend calcula
XP y evita recompensas duplicadas. El organizador aprueba solicitudes de eventos.
Los planes para roomies se comparten con amigos que el autor marca desde su perfil.
Planes abiertos siguen limitados a amigos con consentimiento y preferencia de
planes chicos; los eventos abiertos permiten descubrir gente nueva sin compartir
ubicaciones de participantes.

No hay geocodificación automática: los eventos se colocan en la zona seleccionada
del organizador; el nombre del lugar describe el punto de encuentro. No hay
recordatorios por correo ni chat completo.

## Pruebas

```powershell
npm run build
npm test
npx playwright install chromium
# Con Docker y el backend local ejecutándose:
npx playwright test --workers=1
```

Las E2E crean cuentas reales en DynamoDB Local y verifican registro, errores,
persistencia, QR, amistad, mensajes y encuentros entre dos cuentas, eventos y
diseños móvil/escritorio. Capturas y trazas quedan en `test-results/`.

Recuperación local: abrir `reset_url` en `backend/.local/mail/*.json`. Fotos:
requieren S3/CloudFront reales; los valores locales no emulan media.
Ver [contrato](../backend/docs/FRONTEND_INTEGRATION.md) y
[pendientes AWS](../backend/docs/INFRA_REQUESTS.md).
