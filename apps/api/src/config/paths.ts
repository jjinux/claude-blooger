import { resolve } from 'node:path'

/**
 * Repo root, resolved the same way whether this file runs from `src/` under tsx
 * or from `dist/` after a build: `src/config` and `dist/config` both sit exactly
 * four levels below the root.
 */
export const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..')
