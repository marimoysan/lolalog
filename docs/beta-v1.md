# Beta v1 — historia de usuario

## Objetivo

Primera versión usable end-to-end: entrar con PIN, registrar el día de hoy,
revisar/editar el historial (incluyendo días atrasados). El Dashboard es un
placeholder — las gráficas reales se hacen en Python sobre el SQLite, según
quedó decidido en [CLAUDE.md](../CLAUDE.md).

## Fuera de alcance para esta beta

- Gráficas/análisis real en la app (Dashboard = placeholder)
- Sync entre dispositivos (fase 2, ver [lib/sync](../lib/sync))
- Esquema definitivo de `daily_log` más allá de dolor (food/sport/ciclo/sexo
  quedan como placeholder hasta que definas los campos)
- Seguridad real del PIN (cifrado, rate limiting) — es un candado de UI, no
  protege el SQLite en sí (que ya vive local en el dispositivo)

## Pantallas

### 1. PIN gate

Como usuaria, quiero proteger el acceso con un PIN sencillo para que nadie
que coja mi móvil vea los datos de un vistazo.

- Al abrir la app se pide un PIN antes de mostrar nada.
- PIN correcto → pasa a Home (tab Log). PIN incorrecto → error, reintenta.
- **Asunción para la beta**: PIN de 4 dígitos, fijo, comparado contra una
  variable de entorno (no hay flujo de "cambiar PIN" todavía). Se vuelve a
  pedir en cada arranque/recarga de la app, no en cada vuelta de background.
  Dime si quieres otra cosa.

### 2. Navegación

Barra de navegación con 3 items, abajo en móvil (arriba o abajo en
desktop, mismo componente): **Dashboard** (izq) — **Log** (centro, tab por
defecto al entrar) — **History** (der).

### 3. Log — estado "not logged"

- Fecha de hoy arriba, centrada, tipografía grande (el diseño de referencia
  no llegó como adjunto — uso este layout por defecto, dime si lo
  reenvías y lo ajusto).
- Rating de dolor: 5 estrellas, tap para seleccionar.
- Botón "Ninguno" debajo de las estrellas — selecciona explícitamente "sin
  dolor" en vez de dejarlo vacío (para poder distinguir "no dolió" de "no
  registrado" en el historial).
- Secciones adicionales (comida, deporte, ciclo, sexo...): placeholder —
  para la beta, un único campo de texto libre "notas del día" cubre todo
  esto hasta que definas los campos reales. Evita construir UI para un
  esquema que todavía no existe.
- Botón "Guardar" → hace upsert en `daily_log` con `date` = hoy → pasa a
  estado "logged".

### 4. Log — estado "logged"

- Mensaje de confirmación tipo "¡Ya registraste hoy! 🎉" — sin animaciones
  complejas para la beta, un estado visual claro basta.
- Botón "Editar" → vuelve al formulario de la sección 3, precargado con lo
  ya guardado.

### 5. History

- Lista de días en orden descendente (hoy primero), incluyendo los días sin
  entrada marcados como "sin registrar" — no se ocultan huecos.
- Tap en cualquier día → abre el mismo formulario del Log (secciones 3/4),
  con `date` fijada a ese día en vez de hoy. Si el día no tiene datos, abre
  vacío (entrada retroactiva); si ya tiene, abre precargado (edición).
- Guardar desde ahí hace el mismo upsert por fecha — es literalmente la
  misma pantalla de Log, solo que con la fecha fijada en vez de "hoy".

### 6. Dashboard

- Placeholder: "Próximamente — análisis en curso". Nada más para esta beta.

## Notas de implementación

- Una sola pantalla de "log form" sirve tanto para hoy (tab Log) como para
  cualquier día pasado (tab History → tap en un día) — la única diferencia
  es qué `date` se le pasa. Evita duplicar el formulario.
- El estado logged/not-logged de un día se deriva de si existe fila en
  `daily_log` para esa fecha, no de un campo aparte.
