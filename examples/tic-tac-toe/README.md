# tic-tac-toe example

A reference implementation of the Multiplayer Agent SDK's core pattern — a
`RoomDefinition` plus the PartyKit adapter — using a familiar 2-player game.

## What this demonstrates

- Writing a `RoomDefinition<TState, TAction>` (`src/room.ts`) against
  `@multiplayer-agent-sdk/core` only — no adapter import in the game logic.
- Turn-order enforcement, move validation (occupied cells, out-of-range
  cells, moves after game-over), win detection across all 8 lines, draw
  detection, and forfeit-on-leave, all as pure `onJoin`/`onLeave`/`onAction`
  reducers driven through `RoomEngine` (see `src/room.test.ts`).
- Wrapping that definition into a deployable PartyKit party
  (`party/server.ts`) with `createPartyKitServer`.
- Driving a real game over a real PartyKit dev server with
  `connectPartyKitClient` from a plain Node script (`play.mjs`).

**Note on shared state:** tic-tac-toe has no hidden information — the full
board is visible to both players at all times, so this example doesn't
exercise per-player state filtering. If you need that (e.g. a card game
where each player only sees their own hand), see the `card-game` example
instead; the adapter always syncs the *whole* `TState` to every client, so
hiding information means keeping it out of `TState` entirely (or encoding it
per-player and filtering client-side, which is on the game author, not the
SDK).

## Setup

From the repo root:

```bash
npm install
npm run build --workspace=@multiplayer-agent-sdk/core --workspace=@multiplayer-agent-sdk/adapter-partykit
```

## Unit tests

```bash
cd examples/tic-tac-toe
npm test        # vitest run
npm run typecheck
```

Covers: symbol assignment on join, 3rd-join rejection (via `RoomEngine`'s
`maxPlayers`), turn-order enforcement, rejecting a move on an occupied cell,
rejecting an out-of-range cell, detecting a row/column/diagonal win,
detecting a draw, rejecting moves after the game is over, and forfeiting to
the other player when someone leaves mid-game.

## Smoke test (real PartyKit server, real WebSocket clients)

The unit tests above exercise `room.ts` in isolation via `RoomEngine`. The
smoke test instead runs a real `partykit dev` server and plays a full game
over real WebSocket connections, end to end.

```bash
# terminal 1, from examples/tic-tac-toe
npm run smoke:server    # partykit dev on port 2000 (not 1999, to avoid
                         # colliding with adapter-partykit's own smoke test)

# terminal 2, from examples/tic-tac-toe
npm run smoke:play
```

`play.mjs` connects two players (`x-player`, `o-player`), plays a
deterministic game where X wins the top row (cells 0, 1, 2), and asserts the
board/turn/status/winner at each step. Expected output ends with
`✅ tic-tac-toe smoke test passed`. Ctrl+C the server afterward.
