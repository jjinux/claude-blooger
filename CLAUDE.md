# CLAUDE.md

Conventions for working in this repo. Setup instructions live in
[README.md](README.md); this file is the rules, and the traps that have already
been hit once.

## Layout

```
apps/api          NestJS JSON API + feeds + (in production) the built SPA
apps/web          React SPA
packages/shared   Types and Zod schemas both halves validate against
```

Everything is **ESM**, including `packages/shared`. Consequences:

- Relative imports need explicit `.js` extensions, even from `.ts` files.
- There is no `__dirname`. Use `import.meta.dirname`.
- `tsx` runs TypeScript directly (the seed, the TypeORM CLI). `ts-node` is not used.

`packages/shared` compiles to `dist/`, so a stale build causes
"Cannot find module '@blooger/shared'" or nonsense type errors after a branch
switch. Fix with `npm run build:shared`.

## TypeORM

This project is on **TypeORM 1.x**, not 0.3. Most examples you will find online
are for 0.3 and are wrong here.

### The house query style

```ts
await dataSource.getRepository(PostEntity).findOneOrFail({
  where: { id },
  relations: { user: true },
  loadEagerRelations: false,
})
```

- **`relations` takes an object, never an array.** `relations: ['user']` was
  removed in 1.x and throws. Nested is `relations: { address: { serviceArea: true } }`.
- **`select` is an object too**: `select: { id: true, title: true }`.
- **Always pass `loadEagerRelations: false`**, even though nothing is marked
  eager. It is house style so that adding an eager relation later cannot
  silently change the shape of existing queries.
- The `join` find option is gone. Anything beyond a simple selected LEFT JOIN
  needs QueryBuilder.

### Entity rules

- **Never `eager: true`.** Callers ask for what they need.
- **No lazy (`Promise<T>`) relations.** They hide N+1s.
- **Data Mapper only** — `getRepository(X)`. Never Active Record.
- **Wrap every relation property in `Relation<T>`.** Without it,
  `emitDecoratorMetadata` emits an eager `design:type` class reference and the
  `users` ↔ `posts` import cycle dies at startup under ESM with
  "Cannot access 'UserEntity' before initialization".
- **Type relation properties as optional** (`user?: Relation<UserEntity>`).
  Nothing is eager-loaded, so a non-optional type would be a lie TypeScript
  would happily let you dereference.
- **Column types are explicit** (`@Column({ type: 'varchar', length: 64 })`)
  rather than inferred from reflect-metadata. It survives refactors and
  documents the schema at the call site.
- Index names are explicit. `unique: true` on a column leaves MySQL with an
  opaque generated name; use `@Index('idx_users_username', ['username'], { unique: true })`.

### 1.x behaviour that will bite

- A relation declared `nullable: false` joins with **INNER JOIN**, not LEFT
  JOIN. A `Post` whose author row is missing disappears from results rather
  than arriving with `user: null`.
- `where: { id: undefined }` **throws** instead of matching every row.
- `repository.delete({})` is **rejected**. To wipe a table, say so deliberately:
  `manager.createQueryBuilder().delete().from(UserEntity).execute()`.
- `findByIds` and `exist` are gone. Use `findBy({ id: In([...]) })` and `exists()`.

### Schema changes

- **`synchronize` is never true**, in any environment.
- **Migrations never run automatically.** `migrationsRun` is false; running them
  is a deliberate `npm run migration:run`.
- `data-source.ts` exports **exactly one** `DataSource`. The CLI rejects a file
  that exports more than one, which is why there is no default export.
- The options builder in `data-source.ts` is shared by the app and the CLI. Keep
  it that way, or migrations get generated against a different schema than the
  app talks to.

```sh
npm run migration:generate -- AddSomething   # path is positional, not --name
npm run migration:run
npm run migration:revert
```

`scripts/migration.mjs` rewrites each generated migration's
`import { MigrationInterface, QueryRunner }` to `import type`. Both are
interfaces, and a runtime TypeScript loader cannot erase a plain import, so
without it the migration fails to load under tsx or Vitest. `tsc` elides it,
which is why `nest build` hides the problem. Do not undo this.

### Pagination

Page-based `skip`/`take` via `findAndCount`. **Always order by a unique
tiebreaker** — `order: { createdAt: 'DESC', id: 'DESC' }`. Without the `id`,
rows sharing a timestamp have unspecified order and pagination silently drops
or repeats them.

## Security

### Markdown is the XSS-critical path

