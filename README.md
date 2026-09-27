# FRA Collection League

A friendly, login-free registry for tracking Reality Fracture card collections and building decks against each player’s owned pool. The shipped `data/catalog.json` remains the read-only card reference; player data is stored in PostgreSQL.

## Local development

1. Copy `.env.example` to `.env` and update `DATABASE_URL` if needed.
2. Install dependencies: `npm install`
3. Create/update the database: `npx prisma migrate dev`
4. Start the app: `npm run dev`

Open `http://localhost:3000`.

## Environment variables

- `DATABASE_URL` — PostgreSQL connection URL used by Prisma.

For production, build with `npm run build` and apply migrations with `npx prisma migrate deploy` before starting. A standalone Docker/Railway configuration is included.
