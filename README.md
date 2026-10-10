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

Play with a mouse, touch, or keyboard (Tab to navigate, Enter/Space to select).

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

## GitHub Pages deployment

**Live address:** https://halfe85.github.io/TrianglePeg/

The GitHub Pages site must publish the **built Angular files**, not the TypeScript source and not a Jekyll site. The repository therefore uses **one** GitHub Actions workflow: `.github/workflows/deploy.yml`.

1. Open repository **Settings → Pages**.
2. Under **Build and deployment**, choose **GitHub Actions** as the source.
3. Push to `main`, or manually run **Deploy Triangle Peg to GitHub Pages** from the Actions tab.
4. After a successful deployment, open the live address above.

The workflow installs dependencies, runs the peg-engine tests, builds Angular using `/TrianglePeg/` as the base path, uploads `dist/triangle-peg/browser`, and deploys that directory.

**Do not enable GitHub's starter Jekyll workflow** (`jekyll-gh-pages.yml`) alongside this workflow. Jekyll does not compile Angular and concurrent deployments can overwrite the game with unbuilt source files. The generated site includes `.nojekyll` for compatibility with static GitHub Pages publishing.

No backend, login, or online database is required. The pure rule engine is in `src/app/peg-engine.ts` and searches memoized 15-bit board positions.
