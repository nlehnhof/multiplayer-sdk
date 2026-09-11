# Deploy Checklist (Phase 4)

Per `CLAUDE.md`/`orchestration-plan.md`: Phase 4 is launch prep. This tracks what's done, what Claude built, and what's explicitly a human task per the build plan's "AI builds vs. you build" section — nothing below with a ⬜ human box has been done by Claude, and nothing requiring real credentials, a real publish, or a real external submission should be.

## npm publish readiness — packages/core, packages/adapter-partykit, packages/mcp-server

- [x] `package.json` complete: `repository` (with monorepo `directory`), `homepage`, `bugs`, `author`, `keywords`, `license`, `engines`, `publishConfig.access: "public"` (required — these are scoped packages, which npm defaults to private).
- [x] Every publishable package has its own `README.md` (verified via `npm publish --dry-run` — it lists tarball contents; `core` was initially missing one, now fixed).
- [x] `build`/`test`/`typecheck` pass across the whole workspace (65/65 tests).
- [x] `npm publish --dry-run` run for all three — tarball contents inspected and correct (`dist/`, `README.md`, `package.json`; no source, no test files, no `node_modules`).
- [x] Versions bumped from the placeholder `0.0.1` to `0.1.0` for the first real release candidate, kept in sync everywhere they're referenced (each package's own `package.json`, the internal `@multiplayer-agent-sdk/core` dependency in `adapter-partykit`/`mcp-server`, and the three example games' dependencies on `core`/`adapter-partykit`).
- [x] `npm view` confirms `@multiplayer-agent-sdk/core`, `adapter-partykit`, and `mcp-server` are not already taken on the public registry (all 404 — available).
- [x] **Human:** created the `@multiplayer-agent-sdk` npm org/scope.
- [x] **Human:** logged in and published all three packages (`core`, `adapter-partykit`, `mcp-server`) to the public registry at `0.1.0`.
- [x] Tagged the matching git release: `v0.1.0`, pushed to `origin`. Optionally still open: a GitHub release with notes.

## Repo polish

- [x] Root `README.md` (quickstart, package table, reference games, architecture links, status).
- [x] `LICENSE` (MIT).
- [x] `.github/workflows/ci.yml` — runs `typecheck`/`test`/`build` across all workspaces on push/PR to `master`. (Live smoke tests, which need a running `partykit dev` process, are intentionally not automated in CI yet — they're the manual verification step documented in each package/example's README.)
- ⬜ **Human:** set the GitHub repo's description and topics (Settings → General) to match the npm keywords, for discoverability — a GitHub-side setting Claude didn't touch.

## Claude Code plugin directory (`packages/plugin-claude-code`)

- [x] Plugin manifest + skill drafted, schema checked against Anthropic's own `plugin-dev` reference docs (not just blog posts) — see that package's README for exactly what was verified vs. not.
- [x] Skill content updated to cover `toClientView`/ADR 0002 (was stale after that ADR shipped — caught and fixed here).
- [x] Draft marketplace listing copy (name, description, category, keywords) in that package's README.
- ⬜ **Human:** actually install/load the plugin in a running Claude Code session to confirm it works in practice, not just against the documented schema.
- ⬜ **Human:** read `claude-plugins-official`'s specific contribution guidelines (build plan's own "This week" checklist item) and open the real PR — a real review relationship with Anthropic's repo maintainers, not something Claude does.

## Cursor Marketplace (`packages/plugin-cursor`)

- [x] Rule drafted, schema checked against Cursor's own docs.
- [x] Rule content updated to cover `toClientView`/ADR 0002.
- [x] Draft marketplace listing copy in that package's README.
- ⬜ **Human:** load the rule in a real Cursor session to confirm it's actually picked up for relevant prompts.
- ⬜ **Human:** the actual Cursor Marketplace / cursor.directory submission process.

## Explicitly not attempted (per build plan, human-only)

- Recording the 60-90s demo video.
- Reaching out to / replying in the Riley Brown / Alex Finn thread.
- Any pricing decisions or the paid hosted tier (post-organic-traction, out of MVP scope per `CLAUDE.md`).
