#!/usr/bin/env node
// Single entry point for every migration command.
//
// The TypeORM CLI is CommonJS while this app is ESM, and the data source it must
// load is TypeScript. Running the CLI under `node --import tsx` lets it import
// `data-source.ts` directly. This wrapper also spares every caller from retyping
// the migrations directory and the -d flag.
import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DATA_SOURCE = 'src/database/data-source.ts'
const MIGRATIONS_DIR = 'src/database/migrations'

const NAMED = new Set(['generate', 'create'])
const BARE = new Set(['run', 'revert', 'show'])

const [, , command, name] = process.argv

// Standalone rewrite, useful after hand-editing or importing a migration.
if (command === 'fix') {
  fixTypeOnlyImports()
  process.exit(0)
}

if (!NAMED.has(command) && !BARE.has(command)) {
  console.error(`Unknown command "${command ?? ''}".`)
  console.error(`Expected one of: ${[...NAMED, ...BARE].join(', ')}`)
  process.exit(1)
}

if (NAMED.has(command)) {
  if (!name) {
    console.error(`Usage: npm run migration:${command} -- <MigrationName>`)
    console.error(`   eg: npm run migration:${command} -- AddPostSlug`)
    process.exit(1)
  }
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(name)) {
    console.error(`Invalid migration name "${name}". Use PascalCase letters and digits only.`)
    process.exit(1)
  }
}

// `migration:generate` and `migration:create` take the path as a POSITIONAL argument.
const argsByCommand = {
  generate: ['migration:generate', `${MIGRATIONS_DIR}/${name}`, '-d', DATA_SOURCE, '--pretty'],
  create: ['migration:create', `${MIGRATIONS_DIR}/${name}`],
  run: ['migration:run', '-d', DATA_SOURCE],
  revert: ['migration:revert', '-d', DATA_SOURCE],
  show: ['migration:show', '-d', DATA_SOURCE],
}

let cli
try {
  cli = require.resolve('typeorm/cli.js')
} catch {
  console.error('Could not find the TypeORM CLI. Run `npm install` first.')
  process.exit(1)
}

const result = spawnSync('node', ['--import', 'tsx', cli, ...argsByCommand[command]], {
  cwd: apiRoot,
  stdio: 'inherit',
})

if (result.status === 0 && NAMED.has(command)) {
  fixTypeOnlyImports()
}

process.exit(result.status ?? 1)

/**
 * TypeORM emits `import { MigrationInterface, QueryRunner } from "typeorm"`, but
 * both of those are interfaces -- there is nothing to import at runtime. Node's
 * ESM loader cannot erase a plain import it has no type information for, so it
 * tries to load real bindings from CommonJS TypeORM and fails with
 * "does not provide an export named 'MigrationInterface'".
 *
 * `tsc` elides the import when building, which is why this only bites under a
 * runtime TypeScript loader such as Vitest or tsx. Rewriting it to `import type`
 * makes the file correct for every loader.
 */
function fixTypeOnlyImports() {
  const dir = resolve(apiRoot, MIGRATIONS_DIR)
  const pattern = /^import \{ MigrationInterface, QueryRunner \} from ["']typeorm["'];?$/m

  for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
    const path = join(dir, file)
    const source = readFileSync(path, 'utf8')
    if (!pattern.test(source)) continue

    writeFileSync(
      path,
      source.replace(pattern, `import type { MigrationInterface, QueryRunner } from 'typeorm'`),
    )
    console.log(`Rewrote type-only imports in ${file}`)
  }
}
