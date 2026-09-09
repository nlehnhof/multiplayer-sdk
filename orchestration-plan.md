# Multiplayer Agent SDK — Build Orchestration Plan

Source: `multiplayer-agent-sdk-build-plan.md` (spacex-eval verdict: Pivot, Sept 8 2026)

## Where the actual coding happens

This is a real multi-package TypeScript repo with tests, CI, and npm publishing — that's a Claude Code CLI job (in a git repo on your machine or a dedicated dev environment), not a Cowork chat job. Cowork's role here is planning, skill creation, docs/market research, and spawning isolated agents for chunks of work that don't share files. Once the repo exists, the day-to-day build loop should move to a terminal Claude Code session against that repo.

## Repo scaffold

```
multiplayer-agent-sdk/
  packages/
    core/               # room/session abstraction, adapter interface
    adapter-partykit/    # default backend
    adapter-colyseus/
    adapter-supabase/
    mcp-server/          # MCP server exposing SDK actions to agents
    plugin-claude-code/  # skill/plugin manifest
    plugin-cursor/       # Cursor rule/marketplace manifest
  examples/
    tic-tac-toe/
    card-game/
    trivia/
  docs/
```

## Phased build, mapped to who/what does it

**Phase 0 — Interface design (sequential, single Claude Code thread).**
Use the `engineering:architecture` skill to write an ADR for the adapter interface (what a backend must implement: room create/join, state sync, presence, teardown). This interface is the contract everything else depends on — don't parallelize it, and don't let a subagent freelance it.

**Phase 1 — Core SDK + PartyKit adapter (sequential).**
Build the reference implementation of the interface against PartyKit first, since it's the default backend the reference games will target. This has to land and be tested before Phase 2 forks.

**Phase 2 — Parallelize once the interface is frozen.**
These are independent files/packages, so this is where subagents actually pay off — each one only needs the frozen interface, not this conversation's history:
- Colyseus adapter
- Supabase Realtime adapter
- MCP server + Claude Code/Cursor plugin manifests
- The three reference games (tic-tac-toe, card game, trivia) — can themselves run as three parallel sub-tasks since they don't touch each other
- Docs site (`engineering:documentation` skill), once the API shape is stable enough to document

Run these either as Cowork `Agent` calls with `isolation: "worktree"` (each gets its own git worktree, safe to run concurrently), or as separate Claude Code CLI sessions on separate worktrees if you're driving from the terminal. Either way, each agent should be handed only: the ADR, the frozen interface file(s), and its one package — not the whole build plan or prior chat history. That's the actual cost savings: a fresh subagent with a narrow brief burns far fewer tokens than continuing one long thread that's seen everything.

**Phase 3 — Testing & review.**
`engineering:testing-strategy` to define coverage (unit tests per adapter against a mock backend, integration test per example game). `engineering:code-review` on each package before merging. Run tests for real — don't mark this done on a subagent's say-so.

**Phase 4 — Launch prep.**
`engineering:deploy-checklist` before `npm publish`. Draft the marketplace submission (Claude Code plugin directory PR, Cursor Marketplace listing) content here, but per the build plan, the actual submission review process and creator outreach are things you do by hand, not Claude.

## Skill vs. subagent — the rule of thumb

- **Skill**: shared process/knowledge, no isolation needed, called inline in whichever thread is doing the work (ADR template, test strategy, docs structure, deploy checklist).
- **Subagent (worktree)**: an independent unit of code touching files nothing else touches, where starting fresh (no shared history) is a feature, not a loss.
- Never hand the shared interface, the merge step, or architectural decisions to a subagent — those need continuity in one thread to avoid drift and merge conflicts.

## Reusable skill built from this plan

Proposed and available now: `agent-native-build-orchestrator` — takes any future build-plan.md for an agent-native tool (SDK/MCP server/Claude Code or Cursor plugin) and runs this same scaffold → core-vs-parallel split → skill mapping, without re-deriving it from scratch each time.

## Sources
- `multiplayer-agent-sdk-build-plan.md` (same folder)
