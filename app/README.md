# Meridio web app

The Next.js front end and pickup server for Meridio. See the [main README](../README.md) for what it does and how to run it.

```bash
npm install
cp .env.local.example .env.local   # fill in STATION_SECRET_KEY and SESSION_SECRET
npm run dev      # http://localhost:3000
npm test         # server and transaction-check tests
npm run lint
npm run build
```
