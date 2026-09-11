import type * as Party from 'partykit/server';
import { RoomEngine } from '@multiplayer-agent-sdk/core';
import type { PlayerInfo, RoomDefinition, RoomEngineSnapshot } from '@multiplayer-agent-sdk/core';
import { toErrorMessage, type ActionMessage, type SyncMessage } from './protocol.js';

const ENGINE_STORAGE_KEY = 'multiplayer-agent-sdk/engine-snapshot';
const CONNECTIONS_STORAGE_KEY = 'multiplayer-agent-sdk/connection-player-ids';

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
 *
 * A PartyKit room is a hibernating Durable Object under the hood: PartyKit
 * can (and, under real usage, will) tear down and reconstruct this class —
 * re-running its constructor — between any two events, keeping only the
 * underlying WebSocket connections and `room.storage` alive. Every mutation
 * is persisted via `#persist()` and restored in `onStart()` (which PartyKit
 * guarantees runs before the first onConnect/onMessage, including after a
 * wake) so a hibernate/wake cycle — which will happen during any real game
 * with a gap between moves — is invisible to players. See ADR 0003; this
 * was a real, silent bug (the whole room resetting mid-game) before this
 * fix, caught by a live test, not by the unit suite.
 */
export function createPartyKitServer<TState, TAction, TMeta = unknown, TView = TState>(
  definition: RoomDefinition<TState, TAction, TMeta, TView>
) {
  // Uses `#private` fields/methods (not the `private` keyword) because TS
  // can't emit a .d.ts for an exported anonymous class with `private`
  // members (TS4094) — true private fields sidestep that entirely.
  return class PartyKitRoomServer implements Party.Server {
    #engine = new RoomEngine(definition);
    // connection.id -> game-level player id. Rebuilt in onStart() after a
    // hibernation wake, same reason as #engine above — RoomEngine's own
    // `players` map is keyed by game-level player id and knows nothing
    // about PartyKit connections, so this adapter-local mapping is what
    // turns a raw `sender: Party.Connection` back into a player id.
    #playerIdByConnectionId = new Map<string, string>();

    constructor(readonly room: Party.Room) {}

    async onStart(): Promise<void> {
      const [snapshot, connectionEntries] = await Promise.all([
        this.room.storage.get<RoomEngineSnapshot<TState, TMeta>>(ENGINE_STORAGE_KEY),
        this.room.storage.get<[string, string][]>(CONNECTIONS_STORAGE_KEY),
      ]);
      if (snapshot) {
        this.#engine = new RoomEngine(definition, snapshot);
      }
      if (connectionEntries) {
        this.#playerIdByConnectionId = new Map(connectionEntries);
      }
    }

    async onConnect(connection: Party.Connection, ctx: Party.ConnectionContext): Promise<void> {
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

      this.#playerIdByConnectionId.set(connection.id, playerId);
      await this.#persist();
      this.#broadcastSync();
    }

    async onMessage(message: string | ArrayBuffer | ArrayBufferView, sender: Party.Connection): Promise<void> {
      if (typeof message !== 'string') return;
      const playerId = this.#playerIdByConnectionId.get(sender.id);
      if (!playerId) return;

      let parsed: ActionMessage<TAction>;
      try {
        parsed = JSON.parse(message);
      } catch {
        return;
      }
      if (parsed?.type !== 'action') return;

      try {
        this.#engine.action(playerId, parsed.action);
      } catch (err) {
        sender.send(JSON.stringify(toErrorMessage(err)));
        return;
      }
      await this.#persist();
      this.#broadcastSync();
    }

    async onClose(connection: Party.Connection): Promise<void> {
      const playerId = this.#playerIdByConnectionId.get(connection.id);
      if (!playerId) return;
      this.#playerIdByConnectionId.delete(connection.id);
      this.#engine.leave(playerId);
      await this.#persist();
      this.#broadcastSync();
    }

    // Persisted before broadcasting (not after, and not fire-and-forget):
    // if the instance were evicted right after clients heard about a state
    // change but before storage.put landed, a wake would resurrect the
    // *previous* state while every client's local copy had already moved
    // on — worse than a plain delay. Awaiting here keeps storage and what
    // clients have already been told about it consistent with each other.
    async #persist(): Promise<void> {
      await Promise.all([
        this.room.storage.put(ENGINE_STORAGE_KEY, this.#engine.snapshot()),
        this.room.storage.put(CONNECTIONS_STORAGE_KEY, [...this.#playerIdByConnectionId.entries()]),
      ]);
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

      for (const [connectionId, playerId] of this.#playerIdByConnectionId) {
        const connection = this.room.getConnection(connectionId);
        if (!connection) continue;

        try {
          const view = definition.toClientView ? definition.toClientView(state, playerId) : (state as unknown as TView);
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
