# Triangle Peg

A responsive, **single-screen 2D triangular peg solitaire** game for GitHub Pages, built in Angular and TypeScript.

**Play:** https://halfe85.github.io/TrianglePeg/

## Four difficulty levels

| Level | Rows | Holes | Jumps to leave one |
| --- | ---: | ---: | ---: |
| Easy | 5 | 15 | 13 |
| Medium | 6 | 21 | 19 |
| Hard | 7 | 28 | 26 |
| Extreme | 8 | 36 | 34 |

The 7-row triangular board has restricted valid initial vacancies. Starting with a corner or some central-class holes vacant makes a one-peg finish mathematically impossible, so the app marks and rejects these starting positions. Other levels permit any starting vacancy. Every default opening has been verified with a legal one-peg winning route.

Levels differ by board geometry and jump count. Hints are disabled completely. Undo and Redo remain available throughout, except while choosing a new opening.

## Rules

Jump over an adjacent peg into an empty hole two positions away along any of the triangle's three axes. The jumped peg disappears. Win when exactly one peg remains.

- Press **New game**, choose Easy / Medium / Hard / Extreme in the modal, and press **Start game**. Cancel or Escape preserves the current game.
- Select an allowable hole to make the first vacancy.
- **Undo** / **Redo:** traverse move history. Making a new move after Undo clears redo history.
- **Stats:** pegs left, jumps made and per-difficulty personal best in the bottom bar.
- **Personal best:** the lowest number of pegs left when a game ends, saved in localStorage. Legacy Easy records are migrated.

The viewport remains top controls, central board and bottom stats with no page scrolling. Peg circles scale down on denser levels and are inset from the triangle edges. Difficulty selection appears only inside the New game dialog.

## Development

Use Node.js 20.19+, 22.12+, or 24+:

```sh
npm install
npm start
npm test
npm run build -- --base-href /TrianglePeg/
```

The pure rules and solver are in `src/app/peg-engine.ts`. It uses BigInt masks for the 36-hole board and memoized search for automated rule tests (never exposed as in-game hints).

## GitHub Pages

The single `.github/workflows/deploy.yml` workflow tests, builds and deploys Angular automatically from `main`. GitHub Pages' publishing source should be **GitHub Actions**. Do not enable an additional Jekyll publishing workflow.

## Mathematical references

- George Bell, [Triangular Peg Solitaire](https://gibell.net/pegsolitaire/tindex.html) — board families, single-vacancy to single-survivor problems, and the 7-row position classes.
- George I. Bell, [Solving Triangular Peg Solitaire](https://arxiv.org/abs/math/0703865) — generalized solvability criteria and solution algorithms.

The game is free and runs entirely in the browser: no accounts, server, database or ads.
