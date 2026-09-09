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
export interface RoomDefinition<TState, TAction, TMeta = unknown> {
  createState(): TState;
  onJoin(state: TState, player: PlayerInfo<TMeta>): TState;
  onLeave(state: TState, player: PlayerInfo<TMeta>): TState;
  onAction(state: TState, action: TAction, player: PlayerInfo<TMeta>): TState;
  options?: RoomOptions;
}

export interface ClientConnectConfig<TMeta = unknown> {
  roomId: string;
  /** Backend-specific connection info, e.g. a PartyKit host. */
  host?: string;
  player: { id: string; meta?: TMeta };
}

export type Unsubscribe = () => void;

export interface RoomConnection<TState, TAction, TMeta = unknown> {
  readonly state: TState;
  readonly presence: PlayerInfo<TMeta>[];
  send(action: TAction): void;
  onStateChange(cb: (state: TState) => void): Unsubscribe;
  onPresenceChange(cb: (players: PlayerInfo<TMeta>[]) => void): Unsubscribe;
  disconnect(): void;
}

/** Implemented once per realtime backend (PartyKit, Colyseus, Supabase, ...). */
export interface MultiplayerAdapter {
  createServer<TState, TAction, TMeta = unknown>(
    definition: RoomDefinition<TState, TAction, TMeta>
  ): unknown;

  connectClient<TState, TAction, TMeta = unknown>(
    config: ClientConnectConfig<TMeta>
  ): RoomConnection<TState, TAction, TMeta>;
}
