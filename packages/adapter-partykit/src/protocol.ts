import type { PlayerInfo } from '@multiplayer-agent-sdk/core';

export type SyncMessage<TState, TMeta> = {
  type: 'sync';
  state: TState;
  presence: PlayerInfo<TMeta>[];
};

export type ErrorMessage = {
  type: 'error';
  message: string;
};

export type ServerToClientMessage<TState, TMeta> = SyncMessage<TState, TMeta> | ErrorMessage;

export type ActionMessage<TAction> = {
  type: 'action';
  action: TAction;
};

export function toErrorMessage(err: unknown): ErrorMessage {
  return { type: 'error', message: err instanceof Error ? err.message : String(err) };
}
