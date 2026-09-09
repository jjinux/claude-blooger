# Blooger (TypeScript) — TODO

A port of the Rails [blooger](~/Dropbox/programming/ruby/blooger/) app to
Node + TypeScript + NestJS + TypeORM + React + Tailwind, built as a practice project.

Legend: `[x]` done, `[ ]` not started.

---

## 1. Plan and decisions

- [x] Review the original Rails app to recover the domain model and feature set.
  - [x] Entities: `users` (username, crypted_password, bloog_title) and `posts` (user_id, title, body).
  - [x] Features: register, log in, edit account, post in Markdown, list all bloogs on the
        homepage, view one bloog, per-bloog Atom feed, FK constraints, Cucumber + RSpec tests.
- [x] Decide how HTML gets to the browser.
  - [x] **NestJS is a pure JSON API; React + Vite is a client-rendered SPA.**
  - [x] Dev: `vite dev` on :5173 proxies `/api` to Nest on :3000.
  - [x] Prod: Nest serves `apps/web/dist` as static files, falling back to `index.html`
        for unknown paths so client-side routing works on a hard refresh.
  - [x] Feeds and `sitemap.xml` are rendered server-side by Nest — they aren't HTML,
        so the SPA never needs to produce them.
  - [x] Accepted tradeoff: no SEO / no server-rendered post pages. Revisit only if
        this stops being a practice project.
- [x] Decide the domain model: **multi-user "bloogs"**, like the Rails original.
      Every user gets one bloog; posts belong to a user; homepage lists all bloogs;
      each bloog has its own feed. Plus a new `admin` superuser with an `/admin` section.
- [x] Decide auth: **server-side session cookie**. argon2id password hashes, a `sessions`
      row in MySQL, opaque session id in an httpOnly `SameSite=Lax` cookie, read by a Nest guard.
      Revocable server-side; no token-expiry footguns.
- [x] Decide the database: **MySQL 8 via Docker Compose** (matches the Rails original;
      Docker is already installed, no local mysql client is).
- [x] Decide the test stack.
  - [x] **Vitest** for both `apps/api` and `apps/web` — one runner, one config style.
  - [x] Database tests: **one transaction per test, rolled back in `afterEach`**.
  - [x] **Playwright** for a handful of real browser flows (the Cucumber equivalent).
- [x] Decide scope: straight port + the items in this list. No comments, tags, drafts,
      or slugs in v1.
- [x] Decide the TypeORM version and query style.
  - [x] Use **TypeORM 1.x** (currently 1.1.1), the current major.
  - [x] Confirmed by test: the string-array form `relations: ['address.serviceArea']`
        is **removed**. TypeORM 1.x guards against it explicitly and throws
        `String-array "relations" syntax has been removed. Use object syntax instead...`
        (Reading `buildRelations` alone suggested a bare `EntityPropertyNotFoundError`;
        there is a friendlier check ahead of it.) The nested-object form is now the
        only syntax, and unlike the old one it is type-checked against the entity.
        Locked in by a regression test in `apps/api/src/database/schema.spec.ts`.
  - [x] House query style, carried over from the Rails-era habits:

    ```ts
    await dataSource.getRepository(PostEntity).findOneOrFail({
      where: { id },
      relations: { user: true }, // was: ['user']
      loadEagerRelations: false, // still supported
    })
    ```

  - [x] `select` also moved from array to object form: `select: { id: true, title: true }`.
  - [x] The `join` find option is gone entirely — anything past a simple selected LEFT JOIN
        needs QueryBuilder.
- [x] Install a modern Node: **v24.20.0** (Latest LTS "Krypton") via nvm, npm 11.19.0.
      Clears every dependency floor, including TypeORM 1.x's `>=24.11.0` on the v24 line.
- [x] Pin **TypeScript 6.0.3**, which is forced from both sides: `@nestjs/schematics@12`
      requires `typescript >=6.0.0`, and `typescript-eslint@8.70` requires `<6.1.0`.
      TypeScript 7 (the Go port) is out but nothing in this toolchain supports it yet.
  - [x] TS 6 deprecates `baseUrl` and `moduleResolution: "node"`. Dropped `baseUrl`/`paths`
        entirely (npm workspaces already resolves `@blooger/shared`) and moved to
        `nodenext`. `experimentalDecorators` is _not_ deprecated in TS 6.
- [x] **NestJS 12 is ESM-only** (`"type": "module"`), so `apps/api` is ESM, not the
      CommonJS that older Nest tutorials assume. Consequences, all handled:
  - [x] Relative imports carry explicit `.js` extensions.
  - [x] `__dirname` replaced with `import.meta.dirname`.
  - [x] `tsx` runs TypeScript directly (seed, TypeORM CLI); `ts-node` is not used.
  - [x] Nest 12's own `ts-esm` schematic template was used as the reference for
        tsconfig and Vitest setup -- and it confirms Vitest is now Nest's default.
- [x] Answer "RSS or Atom?" — **generate all three**. Atom is the most correct choice for a
      blog and is what the Rails version emitted; RSS 2.0 is still what older readers expect;
      JSON Feed is cheap to add. The `feed` package emits all three from one object, so this
      is nearly free.

## 2. Repo and tooling setup

- [x] `.nvmrc` pinning `24.20.0`, and an `engines.node` field so a wrong Node fails loudly.
- [x] npm workspaces monorepo (npm 11 is already installed; no need for pnpm).
  - [x] `apps/api` — NestJS.
  - [x] `apps/web` — Vite + React + Tailwind.
  - [x] `packages/shared` — DTO types and Zod schemas shared by both, so the SPA and the
        API can't drift. Built with `tsc` and consumed through the workspace symlink
        (a TS path alias alone would not survive to runtime).
- [x] Root `package.json` with simple scripts:
  - [x] `npm run dev` — DB up, then API and web dev servers concurrently.
  - [x] `npm run build`, `npm start` (prod: Nest serving the built SPA).
  - [x] `npm test` (unit + integration), `npm run test:e2e` (Playwright).
  - [x] `npm run db:up` / `db:down` / `db:nuke` / `db:reset` / `db:shell` / `db:logs`.
        `db:reset` verified from a destroyed volume: recreate, wait healthy, migrate, seed.
  - [x] `npm run migration:generate -- <Name>`, `migration:run`, `migration:revert`.
  - [ ] `npm run lint`, `npm run format`, `npm run typecheck`.
