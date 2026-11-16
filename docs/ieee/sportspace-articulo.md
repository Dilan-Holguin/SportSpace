# SportSpace: plataforma web para consulta de disponibilidad y reserva de espacios deportivos universitarios

Dilan Holguín Mazo, Carlos Alberto Casas Arenas y Jesús Mateo Blandón Mesa  
Departamento de Ingeniería de Sistemas, Universidad de Antioquia, Medellín, Colombia  
Proyecto Integrador I (2508700) — Grupo 6  
Correos: dilan.holguin@udea.edu.co, carlos.casas1@udea.edu.co, mateo.blandon@udea.edu.co  
Profesor: Ronal Davilmar Montoya Montoya (ronal.montoya@udea.edu.co)

---

## Resumen

La solicitud de escenarios deportivos en la Universidad de Antioquia está fragmentada: cada espacio usa un canal distinto (Portafolio, correo o confirmación administrativa) y no existe una vista única de disponibilidad. Este artículo describe SportSpace, un prototipo web que centraliza la consulta en tiempo real y el ciclo de reserva (solicitar, aprobar o rechazar, cancelar) para espacios tipo UdeA. El anteproyecto proponía microservicios con una sola base de datos compartida; en Proyecto Integrador I se implementó un **monolito modular** NestJS + React + PostgreSQL, porque esa combinación de servicios independientes y esquema único es un anti-patrón y un equipo de tres personas no puede sostener transacciones distribuidas. La integridad de horario se garantiza en dos capas: validación de aplicación y una restricción `EXCLUDE` sobre rangos en PostgreSQL. El MVP cubre autenticación propia (`@udea.edu.co`), catálogo, disponibilidad por franjas de 60 minutos (`America/Bogota`), bandeja administrativa, dashboard de ocupación y gestión de roles. La evaluación incluye Jest (transiciones, autorización 403, servicios), una prueba de carrera de dos `POST` simultáneos y Playwright sobre los escenarios Gherkin Must. El prototipo se demuestra en ambiente local con Docker Compose.

**Palabras clave:** reserva de espacios, monolito modular, exclusión de solapes, NestJS, React, PostgreSQL.

## Abstract

Booking sports venues at Universidad de Antioquia is fragmented: each facility uses a different channel, and there is no single real-time availability view. This paper presents SportSpace, a web prototype that centralizes availability queries and the reservation lifecycle. The original proposal called for microservices sharing one database; PI1 instead implements a modular NestJS monolith because independent services on a shared schema are an anti-pattern for a three-person team. Overlaps are blocked both in the application and by a PostgreSQL `EXCLUDE` constraint. The MVP includes institutional-domain login, a catalog, 60-minute slots, an admin inbox, weekly occupancy, and role management, evaluated with Jest, a race test, and Playwright against Gherkin Must scenarios.

**Index Terms:** facility reservation, modular monolith, exclusion constraint, NestJS, React, PostgreSQL.

---

## I. Introducción

Los espacios deportivos de la Universidad de Antioquia se solicitan por canales heterogéneos. El estudiante no ve, en un solo lugar, si una cancha o un coliseo está libre a una hora dada; la administración confirma por fuera del sistema y dos solicitudes pueden comprometer el mismo intervalo. El objetivo general de SportSpace es **desarrollar una plataforma centralizada para consultar en tiempo real la disponibilidad y gestionar reservas** de esos escenarios, de modo que la solicitud deje de depender del medio informal de cada instalación [6].

Los objetivos específicos del curso fueron: (1) analizar el proceso actual; (2) diseñar una arquitectura modular, eficiente y segura, con consistencia transaccional; (3) implementar consulta y solicitud; (4) impedir conflictos de horario en aplicación **y** en base de datos; (5) evaluar con pruebas funcionales, de conflicto y de seguridad básica.

El trabajo se ejecutó en 16 semanas, con metodología en cascada y retroalimentación al cierre de cada fase, por un equipo de tres estudiantes. Este artículo reporta el problema, la decisión de no usar microservicios en PI1, la implementación del MVP y la evidencia de pruebas. El código, la API y el esquema están en inglés; la documentación y la interfaz visible al usuario, en español.

## II. Trabajos relacionados

