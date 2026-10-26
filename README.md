# FranchiseTracker

A Football Manager style front end for a Madden franchise, without the game. Screenshots and photos go in from your phone, structured stats, records, history and narrative come out.

- Product spec: [docs/FEATURES.md](docs/FEATURES.md)
- Build order: [docs/SPRINTS.md](docs/SPRINTS.md)
- Working rules for contributors and agents: [CLAUDE.md](CLAUDE.md)

Stack: Vite + React 19 + TypeScript, TanStack Router and Table, Tailwind v4 with shadcn-style primitives, Convex backend (database, file storage, actions, HTTP endpoints), OpenRouter vision models for extraction, ESPN for headshots and logos, an Apple Shortcut as the phone capture path. Installable as a PWA on the Mac and the iPhone home screen.

## Getting started

```bash
npm install
npm run dev        # Convex dev deployment + Vite on http://localhost:5173
npm run seed       # first run only: 32 teams, the franchise, seasons 2025 to 2034
```

`npx convex dev` creates `.env.local` on first run. Open `/dev/components` for the component gallery.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Convex dev and Vite together |
| `npm run check` | Typecheck app and Convex, lint, run all tests |
| `npm run build` | Typecheck and build the PWA into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run deploy` | Deploy Convex to production and build the front end against it |