- [x] TypeScript config: strict mode on, `experimentalDecorators` + `emitDecoratorMetadata`
      for Nest and TypeORM, a shared base tsconfig extended by each workspace.
- [x] ESLint (flat config) + Prettier.
  - [x] Both were listed in `package.json` long before they worked: `npm run lint`
        errored out with no config at all, and `format:check` flagged 98 files
        because Prettier's defaults disagreed with the code style. Fixed rather
        than documented, since the README is not going to advertise a broken command.
  - [x] ESLint immediately earned its keep: an unnecessary regex escape, and an
        `eslint-disable react/no-danger` comment naming a rule from a plugin that
        is not installed, so it was silencing nothing.
  - [x] `TODO.md` is formatted by Prettier like everything else. It rewrites the
        original ` * [ ]` bullets to `- [ ]`; that was checked and accepted, so
        there is no exclusion to remember.
- [x] `.gitignore`, and `git init` — this directory is not a repo yet.
- [x] `.env.example` plus a `.env` loaded by `@nestjs/config`, with the env shape
      validated by Zod at boot so a missing var fails at startup, not at first query.

## 3. Database and TypeORM

- [x] `docker-compose.yml` with MySQL 8, a named volume, and a healthcheck.
  - [x] Create both `blooger_dev` and `blooger_test` databases on first boot via an init script.
- [x] `apps/api/src/data-source.ts` exporting a `DataSource` for the TypeORM CLI.
  - [x] Share one options object between the CLI DataSource and
        `TypeOrmModule.forRootAsync`, so migrations and the app can never disagree.
  - [x] `synchronize: false` always, in every environment. Schema changes go through migrations.
  - [x] `migrations:run` via the CLI, never `migrationsRun: true` on boot.
- [x] Migration workflow. Note the path is a **positional argument**, not `--name`
      (some docs and search results claim otherwise). All of it is wrapped in
      `apps/api/scripts/migration.mjs`, so the DX is `npm run migration:generate -- <Name>`.
  - [x] The CLI rejects a data-source file exporting more than one `DataSource`,
        so `data-source.ts` deliberately has no default export.
  - [x] The wrapper rewrites each generated migration's
        `import { MigrationInterface, QueryRunner }` to `import type`. Both are
        interfaces, and a runtime TypeScript loader (tsx, Vitest) cannot erase a
        plain import, so without this the migration fails to load with
        "does not provide an export named 'MigrationInterface'". `tsc` elides it,
        which is why a plain `nest build` hides the problem.
- [x] Write a small in-repo snake_case `NamingStrategy` (~30 lines) so columns are
      `created_at`, not `createdAt`.
  - [x] Note: don't reach for `typeorm-naming-strategies` — last published 2022 against
        TypeORM 0.3, so it isn't a safe bet on 1.x.
- [x] Establish entity conventions and write them down in CLAUDE.md:
  - [x] Never mark a relation `eager: true`; always pass `loadEagerRelations: false`
        explicitly anyway, so that adding an eager relation later can't silently
        change the shape of existing queries.
  - [x] No lazy (`Promise<T>`) relations — they hide N+1s.
  - [x] Data Mapper only (`getRepository(X)`), never Active Record.
  - [x] Explicit `@JoinColumn` names, and real FK constraints, like the Rails version had.
- [x] Understand the TypeORM 1.x behavior changes that will actually bite:
  - [x] `Relation<T>` is required on every relation property. Without it,
        `emitDecoratorMetadata` emits an eager `design:type` class reference and the
        users <-> posts import cycle dies at startup under ESM with
        "Cannot access 'UserEntity' before initialization".
  - [x] `repository.delete({})` is rejected outright -- an empty criteria object is
        treated as a mistake, not as "match everything". Wiping a table needs an
        explicit query builder delete.
  - [x] `invalidWhereValuesBehavior` is an **object**
        (`{ null: 'throw', undefined: 'throw' }`), not a bare string.
  - [x] A relation declared `nullable: false` now joins with **INNER JOIN**, not LEFT JOIN.
        `Post.user` is non-nullable, so a post whose user row is missing will vanish
        from results rather than come back with `user: null`.
  - [x] `invalidWhereValuesBehavior` now **throws** on `undefined`/`null` in a `where`,
        instead of silently ignoring the condition. This is the good default —
        it turns `where: { id: undefined }` from "return everything" into an error.
  - [x] `findByIds` and `exist` are gone; use `findBy({ id: In([...]) })` and `exists()`.
- [x] Decide pagination: page-based `skip`/`take` via `findAndCount`, driven by a
      `?page=` query param. Envelope and Zod schema live in `packages/shared`. Note that with a joined relation TypeORM wraps this in a
      DISTINCT subquery — correct, but worth reading the generated SQL once to see why.

## 4. Domain model and migrations

- [x] `UserEntity` — `id`, `username` (unique, citext-ish collation), `passwordHash`,
      `bloogTitle`, `isAdmin`, `createdAt`, `updatedAt`.
  - [x] Trim whitespace on write (the Rails app used `strip_attributes`). Done with
        Zod's `.trim()` in the shared schemas, so it runs before `.min(1)` and a
        whitespace-only title is rejected rather than stored.
- [x] `PostEntity` — `id`, `userId`, `title`, `body` (Markdown source), `createdAt`, `updatedAt`.
  - [x] `@ManyToOne(() => UserEntity)` with a real FK and `ON DELETE CASCADE`, matching
        the Rails `:dependent => :delete`.
  - [x] Index on `(user_id, created_at DESC)` for the per-bloog listing, and on
        `created_at DESC` for the site-wide homepage.
- [x] `SessionEntity` — `id` (opaque random), `userId`, `expiresAt`, `data`.
- [x] Generate and commit the initial migration; verify it round-trips with
      `migration:run` then `migration:revert`.
- [x] Seed script: 4 users (`admin`, `joe`, `jane`, and a deliberately postless
      `quiet`) and 22 posts, all with password `password123`.

## 5. Auth