Sistemas universitarios de horarios e implementos, como el reportado en la UIS [1], ordenan la programación deportiva pero no necesariamente ofrecen al estudiante una consulta en tiempo real ni un ciclo de aprobación con auditoría. Prototipos de alquiler de instalaciones [2] y aplicaciones de gestión deportiva en universidades españolas [3] cubren catálogo y reserva, a menudo acoplados a un contexto de alquiler comercial o a un único campus.

Trabajos recientes de reserva de *sport centers* con tablero de ocupación [4], [5] confirman la utilidad de un dashboard para el personal, idea que SportSpace retoma en el requisito de ocupación semanal. A diferencia de esos sistemas, el prototipo UdeA debe: restringir el registro al dominio institucional, convivir con un tenant Microsoft que el estudiante **no** puede registrar, y demostrar anti-solape determinista (incluidas dos peticiones simultáneas) en un curso de 16 semanas.

Ninguna de las referencias exige microservicios para un inventario pequeño de escenarios. SportSpace adopta un monolito modular y deja la extracción de servicios como evolución si el volumen lo justifica.

## III. Problema y requisitos

### A. Situación actual

La comunidad universitaria pide un escenario, espera una respuesta administrativa y no tiene una fuente única de verdad sobre franjas libres. El personal no ve ocupación agregada por semana. Un error de coordinación (dos correos aprobados para la misma hora) no lo detecta ninguna restricción de base de datos.

### B. Actores

El visitante solo ve registro e inicio de sesión. El estudiante (`STUDENT`) consulta espacios activos, disponibilidad y sus reservas. El personal (`STAFF`) gestiona catálogo, aprueba o rechaza y ve ocupación. El administrador (`ADMIN`) además cambia roles. El sistema valida solapes, transiciones de estado y escribe auditoría.

### C. Alcance del MVP (PI1)

Entra al producto mínimo: login propio, catálogo (incluidos alta, edición y desactivación por staff), filtros por campus y tipo, disponibilidad en franjas de 60 minutos, solicitud `PENDING`, aprobación/rechazo con motivo, cancelación de reservas futuras propias, prevención de solapes, dashboard semanal y gestión de roles desde la aplicación.

Queda **fuera de PI1**: SSO Microsoft Entra ID (una prueba con cuenta estudiante en Azure devolvió 401 por `subscriptionId` vacío), integración con Portafolio o Sede Electrónica, pagos, aplicación móvil nativa, microservicios desplegados por separado, IoT de canchas, reserva de implementos, notificaciones de correo (HU-18) y restablecimiento de contraseña (HU-17). Esas dos últimas historias se clasificaron como Could: en el prototipo el admin recrea cuentas de prueba y el estado se consulta en la app.

### D. Requisitos de integridad y seguridad

Una franja está ocupada si existe una reserva `PENDING` o `APPROVED` que se solape; `REJECTED` y `CANCELLED` no ocupan. El horario usa zona `America/Bogota`. Solo se registran correos `@udea.edu.co`. Las contraseñas se almacenan con Argon2id. Toda operación de negocio, salvo registro y login, exige JWT y verificación de rol. Un estudiante recibe 403 si intenta crear espacios o aprobar reservas. La máquina de estados de una reserva es:

```
PENDING  → APPROVED | REJECTED | CANCELLED
APPROVED → CANCELLED
REJECTED → (terminal)
CANCELLED → (terminal)
```

Cualquier otra transición responde 409.

## IV. Arquitectura: por qué no microservicios en PI1

El anteproyecto planteaba tres microservicios (disponibilidad, reservas, usuarios) sobre **una sola base de datos compartida**. Esa combinación no es una arquitectura de microservicios: los procesos quedan acoplados al mismo esquema, las transacciones de “reservar si está libre” se vuelven distribuidas (o se abandonan) y un equipo de tres personas gasta el semestre en red, contratos y fallos parciales en lugar del producto [objetivo 2].

**Decisión:** un monolito modular. Los tres dominios se conservan como módulos NestJS en un solo proceso, con un PostgreSQL y transacciones ACID reales. Si más adelante el volumen lo exige, los límites de módulo ya coinciden con futuros servicios.

Ganancias en PI1:

- Una petición HTTP, un proceso, una transacción al crear o decidir una reserva.
- Operación simple: Docker Compose levanta Postgres, API y front.
- Una superficie de autenticación, CORS, Helmet y auditoría.
- Menor latencia que un encadenamiento de servicios para un inventario de pocos escenarios.

