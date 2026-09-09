import { describe, expect, it, vi } from 'vitest';
import type { RoomDefinition } from '@multiplayer-agent-sdk/core';
import { createPartyKitServer } from './server.js';

interface CounterState {
  count: number;
}
type CounterAction = { type: 'increment' };

function definition(
  overrides: Partial<RoomDefinition<CounterState, CounterAction>> = {}
): RoomDefinition<CounterState, CounterAction> {
  return {
    createState: () => ({ count: 0 }),
    onJoin: (state) => state,
    onLeave: (state) => state,
    onAction: (state, action) => (action.type === 'increment' ? { count: state.count + 1 } : state),
    ...overrides,
  };
}

function fakeConnection(id: string) {
  return { id, send: vi.fn(), close: vi.fn() };
}

function fakeRoom() {
  return { broadcast: vi.fn() };
}

function fakeCtx(playerId: string) {
  return { request: { url: `https://example.com/parties/main/room1?playerId=${playerId}` } };
}

describe('createPartyKitServer', () => {
  it('broadcasts a sync message on connect', () => {
    const Server = createPartyKitServer(definition());
    const room = fakeRoom();
    const server = new Server(room as never);
    const conn = fakeConnection('conn-1');

    server.onConnect!(conn as never, fakeCtx('p1') as never);

    expect(room.broadcast).toHaveBeenCalledTimes(1);
    const [payload] = room.broadcast.mock.calls[0]!;
    expect(JSON.parse(payload as string)).toMatchObject({ type: 'sync', state: { count: 0 } });
  });

  it('applies actions from the sender and rebroadcasts state', () => {
    const Server = createPartyKitServer(definition());
    const room = fakeRoom();
    const server = new Server(room as never);
    const conn = fakeConnection('conn-1');
    server.onConnect!(conn as never, fakeCtx('p1') as never);

    server.onMessage!(JSON.stringify({ type: 'action', action: { type: 'increment' } }), conn as never);

    const lastCall = room.broadcast.mock.calls.at(-1)!;
    expect(JSON.parse(lastCall[0] as string)).toMatchObject({ type: 'sync', state: { count: 1 } });
  });

  it('sends an error back to the sender when an action throws, without rebroadcasting', () => {
    const def = definition({
      onAction: () => {
        throw new Error('nope');
      },
    });
    const Server = createPartyKitServer(def);
    const room = fakeRoom();
    const server = new Server(room as never);
    const conn = fakeConnection('conn-1');
    server.onConnect!(conn as never, fakeCtx('p1') as never);
    room.broadcast.mockClear();

    server.onMessage!(JSON.stringify({ type: 'action', action: { type: 'increment' } }), conn as never);

    expect(room.broadcast).not.toHaveBeenCalled();
    expect(conn.send).toHaveBeenCalledTimes(1);
    expect(JSON.parse(conn.send.mock.calls[0]![0] as string)).toEqual({ type: 'error', message: 'nope' });
  });

  it('ignores actions from connections that never joined', () => {
    const Server = createPartyKitServer(definition());
    const room = fakeRoom();
    const server = new Server(room as never);
    const conn = fakeConnection('stray');

    server.onMessage!(JSON.stringify({ type: 'action', action: { type: 'increment' } }), conn as never);

    expect(room.broadcast).not.toHaveBeenCalled();
  });

  it('removes the player and rebroadcasts on close', () => {
    const Server = createPartyKitServer(definition());
    const room = fakeRoom();
    const server = new Server(room as never);
    const conn = fakeConnection('conn-1');
    server.onConnect!(conn as never, fakeCtx('p1') as never);
    room.broadcast.mockClear();

    server.onClose!(conn as never);

    expect(room.broadcast).toHaveBeenCalledTimes(1);
  });

  it('rejects a join over maxPlayers and closes the connection', () => {
    const def = definition({ options: { maxPlayers: 1 } });
    const Server = createPartyKitServer(def);
    const room = fakeRoom();
    const server = new Server(room as never);

    server.onConnect!(fakeConnection('conn-1') as never, fakeCtx('p1') as never);
    const secondConn = fakeConnection('conn-2');
    server.onConnect!(secondConn as never, fakeCtx('p2') as never);

    expect(secondConn.close).toHaveBeenCalledWith(4000, 'join rejected');
    expect(JSON.parse(secondConn.send.mock.calls[0]![0] as string)).toMatchObject({ type: 'error' });
  });
});