- [x] argon2id hashing via the `argon2` package, with sensible memory/time cost, in one
      `PasswordService` so the parameters live in exactly one place.
- [x] Registration: username + password + bloog title. Reject duplicate usernames with a
      proper 409 rather than letting the unique-index error escape as a 500.
- [x] Login / logout writing and clearing the session cookie.
  - [x] Compare against a dummy hash on unknown usernames so the response time doesn't
        leak whether an account exists.
- [x] Session store: `express-session` backed by a small hand-written TypeORM store.
  - [x] Note: don't use `connect-typeorm` — last published 2022, and its peer dep is
        `typeorm ^0.3.0`, so it won't accept 1.x.
  - [x] Cookie: `httpOnly`, `sameSite: 'lax'`, `secure` in production, rolling expiry.
  - [x] **`pruneExpired()` is written but never called.** Fixed: `SessionSweeper`
        calls it. Never a security hole — expiry is enforced on every read, and a
        stale row could never authenticate a request — but the table grew without
        bound, and every logged-out visitor who ever loaded a page left one behind.
    - [x] Decided: in-process, on a timer, with **no lock**. The delay is
          re-randomised before _every_ sweep, 20 to 60 minutes, which is the part
          that makes it survive more than one instance — a plain `setInterval`
          would put a fleet restarted together into permanent lockstep, whereas
          jitter spreads them out and keeps them spread.
    - [x] No lock and no external scheduler, on purpose.
          `DELETE ... WHERE expires_at < NOW()` is idempotent: a second replica
          running it a moment later deletes what the first missed, or nothing.
          Duplicated work on a table this size is cheaper than coordinating to
          avoid it, and unlike a cron job it needs nothing deployed alongside.
    - [x] The timer is **unref'd**. Housekeeping must never be the reason the
          process stays alive, and a referenced timer would hold the test suite
          open for up to an hour.
    - [x] A failed sweep is logged and the next one is scheduled anyway. There is
          no state to lose, and the following sweep is under an hour away.
    - [x] The store moved from a `new` in `bootstrap.ts` to a provider, so the
          sweeper gets the same instance and Nest's lifecycle starts and stops it.
          `@Optional()` on the injected random function, or Nest tries to resolve
          `Function` from the container and refuses to boot.
    - [x] Tested, which the sweep never was — that is a fair part of how it came
          to be dead code. Six unit specs on the schedule (including that the
          delay really is redrawn each time, which a `setInterval` would fail) and
          three against a real database on `pruneExpired` itself.
      - [x] The unref assertion was vacuous when first written — it only checked
            that `setTimeout` returned something. Rewritten to spy on the timer,
            and confirmed by deleting the `unref()` call and watching it fail.
- [x] `AuthGuard` (is anyone logged in?) and `AdminGuard` (is it the admin?), plus a
      `@CurrentUser()` param decorator.
- [x] Ownership checks: you may only edit or delete your own posts; an admin may touch
      anything. Enforced in `PostsService`, not a guard — a guard would have to load
      the post to learn who owns it, and then the handler would load it again.
- [x] CSRF: since auth rides on a cookie, require a custom header on all mutating
      requests, or issue a double-submit token. `SameSite=Lax` alone is not enough.
- [x] Rate-limit login and registration. **Not** with `@nestjs/throttler`: its
      current release (6.5.0) declares peer support only up to `@nestjs/common ^11`,
      so it refuses to install against Nest 12. Replaced by a ~50-line in-process
      fixed-window `RateLimitGuard`. Per-instance and memory-backed, so swap in a
      shared store before running replicas.
- [x] Account editing: change bloog title, change password (requires the current password).
- [x] Regenerate the session id on login, so a token planted before login cannot be
      upgraded to an authenticated one (session fixation).
- [x] Re-read the user from the database on every guarded request rather than trusting
      the session payload, so a deleted or demoted account loses access at once.
- [x] Extract `configureApp()` so tests boot the same app main.ts does -- session
      middleware and global guards included.

## 6. API

- [x] Validation via a small `SchemaValidationPipe` against the schemas in
      `packages/shared`, rather than `class-validator`. Zod strips unknown keys from
      object schemas by default, which gives the same protection `whitelist: true`
      would -- covered by a test that a smuggled `isAdmin` field cannot reach the entity.
      This keeps one schema shared by the API and the SPA instead of two definitions.
  - [x] **Rewritten when the OpenAPI work landed.** It used to be constructed per
        route -- `@Body(new ZodValidationPipe(loginSchema))`. It is now registered
        once, globally, and reads the schema from `ArgumentMetadata.schema`, which
        Nest 12 carries there from `@Body({ schema: loginSchema })`. One
        declaration validates _and_ documents the endpoint; the alternative was
        naming the schema twice per route and letting the two drift.
  - [x] It speaks Standard Schema rather than zod, which is why it is no longer
        called `ZodValidationPipe`. The schemas are still zod.
- [x] Response schemas in `packages/shared/src/responses.ts`, with the wire types
      in `types.ts` inferred from them, so the types, the generated documentation,
      and the conformance test all come from one declaration.
  - [x] The trick that makes this free for the browser: `types.ts` imports the
        schemas with `import type`, so the emitted `types.js` is literally
        `export {}` and `contracts.ts` stays zod-free. Verified -- the bundle went
        from 291 kB to 289.77 kB, and there is no zod in it.
  - [x] `Page<T>` stays a hand-written generic interface. `pageSchema()` is a
        function, so there is no single schema to infer a generic from.
  - [x] Nothing validates responses on the way out. `test/response-shapes.spec.ts`
        parses real responses through the schemas and compares the parsed value
        against the original, which catches an unexpected field as well as a
        missing one, and keeps the cost off the request path.
