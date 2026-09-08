# Blooger (TypeScript) — TODO

A port of the Rails [blooger](~/Dropbox/programming/ruby/blooger/) app to
Node + TypeScript + NestJS + TypeORM + React + Tailwind, built as a practice project.

Legend: `[x]` done, `[ ]` not started.

---

## 1. Plan and decisions

 * [x] Review the original Rails app to recover the domain model and feature set.
   * [x] Entities: `users` (username, crypted_password, bloog_title) and `posts` (user_id, title, body).
   * [x] Features: register, log in, edit account, post in Markdown, list all bloogs on the
         homepage, view one bloog, per-bloog Atom feed, FK constraints, Cucumber + RSpec tests.
 * [x] Decide how HTML gets to the browser.
   * [x] **NestJS is a pure JSON API; React + Vite is a client-rendered SPA.**
   * [x] Dev: `vite dev` on :5173 proxies `/api` to Nest on :3000.
   * [x] Prod: Nest serves `apps/web/dist` as static files, falling back to `index.html`
         for unknown paths so client-side routing works on a hard refresh.
   * [x] Feeds and `sitemap.xml` are rendered server-side by Nest — they aren't HTML,
         so the SPA never needs to produce them.
   * [x] Accepted tradeoff: no SEO / no server-rendered post pages. Revisit only if
         this stops being a practice project.
 * [x] Decide the domain model: **multi-user "bloogs"**, like the Rails original.
       Every user gets one bloog; posts belong to a user; homepage lists all bloogs;
       each bloog has its own feed. Plus a new `admin` superuser with an `/admin` section.
 * [x] Decide auth: **server-side session cookie**. argon2id password hashes, a `sessions`
       row in MySQL, opaque session id in an httpOnly `SameSite=Lax` cookie, read by a Nest guard.
       Revocable server-side; no token-expiry footguns.
 * [x] Decide the database: **MySQL 8 via Docker Compose** (matches the Rails original;
       Docker is already installed, no local mysql client is).
 * [x] Decide the test stack.
   * [x] **Vitest** for both `apps/api` and `apps/web` — one runner, one config style.
   * [x] Database tests: **one transaction per test, rolled back in `afterEach`**.
   * [x] **Playwright** for a handful of real browser flows (the Cucumber equivalent).
 * [x] Decide scope: straight port + the items in this list. No comments, tags, drafts,
       or slugs in v1.
 * [x] Decide the TypeORM version and query style.
   * [x] Use **TypeORM 1.x** (currently 1.1.1), the current major.
   * [x] Confirmed by test: the string-array form `relations: ['address.serviceArea']`
         is **removed**. TypeORM 1.x guards against it explicitly and throws
         `String-array "relations" syntax has been removed. Use object syntax instead...`
         (Reading `buildRelations` alone suggested a bare `EntityPropertyNotFoundError`;
         there is a friendlier check ahead of it.) The nested-object form is now the
         only syntax, and unlike the old one it is type-checked against the entity.
         Locked in by a regression test in `apps/api/src/database/schema.spec.ts`.
   * [x] House query style, carried over from the Rails-era habits:
         ```ts
         await dataSource.getRepository(PostEntity).findOneOrFail({
           where: { id },
           relations: { user: true },        // was: ['user']
           loadEagerRelations: false,        // still supported
         })
         ```
   * [x] `select` also moved from array to object form: `select: { id: true, title: true }`.
   * [x] The `join` find option is gone entirely — anything past a simple selected LEFT JOIN
         needs QueryBuilder.
 * [x] Install a modern Node: **v24.20.0** (Latest LTS "Krypton") via nvm, npm 11.19.0.
       Clears every dependency floor, including TypeORM 1.x's `>=24.11.0` on the v24 line.
 * [x] Pin **TypeScript 6.0.3**, which is forced from both sides: `@nestjs/schematics@12`
       requires `typescript >=6.0.0`, and `typescript-eslint@8.70` requires `<6.1.0`.
       TypeScript 7 (the Go port) is out but nothing in this toolchain supports it yet.
   * [x] TS 6 deprecates `baseUrl` and `moduleResolution: "node"`. Dropped `baseUrl`/`paths`
         entirely (npm workspaces already resolves `@blooger/shared`) and moved to
         `nodenext`. `experimentalDecorators` is *not* deprecated in TS 6.
 * [x] **NestJS 12 is ESM-only** (`"type": "module"`), so `apps/api` is ESM, not the
       CommonJS that older Nest tutorials assume. Consequences, all handled:
   * [x] Relative imports carry explicit `.js` extensions.
   * [x] `__dirname` replaced with `import.meta.dirname`.
   * [x] `tsx` runs TypeScript directly (seed, TypeORM CLI); `ts-node` is not used.
   * [x] Nest 12's own `ts-esm` schematic template was used as the reference for
         tsconfig and Vitest setup -- and it confirms Vitest is now Nest's default.
 * [ ] Answer "RSS or Atom?" — **generate all three**. Atom is the most correct choice for a
       blog and is what the Rails version emitted; RSS 2.0 is still what older readers expect;
       JSON Feed is cheap to add. The `feed` package emits all three from one object, so this
       is nearly free.

