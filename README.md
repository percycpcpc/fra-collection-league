# FRA Collection League

A friendly, login-free registry for tracking Reality Fracture card collections and building decks against each player's owned pool. The shipped `data/catalog.json` is the read-only card reference; player data is stored in Cloudflare D1.

## Stack

- **Framework**: Next.js (App Router) via [vinext](https://vinext.dev) on Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite) via Drizzle ORM
- **Deployment**: Cloudflare Workers + CI/CD via GitHub Actions

## Local development

```bash
# 1. Install dependencies
npm install

# 2. Apply migrations to the local D1 database
npm run db:migrate:local

# 3. Start the dev server (vinext / Vite)
npm run dev:vinext
```

Open `http://localhost:3001`.

## Environment variables

### GitHub Actions secrets

Set these in **Settings → Secrets and variables → Actions** on your GitHub repo:

| Secret | Description |
|---|---|
| `CLOUDFLARE_API_TOKEN` | API token with **Edit Cloudflare Workers** permissions. Create at [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens). |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID. Found in the dashboard URL: `dash.cloudflare.com/<account-id>`. |
| `D1_DATABASE_ID` | UUID of the D1 database. Found in `wrangler.toml` → `database_id`, or via `cf d1 list`. |

### Local development

No `.env` file is needed for local dev — the D1 binding is provided by the Vite dev server (workerd). If you need to override anything, create `.dev.vars` (gitignored):

```ini
# .dev.vars — local secrets, never commit this file
# No vars required for basic dev; add any future secrets here
```

## Database

Migrations live in `drizzle/`. Schema is in `src/db/schema.ts`.

```bash
# Generate a new migration after editing the schema
npm run db:generate

# Apply migrations to local D1
npm run db:migrate:local

# Apply migrations to remote (production) D1
npm run db:migrate:remote
```

## Deployment

Pushes to `main` automatically deploy via GitHub Actions (`.github/workflows/deploy.yml`).

To deploy manually:

```bash
# Make sure you're logged in
npx cf auth login

npm run deploy:vinext
```

## First-time setup

```bash
# 1. Create the D1 database
npx cf d1 create fra-db

# 2. Copy the returned database_id into wrangler.toml and package.json db scripts

# 3. Apply initial migrations
npm run db:migrate:remote

# 4. Deploy
npm run deploy:vinext
```
