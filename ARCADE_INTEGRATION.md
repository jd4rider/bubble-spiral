# Little Joy Arcade integration

Bubble Spiral is a standalone game that plugs into
<https://littlejoyarcade.site> without a build-time dependency on the platform.

## Wired today

| Piece | Status |
| --- | --- |
| Arcade listing | `arcade-manifest.json` + the portal catalogue + the `games` row |
| Subdomain | `spiral.littlejoyarcade.site` → GitHub Pages project site |
| Account panel + cloud mirror | `public/arcade-client.js` (drop-in SDK client) |
| Local saves | `localStorage['bubble-spiral-save-v1']`, always written first |
| Achievements | Ten in-game achievements, saved locally |
| Entitlements | Not read by the game yet |
| Payments | None |
| Ads | None in game |

## Drop-in client

`index.html` loads the client after the game module:

```html
<script src="./arcade-client.js" data-game-id="bubble-spiral"></script>
```

It adds a sign-in panel and mirrors Web Storage keys into Supabase's
`game_progress` table. The anon key inside the file is public by design; RLS
protects the rows. Because the game keeps one JSON save, no game-specific sync
code is required — a signed-in player's unlocks, stars and best scores follow them
to another device after the next sync.

Save shape (see `src/progress.js`):

```json
{
  "version": 1,
  "unlocked": 13,
  "stars": { "1": 3 },
  "daily": { "2026-11-02": { "stars": 3 } },
  "achievements": ["first_match", "chain_reaction"],
  "levelsCleared": 12,
  "matchesMade": 240,
  "marblesPopped": 980,
  "bestCombo": 4,
  "bestScore": 8400,
  "bestAccuracy": 0.91,
  "rainbowClears": 2,
  "classicBest": 3,
  "endlessBest": 5,
  "zenCleared": 7,
  "streak": { "last": "2026-11-02", "count": 2 },
  "settings": { "sound": true, "theme": "candy", "reducedMotion": false }
}
```

## Offline

The game never waits on the network: saves are read and written synchronously.
Sync is best-effort; an unreachable backend just leaves the local save
authoritative until the next successful sync.

## Entitlements (not enabled)

Reserved identifiers: `arcade.ad_free`, `spiral.ad_free`,
`spiral.premium_themes`, `spiral.puzzle_pack_1`. None are required to play and the
game does not read them yet. When the store opens, the server must grant
entitlements after verified payment; the client only reads them. Ad-free must
never gate progress.

## Publishing a build

1. Push to `main`; the Pages workflow tests, builds and deploys.
2. `dist/play/` is the URL the arcade links to.
3. The portal's release sync refreshes version and installer links whenever a
   GitHub release exists.
