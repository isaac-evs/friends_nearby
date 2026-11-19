# Infraestructura pendiente para integrar ¿Jalas?

No se modificó `infra/`. `origin/main` ya incluye runtime Go, bootstrap y
JWT_SECRET. Esta lista corresponde a la ampliación del backend para el frontend.

## Tabla DynamoDB social

Crear una tabla con partition key `pk` (String), sort key `sk` (String),
PAY_PER_REQUEST, sin GSI. Pasar el nombre a Lambda API como `SOCIAL_TABLE`.
Si se omite, el código usa `${USERS_TABLE}-social`; en AWS **no crea la tabla**.
El runner local sí la crea.

Dar al rol API GetItem, PutItem, UpdateItem, DeleteItem y Query sobre su ARN.
Hay transacciones entre la tabla social y users; se autorizan por las operaciones
de los items. No se necesita Scan ni acceso del worker a la tabla social.

Guarda perfiles/preferencias/progreso, plan actual, eventos/asistencias,
matches/referencias, reportes y tokens de recuperación. El atributo numérico
`version` permite escrituras condicionales. Las expiraciones se verifican en
código; no requieren TTL para proteger la vigencia. No configurar TTL sobre
campos anidados. Falta una política futura de retención/limpieza de datos antiguos.

## Recuperación de contraseña por SES

Variables nuevas en Lambda API:

```text
MAIL_FROM=cuentas@<dominio-verificado>
FRONTEND_URL=https://<dominio-del-frontend>
```

- Verificar identidad SES en la región de Lambda.
- Otorgar `ses:SendEmail`, limitado al ARN de esa identidad.
- Habilitar envío a destinatarios no verificados cuando corresponda; considerar
  las restricciones del sandbox de SES al probar.
- El adaptador usa SES **HTTPS Query API**, SigV4, contra
  `https://email.<region>.amazonaws.com/`. La VPC actual sin NAT necesita salida
  HTTPS hacia ese endpoint, por ejemplo NAT y su ruta. Un endpoint SMTP no sirve
  para este adaptador HTTP. El worker actual sigue dedicado al historial.
- Aplicar throttling a auth y recuperación. Hay espera de 3 minutos por correo
  en el código, pero no sustituye límites de tráfico por origen.

Los enlaces caducan en 30 minutos y se consumen una vez. El reset incrementa
`session_version` en users y revoca JWT/conexiones anteriores. Este nuevo atributo
no requiere migración de schema; las cuentas existentes usan versión 0.

## Hosting y configuración web

- Publicar `frontend/dist/` con HTTPS y fallback SPA a index.html para las rutas
  de eventos, matches, perfiles y recuperación.
- Build con VITE_API_URL/VITE_WS_URL a partir de http_api_url/websocket_url.
  Ningún secreto debe ir en VITE_*.
- CORS HTTP y S3 media deben admitir los orígenes publicados; S3, PUT con
  Content-Type. CloudFront debe servir photos/<user_id>/<archivo> desde la raíz.
- Reconstruir las Lambdas con los scripts existentes antes del despliegue.

Conservar provided.al2023, bootstrap, x86_64, JWT_SECRET estable, REDIS_HOST sin
puerto y TLS compatible, WS_MANAGEMENT_URL con HTTPS/stage y $connect sin
authorizer externo. Las rutas WS actuales bastan: nearby y ping van por $default.
No hacen falta Cognito ni índices de email/username.

No se ejecutó Terraform ni se validó AWS. SES, S3/CloudFront, API Gateway y sus
permisos requieren comprobación en ese entorno después de aplicar estos cambios.
