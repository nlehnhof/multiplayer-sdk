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
 *
 * Each connection is sent its own projection of state via
 * `definition.toClientView`, if provided — see ADR 0002.
 */
export function createPartyKitServer<TState, TAction, TMeta = unknown, TView = TState>(
  definition: RoomDefinition<TState, TAction, TMeta, TView>
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
      } catch (err) {
        sender.send(JSON.stringify(toErrorMessage(err)));
        return;
      }
      this.#broadcastSync();
    }

    onClose(connection: Party.Connection): void {
      const player = this.#playerByConnectionId.get(connection.id);
      if (!player) return;
      this.#playerByConnectionId.delete(connection.id);
      this.#engine.leave(player.id);
      this.#broadcastSync();
    }

    // Per-connection sends rather than one room.broadcast(): each player may
    // see a different projection of state (ADR 0002). Presence is not
    // per-player filtered, so it's identical across every message we send.
    //
    // Each connection's view/serialize/send is independently try/caught: a
    // buggy toClientView (easy mistake in agent-generated game code, e.g.
    // assuming a key exists for every viewer) or a non-serializable value
    // must not (a) stop other players from getting their correct sync, or
    // (b) get misreported to whichever player happens to trigger the next
    // action as "your action failed" when it didn't — this method is called
    // strictly after the state mutation that triggered it already
    // succeeded, so it never throws itself; a broken view only affects the
    // one connection whose view computation failed, via an 'error' message
    // to *that* connection.
    #broadcastSync(): void {
      const state = this.#engine.currentState;
      const presence = this.#engine.presence;

      for (const [connectionId, player] of this.#playerByConnectionId) {
        const connection = this.room.getConnection(connectionId);
        if (!connection) continue;

        try {
          const view = definition.toClientView ? definition.toClientView(state, player.id) : (state as unknown as TView);
          const message: SyncMessage<TView, TMeta> = { type: 'sync', state: view, presence };
          connection.send(JSON.stringify(message));
        } catch (err) {
          try {
            connection.send(JSON.stringify(toErrorMessage(err)));
          } catch {
            // Connection is unusable; nothing more to do for this one.
          }
        }
      }
    }
  };
}
