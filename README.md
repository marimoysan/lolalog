# lolalog

Diario personal para trackear síntomas de dolor (deporte, comida, ciclo
menstrual, relaciones sexuales, etc.) y buscar patrones.

- Datos locales, en SQLite (WASM, vía `sql.js`) dentro del navegador.
- App instalable como PWA, pensada para rellenarse desde el móvil o el portátil.
- Sin sync todavía (fase 2) y sin gráficas en la app — el análisis se hace
  aparte en Python/pandas leyendo el SQLite directamente.

Detalles de arquitectura y decisiones en [CLAUDE.md](CLAUDE.md).

## Desarrollo

```bash
npm install
npm run dev
```
