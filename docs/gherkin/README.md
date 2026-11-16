# Escenarios Gherkin — SportSpace

Pruebas de aceptación del MVP. Idioma: español (`# language: es`).

Fuente de verdad de negocio: [../requisitos.md](../requisitos.md). El recorrido Must de UI se automatiza con Playwright (`npm run test:e2e`, specs en `apps/web/e2e/`, API en `localhost:3000`). Los escenarios siguen siendo checklist de sustentación.

No se cubren el rate limit 429, el catálogo vacío ni toda la matriz de transiciones.

| Archivo | HU | Prioridad |
| --- | --- | --- |
| [autenticacion.feature](autenticacion.feature) | HU-01 a HU-04 | Must |
| [espacios.feature](espacios.feature) | HU-05 a HU-07, HU-08 | Must / Should (`@should` en HU-08) |
| [disponibilidad.feature](disponibilidad.feature) | HU-09, HU-10 | Must |
| [reservas.feature](reservas.feature) | HU-11 a HU-16 | Must |
| [administracion.feature](administracion.feature) | HU-19, HU-20 | Must |

HU-17 y HU-18 (Could) no tienen escenarios en PI1.