`MarkdownService` is the **only** place in the system that turns user input into
markup. Do not render Markdown anywhere else, and especially not in the browser.
It defends twice:

1. `html: false` makes markdown-it escape raw HTML in the source.
2. `sanitize-html` then filters the result against an allowlist.

If you add an attribute via `transformTags`, it must **also** be listed in
`allowedAttributes` — the filter runs after the transform, and will otherwise
strip the attribute it just added. This silently broke `rel="nofollow"` once.

The SPA renders the server's `bodyHtml`. It never parses Markdown.

### Auth

- argon2id parameters live in `auth/password.ts`. One place, so raising the cost
  is a one-line change.
- **Regenerate the session on login** (`regenerateSession`). Otherwise a token
  planted before login gets upgraded to an authenticated one.
- Login compares against a **dummy hash** when the username is unknown, so a
  missing account costs the same time as a wrong password. Keep the error
  message identical for both cases; it is what stops the endpoint being a
  username oracle.
- Guards **re-read the user from the database** every request rather than
  trusting the session payload, so a deleted or demoted account loses access at
  once.
- Guard order matters: `@UseGuards(AuthenticatedGuard, AdminGuard)`.
  `AuthenticatedGuard` is what populates `request.user`.
- `CsrfGuard` and `RateLimitGuard` are registered **globally** in `AppModule`.
  Do not also list them in a controller's `@UseGuards` — they will run twice,
  and the rate limiter will double-count every request.
- Ownership checks live in the service, not a guard. A guard would have to load
  the post to learn who owns it, and then the handler would load it again.
- Client-side route guarding is a convenience. The API guards are the boundary.

### Validation

Zod schemas in `packages/shared`, applied with `ZodValidationPipe`. Not
class-validator — one schema, shared by the API and the SPA's forms. Zod strips
unknown keys, which is what stops a client smuggling `isAdmin: true` into a
request body.

## The shared package

Two entry points, and the difference matters:

- **`@blooger/shared`** — everything, including the Zod schemas. For the API.
- **`@blooger/shared/contracts`** — constants and types only, no Zod. For the SPA.

The SPA must import from `/contracts`. Importing the root pulls ~890 kB of Zod
source into the browser bundle for the sake of a few constants: the schemas are
top-level `z.object(...)` calls evaluated at import, which a bundler cannot
prove are side-effect free and therefore cannot drop. Request types are
re-exported from `contracts.ts` with `export type`, so they are erased entirely
and cost nothing.

## Testing

```sh
npm test                # everything
npm run test:api        # needs MySQL up
npm run test:web        # jsdom only, needs nothing
```

The API suite migrates `blooger_test` once per run via Vitest `globalSetup` and
never touches `blooger_dev`.

Two isolation strategies, and picking the wrong one wastes an afternoon:

- **`truncateAll()` for HTTP tests.** Each request takes an arbitrary pooled
  connection, so a transaction opened on one `QueryRunner` is invisible to the
  code under test. Truncation is the only thing that actually works here.
  `FOREIGN_KEY_CHECKS` is session-scoped, so it runs on one pinned QueryRunner.
- **`withRollback()` for service-level tests**, where you can hand the code the
  QueryRunner's `EntityManager` directly.

Other things the harness already solves:

- `createTestApp()` boots the real app through the same `configureApp` that
  `main.ts` uses, so tests exercise what ships — middleware and global guards
  included.
- Call `ctx.resetRateLimits()` in `beforeEach`, or one spec's login attempts
  exhaust the limit for the next.
- **supertest's agent attaches its cookie jar when the request object is
  constructed.** Fetch a CSRF token into a variable _before_ building the
  request that carries it; `.set(HEADER, await bootstrapCsrf(agent))` sends a
  token belonging to a session the request is not carrying.

Write tests that assert the property, not the string. The XSS specs check the
emitted _tags_, because an escaped payload still contains the characters
"script" as harmless visible text — and on a blog engine, someone will
legitimately write about `<script>` one day.

## Workflow

- **Conventional Commits**: `type(scope): subject`. Scopes are `api`, `web`,
  `shared`, `db`. Prefer several coherent commits over one large one.
- **Branch for feature work**; do not commit to `main`. Open a PR.
- **Keep `TODO.md` updated** as things land, including decisions that turned out
  to be wrong. It is the project's memory.
- Before committing: `npm run typecheck`, `npm run lint`, `npm run format`,
  `npm test`.
- Verify in a browser when the change is user-facing. Two bugs in this project
  passed both the test suite and the production build while the dev server was
  broken.
