# @multiplayer-agent-sdk/core

Backend-agnostic types and room-state engine for the [Multiplayer Agent SDK](https://github.com/nlehnhof/multiplayer-sdk) — write your game's multiplayer logic once, then run it on any supported realtime backend (see [`@multiplayer-agent-sdk/adapter-partykit`](https://www.npmjs.com/package/@multiplayer-agent-sdk/adapter-partykit)).

You write a `RoomDefinition`: pure functions describing how your game's state starts, changes when a player joins/leaves, and changes when a player acts. This package never talks to a network — an adapter package wraps your definition to actually run it on a backend.

```ts
import type { RoomDefinition } from '@multiplayer-agent-sdk/core';

interface CounterState {
  count: number;
}
type CounterAction = { type: 'increment' } | { type: 'decrement' };

export const counterRoom: RoomDefinition<CounterState, CounterAction> = {
  createState: () => ({ count: 0 }),
  onJoin: (state) => state,
  onLeave: (state) => state,
  onAction: (state, action) => {
    if (action.type === 'increment') return { count: state.count + 1 };
    if (action.type === 'decrement') return { count: state.count - 1 };
    return state;
  },
};
```

## Hiding information per player

By default every connected client sees the same state. If your game has hidden information (a card game's opponent hands, a trivia game's not-yet-revealed answers), add `toClientView`:

```ts
toClientView: (state, viewerId) => ({
  myHand: state.hands[viewerId],
  opponentCardCount: state.hands[otherPlayerId(state, viewerId)].length,
}),
```

See the [adapter interface ADR](https://github.com/nlehnhof/multiplayer-sdk/blob/master/adr/0001-adapter-interface.md) and the [per-player views ADR](https://github.com/nlehnhof/multiplayer-sdk/blob/master/adr/0002-per-player-views.md) for the full design rationale, and the [`card-game`](https://github.com/nlehnhof/multiplayer-sdk/tree/master/examples/card-game) and [`trivia`](https://github.com/nlehnhof/multiplayer-sdk/tree/master/examples/trivia) examples for two worked patterns.

## Surviving a backend that can evict your room from memory

`RoomEngine` itself is a plain in-memory object — it never talks to storage. On a backend that can tear down and reconstruct a live room instance between requests (a hibernating Durable Object, which is how PartyKit rooms run), an adapter must persist a snapshot after every mutation and restore it when reconstructing, or your game's state silently resets. `RoomEngine` supports this directly:

```ts
// after any join/leave/action, whenever your adapter needs to persist:
const snapshot = engine.snapshot(); // JSON/structured-clone-safe: { state, players }

// when reconstructing, before handling the next event:
const engine = new RoomEngine(myRoomDefinition, snapshot); // omit `snapshot` for a brand-new room
```

See [ADR 0003](https://github.com/nlehnhof/multiplayer-sdk/blob/master/adr/0003-durable-state-persistence.md) for why this exists — `@multiplayer-agent-sdk/adapter-partykit` already wires this up for you, so you only need this directly if you're writing a new adapter.

## What's exported

- `RoomDefinition<TState, TAction, TMeta, TView>` — the interface you implement.
- `RoomEngine` — used by adapters (not typically by game authors) to manage player bookkeeping and dispatch your hooks; useful directly in unit tests, since it lets you drive your `RoomDefinition` without a real network connection (see this repo's example games' `*.test.ts` files for the pattern).
- `RoomEngineSnapshot<TState, TMeta>` — the shape `RoomEngine.snapshot()` returns and `new RoomEngine(definition, snapshot)` accepts; see above.
- `PlayerInfo`, `RoomOptions`, `MultiplayerAdapter`, `RoomConnection`, `ClientConnectConfig` — supporting types.

## Status

Part of the Multiplayer Agent SDK's MVP. See the [repo README](https://github.com/nlehnhof/multiplayer-sdk#readme) for the full picture and [`CLAUDE.md`](https://github.com/nlehnhof/multiplayer-sdk/blob/master/CLAUDE.md) for scope/roadmap.
