import type { ClientConnectConfig, MultiplayerAdapter, RoomConnection, RoomDefinition } from '@multiplayer-agent-sdk/core';
import { createPartyKitServer } from './server.js';
import { connectPartyKitClient, type PartyKitClientConnectConfig } from './client.js';

export class PartyKitAdapter implements MultiplayerAdapter {
  createServer<TState, TAction, TMeta = unknown>(definition: RoomDefinition<TState, TAction, TMeta>) {
    return createPartyKitServer(definition);
  }

  connectClient<TState, TAction, TMeta = unknown>(
    config: ClientConnectConfig<TMeta> & Partial<PartyKitClientConnectConfig<TMeta>>
  ): RoomConnection<TState, TAction, TMeta> {
    return connectPartyKitClient(config);
  }
}
