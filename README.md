# FranchiseTracker

A Football Manager style front end for a Madden franchise, without the game. Screenshots and photos go in from your phone, structured stats, records, history and narrative come out.

- Product spec: [docs/FEATURES.md](docs/FEATURES.md)
- Build order: [docs/SPRINTS.md](docs/SPRINTS.md)
- Working rules for contributors and agents: [CLAUDE.md](CLAUDE.md)

Stack: Vite + React 19 + TypeScript, TanStack Router and Table, Tailwind v4 with shadcn-style primitives, Convex backend (database, file storage, actions, HTTP endpoints), OpenRouter vision models for extraction, ESPN for headshots and logos, an Apple Shortcut as the phone capture path. Installable as a PWA on the Mac and the iPhone home screen.

## Getting started

```bash
npm install
npx playwright install chromium webkit   # once, for the browser tests
npm run use:local  # local Convex backend on this machine, pushed and seeded
npm run dev        # Convex + Vite on http://localhost:5173
```

`npm run use:cloud` switches to the shared cloud dev deployment (for trying the app on a phone). Open `/dev/components` for the component gallery.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Convex dev and Vite together |
| `npm run check` | Typecheck, lint, unit and Convex tests |
| `npm run test:e2e` | Playwright smoke tests against a local stack, desktop and two phone sizes |
| `npm run check:all` | Both of the above; what CI runs on every PR |
| `npm run build` | Typecheck and build the PWA into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run deploy` | Deploy Convex to production and build the front end against it |
