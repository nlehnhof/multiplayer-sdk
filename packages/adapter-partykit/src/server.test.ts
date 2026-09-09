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

// The real PartyKit runtime already knows about a Connection by the time
// onConnect fires and answers room.getConnection(id) for it — so the fake
// room needs connections registered up front, not added reactively.
function fakeRoom() {
  const connections = new Map<string, { id: string; send: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> }>();
  return {
    connections,
    getConnection: vi.fn((id: string) => connections.get(id)),
  };
}

function fakeConnection(room: ReturnType<typeof fakeRoom>, id: string) {
  const conn = { id, send: vi.fn(), close: vi.fn() };
  room.connections.set(id, conn);
  return conn;
}

function fakeCtx(playerId: string) {
  return { request: { url: `https://example.com/parties/main/room1?playerId=${playerId}` } };
}

function lastSync(conn: { send: ReturnType<typeof vi.fn> }) {
  const call = conn.send.mock.calls.at(-1)!;
  return JSON.parse(call[0] as string);
}

describe('createPartyKitServer', () => {
  it('sends the connecting client a sync message', () => {
    const Server = createPartyKitServer(definition());
    const room = fakeRoom();
    const server = new Server(room as never);
    const conn = fakeConnection(room, 'conn-1');

    server.onConnect!(conn as never, fakeCtx('p1') as never);

    expect(conn.send).toHaveBeenCalledTimes(1);
    expect(lastSync(conn)).toMatchObject({ type: 'sync', state: { count: 0 } });
  });

  it('applies actions from the sender and sends updated state to connected clients', () => {
    const Server = createPartyKitServer(definition());
    const room = fakeRoom();
    const server = new Server(room as never);
    const conn = fakeConnection(room, 'conn-1');
    server.onConnect!(conn as never, fakeCtx('p1') as never);

    server.onMessage!(JSON.stringify({ type: 'action', action: { type: 'increment' } }), conn as never);

    expect(lastSync(conn)).toMatchObject({ type: 'sync', state: { count: 1 } });
  });

  it('sends an error back to the sender when an action throws, without a new sync', () => {
    const def = definition({
      onAction: () => {
        throw new Error('nope');
      },
    });
    const Server = createPartyKitServer(def);
    const room = fakeRoom();
    const server = new Server(room as never);
    const conn = fakeConnection(room, 'conn-1');
    server.onConnect!(conn as never, fakeCtx('p1') as never);
    conn.send.mockClear();

    server.onMessage!(JSON.stringify({ type: 'action', action: { type: 'increment' } }), conn as never);

    expect(conn.send).toHaveBeenCalledTimes(1);
    expect(JSON.parse(conn.send.mock.calls[0]![0] as string)).toEqual({ type: 'error', message: 'nope' });
  });

  it('ignores actions from connections that never joined', () => {
    const Server = createPartyKitServer(definition());
    const room = fakeRoom();
    const server = new Server(room as never);
    const conn = fakeConnection(room, 'stray');

    server.onMessage!(JSON.stringify({ type: 'action', action: { type: 'increment' } }), conn as never);

    expect(conn.send).not.toHaveBeenCalled();
  });

  it('removes the player and sends the remaining player updated state on close', () => {
    const Server = createPartyKitServer(definition());
    const room = fakeRoom();
    const server = new Server(room as never);
    const connA = fakeConnection(room, 'conn-a');
    const connB = fakeConnection(room, 'conn-b');
    server.onConnect!(connA as never, fakeCtx('a') as never);
    server.onConnect!(connB as never, fakeCtx('b') as never);
    connB.send.mockClear();

    server.onClose!(connA as never);

    expect(connB.send).toHaveBeenCalledTimes(1);
    expect(lastSync(connB).presence).toHaveLength(1);
    expect(lastSync(connB).presence[0]).toMatchObject({ id: 'b' });
  });

  it('rejects a join over maxPlayers and closes the connection', () => {
    const def = definition({ options: { maxPlayers: 1 } });
    const Server = createPartyKitServer(def);
    const room = fakeRoom();
    const server = new Server(room as never);

    server.onConnect!(fakeConnection(room, 'conn-1') as never, fakeCtx('p1') as never);
    const secondConn = fakeConnection(room, 'conn-2');
    server.onConnect!(secondConn as never, fakeCtx('p2') as never);

    expect(secondConn.close).toHaveBeenCalledWith(4000, 'join rejected');
    expect(JSON.parse(secondConn.send.mock.calls[0]![0] as string)).toMatchObject({ type: 'error' });
  });

  it('sends each player their own toClientView projection (ADR 0002)', () => {
    interface HiddenState {
      secrets: Record<string, string>;
    }
    const def: RoomDefinition<HiddenState, never, unknown, { mine: string | undefined; othersCount: number }> = {
      createState: () => ({ secrets: {} }),
      onJoin: (state, player) => ({ secrets: { ...state.secrets, [player.id]: `secret-for-${player.id}` } }),
      onLeave: (state) => state,
      onAction: (state) => state,
      toClientView: (state, viewerId) => ({
        mine: state.secrets[viewerId],
        othersCount: Object.keys(state.secrets).filter((id) => id !== viewerId).length,
      }),
    };
    const Server = createPartyKitServer(def);
    const room = fakeRoom();
    const server = new Server(room as never);
    const connA = fakeConnection(room, 'conn-a');
    const connB = fakeConnection(room, 'conn-b');

    server.onConnect!(connA as never, fakeCtx('a') as never);
    server.onConnect!(connB as never, fakeCtx('b') as never);

    expect(lastSync(connA).state).toEqual({ mine: 'secret-for-a', othersCount: 1 });
    expect(lastSync(connB).state).toEqual({ mine: 'secret-for-b', othersCount: 1 });
  });

  it("a toClientView that throws for one player doesn't block earlier-iterated players' sync or misreport the actor's action (regression)", () => {
    // 'broken' is connected (and thus iterated) before 'ok', so this proves
    // a later-in-iteration failure can't have retroactively affected 'ok' —
    // and that onMessage's try/catch (which guards engine.action, not the
    // broadcast) never mistakes a downstream view failure for a rejected
    // action.
    const def: RoomDefinition<CounterState, CounterAction, unknown, unknown> = {
      ...definition(),
      toClientView: (state, viewerId) => {
        if (viewerId === 'broken') throw new Error('view exploded');
        return state;
      },
    };
    const Server = createPartyKitServer(def);
    const room = fakeRoom();
    const server = new Server(room as never);
    const brokenConn = fakeConnection(room, 'conn-broken');
    const okConn = fakeConnection(room, 'conn-ok');
    server.onConnect!(brokenConn as never, fakeCtx('broken') as never);
    server.onConnect!(okConn as never, fakeCtx('ok') as never);
    brokenConn.send.mockClear();
    okConn.send.mockClear();

    server.onMessage!(JSON.stringify({ type: 'action', action: { type: 'increment' } }), okConn as never);

    expect(JSON.parse(okConn.send.mock.calls[0]![0] as string)).toEqual({
      type: 'sync',
      state: { count: 1 },
      presence: expect.any(Array),
    });
    expect(JSON.parse(brokenConn.send.mock.calls[0]![0] as string)).toEqual({
      type: 'error',
      message: 'view exploded',
    });
  });
});
