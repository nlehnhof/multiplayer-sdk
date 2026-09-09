export interface PlayerInfo<TMeta = unknown> {
  id: string;
  meta?: TMeta;
  connectedAt: number;
}

export interface RoomOptions {
  /** Reject joins once this many players are present. */
  maxPlayers?: number;
  /** Adapters may tear the room down after this much inactivity. */
  idleTimeoutMs?: number;
}

/**
 * Backend-agnostic game logic. Written once per game; never imports an adapter.
 * All hooks are pure: given state + input, return the next state (throw to reject).
 */
export interface RoomDefinition<TState, TAction, TMeta = unknown, TView = TState> {
  createState(): TState;
  onJoin(state: TState, player: PlayerInfo<TMeta>): TState;
  onLeave(state: TState, player: PlayerInfo<TMeta>): TState;
  onAction(state: TState, action: TAction, player: PlayerInfo<TMeta>): TState;
  options?: RoomOptions;
  /**
   * Optional per-player projection of the authoritative state, computed
   * fresh every time state is broadcast. Omit it for a fully-public game —
   * the adapter then sends the raw TState to everyone. See
   * adr/0002-per-player-views.md.
   */
  toClientView?(state: TState, viewerId: string): TView;
}

export interface ClientConnectConfig<TMeta = unknown> {
  roomId: string;
  /** Backend-specific connection info, e.g. a PartyKit host. */
  host?: string;
  player: { id: string; meta?: TMeta };
}

export type Unsubscribe = () => void;

/** `TView` is whatever `RoomDefinition.toClientView` produces (or `TState` if omitted) — a client never sees the raw authoritative state directly. */
export interface RoomConnection<TView, TAction, TMeta = unknown> {
  readonly state: TView;
  readonly presence: PlayerInfo<TMeta>[];
  send(action: TAction): void;
  onStateChange(cb: (state: TView) => void): Unsubscribe;
  onPresenceChange(cb: (players: PlayerInfo<TMeta>[]) => void): Unsubscribe;
  disconnect(): void;
}

/** Implemented once per realtime backend (PartyKit, Colyseus, Supabase, ...). */
export interface MultiplayerAdapter {
  createServer<TState, TAction, TMeta = unknown, TView = TState>(
    definition: RoomDefinition<TState, TAction, TMeta, TView>
  ): unknown;

  connectClient<TView, TAction, TMeta = unknown>(
    config: ClientConnectConfig<TMeta>
  ): RoomConnection<TView, TAction, TMeta>;
}
