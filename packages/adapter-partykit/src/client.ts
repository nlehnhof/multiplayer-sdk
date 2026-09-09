import { PartySocket } from 'partysocket';
import type { ClientConnectConfig, PlayerInfo, RoomConnection, Unsubscribe } from '@multiplayer-agent-sdk/core';
import type { ServerToClientMessage } from './protocol.js';

export interface PartyKitClientConnectConfig<TMeta = unknown> extends ClientConnectConfig<TMeta> {
  /** PartyKit party name, if the server isn't registered as the default "main" party. */
  party?: string;
}

/**
 * Connects to a room created by `createPartyKitServer`. `state`/`presence`
 * only become meaningful after the first "sync" message arrives from the
 * server — prefer `onStateChange` over reading `.state` synchronously right
 * after calling this.
 */
export function connectPartyKitClient<TView, TAction, TMeta = unknown>(
  config: PartyKitClientConnectConfig<TMeta>
): RoomConnection<TView, TAction, TMeta> {
  if (!config.host) {
    throw new Error(
      'PartyKit adapter requires `host` (e.g. "127.0.0.1:1999" for local dev, or your deployed PartyKit host).'
    );
  }

  const socket = new PartySocket({
    host: config.host,
    room: config.roomId,
    party: config.party,
    query: {
      playerId: config.player.id,
      meta: config.player.meta !== undefined ? JSON.stringify(config.player.meta) : undefined,
    },
  });

  let state: TView | undefined;
  let presence: PlayerInfo<TMeta>[] = [];
  const stateListeners = new Set<(state: TView) => void>();
  const presenceListeners = new Set<(players: PlayerInfo<TMeta>[]) => void>();

  socket.addEventListener('message', (event: MessageEvent) => {
    if (typeof event.data !== 'string') return;

    let message: ServerToClientMessage<TView, TMeta>;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }

    if (message.type === 'sync') {
      state = message.state;
      presence = message.presence;
      stateListeners.forEach((cb) => cb(message.state));
      presenceListeners.forEach((cb) => cb(message.presence));
    }
    // 'error' messages are server-broadcast, non-fatal notices (e.g. a
    // rejected action); there is no dedicated subscription API for them yet.
  });

  return {
    get state(): TView {
      if (state === undefined) {
        throw new Error('Not connected yet: state is only available after the first sync message.');
      }
      return state;
    },
    get presence(): PlayerInfo<TMeta>[] {
      return presence;
    },
    send(action: TAction): void {
      socket.send(JSON.stringify({ type: 'action', action }));
    },
    onStateChange(cb: (state: TView) => void): Unsubscribe {
      stateListeners.add(cb);
      return () => stateListeners.delete(cb);
    },
    onPresenceChange(cb: (players: PlayerInfo<TMeta>[]) => void): Unsubscribe {
      presenceListeners.add(cb);
      return () => presenceListeners.delete(cb);
    },
    disconnect(): void {
      socket.close();
    },
  };
}
