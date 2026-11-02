# Deployment

## Web (GitHub Pages)

`.github/workflows/pages.yml` runs on every push to `main`:

1. `npm ci --include=optional`
2. `npm test` — chain, path, generation and progression tests
3. `npm run build`
4. copies the build to `dist/play/`
5. publishes `dist/` to GitHub Pages

Pages is enabled on the repository with `build_type=workflow`, so the workflow
above is the only publisher. No other host (Firebase, Netlify, Cloudflare) is
configured: a push cannot produce a second copy that drifts from the live site.### No custom domain on the game repo

This repo deliberately ships **no `public/CNAME`** and no Pages custom domain.
A Pages site has exactly one canonical hostname: setting
`spiral.littlejoyarcade.site` there would 301
`jd4rider.github.io/bubble-spiral/` to a host whose certificate GitHub cannot
issue for a project site, and the arcade's embedded player would go black. The
catalogue therefore links the `github.io` build as `playUrl`; the game prompts
for the subdomain only through the portal's optional `preferredPlayUrl` probe.

See `littlejoyarcade/DNS_CONFIGURATION.md` for the whole rule and how to move
every game to custom hostnames in one planned cutover.

Verify:

```bash
curl -sI https://jd4rider.github.io/bubble-spiral/play/ | head -3
```

## Desktop installers

Local: `npm run dist:mac`, `dist:win`, `dist:linux`.

CI: push a tag.

```bash
git tag v0.1.0 && git push origin v0.1.0
```

The **Release apps** workflow builds macOS (arm64 + x64), Windows NSIS and Linux
AppImage and attaches them to the release. Electron runs with
`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, and the game
has no preload bridge.

## Rollback

Re-run a previous successful Pages workflow, or revert the commit on `main`. Code
rollbacks never touch DNS.
