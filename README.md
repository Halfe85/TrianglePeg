# Triangle Peg

A **2D triangular peg solitaire** game made with Angular, TypeScript, and CSS. Play the classic 15-hole board on desktop or mobile.

## How to play

Jump over an adjacent peg into an empty hole two positions away. The peg you jumped disappears. Keep jumping until only **one peg** remains.

- **New game** — select any of the 15 holes to be the initial empty space.
- **Move** — tap a peg, then tap one of the glowing empty destinations.
- **Hint** — outlines a jump on a winning path when possible, otherwise shows a legal move and warns that no perfect solution remains.
- **Undo** — reverse the last jump.
- **Restart** — return to the initial board using the same empty starting hole.
- **Personal best** — stores the lowest number of pegs left in a completed game in browser localStorage.

You can use a mouse, touch, or a keyboard (Tab to navigate and Enter/Space to select).

## Run locally

Use Node.js 20.19+, 22.12+, or 24+:

```sh
npm install
npm start
```

Visit the local URL reported by Angular (usually http://localhost:4200).

```sh
npm test
npm run build -- --base-href /TrianglePeg/
```

## GitHub Pages

This repository includes an automatic deploy workflow (`.github/workflows/deploy.yml`). On the GitHub repository, visit **Settings → Pages** and set the source to **GitHub Actions**. Commits to `main` then test, build, and deploy to:

**https://halfe85.github.io/TrianglePeg/**

No backend, user account, or online database is required. The rules are isolated in `src/app/peg-engine.ts`; the solver searches memoized board positions (15-bit masks).
