# Game design

## Pitch

A tactile marble-chain shooter: read the chain, pick the join that turns three
into five, and clear the track before it drains into the hole.

## Feel

- Marbles are glossy and constant-spaced; the chain reads as one body.
- A hit marble slides into place, the group pops outward with a burst, and the
  gap snaps shut with a soft click.
- Combos are announced in the middle of the board, not in a corner.
- No ads, no timers in Zen, no loss of progress on a network failure.

## Modes

| Mode | Format | Failure |
| --- | --- | --- |
| Journey | 100 fixed boards, 8 chapters | chain reaches hole → retry |
| Classic | endless stages | chain reaches hole → retry stage |
| Endless | waves, faster each time | chain reaches hole → run over |
| Daily | one board per UTC date | retry allowed |
| Zen | slow endless boards | chain resets instead of losing |

## Specials

- **Rainbow** — wildcard in any group. As a power-up it turns the next shot into
  the colour it hits, so it always joins.
- **Bomb** — when popped, takes two neighbours on each side.
- **Frozen** — must be shot once to thaw; blocks a group until then.

## Power-ups

Slow (8 s), Reverse (4 s) and Rainbow (one shot), each level granting 1–3 charges.
They are never purchasable; there is no store in this build.

## Scoring

Matches pay 10 per marble plus 15 per marble beyond the third, times the reaction
number. A gap-closing cascade therefore outranks three separate matches. Clearing
pays no separate bonus — the goal is the clear.

## Stars

Stars reward accuracy, not speed: 3 stars at 85% accuracy, 2 at 60%, otherwise 1.
Replaying never lowers a best.

## Visual identity

Four original palettes (Candy Spiral, Ocean Pearls, Neon Galaxy, Jungle Jewels),
all drawn from code: marbles are layered circles with a gloss and rim, the track is
a stroked spline, and the hole pulses red. No external art or fonts.

## Accessibility

Reduced-motion skips ambient motes, symbols accompany every special colour, touch
targets are large, safe-area insets are respected, and no keyboard input is
required.

## Not built yet

Multiple simultaneous chains, multiple launchers, Lightning/Armored/Reverse
marbles, colour changers and lock marbles are described in the brief but were left
out rather than half-tested. Entitlements and payments are also not active; see
`ARCADE_INTEGRATION.md`.
