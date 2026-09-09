# Blooger

[![CI](https://github.com/jjinux/claude-blooger/actions/workflows/ci.yml/badge.svg)](https://github.com/jjinux/claude-blooger/actions/workflows/ci.yml)

A small multi-user blogging engine. Everyone who registers gets their own
"bloog": a titled blog with its own posts and its own feed.

It is a TypeScript port of a Rails app of the same name, rebuilt as a way to
practise NestJS, TypeORM, React, and Tailwind on a current stack.

## Motivation

Whenever I learn a new web technology, I like to code the same project: either a
bulletin board or a blog. I always include authentication, because that's a giant
hurdle to have to code, and getting it right tells you a lot about a stack.

This time my goal was to practise Claude Code — which did all the real work —
along with NestJS, TypeORM, and Tailwind.

I'm very impressed with how Claude Code performed. Whether I'll still have a job
in the future or be replaced by an AI remains to be seen :)

> **Claude Code here.** That I did all the real work is generous. He set the
> constraints that shaped this: the TypeORM query style, Conventional Commits, a
> PR workflow, the terminal theme, sweeping sessions in-process on a random
> interval, ETags instead of an in-process cache. Left alone I would have chosen
> differently, or not thought to choose at all.
>
> Two of his standing rules caught more bugs than any amount of my own cleverness:
> keep `TODO.md` honest about decisions that turned out wrong, and verify in a
> real browser. Several things in here passed the whole test suite and the
> production build while being visibly broken.

## What it does

- Register an account and get a bloog of your own.
- Write posts in Markdown. They are rendered and sanitized on the server.
- A homepage of recent posts from every bloog, paginated.
- A directory of all bloogs, and a page per bloog.
- Atom, RSS, and JSON feeds, both site-wide and per bloog.
- An `/admin` section for the administrator.

## Stack

| Layer    | Choice                                                       |
| -------- | ------------------------------------------------------------ |
| Runtime  | Node 24 (pinned in `.nvmrc`)                                 |
| Language | TypeScript 6                                                 |
| API      | NestJS 12 (ESM), TypeORM 1, MySQL 8                          |
| Web      | React 19, Vite 8, Tailwind 4, react-router 8, TanStack Query |
| Auth     | argon2id hashes, server-side sessions in MySQL               |
| Tests    | Vitest everywhere, Supertest for HTTP                        |

Three workspaces, wired together with npm workspaces:

```
apps/api          NestJS JSON API, feeds, and (in production) the built SPA
apps/web          React single-page app
packages/shared   Types and Zod schemas both halves validate against
```

## Getting started

Written for someone who has just cloned this and has none of it set up.

### 1. Prerequisites

- **[nvm](https://github.com/nvm-sh/nvm)** — to get the right Node.
- **[Docker Desktop](https://www.docker.com/products/docker-desktop/)** — MySQL
  runs in a container.

You do **not** need MySQL installed locally. `npm run db:shell` opens a client
inside the container.

### 2. Start Docker Desktop

Do this before anything else. If the daemon is not running, `npm run db:up`
fails with `Cannot connect to the Docker daemon`, and that message does not
mention that you simply need to launch the app.

```sh
open -a Docker      # macOS; then wait for the whale icon to stop animating
```

### 3. Set up and run

```sh
nvm install && nvm use        # reads .nvmrc, installs Node 24.20.0
npm install                   # installs all three workspaces
cp .env.example .env          # dev defaults; works as-is
npm run db:up                 # starts MySQL, waits until it reports healthy
npm run migration:run         # creates the schema
npm run seed                  # loads sample users and posts
npm run dev                   # API on :3000, web on :5173
```

Then open **http://localhost:5173**.

A few of those steps are worth understanding rather than just running:

- `db:up` uses `docker compose up --wait`, so it blocks until MySQL actually
  accepts connections. The next command can rely on that.
- `migration:run` is a separate step on purpose. Migrations never run
  automatically on boot, and `synchronize` is never enabled, in any
  environment. The schema only ever changes through a committed migration.
- `dev` runs the Vite dev server and proxies `/api` to Nest, so the browser
  stays on a single origin and session cookies behave exactly as they will in
  production.

### 4. Log in

Every seeded account uses the password `password123`. These are development
fixtures and nothing more.

| Username | Bloog                  | Notes                      |
| -------- | ---------------------- | -------------------------- |
| `admin`  | The Management's Bloog | Administrator              |
| `joe`    | Joe's Bloog            | 12 posts                   |
| `jane`   | Booger Facts Weekly    | 7 posts                    |
| `quiet`  | An Empty Bloog         | No posts, for empty states |

### About the install warnings

`npm install` prints warnings that it declined to run install scripts for
`argon2` and `@swc/core`. This is expected and needs no action: both ship
prebuilt binaries and work without their install scripts.

## Running the tests

MySQL needs to be running for the API tests. Nothing else does.

```sh
npm test                # everything: 108 API tests, 27 web tests
npm run test:api        # API only
npm run test:web        # web only
npm run test:e2e        # Playwright (see below)  -- needs MySQL too
```

To iterate on one workspace, use watch mode inside it:

```sh
npm run test:watch --workspace @blooger/api
npm run test:watch --workspace @blooger/web
```

**The API suite needs MySQL up.** It migrates the `blooger_test` database once
per run and truncates the tables between tests. It never touches
`blooger_dev`, so your seeded development data survives a test run.

**The web suite needs nothing running.** It is jsdom-only, with `fetch`
stubbed.

**The end-to-end suite needs MySQL and a browser.** Install the browser once —
this is the step everybody forgets:

```sh
npx playwright install chromium
```

Then `npm run test:e2e` does the rest: it migrates and seeds `blooger_test`,
starts the API and the Vite dev server itself, and stops them when it is done.
It runs them on ports 3100 and 5273 rather than the usual 3000 and 5173, so you
do not have to shut down `npm run dev` first — and so it can never end up
talking to a development server pointed at `blooger_dev`.

Four flows, deliberately: register and publish a post and find it in the feed,
an admin reaching `/admin`, a normal user being refused it by the API rather
than only by the UI, and a `<script>` in a post body arriving as inert text.

Do not run `npm run test:api` and `npm run test:e2e` at the same time. Both own
`blooger_test`, and the API suite truncates it between tests.

And the checks that are not tests:

```sh
npm run typecheck       # all workspaces
npm run lint            # ESLint
npm run format:check    # Prettier, report only
npm run build           # shared, then web, then api
```

`npm run format` rewrites the files that `format:check` complains about.

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every push to
`main` and every pull request, in four jobs so a failure names itself:

| Job                            | Runs                                         | Needs            |
| ------------------------------ | -------------------------------------------- | ---------------- |
| Format, lint, typecheck, build | `format:check`, `lint`, `typecheck`, `build` | nothing          |
| Web tests                      | `test:web`                                   | nothing          |
| API tests                      | `test:api`                                   | MySQL            |
| End-to-end tests               | `test:e2e`                                   | MySQL + Chromium |

The two database jobs boot MySQL from this repo's own `docker-compose.yml`, so
they get the same healthcheck and the same `blooger_test` init script you get
locally.
Node comes from `.nvmrc`, so CI cannot drift away from your machine.

Everything CI runs, you can run yourself with the commands above — there is no
step that only exists in the workflow.

## The API

Interactive documentation is at **http://localhost:3000/api/docs** once the API
is running, with the raw OpenAPI 3.0 document at `/api/docs-json`.

It is generated from the same zod schemas that validate the requests, so it
cannot describe a body the server would reject. Every failure shares one shape
(`ErrorResponse`), and the description at the top explains the session cookie and
the CSRF header the SPA sends.

## Database

```sh
npm run db:up           # start MySQL, wait until healthy
npm run db:down         # stop it, keep the data
npm run db:nuke         # stop it and delete the volume
npm run db:reset        # nuke, recreate, migrate, seed
npm run db:shell        # a mysql client inside the container
npm run db:logs         # follow the server log
```

`db:reset` is the escape hatch when the database is in a state you no longer
trust. It **destroys the volume**, so every row in both `blooger_dev` and
`blooger_test` goes with it, and then rebuilds from migrations and the seed.

### Migrations

```sh
npm run migration:generate -- AddSomething   # diff entities against the database
npm run migration:run
npm run migration:revert
npm run migration:show
```

Generated files land in `apps/api/src/database/migrations/`. Read the SQL
before committing it: `migration:generate` writes what it infers, which is not
always what you meant.

## Production

```sh
npm run build
NODE_ENV=production npm start
```

One process on port 3000 serving both the API and the built SPA, with a
fallback so a hard refresh on a client-side route works. Note that
`NODE_ENV=production` marks the session cookie `Secure`, so it will not be set
over plain HTTP — put it behind TLS.

## Troubleshooting

**`Cannot connect to the Docker daemon`** — Docker Desktop is not running.
See step 2.

**`Bind for 0.0.0.0:3306 failed: port is already allocated`** — something else,
probably a locally installed MySQL, already holds 3306. Stop it
(`brew services stop mysql`), or change the host port in `docker-compose.yml`
and `DB_PORT` in `.env` to match.

**`Cannot find module '@blooger/shared'`, or type errors that make no sense
after switching branches** — `packages/shared` compiles to `dist/`, and that
build is stale. Run `npm run build:shared`.

**Tests fail to connect to the database** — `npm run db:up`. The API suite
needs MySQL; the web suite does not.

## Project state

`TODO.md` tracks what is done and what is left, including the reasoning behind
the architectural decisions and the things that turned out to be traps.

## License

MIT. See [LICENSE](LICENSE).
