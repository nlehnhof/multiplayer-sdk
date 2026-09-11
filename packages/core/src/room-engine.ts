import type { PlayerInfo, RoomDefinition } from './types.js';

/**
 * A plain, JSON/structured-clone-safe snapshot of everything a RoomEngine
 * needs to resume exactly where it left off. See `RoomEngine.snapshot()`
 * and ADR 0003.
 */
export interface RoomEngineSnapshot<TState, TMeta = unknown> {
  state: TState;
  /** `[playerId, PlayerInfo]` entries — a plain array, not a Map, so this survives storage round-trips as-is. */
  players: [string, PlayerInfo<TMeta>][];
}

/**
 * Shared player-bookkeeping + hook-dispatch logic every adapter would
 * otherwise have to reimplement. Adapters wire transport events
 * (connect/message/close) to these three methods and broadcast the
 * resulting state/presence themselves.
 *
 * Instances are plain in-memory objects — nothing here talks to storage.
 * On any platform that can evict a live instance between requests (e.g. a
 * hibernating Durable Object, which is exactly how PartyKit rooms run), an
 * adapter MUST persist `snapshot()` after every join/leave/action and pass
 * it back in as `restore` when reconstructing, or state silently resets to
 * `createState()` the next time the instance is torn down and rebuilt. See
 * ADR 0003 — this was a real bug in `adapter-partykit`, caught by a live
 * test that hibernated the room mid-game and watched the roster reset.
 */
export class RoomEngine<TState, TAction, TMeta = unknown> {
  private state: TState;
  private readonly players: Map<string, PlayerInfo<TMeta>>;

  // TView isn't parameterized here: RoomEngine never calls toClientView, so
  // it accepts a RoomDefinition with any view type rather than threading a
  // TView generic through a class that has no use for it.
  constructor(
    private readonly definition: RoomDefinition<TState, TAction, TMeta, any>,
    restore?: RoomEngineSnapshot<TState, TMeta>
  ) {
    this.state = restore ? restore.state : definition.createState();
    this.players = new Map(restore?.players ?? []);
  }

  get currentState(): TState {
    return this.state;
  }

  get presence(): PlayerInfo<TMeta>[] {
    return [...this.players.values()];
  }

  /** See the class-level doc comment — pass this to the constructor's `restore` parameter to resume. */
  snapshot(): RoomEngineSnapshot<TState, TMeta> {
    return { state: this.state, players: [...this.players.entries()] };
  }

  join(player: PlayerInfo<TMeta>): TState {
    const maxPlayers = this.definition.options?.maxPlayers;
    if (maxPlayers !== undefined && this.players.size >= maxPlayers) {
      throw new Error(`Room is full (max ${maxPlayers} players)`);
    }
    this.state = this.definition.onJoin(this.state, player);
    this.players.set(player.id, player);
    return this.state;
  }

  leave(playerId: string): TState {
    const player = this.players.get(playerId);
    if (!player) return this.state;
    this.state = this.definition.onLeave(this.state, player);
    this.players.delete(playerId);
    return this.state;
  }

  action(playerId: string, action: TAction): TState {
    const player = this.players.get(playerId);
    if (!player) {
      throw new Error(`Action from unknown player: ${playerId}`);
    }
    this.state = this.definition.onAction(this.state, action, player);
    return this.state;
  }
}
