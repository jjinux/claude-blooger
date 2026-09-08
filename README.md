# Blooger

A small multi-user blogging engine. Everyone who registers gets their own
"bloog": a titled blog with its own posts and its own feed.

It is a TypeScript port of a Rails app of the same name, rebuilt as a way to
practise NestJS, TypeORM, React, and Tailwind on a current stack.

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
npm run test:e2e        # Playwright (see below)
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

**Playwright is not written yet.** When it is, it will need a browser
installed first, which is the step everybody forgets:

```sh
npx playwright install
```

The same three checks CI should run:

```sh
npm run typecheck       # all workspaces
npm run lint            # ESLint
npm run build           # shared, then web, then api
```

`npm run format` rewrites files with Prettier; `npm run format:check` only
reports.

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
