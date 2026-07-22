# TrackForge

Figma for race tracks — design tracks with splines, drive them instantly, publish, and share a link, all in the browser.

See [`PROJECT_PLAN.md`](./PROJECT_PLAN.md) for the full architecture and [`TASKS.md`](./TASKS.md) for milestone progress.

## Getting started

```bash
docker compose up -d      # local Postgres for dev
cp .env.example .env      # if .env doesn't already exist
npm install
npx prisma migrate dev
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).