- [x] Consistent error shape via an exception filter. `ApiExceptionFilter` gives
      every failure `{ statusCode, error, message }`, plus `errors` when the
      failure was per-field validation. The shape is `errorResponseSchema` in
      @blooger/shared, so the SPA types against it and /api/docs publishes it.
  - [x] It was worth doing because the shape genuinely varied: a string argument
        to an exception yields `{ statusCode, error, message }`, an object
        argument replaces that wholesale -- so validation failures, the most
        common error in the app, were arriving with no `statusCode` at all.
  - [x] Anything that is not an `HttpException` is logged with its stack and
        reported as a bare "Internal server error". An exception message can
        carry a query, a path, or a name that is nobody's business.
  - [x] The reason phrase comes from `HttpStatus[status]`, not a hand-kept table
        that would be missing whichever status someone adds next.
  - [x] The rate limiter's `retryAfterSeconds` body field is gone; it sets a
        `Retry-After` header instead. Nothing read the field, and it made one
        endpoint's errors a different shape from every other endpoint's.
- [ ] Endpoints:
  - [x] `POST /api/users` (register), `GET/PATCH /api/account`.
  - [x] `POST /api/sessions` (login), `DELETE /api/sessions` (logout), `GET /api/me`.
  - [x] `GET /api/bloogs` — paginated list of all bloogs.
  - [x] `GET /api/bloogs/:username` — one bloog plus a page of its posts.
  - [x] `GET /api/posts` — site-wide recent posts, paginated (drives the homepage).
  - [x] `GET /api/posts/:id`, `POST /api/posts`, `PATCH /api/posts/:id`, `DELETE /api/posts/:id`.
  - [x] `GET /api/admin/users`, `DELETE /api/admin/users/:id`, `GET /api/admin/posts`.
- [x] Markdown: store the raw Markdown, render to HTML server-side with `markdown-it`,
      sanitize with `sanitize-html`, and return both `body` and `bodyHtml`.
  - [x] One `MarkdownService` used by both the API and (later) the feed generator, so
        there is a single place where sanitization happens. This is the XSS-critical
        path — the Rails version leaned on `rails_xss` for the same reason.
  - [x] Defends twice: `html: false` makes markdown-it escape raw HTML in the source,
        and sanitize-html then filters the generated tree against an allowlist.
  - [x] Caught by test: `simpleTransform` adds `rel`/`target` to links, but
        sanitize-html strips them straight back off unless they are also in
        `allowedAttributes` — the filter runs _after_ the transform.
  - [x] Also learned: markdown-it's own `validateLink` already refuses
        `javascript:` and `data:` targets, so those never even become anchors.
  - [x] **Investigated DOMPurify as a third layer. Decision: no.** It is the most
        battle-tested HTML sanitizer there is, hardened against mutation-XSS
        (mXSS) -- the class of bug where a parser re-reads its own serialized
        output and produces different markup the second time. sanitize-html makes
        weaker claims there. It still does not earn a place here, and the
        measurements are below so the decision can be revisited on evidence
        rather than re-argued.
    - [x] **It would change nothing.** 20 payloads through the real pipeline --
          the existing spec's plus seven classic mXSS vectors: 0 produced
          anything dangerous, and 0 changed at all when serialized, re-parsed and
          re-serialized. There is no mutation to defend against.
    - [x] **The reason is `html: false`, not the allowlist.** Every mXSS vector
          depends on an element whose content is parsed in a foreign context --
          `noscript`, `style`, `svg`, `math`, `template`, `xmp`. markdown-it
          escapes them in the source, so what reaches sanitize-html is already
          text and there is nothing for a second parse to reinterpret. The
          conclusion holds only while `html` stays false.
    - [x] **It would actively regress the app.** DOMPurify changed 4 of the 20
          outputs, and every change was the same one: it strips `target="_blank"`
          by default. `MarkdownService` deliberately adds it alongside
          `rel="nofollow noopener noreferrer"`, and there is a test asserting
          exactly that -- so a naive third pass fails the suite on day one.
          Fixable with `ADD_ATTR: ['target']`, but a sanitizer that has to be
          talked out of its own defaults is not the free win it looks like.
    - [x] **Library against library, my corpus cannot separate them.** Fed raw
          HTML with `html: true` and a deliberately generous allowlist -- the
          scenario where the sanitizer is the only defence -- sanitize-html
          leaked 0 of 19 and DOMPurify leaked 0 of 19. Said plainly: these are
          known, long-patched vectors, so this shows my test set is not
          discriminating, not that the two libraries are equally robust.
          DOMPurify's real advantage is the attention it gets from researchers,
          which no 20-payload harness can measure.
    - [x] Cost, client-side: 28.7 kB minified, 10.7 kB gzipped, against a bundle
          that is 89.74 kB gzipped today. A 12% increase.
    - [x] Cost, server-side: DOMPurify needs a DOM, so Node pulls in jsdom -- 8.3
          MB on disk for jsdom alone. The extra pass measured 0.201 ms against
          0.062 ms for the entire current render, so it would more than quadruple
          the cost of rendering a post.
    - [x] **Instead of the dependency, the evidence became tests.** The mXSS
          corpus is now seven cases in `markdown.service.spec.ts`, and three of
          the vectors went into the Playwright XSS spec, where a real browser's
          parser is the judge -- which is the only thing that can actually rule
          on a mutation, since a string comparison by definition cannot see one.
          If `html: true` is ever set, those fail rather than production.
    - [x] Closed. What would reopen it, specifically -- conditions to notice, not
          work to schedule:
      - Turning `html: true` on, for embeds or anything else. That deletes the
        entire argument above in one line.
      - A second source of HTML reaching the SPA -- comments, an imported feed,
        anything not produced by `MarkdownService`. Then client-side DOMPurify at
        the point of injection in `PostBody` covers a surface the server-side
        sanitizer never sees, and 10.7 kB is cheap for it.
      - Caching rendered HTML. The 4x render cost is the main objection to the
        server-side placement, and it mostly disappears if the output is computed
        once rather than per request.
