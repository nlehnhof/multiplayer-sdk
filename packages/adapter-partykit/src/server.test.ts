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

// A real PartyKit `room.storage` is an async KV store backed by the
// Durable Object; this fake is just a Map with the same async get/put
// surface. Two `fakeRoom()` calls sharing one `backingStore` simulate a
// hibernation wake: PartyKit reconstructs the Party.Server class (a fresh
// instance, fresh in-memory fields) but storage survives — see server.ts's
// class-level doc comment and ADR 0003.
function fakeStorage(backingStore = new Map<string, unknown>()) {
  return {
    backingStore,
    get: vi.fn(async (key: string) => backingStore.get(key)),
    put: vi.fn(async (key: string, value: unknown) => {
      backingStore.set(key, value);
    }),
  };
}

// The real PartyKit runtime already knows about a Connection by the time
// onConnect fires and answers room.getConnection(id) for it — so the fake
// room needs connections registered up front, not added reactively.
function fakeRoom(backingStore?: Map<string, unknown>) {
  const connections = new Map<string, { id: string; send: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> }>();
  return {
    connections,
    storage: fakeStorage(backingStore),
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
  it('sends the connecting client a sync message', async () => {
    const Server = createPartyKitServer(definition());
    const room = fakeRoom();
    const server = new Server(room as never);
    const conn = fakeConnection(room, 'conn-1');

    await server.onConnect!(conn as never, fakeCtx('p1') as never);

    expect(conn.send).toHaveBeenCalledTimes(1);
    expect(lastSync(conn)).toMatchObject({ type: 'sync', state: { count: 0 } });
  });

  it('applies actions from the sender and sends updated state to connected clients', async () => {
    const Server = createPartyKitServer(definition());
    const room = fakeRoom();
    const server = new Server(room as never);
    const conn = fakeConnection(room, 'conn-1');
    await server.onConnect!(conn as never, fakeCtx('p1') as never);

    await server.onMessage!(JSON.stringify({ type: 'action', action: { type: 'increment' } }), conn as never);

    expect(lastSync(conn)).toMatchObject({ type: 'sync', state: { count: 1 } });
  });

  it('sends an error back to the sender when an action throws, without a new sync', async () => {
    const def = definition({
      onAction: () => {
        throw new Error('nope');
      },
    });
    const Server = createPartyKitServer(def);
    const room = fakeRoom();
    const server = new Server(room as never);
    const conn = fakeConnection(room, 'conn-1');
    await server.onConnect!(conn as never, fakeCtx('p1') as never);
    conn.send.mockClear();

    await server.onMessage!(JSON.stringify({ type: 'action', action: { type: 'increment' } }), conn as never);

    expect(conn.send).toHaveBeenCalledTimes(1);
    expect(JSON.parse(conn.send.mock.calls[0]![0] as string)).toEqual({ type: 'error', message: 'nope' });
  });

  it('ignores actions from connections that never joined', async () => {
    const Server = createPartyKitServer(definition());
    const room = fakeRoom();
    const server = new Server(room as never);
    const conn = fakeConnection(room, 'stray');

    await server.onMessage!(JSON.stringify({ type: 'action', action: { type: 'increment' } }), conn as never);

    expect(conn.send).not.toHaveBeenCalled();
  });

  it('removes the player and sends the remaining player updated state on close', async () => {
    const Server = createPartyKitServer(definition());
    const room = fakeRoom();
    const server = new Server(room as never);
    const connA = fakeConnection(room, 'conn-a');
    const connB = fakeConnection(room, 'conn-b');
    await server.onConnect!(connA as never, fakeCtx('a') as never);
    await server.onConnect!(connB as never, fakeCtx('b') as never);
    connB.send.mockClear();

    await server.onClose!(connA as never);

    expect(connB.send).toHaveBeenCalledTimes(1);
    expect(lastSync(connB).presence).toHaveLength(1);
    expect(lastSync(connB).presence[0]).toMatchObject({ id: 'b' });
  });

  it('rejects a join over maxPlayers and closes the connection', async () => {
    const def = definition({ options: { maxPlayers: 1 } });
    const Server = createPartyKitServer(def);
    const room = fakeRoom();
    const server = new Server(room as never);

    await server.onConnect!(fakeConnection(room, 'conn-1') as never, fakeCtx('p1') as never);
    const secondConn = fakeConnection(room, 'conn-2');
    await server.onConnect!(secondConn as never, fakeCtx('p2') as never);

    expect(secondConn.close).toHaveBeenCalledWith(4000, 'join rejected');
    expect(JSON.parse(secondConn.send.mock.calls[0]![0] as string)).toMatchObject({ type: 'error' });
  });

  it('sends each player their own toClientView projection (ADR 0002)', async () => {
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

    await server.onConnect!(connA as never, fakeCtx('a') as never);
    await server.onConnect!(connB as never, fakeCtx('b') as never);

    expect(lastSync(connA).state).toEqual({ mine: 'secret-for-a', othersCount: 1 });
    expect(lastSync(connB).state).toEqual({ mine: 'secret-for-b', othersCount: 1 });
  });

  it("a toClientView that throws for one player doesn't block earlier-iterated players' sync or misreport the actor's action (regression)", async () => {
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
    await server.onConnect!(brokenConn as never, fakeCtx('broken') as never);
    await server.onConnect!(okConn as never, fakeCtx('ok') as never);
    brokenConn.send.mockClear();
    okConn.send.mockClear();

    await server.onMessage!(JSON.stringify({ type: 'action', action: { type: 'increment' } }), okConn as never);

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

  describe('hibernation survival (ADR 0003)', () => {
    // These simulate exactly what PartyKit's docs describe happening on a
    // hibernation wake: "the constructor and onStart callback are executed
    // again" while "the open connections to clients are still maintained."
    // A fresh `Server` instance sharing the same backing storage Map, with
    // the same connections still registered on a fresh `fakeRoom`, is that
    // scenario — without needing a real live PartyKit process to prove it.

    it('a fresh instance restores state and presence from storage in onStart', async () => {
      const Server = createPartyKitServer(definition());
      const backingStore = new Map<string, unknown>();
      const room1 = fakeRoom(backingStore);
      const server1 = new Server(room1 as never);
      const conn1 = fakeConnection(room1, 'conn-1');
      await server1.onConnect!(conn1 as never, fakeCtx('p1') as never);
      await server1.onMessage!(JSON.stringify({ type: 'action', action: { type: 'increment' } }), conn1 as never);

      // "Hibernate": a brand-new instance, brand-new in-memory fields, same
      // storage. The connection is re-registered on the new fake room
      // (mirroring the real connection surviving underneath).
      const room2 = fakeRoom(backingStore);
      const server2 = new Server(room2 as never);
      const conn2 = fakeConnection(room2, 'conn-1');
      await server2.onStart!();

      conn2.send.mockClear();
      await server2.onMessage!(JSON.stringify({ type: 'action', action: { type: 'increment' } }), conn2 as never);

      // Count continues from 1 (pre-hibernation), not resets to a fresh 0.
      expect(lastSync(conn2)).toMatchObject({ type: 'sync', state: { count: 2 } });
    });

    it('onClose after a wake still resolves the right player id from restored connection state', async () => {
      const Server = createPartyKitServer(definition());
      const backingStore = new Map<string, unknown>();
      const room1 = fakeRoom(backingStore);
      const server1 = new Server(room1 as never);
      const connA1 = fakeConnection(room1, 'conn-a');
      const connB1 = fakeConnection(room1, 'conn-b');
      await server1.onConnect!(connA1 as never, fakeCtx('a') as never);
      await server1.onConnect!(connB1 as never, fakeCtx('b') as never);

      const room2 = fakeRoom(backingStore);
      const server2 = new Server(room2 as never);
      const connA2 = fakeConnection(room2, 'conn-a');
      const connB2 = fakeConnection(room2, 'conn-b');
      await server2.onStart!();
      connB2.send.mockClear();

      await server2.onClose!(connA2 as never);

      expect(lastSync(connB2).presence).toHaveLength(1);
      expect(lastSync(connB2).presence[0]).toMatchObject({ id: 'b' });
    });

    it('with nothing in storage yet, onStart is a no-op and behaves exactly as before (backward compatible)', async () => {
      const Server = createPartyKitServer(definition());
      const room = fakeRoom();
      const server = new Server(room as never);

      await server.onStart!();
      const conn = fakeConnection(room, 'conn-1');
      await server.onConnect!(conn as never, fakeCtx('p1') as never);

      expect(lastSync(conn)).toMatchObject({ type: 'sync', state: { count: 0 } });
    });
  });
});