### A. Vista lógica

El navegador ejecuta una SPA (React 18 + TypeScript + Vite). Consume una API REST JSON con JWT de acceso (≈15 min) y refresh en cookie HttpOnly. La API NestJS 10 agrupa `users`/`auth`, `spaces`/`availability` y `reservations`/`occupancy`. Prisma 6 habla con PostgreSQL 16. El front no replica reglas de negocio: si el servidor responde 403 o 409, la UI muestra un mensaje en español.

### B. Persistencia y anti-solape

El núcleo del modelo es `User`, `Space`, `AvailabilityRule` (horario semanal o bloqueo), `Reservation` e `AuditLog`. La columna `span` (`tstzrange`) de cada reserva la mantiene un trigger; la defensa final es:

```sql
EXCLUDE USING gist (
  "spaceId" WITH =,
  "span" WITH &&
) WHERE (status IN ('PENDING', 'APPROVED'));
```

La aplicación valida primero (mensaje claro al usuario). La base de datos rechaza la segunda inserción concurrente (código PostgreSQL `23P01`), que la API traduce a HTTP 409. Así se cumple el objetivo 4 incluso bajo condición de carrera.

### C. Autenticación propia

La UdeA autentica servicios institucionales con Microsoft Entra ID. Registrar una aplicación en ese tenant requiere Gestión Informática. SportSpace usa login propio: registro limitado a `@udea.edu.co`, JWT firmado con secretos de entorno, roles en la tabla `User`. El SSO queda como evolución. Un `ADMIN` de desarrollo se crea por semilla; el resto de promociones ocurre en la pantalla de roles (no se degrada al último administrador).

## V. Implementación

### A. Organización del repositorio y del equipo

Monorepo npm: `apps/api` (NestJS) y `apps/web` (Vite). Convención Git: no se programa en `main`; cada historia entra por `feat/…` o `fix/…` y un *pull request*. Dilan posee espacios, disponibilidad y reservas; Carlos, autenticación, usuarios y Docker; Mateo, el front y las pruebas E2E, y confirma el merge. Los identificadores de código y de API están en inglés (`spaceId`, `PENDING`, `/api/reservations`); las etiquetas de pantalla, en español.

### B. API

Contratos relevantes del MVP:

- `POST /api/auth/register` y `POST /api/auth/login` — dominio institucional, rate limit en login.
- `GET /api/spaces` — el estudiante ve solo activos; staff/admin también inactivos.
- `POST` / `PATCH /api/spaces` — staff/admin; un espacio inactivo no admite reservas nuevas.
- `GET /api/spaces/:id/availability?date=YYYY-MM-DD` — franjas `FREE`, `BUSY`, `BLOCKED`, `PAST`.
- `PUT` de horario semanal y `POST`/`DELETE` de bloqueos (HU-10).
- `POST /api/reservations` — crea `PENDING`; 409 si hay solape.
- `POST /api/reservations/:id/approve|reject|cancel` — transiciones HU-16; 403 si el rol no alcanza o si se cancela la reserva de otro.
- `GET /api/occupancy?weekStart=YYYY-MM-DD` — horas hábiles, ocupadas, bloqueadas y porcentaje.
- `GET` / `PATCH /api/users` — solo `ADMIN`.

La colección Postman (`docs/postman/`) replica esos contratos para QA manual.

### C. Cliente web

Rutas protegidas: el visitante no ve el catálogo. El estudiante navega Espacios, disponibilidad y Mis reservas. Staff/admin ve Administración (solicitudes, espacios, ocupación, horarios; roles solo `ADMIN`). El front oculta acciones no autorizadas y el backend las rechaza igual. Las fotos del catálogo usan `Space.imageUrl` o un respaldo por tipo de escenario.

### D. Seguridad aplicada en PI1

Helmet, CORS al origen del front, validación de DTO con `class-validator`, rate limiting en login y en creación de reservas, cookies de refresh `HttpOnly` y `SameSite`. Secretos en variables de entorno (`.env` ignorado; `.env.example` documenta claves de desarrollo). HTTPS y secretos distintos de `change-me-*` quedan como endurecimiento de despliegue, no como requisito para la demo local.

