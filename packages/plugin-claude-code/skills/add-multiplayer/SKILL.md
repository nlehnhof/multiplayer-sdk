---
name: add-multiplayer
description: Use when adding real-time multiplayer to an existing single-player or local-state game (card games, trivia, tic-tac-toe, 2-6 player casual games) using the Multiplayer Agent SDK. Covers writing a RoomDefinition and wiring it to a realtime backend adapter (PartyKit by default).
version: 0.0.1
---

# Add multiplayer to a game with the Multiplayer Agent SDK

This SDK adds real-time multiplayer to a game you (or the user) already
built, by wrapping an existing realtime backend (PartyKit by default)
instead of hosting infrastructure itself. It targets 2-6 player turn-based
or casual games — card games, trivia, tic-tac-toe, party games — not
latency-sensitive competitive/action games.

## Step 1: Get the authoritative `RoomDefinition` contract

Before writing any code, get the exact, frozen interface — do not guess its
shape from memory:

- **Preferred:** if the `@multiplayer-agent-sdk/mcp-server` MCP server is
  connected, call its `get_room_definition_guide` tool. It returns the
  `RoomDefinition`/`PlayerInfo`/`RoomOptions` TypeScript interfaces verbatim,
  plus a complete minimal example.
- **Fallback:** read `adr/0001-adapter-interface.md` and
  `packages/core/src/types.ts` in the `multiplayer-agent-sdk` repo directly.

Also call (or read the equivalent of) `list_adapters` to confirm which
backend adapters are actually available — at MVP, only `partykit` is; the
`colyseus` and `supabase` adapters are planned, not usable yet.

## Step 2: Write one `RoomDefinition` for the game's rules

A `RoomDefinition<TState, TAction, TMeta>` is server-authoritative,
reducer-shaped game logic, written once, with **no adapter imports**:

```typescript
export interface RoomDefinition<TState, TAction, TMeta = unknown> {
  createState(): TState;
  onJoin(state: TState, player: PlayerInfo<TMeta>): TState;   // throw to reject the join
  onLeave(state: TState, player: PlayerInfo<TMeta>): TState;
  onAction(state: TState, action: TAction, player: PlayerInfo<TMeta>): TState; // throw to reject the action
  options?: RoomOptions; // maxPlayers, idleTimeoutMs
}
```

Translate the existing game's local state and move-handling logic into this
shape:
- `createState()` — the game's initial state (board, hands, scores, turn
  order, etc).
- `onJoin` / `onLeave` — add/remove the player from state; reject a join by
  throwing (e.g. room full, game already started).
- `onAction` — validate and apply a single player move; throw to reject an
  illegal move (e.g. "not your turn").

**Hard constraint:** `TState` and `TAction` must be JSON-serializable — no
functions, class instances, `Map`, or `Set`. This is required by every
backend adapter, not just an implementation detail of one.

## Step 3: Wire it to a backend adapter

For the PartyKit adapter (the only one available at MVP):

- Server: pass the `RoomDefinition` to `createPartyKitServer` from
  `@multiplayer-agent-sdk/adapter-partykit` to get a deployable PartyKit
  `Party.Server` class.
- Client: call `connectPartyKitClient` from the same package to get a
  `RoomConnection` (`state`, `presence`, `send`, `onStateChange`,
  `onPresenceChange`, `disconnect`) that the game's existing UI can read
  from and dispatch actions to.

See `packages/adapter-partykit/README.md` in the SDK repo for the exact
call signatures and local-dev setup.

## Non-goals

Do not build matchmaking/lobby/discovery, reconnection/session-resumption
beyond a basic reconnect, or state diffing — these are explicitly out of
scope for the SDK at this stage (see `adr/0001-adapter-interface.md`,
"Non-goals (MVP)").