## 2. Repo and tooling setup

 * [x] `.nvmrc` pinning `24.20.0`, and an `engines.node` field so a wrong Node fails loudly.
 * [x] npm workspaces monorepo (npm 11 is already installed; no need for pnpm).
   * [x] `apps/api` — NestJS.
   * [x] `apps/web` — Vite + React + Tailwind.
   * [x] `packages/shared` — DTO types and Zod schemas shared by both, so the SPA and the
         API can't drift. Built with `tsc` and consumed through the workspace symlink
         (a TS path alias alone would not survive to runtime).
 * [x] Root `package.json` with simple scripts:
   * [x] `npm run dev` — DB up, then API and web dev servers concurrently.
   * [x] `npm run build`, `npm start` (prod: Nest serving the built SPA).
   * [ ] `npm test` (unit + integration), `npm run test:e2e` (Playwright).
   * [x] `npm run db:up` / `db:down` / `db:nuke` / `db:reset` / `db:shell` / `db:logs`.
         `db:reset` verified from a destroyed volume: recreate, wait healthy, migrate, seed.
   * [x] `npm run migration:generate -- <Name>`, `migration:run`, `migration:revert`.
   * [ ] `npm run lint`, `npm run format`, `npm run typecheck`.
 * [x] TypeScript config: strict mode on, `experimentalDecorators` + `emitDecoratorMetadata`
       for Nest and TypeORM, a shared base tsconfig extended by each workspace.
 * [ ] ESLint (flat config) + Prettier.
 * [x] `.gitignore`, and `git init` — this directory is not a repo yet.
 * [x] `.env.example` plus a `.env` loaded by `@nestjs/config`, with the env shape
       validated by Zod at boot so a missing var fails at startup, not at first query.

## 3. Database and TypeORM

 * [x] `docker-compose.yml` with MySQL 8, a named volume, and a healthcheck.
   * [x] Create both `blooger_dev` and `blooger_test` databases on first boot via an init script.
 * [x] `apps/api/src/data-source.ts` exporting a `DataSource` for the TypeORM CLI.
   * [x] Share one options object between the CLI DataSource and
         `TypeOrmModule.forRootAsync`, so migrations and the app can never disagree.
   * [x] `synchronize: false` always, in every environment. Schema changes go through migrations.
   * [x] `migrations:run` via the CLI, never `migrationsRun: true` on boot.
 * [x] Migration workflow. Note the path is a **positional argument**, not `--name`
       (some docs and search results claim otherwise). All of it is wrapped in
       `apps/api/scripts/migration.mjs`, so the DX is `npm run migration:generate -- <Name>`.
   * [x] The CLI rejects a data-source file exporting more than one `DataSource`,
         so `data-source.ts` deliberately has no default export.
   * [x] The wrapper rewrites each generated migration's
         `import { MigrationInterface, QueryRunner }` to `import type`. Both are
         interfaces, and a runtime TypeScript loader (tsx, Vitest) cannot erase a
         plain import, so without this the migration fails to load with
         "does not provide an export named 'MigrationInterface'". `tsc` elides it,
         which is why a plain `nest build` hides the problem.
 * [x] Write a small in-repo snake_case `NamingStrategy` (~30 lines) so columns are
       `created_at`, not `createdAt`.
   * [x] Note: don't reach for `typeorm-naming-strategies` — last published 2022 against
         TypeORM 0.3, so it isn't a safe bet on 1.x.
 * [x] Establish entity conventions and write them down in CLAUDE.md:
   * [x] Never mark a relation `eager: true`; always pass `loadEagerRelations: false`
         explicitly anyway, so that adding an eager relation later can't silently
         change the shape of existing queries.
   * [x] No lazy (`Promise<T>`) relations — they hide N+1s.
   * [x] Data Mapper only (`getRepository(X)`), never Active Record.
   * [x] Explicit `@JoinColumn` names, and real FK constraints, like the Rails version had.
 * [x] Understand the TypeORM 1.x behavior changes that will actually bite:
   * [x] `Relation<T>` is required on every relation property. Without it,
         `emitDecoratorMetadata` emits an eager `design:type` class reference and the
         users <-> posts import cycle dies at startup under ESM with
         "Cannot access 'UserEntity' before initialization".
   * [x] `repository.delete({})` is rejected outright -- an empty criteria object is
         treated as a mistake, not as "match everything". Wiping a table needs an
         explicit query builder delete.
   * [x] `invalidWhereValuesBehavior` is an **object**
         (`{ null: 'throw', undefined: 'throw' }`), not a bare string.
   * [x] A relation declared `nullable: false` now joins with **INNER JOIN**, not LEFT JOIN.
         `Post.user` is non-nullable, so a post whose user row is missing will vanish
         from results rather than come back with `user: null`.
   * [x] `invalidWhereValuesBehavior` now **throws** on `undefined`/`null` in a `where`,
         instead of silently ignoring the condition. This is the good default —
         it turns `where: { id: undefined }` from "return everything" into an error.
   * [x] `findByIds` and `exist` are gone; use `findBy({ id: In([...]) })` and `exists()`.
 * [x] Decide pagination: page-based `skip`/`take` via `findAndCount`, driven by a
       `?page=` query param. Envelope and Zod schema live in `packages/shared`. Note that with a joined relation TypeORM wraps this in a
       DISTINCT subquery — correct, but worth reading the generated SQL once to see why.