- [x] Swagger via `@nestjs/swagger` at `/api/docs`, raw document at
      `/api/docs-json`. 23 operations, 13 named response models.
  - [x] **No DTO classes and no `@ApiProperty()`.** @nestjs/swagger 12 reads
        Standard Schema, and zod 4 implements it, so the zod schemas already in
        `packages/shared` are the input. This is the thing that made the whole
        item cheap; the usual advice for zod-based Nest projects (`nestjs-zod`,
        hand-written `@ApiBody({ schema })`) is out of date.
  - [x] Request bodies and query strings need no decorator at all: Nest 12 carries
        the schema from `@Body({ schema })` through to the generator. Only
        responses need `@ApiOkResponse({ standardSchema: ... })`.
  - [x] Response schemas got named components via a `standardSchemaConverter`
        backed by a zod registry, so `PostSummaryPage.items` refers to
        `PostSummary` instead of inlining it for the sixth time. 27 kB of JSON
        rather than a document where every model is spelled out at each use.
    - [x] Query schemas must _not_ be named. The generator decomposes their
          properties into individual query parameters and cannot do that through
          a `$ref`, so the converter only rewrites `output` schemas -- which is
          what `schemaType` is for.
  - [x] Two bugs the tests caught, both invisible by eye:
    - [x] `addCookieAuth`'s first argument names the _cookie_; the third names the
          _scheme_. Without the third, every protected route required a scheme
          called `blooger.sid` while the only declared one was called `cookie`,
          and Swagger UI's Authorize button did nothing. There is now a test that
          every security requirement and every `$ref` resolves.
    - [x] `@ApiProduces(ATOM)` on the feed routes applied to _all_ their
          responses, so the document claimed a 404 would arrive as
          `application/atom+xml`. Content type belongs on the success response.
  - [x] Boring but real: `docs/openapi.ts` naming the session cookie meant
        importing a constant from `bootstrap.ts`, which imports the docs setup --
        an ESM cycle, and the description is a top-level template literal, so it
        blew up with "Cannot access 'SESSION_COOKIE_NAME' before initialization"
        at boot. The constants moved to `auth/session.constants.ts`.
- [x] Bloog listings avoid the obvious N+1: post counts and latest-post timestamps
      for a whole page of users come from one grouped query, not one count per user.

## 7. Feeds

- [x] Use the `feed` package to emit Atom 1.0, RSS 2.0, and JSON Feed from one definition.
- [x] `GET /feed.atom`, `/feed.rss`, `/feed.json` — site-wide recent posts.
- [x] `GET /bloogs/:username/feed.atom` (and `.rss`, `.json`) — one bloog.
- [x] Correct `Content-Type` on each, absolute URLs throughout, and stable entry ids.
- [x] `<link rel="alternate">` tags in the SPA's `index.html` for the site-wide feeds.
  - [x] Per-bloog autodiscovery: the bloog page injects its own `<link rel="alternate">`
        while it is mounted, and removes it on unmount.
- [x] Test that the output actually parses as well-formed XML — the Rails version's
      Cucumber suite checked exactly this, and it's an easy thing to silently break.
      `fast-xml-parser`'s validator stands in for Nokogiri.
- [x] Feeds are served outside the `/api` prefix, via `setGlobalPrefix`'s `exclude`.
      That list has to stay in step with `FeedsController`, so a test fetches every
      feed route and also asserts they are _not_ reachable under `/api`.
- [x] Checked the CDATA escape hatch: a body containing `]]>` would end the CDATA
      section early and let the rest be parsed as markup. Two independent things
      stop it — markdown-it escapes `>` to `&gt;` well before this point, and the
      `feed` library splits any literal `]]>` into `]]]]><![CDATA[>`. There is a
      test that drives the whole chain rather than either half.
- [x] Feed entries carry the same sanitized HTML the API serves, from the one
      `MarkdownService`, so a reader and the site can never disagree.
- [x] Caching rendered feeds. Done with HTTP caching rather than an in-process
      cache, so the browser, the reader, and any CDN in front of us do the work.
      Nothing to invalidate, nothing to size, nothing to go stale in a way we have
      to reason about. Every feed route sends:

  ```
  Cache-Control: public, max-age=300, s-maxage=900, stale-while-revalidate=3600
  ```

  - [x] The ETag was already there -- Express computes a weak one from the body
        and answers `If-None-Match` with a 304 by itself. So the missing piece
        was only `Cache-Control`; a hand-rolled ETag would have been rewriting
        what the framework already does.
  - [x] **Feeds now skip the session middleware entirely.** This is the part that
        made `public` safe. `rolling: true` re-sends an existing session's cookie
        on every request it touches, so a logged-in reader fetching /feed.atom
        got a `Set-Cookie` on the response. Marking that `public` invites a shared
        cache to store one person's session and hand it to the next visitor. Most
        CDNs decline to cache a response carrying Set-Cookie, but that is a
        convention, not a boundary. It also means a feed request no longer touches
        the session store at all.
  - [x] **Bug found by the 304 test: the empty Atom feed was not byte-stable.**
        Atom requires a feed-level `<updated>`, and the `feed` package substitutes
        `new Date()` when given none -- at millisecond resolution. So an empty feed
        differed on every request, its ETag never matched, and a reader polling an
        empty bloog (there is a seeded one, `quiet`) re-downloaded it forever. RSS
        and JSON Feed do not show the field, which is how it went unnoticed. Empty
        feeds now use the epoch: there is no content, so there is no date on which
        the content last changed.
    - [x] The comment in the code claimed `updated` was "absent when there are no
          posts, which readers handle fine". It was not absent. It was `now`.
  - [x] The general rule this leaves behind: **feed output must be derived from
        content, never from the clock**, or the ETag cannot do its job. Tested by
        fetching twice and comparing bytes, and confirmed by reverting the fix and
        watching three specs fail.
  - [x] Not doing an in-process render cache. It would only pay off under traffic
        that a CDN absorbs first, and it would introduce invalidation -- the thing
        HTTP caching lets us not have.

## 8. Frontend

- [x] Vite + React 19 + TypeScript, Tailwind v4 via `@tailwindcss/vite`.
- [x] react-router for routing; TanStack Query for server state, so caching and
      refetch-after-mutation don't get hand-rolled.
- [x] Pages:
  - [x] `/` — recent posts across all bloogs, newest first, with an "older entries"
        link at the bottom.
  - [x] `/bloogs` — every bloog. Empty state: "There are no bloogs yet."
  - [x] `/bloogs/:username` — one bloog's posts, paginated.
  - [x] `/bloogs/:username/posts/:id` — a single post.
  - [x] `/register`, `/login`, `/account`.
  - [x] `/posts/new`, `/posts/:id/edit`.
  - [x] `/admin` — users and posts, admin only.
