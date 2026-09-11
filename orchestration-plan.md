# Multiplayer Agent SDK — Build Orchestration Plan

Source: `multiplayer-agent-sdk-build-plan.md` (spacex-eval verdict: Pivot, Sept 8 2026)

## Status (updated as phases complete)

**Phase 0 ✅ · Phase 1 ✅ · Phase 2 ✅ · Phase 3 ✅ · Phase 4 🔶 Claude's parts done, human parts pending**

Repo: `https://github.com/nlehnhof/multiplayer-sdk.git`, branch `master`. Working contract and current file-by-file structure live in `CLAUDE.md` at repo root — this doc stays the narrative log of *how* the build actually went (what deviated from plan, what broke, what was learned), `CLAUDE.md` is the current-state reference.

Key deviation from the plan as written below: an **ADR 0002** was added mid-build (`adr/0002-per-player-views.md`) to fix a real gap the original ADR 0001 explicitly flagged and deferred — the v1 interface broadcast identical state to every client with no way to hide information, which made `card-game` and `trivia` unconvincing as references (a card game showing both hands isn't really a card game). Designed in the main thread per the "never delegate the shared interface" rule below, then implemented directly (not by a subagent) across `packages/core`, `packages/adapter-partykit`, and both affected examples.

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

**Phase 0 — Interface design (sequential, single Claude Code thread). ✅ Done.**
Use the `engineering:architecture` skill to write an ADR for the adapter interface (what a backend must implement: room create/join, state sync, presence, teardown). This interface is the contract everything else depends on — don't parallelize it, and don't let a subagent freelance it.
- Result: `adr/0001-adapter-interface.md` — `RoomDefinition`/`MultiplayerAdapter`, server-authoritative action/reducer model.
- Amended later by `adr/0002-per-player-views.md` (see Status above) once the games built against it exposed a real privacy gap.

**Phase 1 — Core SDK + PartyKit adapter (sequential). ✅ Done.**
Build the reference implementation of the interface against PartyKit first, since it's the default backend the reference games will target. This has to land and be tested before Phase 2 forks.
- Result: `packages/core` (types + `RoomEngine`), `packages/adapter-partykit`. 19 unit tests + a live smoke test against a real `partykit dev` server (not just mocks) before moving on.

**Phase 2 — Parallelize once the interface is frozen. ✅ Done.**
These are independent files/packages, so this is where subagents actually pay off — each one only needs the frozen interface, not this conversation's history:
- ~~Colyseus adapter~~ — post-MVP per `CLAUDE.md`, not started.
- ~~Supabase Realtime adapter~~ — post-MVP, not started.
- MCP server + Claude Code/Cursor plugin manifests — done.
- The three reference games (tic-tac-toe, card game, trivia) — done, ran as three parallel sub-tasks.
- Docs site — post-MVP, not started.

Run these either as Cowork `Agent` calls with `isolation: "worktree"` (each gets its own git worktree, safe to run concurrently), or as separate Claude Code CLI sessions on separate worktrees if you're driving from the terminal. Either way, each agent should be handed only: the ADR, the frozen interface file(s), and its one package — not the whole build plan or prior chat history. That's the actual cost savings: a fresh subagent with a narrow brief burns far fewer tokens than continuing one long thread that's seen everything.

**What actually happened, worth remembering:**
- All 4 parallel worktree branches merged cleanly (only `package-lock.json` conflicted, twice — resolved by regenerating via `npm install` rather than hand-editing).
- Each subagent reported its own tests/smoke-test passing. **That wasn't sufficient** — re-running everything on `master` after merging surfaced two real bugs the subagents' own runs had missed:
  1. `card-game`'s live smoke test intermittently hung. Root cause: an ambiguous "wait for the next sync" pattern in the test client raced against the fact that a single flip and a fully-resolved round both broadcast as a plain sync message. Fixed with a monotonic `roundsResolved` counter in state. Also fixed a genuinely flaky unit test (200-round guard, real worst case observed at 422 rounds).
  2. Worktree agents left their own `partykit dev` background processes running on shared ports (1999/2000/2001/2002) after finishing. Re-verifying `card-game` live initially looked broken because it was accidentally talking to a **stale leaked server still running old, unpatched code** on the same port. Always kill leaked `partykit dev` processes (check `Get-CimInstance Win32_Process` for `partykit`) before starting your own on a port a subagent used.
  3. (Found later, same root cause as #2's category) `trivia`'s smoke test used a hardcoded `roomId`; a second run against the same long-lived dev server reconnected to a room already left `'finished'` by the first run. Fixed by timestamping the room id, matching `card-game`'s existing pattern.
- Lesson for future phases: **a subagent's "tests pass" is a claim, not a verification** — always re-run tests and any live smoke test yourself after merging, on the actual merged `master` state.

**Phase 3 — Testing & review. ✅ Done.**
`engineering:testing-strategy` to define coverage (unit tests per adapter against a mock backend, integration test per example game). `engineering:code-review` on each package before merging. Run tests for real — don't mark this done on a subagent's say-so.
- Coverage already in place from Phases 1-2: unit tests per package/example (vitest) + a live smoke test per game/adapter against a real `partykit dev` server.
- Ran a high-effort `/code-review` pass over `packages/` and `examples/`. One real finding: `adapter-partykit`'s `#broadcastSync()` (the per-connection loop ADR 0002 introduced) wasn't failure-isolated — a throwing `toClientView` for one player could abort the loop mid-iteration (leaving other connections on stale state) and, because it ran inside `onMessage`'s action try/catch, could misreport a successful action as rejected to the acting player.
- Fixed: each connection's view/serialize/send in `#broadcastSync` is now independently try/caught, and it's called outside the action try/catch so it structurally can't be mistaken for an action failure. New regression test proves a later-iterated player's sync survives an earlier player's broken view. Re-verified: 15/15 adapter tests, 65/65 full workspace, and a live smoke test, all after the fix.

**Phase 4 — Launch prep. 🔶 Claude's parts done, human parts pending.**
`engineering:deploy-checklist` before `npm publish`. Draft the marketplace submission (Claude Code plugin directory PR, Cursor Marketplace listing) content here, but per the build plan, the actual submission review process and creator outreach are things you do by hand, not Claude.
- Full checklist in `DEPLOY_CHECKLIST.md`, split into done-by-Claude vs. human-only items.
- Root `README.md`, `.github/workflows/ci.yml`, and npm-publish-ready `package.json`s (repository/homepage/bugs/keywords/publishConfig, versions bumped `0.0.1` → `0.1.0`) for the three publishable packages, verified with `npm publish --dry-run` (which caught `packages/core` having no `README.md` at all — fixed).
- Caught while reviewing for launch: both plugin manifests (`plugin-claude-code`, `plugin-cursor`) and the MCP server's own `get_room_definition_guide` tool content had shipped *before* ADR 0002 and never got updated — they were telling an agent to write privacy-incapable `RoomDefinition`s. Fixed in all three, with the MCP server's guide's test coverage extended to check for the new content. Lesson: a "done" package can go stale when a later architectural decision changes the contract it depends on — worth a deliberate check whenever an ADR is added or amended, not just when directly touching the affected files.
- npm registry checked (read-only `npm view`) to confirm the `@multiplayer-agent-sdk` package names aren't already taken — they aren't.
- Did not run `npm publish`, open the `claude-plugins-official` PR, or submit to Cursor's Marketplace — all require the human's credentials/account per the build plan.

**Phase 5 — Post-launch bugfix (ADR 0003). ✅ Done.**
Found via a live game built *against* this SDK (a team-based Battleship game, run against a real Cloudflare Durable Object deployment) — not via anything in this repo's own test suite, which is exactly why it slipped through Phases 1-3.

- **The bug:** `RoomEngine` (core) and `adapter-partykit`'s server both kept all state in plain in-memory class fields, with no call to storage anywhere. A PartyKit room runs on a hibernating Durable Object; PartyKit's own docs say plainly that the `Party.Server` instance gets torn down and reconstructed between events while the underlying WebSocket connections survive. The consuming game hit this directly: mid-session, with real players connected, the entire room (both team rosters, both fleets, whose turn it was) silently reset to a fresh `createState()`. Nothing threw or logged anything — it just quietly forgot the game existed. A second, related symptom: the server's connection-id-to-player map is also only in memory, so after a wake, `onMessage` from an already-connected player would find no matching entry and silently drop the message (the existing `if (!player) return` guard, doing exactly what it says, just now doing it for every message instead of only truly-stray ones).
- **The fix:** `RoomEngine` gained an optional `restore` constructor argument and a `snapshot()` method (`{ state, players }`, both JSON-safe) — additive, every existing call site unaffected. `adapter-partykit`'s `onConnect`/`onMessage`/`onClose` became `async` (PartyKit's own lifecycle methods already support this) and each now awaits persisting the snapshot to `room.storage` *before* broadcasting — not after, and not fire-and-forget, so a wake can never resurrect a state older than what clients were already told. A new `onStart()` — which PartyKit guarantees runs before the first event, including after a wake — restores it. Full design rationale and alternatives considered: ADR 0003.
- **Verification, three layers deep, matching this repo's own "don't accept 'tests pass' without re-running it yourself" lesson from Phase 2:**
  1. New unit tests that simulate a wake by constructing a second `Server` instance against a shared fake `room.storage` (a plain `Map` with async get/put) — mirroring PartyKit's own documented sequence, not a real process.
  2. The *existing* live smoke test (`smoke:server` + `smoke:client`, a real `partykit dev` process), unchanged, re-run and still passing — proving the new async code paths didn't break normal live wiring.
  3. A live process **kill and restart** of that same `partykit dev` process mid-session (not a simulation): connected, incremented a counter to a known value, force-killed the OS process, started a fresh one against the same `--persist`-ed local storage directory, reconnected, and confirmed the counter's value survived exactly — this is the actual failure mode from the consuming game, reproduced and proven fixed against the real backend, not a mock.
  4. Full workspace `build`/`typecheck`/`test` re-run clean afterward (7 test files, all packages + all 3 example games).
- **Lesson for future phases:** this repo's own test suite (mocks + a single short-lived smoke-test process) structurally cannot catch a hibernation-shaped bug, because nothing in it is ever idle long enough to be evicted. A "does this survive the object being torn down and rebuilt mid-session" check is now something to deliberately test for on any future adapter (Colyseus, Supabase), not just something the unit-test/smoke-test split happens to cover.

## Skill vs. subagent — the rule of thumb

- **Skill**: shared process/knowledge, no isolation needed, called inline in whichever thread is doing the work (ADR template, test strategy, docs structure, deploy checklist).
- **Subagent (worktree)**: an independent unit of code touching files nothing else touches, where starting fresh (no shared history) is a feature, not a loss.
- Never hand the shared interface, the merge step, or architectural decisions to a subagent — those need continuity in one thread to avoid drift and merge conflicts.

## Reusable skill built from this plan

Proposed and available now: `agent-native-build-orchestrator` — takes any future build-plan.md for an agent-native tool (SDK/MCP server/Claude Code or Cursor plugin) and runs this same scaffold → core-vs-parallel split → skill mapping, without re-deriving it from scratch each time.

## Sources
- `multiplayer-agent-sdk-build-plan.md` (same folder)
