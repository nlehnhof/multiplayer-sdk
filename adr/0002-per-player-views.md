# ADR 0002: Per-Player State Views

**Status:** Accepted
**Amends:** ADR 0001, which shipped without this and explicitly listed it as a non-goal. This ADR fills that gap.

## Context

ADR 0001's adapter broadcasts one identical `TState` object to every connected client (`room.broadcast()` in the PartyKit adapter). That's wrong for most multiplayer games: a card game needs to hide opponents' hands, a trivia game needs to hide other players' answers until reveal, a hidden-role game needs to hide role assignments from everyone but the assigned player. Only a genuinely fully-public game (tic-tac-toe: the whole board is always visible to both players) is correctly served by the current behavior.

This gap was already visible in the two reference games built against ADR 0001: `examples/card-game` (War) shows both hands in full to both players, and `examples/trivia` shows submitted answers before reveal. Both READMEs flagged it as a known limitation. This ADR resolves it rather than leaving it as permanent tech debt.

## Decision

Add an **optional** per-player view hook to `RoomDefinition`:

```typescript
export interface RoomDefinition<TState, TAction, TMeta = unknown, TView = TState> {
  createState(): TState;
  onJoin(state: TState, player: PlayerInfo<TMeta>): TState;
  onLeave(state: TState, player: PlayerInfo<TMeta>): TState;
  onAction(state: TState, action: TAction, player: PlayerInfo<TMeta>): TState;
  options?: RoomOptions;

  /**
   * Optional per-player projection of the authoritative state, computed
   * fresh every time state is broadcast. Omit it for a fully-public game —
   * the adapter then sends the raw TState to everyone, identical to
   * pre-ADR-0002 behavior. TView defaults to TState so this is additive:
   * no existing RoomDefinition needs to change.
   */
  toClientView?(state: TState, viewerId: string): TView;
}
```

`MultiplayerAdapter` and `RoomConnection` are updated so the *client's* state type is `TView`, not `TState` — a game author's client code only ever sees what `toClientView` (or the identity default) produces, never the raw authoritative state:

```typescript
export interface MultiplayerAdapter {
  createServer<TState, TAction, TMeta = unknown, TView = TState>(
    definition: RoomDefinition<TState, TAction, TMeta, TView>
  ): unknown;

  connectClient<TView, TAction, TMeta = unknown>(
    config: ClientConnectConfig<TMeta>
  ): RoomConnection<TView, TAction, TMeta>;
}
```

**Adapter implementation change (PartyKit):** `broadcastSync()` changes from one `room.broadcast(json)` call to iterating each known connection, computing that player's view (`definition.toClientView?.(state, playerId) ?? state`), and sending each connection its own `connection.send(json)`. This is O(players) sends instead of one broadcast — for the room sizes this SDK targets (2-6 players, per the build plan's ICP), that cost is negligible.

**`RoomEngine` is unchanged.** Views are a wire-serialization concern (what does *this connection* get sent), not a game-state concern (what *is* the state) — `RoomEngine` still manages one authoritative `TState` and player bookkeeping exactly as before. This keeps the change additive and low-risk: nothing about join/leave/action logic changes.

**Presence is not filtered.** `PlayerInfo[]` (who's connected, their `meta`) is still sent identically to everyone. Per-player redaction of presence/meta is a plausible future need but out of scope here — nothing in the two examples that motivated this ADR needs it.

## Alternatives considered

- **Separate "public state" + "private state" fields on `TState` itself, with the adapter stripping private fields per-recipient by convention** (e.g. a reserved `_private: Record<playerId, unknown>` key): rejected — it's more magic (a naming convention instead of a typed hook), and doesn't let the view depend on more than field presence (e.g. "show opponent's hand *count* but not contents" needs a real transform, not just field-stripping).
- **Two authoritative state trees (public + per-player private), merged only on the client**: rejected as over-engineered for MVP — it doubles what `RoomDefinition` authors have to reason about (two state shapes instead of one, plus a merge step) for a problem a single derived-view function solves more simply.

## Consequences

- Additive, backward-compatible: every `RoomDefinition` written before this ADR (tic-tac-toe) compiles and behaves identically, since `TView` defaults to `TState` and `toClientView` is optional.
- Game authors who need hidden information write one pure function (`(state, viewerId) => view`) instead of restructuring their reducer — consistent with ADR 0001's bet on simple, agent-generatable shapes.
- `toClientView` must be pure and cheap: it now runs once per connection on every state change, not once per broadcast.
- `examples/card-game` (War) is retrofitted to actually hide opponents' hand contents (showing hand *count* only) — this was the concrete motivating gap.
- `examples/trivia` is retrofitted to hide other players' submitted answers until the `reveal` phase — same motivation, different shape (a boolean "has answered" instead of a redacted array).
- `examples/tic-tac-toe` is intentionally left unchanged — the whole board is meant to be public, so it correctly uses the identity default.

## Non-goals (still, post-ADR-0002)

- Filtering `PlayerInfo`/presence per viewer.
- Field-level or automatic redaction (e.g. a decorator/annotation system) — `toClientView` is a plain hand-written function, deliberately no framework around it for MVP.