## 4. Domain model and migrations

 * [x] `UserEntity` — `id`, `username` (unique, citext-ish collation), `passwordHash`,
       `bloogTitle`, `isAdmin`, `createdAt`, `updatedAt`.
   * [ ] Trim whitespace on write (the Rails app used `strip_attributes`); do it in a
         DTO transform so it applies before validation.
 * [x] `PostEntity` — `id`, `userId`, `title`, `body` (Markdown source), `createdAt`, `updatedAt`.
   * [x] `@ManyToOne(() => UserEntity)` with a real FK and `ON DELETE CASCADE`, matching
         the Rails `:dependent => :delete`.
   * [x] Index on `(user_id, created_at DESC)` for the per-bloog listing, and on
         `created_at DESC` for the site-wide homepage.
 * [x] `SessionEntity` — `id` (opaque random), `userId`, `expiresAt`, `data`.
 * [x] Generate and commit the initial migration; verify it round-trips with
       `migration:run` then `migration:revert`.
 * [x] Seed script: 4 users (`admin`, `joe`, `jane`, and a deliberately postless
       `quiet`) and 22 posts, all with password `password123`.

## 5. Auth

 * [ ] argon2id hashing via the `argon2` package, with sensible memory/time cost, in one
       `PasswordService` so the parameters live in exactly one place.
 * [ ] Registration: username + password + bloog title. Reject duplicate usernames with a
       proper 409 rather than letting the unique-index error escape as a 500.
 * [ ] Login / logout writing and clearing the session cookie.
   * [ ] Compare against a dummy hash on unknown usernames so the response time doesn't
         leak whether an account exists.
 * [ ] Session store: `express-session` backed by a small hand-written TypeORM store.
   * [ ] Note: don't use `connect-typeorm` — last published 2022, and its peer dep is
         `typeorm ^0.3.0`, so it won't accept 1.x.
   * [ ] Cookie: `httpOnly`, `sameSite: 'lax'`, `secure` in production, rolling expiry.
 * [ ] `AuthGuard` (is anyone logged in?) and `AdminGuard` (is it the admin?), plus a
       `@CurrentUser()` param decorator.
 * [ ] Ownership checks: you may only edit or delete your own posts. Admin may touch anything.
 * [ ] CSRF: since auth rides on a cookie, require a custom header on all mutating
       requests, or issue a double-submit token. `SameSite=Lax` alone is not enough.
 * [ ] Rate-limit login and registration with `@nestjs/throttler`.
 * [ ] Account editing: change bloog title, change password (requires the current password).

## 6. API

 * [ ] Global `ValidationPipe` with `whitelist` and `forbidNonWhitelisted`, so unexpected
       fields are rejected rather than silently dropped.
 * [ ] Consistent error shape via an exception filter.
 * [ ] Endpoints:
   * [ ] `POST /api/users` (register), `GET/PATCH /api/account`.
   * [ ] `POST /api/sessions` (login), `DELETE /api/sessions` (logout), `GET /api/me`.
   * [ ] `GET /api/bloogs` — paginated list of all bloogs.
   * [ ] `GET /api/bloogs/:username` — one bloog plus a page of its posts.
   * [ ] `GET /api/posts` — site-wide recent posts, paginated (drives the homepage).
   * [ ] `GET /api/posts/:id`, `POST /api/posts`, `PATCH /api/posts/:id`, `DELETE /api/posts/:id`.
   * [ ] `GET /api/admin/users`, `DELETE /api/admin/users/:id`, `GET /api/admin/posts`.
 * [ ] Markdown: store the raw Markdown, render to HTML server-side with `markdown-it`,
       sanitize with `sanitize-html`, and return both `body` and `bodyHtml`.
   * [ ] One `MarkdownService` used by both the API and the feed generator, so there is a
         single place where sanitization happens. This is the XSS-critical path —
         the Rails version leaned on `rails_xss` for the same reason.
 * [ ] Swagger via `@nestjs/swagger` at `/api/docs`.

