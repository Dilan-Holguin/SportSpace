"""Generate an IEEE Conference-like Word document for the SportSpace PI1 paper."""

from __future__ import annotations

from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor
from docx.text.paragraph import Paragraph

OUT = Path(__file__).with_name("SportSpace-PI1-IEEE.docx")
NAVY = RGBColor(0x00, 0x00, 0x00)


def set_run_font(run, *, size: float, bold=False, italic=False, name="Times New Roman"):
    run.font.name = name
    run._element.rPr.rFonts.set(qn("w:eastAsia"), name)
    run.font.size = Pt(size)
    run.bold = bold
    run.italic = italic
    run.font.color.rgb = NAVY


def add_text(paragraph: Paragraph, text: str, *, size: float, bold=False, italic=False, name="Times New Roman"):
    run = paragraph.add_run(text)
    set_run_font(run, size=size, bold=bold, italic=italic, name=name)
    return run


def set_paragraph_format(
    paragraph: Paragraph,
    *,
    align=WD_ALIGN_PARAGRAPH.JUSTIFY,
    space_before=0,
    space_after=8,
    first_line=None,
    line=12,
):
    fmt = paragraph.paragraph_format
    fmt.alignment = align
    fmt.space_before = Pt(space_before)
    fmt.space_after = Pt(space_after)
    fmt.line_spacing = Pt(line)
    fmt.line_spacing_rule = WD_LINE_SPACING.EXACTLY
    if first_line is not None:
        fmt.first_line_indent = Inches(first_line)


def body(doc: Document, text: str, *, first_line=0.2):
    p = doc.add_paragraph()
    set_paragraph_format(p, first_line=first_line, space_after=6, line=12)
    add_mixed(p, text, size=10)
    return p


def add_mixed(paragraph: Paragraph, text: str, *, size: float):
    """Render **bold**, *italic* and `code` fragments."""
    i = 0
    while i < len(text):
        if text.startswith("**", i):
            end = text.find("**", i + 2)
            if end != -1:
                add_text(paragraph, text[i + 2 : end], size=size, bold=True)
                i = end + 2
                continue
        if text.startswith("`", i):
            end = text.find("`", i + 1)
            if end != -1:
                add_text(paragraph, text[i + 1 : end], size=size, italic=True)
                i = end + 1
                continue
        if text.startswith("*", i) and not text.startswith("**", i):
            end = text.find("*", i + 1)
            if end != -1:
                add_text(paragraph, text[i + 1 : end], size=size, italic=True)
                i = end + 1
                continue
        next_marks = [x for x in (text.find("**", i), text.find("*", i), text.find("`", i)) if x != -1]
        nxt = min(next_marks) if next_marks else len(text)
        add_text(paragraph, text[i:nxt], size=size)
        i = nxt


def heading_i(doc: Document, text: str):
    p = doc.add_paragraph()
    set_paragraph_format(p, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=12, space_after=6, line=12)
    add_text(p, text.upper(), size=10, bold=True)


def heading_a(doc: Document, text: str):
    p = doc.add_paragraph()
    set_paragraph_format(p, align=WD_ALIGN_PARAGRAPH.LEFT, space_before=8, space_after=4, line=12, first_line=0)
    add_text(p, text, size=10, italic=True, bold=True)


def bullet(doc: Document, text: str):
    p = doc.add_paragraph()
    set_paragraph_format(p, first_line=0, space_after=2, line=12)
    p.paragraph_format.left_indent = Inches(0.2)
    add_text(p, "•  ", size=10)
    add_mixed(p, text, size=10)


def code_block(doc: Document, text: str):
    for line in text.strip("\n").split("\n"):
        p = doc.add_paragraph()
        set_paragraph_format(p, align=WD_ALIGN_PARAGRAPH.LEFT, first_line=0, space_after=0, line=11)
        p.paragraph_format.left_indent = Inches(0.15)
        add_text(p, line if line else " ", size=8, italic=False, name="Courier New")


def set_two_columns(section):
    sect_pr = section._sectPr
    cols = OxmlElement("w:cols")
    cols.set(qn("w:num"), "2")
    cols.set(qn("w:space"), "288")  # 0.2 in
    cols.set(qn("w:equalWidth"), "1")
    sect_pr.append(cols)


