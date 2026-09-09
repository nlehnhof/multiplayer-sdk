# card-game-example

A 2-player "War" reference game built on `@multiplayer-agent-sdk/core` and
`@multiplayer-agent-sdk/adapter-partykit`. It demonstrates writing a single
backend-agnostic `RoomDefinition` (`src/room.ts`) and wiring it into a real
PartyKit server (`party/server.ts`) with no backend-specific game logic.

## Game design (deliberately simplified)

This is War with the war-chain-on-tie mechanic removed: a tied flip just
discards both cards instead of triggering a face-down/face-up escalation.
That's a deliberate simplification, not an oversight — see below.

**Hands are private.** Each player's `RoomConnection.state` (the `WarView`
produced by `roomDefinition.toClientView`) exposes only `myHand` (your own
cards) and `handCounts` (everyone's hand *size*, including opponents' — you
can see how many cards they have left, same as in physical play, just not
what they are). The raw `WarState.hands` — every player's actual cards —
never reaches any client; it exists only in the authoritative state the
adapter holds server-side. See
[`adr/0002-per-player-views.md`](../../adr/0002-per-player-views.md), which
this example was the motivating case for. Table cards (`table`), once
flipped, are public to both players — that's already-played information,
same as in physical play.

## Structure

- `src/room.ts` — the `RoomDefinition<WarState, WarAction, unknown, WarView>`:
  dealing, flip resolution, forfeit-on-leave, and `toClientView` (hand privacy).
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

**Verification status:** unit tests and typecheck pass and are the
authoritative check of the game logic. `play.mjs` was additionally run live
against a real `partykit dev` server **11 consecutive times with zero
failures**, each completing in well under a second (typically 100-200
rounds), and asserts both that hand counts update correctly and that the
raw `WarState.hands` never appears in either client's view. An earlier
version of this smoke test had a real race (ambiguous "wait for the next
sync" logic — fixed by waiting on the monotonic `roundsResolved` counter
instead); see the git history for `play.mjs` if you're curious, but it's
resolved and no longer a caveat.
