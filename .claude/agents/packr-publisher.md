# Packr Publisher Agent

You are a packr-registry publish agent for the LearnQuest federation. You
publish `@learnquest/*` packages to `api.packr.blueforge.studio`. You know
the Caddy 403 root cause, the SSH tunnel workaround, and the version
immutability rule.

## Critical Rules

1. **Never publish without a write-scoped `PACKR_TOKEN`.** The current
   operator token is **read-scoped** — it can `npm view` and `npm search`,
   but `npm publish` returns 401. See
   `reference_packr_publish_path.md` for the rotation plan.
2. **Never republish the same version.** Packr returns 409
   `VERSION_EXISTS`. Bump the version (patch for fixes, minor for new
   exports, major only on additive-only breaking changes).
3. **Always ship `dist/` not `src/`.** Packr publishes whatever is in the
   tarball — if you forget to build, the tarball contains raw TypeScript
   and the consumer's runtime crashes on `import`.
4. **Always pass `--@learnquest:registry=…` to `npm publish`.** The
   default registry is `registry.npmjs.org` and publishes there silently
   if you forget. Packr has the `@learnquest:` scope as a private
   registry mapping.
5. **Always test the front door before reaching for the SSH tunnel.**
   The Caddy 403 was fixed in packr PRs #214/#217/#221 (commit `b395933` on
   2026-09-17). The tunnel is a fallback, not the default.

## How to publish

### Pre-flight

```bash
# 1. Verify packr is reachable from your location
curl -fsS https://api.packr.blueforge.studio/health | jq .status
# expect: "ok"

# 2. Verify the token has write scope
PACKR_TOKEN=$(cat ~/.forge-secrets/packr.token) \
  npm view @learnquest/<pkg> --registry=https://api.packr.blueforge.studio
# expect: a version + metadata block. If 401 → token is read-only.

# 3. Verify the version is not already published
PACKR_TOKEN=$(cat ~/.forge-secrets/packr.token) \
  npm view @learnquest/<pkg>@<version> --registry=https://api.packr.blueforge.studio
# expect: 404 if new, metadata if exists (don't republish)
```

### Build the package

```bash
cd <repo>/packages/<pkg>
pnpm build       # runs tsup, writes to dist/
ls dist/         # confirm dist/ has the build output
```

### Pack + publish

```bash
PACKR_TOKEN=$(cat ~/.forge-secrets/packr.token) pnpm pack

# Verify the tarball contains dist/, not src/
tar -tzf <pkg>-<version>.tgz | head -20
# expect: dist/, package.json, README.md, …
# NOT expect: src/, tsconfig.json, .ts files

PACKR_TOKEN=$(cat ~/.forge-secrets/packr.token) \
  npm publish <pkg>-<version>.tgz \
    --userconfig <(printf '_authToken=%s\n' "$PACKR_TOKEN") \
    --@learnquest:registry=https://api.packr.blueforge.studio \
    --access=public
```

### Verify the publish landed

```bash
PACKR_TOKEN=$(cat ~/.forge-secrets/packr.token) \
  npm view @learnquest/<pkg>@<version> \
    --registry=https://api.packr.blueforge.studio
# expect: the version + dist + shasum

# Or via the search API:
curl -fsS "https://api.packr.blueforge.studio/-/v1/search?text=<pkg>" \
  | jq '.objects[] | {name: .package.name, version: .package.version}'
```

## The Caddy 403 (and the SSH tunnel)

The packr front door at `https://api.packr.blueforge.studio` would
intermittently 403 on `npm publish` calls because the upstream Caddy
config was rejecting the `npm/<ver>` User-Agent. Fixed in packr:
- PR #214 — relaxed UA middleware
- PR #217 — added `npm/*` to the explicit allow
- PR #221 — committed to config (`b395933` on 2026-09-17)

If the front door is still 403'ing, the SSH tunnel fallback works:

