Fase 2. Sincronización portátil ↔ móvil sobre el backend en Vercel.

Diseño acordado: la base SQLite (`lib/db/client.ts`) sigue siendo la fuente de
verdad en cada dispositivo. El servidor solo reenvía filas nuevas cifradas
(end-to-end, clave derivada de una passphrase local) entre dispositivos —
nunca ve los datos en claro. Cada fila del diario se identifica por `date`;
el sync es un upsert por fecha usando `updated_at` (last-write-wins).

No implementado todavía — se aborda cuando el logging local funcione.
