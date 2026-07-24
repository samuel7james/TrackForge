# TrackForge

Design race tracks tile by tile, drive them instantly, publish, and share a link — all in the browser, no account needed.

## Getting started

```bash
docker compose up -d      # local Postgres for dev
cp .env.example .env      # if .env doesn't already exist
npm install
npx prisma migrate dev
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).