- [x] Auth-aware shell: header reflects logged-in state; protected routes redirect to login.
- [x] Render `bodyHtml` from the server rather than parsing Markdown in the browser —
      one renderer, one sanitizer, no second attack surface.
- [x] Loading, empty, and error states for every list.
- [x] Dark mode, since Tailwind makes it nearly free.
- [x] **Terminal theme.** Restyle the site after the colours and font of the author's
      terminal, sampled from a screenshot rather than guessed at.
  - [x] Palette, read out of the screenshot pixel by pixel: canvas `#FFFFFF`,
        surface `#F0F0F0`, line `#E8E8E8`, ink `#1E1E1E`, dim `#606060`,
        faint `#A2A2A2`, blue `#5062F7`, amber `#916515`, cyan `#00BFFF`.
  - [x] Two of those fail on the web and must not be used verbatim: `#A2A2A2` is
        2.55:1 against white and `#00BFFF` is 2.12:1, both below WCAG AA. Darken the
        muted grey for anything readable; keep cyan for fills only.
  - [x] JetBrains Mono from Google Fonts, everything monospace including post bodies.
    - [x] Monospace prose is measurably harder to read at length, which normally
          matters a great deal for a blog. Closed as a non-issue by decision: this
          is a proof of concept, not something people will read daily. Line-height
          1.75 and a 72ch measure are in place regardless. Revisit only if the
          project ever stops being a practice exercise.
  - [x] Derive a dark variant by inverting the greyscale ramp and lifting the blue
        and amber until they clear 4.5:1 on the dark ground.
  - [x] The terminal palette contains no red. Seeing it on screen settled it:
        errors and destructive actions both use a red that is deliberately _not_
        sampled -- ANSI red `#CC0000` in light, ANSI bright red `#FF5555` in dark,
        both comfortably past 4.5:1 in either theme.
    - [x] The terminal's ochre is therefore unused and its token was removed rather
          than left as dead CSS. The value is recorded in the comment in `index.css`
          so it can come back if a genuine warning tier ever appears -- something
          that is neither an error nor destructive.
  - [x] Drive the tokens through CSS custom properties with Tailwind's `@theme