## 7. Feeds

 * [ ] Use the `feed` package to emit Atom 1.0, RSS 2.0, and JSON Feed from one definition.
 * [ ] `GET /feed.atom`, `/feed.rss`, `/feed.json` — site-wide recent posts.
 * [ ] `GET /bloogs/:username/feed.atom` (and `.rss`, `.json`) — one bloog.
 * [ ] Correct `Content-Type` on each, absolute URLs throughout, and stable entry ids.
 * [ ] `<link rel="alternate">` tags in the SPA's `index.html` so readers autodiscover them.
 * [ ] Test that the output actually parses as well-formed XML — the Rails version's
       Cucumber suite checked exactly this, and it's an easy thing to silently break.

## 8. Frontend

 * [ ] Vite + React 19 + TypeScript, Tailwind v4 via `@tailwindcss/vite`.
 * [ ] react-router for routing; TanStack Query for server state, so caching and
       refetch-after-mutation don't get hand-rolled.
 * [ ] Pages:
   * [ ] `/` — recent posts across all bloogs, newest first, with an "older entries"
         link at the bottom.
   * [ ] `/bloogs` — every bloog. Empty state: "There are no bloogs yet."
   * [ ] `/bloogs/:username` — one bloog's posts, paginated.
   * [ ] `/bloogs/:username/posts/:id` — a single post.
   * [ ] `/register`, `/login`, `/account`.
   * [ ] `/posts/new`, `/posts/:id/edit`.
   * [ ] `/admin` — users and posts, admin only.
 * [ ] Auth-aware shell: header reflects logged-in state; protected routes redirect to login.
 * [ ] Render `bodyHtml` from the server rather than parsing Markdown in the browser —
       one renderer, one sanitizer, no second attack surface.
 * [ ] Loading, empty, and error states for every list.
 * [ ] Dark mode, since Tailwind makes it nearly free.

## 9. Testing

 * [x] Vitest configured for both workspaces.
   * [x] No SWC plugin needed: Vite 8 transforms via Oxc, which supports
         `emitDecoratorMetadata`. Verified by a passing Nest/TypeORM entity test.
   * [x] `vite-tsconfig-paths` is obsolete too -- Vite 8 has `resolve.tsconfigPaths`.
 * [ ] Unit tests with no database: password hashing, Markdown rendering and sanitization,
       feed XML generation, pagination math.
 * [~] Integration tests against a real MySQL `blooger_test`: a first spec exists
       (`schema.spec.ts`) and runs migrations at suite start. The per-test transaction
       harness below is still to do.
   * [ ] Migrate once at suite start.
   * [ ] Per-test transaction on a single shared `QueryRunner`, rolled back in `afterEach`.
   * [ ] Override the Nest `DataSource`/`EntityManager` provider so code under test uses
         that same QueryRunner — otherwise it opens its own connection and sees none of
         the test's uncommitted data. This is the one fiddly part of the strategy.
   * [ ] Watch out: DDL inside a test commits implicitly in MySQL and breaks the rollback.
 * [ ] HTTP tests with Supertest: auth flows, ownership rules (a user may not edit
       someone else's post), validation failures, feed content types.
 * [~] React component tests with Testing Library + jsdom -- a smoke test for the
       app shell exists and passes. MSW still to be added for real API fixtures.
 * [ ] Playwright, a handful of flows only:
   * [ ] Register → log in → create a post → see it on the homepage → fetch the Atom feed.
   * [ ] Admin logs in, reaches `/admin`; a normal user gets 403.
 * [ ] Test factories for users and posts (the `factory_girl` equivalent).
 * [ ] CI-ready: one command that boots MySQL, migrates, and runs everything.

## 10. Documentation

 * [ ] `README.md` — what the project is, the stack, and how to get it running from a
       cold clone (nvm, npm install, docker compose up, migrate, seed, dev).
 * [ ] `CLAUDE.md` — the conventions above stated as rules: the TypeORM query style,
       no eager/lazy relations, migrations never auto-run, `synchronize` never true,
       where sanitization lives, how to run tests, and the layout of the workspaces.
 * [ ] Keep this TODO.md updated as things land.

## 11. Deferred

Explicitly out of scope for v1; listed so they don't get silently forgotten.

 * [ ] Comments on posts.
 * [ ] Tags (many-to-many — the one relation shape this schema won't teach).
 * [ ] Post drafts and URL slugs.
 * [ ] Full-text search.
 * [ ] Image uploads.
 * [ ] Server-side rendering, if SEO ever matters.
 * [ ] Deployment (the Rails version ran on Heroku).
