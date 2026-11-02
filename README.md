# Bubble Spiral

A marble-chain arcade puzzle for [Little Joy Arcade](https://littlejoyarcade.site).

A chain of coloured marbles crawls along a winding track toward a hole. Aim the
launcher, fire a marble into the chain, and connect three or more of the same
colour to pop them. Groups collapsing together can trigger further matches before
the chain reaches the hole.

- Play: <https://spiral.littlejoyarcade.site/play/>
- Repository: <https://github.com/jd4rider/bubble-spiral>

## What is in the game

- **Journey** — 100 deterministic boards across eight chapters, each checked
  against a shot-budget fairness heuristic (see `LEVEL_GENERATION.md`).
- **Classic** — endless stages that add colours, speed and specials.
- **Endless** — waves that get faster; highest wave and score are saved.
- **Daily Challenge** — one board per UTC date, identical on every device.
- **Zen** — slow chains, three power-ups, and a fresh chain instead of a loss.
- **Special marbles** — rainbow (wildcard), bomb (blast radius), frozen (must be
  shot once to thaw).
- **Power-ups** — Slow, Reverse and Rainbow, earned per level, never sold.
- Undo is deliberately absent: shots are committed, which keeps scoring honest.

## Controls

- Move the pointer (or drag a finger) to aim, release to fire.
- **Space** fires again, **R** restarts, **Esc** pauses, **S / X / C** trigger
  Slow / Reverse / Rainbow.
- The bottom bar is the power-up strip; taps there never fire a marble.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # chain, path, matching, generation and progression tests
npm run build
npm start          # Electron
npm run dist:mac   # DMG (also dist:win, dist:linux)
```

## Save contract

`localStorage['bubble-spiral-save-v1']` holds one JSON object (see
`src/progress.js`): unlocks, stars, achievements, totals, streak, settings.
`normalizeSave` repairs malformed fields, so an old save never blocks play.

## Stack note

Phaser 4 + Vite, plain ES modules. Every other game in this arcade ships the same
way, so Pages, Electron packaging and the drop-in arcade client stay identical.
The chain engine is dependency-free and tested in Node.

Docs: [GAME_DESIGN.md](GAME_DESIGN.md) · [CHAIN_ENGINE.md](CHAIN_ENGINE.md) ·
[LEVEL_GENERATION.md](LEVEL_GENERATION.md) ·
[ARCADE_INTEGRATION.md](ARCADE_INTEGRATION.md) · [DEPLOYMENT.md](DEPLOYMENT.md)
