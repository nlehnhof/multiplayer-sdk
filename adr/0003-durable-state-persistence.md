# ADR 0003: Durable State Persistence Across Hibernation

**Status:** Accepted
**Amends:** ADR 0001, which shipped `RoomEngine` and `adapter-partykit` as purely in-memory and didn't flag that as a limitation.

## Context

A PartyKit room runs on a Cloudflare Durable Object under the hood. PartyKit's own docs are explicit about what a hibernation cycle does: "the `Party.Server` instance is unallocated by the platform... As soon as a client sends a message, a new Server is instantiated and the constructor... executed again." The underlying WebSocket connections survive; everything else in memory does not.

`RoomEngine` (`packages/core/src/room-engine.ts`) and `adapter-partykit`'s server (`packages/adapter-partykit/src/server.ts`) kept all state in plain class fields — `RoomEngine.state`/`.players`, and the server's own `connection.id -> PlayerInfo` map — with no call to `room.storage` anywhere. That's invisible in the unit tests (mocks never hibernate) and even in the existing live smoke test (a single short-lived process, never idle long enough to be evicted). It is not invisible in real use: a live test built against this SDK (a team-based Battleship game, run against a real Cloudflare Durable Object) hit this directly — the entire game (both team rosters, both fleets, whose turn it was) silently reset to a fresh `createState()` the moment the object was evicted between two turns, which is exactly the shape of gap a real idle-between-moves party game will always eventually hit. Nothing errored; the game just quietly forgot it existed.

A second, related failure mode: the server's `#playerByConnectionId` map is what turns a raw `onMessage(message, sender)` call back into a game-level player id. If that map is empty after a wake (which it is — it's a fresh instance), `onMessage`'s existing `if (!player) return` guard means every message from an already-connected player is silently dropped, with no error to anyone, until that connection is closed and reopened.

## Decision

**`RoomEngine` gains an optional restore path and a snapshot method, additive and backward-compatible:**

```typescript
export interface RoomEngineSnapshot<TState, TMeta = unknown> {
  state: TState;
  players: [string, PlayerInfo<TMeta>][];
}

export class RoomEngine<TState, TAction, TMeta = unknown> {
  constructor(
    definition: RoomDefinition<TState, TAction, TMeta, any>,
    restore?: RoomEngineSnapshot<TState, TMeta>
  ) { /* … */ }

  snapshot(): RoomEngineSnapshot<TState, TMeta> { /* … */ }
  // currentState, presence, join, leave, action: unchanged
}
```

`new RoomEngine(definition)` with no second argument behaves exactly as before — every existing call site (all three reference games, the adapter itself) compiles and behaves identically. `RoomEngine` itself still does not talk to storage; it stays a plain, backend-agnostic bookkeeping helper, consistent with ADR 0001's layering. Persisting and restoring the snapshot is the adapter's job, because *when* and *where* to persist is backend-specific (a Durable Object's `ctx.storage`/`room.storage`, a different platform's equivalent, or nothing at all for a backend that never evicts).

**`adapter-partykit`'s server persists after every mutation and restores in `onStart`:**

- `onConnect`, `onMessage`, and `onClose` are now `async` (PartyKit's own lifecycle methods already support this — see its docs' own examples, which declare all four as `async`) and each `await`s a `#persist()` call — writing both `RoomEngine.snapshot()` and the connection-id-to-player-id map to `room.storage` — **before** calling `#broadcastSync()`. Persist-before-broadcast, not the reverse and not fire-and-forget: if the instance were evicted after clients heard about a change but before the write landed, a wake would resurrect the *previous* state while clients had already moved on, which is worse than a plain delay.
- `onStart()` is added: PartyKit guarantees it runs before the first `onConnect`/`onMessage`/`onRequest`, including after a wake. It reads both persisted values and, if present, reconstructs `#engine` via `new RoomEngine(definition, snapshot)` and rebuilds the connection-id map. With nothing in storage yet (first-ever start), it's a no-op and behavior is unchanged from before this ADR.
- The server's own connection registry was simplified from `Map<connectionId, PlayerInfo<TMeta>>` to `Map<connectionId, string>` (just the game-level player id) while making this change — every read site only ever used `.id` off the stored `PlayerInfo`, and `RoomEngine`'s own restored map already carries the full `PlayerInfo` for presence/view purposes, so the server no longer needs a second copy of it.

## Alternatives considered

- **Leave `RoomEngine` in-memory-only and put all persistence logic in the adapter, snapshotting `RoomEngine`'s private fields via ad-hoc reflection or by exposing them directly:** rejected — it breaks encapsulation for no benefit, and every future adapter (Colyseus, Supabase) would have to reinvent the same snapshot shape instead of getting it from `RoomEngine.snapshot()` for free.
- **Debounce/batch persistence (e.g. persist on a timer, or only every N actions) instead of after every mutation:** rejected for MVP — the room sizes and action rates this SDK targets (2-6 players, turn-based/casual) make per-mutation `room.storage.put` cheap relative to the risk of losing a window of unpersisted state to an untimely eviction. Worth revisiting only if a future game's action rate makes this measurably costly.
- **Session-resumption instead of/alongside this** (recognizing a reconnecting player and not re-running `onJoin`): still explicitly out of scope, per ADR 0001's own "Non-goals (MVP)" — this ADR fixes state surviving the *server* disappearing and coming back, not a *client* disappearing and coming back with a new connection.

## Consequences

- Additive, backward-compatible: `tic-tac-toe`, `card-game`, and `trivia` all compile and pass their existing suites unchanged.
- Every `adapter-partykit`-hosted game now survives a hibernation/wake cycle with no visible effect on players — verified three ways: (1) new unit tests that reconstruct a fresh server instance against a shared fake `room.storage`, simulating exactly the sequence PartyKit's own docs describe; (2) the existing live smoke test, unchanged, still passing against a real `partykit dev` process; (3) a live process kill-and-restart of that same `partykit dev` process mid-session, confirming the counter example's state (not just mocked state) survives an actual, not simulated, restart.
- `room.storage` value-size limits (128 KiB per key, per PartyKit's docs) now bound how large a `RoomDefinition`'s `TState` plus its player roster can practically get. Not a concern for this SDK's stated target (2-6 player casual games), but worth surfacing in the adapter's README for anyone pushing larger state.
- `#persist()` adds one or two `room.storage.put` round-trips to every join/action/leave. Not measured against a real deployment yet; flagged here rather than assumed free.

## Non-goals (still, post-ADR-0003)

- Client-side session resumption (a reconnecting *client* being recognized as the same player without re-running `onJoin`) — separate problem, still out of scope per ADR 0001.
- Persistence for any backend other than `adapter-partykit` — `RoomEngine`'s new `restore`/`snapshot` are available to any future adapter, but wiring them up (Colyseus, Supabase) is that adapter's own work when it's built.
