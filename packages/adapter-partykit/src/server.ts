import type * as Party from 'partykit/server';
import { RoomEngine } from '@multiplayer-agent-sdk/core';
import type { PlayerInfo, RoomDefinition } from '@multiplayer-agent-sdk/core';
import { toErrorMessage, type ActionMessage, type SyncMessage } from './protocol.js';

/**
 * Wraps a backend-agnostic RoomDefinition into a PartyKit `Party.Server` class.
 * The returned class is what a game's `party/server.ts` should default-export.
 *
 * Known MVP limitation: a player id reconnecting with a fresh connection is
 * treated as a brand-new join (RoomDefinition.onJoin runs again) — there is
 * no session-resumption. See ADR 0001, "Non-goals (MVP)".
 */
export function createPartyKitServer<TState, TAction, TMeta = unknown>(
  definition: RoomDefinition<TState, TAction, TMeta>
) {
  // Uses `#private` fields/methods (not the `private` keyword) because TS
  // can't emit a .d.ts for an exported anonymous class with `private`
  // members (TS4094) — true private fields sidestep that entirely.
  return class PartyKitRoomServer implements Party.Server {
    readonly #engine = new RoomEngine(definition);
    readonly #playerByConnectionId = new Map<string, PlayerInfo<TMeta>>();

    constructor(readonly room: Party.Room) {}

    onConnect(connection: Party.Connection, ctx: Party.ConnectionContext): void {
      const url = new URL(ctx.request.url);
      const playerId = url.searchParams.get('playerId') ?? connection.id;
      const metaParam = url.searchParams.get('meta');
      const player: PlayerInfo<TMeta> = {
        id: playerId,
        meta: metaParam ? (JSON.parse(metaParam) as TMeta) : undefined,
        connectedAt: Date.now(),
      };

      try {
        this.#engine.join(player);
      } catch (err) {
        connection.send(JSON.stringify(toErrorMessage(err)));
        connection.close(4000, 'join rejected');
        return;
      }

      this.#playerByConnectionId.set(connection.id, player);
      this.#broadcastSync();
    }

    onMessage(message: string | ArrayBuffer | ArrayBufferView, sender: Party.Connection): void {
      if (typeof message !== 'string') return;
      const player = this.#playerByConnectionId.get(sender.id);
      if (!player) return;

      let parsed: ActionMessage<TAction>;
      try {
        parsed = JSON.parse(message);
      } catch {
        return;
      }
      if (parsed?.type !== 'action') return;

      try {
        this.#engine.action(player.id, parsed.action);
        this.#broadcastSync();
      } catch (err) {
        sender.send(JSON.stringify(toErrorMessage(err)));
      }
    }

    onClose(connection: Party.Connection): void {
      const player = this.#playerByConnectionId.get(connection.id);
      if (!player) return;
      this.#playerByConnectionId.delete(connection.id);
      this.#engine.leave(player.id);
      this.#broadcastSync();
    }

    #broadcastSync(): void {
      const message: SyncMessage<TState, TMeta> = {
        type: 'sync',
        state: this.#engine.currentState,
        presence: this.#engine.presence,
      };
      this.room.broadcast(JSON.stringify(message));
    }
  };
}
