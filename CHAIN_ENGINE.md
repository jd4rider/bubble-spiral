# Chain engine

The chain is a list of marbles ordered head-first. Every marble stores exactly
one number: `s`, its distance along the path. Nothing about spacing or movement
is derived from sprites, physics or frame timing.

```
head (s = 713)  →  [m0][m1][m2] … [m23]  ← tail (s = 713 − 23·31)
```

## Paths

`src/chain/path.js` smooths a control polygon with a Catmull–Rom spline, samples
it every 4 px, and stores cumulative arc length. `pointAt(path, d)` binary-searches
that table and returns position plus tangent, so a marble is always exactly on
the track.

Path templates live in `src/levels.js`: spiral, serpentine, zigzag and loop. The
spiral is generated as an Archimedean curve from an outer radius to an inner
radius; the hole sits at its centre.

## Movement

`advance(chain, delta)` adds `delta` to every marble. Keeping the spacing is
therefore structural: the difference between neighbours never changes while the
chain moves. Speed, slow-motion and reversal simply change `delta`.

Marbles with `s < 0` are behind the spawn point; they stay in the model (so a
reversal can bring them back) but are not drawn or hit.

## Insertion

A shot finds the nearest visible marble, then refines its own arc-length position
near that marble (`nearestDistance`). If the shot is ahead of the marble it goes
in front (`index`), otherwise behind (`index + 1`). The new marble is placed one
spacing behind the marble ahead, and every marble behind the insertion shifts
back by exactly one spacing. The head never moves.

Frozen marbles are special: a hit thaws them instead of inserting.

## Matching

`findRuns` walks the list and groups consecutive marbles that are either the same
colour or a rainbow wildcard. Runs shorter than three are ignored. A frozen,
unthawed marble is a barrier and breaks a run.

## Compression

`removeIndices` deletes a block and then pulls everything behind the seam forward
so the marble behind sits exactly one spacing behind the marble ahead. That is
what makes a split chain reconnect, and it is the only place positions change
outside `advance`.

## Chain reactions

`resolveMatches` loops: find runs → collect indices (bombs also take two
neighbours each side) → remove and compress → find runs again. Each pass raises
the combo multiplier, and the loop is capped at ten reactions, so a pathological
board terminates.

## Scoring

`points = count·10 + max(0, count − 3)·15`, multiplied by the reaction number.
A three-marble match is 30, a six-marble cascade can be worth several hundred.

## Invariants checked by the test suite

- spacing is exact after insertion, removal and compression;
- insertion is deterministic for a given collision point;
- compression reconnects the seam to one spacing;
- a gap closing can produce a second match, and the loop terminates;
- win/loss read the model, never sprite positions.
