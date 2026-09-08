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
  - [ ] `npm test` (unit + integration), `npm run test:e2e` (Playwright).
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

- [x] Validation via a small `ZodValidationPipe` against the schemas in
      `packages/shared`, rather than `class-validator`. Zod strips unknown keys from
      object schemas by default, which gives the same protection `whitelist: true`
      would -- covered by a test that a smuggled `isAdmin` field cannot reach the entity.
      This keeps one schema shared by the API and the SPA instead of two definitions.
- [ ] Consistent error shape via an exception filter.
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
  - [ ] **Investigate DOMPurify as a third layer.** It is the most battle-tested
        HTML sanitizer there is, maintained by security specialists and hardened
        against mutation-XSS (mXSS) — the class of bug where a parser re-reads its
        own serialized output and produces different markup the second time.
        sanitize-html is a good allowlist filter but makes weaker claims here.
    - [ ] Decide **where** it goes. Two genuinely different options:
          server-side as a third pass inside `MarkdownService`, or client-side in
          the SPA immediately before `dangerouslySetInnerHTML`. The client-side
          placement is the more valuable one, because it sanitizes at the exact
          point of injection and so also covers HTML that reaches the browser from
          anywhere else (a future comments feature, an imported feed, a bug in the
          API). Doing both is defensible for a genuinely untrusted-input path.
    - [ ] Weigh the server-side cost honestly. DOMPurify needs a DOM, so on Node it
          pulls in `jsdom` (v30) via `isomorphic-dompurify` (v4) or a hand-rolled
          `dompurify` + `jsdom` pairing. That is a heavy dependency and a real
          per-render cost. If rendered HTML ends up cached rather than recomputed
          per request, the cost mostly disappears and this gets easier to justify.
    - [ ] Client-side is much cheaper: `dompurify` (v3) alone in the browser needs
          no jsdom at all. This is probably the place to start.
    - [ ] Check whether it actually catches anything the current two layers miss.
          Run the existing `markdown.service.spec.ts` payloads plus a set of known
          mXSS vectors through both pipelines and compare. If DOMPurify changes
          nothing on realistic Markdown-derived HTML, record that finding and skip
          it rather than adding a dependency for the feeling of safety.
    - [ ] Whatever is decided, keep sanitization in one place. Three scattered
          half-configured sanitizers would be worse than the two well-understood
          ones there are now.
- [ ] Swagger via `@nestjs/swagger` at `/api/docs`.
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
- [ ] Consider caching rendered feeds. Every request currently re-renders up to 20
      post bodies from Markdown; fine at this size, wasteful under real traffic.

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
- [ ] Unit tests with no database: password hashing, Markdown rendering and sanitization,
      feed XML generation, pagination math.
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
- [ ] Note for the Playwright suite: driving the forms through the Chrome
      extension did not work, in two distinct ways.
  - [ ] Setting an input's value through the DOM does not drive a React controlled
        input -- React never sees an `onChange`, so component state stays empty and
        the form submits blanks. The workaround is the native value setter plus a
        synthetic `input` event; Playwright's `fill()` does the right thing itself.
  - [ ] Synthetic keystrokes never reached the page at all: the field took focus
        but its value stayed empty. Reproduced in a clean Chrome profile with no
        extensions installed, so this is not extension interference -- an earlier
        guess that Grammarly and 1Password were swallowing the input was wrong.
- [ ] Playwright, a handful of flows only:
  - [ ] Register → log in → create a post → see it on the homepage → fetch the Atom feed.
  - [ ] Admin logs in, reaches `/admin`; a normal user gets 403.
- [ ] Test factories for users and posts (the `factory_girl` equivalent).
- [ ] CI-ready: one command that boots MySQL, migrates, and runs everything.

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
- [ ] Keep this TODO.md updated as things land.

## 11. Deferred

Explicitly out of scope for v1; listed so they don't get silently forgotten.

- [ ] Comments on posts.
- [ ] Tags (many-to-many — the one relation shape this schema won't teach).
- [ ] Post drafts and URL slugs.
- [ ] Full-text search.
- [ ] Image uploads.
- [ ] Server-side rendering, if SEO ever matters.
- [ ] Deployment (the Rails version ran on Heroku).
