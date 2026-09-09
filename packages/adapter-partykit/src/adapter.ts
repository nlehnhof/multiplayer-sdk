import type { ClientConnectConfig, MultiplayerAdapter, RoomConnection, RoomDefinition } from '@multiplayer-agent-sdk/core';
import { createPartyKitServer } from './server.js';
import { connectPartyKitClient, type PartyKitClientConnectConfig } from './client.js';

export class PartyKitAdapter implements MultiplayerAdapter {
  createServer<TState, TAction, TMeta = unknown, TView = TState>(
    definition: RoomDefinition<TState, TAction, TMeta, TView>
  ) {
    return createPartyKitServer(definition);
  }

  connectClient<TView, TAction, TMeta = unknown>(
    config: ClientConnectConfig<TMeta> & Partial<PartyKitClientConnectConfig<TMeta>>
  ): RoomConnection<TView, TAction, TMeta> {
    return connectPartyKitClient(config);
  }
}