### E. Entorno reproducible

`docker compose up` levanta PostgreSQL, aplica migraciones Prisma, ejecuta el seed (admin `admin@udea.edu.co` y escenarios de demostración) y sirve API (`:3000`) y web (`:5173`). Para desarrollo con recarga se deja solo Postgres en Docker y se corre Nest/Vite en el host.

## VI. Evaluación y pruebas

La especificación de aceptación está en Gherkin (`docs/gherkin/`, idioma español, etiquetas por HU). No se reescribieron criterios en paralelo: las pruebas automáticas implementan esa especificación.

### A. Pruebas unitarias (Jest)

Los servicios de API cubren solape detectado en aplicación, transiciones legales e ilegales (409), estudiante que no aprueba ni rechaza (403), cancelación de reserva ajena (403) y el `RolesGuard` (staff/admin frente a estudiante, y rutas solo-admin). El catálogo de pruebas unitarias de `apps/api` reporta 67 casos en verde. Hay además pruebas de sesión en el front. Commits de cobertura para Sonar reportaron en torno al 82 % en servicios de API.

### B. Condición de carrera

`npm run test:int` arranca Nest contra PostgreSQL, dispara dos `POST /api/reservations` simultáneos sobre la misma franja y exige el conjunto de estados HTTP `{201, 409}` con **una sola** reserva activa (`PENDING`). Un caso secuencial cubre el 409 inmediato. Eso evidencia RNF-05: la restricción `EXCLUDE` no es solo documentación.

### C. Pruebas E2E (Playwright)

`npm run test:e2e` recorre el Must de UI contra la API local: registro/login, rechazo de Gmail, catálogo y filtros, detalle, crear/desactivar espacio (HU-07), solicitar, conflicto (`Ocupada`), bandeja, cancelar, ocupación, promoción a staff y horario/bloqueo (HU-10). Catorce escenarios pasaron en serie (`workers: 1`) para respetar el rate limit de login. No se automatizaron el 429 de fuerza bruta ni el catálogo vacío.

### D. Criterios de salida del MVP

En sustentación se demuestra: login institucional de prototipo, consulta de franjas, solicitud visible en “mis reservas”, aprobación o rechazo, rechazo determinista del conflicto, 403 de estudiante ante administración, dashboard semanal y cambio de rol sin tocar la BD.

Limitaciones honestas de PI1: no hay *workflow* de CI en el repositorio (las pruebas se ejecutan en local); el endurecimiento de secretos para un hosting público y un recorrido visual formal a ≥ 1024 px quedaron como pulido; HU-17 y HU-18 no se implementan.

## VII. Conclusiones

SportSpace demuestra que un monolito modular es la arquitectura adecuada para un MVP universitario de reservas: conserva los límites de dominio del anteproyecto, permite transacciones ACID y cabe en un equipo de tres personas. El conflicto de horario no se delega solo al código: PostgreSQL es la última línea de defensa, verificada con una prueba de carrera. El login propio desbloqueó el semestre sin depender de Gestión Informática, a costa de no ofrecer 2FA institucional ni recuperación de contraseña.

Trabajo futuro (PI2 o evolución): SSO Entra ID cuando Informática registre la aplicación, notificaciones de correo (HU-18), restablecimiento de clave (HU-17), integración con Portafolio, CI en cada PR y, solo si el volumen lo exige, extraer módulos a procesos independientes **con bases de datos por servicio**, no con el esquema compartido que el anteproyecto sugería.

## Agradecimientos

Al profesor Ronal Davilmar Montoya Montoya y al curso Proyecto Integrador I (2508700) de la Universidad de Antioquia.

## Referencias

[1] Picón Acosta, sistema de horarios e implementos deportivos, Universidad Industrial de Santander, 2011.

[2] Aglio Sánchez, prototipo web de alquiler de instalaciones, Universidad de Jaén, 2016.

[3] Aplicación web de gestión de instalaciones deportivas, Universidad Politécnica de Madrid.

[4] Daza *et al.*, “Courtyard Reserva,” *IJRSI*, 2026.

[5] Sa'adah *et al.*, sistema de reserva de *sport center* con dashboard, 2025.

[6] Universidad de Antioquia, “Espacios deportivos.” [En línea]. Disponible: https://www.udea.edu.co/
