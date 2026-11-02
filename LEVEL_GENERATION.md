# Level generation and fairness

Every board is a pure function of a seed. Boards are built at load time and
memoised, so level 37 is the same spiral on every device.

## Pipeline

1. **Path** — a template (spiral, serpentine, zigzag, loop) is generated with a
   seeded PRNG and smoothed into an arc-length table.
2. **Length** — marble count is derived from the path length (`≈ 50%` of the
   track, 31 px apart), with two hard constraints: at least three marbles per
   colour, and a head position comfortably short of the hole.
3. **Colours** — built from a counted pool so every colour appears at least three
   times, using a greedy picker that never allows three in a row. This is
   structural, not a retry loop.
4. **Specials** — rainbow, bomb and frozen marbles are sprinkled by chapter, then
   the opening chain is checked. Rainbows are wildcards and the only special that
   can create a free match, so they are retried and finally dropped if needed.
5. **Speed** — derived from the shot budget rather than guessed (below).

## The fairness check

A marble chain cannot be proven solvable: aiming and timing are continuous. What
can be checked is whether the player has enough time for the shots the chain
requires.

```
shotsNeeded  = marbles / 3
requiredTime = shotsNeeded × 0.9s      (a comfortable shot interval)
timeToReach  = (pathLength − headStart) / speed
slack        = timeToReach / requiredTime
```

The generator caps speed so that `slack ≥ 1.7`:

```js
fairSpeed = remaining / (shotsNeeded * 0.9 * 1.7)
speed     = min(requestedSpeed, fairSpeed)
```

`validateLevel` re-checks `slack ≥ 1.2`, non-empty path, chain length, starting
position, an empty opening match, and three of every colour. The test suite runs
it over all 100 Journey boards plus daily, classic, endless and Zen.

This is a heuristic, not a proof, and is described as such in the game docs.

## Difficulty

`raw = speed/9·0.9 + (colours−3)·1.1 + specialShare·9 + count/26`, mapped to
1–5 with calibrated thresholds. Chapter averages run from **2.3** (First Spiral)
to **5.0** (Spiral Master), so the curve rises without a cliff.

## Chapters

| # | Chapter | Path | Colours | Specials |
| --- | --- | --- | --- | --- |
| 1 | First Spiral | spiral | 4 | — |
| 2 | Color Connections | serpentine | 4 | rainbow |
| 3 | Chain Reactions | zigzag | 5 | rainbow, bomb |
| 4 | Twisting Tracks | loop | 5 | rainbow, bomb |
| 5 | Frozen Marbles | spiral | 5 | frozen, rainbow |
| 6 | Double Trouble | serpentine | 5 | frozen, bomb, rainbow |
| 7 | Speed Rush | zigzag | 6 | all |
| 8 | Spiral Master | spiral | 6 | all |

## Seeds

| Mode | Seed |
| --- | --- |
| Journey `n` | `spiral-j<n>` |
| Daily `YYYY-MM-DD` | `spiral-daily-YYYY-MM-DD` |
| Endless wave `w` | `spiral-endless-<w>` |
| Classic stage `s` | `spiral-classic-<s>` |
| Zen | `spiral-zen-<seed>` |

The daily date is the UTC date, so every player gets the same board.
