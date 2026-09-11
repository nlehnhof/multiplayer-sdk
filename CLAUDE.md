# Multiplayer Agent SDK

An open-source TypeScript SDK + MCP server + Claude Code/Cursor plugin that lets an AI coding agent bolt real-time multiplayer onto a game a vibe coder already built, by wrapping an existing realtime backend (PartyKit by default) instead of owning infrastructure.

Full context lives in two docs at repo root — read them before making architectural calls:
- `multiplayer-agent-sdk-build-plan.md` — product plan: ICP, distribution, stack, budget, rollout
- `orchestration-plan.md` — execution plan: repo scaffold, phased build order, skill-vs-subagent rule, **current phase status**

This file is the working contract for whoever (human or Claude) picks up work in this repo. Keep it under 2000 words — condense before adding.

## Status: Phase 0-4 complete; Phase 5 (post-launch bugfix, ADR 0003) done

Adapter interface, core SDK, PartyKit adapter, MCP server skeleton, both plugin manifests, and all 3 reference games exist, are tested (unit tests + live smoke tests against a real `partykit dev` server, not just mocks), and are merged to `master`. See `orchestration-plan.md` for the phase-by-phase log.

A live-usage test (a real game built against this SDK, deployed to an actual Cloudflare Durable Object) found that `RoomEngine` and `adapter-partykit` kept all state in memory only — a hibernation/wake cycle (which PartyKit's own docs describe as normal, expected behavior, not an edge case) silently reset the entire room. Fixed per ADR 0003: `RoomEngine` gained an optional `restore` constructor argument and a `snapshot()` method; `adapter-partykit` persists that snapshot to `room.storage` after every join/leave/action and restores it in `onStart`. Verified three ways, not just unit-tested: (1) new unit tests simulating a wake via a fresh server instance sharing fake storage, (2) the existing live smoke test unchanged and still passing, (3) an actual `partykit dev` process kill-and-restart mid-session, confirming real (not mocked) state survives. Full workspace `test`/`typecheck`/`build` re-verified green after the change.

## MVP scope

**In scope for MVP** ("ship the free core" — build plan Rollout step 2):
- Adapter interface (ADR 0001 + ADR 0002) — **done**
- Core SDK + PartyKit adapter (Phase 1) — **done**
- MCP server + Claude Code/Cursor plugin manifests — **done** (skeleton-level; see their READMEs for flagged unknowns)
- All 3 reference games: tic-tac-toe, card-game (War), trivia — **done**
- Published to npm; submitted to Claude Code and Cursor marketplaces — **prep done, publish/submit not done**: see `DEPLOY_CHECKLIST.md` (actual `npm publish` and marketplace submission need your credentials/account, not Claude's)

**Explicitly out of scope — do not build without asking first:**
- Colyseus adapter, Supabase Realtime adapter (framed in the build plan as "swappable later," not MVP-blocking)
- Docs site (defer until API shape is stable)
- Paid hosted tier / "one-click multiplayer" add-on (post-organic-traction per ROI section)

If a task seems to require touching anything in the out-of-scope list, stop and ask rather than assuming it's needed.

## Repo structure (current)

```
adr/
  0001-adapter-interface.md   # RoomDefinition/MultiplayerAdapter contract — frozen, never edit casually
  0002-per-player-views.md    # toClientView hook — amends 0001, additive/backward-compatible
  0003-durable-state-persistence.md  # RoomEngine snapshot/restore + adapter-partykit hibernation persistence
packages/
  core/                # types.ts + RoomEngine (player bookkeeping, hook dispatch)
  adapter-partykit/    # default backend; smoke-test/ = live verification against real partykit dev
  mcp-server/          # MCP skeleton: list_adapters, get_room_definition_guide tools
  plugin-claude-code/  # .claude-plugin/plugin.json + skills/add-multiplayer/SKILL.md
  plugin-cursor/       # .cursor/rules/multiplayer-agent-sdk.mdc
  adapter-colyseus/    # NOT STARTED — post-MVP
  adapter-supabase/    # NOT STARTED — post-MVP
examples/
  tic-tac-toe/         # fully public state, no toClientView needed
  card-game/           # War — toClientView hides opponents' hand contents
  trivia/              # toClientView hides other players' answers pre-reveal
docs/                  # NOT STARTED — post-MVP (docs site)
```

Every package/example has a `package.json` with `test`/`typecheck` scripts, and every game has `smoke:server` + `smoke:play`/`smoke:client` scripts that run it against a real local PartyKit server — this is the required verification step, not optional. Ports: adapter's own smoke test = 1999, tic-tac-toe = 2000, card-game = 2001, trivia = 2002.

## The private-view pattern (ADR 0002)

Any `RoomDefinition` with hidden information (hands, secret roles, unrevealed answers) **must** implement `toClientView(state, viewerId)`. Without it, the adapter sends the raw shared state to every client — fine for a fully-public game (tic-tac-toe), wrong for almost anything else. See `examples/card-game/src/room.ts` and `examples/trivia/src/room.ts` for the two established patterns (redact-to-count, redact-until-phase-transition).

## Build order

1. **Phase 0 — Interface design.** ✅ Done (ADR 0001). Single sequential thread, never delegated.
2. **Phase 1 — Core SDK + PartyKit adapter.** ✅ Done, live-verified.
3. **Phase 2 — Parallelized MVP packages.** ✅ Done via 4 worktree agents (3 games + MCP/plugins), each merged and re-verified on `master` after merge, including fixing two real bugs a subagent's own testing had missed (a smoke-test race in card-game, a stale-room bug in trivia's smoke test) — don't accept a subagent's "tests pass" without independently re-running them post-merge.
4. **Phase 3 — Testing & review.** ✅ Done. A high-effort `/code-review` pass over `packages/` and `examples/` found one real bug (a per-connection broadcast failure-isolation gap in the adapter, introduced by ADR 0002) — fixed, with a regression test, and re-verified across the full workspace plus a live smoke test.
5. **Phase 4 — Launch prep.** ✅ Claude's parts done — see `DEPLOY_CHECKLIST.md`. Root `README.md`, CI workflow, npm-publish-ready `package.json`s (versions bumped to `0.1.0`, verified via `npm publish --dry-run`), and both plugin manifests' content updated for ADR 0002 (they'd shipped before that ADR and were stale — the MCP server's own guidance tool had the same gap, also fixed). Actual `npm publish`, marketplace submission, demo video, and creator outreach remain human tasks.
6. **Phase 5 — Post-launch bugfix (ADR 0003).** ✅ Done. `RoomEngine`/`adapter-partykit` were in-memory-only and silently lost all state on a hibernation/wake cycle — found via a live game built against this SDK, not via the existing test suite. Fixed with a `RoomEngine.snapshot()`/`restore` API (core) plus `onStart`-based persistence in the PartyKit server (adapter), both additive/backward-compatible. See ADR 0003 for the full design and verification detail.

Full detail in `orchestration-plan.md` — this is a pointer, not a replacement.

## Skill vs. subagent rule

- **Skill** (shared process, run inline): ADR template, test strategy, docs structure, deploy checklist.
- **Subagent / worktree** (independent code touching files nothing else touches): a Phase 2 adapter, a reference game, docs site once scoped.
- **Never delegate:** the shared adapter interface, the merge step, or any architectural decision (e.g. ADR 0002 was designed in-thread, then implemented directly — not handed to a subagent).
- **After a subagent merges:** re-run its tests yourself on `master` post-merge, and re-run its live smoke test if it has one. Two real bugs in Phase 2 were only caught this way.

## Tech stack & conventions

- **Package manager:** npm workspaces.
- **Language:** TypeScript, strict mode, **pinned to `^5.9.3`** — do NOT bump to the "latest" 7.x line; `tsup`'s `.d.ts` bundler (via `rollup-plugin-dts`) currently crashes on TypeScript 7.
- **Build:** `tsup` per package (`--format esm --dts`).
- **Tests:** `vitest`, plus a live `smoke:*` script per game/adapter — both are required, not either/or.
- **License:** MIT.
- Games needing hidden information must use `toClientView` (see above) — don't invent a workaround.

## Git workflow

- Commit after each discrete milestone, never one giant commit.
- Remote: `https://github.com/nlehnhof/multiplayer-sdk.git` (`origin`). Never push without explicit confirmation for each push.
- When cleaning up after a worktree-based subagent, also kill any `partykit dev` process it left running before starting your own on the same port — leaked dev servers running stale code have caused real, confusing test failures here (see `orchestration-plan.md`'s Phase 2 log).

## Assumptions log

1. This repo's root is the SDK root (no nested subfolder matching the package name).
2. MVP = build plan's Rollout step 2 ("ship the free core"), not the narrower "This week" checklist.
3. npm workspaces + tsup + vitest, TypeScript strict mode, MIT license.
4. One root-level `CLAUDE.md`, no per-package files.
5. MCP server tool surface (2 read-only tools) is deliberately minimal — "loads correctly" was the bar per the build plan's own checklist, not full feature coverage.
