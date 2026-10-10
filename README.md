# Triangle Peg

A responsive, **single-screen 2D triangular peg solitaire** game for GitHub Pages, built in Angular and TypeScript.

**Play:** https://halfe85.github.io/TrianglePeg/

## Four difficulty levels

| Level | Rows | Holes | Jumps to leave one | Hints |
| --- | ---: | ---: | ---: | --- |
| Easy | 5 | 15 | 13 | Unlimited |
| Medium | 6 | 21 | 19 | 3 per game |
| Hard | 7 | 28 | 26 | 1 per game |
| Extreme | 8 | 36 | 34 | None |

The 7-row triangular board has restricted valid initial vacancies. Starting with a corner or some central-class holes vacant makes a one-peg finish mathematically impossible, so the app marks and rejects these starting positions. Other levels permit any starting vacancy. Every default opening has been verified with a legal one-peg winning route.

The levels are distinct by board geometry and jump count, with fewer hints on higher difficulties. Undo and Redo remain available throughout, except while choosing a new opening.

## Rules

Jump over an adjacent peg into an empty hole two positions away along any of the triangle's three axes. The jumped peg disappears. Win when exactly one peg remains.

- Use the **Easy / Medium / Hard / Extreme** controls above the playing board to change difficulty.
- **New game:** select an allowable hole to make the first vacancy.
- **Undo** / **Redo:** traverse move history. Making a new move after Undo clears redo history.
- **Hint:** marks a jump on a winning route when the bounded solver finds one. If no complete route is found inside its search budget, a merely legal jump is marked and labeled accordingly.
- **Stats:** pegs left, jumps made and per-difficulty personal best in the bottom bar.
- **Personal best:** the lowest number of pegs left when a game ends, saved in localStorage. Legacy Easy records are migrated.

The viewport is a fixed top bar, game content and bottom stats bar, with no page scrolling. Desktop and mobile use the same layout; the board shrinks within the available screen area.

## Development

Use Node.js 20.19+, 22.12+, or 24+:

```sh
npm install
npm start
npm test
npm run build -- --base-href /TrianglePeg/
```

The pure rules and solver are in `src/app/peg-engine.ts`. It uses BigInt masks for the 36-hole board and memoized, budget-limited search for hints.

## GitHub Pages

The single `.github/workflows/deploy.yml` workflow tests, builds and deploys Angular automatically from `main`. GitHub Pages' publishing source should be **GitHub Actions**. Do not enable an additional Jekyll publishing workflow.

## Mathematical references

- George Bell, [Triangular Peg Solitaire](https://gibell.net/pegsolitaire/tindex.html) — board families, single-vacancy to single-survivor problems, and the 7-row position classes.
- George I. Bell, [Solving Triangular Peg Solitaire](https://arxiv.org/abs/math/0703865) — generalized solvability criteria and solution algorithms.

The game is free and runs entirely in the browser: no accounts, server, database or ads.