def build() -> None:
    doc = Document()
    section = doc.sections[0]
    section.page_width = Inches(8.5)
    section.page_height = Inches(11)
    section.top_margin = Inches(0.75)
    section.bottom_margin = Inches(0.75)
    section.left_margin = Inches(0.62)
    section.right_margin = Inches(0.62)

    title = doc.add_paragraph()
    set_paragraph_format(title, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=10, line=26)
    add_text(
        title,
        "SportSpace: plataforma web para consulta de disponibilidad y reserva de espacios deportivos universitarios",
        size=22,
        bold=True,
    )

    authors = doc.add_paragraph()
    set_paragraph_format(authors, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=2, line=13)
    add_text(authors, "Dilan Holguín Mazo, Carlos Alberto Casas Arenas y Jesús Mateo Blandón Mesa", size=11)

    aff = doc.add_paragraph()
    set_paragraph_format(aff, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=2, line=12)
    add_text(
        aff,
        "Departamento de Ingeniería de Sistemas, Universidad de Antioquia, Medellín, Colombia",
        size=9,
        italic=True,
    )

    course = doc.add_paragraph()
    set_paragraph_format(course, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=2, line=12)
    add_text(course, "Proyecto Integrador I (2508700) — Grupo 6", size=9)

    mail = doc.add_paragraph()
    set_paragraph_format(mail, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=2, line=12)
    add_text(
        mail,
        "dilan.holguin@udea.edu.co, carlos.casas1@udea.edu.co, mateo.blandon@udea.edu.co",
        size=8,
        italic=True,
    )

    prof = doc.add_paragraph()
    set_paragraph_format(prof, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=12, line=12)
    add_text(prof, "Profesor: Ronal Davilmar Montoya Montoya (ronal.montoya@udea.edu.co)", size=9)

    body_section = doc.add_section(WD_SECTION.CONTINUOUS)
    body_section.page_width = Inches(8.5)
    body_section.page_height = Inches(11)
    body_section.top_margin = Inches(0.75)
    body_section.bottom_margin = Inches(0.75)
    body_section.left_margin = Inches(0.62)
    body_section.right_margin = Inches(0.62)
    set_two_columns(body_section)

    heading_i(doc, "Resumen")
    body(
        doc,
        "La solicitud de escenarios deportivos en la Universidad de Antioquia está fragmentada: cada espacio usa un canal distinto (Portafolio, correo o confirmación administrativa) y no existe una vista única de disponibilidad. Este artículo describe SportSpace, un prototipo web que centraliza la consulta en tiempo real y el ciclo de reserva (solicitar, aprobar o rechazar, cancelar) para espacios tipo UdeA. El anteproyecto proponía microservicios con una sola base de datos compartida; en Proyecto Integrador I se implementó un **monolito modular** NestJS + React + PostgreSQL, porque esa combinación de servicios independientes y esquema único es un anti-patrón y un equipo de tres personas no puede sostener transacciones distribuidas. La integridad de horario se garantiza en dos capas: validación de aplicación y una restricción `EXCLUDE` sobre rangos en PostgreSQL. El MVP cubre autenticación propia (`@udea.edu.co`), catálogo, disponibilidad por franjas de 60 minutos (`America/Bogota`), bandeja administrativa, dashboard de ocupación y gestión de roles. La evaluación incluye Jest (transiciones, autorización 403, servicios), una prueba de carrera de dos `POST` simultáneos y Playwright sobre los escenarios Gherkin Must. El prototipo se demuestra en ambiente local con Docker Compose.",
        first_line=0,
    )
    p = doc.add_paragraph()
    set_paragraph_format(p, first_line=0, space_after=8, line=12)
    add_text(p, "Palabras clave: ", size=9, italic=True, bold=True)
    add_text(
        p,
        "reserva de espacios, monolito modular, exclusión de solapes, NestJS, React, PostgreSQL.",
        size=9,
        italic=True,
    )

    heading_i(doc, "Abstract")
    body(
        doc,
        "Booking sports venues at Universidad de Antioquia is fragmented: each facility uses a different channel, and there is no single real-time availability view. This paper presents SportSpace, a web prototype that centralizes availability queries and the reservation lifecycle. The original proposal called for microservices sharing one database; PI1 instead implements a modular NestJS monolith because independent services on a shared schema are an anti-pattern for a three-person team. Overlaps are blocked both in the application and by a PostgreSQL `EXCLUDE` constraint. The MVP includes institutional-domain login, a catalog, 60-minute slots, an admin inbox, weekly occupancy, and role management, evaluated with Jest, a race test, and Playwright against Gherkin Must scenarios.",
        first_line=0,
    )
    p = doc.add_paragraph()
    set_paragraph_format(p, first_line=0, space_after=8, line=12)
    add_text(p, "Index Terms: ", size=9, italic=True, bold=True)
    add_text(
        p,
        "facility reservation, modular monolith, exclusion constraint, NestJS, React, PostgreSQL.",
        size=9,
        italic=True,
    )

    heading_i(doc, "I. Introducción")
    body(
        doc,
        "Los espacios deportivos de la Universidad de Antioquia se solicitan por canales heterogéneos. El estudiante no ve, en un solo lugar, si una cancha o un coliseo está libre a una hora dada; la administración confirma por fuera del sistema y dos solicitudes pueden comprometer el mismo intervalo. El objetivo general de SportSpace es **desarrollar una plataforma centralizada para consultar en tiempo real la disponibilidad y gestionar reservas** de esos escenarios, de modo que la solicitud deje de depender del medio informal de cada instalación [6].",
    )
    body(
        doc,
        "Los objetivos específicos del curso fueron: (1) analizar el proceso actual; (2) diseñar una arquitectura modular, eficiente y segura, con consistencia transaccional; (3) implementar consulta y solicitud; (4) impedir conflictos de horario en aplicación **y** en base de datos; (5) evaluar con pruebas funcionales, de conflicto y de seguridad básica.",
    )
    body(
        doc,
        "El trabajo se ejecutó en 16 semanas, con metodología en cascada y retroalimentación al cierre de cada fase, por un equipo de tres estudiantes. Este artículo reporta el problema, la decisión de no usar microservicios en PI1, la implementación del MVP y la evidencia de pruebas. El código, la API y el esquema están en inglés; la documentación y la interfaz visible al usuario, en español.",
    )

    heading_i(doc, "II. Trabajos relacionados")
    body(
        doc,
        "Sistemas universitarios de horarios e implementos, como el reportado en la UIS [1], ordenan la programación deportiva pero no necesariamente ofrecen al estudiante una consulta en tiempo real ni un ciclo de aprobación con auditoría. Prototipos de alquiler de instalaciones [2] y aplicaciones de gestión deportiva en universidades españolas [3] cubren catálogo y reserva, a menudo acoplados a un contexto de alquiler comercial o a un único campus.",
    )
    body(
        doc,
        "Trabajos recientes de reserva de sport centers con tablero de ocupación [4], [5] confirman la utilidad de un dashboard para el personal, idea que SportSpace retoma en el requisito de ocupación semanal. A diferencia de esos sistemas, el prototipo UdeA debe: restringir el registro al dominio institucional, convivir con un tenant Microsoft que el estudiante **no** puede registrar, y demostrar anti-solape determinista (incluidas dos peticiones simultáneas) en un curso de 16 semanas.",
    )
    body(
        doc,
        "Ninguna de las referencias exige microservicios para un inventario pequeño de escenarios. SportSpace adopta un monolito modular y deja la extracción de servicios como evolución si el volumen lo justifica.",
    )

    heading_i(doc, "III. Problema y requisitos")
    heading_a(doc, "A. Situación actual")
    body(
        doc,
        "La comunidad universitaria pide un escenario, espera una respuesta administrativa y no tiene una fuente única de verdad sobre franjas libres. El personal no ve ocupación agregada por semana. Un error de coordinación (dos correos aprobados para la misma hora) no lo detecta ninguna restricción de base de datos.",
    )
    heading_a(doc, "B. Actores")
    body(
        doc,
        "El visitante solo ve registro e inicio de sesión. El estudiante (`STUDENT`) consulta espacios activos, disponibilidad y sus reservas. El personal (`STAFF`) gestiona catálogo, aprueba o rechaza y ve ocupación. El administrador (`ADMIN`) además cambia roles. El sistema valida solapes, transiciones de estado y escribe auditoría.",
    )
    heading_a(doc, "C. Alcance del MVP (PI1)")
    body(
        doc,
        "Entra al producto mínimo: login propio, catálogo (incluidos alta, edición y desactivación por staff), filtros por campus y tipo, disponibilidad en franjas de 60 minutos, solicitud `PENDING`, aprobación/rechazo con motivo, cancelación de reservas futuras propias, prevención de solapes, dashboard semanal y gestión de roles desde la aplicación.",
    )
    body(
        doc,
        "Queda **fuera de PI1**: SSO Microsoft Entra ID (una prueba con cuenta estudiante en Azure devolvió 401 por `subscriptionId` vacío), integración con Portafolio o Sede Electrónica, pagos, aplicación móvil nativa, microservicios desplegados por separado, IoT de canchas, reserva de implementos, notificaciones de correo (HU-18) y restablecimiento de contraseña (HU-17). Esas dos últimas historias se clasificaron como Could: en el prototipo el admin recrea cuentas de prueba y el estado se consulta en la app.",
    )
    heading_a(doc, "D. Requisitos de integridad y seguridad")
    body(
        doc,
        "Una franja está ocupada si existe una reserva `PENDING` o `APPROVED` que se solape; `REJECTED` y `CANCELLED` no ocupan. El horario usa zona `America/Bogota`. Solo se registran correos `@udea.edu.co`. Las contraseñas se almacenan con Argon2id. Toda operación de negocio, salvo registro y login, exige JWT y verificación de rol. Un estudiante recibe 403 si intenta crear espacios o aprobar reservas. La máquina de estados de una reserva es:",
    )
    code_block(
        doc,
        "PENDING   → APPROVED | REJECTED | CANCELLED\n"
        "APPROVED  → CANCELLED\n"
        "REJECTED  → (terminal)\n"
        "CANCELLED → (terminal)",
    )
    body(doc, "Cualquier otra transición responde 409.")

    heading_i(doc, "IV. Arquitectura: por qué no microservicios en PI1")
    body(
        doc,
        "El anteproyecto planteaba tres microservicios (disponibilidad, reservas, usuarios) sobre **una sola base de datos compartida**. Esa combinación no es una arquitectura de microservicios: los procesos quedan acoplados al mismo esquema, las transacciones de “reservar si está libre” se vuelven distribuidas (o se abandonan) y un equipo de tres personas gasta el semestre en red, contratos y fallos parciales en lugar del producto.",
    )
    body(
        doc,
        "**Decisión:** un monolito modular. Los tres dominios se conservan como módulos NestJS en un solo proceso, con un PostgreSQL y transacciones ACID reales. Si más adelante el volumen lo exige, los límites de módulo ya coinciden con futuros servicios.",
    )
    body(doc, "Ganancias en PI1:", first_line=0)
    bullet(doc, "Una petición HTTP, un proceso, una transacción al crear o decidir una reserva.")
    bullet(doc, "Operación simple: Docker Compose levanta Postgres, API y front.")
    bullet(doc, "Una superficie de autenticación, CORS, Helmet y auditoría.")
    bullet(doc, "Menor latencia que un encadenamiento de servicios para un inventario de pocos escenarios.")

    heading_a(doc, "A. Vista lógica")
    body(
        doc,
        "El navegador ejecuta una SPA (React 18 + TypeScript + Vite). Consume una API REST JSON con JWT de acceso (≈15 min) y refresh en cookie HttpOnly. La API NestJS 10 agrupa `users`/`auth`, `spaces`/`availability` y `reservations`/`occupancy`. Prisma 6 habla con PostgreSQL 16. El front no replica reglas de negocio: si el servidor responde 403 o 409, la UI muestra un mensaje en español.",
    )
    heading_a(doc, "B. Persistencia y anti-solape")
    body(
        doc,
        "El núcleo del modelo es `User`, `Space`, `AvailabilityRule` (horario semanal o bloqueo), `Reservation` e `AuditLog`. La columna `span` (`tstzrange`) de cada reserva la mantiene un trigger; la defensa final es:",
    )
    code_block(
        doc,
        'EXCLUDE USING gist (\n'
        '  "spaceId" WITH =,\n'
        '  "span" WITH &&\n'
        ") WHERE (status IN ('PENDING', 'APPROVED'));",
    )
    body(
        doc,
        "La aplicación valida primero (mensaje claro al usuario). La base de datos rechaza la segunda inserción concurrente (código PostgreSQL `23P01`), que la API traduce a HTTP 409. Así se cumple el objetivo 4 incluso bajo condición de carrera.",
    )
    heading_a(doc, "C. Autenticación propia")
    body(
        doc,
        "La UdeA autentica servicios institucionales con Microsoft Entra ID. Registrar una aplicación en ese tenant requiere Gestión Informática. SportSpace usa login propio: registro limitado a `@udea.edu.co`, JWT firmado con secretos de entorno, roles en la tabla `User`. El SSO queda como evolución. Un `ADMIN` de desarrollo se crea por semilla; el resto de promociones ocurre en la pantalla de roles (no se degrada al último administrador).",
    )

    heading_i(doc, "V. Implementación")
    heading_a(doc, "A. Organización del repositorio y del equipo")
    body(
        doc,
        "Monorepo npm: `apps/api` (NestJS) y `apps/web` (Vite). Convención Git: no se programa en `main`; cada historia entra por `feat/…` o `fix/…` y un pull request. Dilan posee espacios, disponibilidad y reservas; Carlos, autenticación, usuarios y Docker; Mateo, el front y las pruebas E2E, y confirma el merge. Los identificadores de código y de API están en inglés (`spaceId`, `PENDING`, `/api/reservations`); las etiquetas de pantalla, en español.",
    )
    heading_a(doc, "B. API")
    body(doc, "Contratos relevantes del MVP:", first_line=0)
    for item in [
        "`POST /api/auth/register` y `POST /api/auth/login` — dominio institucional, rate limit en login.",
        "`GET /api/spaces` — el estudiante ve solo activos; staff/admin también inactivos.",
        "`POST` / `PATCH /api/spaces` — staff/admin; un espacio inactivo no admite reservas nuevas.",
        "`GET /api/spaces/:id/availability?date=YYYY-MM-DD` — franjas `FREE`, `BUSY`, `BLOCKED`, `PAST`.",
        "`PUT` de horario semanal y `POST`/`DELETE` de bloqueos (HU-10).",
        "`POST /api/reservations` — crea `PENDING`; 409 si hay solape.",
        "`POST /api/reservations/:id/approve|reject|cancel` — transiciones HU-16; 403 si el rol no alcanza o si se cancela la reserva de otro.",
        "`GET /api/occupancy?weekStart=YYYY-MM-DD` — horas hábiles, ocupadas, bloqueadas y porcentaje.",
        "`GET` / `PATCH /api/users` — solo `ADMIN`.",
    ]:
        bullet(doc, item)
    body(doc, "La colección Postman (`docs/postman/`) replica esos contratos para QA manual.")

    heading_a(doc, "C. Cliente web")
    body(
        doc,
        "Rutas protegidas: el visitante no ve el catálogo. El estudiante navega Espacios, disponibilidad y Mis reservas. Staff/admin ve Administración (solicitudes, espacios, ocupación, horarios; roles solo `ADMIN`). El front oculta acciones no autorizadas y el backend las rechaza igual. Las fotos del catálogo usan `Space.imageUrl` o un respaldo por tipo de escenario.",
    )
    heading_a(doc, "D. Seguridad aplicada en PI1")
    body(
        doc,
        "Helmet, CORS al origen del front, validación de DTO con `class-validator`, rate limiting en login y en creación de reservas, cookies de refresh `HttpOnly` y `SameSite`. Secretos en variables de entorno (`.env` ignorado; `.env.example` documenta claves de desarrollo). HTTPS y secretos distintos de `change-me-*` quedan como endurecimiento de despliegue, no como requisito para la demo local.",
    )
    heading_a(doc, "E. Entorno reproducible")
    body(
        doc,
        "`docker compose up` levanta PostgreSQL, aplica migraciones Prisma, ejecuta el seed (admin `admin@udea.edu.co` y escenarios de demostración) y sirve API (`:3000`) y web (`:5173`). Para desarrollo con recarga se deja solo Postgres en Docker y se corre Nest/Vite en el host.",
    )

    heading_i(doc, "VI. Evaluación y pruebas")
    body(
        doc,
        "La especificación de aceptación está en Gherkin (`docs/gherkin/`, idioma español, etiquetas por HU). No se reescribieron criterios en paralelo: las pruebas automáticas implementan esa especificación.",
    )
    heading_a(doc, "A. Pruebas unitarias (Jest)")
    body(
        doc,
        "Los servicios de API cubren solape detectado en aplicación, transiciones legales e ilegales (409), estudiante que no aprueba ni rechaza (403), cancelación de reserva ajena (403) y el `RolesGuard` (staff/admin frente a estudiante, y rutas solo-admin). El catálogo de pruebas unitarias de `apps/api` reporta 67 casos en verde. Hay además pruebas de sesión en el front. Commits de cobertura para Sonar reportaron en torno al 82 % en servicios de API.",
    )
    heading_a(doc, "B. Condición de carrera")
    body(
        doc,
        "`npm run test:int` arranca Nest contra PostgreSQL, dispara dos `POST /api/reservations` simultáneos sobre la misma franja y exige el conjunto de estados HTTP {201, 409} con **una sola** reserva activa (`PENDING`). Un caso secuencial cubre el 409 inmediato. Eso evidencia RNF-05: la restricción `EXCLUDE` no es solo documentación.",
    )
    heading_a(doc, "C. Pruebas E2E (Playwright)")
    body(
        doc,
        "`npm run test:e2e` recorre el Must de UI contra la API local: registro/login, rechazo de Gmail, catálogo y filtros, detalle, crear/desactivar espacio (HU-07), solicitar, conflicto (`Ocupada`), bandeja, cancelar, ocupación, promoción a staff y horario/bloqueo (HU-10). Catorce escenarios pasaron en serie (`workers: 1`) para respetar el rate limit de login. No se automatizaron el 429 de fuerza bruta ni el catálogo vacío.",
    )
    heading_a(doc, "D. Criterios de salida del MVP")
    body(
        doc,
        "En sustentación se demuestra: login institucional de prototipo, consulta de franjas, solicitud visible en “mis reservas”, aprobación o rechazo, rechazo determinista del conflicto, 403 de estudiante ante administración, dashboard semanal y cambio de rol sin tocar la BD.",
    )
    body(
        doc,
        "Limitaciones honestas de PI1: no hay workflow de CI en el repositorio (las pruebas se ejecutan en local); el endurecimiento de secretos para un hosting público y un recorrido visual formal a ≥ 1024 px quedaron como pulido; HU-17 y HU-18 no se implementan.",
    )

    heading_i(doc, "VII. Conclusiones")
    body(
        doc,
        "SportSpace demuestra que un monolito modular es la arquitectura adecuada para un MVP universitario de reservas: conserva los límites de dominio del anteproyecto, permite transacciones ACID y cabe en un equipo de tres personas. El conflicto de horario no se delega solo al código: PostgreSQL es la última línea de defensa, verificada con una prueba de carrera. El login propio desbloqueó el semestre sin depender de Gestión Informática, a costa de no ofrecer 2FA institucional ni recuperación de contraseña.",
    )
    body(
        doc,
        "Trabajo futuro (PI2 o evolución): SSO Entra ID cuando Informática registre la aplicación, notificaciones de correo (HU-18), restablecimiento de clave (HU-17), integración con Portafolio, CI en cada PR y, solo si el volumen lo exige, extraer módulos a procesos independientes **con bases de datos por servicio**, no con el esquema compartido que el anteproyecto sugería.",
    )

    heading_i(doc, "Agradecimientos")
    body(
        doc,
        "Al profesor Ronal Davilmar Montoya Montoya y al curso Proyecto Integrador I (2508700) de la Universidad de Antioquia.",
    )

    heading_i(doc, "Referencias")
    refs = [
        "[1] Picón Acosta, sistema de horarios e implementos deportivos, Universidad Industrial de Santander, 2011.",
        "[2] Aglio Sánchez, prototipo web de alquiler de instalaciones, Universidad de Jaén, 2016.",
        "[3] Aplicación web de gestión de instalaciones deportivas, Universidad Politécnica de Madrid.",
        "[4] Daza et al., “Courtyard Reserva,” IJRSI, 2026.",
        "[5] Sa'adah et al., sistema de reserva de sport center con dashboard, 2025.",
        "[6] Universidad de Antioquia, “Espacios deportivos.” [En línea]. Disponible: https://www.udea.edu.co/",
    ]
    for ref in refs:
        p = doc.add_paragraph()
        set_paragraph_format(p, first_line=-0.25, space_after=4, line=11)
        p.paragraph_format.left_indent = Inches(0.25)
        add_text(p, ref, size=9)

    footer = body_section.footer
    footer.is_linked_to_previous = False
    fp = footer.paragraphs[0]
    fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    add_text(fp, "SportSpace — Proyecto Integrador I, Universidad de Antioquia", size=8, italic=True)

    doc.save(OUT)
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    build()