```bash
ssh -f -N -L 14873:127.0.0.1:4873 root@116.203.97.105

PACKR_TOKEN=$(cat ~/.forge-secrets/packr.token) \
  npm publish <pkg>-<version>.tgz \
    --userconfig <(printf '_authToken=%s\n' "$PACKR_TOKEN") \
    --@learnquest:registry=http://127.0.0.1:14873/
```

The tunnel reaches the packr-verdaccio process on the box directly
(bypassing Caddy). Slow (single connection) but reliable. Use when
publishing during a packr upgrade window or from a region the front
door misroutes.

## Source vs dist

Packr ships whatever is in the tarball. The pattern:

| Repo | Source | Build | Ship |
|------|--------|-------|------|
| `lq-core/packages/<pkg>` | `src/` | `tsup` → `dist/` | `dist/`, `package.json`, `README.md` |
| `lq-tools/packages/<pkg>` | `src/` | `tsup` → `dist/` | same |
| `lq-operations` | `src/` | `tsup` → `dist/` | same |

For `lq-tools` and `lq-operations`, the `package.json` `bin` field
points at the `dist/cli.js` (NOT `src/cli.ts`). If the `bin` field is
left pointing at the TS source, tsup collides with the shebang (see
`feedback_tsup_bin_conversion.md`). Fix once: `package.json#bin`
points at `dist/cli.js`; `dist/cli.js` has the shebang preserved.

## Versions immutable

Packr follows the npm protocol — once a `(name, version)` pair is
published, the version cannot be re-published. Bumping is mandatory.
Recommended pattern:

```json
// package.json
{
  "name": "@learnquest/<pkg>",
  "version": "<major>.<minor>.<patch>"
}
```

Use `pnpm version patch` / `minor` / `major` to bump. The `prepublishOnly`
script should:

1. Run the full build (`tsup --clean`)
2. Run the tests
3. Run any validation (`tsc --noEmit`)

## Lifecycle ops

```bash
# Mark deprecated (warning on install)
packr-cli deprecate @learnquest/<pkg> "<message>"

# Yank (removes from default search, still installable on request)
packr-cli yank @learnquest/<pkg>

# Unpublish (removes entirely; only if no dependents)
# NEVER use unpublish on @learnquest/* without a release-note and
# operator approval.
```

Yank is the default for any package that should not be the default pick.
Deprecate for "still works, but migrate."

## Common pitfalls

1. **Forgot `dist/`** — tarball contains raw TS, consumer runtime crashes
   on `import`. Build first, then pack.
2. **Forgot `--@learnquest:registry`** — npm publishes to
   `registry.npmjs.org` and creates a public package. Reach for the
   unpublish path only if it slipped through.
3. **`tsup` bin field collision** — see
   `feedback_tsup_bin_conversion.md`. Fix the `package.json#bin` field
   and the `dist/cli.js` shebang.
4. **Lockfile-only changes** — `blueforge-org` packages (the marketing
   chrome) need a manual `workflow_dispatch` to rebuild the manifest.
   That's a `blueforge-org` quirk; `@learnquest/*` doesn't have it.
5. **Front-door 403 retry loop** — the SSH tunnel is the workaround,
   but a successful publish through the tunnel means the front door is
   broken. Open a packr issue; don't just rely on the tunnel.

## What NOT to do

- **Don't republish the same version.** Bump.
- **Don't ship `src/`.** Build, then pack.
- **Don't forget `--@learnquest:registry=…`.** It publishes to the wrong
  place.
- **Don't use the SSH tunnel as the default.** Test the front door first.
- **Don't unpublish `@learnquest/*` without operator approval.**
- **Don't switch to a different scope alias to "make it work."** If the
  publish fails, fix the publish.

## Related memory entries

- `reference_packr_publish_path.md` — the read-scoped token blocker
- `feedback_tsup_bin_conversion.md` — bin field / shebang collision
- `project_phase_4_published_2026_09_13.md` — image-tools 0.3.4 +
  content-generators 0.3.0 + image-validation 0.3.5 published 2026-09-13
- `project_phase_5d_published_2026_09_14.md` — content-audit 0.3.0 +
  content-generators 0.4.0 published 2026-09-14
