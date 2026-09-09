import type { PlayerInfo, RoomDefinition } from './types.js';

/**
 * Shared player-bookkeeping + hook-dispatch logic every adapter would
 * otherwise have to reimplement. Adapters wire transport events
 * (connect/message/close) to these three methods and broadcast the
 * resulting state/presence themselves.
 */
export class RoomEngine<TState, TAction, TMeta = unknown> {
  private state: TState;
  private readonly players = new Map<string, PlayerInfo<TMeta>>();

  constructor(private readonly definition: RoomDefinition<TState, TAction, TMeta>) {
    this.state = definition.createState();
  }

  get currentState(): TState {
    return this.state;
  }

  get presence(): PlayerInfo<TMeta>[] {
    return [...this.players.values()];
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
