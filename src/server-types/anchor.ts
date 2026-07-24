/**
 * Keeps tsconfig.server.json's `include` glob non-empty. TypeScript errors
 * (TS18003) when an `include`d glob matches zero files, which would happen
 * whenever no `+api.ts` route currently exists in the repo. This file is
 * not an API route — it just guarantees the server program always has at
 * least one input so `tsc -p tsconfig.server.json` and ESLint's
 * `defaultProject` stay valid regardless of route count.
 */
export {}
