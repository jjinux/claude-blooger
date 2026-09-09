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
- **`tsx` cannot run the Nest app.** It transforms with esbuild, which does not
  implement `emitDecoratorMetadata`, so constructor injection resolves every
  dependency to `undefined` — the first guarded request dies with "Cannot read
  properties of undefined (reading 'getAllAndOverride')". Run the API with
  `nest start` (tsc) or from `dist/`. The seed and the CLI are fine under `tsx`
  because neither goes through Nest's DI, and TypeORM here does not lean on
  reflected metadata: every column type is declared explicitly.

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

**`html: false` is load-bearing.** It is not one hardening flag among several:
every mutation-XSS vector depends on an element parsed in a foreign context
(`noscript`, `style`, `svg`, `math`, `template`, `xmp`), and `html: false` means
none can exist in the source to begin with. That is the whole reason a third
sanitizer was investigated and rejected — see the measurements in `TODO.md`.
Turning it on to support embeds deletes that argument in one line, and the mXSS
cases in `markdown.service.spec.ts` are there to fail when someone does.

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
- `SessionSweeper` deletes expired session rows on a **delay re-randomised before
  every sweep**, 20 to 60 minutes. Not a `setInterval`: a fleet restarted
  together would sweep in lockstep forever. There is no lock, deliberately —
  `DELETE WHERE expires_at < NOW()` is idempotent, so a second replica deletes
  whatever the first missed or nothing at all, which is cheaper than coordinating.
  Its timer is **unref'd**; housekeeping must never keep the process (or a test
  run) alive.
- Guard order matters: `@UseGuards(AuthenticatedGuard, AdminGuard)`.
  `AuthenticatedGuard` is what populates `request.user`.
- `CsrfGuard` and `RateLimitGuard` are registered **globally** in `AppModule`.
  Do not also list them in a controller's `@UseGuards` — they will run twice,
  and the rate limiter will double-count every request.
- Ownership checks live in the service, not a guard. A guard would have to load
  the post to learn who owns it, and then the handler would load it again.
- Client-side route guarding is a convenience. The API guards are the boundary.

### Validation

Zod schemas in `packages/shared`, not class-validator — one schema, shared by the
API and the SPA's forms. Zod strips unknown keys, which is what stops a client
smuggling `isAdmin: true` into a request body.

**Declare the schema on the parameter**, not in a pipe:

```ts
@Post('sessions')
login(@Body({ schema: loginSchema }) input: LoginInput) {}
```

`SchemaValidationPipe` is registered once, globally, and reads
`ArgumentMetadata.schema` — Nest 12 carries a Standard Schema there from the
parameter decorator. One declaration therefore does two jobs: it validates, and
`@nestjs/swagger` reads the same object to document the endpoint. Documenting a
body separately from validating it is how the two end up disagreeing. Parameters
with no schema pass straight through, so `@Param('id', ParseIntPipe)` is
unaffected.

### Errors

**Every failure has one shape**, `errorResponseSchema` in `@blooger/shared`:
`{ statusCode, error, message }`, plus `errors: [{ field, message }]` when the
failure was per-field validation. `ApiExceptionFilter` enforces it, so throw
whatever Nest exception fits and do not hand-roll a body.

Left alone, the shape depends on how the exception was built: a string argument
yields `{ statusCode, error, message }`, while an object argument replaces that
wholesale and loses `statusCode`. Anything that is not an `HttpException` is a
bug — it is logged with its stack and the client is told only "Internal server
error", because an exception message can carry a query or a path.

Extra fields do not belong in an error body. The rate limiter used to return
`retryAfterSeconds`; it sets a `Retry-After` header instead.

### API documentation

OpenAPI at `/api/docs`, JSON at `/api/docs-json`, generated in
`src/docs/openapi.ts`. There are no DTO classes and no `@ApiProperty()`: the zod
schemas are Standard Schemas and @nestjs/swagger reads them directly.

- Request bodies and query strings need no decorator at all — they come from
  `@Body({ schema })` and `@Query({ schema })`.
- Responses need one: `@ApiOkResponse({ standardSchema: postDetailSchema })`.
- Failures are `@ApiErrors(400, 401, 404)` from `src/docs/decorators.ts`, which
  attaches `ErrorResponse` and the one agreed description per status.
- Response schemas listed in `NAMED_SCHEMAS` become named components that
  cross-reference each other. Query schemas must **not** be named: the generator
  decomposes their properties into individual query parameters, which it cannot
  do through a `$ref`. That is why the converter only rewrites `output` schemas.
- `addCookieAuth(cookieName, options, schemeName)` — the first argument names the
  cookie and the third names the scheme. Confusing them produces routes that
  require a scheme nobody declared, and Swagger UI's Authorize button then does
  nothing. There is a test for dangling security requirements and `$ref`s.

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
npm run test:e2e        # Playwright; needs MySQL and `npx playwright install chromium`
```

Response schemas are documentation, and documentation nothing checks drifts.
`test/response-shapes.spec.ts` parses real responses through them and compares
the parsed value against the original — `parse` strips unknown keys, so that
catches a field the schema does not know about as well as one the API forgot to
send. Nothing validates responses on the way out; that cost belongs in a test.

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

### End-to-end

`playwright.config.ts` starts the API and the Vite dev server itself, on **3100
and 5273** rather than 3000 and 5173. Two reasons, and both matter: the suite
can run beside `npm run dev`, and it can never silently attach to a development
API pointed at `blooger_dev` and rewrite real data. `reuseExistingServer` is
`false` for the same kind of reason — the rate limiter counts in process memory,
so a reused server starts the run part-way through its window.

- `e2e/global-setup.ts` migrates and seeds `blooger_test` by shelling out to the
  repo's own `migration:run` and `seed` scripts, so the suite prepares its
  database the same way a developer does. `blooger_test` is also the API suite's
  database, so the two must not run at once.
- **One worker, no truncation between specs.** Anything a test creates outlives
  it, which is why registrations use `uniqueUsername()` — a fixed name passes on
  a fresh database and fails with "already taken" on the second run.
- **Retries are capped at 1, on purpose.** Registration allows 5 attempts per
  minute per IP and login 10, and every request here comes from `127.0.0.1`; a
  generous retry budget turns one flake into a wall of 429s.
- Drive inputs with Playwright's `fill()`. Assigning `.value` through the DOM
  does not update a React controlled input — the component's state stays empty
  and the form submits blanks.
- Assert against the API, not just the UI: the admin spec checks that
  `/api/admin/users` answers 403, because hiding the nav link proves nothing.

## Feeds

Feeds are public, identical for everybody, and cached by HTTP rather than by
anything we run:

- `Cache-Control: public, max-age=300, s-maxage=900, stale-while-revalidate=3600`
  on every feed route. The ETag is Express's own — it hashes the body and answers
  `If-None-Match` with a 304 by itself. Do not hand-roll one.
- **Feed output must be derived from content, never from the clock.** The same
  posts must serialize to the same bytes, or the ETag changes on every request
  and the whole scheme is decoration. This is not hypothetical: the `feed`
  package fills a missing Atom `<updated>` with `new Date()`, which made the
  empty feed unstable until `FeedsService` started passing the epoch.
- **Feeds skip the session middleware** (see `isFeedPath` in `bootstrap.ts`), and
  that is what makes `public` safe. `rolling: true` would otherwise put a
  `Set-Cookie` on a publicly cacheable response, and a shared cache could hand
  one reader's session to the next visitor.

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
