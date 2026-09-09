# Multiplayer Agent SDK

An open-source TypeScript SDK + MCP server + Claude Code/Cursor plugin that lets an AI coding agent bolt real-time multiplayer onto a game a vibe coder already built, by wrapping an existing realtime backend (PartyKit by default) instead of owning infrastructure.

Full context lives in two docs at repo root — read them before making architectural calls:
- `multiplayer-agent-sdk-build-plan.md` — product plan: ICP, distribution, stack, budget, rollout
- `orchestration-plan.md` — execution plan: repo scaffold, phased build order, skill-vs-subagent rule

This file is the working contract for whoever (human or Claude) picks up work in this repo. Keep it under 2000 words — condense before adding.

## MVP scope

**In scope for MVP** ("ship the free core" — build plan Rollout step 2):
- Adapter interface (Phase 0 ADR)
- Core SDK + PartyKit adapter (Phase 1)
- MCP server + Claude Code/Cursor plugin manifests
- All 3 reference games: tic-tac-toe, card game, trivia
- Published to npm; submitted to Claude Code and Cursor marketplaces

**Explicitly out of scope — do not build without asking first:**
- Colyseus adapter, Supabase Realtime adapter (framed in the build plan as "swappable later," not MVP-blocking)
- Docs site (defer until API shape is stable)
- Paid hosted tier / "one-click multiplayer" add-on (post-organic-traction per ROI section)

If a task seems to require touching anything in the out-of-scope list, stop and ask rather than assuming it's needed.

## Target repo structure

```
packages/
  core/               # room/session abstraction, adapter interface — Phase 0/1
  adapter-partykit/    # default backend — Phase 1, MVP
  adapter-colyseus/    # Phase 2, POST-MVP
  adapter-supabase/    # Phase 2, POST-MVP
  mcp-server/          # MCP server exposing SDK actions to agents — MVP
  plugin-claude-code/  # skill/plugin manifest — MVP
  plugin-cursor/       # Cursor rule/marketplace manifest — MVP
examples/
  tic-tac-toe/         # MVP
  card-game/           # MVP
  trivia/              # MVP
docs/                  # POST-MVP (docs site)
```

This repo's root *is* the SDK root — no nested `multiplayer-agent-sdk/` subfolder. None of this exists yet; nothing above should be scaffolded speculatively ahead of the phase it belongs to.

## Build order

1. **Phase 0 — Interface design.** Single sequential thread. Write an ADR for the adapter interface (room create/join, state sync, presence, teardown). This is the contract everything else depends on — never hand this to a subagent, never parallelize it.
2. **Phase 1 — Core SDK + PartyKit adapter.** Sequential, same thread as Phase 0. Must land and be tested before anything in Phase 2 starts.
3. **Phase 2 — Parallelize** (only once the Phase 0 interface is frozen): Colyseus adapter, Supabase adapter (both post-MVP, don't start without confirmation), MCP server + plugin manifests, the three reference games (three independent sub-tasks). Each parallel unit gets only the frozen interface file(s) + its own package — not this repo's chat history.
4. **Phase 3 — Testing & review.** Unit tests per adapter against a mock backend, integration test per example game, code review per package before merging. Run tests for real; never mark a package done on a subagent's say-so.
5. **Phase 4 — Launch prep.** Deploy checklist before `npm publish`. Marketplace submission content can be drafted here, but actual submission review and creator outreach happen outside Claude.

Full detail for each phase is in `orchestration-plan.md` — this is a pointer, not a replacement.

## Skill vs. subagent rule

- **Skill** (shared process, no isolation needed, run inline): ADR template, test strategy, docs structure, deploy checklist.
- **Subagent / worktree** (independent code touching files nothing else touches, fresh context is a feature): each Phase 2 adapter, each Phase 2 example game, docs site once scoped.
- **Never delegate to a subagent:** the shared adapter interface, the merge step, or any architectural decision. These need continuity in one thread to avoid drift and merge conflicts.

## Tech stack & conventions (assumed — see Assumptions log)

- **Package manager:** npm workspaces (not pnpm/turborepo) — no extra global tool to install, matches the "npm install, zero friction" distribution story.
- **Language:** TypeScript, strict mode.
- **Build:** `tsup` per package.
- **Tests:** `vitest`.
- **License:** MIT (matches "free/open-source core" in the ROI model).

## Git workflow

- Commit after each discrete milestone (Phase 0 ADR, core SDK skeleton, PartyKit adapter, each Phase 2 package, etc.) — never one giant commit for the whole build.
- Remote: `https://github.com/nlehnhof/multiplayer-sdk.git` (`origin`). Never push without explicit confirmation for each push.

## Assumptions log

Nothing in the source docs mandates the specifics below — they were inferred for lowest complexity for a solo, bootstrapped, part-time builder. Revisit/correct if wrong:

1. This repo's root is the SDK root (no nested subfolder matching the package name).
2. MVP = build plan's Rollout step 2 ("ship the free core"), not the narrower "This week" checklist — the checklist is the *first slice* of Phase 0/1, not the full MVP bar.
3. npm workspaces + tsup + vitest, TypeScript strict mode, MIT license — no requirement doc specifies these; picked for minimal tooling overhead.
4. One root-level `CLAUDE.md`, no per-package files, given MVP-sized repo.
