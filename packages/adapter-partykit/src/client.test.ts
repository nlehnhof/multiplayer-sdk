import { beforeEach, describe, expect, it, vi } from 'vitest';

type Listener = (event: { data: string }) => void;
const listeners: Record<string, Listener[]> = {};
const sendMock = vi.fn();
const closeMock = vi.fn();
let lastOptions: { host: string; room?: string; party?: string; query?: Record<string, unknown> } | undefined;

vi.mock('partysocket', () => ({
  // Must be a regular function (not an arrow) so `new PartySocket(...)` works;
  // returning an object from a constructor call overrides the `this` binding.
  PartySocket: vi.fn().mockImplementation(function (options: typeof lastOptions) {
    lastOptions = options;
    return {
      addEventListener: (type: string, cb: Listener) => {
        (listeners[type] ??= []).push(cb);
      },
      send: sendMock,
      close: closeMock,
    };
  }),
}));

const { connectPartyKitClient } = await import('./client.js');

function emitMessage(data: unknown) {
  for (const cb of listeners['message'] ?? []) cb({ data: JSON.stringify(data) });
}

beforeEach(() => {
  for (const key of Object.keys(listeners)) delete listeners[key];
  sendMock.mockClear();
  closeMock.mockClear();
  lastOptions = undefined;
});

describe('connectPartyKitClient', () => {
  it('passes room, and player id/meta as query params', () => {
    connectPartyKitClient({
      host: '127.0.0.1:1999',
      roomId: 'room1',
      player: { id: 'p1', meta: { name: 'Ann' } },
    });

    expect(lastOptions?.room).toBe('room1');
    expect(lastOptions?.query).toEqual({ playerId: 'p1', meta: JSON.stringify({ name: 'Ann' }) });
  });

  it('throws when state is read before the first sync', () => {
    const conn = connectPartyKitClient({ host: '127.0.0.1:1999', roomId: 'room1', player: { id: 'p1' } });
    expect(() => conn.state).toThrow(/not connected/i);
  });

  it('updates state and presence on sync messages and notifies listeners', () => {
    const conn = connectPartyKitClient<{ count: number }, { type: 'increment' }>({
      host: '127.0.0.1:1999',
      roomId: 'room1',
      player: { id: 'p1' },
    });
    const stateCb = vi.fn();
    const presenceCb = vi.fn();
    conn.onStateChange(stateCb);
    conn.onPresenceChange(presenceCb);

    emitMessage({ type: 'sync', state: { count: 1 }, presence: [{ id: 'p1', connectedAt: 1 }] });

    expect(conn.state).toEqual({ count: 1 });
    expect(conn.presence).toEqual([{ id: 'p1', connectedAt: 1 }]);
    expect(stateCb).toHaveBeenCalledWith({ count: 1 });
    expect(presenceCb).toHaveBeenCalledWith([{ id: 'p1', connectedAt: 1 }]);
  });

  it('stops notifying a listener after it unsubscribes', () => {
    const conn = connectPartyKitClient({ host: '127.0.0.1:1999', roomId: 'room1', player: { id: 'p1' } });
    const stateCb = vi.fn();
    const unsubscribe = conn.onStateChange(stateCb);
    unsubscribe();

    emitMessage({ type: 'sync', state: { count: 1 }, presence: [] });

    expect(stateCb).not.toHaveBeenCalled();
  });

  it('sends actions as JSON action messages', () => {
    const conn = connectPartyKitClient({ host: '127.0.0.1:1999', roomId: 'room1', player: { id: 'p1' } });
    conn.send({ type: 'increment' });
    expect(sendMock).toHaveBeenCalledWith(JSON.stringify({ type: 'action', action: { type: 'increment' } }));
  });

  it('closes the underlying socket on disconnect', () => {
    const conn = connectPartyKitClient({ host: '127.0.0.1:1999', roomId: 'room1', player: { id: 'p1' } });
    conn.disconnect();
    expect(closeMock).toHaveBeenCalled();
  });

  it('throws if host is missing', () => {
    expect(() =>
      connectPartyKitClient({ host: '', roomId: 'room1', player: { id: 'p1' } })
    ).toThrow(/requires `host`/);
  });
});