inline`, so light and dark are one set of names and not two sets of classes.
  - [x] Verified in a browser in both themes. A contrast audit against the live
        page found zero WCAG AA failures: the lowest is 4.54:1 in light (the
        darkened muted grey, passing by design) and 5.51:1 in dark.
  - [x] Caught only by loading the page: `bg-white` survived the palette sweep
        because it was not adjacent to its `dark:` partner in the class string, so
        the background stayed white while the text went light and the page was
        nearly unreadable. Every test still passed.
  - [x] Primary buttons use `text-canvas`, not `text-white`. White on the lifted
        dark-mode blue is only 3.03:1; inverting with the theme holds it at 5.5:1.
- [x] Nest serves the built SPA in production, with a fallback so a hard refresh on
      a client-side route works. Both handlers are registered before Nest's router;
      the fallback passes through `/api/*` and anything with a file extension, so
      `/bloogs/joe/feed.atom` is never answered with an HTML page.
- [x] An unmatched `/api` path now answers with JSON. It has to be registered
      _after_ `app.init()` — middleware added earlier runs before the router and
      cannot tell a miss from a hit — otherwise Express's default handler replies
      with an HTML page that a JSON client has to parse to discover it got a 404.
- [x] The API client bootstraps and refreshes its own CSRF token, so a mutation
      never depends on some component having mounted `useSession()` first, and a
      token invalidated by session regeneration is retried once rather than failing.
- [x] **Bundle:** the SPA imports `@blooger/shared/contracts`, not the package root.
      Importing the root pulled in ~890 kB of zod source for the sake of three
      numeric constants — the schemas are top-level `z.object(...)` calls evaluated
      at import, which a bundler cannot prove are side-effect free. Splitting the
      package took the bundle from 751 kB to 291 kB (180 kB to 90 kB gzipped).
- [x] **`packages/shared` is ESM.** It was the only CommonJS workspace, and its
      `__exportStar` re-exports defeat static named-export analysis: Vite's dev
      server failed with "does not provide an export named 'CSRF_HEADER'" and the
      page rendered blank. Only the browser caught it — the unit tests resolve
      through Vitest's own pipeline and the production bundler papered over it.
- [ ] Consider code-splitting the admin route; it is the only page most visitors
      will never open.

## 9. Testing

- [x] Vitest configured for both workspaces.
  - [x] No SWC plugin needed: Vite 8 transforms via Oxc, which supports
        `emitDecoratorMetadata`. Verified by a passing Nest/TypeORM entity test.
  - [x] `vite-tsconfig-paths` is obsolete too -- Vite 8 has `resolve.tsconfigPaths`.
- [x] Unit tests with no database: password hashing, Markdown rendering and
      sanitization, feed XML generation, pagination math.
  - [x] Password: that the digest carries the OWASP parameters (so raising the
        cost cannot pass unnoticed), that it salts, and -- the one that matters --
        that `verifyPassword` returns false rather than throwing on a malformed
        digest. Login compares an unknown username against a dummy hash to even
        out the timing; if a bad digest threw, that path would 500 and the
        endpoint would be the username oracle the dummy hash exists to prevent.
  - [x] Feeds: the services are stubbed, so this can ask what the integration
        specs cannot set up cheaply -- an empty feed, and a trailing slash on
        `APP_URL`. Byte stability is asserted directly here as well as through
        the ETag.
  - [x] Pagination: the boundaries. No page invented when the count divides
        exactly, one empty page rather than zero when there is nothing, and the
        query schema coercing the strings a query string actually delivers.
  - [x] `buildPage` lives in `packages/shared`, which has no suite of its own --
        it is types, schemas, and this one piece of arithmetic. The tests sit in
        `apps/api`, the only workspace that calls them at runtime and the only one
        CI already runs. Give the shared package its own suite when it grows a
        second thing worth testing.
- [x] Integration tests against a real MySQL `blooger_test`.
  - [x] Migrated once per run by a Vitest `globalSetup`.
  - [x] **Correction to the original plan.** Transaction-per-test cannot work for
        HTTP-level tests: each request takes an arbitrary connection from the pool,
        so a transaction opened on one QueryRunner is invisible to the code under
        test. `test/harness.ts` therefore provides both -- `truncateAll()` for
        full-stack tests (the honest choice, if slower) and `withRollback()` for
        service-level tests, where handing the code the QueryRunner's EntityManager
        is straightforward.
  - [x] `TRUNCATE` runs on one pinned QueryRunner, because `FOREIGN_KEY_CHECKS` is
        session-scoped and would otherwise land on a different pooled connection
        than the truncates it is meant to cover.
  - [ ] Migrate once at suite start.
  - [ ] Per-test transaction on a single shared `QueryRunner`, rolled back in `afterEach`.
  - [ ] Override the Nest `DataSource`/`EntityManager` provider so code under test uses
        that same QueryRunner — otherwise it opens its own connection and sees none of
        the test's uncommitted data. This is the one fiddly part of the strategy.
  - [ ] Watch out: DDL inside a test commits implicitly in MySQL and breaks the rollback.
- [x] HTTP tests with Supertest: 26 auth specs covering registration, duplicate and
      case-duplicate usernames, CSRF rejection, login, the username-enumeration
      guarantee, session fixation, cookie flags, rate limiting, logout, and account
      edits. Ownership rules and feed content types come with those features.
  - [x] Gotcha worth remembering: supertest's agent attaches its cookie jar when the
        request object is _constructed_, so a CSRF token must be fetched into a
        variable before building the request that carries it.
- [x] React component tests with Testing Library + jsdom: 27 specs over the API
      client, the home page, the auth-aware shell, login, and route guarding.
      `fetch` is stubbed by a small in-repo router rather than MSW, which keeps the
      test set-up to one file; revisit if the fixtures get unwieldy.
- [x] Verified in a real browser: rendering, login, post authoring, and that a
      `<script>` in a post body reaches the DOM as inert text — 0 script elements
      and 0 `on*` attributes inside the rendered body.
- [x] Note for the Playwright suite: driving the forms through the Chrome
      extension did not work, in two distinct ways.
  - [x] Setting an input's value through the DOM does not drive a React controlled
        input -- React never sees an `onChange`, so component state stays empty and
        the form submits blanks. The workaround is the native value setter plus a
        synthetic `input` event; Playwright's `fill()` does the right thing itself.
        Confirmed: `fill()` drove every form in the suite first time.
  - [x] Synthetic keystrokes never reached the page at all: the field took focus
        but its value stayed empty. Reproduced in a clean Chrome profile with no
        extensions installed, so this is not extension interference -- an earlier
        guess that Grammarly and 1Password were swallowing the input was wrong.
- [x] Playwright, four flows only. Chromium only: this proves the stack fits
      together, it is not a browser-compatibility matrix.
  - [x] Register → publish a post → see it on the homepage → fetch the Atom feed.
  - [x] Admin logs in and reaches `/admin`.
  - [x] A normal user is refused -- and the assertion that matters is that
        `/api/admin/users` answers 403, not that the nav link is hidden. Hiding
        the link proves nothing; `AdminGuard` is the boundary.
  - [x] A `<script>` in a post body reaches the DOM as inert text: no `script`
        element, no `on*` attribute, no `javascript:` href, and `window.__pwned`
        still undefined. The jsdom specs cannot prove that last one.
- [x] `playwright.config.ts` runs the pair on **3100 and 5273**, not 3000 and 5173.
      Two reasons, both real: the suite can run beside `npm run dev`, and it can
      never silently attach to a development API pointed at `blooger_dev` and
      rewrite real data. `vite.config.ts` reads `WEB_PORT` and `API_ORIGIN` to
      make that possible, with `strictPort` so a busy port fails loudly instead of
      sliding to the next one and leaving Playwright waiting on nothing.
- [x] `reuseExistingServer: false`. The rate limiter counts in process memory, so
      a server left over from an earlier run starts the suite part-way through its
      window.
- [x] Retries capped at 1 in CI, for the same reason: registration allows 5
      attempts per minute per IP and login 10, and every request here comes from
      127.0.0.1. A generous retry budget turns one flake into a wall of 429s.
- [x] **The trap this cost an hour on: `tsx` cannot run the Nest app.** It
      transforms with esbuild, which does not implement `emitDecoratorMetadata`,
      so constructor injection resolves every dependency to `undefined` and the
      first guarded request dies with "Cannot read properties of undefined
      (reading 'getAllAndOverride')" from inside `RateLimitGuard`. The webServer
      command is `nest start`. The seed and the TypeORM CLI stay fine under `tsx`
      because neither goes through Nest's DI, and no column type here is inferred
      from reflected metadata.
- [x] Dev mode, not production, and not by preference: `main.ts` only serves the
      SPA itself when `NODE_ENV` is production, and a production session cookie is
      `secure`, which plain http drops. A single-origin production run therefore
      cannot log anybody in locally.
- [x] `e2e/global-setup.ts` shells out to the repo's own `migration:run` and
      `seed`, so the suite prepares its database exactly the way a developer does.
      One worker, no truncation between specs, so registrations use
      `uniqueUsername()`; a fixed name passes on a fresh database and fails with
      "already taken" on the second run.
- [ ] CI-ready: one command that boots MySQL, migrates, and runs everything.
      `npm run test:e2e` is that command for the browser flows; `npm test` still
      expects MySQL to be up already.

## 10. Documentation

- [x] Add a `LICENSE` file. **MIT**, matching the `license` field `package.json`
      already declared.
  - [x] **MIT is the one to pick**, unless there is a reason not to. `package.json`
        already declares `"license": "MIT"`, so right now the repo claims a licence
        it does not ship — that inconsistency is the actual bug here.
  - [x] The choice genuinely does not matter much for this project, and the reason
        is worth writing down once: MIT and BSD-2-Clause are the same licence in
        different words. BSD-3-Clause adds a no-endorsement clause. Apache-2.0 is
        the only one that differs substantively — it grants patent rights
        explicitly and terminates them if you sue over patents. That matters for a
        project expecting corporate contributors or containing patentable ideas,
        and not at all for a blogging engine written for practice.
  - [x] Whichever is chosen, keep the `LICENSE` file, the `license` field in
        `package.json`, and the footer in `README.md` saying the same thing.

- [x] `README.md` — what the project is, the stack, and how to get it running from a
      cold clone. Aim it at a developer who has just cloned the repo and has none of
      this set up; assume nothing.
  - [x] **Prerequisites**, each with the version actually required and why:
        nvm, Node 24.20.0 (in `.nvmrc`; `nvm install` reads it), and Docker Desktop.
        Note that no local MySQL client is needed — `npm run db:shell` goes through
        the container.
  - [x] **Start Docker Desktop first.** This is the step that will actually bite
        people: `npm run db:up` fails with "Cannot connect to the Docker daemon" if
        the app is not already running, and the message does not say to launch it.
        On macOS that is `open -a Docker`, then wait for the whale icon to settle.
  - [x] The cold-start sequence, in order, as copy-pasteable commands:
        `nvm install && nvm use` → `npm install` → `cp .env.example .env` →
        `npm run db:up` → `npm run migration:run` → `npm run seed` → `npm run dev`.
  - [x] Say what each step is for, not just what to type — particularly that
        `db:up` blocks until MySQL reports healthy, and that `migration:run` is
        separate on purpose because migrations never run automatically on boot.
  - [x] What you get at the end: the SPA on http://localhost:5173, the API on
        :3000, and the seeded accounts (`admin`, `joe`, `jane`, `quiet`) all with
        the password `password123`. Say plainly that these are development fixtures.
  - [x] `npm run db:reset` as the "I have broken my database" escape hatch, and what
        it destroys.
  - [x] A note that npm 11 declines to run install scripts for `argon2` and
        `@swc/core`. Both ship prebuilt binaries and work anyway, so the warning is
        expected and needs no action — worth saying, because it looks alarming.
  - [x] **How to run every kind of test**, and what each needs:
    - [x] `npm test` — everything. `npm run test:api` and `npm run test:web` for one
          workspace; `npm run test:watch` inside a workspace while developing.
    - [x] The API suite needs MySQL up: it migrates `blooger_test` once per run and
          truncates between tests. It will not touch `blooger_dev`, but say so
          explicitly, because that is the first thing a reader worries about.
    - [x] The web suite is jsdom-only and needs no database or servers.
    - [x] `npm run test:e2e` for Playwright, once it exists, including the
          `npx playwright install` step people forget.
    - [x] `npm run typecheck`, `npm run lint`, and `npm run build` — the same
          commands CI should run.
  - [x] A short troubleshooting section for the failures actually seen while
        building this: the Docker daemon being down, port 3306 already taken by a
        local MySQL, and a stale `packages/shared/dist` after switching branches
        (`npm run build:shared`).
  - [x] Verified by running the documented cold-start sequence verbatim against a
        destroyed volume: db:up, migration:run, seed. The seeded-account table in
        the README was checked against what the seed actually produces.
- [x] `CLAUDE.md` — the conventions stated as rules, plus the traps that have
      already been hit once: the TypeORM 1.x query style, `Relation<T>`, no
      eager/lazy relations, migrations never auto-run and `synchronize` never true,
      that `MarkdownService` is the only place user input becomes markup, the two
      test-isolation strategies and when each applies, and the shared package's two
      entry points.
  - [x] Every factual claim in it was checked against the code rather than written
        from memory — file paths, exported names, guard registration, and config
        values all verified.
- [x] Keep this TODO.md updated as things land.

## 11. Continuous integration

- [x] GitHub Actions running on every push to `main` and every pull request. The
      repo is public and nothing currently runs on a PR — this is the largest gap
      left in the tooling.
- [x] Three jobs, so a failure names itself instead of hiding inside one long log:
  - [x] **Static** — `format:check`, `lint`, `typecheck`, `build`. No database.
  - [x] **Web tests** — `test:web`. jsdom only, needs nothing.
  - [x] **API tests** — `test:api`, against a real MySQL.
- [x] Every job must run `npm run build:shared` first. `@blooger/shared` is
      consumed through `dist/`, and without it the others fail with
      "Cannot find module '@blooger/shared'" rather than anything informative.
- [x] Boot MySQL with the repo's own `docker compose` file (`npm run db:up`)
      rather than an Actions service container. The compose file already carries
      the healthcheck that `--wait` blocks on and the init script that creates
      `blooger_test`; a service container would silently skip both and need them
      restated in YAML, where they would drift from what developers run.
- [x] Supply the environment as job-level `env:` rather than writing a `.env`.
      `loadEnv` reads `process.env` and dotenv does not overwrite what is already
      set, so real variables win and CI never keeps a fixture file on disk.
- [x] Pin Node with `node-version-file: .nvmrc`, so CI and developers cannot drift.
- [x] Cancel superseded runs (`concurrency` with `cancel-in-progress`); a new push
      to a PR makes the in-flight run answer a question nobody is asking.
- [x] `permissions: contents: read` — the workflow only needs to read the code.
- [x] Add the status badge to `README.md`.
- [x] A fourth job for Playwright, added with the suite itself: installs Chromium
      with `--with-deps`, boots MySQL, and uploads the HTML report as an artifact
      when it fails.
  - [x] No job-level `NODE_ENV` on that one. `playwright.config.ts` sets it for
        the API server and the global setup sets it for the migration and the
        seed; setting it job-wide would also hand it to the Vite dev server,
        which has no business being told this is a test run.
- [x] Green on the first run: static 24s, web 20s, API 1m9s — 108 API specs and
      27 web specs, the same counts as locally. Two things that could have bitten
      did not: the runner's own MySQL does not hold port 3306, and `argon2`
      resolves its prebuilt Linux binary even though npm skips its install script.
- [x] `npm run db:logs` is wrong for the failure-diagnostic step — it follows the
      log and would hang the job forever. The step calls `docker compose logs`
      with `--tail` directly.

## 12. Out of scope

Not being built. Listed so they don't get silently forgotten, and so nobody
mistakes their absence for an oversight.

- Comments on posts.
- Tags (many-to-many — the one relation shape this schema won't teach).
- Post drafts and URL slugs.
- Full-text search.
- Image uploads.
- Server-side rendering, if SEO ever matters.
- Deployment (the Rails version ran on Heroku).
