# 0007 Tests, Lint, Typprüfung

Status: vorgeschlagen (E16)

## Entscheidung
- `node --test` führt `.ts` direkt aus (Node ≥ 24, Type-Stripping). Dafür: `erasableSyntaxOnly` (keine Parameter-Properties, keine Enums), relative Imports **mit** `.ts`-Endung (`allowImportingTsExtensions`).
- Biome für Lint und Format. Markdown ist ausgenommen, damit Dokumentation nicht umformatiert wird.
- **Core ohne DOM** wird doppelt geprüft:
  1. `tsconfig.core.json` prüft `src/core` mit `lib: ["ES2023"]` ohne DOM-Typen (Teil von `npm run check`).
  2. Biome `noRestrictedImports` verbietet Preact-Imports in `src/core`.
- E2E: Playwright gegen `file://…/dist/orgamorph.html`, Chromium und Firefox.
