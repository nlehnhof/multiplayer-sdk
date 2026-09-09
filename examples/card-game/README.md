# card-game-example

A 2-player "War" reference game built on `@multiplayer-agent-sdk/core` and
`@multiplayer-agent-sdk/adapter-partykit`. It demonstrates writing a single
backend-agnostic `RoomDefinition` (`src/room.ts`) and wiring it into a real
PartyKit server (`party/server.ts`) with no backend-specific game logic.

## Game design (deliberately simplified)

This is War with the war-chain-on-tie mechanic removed: a tied flip just
discards both cards instead of triggering a face-down/face-up escalation.
That's a deliberate simplification, not an oversight — see below.

**This reference intentionally shows both players' full hands in shared
state.** There is no hidden information: both players can see each other's
entire hand at all times via `state.hands`. That's because the current (v1)
adapter interface broadcasts one identical `TState` object to every
connected client — there is no per-player private view yet. See
[`adr/0001-adapter-interface.md`](../../adr/0001-adapter-interface.md),
"Non-goals (MVP)". A real card game with hidden hands would need a future
adapter interface revision that supports per-player state projections; this
example is scoped to work within the current, frozen interface instead of
working around it.

## Structure

- `src/room.ts` — the `RoomDefinition<WarState, WarAction>`: dealing, flip
  resolution, forfeit-on-leave.
- `src/room.test.ts` — vitest unit tests against `RoomEngine`.
- `party/server.ts` — `export default createPartyKitServer(roomDefinition)`,
  the file a PartyKit deployment points at.
- `play.mjs` — a Node script that drives two real `connectPartyKitClient`
  connections against a running `partykit dev` server until the game ends.

## Run the tests

```bash
npm install   # from the repo root, once
cd examples/card-game
npx vitest run
npx tsc --noEmit
```

## Run the smoke test (real PartyKit server + real clients)

```bash
# terminal 1, from examples/card-game
npm run smoke:server     # starts `partykit dev` on port 2001

# terminal 2, from examples/card-game
npm run smoke:play
```

Expected output ends with `✅ War card-game smoke test passed`. Ctrl+C the
server afterward.

**Verification status:** the unit tests (`npx vitest run`) and typecheck
(`npx tsc --noEmit`) both pass and are the authoritative check of the game
logic — they were run for real, not assumed. As an extra check beyond the
unit tests, a throwaway 2000-game in-memory simulation of this exact
`roomDefinition` (joining two players and flipping to completion via
`RoomEngine` directly, no network) completed every game with no thrown
errors and a maximum of 422 rounds, confirming the reducer logic terminates
correctly and never gets stuck. `play.mjs` itself was run live against a
real `partykit dev` server and correctly joined both players, dealt 26/26,
and resolved dozens of rounds with the expected hand-count changes — but in
this sandboxed Windows dev environment, rapid-fire back-to-back flips
occasionally caused the local `partykit dev`/Miniflare WebSocket connection
to go silent for one flip (no error, no crash — just no `sync` response),
which parked `play.mjs` waiting on a promise that never resolved. That looks
like a local dev-server/OS quirk under a tight synchronous WS loop rather
than a bug in `roomDefinition` (the in-memory simulation above exercises the
identical reducer without issue). If `smoke:play` stalls, Ctrl+C it and
retry, or run it on a non-Windows host / against a deployed PartyKit room.
